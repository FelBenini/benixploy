<script lang="ts">
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import X from "@lucide/svelte/icons/x";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Check from "@lucide/svelte/icons/check";
  import Minus from "@lucide/svelte/icons/minus";

  type Props = {
    lucide?: string;
    tabler?: string;
    hugeicons?: string;
    phosphor?: string;
    remixicon?: string;
    [key: string]: unknown;
  };

  const iconMap: Record<string, typeof PanelLeft> = {
    PanelLeftIcon: PanelLeft,
    XIcon: X,
    ChevronRightIcon: ChevronRight,
    CheckIcon: Check,
    MinusIcon: Minus,
  };

  let { lucide = "", ...rest }: Props = $props();

  const Icon = $derived(iconMap[lucide]);
</script>

{#if Icon}
  <Icon {...rest} />
{/if}
