<script lang="ts">
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";
</script>

<div class="flex flex-col gap-3">
  <p class="text-muted-foreground text-sm">
    Clicking "Create GitHub App" opens GitHub with a pre-filled registration.
    GitHub will generate the App ID, private key, and webhook secret for you —
    no credentials to copy.
  </p>

  <div>
    <Button href={resolve("/api/git/github/manifest")}>
      Create GitHub App
    </Button>
  </div>
</div>
