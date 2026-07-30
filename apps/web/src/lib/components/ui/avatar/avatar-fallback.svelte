<script lang="ts">
  import { Avatar as AvatarPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  const PALETTE = [
    ["#432371", "#FAAE7B"],
    ["#F66B40", "#AF0D5B"],
    ["#FD63F5", "#FF3A3A"],
    ["#2BD8EF", "#D7E62E"],
    ["#44caff", "#df32c6"],
    ["#be123c", "#e11d48"],
  ];

  function gradientFromName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const [from, to] = PALETTE[Math.abs(hash) % PALETTE.length];
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  let {
    ref = $bindable(null),
    class: className,
    name,
    style,
    ...restProps
  }: AvatarPrimitive.FallbackProps & {
    name?: string;
  } = $props();

  const gradientStyle = $derived(name ? gradientFromName(name) : undefined);
</script>

<AvatarPrimitive.Fallback
  bind:ref
  data-slot="avatar-fallback"
  class={cn(
    "rounded-full flex size-full items-center justify-center text-sm group-data-[size=sm]/avatar:text-xs",
    name ? "text-white" : "bg-muted text-muted-foreground",
    className,
  )}
  style={gradientStyle ? `background: ${gradientStyle}; ${style ?? ""}` : style}
  {...restProps}
/>
