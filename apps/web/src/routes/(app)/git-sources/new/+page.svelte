<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
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
      title: "Credentials",
      description: "Connect your provider account. Credentials are encrypted at rest.",
      icon: Key,
    },
    {
      title: "Done",
      description: "Your Git source is ready.",
      icon: CheckCircle,
    },
  ];

  let step = $state(0);
  let name = $state("");
  let appId = $state("");
  let clientId = $state("");
  let privateKeyPem = $state("");
  let webhookSecret = $state("");
  let submitting = $state(false);
  let error = $state("");

  const canSubmit = $derived(
    appId.trim().length > 0 &&
      clientId.trim().length > 0 &&
      privateKeyPem.trim().length > 0 &&
      webhookSecret.trim().length > 0,
  );

  function selectProvider(provider: string) {
    if (provider !== "github") return;
    step = 1;
  }

  async function connect() {
    if (!canSubmit || submitting) return;
    submitting = true;
    error = "";
    try {
      const res = await fetch("/api/git/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authKind: "github_app",
          provider: "github",
          name: name.trim() || "GitHub App",
          baseUrl: "https://github.com",
          credentials: {
            appId: appId.trim(),
            clientId: clientId.trim(),
            privateKeyPem,
          },
          webhookSecret: webhookSecret.trim(),
        }),
      });
      const body = await res.json();
      if (res.ok) {
        step = 2;
      } else {
        error = body.error ?? "Failed to connect provider";
      }
    } catch {
      error = "Failed to connect provider";
    } finally {
      submitting = false;
    }
  }

  function nextLabel(): string {
    if (step === 1) return "Connect";
    if (step === 2) return "Go to Git Sources";
    return "Continue";
  }

  function nextDisabled(): boolean {
    if (step === 0) return true;
    if (step === 1) return !canSubmit;
    return false;
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
        <Steps.CredentialsStep
          bind:name
          bind:appId
          bind:clientId
          bind:privateKeyPem
          bind:webhookSecret
          {error}
        />
      {:else if step === 2}
        <Steps.DoneStep {name} />
      {/if}
    </Wizard.Content>

    <Wizard.Footer
      nextLabel={nextLabel()}
      loading={step === 1 && submitting}
      nextDisabled={nextDisabled()}
      hideBack={step === 0 || step === 2}
      onnext={step === 1
        ? connect
        : step === 2
          ? () => goto(resolve("/git-sources"))
          : undefined}
      class="shrink-0"
    />
  </Wizard.Root>
</div>
