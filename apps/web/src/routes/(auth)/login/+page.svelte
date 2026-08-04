<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import * as Field from "$lib/components/ui/field/index.js";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import BackgroundGrid from "$lib/components/ui/background-grid.svelte";
  import LogIn from "@lucide/svelte/icons/log-in";

  let email = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";
    loading = true;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json();
        error = body.error ?? "Something went wrong";
        return;
      }
      goto(resolve("/"));
    } catch {
      error = "Network error";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in — Benisploy</title>
</svelte:head>

<div
  class="flex flex-col h-screen w-full items-center justify-center overflow-hidden bg-[linear-gradient(to_bottom,var(--background)_50%,transparent),linear-gradient(to_right,#EF0A8620,#ff690020)]"
>
  <BackgroundGrid />
  <img src="/logo.svg" alt="benisploy" class="mx-auto mb-[-4rem]" />
  <div
    class="z-10 mx-auto w-[calc(100%-2rem)] max-w-md rounded-md bg-background/10 shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm bg-[radial-gradient(circle_at_top_left,_#EF0A8610_0%,_transparent_50%),radial-gradient(circle_at_bottom_right,_#f0fdfa10_0%,_transparent_50%)]"
  >
    <div class="flex flex-col items-center gap-4 p-6 pb-0">
      <div
        class="rounded-md bg-gradient-to-br from-white/30 via-accent to-border p-px shadow-md"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-[calc(theme(borderRadius.md)-1px)] bg-gradient-to-br from-accent to-background"
        >
          <LogIn class="text-foreground/80" />
        </div>
      </div>
      <p class="text-muted-foreground text-center text-sm">
        Sign in to your account
      </p>
    </div>

    <form onsubmit={handleSubmit} class="flex flex-col gap-4 p-6">
      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}

      <Field.FieldGroup>
        <Field.Field>
          <Field.FieldLabel for="email">Email</Field.FieldLabel>
          <Input
            id="email"
            type="email"
            bind:value={email}
            required
            autocomplete="email"
            placeholder="you@example.com"
          />
        </Field.Field>

        <Field.Field>
          <Field.FieldLabel for="password">Password</Field.FieldLabel>
          <Input
            id="password"
            type="password"
            bind:value={password}
            required
            autocomplete="current-password"
            placeholder="Enter your password"
          />
        </Field.Field>
      </Field.FieldGroup>

      <Button
        type="submit"
        size="lg"
        disabled={loading}
        class="mt-4 w-full rounded py-5"
      >
        {#if loading}
          Please wait…
        {:else}
          Sign in
        {/if}
      </Button>
    </form>
  </div>
</div>
