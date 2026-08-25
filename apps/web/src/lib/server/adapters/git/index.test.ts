import { describe, it, expect } from "vitest";
import { getGitProvider } from "./index";
import { ProviderNotImplementedError } from "../../ports/git-provider-client";

describe("getGitProvider", () => {
  it("returns the GitHub adapter for 'github'", () => {
    const client = getGitProvider("github");
    expect(client.provider).toBe("github");
  });

  it("throws ProviderNotImplementedError for unregistered providers", () => {
    for (const provider of ["gitlab", "gitea", "bitbucket"] as const) {
      expect(() => getGitProvider(provider)).toThrow(
        ProviderNotImplementedError,
      );
    }
  });
});
