# monitor-schemas

Shared telemetry and AppSpec schemas used between the **node monitor** (Go) and the **control plane** (TypeScript).

## Structure

```
packages/monitor-schemas/
  src/index.ts          # Zod schemas + TS types (source of truth)
  go/protocol.go        # Go structs mirroring the TS schemas
  go/protocol_test.go   # Round-trip JSON tests
```

## Telemetry schemas

- `StatsPushSchema` / `StatsPushPayloadSchema` — host metrics + container state
- `EventPushSchema` / `EventPushPayloadSchema` — die / oom / unhealthy / restart_loop events
- `AnyMessageSchema` — discriminated union for parsing any incoming message

## AppSpec

- `AgentAppSpecSchema` — normalized app definition used by the Compose Generator
