<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { cn, type WithoutChildrenOrChild } from "$lib/utils";
  import AlertDialogOverlay from "./alert-dialog-overlay.svelte";
  import AlertDialogPortal from "./alert-dialog-portal.svelte";
  import type { ComponentProps, Snippet } from "svelte";

  let {
    ref = $bindable(null),
    class: className,
    size = "default",
    portalProps,
    interactOutsideBehavior = "close",
    children,
    ...restProps
  }: Omit<AlertDialogPrimitive.ContentProps, "child"> & {
    size?: "default" | "sm";
    portalProps?: WithoutChildrenOrChild<
      ComponentProps<typeof AlertDialogPortal>
    >;
    children?: Snippet;
  } = $props();
</script>

<AlertDialogPortal {...portalProps}>
  <AlertDialogOverlay />
  <AlertDialogPrimitive.Content
    bind:ref
    data-slot="alert-dialog-content"
    data-size={size}
    {interactOutsideBehavior}
    class={cn(
      "gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1 -translate-y-1 outline-none",
      className,
    )}
    {...restProps}
  >
    {@render children?.()}
  </AlertDialogPrimitive.Content>
</AlertDialogPortal>
