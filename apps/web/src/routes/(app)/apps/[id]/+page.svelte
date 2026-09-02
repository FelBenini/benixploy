<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import AppHeader from "./components/app-header.svelte";
  import GeneralTab from "./components/general-tab.svelte";
  import SourcePanel from "./components/source-panel.svelte";

  let { data } = $props();
  const item = $derived(data.app);
  const gitSource = $derived(data.gitSource);
  const currentDeployment = $derived(data.currentDeployment);

  let activeTab = $state("general");
</script>

<svelte:head>
  <title>{item.name} — Benisploy</title>
</svelte:head>

<div class="flex flex-col gap-6 p-3 md:p-6">
  <AppHeader {item} />
  <Tabs.Root bind:value={activeTab}>
    <Tabs.List
      class="bg-transparent justify-start gap-6 p-0 pb-3 border-b-border mb-3 border-b rounded-none w-full"
    >
      <Tabs.Trigger class="flex-0 p-0" value="general">General</Tabs.Trigger>
      <Tabs.Trigger class="flex-0 p-0" value="source">Source</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="general">
      <GeneralTab {item} deployment={currentDeployment} />
    </Tabs.Content>
    <Tabs.Content value="source">
      <SourcePanel source={gitSource} />
    </Tabs.Content>
  </Tabs.Root>
</div>
