package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"time"

	protocol "github.com/benisploy/monitor-schemas/go"
)

const (
	defaultMaxRetries    = 3
	defaultRetryBase     = 2 * time.Second
	defaultRequestTimeout = 30 * time.Second
)

type Config struct {
	Endpoint   string
	Token      string
	MaxRetries int
}

type Client struct {
	config  Config
	http    *http.Client
	msgID   int64
}

func New(config Config) *Client {
	if config.MaxRetries <= 0 {
		config.MaxRetries = defaultMaxRetries
	}

	return &Client{
		config: config,
		http: &http.Client{
			Timeout: defaultRequestTimeout,
		},
	}
}

func (c *Client) nextID() string {
	c.msgID++
	return fmt.Sprintf("monitor-%d", c.msgID)
}

func (c *Client) PushStats(ctx context.Context, payload protocol.StatsPushPayload) error {
	envelope := c.buildEnvelope(protocol.TypeStatsPush, payload)
	return c.sendWithRetry(ctx, envelope)
}

func (c *Client) PushEvent(ctx context.Context, payload protocol.EventPushPayload) error {
	envelope := c.buildEnvelope(protocol.TypeEventPush, payload)
	return c.sendWithRetry(ctx, envelope)
}

func (c *Client) buildEnvelope(msgType protocol.MessageType, payload interface{}) protocol.Envelope {
	raw, err := json.Marshal(payload)
	if err != nil {
		log.Printf("push: marshal payload for %s: %v", msgType, err)
		return protocol.Envelope{}
	}

	return protocol.Envelope{
		Type:      msgType,
		ID:        c.nextID(),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Payload:   raw,
	}
}

func (c *Client) sendWithRetry(ctx context.Context, envelope protocol.Envelope) error {
	if envelope.Type == "" {
		return nil
	}

	var lastErr error
	for attempt := 0; attempt < c.config.MaxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * defaultRetryBase
			log.Printf("push: retry %d/%d for %s in %v", attempt+1, c.config.MaxRetries, envelope.Type, backoff)

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
		}

		if err := c.send(ctx, envelope); err != nil {
			lastErr = err
			log.Printf("push: attempt %d/%d failed for %s: %v", attempt+1, c.config.MaxRetries, envelope.Type, err)
			continue
		}

		return nil
	}

	return fmt.Errorf("push: all %d retries exhausted for %s: %w", c.config.MaxRetries, envelope.Type, lastErr)
}

func (c *Client) send(ctx context.Context, envelope protocol.Envelope) error {
	data, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.Endpoint, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.config.Token)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	return nil
}
