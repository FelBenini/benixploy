<script lang="ts">
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Button } from "$lib/components/ui/button";
  import Check from "@lucide/svelte/icons/check";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";

  interface KnownErrorItem {
    diagnostic: string;
    solutions: string[];
  }

  let {
    phases,
    installState,
    activePhase,
    completedPhases,
    error,
    knownErrors = [],
    onRetry,
  }: {
    phases: string[];
    installState: "idle" | "running" | "done" | "error";
    activePhase: number;
    completedPhases: number;
    error: string;
    knownErrors?: KnownErrorItem[];
    onRetry: () => void;
  } = $props();

  function renderSegments(
    text: string,
  ): Array<{ type: "text" | "code"; value: string }> {
    const parts: Array<{ type: "text" | "code"; value: string }> = [];
    const regex = /`([^`]+)`/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      parts.push({ type: "code", value: match[1] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push({ type: "text", value: text.slice(lastIndex) });
    }
    return parts;
  }
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

  {#if knownErrors.length > 0}
    <div class="mt-3 flex flex-col gap-3">
      {#each knownErrors as entry, i (i)}
        <div class="rounded-lg border border-border bg-muted/20 p-3">
          <p class="flex items-start gap-2 text-sm">
            <Lightbulb class="mt-0.5 size-3.5 shrink-0 text-amber-400" />
            <span class="text-foreground/90">{entry.diagnostic}</span>
          </p>
          <ol class="mt-2.5 ml-5 list-decimal space-y-1.5">
            {#each entry.solutions as solution, j (j)}
              <li class="text-xs text-muted-foreground leading-relaxed">
                {#each renderSegments(solution) as seg, k (k)}
                  {#if seg.type === "code"}
                    <code
                      class="select-all rounded bg-muted px-1 py-px font-mono text-[11px] text-foreground/80">{
                      seg.value
                    }</code>
                  {:else}
                    {seg.value}
                  {/if}
                {/each}
              </li>
            {/each}
          </ol>
        </div>
      {/each}
    </div>
  {/if}

  <Button type="button" variant="outline" class="mt-3" onclick={onRetry}>
    Try again
  </Button>
{/if}
