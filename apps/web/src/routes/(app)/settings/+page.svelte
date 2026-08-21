<script lang="ts">
  import Settings from "@lucide/svelte/icons/settings";
</script>

<svelte:head>
  <title>Settings — Benisploy</title>
</svelte:head>

<div class="flex flex-col md:p-6 p-3 gap-6">
  <div>
    <h1 class="text-foreground text-lg font-semibold">Settings</h1>
    <p class="text-muted-foreground text-sm">
      Instance configuration.
    </p>
  </div>

  <div
    class="flex flex-col items-center justify-center gap-3 rounded-xl bg-background/10 backdrop-blur-sm ring-1 ring-foreground/10 px-6 py-16 text-center"
  >
    <div
      class="flex h-12 w-12 items-center justify-center rounded-md bg-muted/50 text-muted-foreground"
    >
      <Settings class="size-6" />
    </div>
    <h2 class="text-foreground text-sm font-semibold">Nothing here yet</h2>
    <p class="text-muted-foreground text-sm max-w-sm">
      Settings will appear here as configuration options are added.
    </p>
  </div>
</div>
