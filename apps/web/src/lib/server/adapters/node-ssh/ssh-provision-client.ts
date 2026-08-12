import { Client, type ConnectConfig } from "ssh2";
import SFTPClient from "ssh2-sftp-client";
import { createHash } from "node:crypto";

export type ProvisionCredentials =
  { type: "password"; password: string } | { type: "key"; privateKey: string };

export interface ProvisionAuth {
  host: string;
  port: number;
  username: string;
  credentials: ProvisionCredentials;
}

export class ProvisionSshError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly stdout?: string,
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = "ProvisionSshError";
  }
}

const FINGERPRINT_PREFIX = "SHA256:";

export function computeHostFingerprint(hostKey: Buffer): string {
  return (
    FINGERPRINT_PREFIX + createHash("sha256").update(hostKey).digest("base64")
  );
}

export interface TofuHostVerifier {
  verify: (key: Buffer) => boolean;
  fingerprint: string | null;
}

export function createTofuHostVerifier(
  storedFingerprint?: string | null,
): TofuHostVerifier {
  let captured: string | null = null;

  const verify = (key: Buffer): boolean => {
    const fp = computeHostFingerprint(key);

    if (storedFingerprint) {
      return fp === storedFingerprint;
    }

    if (captured === null) {
      captured = fp;
      return true;
    }

    return fp === captured;
  };

  return {
    verify,
    get fingerprint() {
      return captured;
    },
  };
}

export function connectForProvisioning(
  auth: ProvisionAuth,
  hostVerifier?: (key: Buffer) => boolean,
): Promise<Client> {
  return new Promise<Client>((resolve, reject) => {
    const client = new Client();
    let settled = false;

    client.on("ready", () => {
      if (settled) return;
      settled = true;
      resolve(client);
    });

    client.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(
        new ProvisionSshError(
          `SSH connection to ${auth.host}:${auth.port} failed: ${err.message}`,
          err,
        ),
      );
    });

    const cfg: ConnectConfig = {
      host: auth.host,
      port: auth.port,
      username: auth.username,
      readyTimeout: 15_000,
      hostVerifier: hostVerifier ?? (() => true),
    };

    if (auth.credentials.type === "password") {
      cfg.password = auth.credentials.password;
    } else {
      cfg.privateKey = auth.credentials.privateKey;
    }

    client.connect(cfg);
  });
}

export interface ExecuteCommandOptions {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export function executeCommand(
  client: Client,
  command: string,
  timeoutMs = 60_000,
  opts: ExecuteCommandOptions = {},
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new ProvisionSshError(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    client.exec(command, (err, channel) => {
      if (err) {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        reject(new ProvisionSshError(`exec failed: ${err.message}`, err));
        return;
      }

      let stdout = "";
      let stderr = "";

      channel.stderr.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        opts.onStderr?.(chunk);
      });

      channel.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        opts.onStdout?.(chunk);
      });

      channel.on("close", (exitCode: number | null) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        if (exitCode !== 0) {
          const reason =
            exitCode === null
              ? "killed by signal"
              : `exited with code ${exitCode}`;
          const detail = (stderr || stdout || "no output")
            .trim()
            .replace(/^\[benisploy-setup\]\s*/gm, "")
            .trim()
            .slice(0, 500);
          reject(
            new ProvisionSshError(
              `Command ${reason}: ${detail || "unknown error"}`,
              undefined,
              stdout,
              stderr,
            ),
          );
        } else {
          resolve({ stdout, stderr, exitCode });
        }
      });

      channel.stderr.on("error", () => {});
      channel.on("error", (chErr: Error) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        reject(new ProvisionSshError(`Channel error: ${chErr.message}`, chErr));
      });
    });
  });
}

/**
 * Streams a remote command's stdout as chunks, yielding each chunk to the
 * caller as it arrives so it can react to output before the command
 * finishes. On non-zero exit, throws a ProvisionSshError carrying the full
 * stdout/stderr.
 */
export async function* streamCommandOutput(
  client: Client,
  command: string,
  timeoutMs = 60_000,
): AsyncGenerator<string> {
  let stdout = "";
  let stderr = "";
  let closed = false;
  let exitCode: number | null = null;
  let execError: Error | null = null;
  const queued: string[] = [];
  const waiters: Array<() => void> = [];

  const timer = setTimeout(() => {
    if (closed) return;
    execError = new ProvisionSshError(`Command timed out after ${timeoutMs}ms`);
    const w = waiters.shift();
    w?.();
  }, timeoutMs);

  const push = (chunk: string) => {
    if (closed) return;
    queued.push(chunk);
    const w = waiters.shift();
    w?.();
  };

  client.exec(command, (err, channel) => {
    if (err) {
      clearTimeout(timer);
      if (closed) return;
      execError = new ProvisionSshError(`exec failed: ${err.message}`, err);
      const w = waiters.shift();
      w?.();
      return;
    }

    channel.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    channel.on("data", (data: Buffer) => {
      stdout += data.toString();
      push(data.toString());
    });

    channel.on("close", (code: number | null) => {
      clearTimeout(timer);
      closed = true;
      exitCode = code;
      const w = waiters.shift();
      w?.();
    });

    channel.stderr.on("error", () => {});
    channel.on("error", (chErr: Error) => {
      clearTimeout(timer);
      if (closed) return;
      execError = new ProvisionSshError(
        `Channel error: ${chErr.message}`,
        chErr,
      );
      const w = waiters.shift();
      w?.();
    });
  });

  while (true) {
    if (queued.length > 0) {
      yield queued.shift()!;
      continue;
    }
    if (execError) throw execError;
    if (closed) break;
    await new Promise<void>((resolve) => waiters.push(resolve));
  }

  if (exitCode !== 0) {
    const reason =
      exitCode === null ? "killed by signal" : `exited with code ${exitCode}`;
    const detail = (stderr || stdout || "no output")
      .trim()
      .replace(/^\[benisploy-setup\]\s*/gm, "")
      .trim()
      .slice(0, 500);
    throw new ProvisionSshError(
      `Command ${reason}: ${detail || "unknown error"}`,
      undefined,
      stdout,
      stderr,
    );
  }
}

export async function uploadFile(
  auth: ProvisionAuth,
  content: string,
  remotePath: string,
  hostVerifier?: (key: Buffer) => boolean,
): Promise<void> {
  const sftp = new SFTPClient();

  const cfg: Record<string, unknown> = {
    host: auth.host,
    port: auth.port,
    username: auth.username,
    readyTimeout: 15_000,
    hostVerifier: hostVerifier ?? (() => true),
  };

  if (auth.credentials.type === "password") {
    cfg.password = auth.credentials.password;
  } else {
    cfg.privateKey = auth.credentials.privateKey;
  }

  await sftp.connect(cfg);
  try {
    await sftp.put(Buffer.from(content), remotePath);
  } finally {
    await sftp.end();
  }
}
