import { z } from "zod";

export const GitProviderSchema = z.enum([
  "github",
  "gitlab",
  "gitea",
  "bitbucket",
]);

export type GitProvider = z.infer<typeof GitProviderSchema>;

export const GitAuthKindSchema = z.enum(["github_app", "token"]);

export type GitAuthKind = z.infer<typeof GitAuthKindSchema>;

export const GitConnectionSchema = z.object({
  id: z.string().min(1).describe("Unique connection identifier"),
  provider: GitProviderSchema.describe(
    "Routes to the correct GitProviderClient adapter",
  ),
  name: z.string().min(1).describe("Display label"),
  baseUrl: z
    .string()
    .min(1)
    .describe("Origin of the git server, e.g. https://github.com"),
  authKind: GitAuthKindSchema.describe(
    "Credential shape: github_app (PEM) or token (PAT)",
  ),
  externalId: z
    .string()
    .nullable()
    .optional()
    .describe("GitHub installation_id; null for token-based providers"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GitConnection = z.infer<typeof GitConnectionSchema>;

export const GitHubAppCredentialsSchema = z.object({
  appId: z.string().min(1).describe("GitHub App ID"),
  clientId: z.string().min(1).describe("GitHub App client ID"),
  privateKeyPem: z.string().min(1).describe("GitHub App private key (PEM)"),
});

export type GitHubAppCredentials = z.infer<typeof GitHubAppCredentialsSchema>;

export const TokenCredentialsSchema = z.object({
  token: z.string().min(1).describe("Personal access token"),
  username: z
    .string()
    .optional()
    .describe("Optional username, required for Bitbucket app passwords"),
});

export type TokenCredentials = z.infer<typeof TokenCredentialsSchema>;

export const GitHubAppConnectionInputSchema = z.object({
  id: z.string().min(1).optional(),
  authKind: z.literal("github_app"),
  provider: z.literal("github"),
  name: z.string().min(1),
  baseUrl: z.string().min(1).default("https://github.com"),
  credentials: GitHubAppCredentialsSchema,
  webhookSecret: z.string().min(1),
});

export const TokenConnectionInputSchema = z.object({
  id: z.string().min(1).optional(),
  authKind: z.literal("token"),
  provider: z.enum(["gitlab", "gitea", "bitbucket"]),
  name: z.string().min(1),
  baseUrl: z.string().min(1),
  credentials: TokenCredentialsSchema,
  webhookSecret: z.string().min(1),
});

export const UpsertGitConnectionInputSchema = z.discriminatedUnion("authKind", [
  GitHubAppConnectionInputSchema,
  TokenConnectionInputSchema,
]);

export type UpsertGitConnectionInput = z.infer<
  typeof UpsertGitConnectionInputSchema
>;

export type GitConnectionWithSecrets = GitConnection & {
  credentials: GitHubAppCredentials | TokenCredentials;
  webhookSecret: string;
};
