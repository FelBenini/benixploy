<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import * as Wizard from "$lib/components/ui/wizard/index.js";
  import * as Field from "$lib/components/ui/field/index.js";
  import { Input } from "$lib/components/ui/input";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import User from "@lucide/svelte/icons/user";
  import Key from "@lucide/svelte/icons/key";
  import CheckCircle from "@lucide/svelte/icons/check-circle";
  import BackgroundGrid from "$lib/components/ui/background-grid.svelte";
  import type { WizardStep } from "$lib/components/ui/wizard/index.js";

  const steps: WizardStep[] = [
    {
      title: "Welcome",
      description:
        "Let's get your deployment platform set up in just a few steps.",
      icon: Sparkles,
    },
    {
      title: "Account",
      description:
        "Create your administrator account. This user will have full access.",
      icon: User,
    },
    {
      title: "Credentials",
      description:
        "Set up the email and password you'll use to sign in to Benisploy.",
      icon: Key,
    },
    {
      title: "Confirm",
      description: "Review your details before creating the instance.",
      icon: CheckCircle,
    },
  ];

  let step = $state(0);
  let username = $state("");
  let email = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let error = $state("");
  let loading = $state(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  let validStep1 = $derived(username.trim().length > 0);
  let validStep2 = $derived(
    emailRegex.test(email) &&
      password.length >= 8 &&
      confirmPassword === password,
  );

  function stepValid(): boolean {
    if (step === 0) return true;
    if (step === 1) return validStep1;
    if (step === 2) return validStep2;
    if (step === 3) return true;
    return false;
  }

  async function handleSetup() {
    loading = true;
    error = "";
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
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

  function nextLabelForStep(s: number): string {
    if (s === 2) return "Review";
    if (s === 3) return "Create account";
    return "Continue";
  }
</script>

<svelte:head>
  <title>Set up — Benisploy</title>
</svelte:head>

<div
  class="relative flex min-h-svh items-center w-full justify-center overflow-hidden bg-[linear-gradient(to_bottom,var(--background)_50%,transparent),linear-gradient(to_right,#EF0A8620,#ff690020)]"
>
  <BackgroundGrid />
  <Wizard.Root {steps} bind:step class="w-full max-w-md mx-4">
    <Wizard.Header />
    <Wizard.Steps />

    <Wizard.Content>
      {#if step === 0}
        <p class="text-muted-foreground text-sm text-center mt-[20%]">
          <em class="font-bold">Benisploy</em> helps you deploy and manage applications
          across your servers with ease. The first user you create will be the system
          administrator.
        </p>
      {:else if step === 1}
        <Field.FieldGroup>
          <Field.Field>
            <Field.FieldLabel for="setup-username">Username</Field.FieldLabel>
            <Input
              id="setup-username"
              type="text"
              bind:value={username}
              autocomplete="username"
              placeholder="Your username"
              required
            />
            <Field.FieldDescription>
              Choose a unique username for your admin account.
            </Field.FieldDescription>
          </Field.Field>
        </Field.FieldGroup>
      {:else if step === 2}
        <Field.FieldGroup>
          <Field.Field>
            <Field.FieldLabel for="setup-email">Email</Field.FieldLabel>
            <Input
              id="setup-email"
              type="email"
              bind:value={email}
              autocomplete="email"
              placeholder="you@example.com"
              required
            />
          </Field.Field>

          <Field.Field>
            <Field.FieldLabel for="setup-password">Password</Field.FieldLabel>
            <Input
              id="setup-password"
              type="password"
              bind:value={password}
              autocomplete="new-password"
              placeholder="At least 8 characters"
              required
              minlength={8}
            />
          </Field.Field>

          <Field.Field>
            <Field.FieldLabel for="setup-confirm">
              Confirm password
            </Field.FieldLabel>
            <Input
              id="setup-confirm"
              type="password"
              bind:value={confirmPassword}
              autocomplete="new-password"
              placeholder="Re-enter your password"
              required
              minlength={8}
            />
            {#if confirmPassword && confirmPassword !== password}
              <Field.FieldDescription class="text-destructive">
                Passwords do not match.
              </Field.FieldDescription>
            {/if}
          </Field.Field>
        </Field.FieldGroup>
      {:else if step === 3}
        <div class="flex flex-col gap-3 py-4">
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-muted-foreground">Username</span>
            <span class="text-sm font-medium">{username}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-muted-foreground">Email</span>
            <span class="text-sm font-medium">{email}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-muted-foreground">Password</span>
            <span class="text-sm font-medium"
              >{"\u2022".repeat(password.length)}</span
            >
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            A default organization will be created for you.
          </p>
        </div>
      {/if}

      {#if error}
        <p class="mt-4 text-sm text-destructive">{error}</p>
      {/if}
    </Wizard.Content>

    <Wizard.Footer
      nextLabel={nextLabelForStep(step)}
      loading={step === 3 ? loading : false}
      nextDisabled={!stepValid()}
      onnext={step === 3 ? handleSetup : undefined}
    />
  </Wizard.Root>
</div>
