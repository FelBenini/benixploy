<script lang="ts">
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Badge } from "$lib/components/ui/badge";
  import * as Field from "$lib/components/ui/field/index.js";
  import { ArrowLeft } from "@lucide/svelte";
  import MethodCard from "./components/method-card.svelte";
  import ResultCard from "./components/result-card.svelte";

  let { data, form } = $props();

  type Connection = {
    id: string;
    provider: string;
    name: string;
    baseUrl: string;
    authKind: string;
    externalId: string | null;
  };

  type Outcome = {
    ok: boolean;
    method: string;
    result?: unknown;
    error?: string;
  };

  const connection = $derived(data.connection as Connection | null);
  const outcome = $derived(form as Outcome | null | undefined);

  function providerLabel(provider: string) {
    const labels: Record<string, string> = {
      github: "GitHub",
      gitlab: "GitLab",
      gitea: "Gitea",
      bitbucket: "Bitbucket",
    };
    return labels[provider] ?? provider;
  }
</script>

<svelte:head>
  <title>Validate Git provider — Benisploy</title>
</svelte:head>

<div class="flex flex-col md:p-6 p-3 gap-6">
  <div class="flex items-center gap-2">
    <Button variant="ghost" size="sm" href={resolve("/git-sources")}>
      <ArrowLeft data-icon="inline-start" />
      Git Sources
    </Button>
  </div>

  {#if !connection}
    <div
      class="flex flex-col items-center justify-center gap-3 rounded-xl bg-background/10 ring-1 ring-foreground/10 px-6 py-16 text-center"
    >
      <h2 class="text-foreground text-sm font-semibold">
        Connection not found
      </h2>
    </div>
  {:else}
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-foreground text-lg font-semibold">
          {connection.name}
        </h1>
        <p class="text-muted-foreground text-sm">{connection.baseUrl}</p>
      </div>
      <div class="flex items-center gap-2">
        <Badge variant="outline">{providerLabel(connection.provider)}</Badge>
        <Badge variant={connection.externalId ? "secondary" : "outline"}>
          {connection.externalId ? "installed" : "connected"}
        </Badge>
      </div>
    </div>

    <MethodCard
      title="verifyConnection"
      description="Signs the App JWT and calls GET /app to return the App name."
    >
      <form method="POST" action="?/verifyConnection">
        <Button type="submit">Run</Button>
      </form>
    </MethodCard>
    {#if outcome?.method === "verifyConnection"}
      <ResultCard title="verifyConnection" {outcome} />
    {/if}

    <MethodCard
      title="listRepositories"
      description="Exchanges the App JWT for an installation token and lists accessible repositories."
    >
      <form method="POST" action="?/listRepositories">
        <Button type="submit">Run</Button>
      </form>
    </MethodCard>
    {#if outcome?.method === "listRepositories"}
      <ResultCard title="listRepositories" {outcome} />
    {/if}

    <MethodCard
      title="getFileContent"
      description="Fetches and decodes a file from the repository."
    >
      <form method="POST" action="?/getFileContent" class="flex flex-col gap-3">
        <Field.FieldGroup>
          <Field.Field>
            <Field.FieldLabel for="gfc-repo">repoSlug</Field.FieldLabel>
            <Input id="gfc-repo" name="repoSlug" placeholder="owner/repo" />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="gfc-path">path</Field.FieldLabel>
            <Input id="gfc-path" name="path" placeholder="Dockerfile" />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="gfc-ref">ref (optional)</Field.FieldLabel>
            <Input id="gfc-ref" name="ref" placeholder="main" />
          </Field.Field>
        </Field.FieldGroup>
        <div>
          <Button type="submit">Run</Button>
        </div>
      </form>
    </MethodCard>
    {#if outcome?.method === "getFileContent"}
      <ResultCard title="getFileContent" {outcome} />
    {/if}

    <MethodCard
      title="getHeadSha"
      description="Returns the HEAD commit SHA of a branch."
    >
      <form method="POST" action="?/getHeadSha" class="flex flex-col gap-3">
        <Field.FieldGroup>
          <Field.Field>
            <Field.FieldLabel for="ghs-repo">repoSlug</Field.FieldLabel>
            <Input id="ghs-repo" name="repoSlug" placeholder="owner/repo" />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="ghs-branch">branch</Field.FieldLabel>
            <Input id="ghs-branch" name="branch" placeholder="main" />
          </Field.Field>
        </Field.FieldGroup>
        <div>
          <Button type="submit">Run</Button>
        </div>
      </form>
    </MethodCard>
    {#if outcome?.method === "getHeadSha"}
      <ResultCard title="getHeadSha" {outcome} />
    {/if}

    <MethodCard
      title="resolveCloneAuth"
      description="Builds an authenticated clone URL (token masked in the output)."
    >
      <form method="POST" action="?/resolveCloneAuth" class="flex flex-col gap-3">
        <Field.FieldGroup>
          <Field.Field>
            <Field.FieldLabel for="rca-repo">repoSlug</Field.FieldLabel>
            <Input id="rca-repo" name="repoSlug" placeholder="owner/repo" />
          </Field.Field>
        </Field.FieldGroup>
        <div>
          <Button type="submit">Run</Button>
        </div>
      </form>
    </MethodCard>
    {#if outcome?.method === "resolveCloneAuth"}
      <ResultCard title="resolveCloneAuth" {outcome} />
    {/if}

    <MethodCard
      title="verifyWebhookSignature"
      description="Verifies an HMAC-SHA256 signature over the raw webhook body."
    >
      <form method="POST" action="?/verifyWebhookSignature" class="flex flex-col gap-3">
        <Field.FieldGroup>
          <Field.Field>
            <Field.FieldLabel for="vws-body">raw body</Field.FieldLabel>
            <textarea
              id="vws-body"
              name="rawBody"
              rows={5}
              class="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full min-w-0 resize-y rounded border bg-transparent px-2.5 py-2 font-mono text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3"
              placeholder='&#123;"ref":"refs/heads/main","after":"abc123"&#125;'
            ></textarea>
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="vws-sig">signature (optional)</Field.FieldLabel>
            <Input
              id="vws-sig"
              name="signature"
              placeholder="sha256=... (leave empty to generate)"
            />
          </Field.Field>
        </Field.FieldGroup>
        <div>
          <Button type="submit">Run</Button>
        </div>
      </form>
    </MethodCard>
    {#if outcome?.method === "verifyWebhookSignature"}
      <ResultCard title="verifyWebhookSignature" {outcome} />
    {/if}

    <MethodCard
      title="parsePushEvent"
      description="Normalizes a push webhook payload into a NormalizedPush."
    >
      <form method="POST" action="?/parsePushEvent" class="flex flex-col gap-3">
        <Field.FieldGroup>
          <Field.Field>
            <Field.FieldLabel for="ppe-event">event</Field.FieldLabel>
            <Input id="ppe-event" name="event" placeholder="push" />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="ppe-body">raw body</Field.FieldLabel>
            <textarea
              id="ppe-body"
              name="rawBody"
              rows={8}
              class="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full min-w-0 resize-y rounded border bg-transparent px-2.5 py-2 font-mono text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3"
              placeholder='&#123;"ref":"refs/heads/main","after":"abc123","repository":&#123;"full_name":"owner/repo"&#125;&#125;'
            ></textarea>
          </Field.Field>
        </Field.FieldGroup>
        <div>
          <Button type="submit">Run</Button>
        </div>
      </form>
    </MethodCard>
    {#if outcome?.method === "parsePushEvent"}
      <ResultCard title="parsePushEvent" {outcome} />
    {/if}
  {/if}
</div>
