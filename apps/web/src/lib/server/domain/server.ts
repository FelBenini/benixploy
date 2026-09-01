import { z } from "zod";

export const ServerStatusSchema = z.enum([
  "online",
  "offline",
  "degraded",
  "provisioning",
]);
export type ServerStatus = z.infer<typeof ServerStatusSchema>;

export const ServerSchema = z.object({
  id: z.string().min(1).describe("Unique server identifier (ULID)"),
  name: z.string().min(1).max(128).describe("Human-readable server name"),
  description: z
    .string()
    .max(512)
    .default("")
    .describe("Optional server description"),
  address: z
    .string()
    .min(1)
    .describe("IP or hostname the node agent is reachable at"),
  sshPort: z
    .number()
    .int()
    .positive()
    .max(65535)
    .default(22)
    .describe("SSH port"),
  sshUser: z.string().min(1).default("root").describe("SSH login user"),
  sshPrivateKey: z
    .string()
    .min(1)
    .describe("SSH private key PEM (encrypted at rest)"),
  status: ServerStatusSchema.default("offline"),
  cpuCores: z.number().int().positive().describe("Number of CPU cores"),
  memoryBytes: z.number().positive().describe("Total system memory in bytes"),
  diskBytes: z.number().positive().describe("Total disk capacity in bytes"),
  labels: z
    .record(z.string(), z.string())
    .default({})
    .describe("Arbitrary key/value metadata"),
  lastHeartbeatAt: z.string().datetime().nullable().optional(),
  hostKeyFingerprint: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateServerInputSchema = ServerSchema.pick({
  name: true,
  description: true,
  address: true,
}).extend({
  cpuCores: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe("Detected at registration when not provided"),
  memoryBytes: z
    .number()
    .nonnegative()
    .default(0)
    .describe("Detected at registration when not provided"),
  diskBytes: z
    .number()
    .nonnegative()
    .default(0)
    .describe("Detected at registration when not provided"),
  labels: z.record(z.string(), z.string()).optional(),
  sshPort: z
    .number()
    .int()
    .positive()
    .max(65535)
    .default(22)
    .describe("SSH port"),
  sshUser: z.string().min(1).default("root").describe("SSH login user"),
});

export type CreateServerInput = z.infer<typeof CreateServerInputSchema>;

export const ProvisionServerInputSchema = z.object({
  accessMethod: z.enum(["key", "password"]),
  sshUser: z.string().min(1).default("root"),
  privateKey: z.string().optional(),
  password: z.string().optional(),
});

export type ProvisionServerInput = z.infer<typeof ProvisionServerInputSchema>;

export const UpdateServerInputSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(512).optional(),
  address: z.string().min(1).optional(),
  sshPort: z.number().int().positive().max(65535).optional(),
});

export type UpdateServerInput = z.infer<typeof UpdateServerInputSchema>;

export type Server = z.infer<typeof ServerSchema>;

/**
 * Server shape safe to return to the browser. `sshPrivateKey` is a
 * root-equivalent credential and must never cross the API boundary.
 */
export type PublicServer = Omit<Server, "sshPrivateKey">;

export function toPublicServer(server: Server): PublicServer {
  const { sshPrivateKey: _sshPrivateKey, ...publicServer } = server;
  return publicServer;
}

export const ServerStatusReportSchema = z.object({
  cpuPercent: z
    .number()
    .nonnegative()
    .max(100)
    .describe("CPU utilization percentage"),
  memoryUsed: z.number().nonnegative().describe("Used memory in bytes"),
  memoryTotal: z.number().positive().describe("Total memory in bytes"),
  diskUsed: z.number().nonnegative().describe("Used disk in bytes"),
  diskTotal: z.number().positive().describe("Total disk in bytes"),
  containerCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of running containers"),
  uptimeSeconds: z.number().nonnegative().describe("Server uptime in seconds"),
});

export type ServerStatusReport = z.infer<typeof ServerStatusReportSchema>;
