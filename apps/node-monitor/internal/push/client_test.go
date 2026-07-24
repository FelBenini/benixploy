package push

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	protocol "github.com/benisploy/monitor-schemas/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPushStats(t *testing.T) {
	var received protocol.Envelope
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		assert.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		defer func() { _ = r.Body.Close() }()

		err = json.Unmarshal(body, &received)
		require.NoError(t, err)

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := New(Config{
		Endpoint:   server.URL,
		Token:      "test-token",
		MaxRetries: 1,
	})

	payload := protocol.StatsPushPayload{
		CPUPercent:     42.5,
		Memory:         protocol.MemoryStats{Total: 16000, Used: 8000, Available: 8000},
		Disk:           protocol.DiskStats{Total: 100000, Used: 40000},
		Uptime:         7200,
		ContainerCount: 2,
		ContainerStates: []protocol.ContainerState{
			{ID: "abc", Name: "web", State: "running"},
		},
	}

	err := client.PushStats(context.Background(), payload)
	require.NoError(t, err)

	assert.Equal(t, protocol.TypeStatsPush, received.Type)
	assert.NotEmpty(t, received.ID)
	assert.NotEmpty(t, received.Timestamp)

	var decodedPayload protocol.StatsPushPayload
	err = json.Unmarshal(received.Payload, &decodedPayload)
	require.NoError(t, err)

	assert.Equal(t, 42.5, decodedPayload.CPUPercent)
	assert.Equal(t, uint64(16000), decodedPayload.Memory.Total)
}

func TestPushEvent(t *testing.T) {
	var received protocol.Envelope
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		defer func() { _ = r.Body.Close() }()

		err = json.Unmarshal(body, &received)
		require.NoError(t, err)

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := New(Config{
		Endpoint:   server.URL,
		Token:      "test-token",
		MaxRetries: 1,
	})

	payload := protocol.EventPushPayload{
		EventType:     protocol.EventOOM,
		ContainerID:   "cont-123",
		ContainerName: "redis",
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		Extra:         map[string]interface{}{"exitCode": "137"},
	}

	err := client.PushEvent(context.Background(), payload)
	require.NoError(t, err)

	assert.Equal(t, protocol.TypeEventPush, received.Type)

	var decodedPayload protocol.EventPushPayload
	err = json.Unmarshal(received.Payload, &decodedPayload)
	require.NoError(t, err)

	assert.Equal(t, protocol.EventOOM, decodedPayload.EventType)
	assert.Equal(t, "cont-123", decodedPayload.ContainerID)
}

func TestPushRetryOnFailure(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 2 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := New(Config{
		Endpoint:   server.URL,
		Token:      "test-token",
		MaxRetries: 3,
	})

	payload := protocol.StatsPushPayload{CPUPercent: 10}
	err := client.PushStats(context.Background(), payload)
	require.NoError(t, err)
	assert.Equal(t, 2, attempts, "should have retried once")
}

func TestPushAllRetriesExhausted(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := New(Config{
		Endpoint:   server.URL,
		Token:      "test-token",
		MaxRetries: 2,
	})

	payload := protocol.StatsPushPayload{CPUPercent: 10}
	err := client.PushStats(context.Background(), payload)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "all 2 retries exhausted")
}

func TestPushContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(5 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := New(Config{
		Endpoint:   server.URL,
		Token:      "test-token",
		MaxRetries: 3,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	payload := protocol.StatsPushPayload{CPUPercent: 10}
	err := client.PushStats(ctx, payload)
	require.Error(t, err)
}

func TestPushServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = fmt.Fprintln(w, `{"error":"invalid token"}`)
	}))
	defer server.Close()

	client := New(Config{
		Endpoint:   server.URL,
		Token:      "bad-token",
		MaxRetries: 1,
	})

	payload := protocol.StatsPushPayload{CPUPercent: 10}
	err := client.PushStats(context.Background(), payload)
	require.Error(t, err)
}
