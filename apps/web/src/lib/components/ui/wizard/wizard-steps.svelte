<script lang="ts">
  import { getContext } from "svelte";
  import type { WizardContext } from "./wizard.types.js";
  import Check from "@lucide/svelte/icons/check";
  import { cn } from "$lib/utils.js";

  let { class: className }: { class?: string } = $props();

  const ctx = getContext<WizardContext>("wizard");
</script>

<nav aria-label="Progress" class={cn("px-6 py-4", className)}>
  <ol role="list" class="flex items-center justify-between">
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
            class="flex size-6 items-center justify-center rounded-full border border-border text-muted-foreground text-xs"
          >
            {i + 1}
          </div>
        {/if}
        <span
          class={cn(
            "text-xs font-medium mt-0.5",
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
</nav>
