export interface AgentRecord {
  id: string;
  name: string;
  developer: string;
  machine: string;
  api_key_hash: string;
  api_key_prefix: string;
  registered_at: string;
  last_seen: string;
  status: "active" | "inactive";
  total_checkpoints: number;
  total_decisions: number;
  total_dead_ends: number;
  total_journal_entries: number;
  tags: string[];
}

export interface AgentRegistration {
  name: string;
  developer: string;
  machine: string;
  tags?: string[];
}
