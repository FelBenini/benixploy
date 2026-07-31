<script lang="ts">
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Avatar from "$lib/components/ui/avatar";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";

  type UserInfo = {
    id?: string;
    email?: string;
    username?: string;
    avatarUrl?: string;
  } | null;

  let {
    user,
    onLogout,
  }: {
    user: UserInfo;
    onLogout?: () => void;
  } = $props();

  const displayName = $derived(user?.username ?? user?.email ?? "User");

  let showLogoutDialog = $state(false);

  function handleConfirmLogout() {
    showLogoutDialog = false;
    onLogout?.();
  }
</script>

<AlertDialog.Root bind:open={showLogoutDialog}>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent/40 text-sidebar-foreground transition-colors cursor-pointer group"
      >
        <Avatar.Root size="lg" class="size-7 shrink-0">
          {#if user?.avatarUrl}
            <Avatar.Image src={user.avatarUrl} alt={displayName} />
          {/if}
          <Avatar.Fallback name={displayName}></Avatar.Fallback>
        </Avatar.Root>
        <div class="justify-left">
          <p class="text-left">{displayName}</p>
          {#if user?.email}
            <p class="text-muted-foreground text-xs truncate">{user.email}</p>
          {/if}
        </div>
        <ChevronUp
          class="justify-self-end ml-auto size-3.5 text-sidebar-foreground/50 transition-transform group-data-[state=open]:rotate-180"
        />
      </button>
    </DropdownMenu.Trigger>

    <DropdownMenu.Content
      align="center"
      side="top"
      sideOffset={8}
      class="w-56 border-none shadow-lg"
    >
      <div class="flex items-center gap-2 px-2 py-1.5">
        <Avatar.Root size="default">
          {#if user?.avatarUrl}
            <Avatar.Image src={user.avatarUrl} alt={displayName} />
          {/if}
          <Avatar.Fallback name={displayName}></Avatar.Fallback>
        </Avatar.Root>
        <div class="flex flex-col text-left">
          <span class="text-sm font-medium">{displayName}</span>
          {#if user?.email}
            <span class="text-muted-foreground text-xs truncate"
              >{user.email}</span
            >
          {/if}
        </div>
      </div>

      <DropdownMenu.Separator />

      <DropdownMenu.Item class="rounded-[2px]">
        <button type="button" class="flex w-full items-center gap-2">
          <SettingsIcon class="size-4" />
          <span>Settings</span>
        </button>
      </DropdownMenu.Item>

      <DropdownMenu.Separator />

      <DropdownMenu.Item
        variant="destructive"
        class="rounded-[2px] rounded-b-md"
      >
        <button
          type="button"
          class="flex w-full items-center gap-2"
          onclick={() => (showLogoutDialog = true)}
        >
          <LogOutIcon class="size-4" />
          <span>Sign out</span>
        </button>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>

  <AlertDialog.Content
    class="bg-background/30 backdrop-blur-lg bg-[radial-gradient(circle_at_top_left,_#EF0A8610_0%,_transparent_50%),radial-gradient(circle_at_bottom_right,_#ef444450_0%,_transparent_50%)]"
  >
    <AlertDialog.Header class="flex-col jusify-between items-center gap-4">
      <div
        class="mx-auto rounded-md bg-gradient-to-br from-white/30 via-accent to-border p-px shadow-md"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-[calc(theme(borderRadius.md)-1px)] bg-gradient-to-br from-accent to-background"
        >
          <LogOutIcon class="text-foreground/80" />
        </div>
      </div>
      <AlertDialog.Description class="text-center">
        Are you sure you want to sign out? You will be redirected to the login
        page.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer
      class="flex-row h-16 items-center justify-center gap-1 p-2"
    >
      <AlertDialog.Cancel class="w-[49%] rounded-r-[2px] h-full border-border"
        >Cancel</AlertDialog.Cancel
      >
      <AlertDialog.Action
        class="w-[49%] h-full rounded-l-[2px] border-destructive/30"
        onclick={handleConfirmLogout}
        variant="destructive">Sign out</AlertDialog.Action
      >
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
