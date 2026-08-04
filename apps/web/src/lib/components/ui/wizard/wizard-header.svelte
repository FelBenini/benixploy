<script lang="ts">
  import { getContext } from "svelte";
  import type { WizardContext } from "./wizard.types.js";
  import type { Snippet } from "svelte";

  let {
    children,
    badge,
  }: {
    children?: Snippet;
    badge?: Snippet;
  } = $props();

  const ctx = getContext<WizardContext>("wizard");
</script>

<div class="flex flex-col items-center gap-4 p-6 pb-0">
  {#if badge}
    {@render badge()}
  {:else if ctx.currentStep.icon}
    <div
      class="rounded-md bg-gradient-to-br from-white/30 via-accent to-border p-px shadow-md"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-[calc(theme(borderRadius.md)-1px)] bg-gradient-to-br from-accent to-background"
      >
        <ctx.currentStep.icon class="text-foreground/80" />
      </div>
    </div>
  {/if}
  <h2 class="text-foreground text-xl font-semibold">{ctx.currentStep.title}</h2>
  {#if ctx.currentStep.description}
    <p class="text-muted-foreground h-12 text-sm text-center">
      {ctx.currentStep.description}
    </p>
  {/if}
  {@render children?.()}
</div>
