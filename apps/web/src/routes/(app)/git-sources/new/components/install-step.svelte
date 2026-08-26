<script lang="ts">
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";

  let {
    installUrl,
    alreadyInstalled = false,
  }: { installUrl: string | null; alreadyInstalled?: boolean } = $props();
</script>

<div class="flex flex-col gap-3">
  {#if alreadyInstalled}
    <p class="text-muted-foreground text-sm">
      This GitHub App is already installed. You can manage it from Git Sources.
    </p>
    <div>
      <Button href={resolve("/git-sources")}>Go to Git Sources</Button>
    </div>
  {:else if installUrl}
    <p class="text-muted-foreground text-sm">
      Your GitHub App was created. Install it on GitHub to start deploying.
    </p>
    <div>
      <Button href={installUrl}>Install on GitHub</Button>
    </div>
  {:else}
    <p class="text-destructive text-sm">
      Could not resolve the GitHub App. Please go back and try again.
    </p>
    <div>
      <Button href={resolve("/git-sources")}>Go to Git Sources</Button>
    </div>
  {/if}
</div>