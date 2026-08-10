<script lang="ts">
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils.js";
  import Server from "@lucide/svelte/icons/server";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ServerCard from "./components/server-card.svelte";

  let { data } = $props();

  function initialServers() {
    return data.servers;
  }

  let servers = $state(initialServers());
  let loading = $state(false);

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
</script>

<svelte:head>
  <title>Servers — Benisploy</title>
</svelte:head>

<div class="flex flex-col md:p-6 p-3 gap-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-foreground text-lg font-semibold">Servers</h1>
      <p class="text-muted-foreground hidden md:block text-sm">
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
  <p class="text-muted-foreground md:hidden text-sm">The machines your application run on.</p>
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
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each servers as server (server.id)}
        <ServerCard {server} />
      {/each}
    </div>
  {/if}
</div>
