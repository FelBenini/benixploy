<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Card from "$lib/components/ui/card";
  import Rocket from "@lucide/svelte/icons/rocket";
  import GitBranch from "@lucide/svelte/icons/git-branch";

  let { data } = $props();
  const apps = $derived(data.apps);

  let shaByApp = $state<Record<string, string>>({});
  let busyApp = $state<string | null>(null);
  let resultByApp = $state<
    Record<string, { ok: boolean; message: string }>
  >({});

  async function trigger(appId: string) {
    busyApp = appId;
    const { [appId]: _cleared, ...rest } = resultByApp;
    resultByApp = rest;

    try {
      const res = await fetch(`/api/apps/${appId}/trigger-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha: shaByApp[appId]?.trim() || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Trigger failed");
      }
      resultByApp = {
        ...resultByApp,
        [appId]: {
          ok: true,
          message: `Queued ${body.data.sha} — push event ${body.data.pushEventId.slice(0, 8)}`,
        },
      };
      await invalidateAll();
    } catch (err) {
      resultByApp = {
        ...resultByApp,
        [appId]: {
          ok: false,
          message: err instanceof Error ? err.message : "Trigger failed",
        },
      };
    } finally {
      busyApp = null;
    }
  }

  function appPillClass(status: string): string {
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

  function eventPillClass(status: string): string {
    switch (status) {
      case "success":
        return "bg-green-950/50 border-green-800 text-green-400";
      case "queued":
      case "deploying":
        return "bg-blue-950/50 border-blue-800 text-blue-400";
      case "failed":
        return "bg-red-950/50 border-red-800 text-red-400";
      default:
        return "bg-muted/50 border-border text-muted-foreground";
    }
  }
</script>

<svelte:head>
  <title>Test Push Deploys — Benisploy</title>
</svelte:head>

<div class="flex flex-col gap-6 p-3 md:p-6">
  <div>
    <h1 class="text-foreground text-lg font-semibold">Test Push Deploys</h1>
    <p class="text-muted-foreground text-sm">
      Trigger the push-deploy orchestrator manually — same path a webhook
      push takes, without needing a real git push.
    </p>
  </div>

  {#if apps.length === 0}
    <div
      class="flex flex-col items-center justify-center gap-3 rounded-xl bg-background/10 px-6 py-16 text-center ring-1 ring-foreground/10 backdrop-blur-sm"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-md bg-muted/50 text-muted-foreground"
      >
        <GitBranch class="size-6" />
      </div>
      <div>
        <h2 class="text-foreground text-sm font-semibold">
          No deployable git apps
        </h2>
        <p class="text-muted-foreground mt-1 max-w-sm text-sm">
          Push deploys need a stateless app with a git connection. Create one
          via the deploy form with a git build context.
        </p>
      </div>
    </div>
  {:else}
    <div class="grid gap-4">
      {#each apps as item (item.id)}
        <Card.Root>
          <Card.Header>
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Card.Title class="flex items-center gap-2">
                  {item.name}
                  <Badge class={appPillClass(item.status)}>
                    {item.status}
                  </Badge>
                </Card.Title>
                <Card.Description>
                  {item.repoSlug}#{item.branch} &middot; {item.serverName ??
                    "no server"}
                </Card.Description>
              </div>
              <div class="flex items-center gap-2">
                {#if item.activeColor}
                  <Badge variant="outline">active: {item.activeColor}</Badge>
                {/if}
                {#if item.warmColor}
                  <Badge variant="outline">warm: {item.warmColor}</Badge>
                {/if}
              </div>
            </div>
          </Card.Header>
          <Card.Content class="flex flex-col gap-3 text-sm">
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span class="text-muted-foreground">Deployed:</span>
              <span class="text-foreground font-mono">
                {item.shaDeployed ? item.shaDeployed.slice(0, 7) : "—"}
              </span>
              {#if item.lastEvent}
                <span class="text-muted-foreground"
                  >&middot; last event:</span
                >
                <Badge class={eventPillClass(item.lastEvent.status)}>
                  {item.lastEvent.status}
                </Badge>
                <span class="text-muted-foreground font-mono">
                  {item.lastEvent.sha.slice(0, 7)}
                </span>
                <span class="text-muted-foreground">
                  {new Date(item.lastEvent.receivedAt).toLocaleTimeString()}
                </span>
              {:else}
                <span class="text-muted-foreground"
                  >&middot; no push events yet</span
                >
              {/if}
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <Input
                class="max-w-xs"
                placeholder="commit SHA (defaults to a test SHA)"
                bind:value={shaByApp[item.id]}
              />
              <Button
                size="sm"
                disabled={busyApp === item.id}
                onclick={() => trigger(item.id)}
              >
                <Rocket data-icon="inline-start" />
                {busyApp === item.id ? "Triggering…" : "Trigger push deploy"}
              </Button>
            </div>

            {#if resultByApp[item.id]}
              <p
                class={resultByApp[item.id].ok
                  ? "text-emerald-400 text-xs"
                  : "text-destructive text-xs"}
              >
                {resultByApp[item.id].message}
              </p>
            {/if}
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {/if}
</div>