<script lang="ts">
  import * as Field from "$lib/components/ui/field/index.js";
  import { Input } from "$lib/components/ui/input";

  let {
    name = $bindable(),
    appId = $bindable(),
    clientId = $bindable(),
    privateKeyPem = $bindable(),
    webhookSecret = $bindable(),
    error = "",
  }: {
    name: string;
    appId: string;
    clientId: string;
    privateKeyPem: string;
    webhookSecret: string;
    error: string;
  } = $props();
</script>

<Field.FieldGroup>
  <Field.Field>
    <Field.FieldLabel for="gc-name">Name</Field.FieldLabel>
    <Input
      id="gc-name"
      type="text"
      bind:value={name}
      placeholder="GitHub App"
    />
    <Field.FieldDescription>
      A label to identify this connection.
    </Field.FieldDescription>
  </Field.Field>

  <Field.Field>
    <Field.FieldLabel for="gc-app-id">App ID</Field.FieldLabel>
    <Input
      id="gc-app-id"
      type="text"
      bind:value={appId}
      placeholder="123456"
      required
    />
  </Field.Field>

  <Field.Field>
    <Field.FieldLabel for="gc-client-id">Client ID</Field.FieldLabel>
    <Input
      id="gc-client-id"
      type="text"
      bind:value={clientId}
      placeholder="Iv1.xxxxxxxxxxxxxxxx"
      required
    />
  </Field.Field>

  <Field.Field>
    <Field.FieldLabel for="gc-pem">Private key (PEM)</Field.FieldLabel>
    <textarea
      id="gc-pem"
      bind:value={privateKeyPem}
      placeholder="-----BEGIN RSA PRIVATE KEY-----"
      required
      class="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-32 w-full min-w-0 resize-y rounded border bg-transparent px-2.5 py-2 font-mono text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3"
    ></textarea>
    <Field.FieldDescription>
      The private key of your GitHub App.
    </Field.FieldDescription>
  </Field.Field>

  <Field.Field>
    <Field.FieldLabel for="gc-secret">Webhook secret</Field.FieldLabel>
    <Input
      id="gc-secret"
      type="text"
      bind:value={webhookSecret}
      placeholder="a shared HMAC secret"
      required
    />
    <Field.FieldDescription>
      Shared secret used to verify incoming webhook deliveries.
    </Field.FieldDescription>
  </Field.Field>

  {#if error}
    <p class="text-destructive text-sm">{error}</p>
  {/if}
</Field.FieldGroup>
