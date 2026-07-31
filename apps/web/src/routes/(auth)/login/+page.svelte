<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";

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

<div class="flex items-center justify-center min-h-svh bg-background">
  <div class="bg-card text-card-foreground rounded-xl border border-border shadow-sm w-full max-w-md p-8 mx-4">
    <div class="flex flex-col gap-1.5 mb-6">
      <h1 class="text-foreground text-2xl font-semibold">Benisploy</h1>
      <p class="text-muted-foreground text-sm">
        Sign in to your account
      </p>
    </div>

    {#if error}
      <div class="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg px-4 py-3 text-sm mb-6">
        {error}
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="email" class="text-foreground text-sm font-medium">Email</label>
        <Input
          id="email"
          type="email"
          bind:value={email}
          required
          autocomplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="password" class="text-foreground text-sm font-medium">Password</label>
        <Input
          id="password"
          type="password"
          bind:value={password}
          required
          autocomplete="current-password"
          placeholder="Enter your password"
        />
      </div>

      <Button type="submit" disabled={loading} class="mt-2 w-full">
        {#if loading}
          Please wait…
        {:else}
          Sign in
        {/if}
      </Button>
    </form>
  </div>
</div>
