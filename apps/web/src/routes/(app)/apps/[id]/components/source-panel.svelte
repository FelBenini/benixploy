<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import * as Card from "$lib/components/ui/card";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import GitCommit from "@lucide/svelte/icons/git-commit";
  import Clock from "@lucide/svelte/icons/clock";
  import Layers from "@lucide/svelte/icons/layers";

  interface GitSourceInfo {
    provider: string;
    repoSlug: string;
    cloneUrl: string;
    branch: string;
    shaDeployed: string | null;
    commitUrl: string | null;
    activeColor: string | null;
    warmColor: string | null;
    warmExpiresAt: string | null;
    lastPushAt: string | null;
  }

  let { source }: { source: GitSourceInfo | null } = $props();

  let now = $state(Date.now());

  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });

  function shortSha(sha: string | null): string {
    return sha ? sha.slice(0, 7) : "—";
  }

  function colorPillClass(color: string): string {
    return color === "blue"
      ? "bg-blue-950/50 border-blue-800 text-blue-400"
      : "bg-emerald-950/50 border-emerald-800 text-emerald-400";
  }

  function warmRemaining(expiresAt: string | null): string | null {
    if (!expiresAt) return null;
    const ms = new Date(expiresAt).getTime() - now;
    if (ms <= 0) return null;
    const totalMin = Math.floor(ms / 60000);
    if (totalMin >= 60) {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return `${h}h ${m}m`;
    }
    return `${totalMin}m`;
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Source</Card.Title>
    <Card.Description>
      The git repository and blue/green state this app is deployed from.
    </Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-col gap-4">
    {#if source}
      <div class="flex flex-col gap-2 text-sm">
        <div class="flex items-center gap-2">
          <GitBranch class="size-4 shrink-0 text-muted-foreground" />
          <span class="text-foreground font-medium">
            {source.repoSlug}#{source.branch}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <GitCommit class="size-4 shrink-0 text-muted-foreground" />
          {#if source.commitUrl}
            <a
              href={source.commitUrl}
              target="_blank"
              rel="external noopener noreferrer"
              class="text-blue-400 hover:underline"
            >
              {shortSha(source.shaDeployed)}
            </a>
          {:else}
            <span class="text-muted-foreground">
              {shortSha(source.shaDeployed)}
            </span>
          {/if}
        </div>
      </div>

      <div class="-mx-6 border-t border-border/50"></div>

      <div class="flex flex-wrap items-center gap-2">
        {#if source.activeColor}
          <Badge class={colorPillClass(source.activeColor)}>
            active: {source.activeColor}
          </Badge>
        {/if}
        {#if source.warmColor}
          <Badge class={colorPillClass(source.warmColor)}>
            warm: {source.warmColor}
            {#if warmRemaining(source.warmExpiresAt)}
              &middot; {warmRemaining(source.warmExpiresAt)} left
            {/if}
          </Badge>
        {/if}
      </div>

      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock class="size-3 shrink-0" />
        <span>
          {source.lastPushAt
            ? `Last push ${new Date(source.lastPushAt).toLocaleString()}`
            : "No push recorded"}
        </span>
      </div>
    {:else}
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <Layers class="size-4 shrink-0" />
        <span>This app is a catalog template — no git source attached.</span>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
