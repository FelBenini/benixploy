package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	protocol "github.com/benisploy/monitor-schemas/go"
	"github.com/benisploy/node-monitor/internal/events"
	"github.com/benisploy/node-monitor/internal/push"
	"github.com/benisploy/node-monitor/internal/stats"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("node-monitor starting...")

	cfg := loadConfig()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	pushClient := push.New(push.Config{
		Endpoint:   cfg.IngestURL,
		Token:      cfg.BearerToken,
		MaxRetries: cfg.MaxRetries,
	})

	statsCollector := stats.New()

	statsTicker := time.NewTicker(cfg.StatsInterval)
	defer statsTicker.Stop()

	eventCallback := func(eventPayload protocol.EventPushPayload) {
		if err := pushClient.PushEvent(ctx, eventPayload); err != nil {
			log.Printf("main: push event: %v", err)
		}
	}

	eventTailer := events.NewTailer(eventCallback)

	go func() {
		log.Printf("main: starting event tailer")
		if err := eventTailer.Run(ctx); err != nil && err != context.Canceled {
			log.Printf("main: event tailer exited: %v", err)
		}
	}()

	log.Printf("main: pushing stats every %s to %s", cfg.StatsInterval, cfg.IngestURL)

	for {
		select {
		case <-ctx.Done():
			log.Println("main: shutting down")
			return

		case <-sigCh:
			log.Println("main: signal received, shutting down")
			cancel()
			return

		case <-statsTicker.C:
			payload := statsCollector.Gather()
			if err := pushClient.PushStats(ctx, payload); err != nil {
				log.Printf("main: push stats: %v", err)
			} else {
				log.Printf("main: pushed stats — cpu=%.1f%% mem=%d/%d disk=%d/%d containers=%d",
					payload.CPUPercent,
					payload.Memory.Used/(1024*1024),
					payload.Memory.Total/(1024*1024),
					payload.Disk.Used/(1024*1024),
					payload.Disk.Total/(1024*1024),
					payload.ContainerCount,
				)
			}
		}
	}
}

type config struct {
	IngestURL     string
	BearerToken   string
	StatsInterval time.Duration
	MaxRetries    int
}

func loadConfig() config {
	return config{
		IngestURL:     getEnv("CONTROL_PLANE_URL", "http://localhost:3000/api/telemetry/ingest"),
		BearerToken:   getEnv("BEARER_TOKEN", ""),
		StatsInterval: getDurationEnv("STATS_INTERVAL", 30*time.Second),
		MaxRetries:    getIntEnv("PUSH_MAX_RETRIES", 3),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDurationEnv(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		d, err := time.ParseDuration(v)
		if err == nil {
			return d
		}
		log.Printf("config: invalid %s=%q, using default %s", key, v, fallback)
	}
	return fallback
}

func getIntEnv(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		i, err := strconv.Atoi(v)
		if err == nil && i > 0 {
			return i
		}
		log.Printf("config: invalid %s=%q, using default %d", key, v, fallback)
	}
	return fallback
}
