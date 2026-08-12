export interface ServerInfo {
  id: string;
  name: string;
  address: string;
  sshPort: number;
  sshUser: string;
  status: string;
  cpuCores: number;
  memoryBytes: number;
  diskBytes: number;
  lastHeartbeatAt: string | null | undefined;
  createdAt: string;
}

export interface StatsPoint {
  receivedAt: string;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
}

export interface EventItem {
  id: string;
  appId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}
