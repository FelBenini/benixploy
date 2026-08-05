<script lang="ts">
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils.js";
  import Server from "@lucide/svelte/icons/server";
  import Plus from "@lucide/svelte/icons/plus";
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  let { data } = $props();

  function initialServers() {
    return data.servers;
  }

  let servers = $state(initialServers());
  let loading = $state(false);

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

  async function refresh() {
    loading = true;
    try {
      const res = await fetch("/api/servers");
      if (res.ok) {
        const body = await res.json();
        servers = body.data ?? [];
      }
    } catch {
      // ignore
    } finally {
      loading = false;
    }
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

<svelte:head>
  <title>Servers — Benisploy</title>
</svelte:head>

<div class="flex flex-col md:p-6 p-3 gap-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-foreground text-lg font-semibold">Servers</h1>
      <p class="text-muted-foreground text-sm">
        The machines your applications run on.
      </p>
    </div>
    <div class="flex gap-2">
      <Button variant="ghost" onclick={refresh} disabled={loading}>
        <RefreshCw
          class={cn("size-4", loading && "animate-spin")}
          data-icon="inline-start"
        />
        Refresh
      </Button>
      <Button href={resolve("/servers/new")}>
        <Plus data-icon="inline-start" />
        Add server
      </Button>
    </div>
  </div>

  {#if servers.length === 0}
    <div
      class="flex flex-col items-center justify-center gap-3 rounded-xl bg-background/10 backdrop-blur-sm ring-1 ring-foreground/10 px-6 py-16 text-center"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-md bg-muted/50 text-muted-foreground"
      >
        <Server class="size-6" />
      </div>
      <div>
        <h2 class="text-foreground text-sm font-semibold">No servers yet</h2>
        <p class="text-muted-foreground mt-1 text-sm max-w-sm">
          Connect your first VPS or bare-metal machine and Benisploy will
          install everything it needs automatically.
        </p>
      </div>
      <Button href={resolve("/servers/new")} class="mt-2">
        <Plus data-icon="inline-start" />
        Add your first server
      </Button>
    </div>
  {:else}
    <div
      class="rounded-xl bg-background/10 backdrop-blur-sm ring-1 ring-foreground/10 overflow-hidden"
    >
      <table class="w-full text-sm">
        <thead>
          <tr
            class="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"
          >
            <th class="px-4 py-3 font-medium">Server</th>
            <th class="px-4 py-3 font-medium">Address</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Resources</th>
            <th class="px-4 py-3 font-medium">Last heartbeat</th>
            <th class="px-4 py-3 font-medium"
              ><span class="sr-only">Actions</span></th
            >
          </tr>
        </thead>
        <tbody>
          {#each servers as server (server.id)}
            <tr
              class="border-b border-border/50 last:border-0 hover:bg-muted/30"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground"
                  >
                    <Server class="size-4" />
                  </div>
                  <div>
                    <div class="text-foreground font-medium">{server.name}</div>
                    <div class="text-muted-foreground text-xs">
                      {server.sshUser}@…
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-muted-foreground">
                {server.address}:{server.sshPort}
              </td>
              <td class="px-4 py-3">
                <span
                  class={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    statusPillClass(server.status),
                  )}
                >
                  {server.status}
                </span>
              </td>
              <td class="px-4 py-3 text-muted-foreground">
                {#if server.cpuCores}
                  {server.cpuCores} vCPU · {formatBytes(server.memoryBytes)} RAM ·
                  {formatBytes(server.diskBytes)} disk
                {:else}
                  —
                {/if}
              </td>
              <td class="px-4 py-3 text-muted-foreground">
                {server.lastHeartbeatAt
                  ? new Date(server.lastHeartbeatAt).toLocaleString()
                  : "never"}
              </td>
              <td class="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Server actions"
                >
                  <MoreHorizontal />
                </Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
