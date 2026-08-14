<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import ServerHeader from "./components/server-header.svelte";
  import GeneralTab from "./components/general-tab.svelte";
  import MetricsTab from "./components/metrics-tab.svelte";
  import TerminalTab from "./components/terminal-tab.svelte";
  import type { ServerInfo } from "./components/types";

  let { data } = $props();
  const server: ServerInfo = $derived(data.server);

  let activeTab = $state("general");
</script>

<svelte:head>
  <title>{server.name} — Benisploy</title>
</svelte:head>

<div class="flex flex-col gap-6 p-3 md:p-6">
  <ServerHeader {server} />
  <Tabs.Root bind:value={activeTab}>
    <Tabs.List
      class="bg-transparent justify-start gap-6 p-0 pb-3 border-b-border mb-3 border-b rounded-none w-full"
    >
      <Tabs.Trigger class="flex-0 p-0" value="general">General</Tabs.Trigger>
      <Tabs.Trigger class="flex-0 p-0" value="metrics">Metrics</Tabs.Trigger>
      <Tabs.Trigger class="flex-0 p-0" value="terminal">Terminal</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="general">
      <GeneralTab {server} />
    </Tabs.Content>
    <Tabs.Content value="metrics">
      <MetricsTab {server} />
    </Tabs.Content>
    <Tabs.Content value="terminal">
      <TerminalTab />
    </Tabs.Content>
  </Tabs.Root>
</div>
