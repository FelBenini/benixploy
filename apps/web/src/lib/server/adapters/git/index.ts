import type {
  GitProvider,
  GitProviderClient,
} from "../../ports/git-provider-client";
import { ProviderNotImplementedError } from "../../ports/git-provider-client";
import { githubProviderClient } from "./github";

const registry = new Map<GitProvider, GitProviderClient>([
  ["github", githubProviderClient],
]);

export function getGitProvider(provider: GitProvider): GitProviderClient {
  const client = registry.get(provider);
  if (!client) {
    throw new ProviderNotImplementedError(provider);
  }
  return client;
}
