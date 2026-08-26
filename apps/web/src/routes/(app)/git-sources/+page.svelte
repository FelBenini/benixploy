<script lang="ts">
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import * as Card from "$lib/components/ui/card";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";

  let { data } = $props();

  type Connection = {
    id: string;
    provider: string;
    name: string;
    baseUrl: string;
    authKind: string;
    externalId: string | null;
    installUrl: string | null;
    createdAt: string;
  };

  function initialConnections() {
    return data.connections ?? [];
  }

  let connections = $state<Connection[]>(initialConnections());
  let removing = $state<string | null>(null);
  let confirmId = $state<string | null>(null);
  let error = $state<string | null>(null);

  let installedNotice = $derived(data.installed as string | null);

  const providerLogos: Record<string, string> = {
    github: "/git/github.png",
    gitlab: "/git/gitlab.png",
    gitea: "/git/gitea.png",
    bitbucket: "/git/bitbucket.png",
  };

  function providerLogo(provider: string) {
    return providerLogos[provider] ?? "/git/github.png";
  }

  function providerLabel(provider: string) {
    const labels: Record<string, string> = {
      github: "GitHub",
      gitlab: "GitLab",
      gitea: "Gitea",
      bitbucket: "Bitbucket",
    };
    return labels[provider] ?? provider;
  }

  async function removeConnection(id: string) {
    removing = id;
    error = null;
    try {
      const res = await fetch(`/api/git/connections/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        connections = connections.filter((c) => c.id !== id);
      } else {
        const body = await res.json();
        error = body.error ?? "Failed to remove connection";
      }
    } catch {
      error = "Failed to remove connection";
    } finally {
      removing = null;
      confirmId = null;
    }
  }
</script>

<svelte:head>
  <title>Git Sources — Benisploy</title>
</svelte:head>

<div class="flex flex-col md:p-6 p-3 gap-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-foreground text-lg font-semibold">Git Sources</h1>
      <p class="text-muted-foreground text-sm">
        Connect a Git provider to deploy apps on push.
      </p>
    </div>
    {#if connections.length > 0}
      <Button href={resolve("/git-sources/new")}>
        <Plus data-icon="inline-start" />
        Connect a Git provider
      </Button>
    {/if}
  </div>

  {#if error}
    <p class="text-destructive text-sm">{error}</p>
  {/if}

  {#if installedNotice === "ok"}
    <p class="text-emerald-600 text-sm">
      GitHub App installed. The connection is now ready to use.
    </p>
  {:else if installedNotice === "pending"}
    <p class="text-amber-600 text-sm">
      Installation requested — an organization admin needs to approve it.
    </p>
  {:else if installedNotice === "error"}
    <p class="text-destructive text-sm">
      Installation could not be completed. Please try again.
    </p>
  {/if}

  {#if connections.length === 0}
    <div
      class="flex flex-col items-center justify-center gap-3 rounded-xl bg-background/10 backdrop-blur-sm ring-1 ring-foreground/10 px-6 py-16 text-center"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-md bg-muted/50 text-muted-foreground"
      >
        <GitBranch class="size-6" />
      </div>
      <div>
        <h2 class="text-foreground text-sm font-semibold">
          No Git providers connected
        </h2>
        <p class="text-muted-foreground mt-1 text-sm max-w-sm">
          Connect GitHub, GitLab, Gitea, or Bitbucket to enable push-to-deploy.
        </p>
      </div>
      <Button href={resolve("/git-sources/new")} class="mt-2">
        <Plus data-icon="inline-start" />
        Connect a Git provider
      </Button>
    </div>
  {:else}
    <div class="grid gap-3">
      {#each connections as conn (conn.id)}
        <Card.Root>
          <Card.Content class="flex items-center justify-between gap-4 py-1">
            <div class="flex items-center gap-3">
              <div
                class="flex size-10 items-center justify-center rounded-md bg-muted/50 text-muted-foreground"
              >
                <img
                  src={providerLogo(conn.provider)}
                  class="size-6 rounded-full object-contain"
                  alt={`${providerLabel(conn.provider)} logo`}
                />
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="text-foreground text-sm font-medium">
                    {conn.name}
                  </span>
                  <Badge variant="outline">{providerLabel(conn.provider)}</Badge
                  >
                </div>
                <span class="text-muted-foreground text-xs">
                  {conn.baseUrl}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Badge variant={conn.externalId ? "secondary" : "outline"}>
                {conn.externalId ? "installed" : "connected"}
              </Badge>
              {#if !conn.externalId && conn.installUrl}
                <Button variant="secondary" size="sm" href={conn.installUrl}>
                  Install on GitHub
                </Button>
              {/if}
              <Button
                variant="ghost"
                size="sm"
                href={resolve(`/git-sources/${conn.id}`)}
              >
                Validate
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled
                title="Rotate secret (coming soon)"
              >
                <RotateCw class="size-4" />
              </Button>
              {#if confirmId === conn.id}
                <Button
                  variant="destructive"
                  size="sm"
                  onclick={() => removeConnection(conn.id)}
                  disabled={removing === conn.id}
                >
                  <Trash2 data-icon="inline-start" />
                  Confirm
                </Button>
              {:else}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onclick={() => (confirmId = conn.id)}
                  title="Remove connection"
                >
                  <Trash2 class="size-4" />
                </Button>
              {/if}
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {/if}
</div>
