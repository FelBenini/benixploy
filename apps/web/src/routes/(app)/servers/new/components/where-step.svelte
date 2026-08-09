<script lang="ts">
  import Globe from "@lucide/svelte/icons/globe";
  import HardDrive from "@lucide/svelte/icons/hard-drive";

  let {
    onLocalhost,
    onExternal,
  }: {
    onLocalhost: () => void;
    onExternal: () => void;
  } = $props();
</script>

<div
  class="flex flex-col items-center gap-1.5 py-3 md:py-6 md:flex-row md:items-stretch"
>
  <button
    type="button"
    onclick={onLocalhost}
    class="group flex w-full grow max-w-sm cursor-pointer flex-col items-center justify-between gap-3 rounded-lg md:rounded-r-[4px] border border-border bg-muted/20 bg-[radial-gradient(circle_at_top_left,_#EF0A8621_0%,_transparent_60%),radial-gradient(circle_at_bottom_right,_#EF0A8610_0%,_transparent_60%)] p-4 text-center transition-colors hover:border-[#EF0A86]/50 hover:bg-[#EF0A86]/5"
  >
    <span
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#EF0A86]/20 bg-[#EF0A86]/10 text-[#EF0A86]"
    >
      <HardDrive class="size-5" />
    </span>
    <span class="text-foreground text-sm text-center font-medium"
      >This server (localhost)</span
    >
    <span class="text-muted-foreground text-xs text-center">
      Install on the same machine running Benisploy. Recommended for
      singe-server setups and deploying simple apps.
    </span>
  </button>
  <button
    type="button"
    onclick={onExternal}
    class="group flex w-full grow max-w-sm cursor-pointer flex-col items-center justify-between gap-3 rounded-lg md:rounded-l-[4px] border border-border bg-muted/20 bg-[radial-gradient(circle_at_top_left,_#ff690021_0%,_transparent_60%),radial-gradient(circle_at_bottom_right,_#ff690010_0%,_transparent_60%)] p-4 text-center transition-colors hover:border-[#ff6900]/50 hover:bg-[#ff6900]/5"
  >
    <span
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#ff6900]/20 bg-[#ff6900]/10 text-[#ff6900]"
    >
      <Globe class="size-5" />
    </span>
    <span class="text-foreground text-sm font-medium text-center"
      >External server</span
    >
    <span class="text-muted-foreground text-xs text-center">
      A VPS or bare-metal machine you have SSH access to. You'll provide its
      address and credentials. Preferred for dedicated servers and apps.
      detacided
    </span>
  </button>
</div>
