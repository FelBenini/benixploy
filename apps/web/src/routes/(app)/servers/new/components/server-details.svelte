<script lang="ts">
  import * as Field from "$lib/components/ui/field/index.js";
  import { Input } from "$lib/components/ui/input";

  let {
    name = $bindable(),
    address = $bindable(),
    sshPort = $bindable(),
  }: {
    name: string;
    address: string;
    sshPort: string;
  } = $props();

  const portValid = $derived(
    /^\d+$/.test(sshPort) && Number(sshPort) >= 1 && Number(sshPort) <= 65535,
  );
</script>

<Field.FieldGroup>
  <Field.Field>
    <Field.FieldLabel for="server-name">Name</Field.FieldLabel>
    <Input
      id="server-name"
      type="text"
      bind:value={name}
      placeholder="my-vps"
      required
    />
    <Field.FieldDescription>
      A friendly name to identify this machine.
    </Field.FieldDescription>
  </Field.Field>

  <Field.Field>
    <Field.FieldLabel for="server-address">Address</Field.FieldLabel>
    <Input
      id="server-address"
      type="text"
      bind:value={address}
      placeholder="192.168.1.100 or host.example.com"
      required
    />
    <Field.FieldDescription>
      The IP or hostname Benisploy will use to reach the machine.
    </Field.FieldDescription>
  </Field.Field>

  <Field.Field>
    <Field.FieldLabel for="server-port">SSH port</Field.FieldLabel>
    <Input
      id="server-port"
      type="text"
      inputmode="numeric"
      bind:value={sshPort}
      placeholder="22"
    />
    {#if sshPort && !portValid}
      <Field.FieldDescription class="text-destructive">
        Port must be a number between 1 and 65535.
      </Field.FieldDescription>
    {/if}
  </Field.Field>
</Field.FieldGroup>