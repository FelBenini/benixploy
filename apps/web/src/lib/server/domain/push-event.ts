import { z } from "zod";
import { GitProviderSchema } from "./git-connection";

export const PushEventStatusSchema = z.enum([
  "queued",
  "deploying",
  "success",
  "failed",
  "skipped_dupe",
  "skipped_untracked",
]);

export type PushEventStatus = z.infer<typeof PushEventStatusSchema>;

export const PushEventSchema = z.object({
  id: z.string().min(1).describe("Unique push event identifier"),
  appId: z
    .string()
    .nullable()
    .describe("Matched app; null when the branch is untracked"),
  connectionId: z.string().nullable().describe("Source git connection"),
  provider: GitProviderSchema.describe("Denormalized provider"),
  repoSlug: z.string().min(1).describe("Canonical repo path"),
  branch: z.string().min(1).describe("Branch the push landed on"),
  ref: z.string().min(1).describe("Full git ref, e.g. refs/heads/main"),
  sha: z.string().min(1).describe("Head commit SHA of the push"),
  message: z.string().describe("Head commit message"),
  deliveryId: z.string().nullable().describe("Provider delivery id"),
  status: PushEventStatusSchema.describe("Lifecycle / skip reason"),
  deployJobId: z.string().nullable().describe("Queue job id when enqueued"),
  receivedAt: z.string().datetime(),
});

export type PushEvent = z.infer<typeof PushEventSchema>;

export const CreatePushEventInputSchema = z.object({
  appId: z.string().min(1).nullable(),
  connectionId: z.string().min(1).nullable(),
  provider: GitProviderSchema,
  repoSlug: z.string().min(1),
  branch: z.string().min(1),
  ref: z.string().min(1),
  sha: z.string().min(1),
  message: z.string().default(""),
  deliveryId: z.string().min(1).nullable().default(null),
  status: PushEventStatusSchema.default("queued"),
  deployJobId: z.string().min(1).nullable().default(null),
});

export type CreatePushEventInput = z.infer<typeof CreatePushEventInputSchema>;
