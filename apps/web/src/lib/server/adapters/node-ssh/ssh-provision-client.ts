import { Client, type ConnectConfig } from "ssh2";
import SFTPClient from "ssh2-sftp-client";

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
  ) {
    super(message);
    this.name = "ProvisionSshError";
  }
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

export function executeCommand(
  client: Client,
  command: string,
  timeoutMs = 60_000,
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
        stderr += data.toString();
      });

      channel.on("data", (data: Buffer) => {
        stdout += data.toString();
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
