package stats

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	protocol "github.com/benisploy/monitor-schemas/go"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

type Collector struct {
	hostname string
	cpuCount int
}

func New() *Collector {
	h := ""
	if hostname, err := os.Hostname(); err == nil {
		h = hostname
	}
	return &Collector{
		hostname: h,
		cpuCount: runtime.NumCPU(),
	}
}

func (c *Collector) Gather() protocol.StatsPushPayload {
	var cpuPct float64
	if pcts, err := cpu.Percent(time.Second, false); err == nil && len(pcts) > 0 {
		cpuPct = pcts[0]
	}

	var memTotal, memUsed, memAvail uint64
	if v, err := mem.VirtualMemory(); err == nil {
		memTotal = v.Total
		memUsed = v.Used
		memAvail = v.Available
	}

	var diskTotal, diskUsed uint64
	if d, err := disk.Usage("/"); err == nil {
		diskTotal = d.Total
		diskUsed = d.Used
	}

	uptime := uint64(0)
	if u, err := host.Uptime(); err == nil {
		uptime = u
	}

	containers := listContainers()

	return protocol.StatsPushPayload{
		CPUPercent:      cpuPct,
		Memory:          protocol.MemoryStats{Total: memTotal, Used: memUsed, Available: memAvail},
		Disk:            protocol.DiskStats{Total: diskTotal, Used: diskUsed},
		Uptime:          uptime,
		ContainerCount:  len(containers),
		ContainerStates: containers,
	}
}

type dockerPSRow struct {
	ID    string `json:"ID"`
	Names string `json:"Names"`
	State string `json:"State"`
}

func listContainers() []protocol.ContainerState {
	cmd := exec.Command("docker", "ps", "--format", "json", "--no-trunc")
	output, err := cmd.Output()
	if err != nil {
		return nil
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(lines) == 0 || lines[0] == "" {
		return nil
	}

	seen := make(map[string]bool)
	var result []protocol.ContainerState

	for _, line := range lines {
		var row dockerPSRow
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			continue
		}
		id := row.ID
		if len(id) > 12 {
			id = id[:12]
		}
		if seen[id] {
			continue
		}
		seen[id] = true

		name := strings.TrimLeft(row.Names, "/")
		result = append(result, protocol.ContainerState{
			ID:    id,
			Name:  name,
			State: normalizeState(row.State),
		})
	}

	return result
}

func normalizeState(s string) string {
	switch strings.ToLower(s) {
	case "created", "running", "paused", "restarting", "removing", "exited", "dead":
		return strings.ToLower(s)
	default:
		return "unknown"
	}
}

func (c *Collector) Hostname() string {
	return c.hostname
}

func (c *Collector) CPUCount() int {
	return c.cpuCount
}

func fmtContainerList(containers []protocol.ContainerState) string {
	if len(containers) == 0 {
		return "none"
	}
	parts := make([]string, 0, len(containers))
	for _, ct := range containers {
		parts = append(parts, fmt.Sprintf("%s(%s)", ct.Name, ct.State))
	}
	return strings.Join(parts, ", ")
}
