import { describe, it, expect } from "vitest";
import { load } from "js-yaml";
import { generateComposeYaml } from "./index";

function validSpec(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    name: "test-app",
    image: "nginx:alpine",
    envVars: {},
    ports: [],
    volumeMounts: [],
    ...overrides,
  };
}

describe("generateComposeYaml", () => {
  it("generates minimal compose file with image and env vars", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "nginx-test",
        image: "nginx:alpine",
        envVars: { FOO: "bar" },
        ports: [{ container: 80, protocol: "tcp" }],
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    expect(yaml).toContain("nginx-test");
    expect(yaml).toContain("nginx:alpine");
    expect(yaml).toContain("FOO: bar");
  });

  it("includes resource limits when specified", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "resource-test",
        image: "redis:7",
        resourceLimits: { cpus: "0.5", memoryMB: 256 },
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    expect(yaml).toContain("cpus: '0.5'");
    expect(yaml).toContain("memory: 256M");
  });

  it("includes health check configuration", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "health-test",
        image: "nginx:alpine",
        healthCheck: {
          test: ["CMD", "curl", "-f", "http://localhost"],
          interval: 30,
          timeout: 10,
          retries: 3,
          startPeriod: 5,
        },
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    expect(yaml).toContain("curl");
    expect(yaml).toContain("interval: 30s");
    expect(yaml).toContain("timeout: 10s");
    expect(yaml).toContain("retries: 3");
    expect(yaml).toContain("start_period: 5s");
  });

  it("includes volume mounts", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "volume-test",
        image: "postgres:16",
        volumeMounts: [
          { source: "pgdata", target: "/var/lib/postgresql/data", mode: "rw" },
        ],
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    expect(yaml).toContain("pgdata:/var/lib/postgresql/data");
  });

  it("declares named volumes at top level", () => {
    const yaml = generateComposeYaml(
      validSpec({
        volumeMounts: [
          { source: "pgdata", target: "/var/lib/postgresql/data", mode: "rw" },
        ],
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    const parsed = load(yaml) as Record<string, unknown>;
    expect(parsed.volumes).toBeDefined();
    expect((parsed.volumes as Record<string, unknown>).pgdata).toBeNull();
  });

  it("does not declare bind-mounted paths at top level", () => {
    const yaml = generateComposeYaml(
      validSpec({
        volumeMounts: [
          { source: "/host/path", target: "/container/path", mode: "rw" },
          { source: "./relative/path", target: "/container/path", mode: "rw" },
        ],
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    const parsed = load(yaml) as Record<string, unknown>;
    expect(parsed.volumes).toBeUndefined();
  });

  it("handles compose overrides with deep merge", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "override-test",
        image: "nginx:alpine",
        envVars: { BASE: "val" },
        composeOverrides: `
services:
  override-test:
    environment:
      OVERRIDDEN: "yes"
`,
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    expect(yaml).toContain("OVERRIDDEN");
    expect(yaml).toContain("BASE: val");
  });

  it("uses build context instead of image when provided", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "build-test",
        buildContext: "./myapp",
        image: undefined,
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    expect(yaml).toContain("build: ./myapp");
    expect(yaml).not.toContain("image:");
  });

  it("emits ./build-context for git URL build contexts", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "git-test",
        kind: "stateful",
        buildContext: "https://github.com/octocat/hello.git",
        image: undefined,
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    const parsed = load(yaml) as Record<string, unknown>;
    const svc = (parsed.services as Record<string, unknown>)[
      "git-test"
    ] as Record<string, unknown>;
    expect(svc.build).toEqual({ context: "./build-context" });
    expect(svc.image).toBeUndefined();
    expect(yaml).not.toContain("https://github.com");
  });

  it("tags the image when appId and version are provided", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "git-test",
        kind: "stateful",
        buildContext: "https://github.com/octocat/hello.git",
        image: undefined,
      }) as Parameters<typeof generateComposeYaml>[0],
      { appId: "abc-123", version: 1 },
    );

    const parsed = load(yaml) as Record<string, unknown>;
    const svc = (parsed.services as Record<string, unknown>)[
      "git-test"
    ] as Record<string, unknown>;
    expect(svc.build).toEqual({ context: "./build-context" });
    expect(svc.image).toBe("benisploy/abc-123:v1");
  });

  it("treats non-http build context strings as local paths", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "path-test",
        buildContext: "file:///tmp/build",
        image: undefined,
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    expect(yaml).toContain("build: file:///tmp/build");
  });

  it("sanitizes container names", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "my app!",
        image: "nginx:alpine",
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    expect(yaml).toContain("my-app-");
  });

  it("adds Traefik labels when baseDomain is provided", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "myapp",
        kind: "stateful",
        image: "nginx:alpine",
        ports: [{ container: 8080, protocol: "tcp" }],
      }) as Parameters<typeof generateComposeYaml>[0],
      { baseDomain: "example.com" },
    );

    expect(yaml).toContain("traefik.enable=true");
    expect(yaml).toContain("Host(`myapp.example.com`)");
    expect(yaml).toContain("entrypoints=websecure");
    expect(yaml).toContain("certresolver=letsencrypt");
    expect(yaml).toContain("server.port=8080");
  });

  it("defaults to port 80 in Traefik labels when no ports are exposed", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "myapp",
        kind: "stateful",
        image: "nginx:alpine",
      }) as Parameters<typeof generateComposeYaml>[0],
      { baseDomain: "example.com" },
    );

    expect(yaml).toContain("server.port=80");
  });

  it("does not add Traefik labels when baseDomain is omitted", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "myapp",
        image: "nginx:alpine",
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    expect(yaml).not.toContain("traefik");
  });

  it("handles UDP port mapping", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "udp-test",
        image: "myapp",
        ports: [{ container: 53, protocol: "udp" }],
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    expect(yaml).toContain("53/udp");
  });

  it("generates valid YAML parseable by js-yaml", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "parse-test",
        kind: "stateful",
        image: "nginx:alpine",
        envVars: { FOO: "bar" },
        ports: [{ container: 80, protocol: "tcp" }],
        volumeMounts: [{ source: "data", target: "/data", mode: "rw" }],
        resourceLimits: { cpus: "0.5", memoryMB: 256 },
        healthCheck: {
          test: ["CMD", "curl", "-f", "http://localhost"],
          interval: 30,
          timeout: 10,
          retries: 3,
          startPeriod: 5,
        },
      }) as Parameters<typeof generateComposeYaml>[0],
      { baseDomain: "example.com" },
    );

    const parsed = load(yaml) as Record<string, unknown>;
    expect(parsed.services).toBeDefined();
    const svc = (parsed.services as Record<string, unknown>)[
      "parse-test"
    ] as Record<string, unknown>;
    expect(svc.image).toBe("nginx:alpine");
  });

  it("emits blue and green services for stateless apps", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "myapp",
        kind: "stateless",
        image: "nginx:alpine",
        envVars: { FOO: "bar" },
        ports: [{ container: 8080, protocol: "tcp" }],
        volumeMounts: [{ source: "data", target: "/data", mode: "rw" }],
        resourceLimits: { cpus: "0.5", memoryMB: 256 },
        healthCheck: {
          test: ["CMD", "curl", "-f", "http://localhost"],
          interval: 30,
          timeout: 10,
          retries: 3,
          startPeriod: 5,
        },
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    const parsed = load(yaml) as Record<string, unknown>;
    const services = parsed.services as Record<string, unknown>;
    const blue = services["myapp-blue"] as Record<string, unknown>;
    const green = services["myapp-green"] as Record<string, unknown>;

    expect(services["myapp"]).toBeUndefined();
    expect(blue).toBeDefined();
    expect(green).toBeDefined();
    expect(blue.container_name).toBe("myapp-blue");
    expect(green.container_name).toBe("myapp-green");
    expect(blue.image).toBe("nginx:alpine");
    expect(green.image).toBe("nginx:alpine");
    expect(blue.environment).toEqual({ FOO: "bar" });
    expect(green.environment).toEqual({ FOO: "bar" });
    expect(blue.ports).toEqual(["8080"]);
    expect(green.ports).toEqual(["8080"]);
    expect(blue.volumes).toEqual(["data:/data"]);
    expect(green.volumes).toEqual(["data:/data"]);
    expect(blue.deploy).toEqual({
      resources: { limits: { cpus: "0.5", memory: "256M" } },
    });
    expect(green.deploy).toEqual(blue.deploy);
    expect(green.healthcheck).toEqual(blue.healthcheck);
    expect(parsed.volumes).toEqual({ data: null });
  });

  it("declares named volumes once for stateless blue/green", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "volume-app",
        kind: "stateless",
        image: "nginx:alpine",
        volumeMounts: [{ source: "pgdata", target: "/data", mode: "rw" }],
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    const parsed = load(yaml) as Record<string, unknown>;
    expect(parsed.volumes).toEqual({ pgdata: null });
  });

  it("emits Traefik weighted labels for stateless apps with baseDomain", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "myapp",
        kind: "stateless",
        image: "nginx:alpine",
        ports: [{ container: 8080, protocol: "tcp" }],
      }) as Parameters<typeof generateComposeYaml>[0],
      { baseDomain: "example.com" },
    );

    expect(yaml).toContain("traefik.enable=true");
    expect(yaml).toContain("Host(`myapp.example.com`)");
    expect(yaml).toContain("myapp-weighted");
    expect(yaml).toContain("myapp-blue.weight=100");
    expect(yaml).toContain("myapp-green.weight=0");
    const services = (load(yaml) as Record<string, unknown>).services as Record<
      string,
      unknown
    >;
    expect(services["myapp-blue"]).toBeDefined();
    expect(services["myapp-green"]).toBeDefined();
  });

  it("flips Traefik weights when activeColor is green", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "myapp",
        kind: "stateless",
        image: "nginx:alpine",
        ports: [{ container: 8080, protocol: "tcp" }],
      }) as Parameters<typeof generateComposeYaml>[0],
      { baseDomain: "example.com", activeColor: "green" },
    );

    expect(yaml).toContain("myapp-blue.weight=0");
    expect(yaml).toContain("myapp-green.weight=100");
  });

  it("treats a missing kind as stateless (two services, no labels)", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "default-app",
        image: "nginx:alpine",
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    const services = (load(yaml) as Record<string, unknown>).services as Record<
      string,
      unknown
    >;
    expect(services["default-app-blue"]).toBeDefined();
    expect(services["default-app-green"]).toBeDefined();
    expect(yaml).not.toContain("traefik");
  });

  it("keeps a single service for stateful apps", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "stateful-app",
        kind: "stateful",
        image: "postgres:16",
        volumeMounts: [{ source: "pgdata", target: "/data", mode: "rw" }],
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    const services = (load(yaml) as Record<string, unknown>).services as Record<
      string,
      unknown
    >;
    expect(services["stateful-app"]).toBeDefined();
    expect(services["stateful-app-blue"]).toBeUndefined();
    expect(services["stateful-app-green"]).toBeUndefined();
  });

  it("keeps a single service for database apps", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "db-app",
        kind: "database",
        image: "postgres:16",
        volumeMounts: [
          { source: "pgdata", target: "/var/lib/postgresql/data" },
        ],
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    const services = (load(yaml) as Record<string, unknown>).services as Record<
      string,
      unknown
    >;
    expect(services["db-app"]).toBeDefined();
    expect(services["db-app-blue"]).toBeUndefined();
    expect(services["db-app-green"]).toBeUndefined();
  });

  it("emits build context and image tag on both stateless colors", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "git-app",
        kind: "stateless",
        buildContext: "https://github.com/octocat/hello.git",
        image: undefined,
      }) as Parameters<typeof generateComposeYaml>[0],
      { appId: "abc-123", version: 1 },
    );

    const services = (load(yaml) as Record<string, unknown>).services as Record<
      string,
      unknown
    >;
    const blue = services["git-app-blue"] as Record<string, unknown>;
    const green = services["git-app-green"] as Record<string, unknown>;
    expect(blue.build).toEqual({ context: "./build-context" });
    expect(green.build).toEqual({ context: "./build-context" });
    expect(blue.image).toBe("benisploy/abc-123:v1");
    expect(green.image).toBe("benisploy/abc-123:v1");
  });

  it("merges compose overrides targeting the base name into both stateless colors", () => {
    const yaml = generateComposeYaml(
      validSpec({
        name: "override-app",
        kind: "stateless",
        image: "nginx:alpine",
        envVars: { BASE: "val" },
        composeOverrides: `
services:
  override-app:
    environment:
      OVERRIDDEN: "yes"
`,
      }) as Parameters<typeof generateComposeYaml>[0],
    );

    const services = (load(yaml) as Record<string, unknown>).services as Record<
      string,
      unknown
    >;
    expect(
      (services["override-app-blue"] as Record<string, unknown>).environment,
    ).toEqual({ BASE: "val", OVERRIDDEN: "yes" });
    expect(
      (services["override-app-green"] as Record<string, unknown>).environment,
    ).toEqual({ BASE: "val", OVERRIDDEN: "yes" });
  });
});
