import { z } from "zod";
import { GitProviderSchema } from "./git-connection";

export const ActiveColorSchema = z.enum(["blue", "green"]);

export type ActiveColor = z.infer<typeof ActiveColorSchema>;

export const GitSourceSchema = z.object({
  id: z.string().min(1).describe("Unique git source identifier"),
  appId: z
    .string()
    .min(1)
    .describe("App this source is joined to (one-to-one)"),
  connectionId: z
    .string()
    .nullable()
    .describe("Provider connection id; null for catalog-template apps"),
  provider: GitProviderSchema.describe(
    "Denormalized provider for fast read paths",
  ),
  repoSlug: z
    .string()
    .min(1)
    .describe("Canonical repo path, e.g. octocat/Hello-World"),
  cloneUrl: z
    .string()
    .min(1)
    .describe("Full clone URL captured at wizard time"),
  branch: z.string().min(1).default("main"),
  shaDeployed: z
    .string()
    .nullable()
    .describe("Last successfully deployed commit SHA"),
  activeColor: ActiveColorSchema.nullable().describe(
    "Mirror of apps.active_color",
  ),
  warmColor: ActiveColorSchema.nullable().describe("Prior color kept warm"),
  warmExpiresAt: z.string().datetime().nullable().describe("Reaper target"),
  lastPushAt: z.string().datetime().nullable().describe("Dashboard sort key"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GitSource = z.infer<typeof GitSourceSchema>;

export const UpsertGitSourceInputSchema = z.object({
  appId: z.string().min(1),
  connectionId: z.string().min(1).nullable(),
  provider: GitProviderSchema,
  repoSlug: z.string().min(1),
  cloneUrl: z.string().min(1),
  branch: z.string().min(1).default("main"),
});

export type UpsertGitSourceInput = z.infer<typeof UpsertGitSourceInputSchema>;
