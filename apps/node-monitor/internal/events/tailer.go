package events

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"sync"
	"time"

	protocol "github.com/benisploy/monitor-schemas/go"
)

const restartLoopWindow = 30 * time.Second
const restartLoopThreshold = 5

type EventCallback func(event protocol.EventPushPayload)

type Tailer struct {
	callback EventCallback
	eventsCh chan protocol.EventPushPayload

	restartTracker *restartTracker
}

type restartTracker struct {
	mu      sync.Mutex
	history map[string][]time.Time
}

func newRestartTracker() *restartTracker {
	return &restartTracker{
		history: make(map[string][]time.Time),
	}
}

func (rt *restartTracker) record(containerID, containerName string) bool {
	rt.mu.Lock()
	defer rt.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-restartLoopWindow)

	times := rt.history[containerID]
	var recent []time.Time
	for _, t := range times {
		if t.After(windowStart) {
			recent = append(recent, t)
		}
	}
	recent = append(recent, now)
	rt.history[containerID] = recent

	return len(recent) >= restartLoopThreshold
}

func NewTailer(callback EventCallback) *Tailer {
	return &Tailer{
		callback:       callback,
		eventsCh:       make(chan protocol.EventPushPayload, 100),
		restartTracker: newRestartTracker(),
	}
}

func (t *Tailer) Events() <-chan protocol.EventPushPayload {
	return t.eventsCh
}

func (t *Tailer) Run(ctx context.Context) error {
	args := []string{
		"events",
		"--format", "json",
		"--filter", "type=container",
	}

	cmd := exec.CommandContext(ctx, "docker", args...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("create stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start docker events: %w", err)
	}

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		event, err := parseEvent(line)
		if err != nil {
			log.Printf("events: parse error: %v (line: %s)", err, line)
			continue
		}
		if event == nil {
			continue
		}

		select {
		case t.eventsCh <- *event:
		default:
			log.Printf("events: channel full, dropping event")
		}

		if t.callback != nil {
			t.callback(*event)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan docker events: %w", err)
	}

	return cmd.Wait()
}

type dockerEvent struct {
	Type          string            `json:"type"`
	Action        string            `json:"action"`
	Actor         dockerEventActor  `json:"Actor"`
	Time          int64             `json:"time"`
	TimeNano      int64             `json:"timeNano"`
}

type dockerEventActor struct {
	ID         string            `json:"ID"`
	Attributes map[string]string `json:"Attributes"`
}

func parseEvent(raw string) (*protocol.EventPushPayload, error) {
	var de dockerEvent
	if err := json.Unmarshal([]byte(raw), &de); err != nil {
		return nil, fmt.Errorf("unmarshal docker event: %w", err)
	}

	if de.Type != "container" {
		return nil, nil
	}

	containerName := strings.TrimLeft(de.Actor.Attributes["name"], "/")
	containerID := de.Actor.ID
	if len(containerID) > 12 {
		containerID = containerID[:12]
	}
	image := de.Actor.Attributes["image"]

	ts := time.Unix(de.Time, 0).UTC().Format(time.RFC3339)

	switch de.Action {
	case "die":
		exitCode := de.Actor.Attributes["exitCode"]
		extra := map[string]interface{}{
			"exitCode": exitCode,
		}
		return &protocol.EventPushPayload{
			EventType:     protocol.EventDie,
			ContainerID:   containerID,
			ContainerName: containerName,
			Timestamp:     ts,
			Extra:         extra,
		}, nil

	case "oom":
		extra := map[string]interface{}{
			"image": image,
		}
		return &protocol.EventPushPayload{
			EventType:     protocol.EventOOM,
			ContainerID:   containerID,
			ContainerName: containerName,
			Timestamp:     ts,
			Extra:         extra,
		}, nil

	case "health_status":
		status := de.Actor.Attributes["health_status"]
		if status == "unhealthy" {
			extra := map[string]interface{}{
				"healthStatus": status,
				"image":        image,
			}
			return &protocol.EventPushPayload{
				EventType:     protocol.EventUnhealthy,
				ContainerID:   containerID,
				ContainerName: containerName,
				Timestamp:     ts,
				Extra:         extra,
			}, nil
		}
		return nil, nil

	case "start":
		return nil, nil

	default:
		return nil, nil
	}
}
