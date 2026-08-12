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
  import Button from "$lib/components/ui/button/button.svelte";
  import type { WizardStep } from "$lib/components/ui/wizard/index.js";
  import { ArrowLeft } from "@lucide/svelte";

  interface KnownErrorItem {
    diagnostic: string;
    solutions: string[];
  }

  interface ResumeServer {
    id: string;
    name: string;
    address: string;
    sshPort: number;
    sshUser: string;
    status: string;
  }

  const steps: WizardStep[] = [
    {
      title: "Setup",
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

  let { data } = $props();
  let step = $state(0);
  let name = $state("");
  let address = $state("");
  let sshPort = $state("22");
  let sshUser = $state("root");
  let accessMethod = $state<"key" | "password">("key");
  let privateKey = $state("");
  let password = $state("");
  let error = $state("");
  let knownErrors = $state<KnownErrorItem[]>([]);

  let installState = $state<"idle" | "running" | "done" | "error">("idle");
  let activePhase = $state(-1);
  let completedPhases = $state(0);
  let failedPhase = $state(-1);
  let createdServer = $state<{
    id: string;
    name: string;
    address: string;
    status: string;
  } | null>(null);

  let provisioningServerId = $state<string | null>(null);
  let resumed = $state(false);
  let hasAppliedResume = false;

  $effect(() => {
    const rs = data?.resumeServer as ResumeServer | null;
    if (!rs || rs.status !== "provisioning" || hasAppliedResume) return;
    hasAppliedResume = true;

    name = rs.name;
    address = rs.address;
    sshPort = String(rs.sshPort);
    sshUser = rs.sshUser;
    provisioningServerId = rs.id;
    createdServer = {
      id: rs.id,
      name: rs.name,
      address: rs.address,
      status: rs.status,
    };
    resumed = true;
    step = 2;
  });

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

  async function updateServer(): Promise<void> {
    if (!provisioningServerId) return;
    const res = await fetch(`/api/servers/${provisioningServerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        address: address.trim(),
        sshPort: Number(sshPort),
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(
        (body as { error?: string }).error ?? "Failed to update server",
      );
    }
    const body = await res.json();
    const s = body.data;
    createdServer = {
      id: s.id,
      name: s.name,
      address: s.address,
      status: s.status,
    };
  }

  async function startInstall() {
    error = "";
    knownErrors = [];
    installState = "running";
    activePhase = -1;
    completedPhases = 0;
    failedPhase = -1;

    try {
      if (!provisioningServerId) {
        createdServer = await createServer();
        provisioningServerId = createdServer.id;
      } else {
        await updateServer();
      }
      await runProvisioning(provisioningServerId);
      activePhase = -1;
      installState = "done";
    } catch (err) {
      activePhase = -1;
      installState = "error";
      error = err instanceof Error ? err.message : "Installation failed";
    }
  }

  async function runProvisioning(serverId: string) {
    const response = await fetch(`/api/servers/${serverId}/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessMethod,
        sshUser: sshUser.trim() || "root",
        privateKey: accessMethod === "key" ? privateKey : undefined,
        password: accessMethod === "password" ? password : undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? "Provisioning failed",
      );
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop()!;

      for (const raw of events) {
        const lines = raw.split("\n");
        let eventType = "";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) eventType = line.slice(7);
          if (line.startsWith("data: ")) data = line.slice(6);
        }
        if (!data) continue;

        const parsed: Record<string, unknown> = JSON.parse(data);

        if (eventType === "phase") {
          const phaseIdx = parsed.phase as number;
          if (parsed.status === "active") {
            activePhase = phaseIdx;
          } else if (parsed.status === "done") {
            completedPhases = Math.max(completedPhases, phaseIdx + 1);
            if (phaseIdx + 1 < installPhases.length) {
              activePhase = phaseIdx + 1;
            }
          } else if (parsed.status === "error") {
            failedPhase = phaseIdx;
            throw new Error(
              (parsed.error as string) ?? `Phase ${phaseIdx} failed`,
            );
          }
        } else if (eventType === "error") {
          const phaseIdx = (parsed.phase as number) ?? -1;
          if (phaseIdx >= 0) failedPhase = phaseIdx;
          knownErrors = (parsed.knownErrors as KnownErrorItem[]) ?? [];
          throw new Error((parsed.message as string) ?? "Provisioning failed");
        }
      }
    }
  }

  $effect(() => {
    if (step === 3 && installState === "idle") {
      startInstall();
    }
  });

  function nextLabel(): string {
    if (step === 3) {
      return installState !== "done" ? "Installing…" : "Continue";
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
  <title>{resumed ? "Continue setup" : "Add server"} — Benisploy</title>
</svelte:head>

<div class="flex w-full justify-center h-full">
  <Wizard.Root
    {steps}
    bind:step
    class="flex h-full w-full max-w-xl flex-col ring-0 relative rounded mx-auto border-none outline-none bg-none"
  >
    <Button variant="outline" class="absolute top-6 left-6" href="/servers"
      ><ArrowLeft />Servers</Button
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
        <Steps.ServerDetails bind:name bind:address bind:sshPort />
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
          {failedPhase}
          {error}
          {knownErrors}
          onRetry={startInstall}
        />
      {:else if step === 4}
        <Steps.DoneStep {createdServer} {name} {address} {sshPort} {sshUser} />
      {/if}
    </Wizard.Content>

    <Wizard.Footer
      nextLabel={nextLabel()}
      loading={step === 3 && installState === "running"}
      nextDisabled={nextDisabled()}
      hideBack={step === 0 ||
        (step === 3 && installState === "running") ||
        step === 4}
      onnext={step === 4 ? () => goto(resolve("/servers")) : undefined}
      class="shrink-0"
    />
  </Wizard.Root>
</div>
