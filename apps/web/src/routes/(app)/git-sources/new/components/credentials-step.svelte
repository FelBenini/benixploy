<script lang="ts">
  import { resolve } from "$app/paths";
  import RainbowButton from "$lib/components/ui/rainbow-button/rainbow-button.svelte";
</script>

<div class="flex flex-col gap-6">
  <div class="flex flex-col gap-1">
    <p class="text-muted-foreground text-sm">
      To connect GitHub with Benisploy, you'll first need to create a GitHub
      App. The app securely connects Benisploy to your repositories and enables
      automatic deployments.
    </p>
    <p class="text-muted-foreground text-sm">
      Click "Create GitHub App" to get started. GitHub will guide you through
      the setup and generate the credentials Benisploy needs automatically.
    </p>
  </div>
  <div class="w-full">
    <RainbowButton
      href={resolve("/api/git/github/manifest")}
      class="w-full rounded">Create GitHub App</RainbowButton
    >
  </div>
</div>
