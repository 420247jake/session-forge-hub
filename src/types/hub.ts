export interface HubConfig {
  admin_key_hash: string;
  admin_key_prefix: string;
  hub_name: string;
  created_at: string;
  max_agents: number;
  retention_days: number;
  schema_version: number;
}

export interface AuditEntry {
  timestamp: string;
  agent_id: string;
  action: string;
  details: string;
  ip: string;
  success: boolean;
}

export interface AuditLog {
  schema_version: number;
  entries: AuditEntry[];
}

export interface HubStats {
  schema_version: number;
  total_agents: number;
  total_checkpoints: number;
  total_decisions: number;
  total_dead_ends: number;
  total_journal_entries: number;
  total_api_calls: number;
  last_updated: string;
}

export interface AuthContext {
  type: "admin" | "agent";
  agentId?: string;
}
