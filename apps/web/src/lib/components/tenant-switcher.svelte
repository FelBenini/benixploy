<script lang="ts">
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import Building from "@lucide/svelte/icons/building";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Plus from "@lucide/svelte/icons/plus";
  import Loader from "@lucide/svelte/icons/loader";
  import * as Avatar from "./ui/avatar";
  import AvatarFallback from "./ui/avatar/avatar-fallback.svelte";

  type Org = {
    id: string;
    name: string;
    slug: string;
  };

  let {
    activeOrg,
    userOrgs,
  }: {
    activeOrg: Org | null;
    userOrgs: Org[];
  } = $props();

  let isSwitching = $state(false);
  let showCreateDialog = $state(false);

  let orgName = $state("");
  let orgSlug = $state("");
  let isCreating = $state(false);
  let error = $state("");

  function generateSlug(name: string) {
    orgSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function switchOrg(orgId: string) {
    if (orgId === activeOrg?.id) return;
    isSwitching = true;
    try {
      await fetch("/api/org/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      window.location.reload();
    } finally {
      isSwitching = false;
    }
  }

  async function handleCreateOrg(e: Event) {
    e.preventDefault();
    if (!orgName.trim() || !orgSlug.trim()) return;
    isCreating = true;
    error = "";
    try {
      const res = await fetch("/api/org/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim(), slug: orgSlug.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        error = data.error ?? "Failed to create organization";
        return;
      }
      const org = await res.json();
      showCreateDialog = false;
      await switchOrg(org.id);
    } catch {
      error = "Failed to create organization";
    } finally {
      isCreating = false;
    }
  }
</script>

<Dialog.Root bind:open={showCreateDialog}>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      <Button
        size="lg"
        type="button"
        variant="ghost"
        class="flex w-full items-center gap-2 rounded-md px-2 py-5 md:py-8 text-sm hover:bg-sidebar-accent/40 text-sidebar-foreground transition-colors cursor-pointer group"
        disabled={isSwitching}
      >
        <Avatar.Root>
          <Avatar.Fallback name={activeOrg?.name ?? "No organization"} />
        </Avatar.Root>
        <span class="truncate font-medium flex-col text-left">
          <h6 class="text-xs text-foreground/50">Org</h6>
          <p class="text-lg mt-[-6px]">
            {activeOrg?.name ?? "No organization"}
          </p>
        </span>
        <ChevronDown
          class="ml-auto size-3.5 text-sidebar-foreground/50 transition-transform group-data-[state=open]:rotate-180"
        />
      </Button>
    </DropdownMenu.Trigger>

    <DropdownMenu.Content
      align="center"
      side="bottom"
      sideOffset={8}
      class="w-56 border-none shadow-lg"
    >
      {#each userOrgs as org (org.id)}
        <DropdownMenu.Item
          class="rounded-md mb-[2px] py-1 {org.id === activeOrg?.id
            ? 'bg-accent'
            : ''}"
          onclick={() => switchOrg(org.id)}
        >
          <button type="button" class="flex w-full items-center gap-2">
            <Avatar.Root size="sm">
              <Avatar.Fallback name={org.name ?? "No organization"} />
            </Avatar.Root>
            <span class="truncate">{org.name}</span>
            {#if org.id === activeOrg?.id}
              <Check class="ml-auto size-4" />
            {/if}
          </button>
        </DropdownMenu.Item>
      {/each}

      <DropdownMenu.Separator />

      <DropdownMenu.Item
        class="rounded-md rounded-t-[2px] py-2"
        onclick={() => (showCreateDialog = true)}
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 text-sidebar-foreground/70"
        >
          <Plus class="size-4" />
          <span>Create organization</span>
        </button>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>

  <Dialog.Content
    class="bg-background/30 backdrop-blur-lg bg-[radial-gradient(circle_at_top_left,_#EF0A8610_0%,_transparent_50%),radial-gradient(circle_at_bottom_right,_#ff690050_0%,_transparent_50%)]"
  >
    <Dialog.Header class="flex-col jusify-between items-center gap-4">
      <div
        class="mx-auto rounded-md bg-gradient-to-br from-white/30 via-accent to-border p-px shadow-md"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-[calc(theme(borderRadius.md)-1px)] bg-gradient-to-br from-accent to-background"
        >
          <Plus class="text-foreground/80" />
        </div>
      </div>
      <Dialog.Title>Create organization</Dialog.Title>
      <Dialog.Description class="text-center">
        Create a new org to manage your deployments.
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={handleCreateOrg}>
      <div class="grid gap-4 px-4 pb-4">
        <div class="grid gap-2">
          <label for="org-name" class="text-sm font-medium">Name</label>
          <Input
            id="org-name"
            bind:value={orgName}
            oninput={() => generateSlug(orgName)}
            placeholder="My Organization"
            required
          />
        </div>
        <div class="grid gap-2">
          <label for="org-slug" class="text-sm font-medium">Slug</label>
          <Input
            id="org-slug"
            bind:value={orgSlug}
            placeholder="my-organization"
            required
          />
        </div>
      </div>

      <Dialog.Footer
        class="flex-row h-16 items-center justify-center gap-1 p-2"
      >
        <Dialog.Close type="button">
          {#snippet child({ props })}
            <Button
              type="button"
              variant="ghost"
              class="w-[49%] rounded-r-[2px] h-full border-border"
              {...props}>Cancel</Button
            >
          {/snippet}
        </Dialog.Close>
        <Button
          class="w-[49%] h-full rounded-l-[2px]"
          type="submit"
          disabled={isCreating || !orgName.trim() || !orgSlug.trim()}
        >
          {#if isCreating}
            <Loader data-icon="inline-start" class="animate-spin" />
            Creating…
          {:else}
            Create
          {/if}
        </Button>
      </Dialog.Footer>
    </form>

    {#if error}
      <p class="px-4 pb-2 text-sm text-destructive">{error}</p>
    {/if}
  </Dialog.Content>
</Dialog.Root>
