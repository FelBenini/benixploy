import { describe, it, expect } from "vitest";
import { load } from "js-yaml";
import { generateDynamicConfig } from "./dynamic-config-writer";
import type { App } from "../../domain/app";
import type { ActiveColor, GitSource } from "../../domain/git-source";

function makeApp(overrides?: Partial<App>): App {
  return {
    id: "app-1",
    name: "my-app",
    kind: "stateless",
    serverId: "srv-1",
    status: "healthy",
    activeColor: "blue",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSource(
  activeColor: ActiveColor | null,
  warmColor: ActiveColor | null,
): GitSource {
  return {
    id: "src-1",
    appId: "app-1",
    connectionId: null,
    provider: "github",
    repoSlug: "octocat/hello",
    cloneUrl: "https://github.com/octocat/hello.git",
    branch: "main",
    shaDeployed: "abc1234",
    activeColor,
    warmColor,
    warmExpiresAt: null,
    lastPushAt: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

function servers(
  yaml: string,
  service = "my-app-svc",
): Array<{ url: string; weight: number }> {
  const parsed = load(yaml) as {
    http: {
      services: Record<
        string,
        { loadBalancer: { servers: Array<{ url: string; weight: number }> } }
      >;
    };
  };
  return parsed.http.services[service].loadBalancer.servers;
}

describe("generateDynamicConfig", () => {
  it("blue active, no warm — single server at weight 100", () => {
    const yaml = generateDynamicConfig(makeApp(), makeSource("blue", null));
    expect(servers(yaml)).toEqual([
      { url: "http://my-app-blue:8080", weight: 100 },
    ]);
    expect(yaml).toMatchSnapshot();
  });

  it("blue active, green warm — blue 100, green 0", () => {
    const yaml = generateDynamicConfig(makeApp(), makeSource("blue", "green"));
    expect(servers(yaml)).toEqual([
      { url: "http://my-app-blue:8080", weight: 100 },
      { url: "http://my-app-green:8080", weight: 0 },
    ]);
    expect(yaml).toMatchSnapshot();
  });

  it("green active, blue warm — green 100, blue 0", () => {
    const yaml = generateDynamicConfig(
      makeApp({ activeColor: "green" }),
      makeSource("green", "blue"),
    );
    expect(servers(yaml)).toEqual([
      { url: "http://my-app-green:8080", weight: 100 },
      { url: "http://my-app-blue:8080", weight: 0 },
    ]);
  });

  it("rollback swap flips weights without changing shape", () => {
    const forward = generateDynamicConfig(
      makeApp(),
      makeSource("blue", "green"),
    );
    const back = generateDynamicConfig(
      makeApp({ activeColor: "green" }),
      makeSource("green", "blue"),
    );
    expect(servers(forward).map((s) => s.weight)).toEqual([100, 0]);
    expect(servers(back).map((s) => s.weight)).toEqual([100, 0]);
  });

  it("uses the sanitized app name for router, service and upstreams", () => {
    const yaml = generateDynamicConfig(
      makeApp({ name: "My App!" }),
      makeSource("blue", null),
    );
    expect(yaml).toContain("My-App-");
    expect(servers(yaml, "My-App--svc")[0].url).toContain("My-App--blue");
  });

  it("honours an explicit port", () => {
    const yaml = generateDynamicConfig(makeApp(), makeSource("blue", null), {
      port: 3000,
    });
    expect(servers(yaml)[0].url).toBe("http://my-app-blue:3000");
  });

  it("refuses non-stateless apps", () => {
    expect(() =>
      generateDynamicConfig(
        makeApp({ kind: "stateful" }),
        makeSource("blue", null),
      ),
    ).toThrow(/stateless/);
  });

  it("refuses a missing active color", () => {
    expect(() =>
      generateDynamicConfig(makeApp(), makeSource(null, null)),
    ).toThrow(/activeColor/);
  });
});
