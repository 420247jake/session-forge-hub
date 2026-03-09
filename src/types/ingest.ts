// Mirrors session-forge types — this is the contract between agent and hub

export interface SessionCheckpoint {
  timestamp: string;
  task: string;
  intent: string;
  status: "IN_PROGRESS" | "BLOCKED" | "WAITING_USER" | "COMPLETED";
  files_touched?: string[];
  recent_actions?: string[];
  next_steps?: string[];
  context?: Record<string, unknown>;
  tool_call_count?: number;
  errors_encountered?: string[];
  key_findings?: string[];
  decisions_made?: string[];
  dead_ends_hit?: string[];
}

export interface DecisionEntry {
  timestamp: string;
  choice: string;
  alternatives?: string[];
  reasoning: string;
  outcome?: string | null;
  project?: string | null;
  tags?: string[];
  related_dead_ends?: string[];
}

export interface DeadEndEntry {
  timestamp: string;
  attempted: string;
  why_failed: string;
  lesson?: string;
  project?: string | null;
  files_involved?: string[];
  tags?: string[];
  led_to_decision?: string | null;
}

export interface JournalEntry {
  timestamp: string;
  session_summary: string;
  key_moments?: string[];
  emotional_context?: string | null;
  breakthroughs?: string[];
  frustrations?: string[];
  collaboration_notes?: string | null;
}

export interface UserProfile {
  name: string | null;
  preferences?: Record<string, string>;
  projects?: string[];
  notes?: Array<{ text: string; timestamp: string }>;
}

export interface IngestPayload<T> {
  agent_id: string;
  data: T;
  timestamp: string;
}

export interface BatchPayload {
  agent_id: string;
  checkpoints?: SessionCheckpoint[];
  decisions?: DecisionEntry[];
  dead_ends?: DeadEndEntry[];
  journal_entries?: JournalEntry[];
  profile?: UserProfile;
}
