<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import * as Card from "$lib/components/ui/card";
  import * as Empty from "$lib/components/ui/empty";
  import * as Table from "$lib/components/ui/table";
  import type { EventItem } from "./types.js";

  let { events }: { events: EventItem[] } = $props();

  function eventBadgeVariant(
    eventType: string,
  ): "destructive" | "secondary" | "outline" {
    if (eventType === "oom" || eventType === "die") return "destructive";
    if (eventType === "unhealthy") return "outline";
    return "secondary";
  }

  function eventLabel(eventType: string): string {
    switch (eventType) {
      case "die":
        return "Container died";
      case "oom":
        return "Out of memory";
      case "unhealthy":
        return "Health check failed";
      case "restart_loop":
        return "Restart loop";
      default:
        return eventType;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Events</Card.Title>
    <Card.Description>
      Recent container signals from the node monitor
    </Card.Description>
  </Card.Header>
  <Card.Content>
    {#if events.length === 0}
      <Empty.Root>
        <Empty.Header>
          <Empty.Title>No events</Empty.Title>
          <Empty.Description>
            No container died, OOM, unhealthy or restart-loop signals in this
            range.
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Time</Table.Head>
            <Table.Head>Event</Table.Head>
            <Table.Head>App</Table.Head>
            <Table.Head class="hidden sm:table-cell">Details</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each events as ev (ev.id)}
            <Table.Row>
              <Table.Cell class="text-muted-foreground whitespace-nowrap">
                {new Date(ev.receivedAt).toLocaleString()}
              </Table.Cell>
              <Table.Cell>
                <Badge variant={eventBadgeVariant(ev.eventType)}>
                  {eventLabel(ev.eventType)}
                </Badge>
              </Table.Cell>
              <Table.Cell class="text-muted-foreground">
                {ev.appId ?? "—"}
              </Table.Cell>
              <Table.Cell class="text-muted-foreground hidden sm:table-cell">
                <span class="font-mono text-xs truncate max-w-48 block">
                  {JSON.stringify(ev.payload)}
                </span>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </Card.Content>
</Card.Root>
