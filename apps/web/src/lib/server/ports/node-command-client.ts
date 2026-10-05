import type { CloneAuth } from "./git-provider-client";

export interface LogEntry {
  timestamp: string;
  stream: "stdout" | "stderr";
  message: string;
}

export interface ContainerState {
  id: string;
  name: string;
  image: string;
  project: string;
  service: string;
  created: string;
  state: string;
  status: string;
  ports: string;
  health?: string;
}

export interface NodeCommandClient {
  deploy(
    serverId: string,
    appId: string,
    composeYaml: string,
  ): AsyncIterable<LogEntry>;
  /**
   * Clone a git repo into the app's build-context, checkout `commit`
   * (default: HEAD of the default branch), and run `docker compose build`.
   * The compose file is uploaded first so the build action can resolve the
   * service definition. Clone credentials travel via the SSH stdin payload,
   * never argv.
   */
  build(
    serverId: string,
    appId: string,
    composeYaml: string,
    gitUrl: string,
    commit?: string,
    cloneAuth?: CloneAuth,
  ): Promise<void>;
  /**
   * Atomically write the Traefik file-provider dynamic config for an app to
   * `/opt/benisploy/traefik/dynamic/<app-id>.yml` (SFTP to `.tmp`, then
   * rename). Traefik's file watcher reloads within milliseconds — no restart.
   */
  writeTraefikDynamic(
    serverId: string,
    appId: string,
    yaml: string,
  ): Promise<void>;
  restart(serverId: string, appId: string): Promise<void>;
  stop(serverId: string, appId: string): Promise<void>;
  remove(serverId: string, appId: string, volumes: boolean): Promise<void>;
  status(serverId: string, appId: string): Promise<ContainerState[]>;
  logs(serverId: string, appId: string, lines: number): Promise<LogEntry[]>;
  isReachable(serverId: string): Promise<boolean>;
  deployColor(
    serverId: string,
    appId: string,
    color: "blue" | "green",
    composeYaml: string,
  ): AsyncIterable<LogEntry>;
  stopColor(
    serverId: string,
    appId: string,
    color: "blue" | "green",
  ): Promise<void>;
  colorStatus(
    serverId: string,
    appId: string,
    color: "blue" | "green",
  ): Promise<ContainerState[]>;
}
