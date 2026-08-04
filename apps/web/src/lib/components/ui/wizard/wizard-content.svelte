<script lang="ts">
  import { getContext } from "svelte";
  import { fly } from "svelte/transition";
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { WizardContext } from "./wizard.types.js";

  let {
    class: className,
    children,
  }: {
    class?: string;
    children: Snippet;
  } = $props();

  const ctx = getContext<WizardContext>("wizard");
</script>

<div class={cn("grid overflow-hidden h-[260px]", className)}>
  {#key ctx.step}
    <div
      class="[grid-area:1/1] px-6 py-4"
      in:fly={{ x: 40, duration: 250 }}
      out:fly={{ x: -40, duration: 250 }}
    >
      {@render children()}
    </div>
  {/key}
</div>
