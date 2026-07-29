<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import Server from "@lucide/svelte/icons/server";
  import Settings from "@lucide/svelte/icons/settings";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Box from "@lucide/svelte/icons/box";
  import { page } from "$app/state";

  let { children } = $props();

  const sidebar = Sidebar.useSidebar();

  function handleNav() {
    sidebar.setOpenMobile(false);
  }

  const items = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Apps",
      url: "/apps",
      icon: Server,
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
      <Sidebar.Menu class="gap-1">
        <Sidebar.MenuItem>
          <Sidebar.MenuButton
            tooltipContent="Benisploy"
            variant="ghost"
            size="lg"
          >
            <Box />
            <span class="font-semibold">Benisploy</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
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
                  isActive={page.url.pathname === item.url}
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
      <Sidebar.Menu class="gap-1">
        <Sidebar.MenuItem>
          <Sidebar.MenuButton
            tooltipContent="Sign out"
            variant="ghost"
            size="lg"
            onclick={() => {
              fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                window.location.href = "/login";
              });
            }}
          >
            <LogOut />
            <span>Sign out</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </Sidebar.Footer>
  </Sidebar.Root>

  <Sidebar.Inset>
    <header
      class="flex h-16 shrink-0 items-center gap-2 border-b border-border"
    >
      <Sidebar.Trigger class="mr-2 text-xl px-8 h-full" />
      <span class="text-foreground text-lg font-bold">Dashboard</span>
    </header>
    <div class="flex flex-1 flex-col gap-6 p-6">
      {@render children()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
