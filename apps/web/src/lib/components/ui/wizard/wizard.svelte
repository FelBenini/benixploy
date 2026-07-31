<script lang="ts">
  import { setContext } from "svelte";
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { WizardStep } from "./wizard.types.js";

  type Props = {
    steps: WizardStep[];
    step?: number;
    class?: string;
    children: Snippet;
  };

  let {
    steps,
    step = $bindable(0),
    class: className,
    children,
  }: Props = $props();

  let stepCount = $derived(steps.length);
  let currentStep = $derived(steps[step] ?? steps[0]);

  $effect(() => {
    if (step < 0) step = 0;
    if (steps.length && step >= steps.length) step = steps.length - 1;
  });

  function next() {
    if (step < steps.length - 1) step = step + 1;
  }

  function back() {
    if (step > 0) step = step - 1;
  }

  function goTo(index: number) {
    if (index >= 0 && index < steps.length) step = index;
  }

  setContext("wizard", {
    get step() {
      return step;
    },
    get currentStep() {
      return currentStep;
    },
    get stepCount() {
      return stepCount;
    },
    get isFirst() {
      return step === 0;
    },
    get isLast() {
      return step === stepCount - 1;
    },
    get steps() {
      return steps;
    },
    next,
    back,
    goTo,
  });
</script>

<div
  class={cn(
    "rounded-xl bg-background/10 backdrop-blur-sm ring-1 ring-foreground/10 shadow-lg bg-[radial-gradient(circle_at_top_left,_#EF0A8610_0%,_transparent_50%),radial-gradient(circle_at_bottom_right,_#f0fdfa10_0%,_transparent_50%)]",
    className,
  )}
>
  {@render children()}
</div>
