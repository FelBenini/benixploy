import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Repository } from "../ports/repository";
import type { ProvisionServerInput } from "../domain/server";
import {
  connectForProvisioning,
  executeCommand,
  streamCommandOutput,
  uploadFile,
  createTofuHostVerifier,
  ProvisionSshError,
} from "../adapters/node-ssh/ssh-provision-client";
import type { ProvisionAuth } from "../adapters/node-ssh";
import {
  resolveKnownErrors,
  type ResolvedError,
} from "../domain/provision-errors";

const SSH_ED25519_PUBKEY_RE = /^ssh-ed25519\s+[A-Za-z0-9+/=]+\s+.*$/;

function shellEscape(value: string): string {
  return value.replace(/'/g, "'\\''");
}

export interface ProvisionPhase {
  phase: number;
  label: string;
  status: "pending" | "active" | "done" | "error";
  error?: string;
}

export interface ProvisionDone {
  type: "done";
  serverId: string;
}

export interface ProvisionError {
  type: "error";
  phase: number;
  message: string;
  knownErrors?: ResolvedError[];
}

export type ProvisionEvent = ProvisionPhase | ProvisionDone | ProvisionError;

const PHASES = [
  "Connecting to server",
  "Detecting hardware specs",
  "Installing Docker",
  "Creating benisploy user",
  "Configuring SSH forced-command",
  "Uploading exec-command.sh",
  "Installing node monitor",
  "Starting monitor service",
  "Verifying heartbeat",
];

function resolveDeployScriptsDir(): string {
  return (
    process.env.DEPLOY_SCRIPTS_DIR ||
    join(process.cwd(), "../../deploy/node-setup")
  );
}

function readDeployScript(name: string): string {
  return readFileSync(join(resolveDeployScriptsDir(), name), "utf-8");
}

function generateSshKeyPair(): { publicKey: string; privateKey: string } {
  const dir = mkdtempSync(join(tmpdir(), "benisploy-key-"));
  try {
    const keyFile = join(dir, "id_ed25519");
    execSync(`ssh-keygen -t ed25519 -f "${keyFile}" -N "" -C "benisploy" -q`, {
      timeout: 5000,
    });
    const publicKey = readFileSync(`${keyFile}.pub`, "utf-8").trim();
    const privateKey = readFileSync(keyFile, "utf-8");
    return { publicKey, privateKey };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function createProvisionServer(repo: Repository) {
  return async function* provisionServer(
    orgId: string,
    serverId: string,
    input: ProvisionServerInput,
    opts?: { controlPlaneUrl?: string },
  ): AsyncIterable<ProvisionEvent> {
    const controlPlaneUrl = opts?.controlPlaneUrl ?? "http://localhost:5173";
    const server = await repo.servers.get(orgId, serverId);
    if (!server) {
      yield { type: "error", phase: -1, message: "Server not found" };
      return;
    }

    const credentials =
      input.accessMethod === "password"
        ? ({ type: "password", password: input.password! } as const)
        : ({ type: "key", privateKey: input.privateKey! } as const);

    const auth: ProvisionAuth = {
      host: server.address,
      port: server.sshPort ?? 22,
      username: input.sshUser ?? "root",
      credentials,
    };

    try {
      // Phase 0: Connect to server
      yield { phase: 0, label: PHASES[0], status: "active" };
      const tofu = createTofuHostVerifier();
      const client = await connectForProvisioning(auth, tofu.verify);
      yield { phase: 0, label: PHASES[0], status: "done" };

      const hostFingerprint = tofu.fingerprint;

      try {
        // Phase 1: Detect hardware specs
        yield { phase: 1, label: PHASES[1], status: "active" };
        let specs: {
          cpuCores: number;
          memoryBytes: number;
          diskBytes: number;
        };
        try {
          const cpuResult = await executeCommand(client, "nproc");
          const memResult = await executeCommand(
            client,
            "free -b | awk '/^Mem:/ {print $2}'",
          );
          const diskResult = await executeCommand(
            client,
            "lsblk -b -d -n -o SIZE,TYPE | awk '$2 == \"disk\" {sum += $1} END {print sum}'",
          );
          specs = {
            cpuCores: Number.parseInt(cpuResult.stdout.trim()) || 1,
            memoryBytes: Number.parseInt(memResult.stdout.trim()) || 0,
            diskBytes: Number.parseInt(diskResult.stdout.trim()) || 0,
          };
        } catch {
          specs = { cpuCores: 1, memoryBytes: 0, diskBytes: 0 };
        }
        yield { phase: 1, label: PHASES[1], status: "done" };

        // Generate SSH keypair and bearer token
        const keyPair = generateSshKeyPair();
        const bearerToken = randomBytes(32).toString("hex");

        // Phase 2: Install Docker (upload scripts + run install.sh)
        yield { phase: 2, label: PHASES[2], status: "active" };

        const installScript = readDeployScript("install.sh");
        const execCommandScript = readDeployScript("exec-command.sh");

        await uploadFile(auth, installScript, "/tmp/install.sh", tofu.verify);
        await uploadFile(
          auth,
          execCommandScript,
          "/tmp/exec-command.sh",
          tofu.verify,
        );

        const pubKey = keyPair.publicKey;

        if (!SSH_ED25519_PUBKEY_RE.test(pubKey)) {
          yield {
            type: "error",
            phase: -1,
            message: `Generated SSH public key has unexpected format`,
          };
          return;
        }

        const sudo = auth.username !== "root" ? "sudo -n" : "";
        const installCmd = [
          "chmod +x /tmp/install.sh /tmp/exec-command.sh",
          "&&",
          sudo,
          "/tmp/install.sh",
          `--exec-key '${shellEscape(pubKey)}'`,
          `--sftp-key '${shellEscape(pubKey)}'`,
          `--bearer-token '${shellEscape(bearerToken)}'`,
          `--control-plane '${shellEscape(controlPlaneUrl)}'`,
        ]
          .filter(Boolean)
          .join(" ");

        // install.sh emits `[benisploy-setup] STEP_DONE:<name>` markers on
        // stdout as each step finishes; map them to phase events so the
        // wizard's ticks update live instead of all-or-nothing at the end.
        const stepToPhase: Record<string, number> = {
          docker: 2,
          user: 3,
          forced_command: 5,
          ssh: 4,
          node_monitor: 6,
          systemd: 7,
        };
        const stepDone = new Set<number>();
        let stdoutBuffer = "";

        function* flushMarkers(): Generator<ProvisionEvent, void, unknown> {
          const lines = stdoutBuffer.split("\n");
          stdoutBuffer = lines.pop() ?? "";
          for (const line of lines) {
            const m = line.match(/\[benisploy-setup\] STEP_DONE:(\w+)/);
            if (m) {
              const phase = stepToPhase[m[1]];
              if (phase !== undefined && !stepDone.has(phase)) {
                stepDone.add(phase);
                yield { phase, label: PHASES[phase], status: "done" };
              }
            }
          }
        }

        try {
          for await (const chunk of streamCommandOutput(
            client,
            installCmd,
            120_000,
          )) {
            stdoutBuffer += chunk;
            yield* flushMarkers();
          }
        } catch (err) {
          // Parse the full captured output: mark every completed step done,
          // then fail at the first step whose marker is missing.
          stdoutBuffer +=
            err instanceof ProvisionSshError ? (err.stdout ?? "") : "";
          yield* flushMarkers();

          const failedPhase = [2, 3, 4, 5, 6, 7].find((p) => !stepDone.has(p));
          const message =
            err instanceof Error ? err.message : "Provisioning failed";
          yield {
            type: "error",
            phase: failedPhase ?? -1,
            message,
          };
          return;
        }

        yield { phase: 2, label: PHASES[2], status: "done" };
        yield { phase: 3, label: PHASES[3], status: "done" };
        yield { phase: 4, label: PHASES[4], status: "done" };
        yield { phase: 5, label: PHASES[5], status: "done" };
        yield { phase: 6, label: PHASES[6], status: "done" };
        yield { phase: 7, label: PHASES[7], status: "done" };

        // Phase 8: verify heartbeat — poll for up to 15s
        yield { phase: 8, label: PHASES[8], status: "active" };
        let heartbeatReceived = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const updated = await repo.servers.get(orgId, serverId);
          if (updated?.status === "online" && updated.lastHeartbeatAt != null) {
            heartbeatReceived = true;
            break;
          }
        }
        if (heartbeatReceived) {
          yield { phase: 8, label: PHASES[8], status: "done" };
        } else {
          // Non-fatal: persist the node so the monitor's token stays valid —
          // the service auto-restarts and should connect shortly after.
          yield {
            phase: 8,
            label: PHASES[8],
            status: "error",
            error:
              "Monitor installed but no heartbeat received within 15s. The service will auto-restart and should connect shortly.",
          };
        }

        // Persist to DB
        await repo.registeredNodes.create({
          id: crypto.randomUUID(),
          serverId: server.id,
          sshPublicKey: pubKey,
          monitorBearerToken: bearerToken,
        });

        const now = new Date().toISOString();
        await repo.servers.provision(orgId, serverId, {
          sshPrivateKey: keyPair.privateKey,
          sshUser: "benisploy",
          cpuCores: specs.cpuCores,
          memoryBytes: specs.memoryBytes,
          diskBytes: specs.diskBytes,
          status: "online",
          lastHeartbeatAt: now,
          hostKeyFingerprint: hostFingerprint,
        });

        yield { type: "done", serverId: server.id };
      } finally {
        client.end();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Provisioning failed";
      const knownErrors = resolveKnownErrors(message, auth.username);
      yield {
        type: "error",
        phase: -1,
        message,
        ...(knownErrors.length > 0 ? { knownErrors } : {}),
      };
    }
  };
}
