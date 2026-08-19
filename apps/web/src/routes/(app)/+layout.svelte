<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import UserMenu from "$lib/components/user-menu.svelte";
  import TenantSwitcher from "$lib/components/tenant-switcher.svelte";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import Server from "@lucide/svelte/icons/server";
  import Settings from "@lucide/svelte/icons/settings";
  import Boxes from "@lucide/svelte/icons/boxes";
  import { page } from "$app/state";
  import { fade } from "svelte/transition";

  let { data, children } = $props();

  const sidebar = Sidebar.useSidebar();

  function handleNav() {
    sidebar.setOpenMobile(false);
  }

  function handleLogout() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      window.location.href = "/login";
    });
  }

  const items = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Servers",
      url: "/servers",
      icon: Server,
    },
    {
      title: "Apps",
      url: "/apps",
      icon: Boxes,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ];
</script>

<Sidebar.Provider>
  <Sidebar.Root collapsible="icon">
    <Sidebar.Header>
      <TenantSwitcher activeOrg={data.activeOrg} userOrgs={data.userOrgs} />
    </Sidebar.Header>

    <Sidebar.Separator />

    <Sidebar.Content>
      <Sidebar.Group>
        <Sidebar.GroupLabel>Main</Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <Sidebar.Menu class="gap-2">
            {#each items as item (item.title)}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  tooltipContent={item.title}
                  variant="ghost"
                  size="lg"
                  class="text-foreground/80 data-active:outline-solid data-active:outline-1 outline-border data-active:bg-[linear-gradient(var(--border),transparent)] rounded-[2px]"
                  isActive={page.url.pathname.split("/")[1] ===
                    item.url.split("/")[1]}
                >
                  {#snippet child({ props })}
                    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
                    <a href={item.url} {...props} onclick={() => handleNav()}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>

    <Sidebar.Footer>
      <UserMenu user={data.user} onLogout={handleLogout} />
    </Sidebar.Footer>
  </Sidebar.Root>

  <Sidebar.Inset>
    <header
      class="sticky top-0 z-50 flex shrink-0 md:h-10 items-center p-2 backdrop-blur-lg shadow"
    >
      <Sidebar.Trigger class="mr-2 md:hidden p-6 text-xl" />

      <img
        src="/logo.svg"
        class="absolute left-1/2 max-h-3/4 w-1/2 -translate-x-1/2"
        alt="benisploy"
      />
    </header>
    <div class="page-transition grow">
      {#key page.url.pathname}
        <div
          transition:fade={{ duration: 150 }}
          class="bg-background flex flex-1 flex-col page-container"
        >
          {@render children()}
        </div>
      {/key}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>

<style>
  .page-container {
    grid-area: 1 / 1;
  }
  .page-transition {
    display: grid;
  }
</style>
