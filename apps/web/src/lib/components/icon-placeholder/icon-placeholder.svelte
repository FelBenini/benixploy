<script lang="ts">
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import X from "@lucide/svelte/icons/x";

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
  };

  let { lucide = "", ...rest }: Props = $props();

  const Icon = $derived(iconMap[lucide]);
</script>

{#if Icon}
  <Icon {...rest} />
{/if}
