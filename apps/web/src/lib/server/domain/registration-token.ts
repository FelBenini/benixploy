import { z } from "zod";

export const RegistrationTokenSchema = z.object({
  id: z.string().min(1).describe("ULID identifier"),
  tokenHash: z
    .string()
    .min(1)
    .describe("SHA-256 hash of the one-time setup token"),
  serverId: z
    .string()
    .nullable()
    .optional()
    .describe("FK → servers.id, set when consumed"),
  expiresAt: z.string().datetime(),
  usedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});

export type RegistrationToken = z.infer<typeof RegistrationTokenSchema>;

export const CreateRegistrationTokenInputSchema = z.object({
  tokenHash: z.string().min(1).describe("SHA-256 of the raw token"),
  expiresAt: z.string().datetime(),
});

export type CreateRegistrationTokenInput = z.infer<
  typeof CreateRegistrationTokenInputSchema
>;
