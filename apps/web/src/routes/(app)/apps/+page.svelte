<script lang="ts">
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";
  import Boxes from "@lucide/svelte/icons/boxes";
  import Plus from "@lucide/svelte/icons/plus";
  import AppCard from "./components/app-card.svelte";

  let { data } = $props();

  function initialApps() {
    return data.apps;
  }

  let apps = $state(initialApps());
</script>

<svelte:head>
  <title>Apps — Benisploy</title>
</svelte:head>

<div class="flex flex-col md:p-6 p-3 gap-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-foreground text-lg font-semibold">Apps</h1>
      <p class="text-muted-foreground hidden md:block text-sm">
        The applications deployed across your servers.
      </p>
    </div>
    <div class="flex gap-2">
      <Button href={resolve("/")}>
        <Plus data-icon="inline-start" />
        Deploy app
      </Button>
    </div>
  </div>

  {#if apps.length === 0}
    <div
      class="flex flex-col items-center justify-center gap-3 rounded-sm bg-background/10 backdrop-blur-sm ring-1 ring-foreground/10 px-6 py-16 text-center"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-tl from-muted/10 to-accent/80 text-muted-foreground border border-border"
      >
        <Boxes class="size-6" />
      </div>
      <div>
        <h2 class="text-foreground text-sm font-semibold">No apps yet</h2>
        <p class="text-muted-foreground mt-1 text-sm max-w-sm">
          Deploy your first application to a connected server.
        </p>
      </div>
      <Button href={resolve("/")} class="mt-2">
        <Plus data-icon="inline-start" />
        Deploy your first app
      </Button>
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each apps as item (item.id)}
        <AppCard {item} />
      {/each}
    </div>
  {/if}
</div>
