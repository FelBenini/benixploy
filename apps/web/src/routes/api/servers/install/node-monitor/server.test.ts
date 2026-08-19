import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RequestEvent } from "./$types";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let mockBinDir: string;

vi.mock("$app/environment", () => ({
  dev: true,
}));

const { GET } = await import("./+server");

function createRequestEvent(query: string): RequestEvent {
  return {
    url: new URL(
      `http://localhost:5173/api/servers/install/node-monitor?${query}`,
    ),
    request: new Request(
      `http://localhost:5173/api/servers/install/node-monitor?${query}`,
      { method: "GET" },
    ),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      serialize: vi.fn(),
    },
    locals: {},
  } as unknown as RequestEvent;
}

describe("GET /api/servers/install/node-monitor", () => {
  beforeEach(() => {
    mockBinDir = join(tmpdir(), `nm-test-${Date.now()}`);
    mkdirSync(mockBinDir, { recursive: true });
    process.env.NODE_MONITOR_BIN_DIR = mockBinDir;
  });

  afterEach(() => {
    delete process.env.NODE_MONITOR_BIN_DIR;
  });

  it("returns 400 when arch is missing", async () => {
    const response = await GET(createRequestEvent(""));
    expect(response.status).toBe(400);
  });

  it("returns 400 for an unsupported arch", async () => {
    const response = await GET(createRequestEvent("arch=mips"));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the binary is missing", async () => {
    const response = await GET(createRequestEvent("arch=amd64"));
    expect(response.status).toBe(404);
  });

  it("returns the binary with attachment headers", async () => {
    const content = Buffer.from("fake-binary-content");
    writeFileSync(join(mockBinDir, "node-monitor-amd64"), content);

    const response = await GET(createRequestEvent("arch=amd64"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/octet-stream",
    );
    expect(response.headers.get("Content-Disposition")).toContain(
      'filename="node-monitor"',
    );
    const body = Buffer.from(await response.arrayBuffer());
    expect(body).toEqual(content);
  });
});
