<script lang="ts">
  import * as Field from "$lib/components/ui/field/index.js";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";

  let {
    accessMethod = $bindable(),
    sshUser = $bindable(),
    privateKey = $bindable(),
    password = $bindable(),
  }: {
    accessMethod: "key" | "password";
    sshUser: string;
    privateKey: string;
    password: string;
  } = $props();
</script>

<Field.FieldGroup>
  <Field.Field>
    <Field.FieldLabel>Access method</Field.FieldLabel>
    <div class="flex gap-2">
      <Button
        type="button"
        variant={accessMethod === "key" ? "default" : "outline"}
        onclick={() => (accessMethod = "key")}
      >
        SSH key
      </Button>
      <Button
        type="button"
        variant={accessMethod === "password" ? "default" : "outline"}
        onclick={() => (accessMethod = "password")}
      >
        Password
      </Button>
    </div>
    <Field.FieldDescription>
      Used only during the one-time setup and never stored.
    </Field.FieldDescription>
  </Field.Field>

  <Field.Field>
    <Field.FieldLabel for="access-user">SSH user</Field.FieldLabel>
    <Input
      id="access-user"
      type="text"
      bind:value={sshUser}
      placeholder="root"
    />
    <Field.FieldDescription>
      The user Benisploy will connect as during setup.
    </Field.FieldDescription>
  </Field.Field>

  {#if accessMethod === "key"}
    <Field.Field>
      <Field.FieldLabel for="access-key">Private key</Field.FieldLabel>
      <textarea
        id="access-key"
        bind:value={privateKey}
        placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
        class="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-32 w-full min-w-0 resize-y rounded border bg-transparent px-2.5 py-2 font-mono text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3"
        required
      ></textarea>
      <Field.FieldDescription>
        Paste the private key that can log in to the machine.
      </Field.FieldDescription>
    </Field.Field>
  {:else}
    <Field.Field>
      <Field.FieldLabel for="access-password">Password</Field.FieldLabel>
      <Input
        id="access-password"
        type="password"
        bind:value={password}
        placeholder="••••••••"
        autocomplete="current-password"
        required
      />
      <Field.FieldDescription>
        The password of the SSH user above.
      </Field.FieldDescription>
    </Field.Field>
  {/if}
</Field.FieldGroup>