import type { GitConnectionWithSecrets } from "../domain/git-connection";

export type { GitProvider, GitAuthKind } from "../domain/git-connection";

export type GitConnection = GitConnectionWithSecrets;

export interface RepoRef {
  slug: string;
  defaultBranch: string;
  cloneUrl: string;
  isPrivate: boolean;
}

export interface NormalizedPush {
  repoSlug: string;
  branch: string;
  sha: string;
  message: string;
  cloneUrl: string;
  deliveryId: string;
}

export interface CloneAuth {
  url: string;
  header?: string;
}

export class ProviderNotImplementedError extends Error {
  constructor(provider: string) {
    super(`Git provider '${provider}' is not implemented yet`);
    this.name = "ProviderNotImplementedError";
  }
}

export interface GitProviderClient {
  readonly provider: "github" | "gitlab" | "gitea" | "bitbucket";
  verifyConnection(conn: GitConnection): Promise<{ accountName: string }>;
  listRepositories(conn: GitConnection): Promise<RepoRef[]>;
  getFileContent(
    conn: GitConnection,
    repoSlug: string,
    path: string,
    ref?: string,
  ): Promise<string | null>;
  getHeadSha(
    conn: GitConnection,
    repoSlug: string,
    branch: string,
  ): Promise<string>;
  resolveCloneAuth(conn: GitConnection, repoSlug: string): Promise<CloneAuth>;
  verifyWebhookSignature(
    conn: GitConnection,
    headers: Headers,
    rawBody: string,
  ): boolean;
  parsePushEvent(
    conn: GitConnection,
    headers: Headers,
    rawBody: string,
  ): NormalizedPush | null;
}
