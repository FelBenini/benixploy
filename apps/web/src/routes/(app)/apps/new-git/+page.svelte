<script lang="ts">
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Badge } from "$lib/components/ui/badge";
  import * as Card from "$lib/components/ui/card";

  let { data } = $props();

  interface Repo {
    slug: string;
    defaultBranch: string;
    cloneUrl: string;
    isPrivate: boolean;
  }

  let connectionId = $state("");
  let repos = $state<Repo[]>([]);
  let reposLoading = $state(false);
  let reposError = $state<string | null>(null);

  let repoSlug = $state("");
  let branch = $state("");
  let name = $state("");
  let serverId = $state("");
  let port = $state("80");

  let creating = $state(false);
  let createError = $state<string | null>(null);
  let createdAppId = $state<string | null>(null);

  const selectedRepo = $derived(repos.find((r) => r.slug === repoSlug) ?? null);

  async function loadRepos(id: string) {
    connectionId = id;
    repos = [];
    repoSlug = "";
    branch = "";
    reposError = null;
    if (!id) return;

    reposLoading = true;
    try {
      const res = await fetch(`/api/git/connections/${id}/repositories`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to list repositories");
      }
      repos = body.data ?? [];
    } catch (err) {
      reposError =
        err instanceof Error ? err.message : "Failed to list repositories";
    } finally {
      reposLoading = false;
    }
  }

  function selectRepo(slug: string) {
    repoSlug = slug;
    const repo = repos.find((r) => r.slug === slug);
    if (repo) {
      if (!branch) branch = repo.defaultBranch;
      if (!name) name = repo.slug.split("/").pop() ?? "";
    }
  }

  async function create() {
    creating = true;
    createError = null;
    createdAppId = null;
    try {
      const res = await fetch("/api/apps/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          connectionId,
          repoSlug,
          branch: branch || undefined,
          name,
          port: parseInt(port) || 80,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to create app");
      }
      createdAppId = body.data.app.id;
    } catch (err) {
      createError = err instanceof Error ? err.message : "Failed to create app";
    } finally {
      creating = false;
    }
  }

  const canSubmit = $derived(
    !creating &&
      connectionId !== "" &&
      repoSlug !== "" &&
      name.trim() !== "" &&
      serverId !== "" &&
      port !== "",
  );
</script>

<svelte:head>
  <title>New Git App — Benisploy</title>
</svelte:head>

<div class="flex flex-col gap-6 p-3 md:p-6">
  <div>
    <h1 class="text-foreground text-lg font-semibold">New Git App</h1>
    <p class="text-muted-foreground text-sm">
      Pick a connected provider and repository. The first blue deploy runs
      immediately; later pushes deploy through the orchestrator.
    </p>
  </div>

  <Card.Root class="max-w-2xl">
    <Card.Header>
      <Card.Title>Repository</Card.Title>
      <Card.Description>
        Stateless app built from a root Dockerfile in the repo.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      {#if data.connections.length === 0}
        <p class="text-muted-foreground text-sm">
          No git providers connected. Connect one under
          <a class="text-blue-400 hover:underline" href={resolve("/git-sources")}
            >Git Sources</a
          >
          first.
        </p>
      {:else}
        <div class="flex flex-col gap-1.5">
          <label class="text-muted-foreground text-xs" for="connection">
            Provider connection
          </label>
          <select
            id="connection"
            class="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={connectionId}
            onchange={(e) => loadRepos(e.currentTarget.value)}
          >
            <option value="">Select a connection…</option>
            {#each data.connections as conn (conn.id)}
              <option value={conn.id}>
                {conn.name} ({conn.provider}){conn.installed ? "" : " — not installed"}
              </option>
            {/each}
          </select>
        </div>

        {#if reposLoading}
          <p class="text-muted-foreground text-sm">Loading repositories…</p>
        {/if}
        {#if reposError}
          <p class="text-destructive text-sm">{reposError}</p>
        {/if}

        {#if repos.length > 0}
          <div class="flex flex-col gap-1.5">
            <label class="text-muted-foreground text-xs" for="repo">
              Repository
            </label>
            <select
              id="repo"
              class="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={repoSlug}
              onchange={(e) => selectRepo(e.currentTarget.value)}
            >
              <option value="">Select a repository…</option>
              {#each repos as repo (repo.slug)}
                <option value={repo.slug}>
                  {repo.slug}{repo.isPrivate ? " (private)" : ""}
                </option>
              {/each}
            </select>
          </div>
        {/if}

        {#if selectedRepo}
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-muted-foreground text-xs" for="branch">
                Branch
              </label>
              <Input id="branch" bind:value={branch} />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-muted-foreground text-xs" for="name">
                App name
              </label>
              <Input id="name" bind:value={name} />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-muted-foreground text-xs" for="server">
                Server
              </label>
              <select
                id="server"
                class="border-input bg-background h-9 rounded-md border px-3 text-sm"
                bind:value={serverId}
              >
                <option value="">Select a server…</option>
                {#each data.servers as server (server.id)}
                  <option value={server.id}>
                    {server.name} ({server.status})
                  </option>
                {/each}
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-muted-foreground text-xs" for="port">
                Container port
              </label>
              <Input id="port" type="number" bind:value={port} />
            </div>
          </div>

          <div class="flex items-center gap-3">
            <Button disabled={!canSubmit} onclick={create}>
              {creating ? "Building and deploying…" : "Create app"}
            </Button>
            {#if selectedRepo}
              <span class="text-muted-foreground text-xs">
                {selectedRepo.cloneUrl}
              </span>
            {/if}
          </div>
        {/if}

        {#if createError}
          <p class="text-destructive text-sm">{createError}</p>
        {/if}
        {#if createdAppId}
          <div class="flex items-center gap-2 text-sm">
            <Badge class="bg-green-950/50 border-green-800 text-green-400">
              created
            </Badge>
            <span class="text-muted-foreground">
              First blue deploy finished.
            </span>
            <a
              class="text-blue-400 hover:underline"
              href={resolve(`/apps/${createdAppId}`)}
            >
              Open app
            </a>
            <a class="text-blue-400 hover:underline" href={resolve("/test-deploy")}>
              Trigger a push deploy →
            </a>
          </div>
        {/if}
      {/if}
    </Card.Content>
  </Card.Root>
</div>