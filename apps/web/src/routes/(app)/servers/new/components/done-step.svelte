<script lang="ts">
  import type { CreatedServer } from "./types.js";

  let {
    createdServer,
    name,
    address,
    sshPort,
    sshUser,
  }: {
    createdServer: CreatedServer | null;
    name: string;
    address: string;
    sshPort: string;
    sshUser: string;
  } = $props();
</script>

<div class="flex flex-col gap-3 py-4">
  <div class="flex flex-col gap-0.5">
    <span class="text-xs text-muted-foreground">Name</span>
    <span class="text-sm font-medium"
      >{createdServer?.name ?? name}</span
    >
  </div>
  <div class="flex flex-col gap-0.5">
    <span class="text-xs text-muted-foreground">Address</span>
    <span class="text-sm font-medium">
      {createdServer?.address ?? address}:{sshPort}
    </span>
  </div>
  <div class="flex flex-col gap-0.5">
    <span class="text-xs text-muted-foreground">SSH user</span>
    <span class="text-sm font-medium">{sshUser}</span>
  </div>
  <div class="flex flex-col gap-0.5">
    <span class="text-xs text-muted-foreground">Status</span>
    <span
      class="inline-flex w-fit items-center rounded-full border border-green-800 bg-green-950/50 px-2 py-0.5 text-xs font-medium text-green-400"
    >
      online
    </span>
  </div>
  <p class="text-muted-foreground mt-1 text-xs">
    The node monitor is pushing stats and the server is ready to receive
    apps.
  </p>
</div>