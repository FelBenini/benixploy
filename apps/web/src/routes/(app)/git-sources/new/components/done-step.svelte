<script lang="ts">
  let { name }: { name: string } = $props();
</script>

<div class="flex flex-col gap-3 py-4">
  <div class="flex flex-col gap-0.5">
    <span class="text-xs text-muted-foreground">Provider</span>
    <span class="text-sm font-medium">GitHub</span>
  </div>
  <div class="flex flex-col gap-0.5">
    <span class="text-xs text-muted-foreground">Name</span>
    <span class="text-sm font-medium">{name || "GitHub App"}</span>
  </div>
  <div class="flex flex-col gap-0.5">
    <span class="text-xs text-muted-foreground">Status</span>
    <span
      class="inline-flex w-fit items-center rounded-full border border-green-800 bg-green-950/50 px-2 py-0.5 text-xs font-medium text-green-400"
    >
      connected
    </span>
  </div>
  <p class="text-muted-foreground mt-1 text-xs">
    Your Git source is connected and encrypted at rest. The install callback
    and webhook receiver arrive in a follow-up.
  </p>
</div>
