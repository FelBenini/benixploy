<script lang="ts">
  import { getContext } from "svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { cn } from "$lib/utils.js";
  import type { WizardContext } from "./wizard.types.js";

  let {
    class: className,
    nextLabel = "Continue",
    loading = false,
    nextDisabled = false,
    onnext,
    hideBack = false,
  }: {
    class?: string;
    nextLabel?: string;
    loading?: boolean;
    nextDisabled?: boolean;
    onnext?: () => Promise<void> | void;
    hideBack?: boolean;
  } = $props();

  const ctx = getContext<WizardContext>("wizard");

  async function handleNext() {
    if (onnext) {
      await onnext();
    } else {
      ctx.next();
    }
  }
</script>

<div
  class={cn(
    "flex flex-row h-18 items-center justify-center gap-1 p-2 py-3 border-t border-border rounded-b bg-muted/30",
    className,
  )}
>
  {#if !hideBack}
    <Button
      type="button"
      variant="ghost"
      class="w-[49%] rounded-r-[2px] rounded-sm h-full border-border"
      disabled={ctx.isFirst}
      onclick={() => ctx.back()}
    >
      Back
    </Button>
  {/if}
  <Button
    class={cn(
      "h-full rounded-l-[2px] rounded-sm",
      hideBack ? "w-full rounded-sm" : "w-[49%]",
    )}
    type={onnext ? "button" : "submit"}
    disabled={nextDisabled || loading}
    onclick={handleNext}
  >
    {#if loading}
      <Spinner data-icon="inline-start" />
      {nextLabel}
    {:else}
      {nextLabel}
    {/if}
  </Button>
</div>
