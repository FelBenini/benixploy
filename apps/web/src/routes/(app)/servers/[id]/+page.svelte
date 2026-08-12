<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Empty from "$lib/components/ui/empty";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import ServerHeader from "./components/server-header.svelte";
  import MetricsChart from "./components/metrics-chart.svelte";
  import EventsTable from "./components/events-table.svelte";
  import type {
    EventItem,
    ServerInfo,
    StatsPoint,
  } from "./components/types.js";
  import Separator from "$lib/components/ui/separator/separator.svelte";

  let { data } = $props();
  const server: ServerInfo = $derived(data.server);

  const ranges = [
    { value: "5m", label: "5m" },
    { value: "1h", label: "1h" },
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
  ];

  let range = $state("24h");
  let loading = $state(true);
  let stats = $state<StatsPoint[]>([]);
  let events = $state<EventItem[]>([]);
  let error = $state<string | null>(null);
  let timer: ReturnType<typeof setInterval> | undefined;

  async function loadTelemetry() {
    try {
      const res = await fetch(
        `/api/servers/${server.id}/telemetry?range=${range}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to load telemetry");
      }
      const body = await res.json();
      const rawStats: Array<Record<string, unknown>> = body.data?.stats ?? [];

      stats = rawStats.map((s) => {
        const memTotal = (s.memoryTotal as number) || 1;
        const diskTotal = (s.diskTotal as number) || 1;
        return {
          receivedAt: s.receivedAt as string,
          cpuPercent: Number((s.cpuPercent as number) ?? 0),
          memoryPercent: Number(
            (((s.memoryUsed as number) / memTotal) * 100).toFixed(2),
          ),
          diskPercent: Number(
            (((s.diskUsed as number) / diskTotal) * 100).toFixed(2),
          ),
        };
      });
      events = (body.data?.events ?? []) as EventItem[];
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load telemetry";
    } finally {
      loading = false;
    }
  }

  function onRangeChange(next: string) {
    range = next;
    loading = true;
    void loadTelemetry();
  }

  onMount(() => {
    void loadTelemetry();
    timer = setInterval(() => {
      if (!document.hidden) void loadTelemetry();
    }, 30_000);
    return () => clearInterval(timer);
  });
</script>

<svelte:head>
  <title>{server.name} — Benisploy</title>
</svelte:head>

<div class="flex flex-col gap-6 p-3 md:p-6">
  <ServerHeader {server} />
  <Separator />
  <div class="flex items-center gap-2 text-lg">
    Interval:
    <ToggleGroup.Root
      value={range}
      onValueChange={(next) => {
        if (next) onRangeChange(next);
      }}
      type="single"
      variant="outline"
      size="sm"
    >
      {#each ranges as r (r.value)}
        <ToggleGroup.Item value={r.value}>{r.label}</ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>

    {#if loading}
      <Skeleton class="h-8 w-24" />
    {/if}
  </div>

  {#if error}
    <div
      class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {error}
    </div>
  {/if}

  {#if loading && stats.length === 0}
    <Card.Root class="bg-transparent ring-transparent">
      <Card.Header>
        <Skeleton class="h-4 w-32" />
      </Card.Header>
      <Card.Content>
        <Skeleton class="h-64 w-full" />
      </Card.Content>
    </Card.Root>
  {:else if stats.length === 0}
    <Card.Root>
      <Card.Header>
        <Card.Title>Resource usage</Card.Title>
        <Card.Description>
          CPU, memory and disk over the last {range}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Empty.Root>
          <Empty.Header>
            <Empty.Title>No telemetry yet</Empty.Title>
            <Empty.Description>
              The node monitor hasn't pushed any stats for this range. It
              reports every ~30 seconds.
            </Empty.Description>
          </Empty.Header>
        </Empty.Root>
      </Card.Content>
    </Card.Root>
  {:else}
    <MetricsChart {stats} {range} />
  {/if}

  <EventsTable {events} />
</div>
