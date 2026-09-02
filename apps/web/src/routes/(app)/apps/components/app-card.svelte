<script lang="ts">
  import { resolve } from "$app/paths";
  import { cn } from "$lib/utils.js";
  import Boxes from "@lucide/svelte/icons/boxes";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Server from "@lucide/svelte/icons/server";
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import { Button } from "$lib/components/ui/button";

  interface AppCardData {
    id: string;
    name: string;
    status: string;
    activeColor: string | null;
    serverName: string | null;
    gitSource: {
      provider: string;
      repoSlug: string;
      branch: string;
      shaDeployed: string | null;
      activeColor: string | null;
    } | null;
  }

  let { item }: { item: AppCardData } = $props();

  function statusPillClass(status: string): string {
    switch (status) {
      case "healthy":
        return "bg-green-950/50 border-green-800 text-green-400";
      case "deploying":
        return "bg-blue-950/50 border-blue-800 text-blue-400";
      case "degraded":
        return "bg-amber-950/50 border-amber-800 text-amber-400";
      default:
        return "bg-muted/50 border-border text-muted-foreground";
    }
  }

  function statusDotClass(status: string): string {
    switch (status) {
      case "healthy":
        return "bg-green-400";
      case "deploying":
        return "bg-blue-400";
      case "degraded":
        return "bg-amber-400";
      default:
        return "bg-muted-foreground/40";
    }
  }

  function colorPillClass(color: string): string {
    return color === "blue"
      ? "bg-blue-950/50 border-blue-800 text-blue-400"
      : "bg-emerald-950/50 border-emerald-800 text-emerald-400";
  }
</script>

<a
  href={resolve(`/apps/${item.id}`)}
  class="group flex flex-col gap-4 rounded bg-card/80 backdrop-blur-sm ring-1 ring-foreground/10 p-4 transition-colors hover:bg-card"
>
  <div class="flex items-start justify-between gap-2">
    <div class="flex items-center gap-2.5 min-w-0">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground"
      >
        <Boxes class="size-4.5" />
      </div>
      <div class="min-w-0">
        <h3 class="truncate">{item.name}</h3>
        <span
          class={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11px] font-medium mt-1",
            statusPillClass(item.status),
          )}
        >
          <span
            class={cn("size-1.5 rounded-full", statusDotClass(item.status))}
          ></span>
          {item.status}
        </span>
      </div>
    </div>
    <Button variant="ghost" size="icon-sm" aria-label="App actions">
      <MoreHorizontal class="size-4" />
    </Button>
  </div>

  <div class="flex flex-col gap-1.5 text-xs text-muted-foreground">
    <div class="flex items-center gap-1.5">
      <Server class="size-3 shrink-0" />
      <span class="truncate">{item.serverName ?? "—"}</span>
    </div>
    <div class="flex items-center gap-1.5">
      <GitBranch class="size-3 shrink-0" />
      {#if item.gitSource}
        <span class="truncate"
          >{item.gitSource.repoSlug}#{item.gitSource.branch}</span
        >
      {:else}
        <span class="truncate">Template</span>
      {/if}
    </div>
  </div>

  {#if item.activeColor}
    <div class="-mx-4 border-t border-border/50"></div>
    <div class="flex items-center gap-1.5 text-xs">
      <span
        class={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11px] font-medium",
          colorPillClass(item.activeColor),
        )}
      >
        <span class="size-1.5 rounded-full bg-current"></span>
        {item.activeColor}
      </span>
    </div>
  {/if}
</a>
