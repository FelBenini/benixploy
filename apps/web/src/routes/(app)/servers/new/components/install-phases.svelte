<script lang="ts">
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Button } from "$lib/components/ui/button";
  import Check from "@lucide/svelte/icons/check";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";

  let {
    phases,
    installState,
    activePhase,
    completedPhases,
    error,
    onRetry,
  }: {
    phases: string[];
    installState: "idle" | "running" | "done" | "error";
    activePhase: number;
    completedPhases: number;
    error: string;
    onRetry: () => void;
  } = $props();
</script>

<div class="flex flex-col gap-2 py-2">
  {#each phases as phase, i (phase)}
    <div class="flex items-center gap-2.5 text-sm">
      {#if i < completedPhases}
        <span
          class="flex size-4 items-center justify-center rounded-full bg-green-950/50 text-green-400"
        >
          <Check class="size-3" />
        </span>
        <span class="text-muted-foreground">{phase}</span>
      {:else if i === activePhase}
        <Spinner class="size-4 text-primary" />
        <span class="text-foreground font-medium">{phase}</span>
      {:else}
        <span class="size-4 rounded-full border border-border"></span>
        <span class="text-muted-foreground/60">{phase}</span>
      {/if}
    </div>
  {/each}
</div>

{#if installState === "running"}
  <p class="text-muted-foreground mt-4 text-xs">
    This can take a minute or two. Keep this tab open.
  </p>
{/if}

{#if error}
  <div
    class="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
  >
    <AlertCircle class="mt-0.5 size-4 shrink-0" />
    <span class="flex-1">{error}</span>
  </div>
  <Button type="button" variant="outline" class="mt-3" onclick={onRetry}>
    Try again
  </Button>
{/if}