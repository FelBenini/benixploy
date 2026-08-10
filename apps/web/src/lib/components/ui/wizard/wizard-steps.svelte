<script lang="ts">
  import { getContext } from "svelte";
  import type { WizardContext } from "./wizard.types.js";
  import Check from "@lucide/svelte/icons/check";
  import { cn } from "$lib/utils.js";

  let { class: className }: { class?: string } = $props();

  const ctx = getContext<WizardContext>("wizard");
  const progress = $derived.by(() => {
    if (ctx.steps.length <= 1) return 0;
    return (ctx.step / (ctx.steps.length - 1)) * 100;
  });
</script>

<nav aria-label="Progress" class={cn("px-6 py-4", className)}>
  <div class="relative">
    <!-- Background connector -->
    <div
      class="pointer-events-none absolute top-3 left-3 right-3 h-px bg-border"
      aria-hidden="true"
    ></div>

    <!-- Animated progress -->
    <div
      class="pointer-events-none absolute top-3 left-4 h-px bg-primary transition-[width] duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
      aria-hidden="true"
      style={`width: calc((100% - 1.5rem) * ${progress / 100})`}
    ></div>

    <ol role="list" class="relative flex items-start justify-between">
      {#each ctx.steps as _step, i (i)}
        {@const active = i === ctx.step}
        {@const completed = i < ctx.step}

        <li class="flex flex-col items-center gap-0.5">
          {#if completed}
            <button
              type="button"
              onclick={() => ctx.goTo(i)}
              class="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs"
            >
              <Check class="size-3.5" />
            </button>
          {:else if active}
            <div
              class="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium ring-2 ring-primary/20"
            >
              {i + 1}
            </div>
          {:else}
            <div
              class="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground text-xs"
            >
              {i + 1}
            </div>
          {/if}

          <span
            class={cn(
              "mt-0.5 text-center text-xs font-medium",
              active
                ? "text-foreground"
                : completed
                  ? "text-foreground/70"
                  : "text-muted-foreground",
            )}
          >
            {_step.title}
          </span>
        </li>
      {/each}
    </ol>
  </div>
</nav>
