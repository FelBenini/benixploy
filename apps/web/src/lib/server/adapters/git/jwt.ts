import { createSign } from "crypto";

const JWT_TTL_SECONDS = 600;

function b64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

export interface SignedJwt {
  token: string;
  expiresAtMs: number;
}

export function signAppJwt(
  privateKeyPem: string,
  appId: string,
  now = Date.now(),
): SignedJwt {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + JWT_TTL_SECONDS;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iat: issuedAt, exp: expiresAt, iss: appId }),
  );
  const signingInput = `${header}.${payload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = b64url(signer.sign(privateKeyPem));

  return {
    token: `${signingInput}.${signature}`,
    expiresAtMs: expiresAt * 1000,
  };
}

const jwtCache = new Map<string, SignedJwt>();
const REFRESH_THRESHOLD_MS = 60_000;

export function getAppJwt(
  privateKeyPem: string,
  appId: string,
  now = Date.now(),
): string {
  const cached = jwtCache.get(appId);
  if (cached && cached.expiresAtMs > now + REFRESH_THRESHOLD_MS) {
    return cached.token;
  }
  const signed = signAppJwt(privateKeyPem, appId, now);
  jwtCache.set(appId, signed);
  return signed.token;
}
