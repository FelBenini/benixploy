import { describe, it, expect } from "vitest";
import { UpsertGitConnectionInputSchema } from "./git-connection";

describe("UpsertGitConnectionInputSchema", () => {
  it("accepts a github_app connection with PEM credentials", () => {
    const parsed = UpsertGitConnectionInputSchema.parse({
      authKind: "github_app",
      provider: "github",
      name: "My GitHub App",
      credentials: {
        appId: "123456",
        clientId: "Iv1.abcdef",
        privateKeyPem: "-----BEGIN RSA PRIVATE KEY-----",
      },
      webhookSecret: "secret",
    });

    expect(parsed.baseUrl).toBe("https://github.com");
  });

  it("rejects a github_app connection with a missing PEM", () => {
    const result = UpsertGitConnectionInputSchema.safeParse({
      authKind: "github_app",
      provider: "github",
      name: "My GitHub App",
      credentials: { appId: "123", clientId: "Iv1.abcdef" },
      webhookSecret: "secret",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a github_app connection with a non-github provider", () => {
    const result = UpsertGitConnectionInputSchema.safeParse({
      authKind: "github_app",
      provider: "gitlab",
      name: "Bad",
      baseUrl: "https://gitlab.com",
      credentials: {
        appId: "1",
        clientId: "x",
        privateKeyPem: "pem",
      },
      webhookSecret: "secret",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a token connection for a self-hosted Gitea", () => {
    const parsed = UpsertGitConnectionInputSchema.parse({
      authKind: "token",
      provider: "gitea",
      name: "My Gitea",
      baseUrl: "https://git.example.com",
      credentials: { token: "abc123" },
      webhookSecret: "secret",
    });

    expect(parsed.credentials).toEqual({ token: "abc123" });
  });

  it("rejects a token connection missing baseUrl", () => {
    const result = UpsertGitConnectionInputSchema.safeParse({
      authKind: "token",
      provider: "gitlab",
      name: "GitLab",
      credentials: { token: "abc123" },
      webhookSecret: "secret",
    });

    expect(result.success).toBe(false);
  });
});
