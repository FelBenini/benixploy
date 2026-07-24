package events

import (
	"encoding/json"
	"testing"
	"time"

	protocol "github.com/benisploy/monitor-schemas/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseEventDie(t *testing.T) {
	raw := `{"type":"container","action":"die","Actor":{"ID":"abc123def456","Attributes":{"name":"/my-container","image":"nginx:alpine","exitCode":"137"}},"time":1723456789,"timeNano":1723456789000000000}`

	event, err := parseEvent(raw)
	require.NoError(t, err)
	require.NotNil(t, event)

	assert.Equal(t, protocol.EventDie, event.EventType)
	assert.Equal(t, "abc123def456", event.ContainerID)
	assert.Equal(t, "my-container", event.ContainerName)
	assert.Equal(t, "137", event.Extra["exitCode"])
}

func TestParseEventOOM(t *testing.T) {
	raw := `{"type":"container","action":"oom","Actor":{"ID":"xyz789","Attributes":{"name":"/redis","image":"redis:7"}},"time":1723456790,"timeNano":1723456790000000000}`

	event, err := parseEvent(raw)
	require.NoError(t, err)
	require.NotNil(t, event)

	assert.Equal(t, protocol.EventOOM, event.EventType)
	assert.Equal(t, "redis", event.ContainerName)
}

func TestParseEventUnhealthy(t *testing.T) {
	raw := `{"type":"container","action":"health_status","Actor":{"ID":"health-1","Attributes":{"name":"/api","health_status":"unhealthy","image":"myapp:latest"}},"time":1723456791,"timeNano":1723456791000000000}`

	event, err := parseEvent(raw)
	require.NoError(t, err)
	require.NotNil(t, event)

	assert.Equal(t, protocol.EventUnhealthy, event.EventType)
	assert.Equal(t, "api", event.ContainerName)
	assert.Equal(t, "unhealthy", event.Extra["healthStatus"])
}

func TestParseEventHealthy(t *testing.T) {
	raw := `{"type":"container","action":"health_status","Actor":{"ID":"health-2","Attributes":{"name":"/api","health_status":"healthy"}},"time":1723456792,"timeNano":1723456792000000000}`

	event, err := parseEvent(raw)
	require.NoError(t, err)
	assert.Nil(t, event, "healthy events should be filtered out")
}

func TestParseEventNonContainer(t *testing.T) {
	raw := `{"type":"network","action":"create","Actor":{"ID":"net-1","Attributes":{}},"time":1723456793,"timeNano":1723456793000000000}`

	event, err := parseEvent(raw)
	require.NoError(t, err)
	assert.Nil(t, event)
}

func TestParseEventInvalidJSON(t *testing.T) {
	event, err := parseEvent(`{invalid}`)
	assert.Error(t, err)
	assert.Nil(t, event)
}

func TestRestartTracker(t *testing.T) {
	rt := newRestartTracker()
	cid := "container-1"

	assert.False(t, rt.record(cid, "web"), "first start should not trigger")
	assert.False(t, rt.record(cid, "web"), "second start should not trigger")
	assert.False(t, rt.record(cid, "web"), "third start should not trigger")
	assert.False(t, rt.record(cid, "web"), "fourth start should not trigger")
	assert.True(t, rt.record(cid, "web"), "fifth start should trigger restart loop")
}

func TestRestartTrackerTimestamps(t *testing.T) {
	rt := newRestartTracker()
	cid := "container-2"

	// Record events spread beyond the window
	for i := 0; i < restartLoopThreshold; i++ {
		rt.history[cid] = append(rt.history[cid], time.Now().Add(-time.Hour))
	}

	// Should NOT trigger because all are outside the window
	result := rt.record(cid, "web")
	assert.False(t, result, "events outside window should not trigger restart loop")
}

func TestEventRoundTrip(t *testing.T) {
	appID := "app-xyz"
	payload := protocol.EventPushPayload{
		EventType:     protocol.EventDie,
		ContainerID:   "abc123",
		ContainerName: "web",
		AppID:         &appID,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		Extra: map[string]interface{}{
			"exitCode": "137",
		},
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded protocol.EventPushPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, payload.EventType, decoded.EventType)
	assert.Equal(t, payload.ContainerID, decoded.ContainerID)
	assert.Equal(t, *payload.AppID, *decoded.AppID)
	assert.Equal(t, payload.Extra["exitCode"], decoded.Extra["exitCode"])
}
