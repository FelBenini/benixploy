import { z } from "zod";

export const RegisteredNodeStatusSchema = z.enum([
  "active",
  "disabled",
  "revoked",
]);

export type RegisteredNodeStatus = z.infer<typeof RegisteredNodeStatusSchema>;

export const RegisteredNodeSchema = z.object({
  id: z.string().min(1).describe("ULID identifier"),
  serverId: z.string().min(1).describe("FK → servers.id"),
  sshPublicKey: z
    .string()
    .min(1)
    .describe("SSH public key for forced-command auth"),
  monitorBearerToken: z
    .string()
    .min(1)
    .describe("Bearer token for node-monitor telemetry pushes"),
  status: RegisteredNodeStatusSchema.default("active"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RegisteredNode = z.infer<typeof RegisteredNodeSchema>;

export const CreateRegisteredNodeInputSchema = z.object({
  serverId: z.string().min(1),
  sshPublicKey: z.string().min(1),
  monitorBearerToken: z.string().min(1),
});

export type CreateRegisteredNodeInput = z.infer<
  typeof CreateRegisteredNodeInputSchema
>;
