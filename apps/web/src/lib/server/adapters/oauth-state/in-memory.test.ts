import { describe, it, expect, afterEach, vi } from "vitest";
import { InMemoryOAuthStateStore } from "./in-memory";

describe("InMemoryOAuthStateStore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a high-entropy nonce for manifest states", async () => {
    const store = new InMemoryOAuthStateStore();
    const nonce = await store.createManifestState("user-1", "org-1");
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a high-entropy nonce for install states", async () => {
    const store = new InMemoryOAuthStateStore();
    const nonce = await store.createInstallState("org-1", "conn-1");
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it("consumes a pending manifest state exactly once", async () => {
    const store = new InMemoryOAuthStateStore();
    await store.createManifestState("user-1", "org-1");

    expect(await store.consumeManifestState("user-1", "org-1")).toBe(true);
    expect(await store.consumeManifestState("user-1", "org-1")).toBe(false);
  });

  it("does not consume a manifest state for another session", async () => {
    const store = new InMemoryOAuthStateStore();
    await store.createManifestState("user-1", "org-1");

    expect(await store.consumeManifestState("user-2", "org-1")).toBe(false);
    expect(await store.consumeManifestState("user-1", "org-1")).toBe(true);
  });

  it("consumes an install state and returns its claims exactly once", async () => {
    const store = new InMemoryOAuthStateStore();
    const nonce = await store.createInstallState("org-1", "conn-1");

    await expect(store.consumeInstallState(nonce)).resolves.toEqual({
      purpose: "install",
      orgId: "org-1",
      connectionId: "conn-1",
    });
    await expect(store.consumeInstallState(nonce)).resolves.toBeNull();
  });

  it("returns null for unknown install states", async () => {
    const store = new InMemoryOAuthStateStore();
    await expect(store.consumeInstallState("forged-nonce")).resolves.toBeNull();
  });

  it("rejects expired states", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const store = new InMemoryOAuthStateStore();

    const nonce = await store.createInstallState("org-1", "conn-1");
    await store.createManifestState("user-1", "org-1");

    vi.setSystemTime(new Date("2026-01-01T00:10:01.000Z"));

    await expect(store.consumeInstallState(nonce)).resolves.toBeNull();
    await expect(store.consumeManifestState("user-1", "org-1")).resolves.toBe(
      false,
    );
  });
});
