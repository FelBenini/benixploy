export interface NodeEvent {
  id: string;
  serverId: string;
  appId?: string;
  eventType:
    | "die"
    | "oom"
    | "unhealthy"
    | "restart_loop"
    | "traefik_reload_ok"
    | "traefik_reload_failed"
    | "deploy_started"
    | "build_failed"
    | "deploy_failed"
    | "deploy_done";
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface NodeStats {
  id: string;
  serverId: string;
  cpuPercent: number;
  memoryTotal: number;
  memoryUsed: number;
  memoryAvailable: number;
  diskTotal: number;
  diskUsed: number;
  uptime: number;
  containerCount: number;
  containerStates: Array<{ id: string; name: string; state: string }>;
  receivedAt: string;
}
