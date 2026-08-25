<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import * as Card from "$lib/components/ui/card";

  let {
    title,
    outcome,
  }: {
    title: string;
    outcome: { ok: boolean; result?: unknown; error?: string };
  } = $props();

  function json(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
</script>

<Card.Root>
  <Card.Content class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <span class="text-foreground text-sm font-medium">{title}</span>
      <Badge variant={outcome.ok ? "secondary" : "destructive"}>
        {outcome.ok ? "ok" : "error"}
      </Badge>
    </div>
    {#if outcome.ok}
      <pre class="text-muted-foreground text-xs overflow-auto">{json(outcome.result)}</pre>
    {:else}
      <p class="text-destructive text-sm">{outcome.error}</p>
    {/if}
  </Card.Content>
</Card.Root>
