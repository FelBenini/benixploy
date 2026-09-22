import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  chmodSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../..",
);
const SCRIPT_SRC = path.join(REPO_ROOT, "deploy/node-setup/exec-command.sh");

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

interface Sandbox {
  appId: string;
  run: (input: string, withStubs?: boolean) => RunResult;
  gitLog: () => string;
  dockerLog: () => string;
  gitStubPath: string;
}

let baseDir: string;

beforeAll(() => {
  baseDir = mkdtempSync(path.join(tmpdir(), "exec-command-test-"));
});

afterAll(() => {
  rmSync(baseDir, { recursive: true, force: true });
});

function makeSandbox(): Sandbox {
  const sandboxDir = mkdtempSync(path.join(baseDir, "case-"));
  const appsDir = path.join(sandboxDir, "apps");
  const appDir = path.join(appsDir, "app-1");
  const binDir = path.join(sandboxDir, "bin");

  mkdirSync(appDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    path.join(appDir, "docker-compose.yml"),
    "services:\n  app-1:\n    build:\n      context: ./build-context\n",
  );

  const script = path.join(sandboxDir, "exec-command.sh");
  const source = readFileSync(SCRIPT_SRC, "utf8").replace(
    'APPS_DIR="/opt/benisploy/apps"',
    `APPS_DIR="${appsDir}"`,
  );
  writeFileSync(script, source);
  chmodSync(script, 0o755);

  const gitLogPath = path.join(sandboxDir, "git.log");
  const dockerLogPath = path.join(sandboxDir, "docker.log");

  const stubGit = path.join(binDir, "git");
  const gitStubPath = stubGit;
  writeFileSync(
    stubGit,
    `#!/bin/sh
echo "ARGS:$*" >> "${gitLogPath}"
echo "ASKPASS:\${GIT_ASKPASS:-}" >> "${gitLogPath}"
echo "USER:\${BENISPLOY_GIT_USER:-}" >> "${gitLogPath}"
echo "PASSWORD:\${BENISPLOY_GIT_PASSWORD:-}" >> "${gitLogPath}"
echo "CONFIG_COUNT:\${GIT_CONFIG_COUNT:-} KEY:\${GIT_CONFIG_KEY_0:-} VALUE:\${GIT_CONFIG_VALUE_0:-}" >> "${gitLogPath}"
if [ "$1" = "clone" ]; then
  mkdir -p "$3"
  echo "not a repo" > "$3/file.txt"
  exit 0
fi
exit 0
`,
  );
  chmodSync(stubGit, 0o755);

  const stubDocker = path.join(binDir, "docker");
  writeFileSync(
    stubDocker,
    `#!/bin/sh
echo "ARGS:$*" >> "${dockerLogPath}"
exit 0
`,
  );
  chmodSync(stubDocker, 0o755);

  function run(input: string, withStubs = false): RunResult {
    const env: Record<string, string> = { ...process.env } as Record<
      string,
      string
    >;
    if (withStubs) {
      env.PATH = `${binDir}:${env.PATH}`;
    }
    try {
      const stdout = execFileSync("sh", [script], {
        input,
        encoding: "utf8",
        env,
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (err) {
      const e = err as {
        stdout?: string;
        stderr?: string;
        status?: number | null;
      };
      return {
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? "",
        exitCode: e.status ?? null,
      };
    }
  }

  return {
    appId: "app-1",
    run,
    gitLog: () => readFileSync(gitLogPath, "utf8"),
    dockerLog: () => readFileSync(dockerLogPath, "utf8"),
    gitStubPath,
  };
}

describe("exec-command.sh", () => {
  it("reports the current version string", () => {
    const sb = makeSandbox();
    expect(sb.run("version\n").stdout).toContain(
      "benisploy/exec-command 1.1.0",
    );
  });

  it("prints the version string on empty stdin", () => {
    const sb = makeSandbox();
    expect(sb.run("").stdout).toContain("benisploy/exec-command");
  });

  it("rejects unknown actions with a JSON error on stderr", () => {
    const sb = makeSandbox();
    const res = sb.run("explode app-1\n");
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain('"error"');
    expect(res.stderr).toContain("unknown action");
  });

  it("rejects an action without an app id (usage)", () => {
    const sb = makeSandbox();
    const res = sb.run("build\n");
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain("usage");
  });

  it("rejects invalid app ids", () => {
    const sb = makeSandbox();
    const res = sb.run("deploy ../../etc/passwd\n");
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain("invalid app id");
  });

  it("rejects non-http git urls in the build action", () => {
    const sb = makeSandbox();
    const res = sb.run("build app-1 git@github.com:octocat/hello.git\n");
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain("invalid git url");
  });

  it("rejects git urls with embedded credentials", () => {
    const sb = makeSandbox();
    const res = sb.run(
      "build app-1 https://user:token@github.com/octocat/hello.git\n",
    );
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain("embedded credentials");
  });

  it("rejects invalid commit refs", () => {
    const sb = makeSandbox();
    const res = sb.run("build app-1 https://github.com/o/r.git 'bad ref'\n");
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain("invalid commit ref");
  });

  it("clones, checks out and builds with basic auth from stdin", () => {
    const sb = makeSandbox();
    const res = sb.run(
      "build app-1 https://github.com/octocat/hello.git abc123def\n" +
        "basic x-access-token ghs_supersecret123\n",
      true,
    );

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('"status":"cloning"');
    expect(res.stdout).toContain('"status":"ok"');

    const gitLog = sb.gitLog();
    expect(gitLog).toMatch(
      /ARGS:clone https:\/\/github\.com\/octocat\/hello\.git .*\/apps\/app-1\/build-context/,
    );
    // The token must never appear in the git argv (only in askpass env).
    const argvLines = gitLog.split("\n").filter((l) => l.startsWith("ARGS:"));
    expect(argvLines.length).toBeGreaterThan(0);
    for (const line of argvLines) {
      expect(line).not.toContain("ghs_supersecret123");
      expect(line).not.toContain("x-access-token:");
    }
    // The token is delivered via askpass env on the node.
    expect(gitLog).toContain("USER:x-access-token");
    expect(gitLog).toContain("PASSWORD:ghs_supersecret123");
    expect(gitLog).toContain("ASKPASS:");

    expect(sb.dockerLog()).toContain("ARGS:compose -f");
    expect(sb.dockerLog()).toContain("docker-compose.yml build");
  });

  it("redacts secrets from error output", () => {
    const sb = makeSandbox();
    writeFileSync(
      sb.gitStubPath,
      `#!/bin/sh
echo "fatal: clone with token ghs_supersecret123 failed" >&2
exit 128
`,
    );
    chmodSync(sb.gitStubPath, 0o755);

    const res = sb.run(
      "build app-1 https://github.com/octocat/hello.git\n" +
        "basic x-access-token ghs_supersecret123\n",
      true,
    );

    expect(res.exitCode).toBe(6);
    expect(res.stderr).toContain("[REDACTED]");
    expect(res.stderr).not.toContain("ghs_supersecret123");
  });

  it("delivers header auth via git config env vars", () => {
    const sb = makeSandbox();
    const res = sb.run(
      "build app-1 https://github.com/octocat/hello.git\n" +
        "header Authorization: Bearer ghp_header456\n",
      true,
    );

    expect(res.exitCode).toBe(0);
    const gitLog = sb.gitLog();
    expect(gitLog).toContain(
      "CONFIG_COUNT:1 KEY:http.extraheader VALUE:Authorization: Bearer ghp_header456",
    );
    // The token travels via env config, never in git argv.
    const argsLine = gitLog.split("\n")[0];
    expect(argsLine).not.toContain("ghp_header456");
  });

  it("clones publicly when no auth line is provided", () => {
    const sb = makeSandbox();
    const res = sb.run(
      "build app-1 https://github.com/octocat/hello.git\n",
      true,
    );

    expect(res.exitCode).toBe(0);
    const gitLog = sb.gitLog();
    expect(gitLog).toContain("ARGS:clone https://github.com/octocat/hello.git");
    expect(gitLog).toContain("USER:");
    expect(gitLog).toContain("PASSWORD:");
    expect(gitLog).toContain("CONFIG_COUNT:");
    expect(gitLog).not.toMatch(/CONFIG_COUNT:\d/);
  });
});
