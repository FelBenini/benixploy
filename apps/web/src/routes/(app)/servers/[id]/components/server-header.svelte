<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import type { ServerInfo } from "./types.js";

  let { server }: { server: ServerInfo } = $props();

  function formatBytes(bytes: number): string {
    if (!bytes) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(1)} ${units[i]}`;
  }

  function statusPillClass(status: string): string {
    switch (status) {
      case "online":
        return "bg-green-950/50 border-green-800 text-green-400";
      case "degraded":
        return "bg-amber-950/50 border-amber-800 text-amber-400";
      case "provisioning":
        return "bg-blue-950/50 border-blue-800 text-blue-400";
      default:
        return "bg-muted/50 border-border text-muted-foreground";
    }
  }
</script>

<div class="flex flex-wrap items-start justify-between gap-4">
  <div class="w-full md:w-fit">
    <h1
      class="text-foreground flex items-center md:gap-4 text-2xl font-semibold md:justify-start justify-between w-full md:w-fit"
    >
      {server.name}
      <Badge class={statusPillClass(server.status)}>{server.status}</Badge>
    </h1>
    <p class="text-muted-foreground text-sm">
      {server.sshUser}@{server.address}:{server.sshPort}
    </p>
    {#if server.cpuCores}
      <p class="text-muted-foreground mt-1 text-xs">
        {server.cpuCores} vCPU &middot; {formatBytes(server.memoryBytes)} RAM &middot;
        {formatBytes(server.diskBytes)} disk
      </p>
    {/if}
  </div>
  <div class="flex flex-col items-end gap-1.5">
    <span class="text-muted-foreground text-xs">
      {server.lastHeartbeatAt
        ? `Last heartbeat ${new Date(server.lastHeartbeatAt).toLocaleString()}`
        : "No heartbeat yet"}
    </span>
  </div>
</div>
