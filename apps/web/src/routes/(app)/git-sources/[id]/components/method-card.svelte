<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import type { Snippet } from "svelte";

  let {
    title,
    description,
    children,
  }: {
    title: string;
    description: string;
    children: Snippet;
  } = $props();
</script>

<Card.Root>
  <Card.Content class="flex flex-col gap-3 py-1">
    <div>
      <span class="text-foreground text-sm font-medium">{title}</span>
      <p class="text-muted-foreground text-xs">{description}</p>
    </div>
    {@render children()}
  </Card.Content>
</Card.Root>
