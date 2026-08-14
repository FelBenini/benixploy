<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Separator } from "$lib/components/ui/separator";
  import type { ServerInfo } from "./types.js";

  let { server }: { server: ServerInfo } = $props();

  let name = $state(server.name);
  let description = $state(server.description ?? "");
  let address = $state(server.address);
  let sshPort = $state(String(server.sshPort));
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let saveSuccess = $state(false);

  let sysInfo = $state<{
    os: string;
    arch: string;
    ramBytes: number;
    distro: string;
  } | null>(null);
  let sysInfoLoading = $state(true);
  let sysInfoError = $state<string | null>(null);

  async function loadSystemInfo() {
    sysInfoLoading = true;
    sysInfoError = null;
    try {
      const res = await fetch(`/api/servers/${server.id}/system-info`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to fetch system info");
      }
      const body = await res.json();
      sysInfo = body.data;
    } catch (err) {
      sysInfoError =
        err instanceof Error ? err.message : "Failed to fetch system info";
    } finally {
      sysInfoLoading = false;
    }
  }

  async function handleSave() {
    saving = true;
    saveError = null;
    saveSuccess = false;
    try {
      const res = await fetch(`/api/servers/${server.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          address: address.trim(),
          sshPort: parseInt(sshPort, 10),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      saveSuccess = true;
      setTimeout(() => (saveSuccess = false), 3000);
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Failed to save";
    } finally {
      saving = false;
    }
  }

  function formatBytes(bytes: number): string {
    if (!bytes) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(1)} ${units[i]}`;
  }

  onMount(() => {
    void loadSystemInfo();
  });
</script>

<div class="flex flex-col gap-6">
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg flex items-center justify-between">
        Server Details
        <Button
          variant="outline"
          onclick={handleSave}
          disabled={saving}
          class="w-26"
        >
          {saveSuccess ? "Saved!" : saving ? "Saving..." : "Save changes"}
        </Button>
        {#if saveError}
          <span class="text-sm text-destructive">{saveError}</span>
        {/if}
      </Card.Title>
      <Card.Description>
        Update the name, description, and connection details for this server.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <Field.FieldGroup>
        <Field.Field>
          <Field.FieldLabel for="name">Name</Field.FieldLabel>
          <Input
            id="name"
            bind:value={name}
            placeholder="My server"
            maxlength={128}
          />
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel for="description">Description</Field.FieldLabel>
          <Input
            id="description"
            bind:value={description}
            placeholder="Optional description"
            maxlength={512}
          />
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel for="address">Address</Field.FieldLabel>
          <Input id="address" bind:value={address} placeholder="192.168.1.1" />
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel for="sshPort">SSH Port</Field.FieldLabel>
          <Input
            id="sshPort"
            type="number"
            bind:value={sshPort}
            min={1}
            max={65535}
          />
        </Field.Field>
      </Field.FieldGroup>
    </Card.Content>
  </Card.Root>

  <Separator />

  <Card.Header>
    <Card.Title>System Information</Card.Title>
    <Card.Description>
      Live details fetched via SSH from the remote server.
    </Card.Description>
  </Card.Header>
  <Card.Content>
    {#if sysInfoLoading}
      <div class="flex flex-col gap-3">
        <Skeleton class="h-5 w-48" />
        <Skeleton class="h-5 w-32" />
        <Skeleton class="h-5 w-40" />
        <Skeleton class="h-5 w-56" />
      </div>
    {:else if sysInfoError}
      <div
        class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
      >
        {sysInfoError}
      </div>
    {:else if sysInfo}
      <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div>
          <dt class="text-muted-foreground text-sm">Operating System</dt>
          <dd class="text-sm font-medium">{sysInfo.os}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground text-sm">Distribution</dt>
          <dd class="text-sm font-medium">{sysInfo.distro}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground text-sm">Architecture</dt>
          <dd class="text-sm font-medium">{sysInfo.arch}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground text-sm">Total RAM</dt>
          <dd class="text-sm font-medium">
            {formatBytes(sysInfo.ramBytes)}
          </dd>
        </div>
      </dl>
    {/if}
  </Card.Content>
</div>
