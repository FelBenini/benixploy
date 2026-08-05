<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import * as Wizard from "$lib/components/ui/wizard/index.js";
  import * as Steps from "./components/index.js";
  import Globe from "@lucide/svelte/icons/globe";
  import Server from "@lucide/svelte/icons/server";
  import Key from "@lucide/svelte/icons/key";
  import Terminal from "@lucide/svelte/icons/terminal";
  import CheckCircle from "@lucide/svelte/icons/check-circle";
  import type { WizardStep } from "$lib/components/ui/wizard/index.js";

  const steps: WizardStep[] = [
    {
      title: "New Server",
      description: "Choose where Benisploy should be installed.",
      icon: Globe,
    },
    {
      title: "Details",
      description: "Tell us about the machine you want Benisploy to manage.",
      icon: Server,
    },
    {
      title: "Access",
      description: "How should Benisploy reach it for the one-time setup?",
      icon: Key,
    },
    {
      title: "Installing",
      description: "Provisioning Docker, SSH access and the node monitor.",
      icon: Terminal,
    },
    {
      title: "Done",
      description: "Your server is ready to run apps.",
      icon: CheckCircle,
    },
  ];

  const installPhases = [
    "Connecting to server",
    "Detecting hardware specs",
    "Installing Docker",
    "Creating benisploy user",
    "Configuring SSH forced-command",
    "Uploading exec-command.sh",
    "Installing node monitor",
    "Starting monitor service",
    "Verifying heartbeat",
  ];

  let step = $state(0);
  let name = $state("");
  let address = $state("");
  let sshPort = $state("22");
  let sshUser = $state("root");
  let accessMethod = $state<"key" | "password">("key");
  let privateKey = $state("");
  let password = $state("");
  let error = $state("");

  let installState = $state<"idle" | "running" | "done" | "error">("idle");
  let activePhase = $state(-1);
  let completedPhases = $state(0);
  let createdServer = $state<{
    id: string;
    name: string;
    address: string;
    status: string;
  } | null>(null);

  const portValid = $derived(
    /^\d+$/.test(sshPort) && Number(sshPort) >= 1 && Number(sshPort) <= 65535,
  );
  const validDetails = $derived(
    name.trim().length > 0 && address.trim().length > 0 && portValid,
  );
  const validAccess = $derived(
    sshUser.trim().length > 0 &&
      (accessMethod === "key"
        ? privateKey.trim().length > 0
        : password.length > 0),
  );

  function chooseLocalhost() {
    name = "localhost";
    address = "localhost";
    sshPort = "22";
    step = 2;
  }

  function chooseExternal() {
    step = 1;
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function createServer(): Promise<{
    id: string;
    name: string;
    address: string;
    status: string;
  }> {
    const res = await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        address: address.trim(),
        sshPort: Number(sshPort),
        sshUser: sshUser.trim() || "root",
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error ?? "Failed to create server");
    }
    const s = body.data;
    return { id: s.id, name: s.name, address: s.address, status: s.status };
  }

  async function startInstall() {
    error = "";
    installState = "running";
    activePhase = -1;
    completedPhases = 0;
    createdServer = null;

    try {
      createdServer = await createServer();
      for (const phase of installPhases) {
        activePhase = installPhases.indexOf(phase);
        await sleep(700);
        completedPhases++;
      }
      activePhase = -1;
      installState = "done";
    } catch (err) {
      activePhase = -1;
      installState = "error";
      error = err instanceof Error ? err.message : "Installation failed";
    }
  }

  $effect(() => {
    if (step === 3 && installState === "idle") {
      startInstall();
    }
  });

  function nextLabel(): string {
    if (step === 3) {
      return installState === "done" ? "Continue" : "Installing…";
    }
    if (step === 4) return "Go to Servers";
    if (step === 2) return "Install";
    return "Continue";
  }

  function nextDisabled(): boolean {
    if (step === 0) return true;
    if (step === 1) return !validDetails;
    if (step === 2) return !validAccess;
    if (step === 3) return installState !== "done";
    return false;
  }
</script>

<svelte:head>
  <title>Add server — Benisploy</title>
</svelte:head>

<div class="flex w-full justify-center h-full">
  <Wizard.Root
    {steps}
    bind:step
    class="flex h-full w-full max-w-xl flex-col ring-0 rounded mx-auto border-none outline-none bg-none"
  >
    <Wizard.Header />
    <Wizard.Steps />

    <Wizard.Content class="h-auto min-h-0 flex-1 overflow-y-auto">
      {#if step === 0}
        <Steps.WhereStep
          onLocalhost={chooseLocalhost}
          onExternal={chooseExternal}
        />
      {:else if step === 1}
        <Steps.ServerDetails
          bind:name
          bind:address
          bind:sshPort
        />
      {:else if step === 2}
        <Steps.InitialAccess
          bind:accessMethod
          bind:sshUser
          bind:privateKey
          bind:password
        />
      {:else if step === 3}
        <Steps.InstallPhases
          phases={installPhases}
          {installState}
          {activePhase}
          {completedPhases}
          {error}
          onRetry={startInstall}
        />
      {:else if step === 4}
        <Steps.DoneStep
          {createdServer}
          {name}
          {address}
          {sshPort}
          {sshUser}
        />
      {/if}
    </Wizard.Content>

    <Wizard.Footer
      nextLabel={nextLabel()}
      loading={step === 3 && installState === "running"}
      nextDisabled={nextDisabled()}
      hideBack={step === 0 || step === 3 || step === 4}
      onnext={step === 4 ? () => goto(resolve("/servers")) : undefined}
      class="shrink-0"
    />
  </Wizard.Root>
</div>
