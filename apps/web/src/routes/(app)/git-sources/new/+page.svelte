<script lang="ts">
  import { page } from "$app/state";
  import * as Wizard from "$lib/components/ui/wizard/index.js";
  import * as Steps from "./components/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import type { WizardStep } from "$lib/components/ui/wizard/index.js";
  import { ArrowLeft } from "@lucide/svelte";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Key from "@lucide/svelte/icons/key";
  import CheckCircle from "@lucide/svelte/icons/check-circle";

  const steps: WizardStep[] = [
    {
      title: "Provider",
      description: "Choose where your code lives.",
      icon: GitBranch,
    },
    {
      title: "Create App",
      description: "We register a GitHub App for you.",
      icon: Key,
    },
    {
      title: "Install",
      description: "Install the app on GitHub.",
      icon: CheckCircle,
    },
  ];

  let { data } = $props();

  let step = $state(0);

  if (page.url.searchParams.get("step") === "install") {
    step = 2;
  }

  function selectProvider(provider: string) {
    if (provider !== "github") return;
    step = 1;
  }
</script>

<svelte:head>
  <title>Connect a Git provider — Benisploy</title>
</svelte:head>

<div class="flex w-full justify-center grow">
  <Wizard.Root
    {steps}
    bind:step
    class="flex h-full w-full max-w-xl flex-col ring-0 relative rounded mx-auto border-none outline-none bg-none"
  >
    <Button variant="outline" class="absolute top-6 left-6" href="/git-sources"
      ><ArrowLeft />Git Sources</Button
    >
    <Wizard.Header />
    <Wizard.Steps />

    <Wizard.Content class="h-auto min-h-0 flex-1 overflow-y-auto">
      {#if step === 0}
        <Steps.ProviderStep onSelect={selectProvider} />
      {:else if step === 1}
        <Steps.CredentialsStep />
      {:else if step === 2}
        <Steps.InstallStep
          installUrl={data.install?.installUrl ?? null}
          alreadyInstalled={data.install?.alreadyInstalled ?? false}
        />
      {/if}
    </Wizard.Content>
  </Wizard.Root>
</div>
