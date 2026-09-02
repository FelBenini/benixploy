<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";

  interface AppInfo {
    name: string;
    kind: string;
    status: string;
    serverName: string | null;
    createdAt: string;
  }

  let { item }: { item: AppInfo } = $props();

  function statusPillClass(status: string): string {
    switch (status) {
      case "healthy":
        return "bg-green-950/50 border-green-800 text-green-400";
      case "deploying":
        return "bg-blue-950/50 border-blue-800 text-blue-400";
      case "degraded":
        return "bg-amber-950/50 border-amber-800 text-amber-400";
      default:
        return "bg-muted/50 border-border text-muted-foreground";
    }
  }
</script>

<div class="flex flex-wrap items-start justify-between gap-4">
  <div class="w-full md:w-fit">
    <h1
      class="text-foreground flex items-center md:gap-4 text-2xl font-semibold md:justify-start justify-between w-full md:w-fit"
    >
      {item.name}
      <Badge class={statusPillClass(item.status)}>{item.status}</Badge>
    </h1>
    <p class="text-muted-foreground text-sm">
      {item.kind} &middot; {item.serverName ?? "no server"}
    </p>
  </div>
  <div class="flex flex-col items-end gap-1.5">
    <span class="text-muted-foreground text-xs">
      Created {new Date(item.createdAt).toLocaleString()}
    </span>
  </div>
</div>
