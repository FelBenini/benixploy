export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export interface InstallStateClaims {
  purpose: "install";
  orgId: string;
  connectionId: string;
}

export interface OAuthStateStore {
  createManifestState(userId: string, orgId: string): Promise<string>;
  createInstallState(orgId: string, connectionId: string): Promise<string>;
  consumeManifestState(userId: string, orgId: string): Promise<boolean>;
  consumeInstallState(nonce: string): Promise<InstallStateClaims | null>;
}
