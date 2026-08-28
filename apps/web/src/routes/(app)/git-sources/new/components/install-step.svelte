<script lang="ts">
  import { resolve } from "$app/paths";
  import RainbowButton from "$lib/components/ui/rainbow-button/rainbow-button.svelte";

  let {
    installUrl,
    alreadyInstalled = false,
  }: { installUrl: string | null; alreadyInstalled?: boolean } = $props();
</script>

<div class="flex flex-col gap-6">
  {#if alreadyInstalled}
    <div class="flex flex-col gap-1">
      <p class="text-muted-foreground text-sm">
        Your GitHub App is already installed and connected to Benisploy.
      </p>
      <p class="text-muted-foreground text-sm">
        You can manage your connected GitHub repositories and Git sources from
        the Git Sources page.
      </p>
    </div>

    <div class="w-full">
      <RainbowButton href={resolve("/git-sources")} class="w-full rounded">
        Go to Git Sources
      </RainbowButton>
    </div>
  {:else if installUrl}
    <div class="flex flex-col gap-1">
      <p class="text-muted-foreground text-sm">
        Your GitHub App is ready. Install it to connect your repositories with
        Benisploy and enable automated deployments.
      </p>
      <p class="text-muted-foreground text-sm">
        Once installed, Benisploy can securely access your selected repositories
        and automatically respond to changes, so your deployments stay in sync
        with your code.
      </p>
    </div>

    <div class="w-full">
      <RainbowButton href={installUrl} class="w-full rounded">
        Install on GitHub
      </RainbowButton>
    </div>
  {:else}
    <div class="flex flex-col gap-1">
      <p class="text-destructive text-sm">
        We couldn't find the GitHub App that was just created.
      </p>
      <p class="text-muted-foreground text-sm">
        Please go back to the previous step and create the GitHub App again. If
        the problem persists, check your GitHub App configuration.
      </p>
    </div>

    <div class="w-full">
      <RainbowButton href={resolve("/git-sources")} class="w-full rounded">
        Go to Git Sources
      </RainbowButton>
    </div>
  {/if}
</div>
