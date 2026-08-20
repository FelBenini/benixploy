import { describe, it, expect } from "vitest";
import { AppSpecSchema } from "./app-spec";

describe("AppSpecSchema kind", () => {
  it("defaults kind to stateless when omitted", () => {
    const parsed = AppSpecSchema.parse({
      name: "default-kind",
      image: "nginx:alpine",
    });

    expect(parsed.kind).toBe("stateless");
  });

  it("rejects database without a volume mount", () => {
    const result = AppSpecSchema.safeParse({
      kind: "database",
      name: "db-no-volume",
      image: "postgres:16",
    });

    expect(result.success).toBe(false);
  });

  it("rejects database with a build context", () => {
    const result = AppSpecSchema.safeParse({
      kind: "database",
      name: "db-with-build",
      image: "postgres:16",
      buildContext: "./pg",
      volumeMounts: [{ source: "pgdata", target: "/var/lib/postgresql/data" }],
    });

    expect(result.success).toBe(false);
  });

  it("accepts database with a volume mount and pre-published image", () => {
    const result = AppSpecSchema.safeParse({
      kind: "database",
      name: "db-valid",
      image: "postgres:16",
      volumeMounts: [{ source: "pgdata", target: "/var/lib/postgresql/data" }],
    });

    expect(result.success).toBe(true);
  });
});
