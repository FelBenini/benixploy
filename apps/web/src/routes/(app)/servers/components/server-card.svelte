<script lang="ts">
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils.js";
  import Server from "@lucide/svelte/icons/server";
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import Cpu from "@lucide/svelte/icons/cpu";
  import Clock from "@lucide/svelte/icons/clock";
  import User from "@lucide/svelte/icons/user";
  import Play from "@lucide/svelte/icons/play";

  interface ServerCardData {
    id: string;
    name: string;
    address: string;
    sshPort: number;
    sshUser: string;
    status: string;
    cpuCores: number;
    memoryBytes: number;
    diskBytes: number;
    lastHeartbeatAt: string | null | undefined;
  }

  let { server }: { server: ServerCardData } = $props();

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

  function statusDotClass(status: string): string {
    switch (status) {
      case "online":
        return "bg-green-400";
      case "degraded":
        return "bg-amber-400";
      case "provisioning":
        return "bg-blue-400";
      default:
        return "bg-muted-foreground/40";
    }
  }
</script>

<div
  class="group flex flex-col gap-4 rounded bg-card/80 backdrop-blur-sm ring-1 ring-foreground/10 p-4 transition-colors hover:bg-card"
>
  <div class="flex items-start justify-between gap-2">
    <div class="flex items-center gap-2.5 min-w-0">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground"
      >
        <Server class="size-4.5" />
      </div>
      <div class="min-w-0">
        <h3 class="text-foreground text-sm font-semibold truncate">
          {server.name}
        </h3>
        <span
          class={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11px] font-medium mt-1",
            statusPillClass(server.status),
          )}
        >
          <span
            class={cn("size-1.5 rounded-full", statusDotClass(server.status))}
          ></span>
          {server.status}
        </span>
      </div>
    </div>
    <Button variant="ghost" size="icon-sm" aria-label="Server actions">
      <MoreHorizontal class="size-4" />
    </Button>
  </div>

  <div class="flex flex-col gap-1.5 text-xs text-muted-foreground">
    <div class="flex items-center gap-1.5">
      <User class="size-3 shrink-0" />
      <span class="truncate"
        >{server.sshUser}@{server.address}{server.sshPort !== 22
          ? `:${server.sshPort}`
          : ""}</span
      >
    </div>
    {#if server.address !== "localhost"}
      <div class="flex items-center gap-1.5">
        <MapPin class="size-3 shrink-0" />
        <span class="truncate">{server.address}:{server.sshPort}</span>
      </div>
    {/if}
  </div>

  {#if server.status === "provisioning"}
    <div class="-mx-4 border-t border-border/50"></div>
    <Button
      variant="ghost"
      size="sm"
      href={resolve(`/servers/new?server=${server.id}`)}
      class="justify-start text-blue-400 hover:text-blue-300 p-6 hover:bg-blue-950/30"
    >
      <Play class="size-3" data-icon="inline-start" />
      Continue setup
    </Button>
  {:else if server.cpuCores}
    <div class="-mx-4 border-t border-border/50"></div>
    <div class="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <div class="flex items-center gap-1.5">
        <Cpu class="size-3 shrink-0" />
        <span>
          {server.cpuCores} vCPU &middot; {formatBytes(server.memoryBytes)} RAM &middot;
          {formatBytes(server.diskBytes)} disk
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <Clock class="size-3 shrink-0" />
        <span>
          {server.lastHeartbeatAt
            ? new Date(server.lastHeartbeatAt).toLocaleString()
            : "No heartbeat yet"}
        </span>
      </div>
    </div>
  {/if}
</div>
