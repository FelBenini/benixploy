package stats

import (
	"testing"

	protocol "github.com/benisploy/monitor-schemas/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewCollector(t *testing.T) {
	c := New()
	require.NotNil(t, c)
	assert.NotEmpty(t, c.Hostname(), "hostname should not be empty")
	assert.Greater(t, c.CPUCount(), 0, "CPU count should be positive")
}

func TestGather(t *testing.T) {
	c := New()
	p := c.Gather()

	assert.GreaterOrEqual(t, p.CPUPercent, 0.0)
	assert.LessOrEqual(t, p.CPUPercent, 100.0)
	assert.Greater(t, p.Memory.Total, uint64(0), "total memory should be positive")
	assert.Greater(t, p.Disk.Total, uint64(0), "total disk should be positive")
	assert.GreaterOrEqual(t, p.Uptime, uint64(0))
}

func TestListContainers(t *testing.T) {
	containers := listContainers()
	// Should not panic; may return empty if no docker or no containers
	if len(containers) == 0 {
		t.Skip("no containers found (docker may not be running)")
	}
	for _, c := range containers {
		assert.NotEmpty(t, c.ID)
		assert.NotEmpty(t, c.Name)
		assert.Contains(t, []string{"created", "running", "paused", "restarting", "removing", "exited", "dead", "unknown"}, c.State)
	}
}

func TestNormalizeState(t *testing.T) {
	assert.Equal(t, "running", normalizeState("running"))
	assert.Equal(t, "running", normalizeState("Running"))
	assert.Equal(t, "exited", normalizeState("exited"))
	assert.Equal(t, "exited", normalizeState("Exited"))
	assert.Equal(t, "unknown", normalizeState("bogus"))
}

func TestFmtContainerList(t *testing.T) {
	assert.Equal(t, "none", fmtContainerList(nil))
	assert.Equal(t, "none", fmtContainerList([]protocol.ContainerState{}))
	assert.Equal(t, "web(running)", fmtContainerList([]protocol.ContainerState{{Name: "web", State: "running"}}))
}
