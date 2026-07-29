<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { cn } from "$lib/utils.js";

  let deploying = $state(false);
  let deployResult = $state<unknown>(null);
  let deployError = $state<string | null>(null);
  let deployLogs = $state<
    Array<{ timestamp: string; stream: string; message: string }>
  >([]);
  let deployStatus = $state<string | null>(null);

  let appName = $state("test-app");
  let dockerImage = $state("nginx:alpine");
  let containerPort = $state("80");
  let envKey = $state("");
  let envVal = $state("");
  let envVars = $state<Record<string, string>>({});

  let servers = $state<Array<{ id: string; name: string; status: string }>>([]);

  async function loadServers() {
    try {
      const res = await fetch("/api/servers");
      if (res.ok) {
        const body = await res.json();
        servers = body.data ?? [];
      }
    } catch {
      // silently fail
    }
  }

  loadServers();

  async function deploy() {
    deploying = true;
    deployError = null;
    deployResult = null;
    deployLogs = [];
    deployStatus = null;

    const first = servers[0];
    if (!first) {
      deployError = "No servers registered. Add a server first.";
      deploying = false;
      return;
    }

    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: first.id,
          appSpec: {
            name: appName || "test-app",
            image: dockerImage || "nginx:alpine",
            ports: containerPort
              ? [{ container: parseInt(containerPort), protocol: "tcp" }]
              : [],
            envVars,
          },
        }),
      });

      const body = await res.json();
      if (res.ok) {
        deployResult = body.data;
        const depId = body.data.deployment?.id;
        if (depId) {
          subscribeToDeploymentLogs(depId);
        }
      } else {
        deployError = body.error ?? "Unknown error";
        deploying = false;
      }
    } catch (err) {
      deployError = err instanceof Error ? err.message : "Request failed";
      deploying = false;
    }
  }

  function subscribeToDeploymentLogs(deploymentId: string) {
    const evtSource = new EventSource(
      `/api/deployments/${deploymentId}/events`,
    );

    evtSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "log") {
          deployLogs = [...deployLogs, parsed.entry];
        } else if (parsed.type === "complete") {
          deployStatus = parsed.result.success ? "healthy" : "failed";
          if (parsed.result.error) {
            deployError = parsed.result.error;
          }
          deploying = false;
          evtSource.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    evtSource.onerror = () => {
      deployStatus = "disconnected";
      deploying = false;
      evtSource.close();
    };
  }

  function addEnvVar() {
    if (!envKey.trim()) return;
    envVars = { ...envVars, [envKey.trim()]: envVal };
    envKey = "";
    envVal = "";
  }

  function removeEnvVar(key: string) {
    const next = { ...envVars };
    delete next[key];
    envVars = next;
  }

  let logContainer = $state<HTMLDivElement | null>(null);
  $effect(() => {
    if (deployLogs.length && logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  });
</script>

<svelte:head>
  <title>Dashboard — Benisploy</title>
</svelte:head>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-foreground text-lg font-semibold">Test Deployment</h1>
    <p class="text-muted-foreground text-sm">
      Deploys to <strong>{servers[0]?.name ?? "—"}</strong>
      {#if servers.length === 0}
        <em>(no servers found — register one first via POST /api/servers)</em>
      {/if}
    </p>
  </div>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      deploy();
    }}
    class="flex flex-col gap-4"
  >
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium" for="app-name">App name</label>
      <Input id="app-name" bind:value={appName} placeholder="my-app" />
    </div>

    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium" for="docker-image">Docker image</label>
      <Input
        id="docker-image"
        bind:value={dockerImage}
        placeholder="nginx:alpine"
      />
    </div>

    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium" for="container-port"
        >Container port</label
      >
      <Input
        id="container-port"
        type="number"
        bind:value={containerPort}
        placeholder="80"
      />
    </div>

    <fieldset class="border border-border rounded-lg p-4 flex flex-col gap-2">
      <legend class="text-sm font-medium px-1"
        >Environment variables (optional)</legend
      >

      <div class="flex gap-2 items-end">
        <div class="flex flex-col gap-1 flex-1">
          <Input bind:value={envKey} placeholder="KEY" />
        </div>
        <div class="flex flex-col gap-1 flex-1">
          <Input bind:value={envVal} placeholder="value" />
        </div>
        <Button type="button" variant="ghost" onclick={addEnvVar}>Add</Button>
      </div>

      {#each Object.entries(envVars) as [key, val] (key)}
        <div class="flex gap-2 items-center">
          <code class="text-sm text-muted-foreground">{key}</code>
          <span class="text-muted-foreground">=</span>
          <code class="text-sm text-muted-foreground">{val}</code>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onclick={() => removeEnvVar(key)}>✕</Button
          >
        </div>
      {/each}
    </fieldset>

    <Button type="submit" disabled={deploying || servers.length === 0}>
      {deploying ? "Deploying…" : "Deploy"}
    </Button>
  </form>

  {#if deployLogs.length > 0}
    <div
      class="bg-[#1e1e2e] text-[#cdd6f4] font-mono text-xs leading-relaxed p-3 rounded-lg max-h-96 overflow-y-auto"
      bind:this={logContainer}
    >
      {#each deployLogs as log (log.timestamp + log.message)}
        <div
          class="flex gap-2 whitespace-pre-wrap break-all"
          class:text-[#f38ba8]={log.stream === "stderr"}
        >
          <span class="shrink-0 w-10 text-[#6c7086] select-none">
            {log.stream === "stderr" ? "ERR" : "OUT"}
          </span>
          <span class="flex-1">{log.message}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if deployStatus}
    <div
      class={cn(
        "p-4 rounded-lg border",
        deployStatus === "healthy"
          ? "bg-green-950/50 border-green-800"
          : "bg-red-950/50 border-red-800",
      )}
    >
      <h3 class="font-semibold text-sm">
        {deployStatus === "healthy" ? "Deploy succeeded" : "Deploy failed"}
      </h3>
    </div>
  {/if}

  {#if deployError && !deployLogs.length}
    <div class="bg-red-950/50 border-red-800 p-4 rounded-lg border">
      <h3 class="font-semibold text-sm">Error</h3>
      <pre class="mt-2 text-xs text-muted-foreground">{deployError}</pre>
    </div>
  {/if}

  {#if deployResult && !deployLogs.length}
    <div class="bg-green-950/50 border-green-800 p-4 rounded-lg border">
      <h3 class="font-semibold text-sm">Deploy started</h3>
      <pre class="mt-2 text-xs text-muted-foreground">{JSON.stringify(
          deployResult,
          null,
          2,
        )}</pre>
    </div>
  {/if}
</div>
