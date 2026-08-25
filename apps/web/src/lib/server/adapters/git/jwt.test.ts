import { describe, it, expect } from "vitest";
import {
  generateKeyPairSync,
  createPublicKey,
  verify as cryptoVerify,
} from "crypto";
import { signAppJwt, getAppJwt } from "./jwt";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const privateKeyPem = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
const publicKeyPem = publicKey
  .export({ type: "spki", format: "pem" })
  .toString();

function verifySignature(token: string): boolean {
  const [header, payload, signature] = token.split(".");
  const signingInput = `${header}.${payload}`;
  const key = createPublicKey(publicKeyPem);
  return cryptoVerify(
    "RSA-SHA256",
    Buffer.from(signingInput),
    key,
    Buffer.from(signature, "base64url"),
  );
}

function decodePayload(token: string): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
  );
}

describe("signAppJwt", () => {
  it("produces a JWT that verifies with the matching public key", () => {
    const { token } = signAppJwt(privateKeyPem, "123456");
    expect(verifySignature(token)).toBe(true);
  });

  it("sets iss, iat and exp correctly", () => {
    const now = 1_700_000_000_000;
    const { token, expiresAtMs } = signAppJwt(privateKeyPem, "42", now);
    const payload = decodePayload(token);

    expect(payload.iss).toBe("42");
    expect(payload.iat).toBe(Math.floor(now / 1000));
    expect(payload.exp).toBe(Math.floor(now / 1000) + 600);
    expect(expiresAtMs).toBe((payload.exp as number) * 1000);
  });
});

describe("getAppJwt", () => {
  it("caches the JWT until near expiry", () => {
    const now = 1_700_000_000_000;

    const first = getAppJwt(privateKeyPem, "cache-app", now);
    const cached = getAppJwt(privateKeyPem, "cache-app", now + 1_000);
    expect(cached).toBe(first);

    const refreshed = getAppJwt(privateKeyPem, "cache-app", now + 600_000);
    expect(refreshed).not.toBe(first);
  });
});
