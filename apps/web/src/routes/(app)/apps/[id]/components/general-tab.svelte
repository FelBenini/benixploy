<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import * as Card from "$lib/components/ui/card";

  interface AppInfo {
    kind: string;
    status: string;
    activeColor: string | null;
    serverName: string | null;
  }

  interface DeploymentInfo {
    id: string;
    version: number;
    status: string;
    createdAt: string;
  }

  let {
    item,
    deployment,
  }: { item: AppInfo; deployment: DeploymentInfo | null } = $props();

  function deploymentPillClass(status: string): string {
    switch (status) {
      case "healthy":
        return "bg-green-950/50 border-green-800 text-green-400";
      case "executing":
      case "verifying":
        return "bg-blue-950/50 border-blue-800 text-blue-400";
      case "failed":
        return "bg-red-950/50 border-red-800 text-red-400";
      default:
        return "bg-muted/50 border-border text-muted-foreground";
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>General</Card.Title>
    <Card.Description>Basic application details and current deployment.</Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-col gap-4 text-sm">
    <div class="grid gap-3 sm:grid-cols-2">
      <div>
        <span class="text-muted-foreground text-xs">Kind</span>
        <p class="text-foreground">{item.kind}</p>
      </div>
      <div>
        <span class="text-muted-foreground text-xs">Server</span>
        <p class="text-foreground">{item.serverName ?? "—"}</p>
      </div>
      <div>
        <span class="text-muted-foreground text-xs">Status</span>
        <p class="text-foreground">{item.status}</p>
      </div>
      <div>
        <span class="text-muted-foreground text-xs">Active color</span>
        <p class="text-foreground">{item.activeColor ?? "—"}</p>
      </div>
    </div>

    <div class="-mx-6 border-t border-border/50"></div>

    <div class="flex items-center justify-between gap-2">
      <span class="text-muted-foreground text-xs">Current deployment</span>
      {#if deployment}
        <div class="flex items-center gap-2">
          <Badge class={deploymentPillClass(deployment.status)}>
            {deployment.status}
          </Badge>
          <span class="text-muted-foreground text-xs">
            v{deployment.version} &middot;
            {new Date(deployment.createdAt).toLocaleString()}
          </span>
        </div>
      {:else}
        <span class="text-muted-foreground text-xs">None</span>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
