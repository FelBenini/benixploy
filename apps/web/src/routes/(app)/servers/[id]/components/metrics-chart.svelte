<script lang="ts">
  import { scaleTime } from "d3-scale";
  import { curveNatural } from "d3-shape";
  import { LineChart } from "layerchart";
  import * as Chart from "$lib/components/ui/chart/index.js";
  import type { StatsPoint } from "./types.js";

  let { stats, range }: { stats: StatsPoint[]; range: string } = $props();

  const chartConfig = {
    cpu: { label: "CPU", color: "var(--chart-1)" },
    memory: { label: "Memory", color: "var(--chart-2)" },
    disk: { label: "Disk", color: "var(--chart-3)" },
  } satisfies Chart.ChartConfig;

  const timeFormat = (d: Date | number | string) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const timeTickFormat = (d: Date | number | string) => {
    const date = d instanceof Date ? d : new Date(d);
    if (range === "7d") {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    return timeFormat(d);
  };

  const percentFormat = (d: number | string) => `${Number(d).toFixed(0)}%`;
</script>

<div>
  <h1 class="text-lg">Resource usage</h1>
  <p class="text-xs text-muted-foreground">
    CPU, memory and disk over the last {range} — {stats.length} samples
  </p>
</div>
<div class="px-2">
  <Chart.Container config={chartConfig} class="h-64 w-full">
    <LineChart
      data={stats}
      x={(d: StatsPoint) => new Date(d.receivedAt)}
      xScale={scaleTime()}
      yDomain={[0, 100]}
      axis
      legend
      props={{
        xAxis: { format: timeTickFormat },
        yAxis: { format: percentFormat },
        spline: { curve: curveNatural, motion: "tween", strokeWidth: 2 },
      }}
      series={[
        {
          key: "cpu",
          label: "CPU",
          value: "cpuPercent",
          color: "var(--chart-1)",
        },
        {
          key: "memory",
          label: "Memory",
          value: "memoryPercent",
          color: "var(--chart-2)",
        },
        {
          key: "disk",
          label: "Disk",
          value: "diskPercent",
          color: "var(--chart-3)",
        },
      ]}
    >
      {#snippet tooltip()}
        <Chart.Tooltip labelFormatter={timeFormat} />
      {/snippet}
    </LineChart>
  </Chart.Container>
</div>
