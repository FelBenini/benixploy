export interface NodeEvent {
  id: string;
  serverId: string;
  appId?: string;
  eventType: "die" | "oom" | "unhealthy" | "restart_loop";
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
