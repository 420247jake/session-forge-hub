import { z } from 'zod';

// Sync scope options
export type SyncScope = 'self' | 'all' | 'select';

// Sync data type filters
export type SyncDataType = 'checkpoints' | 'decisions' | 'dead_ends' | 'journal' | 'profile';

// Export request schema
export const SyncExportRequestSchema = z.object({
  scope: z.enum(['self', 'all', 'select']).default('self'),
  agent_ids: z.array(z.string().uuid()).optional(), // required when scope is 'select'
  data_types: z.array(z.enum(['checkpoints', 'decisions', 'dead_ends', 'journal', 'profile'])).optional(), // if omitted, export all types
  date_from: z.string().datetime().optional(), // ISO date, filter entries after this date
  date_to: z.string().datetime().optional(), // ISO date, filter entries before this date
  project: z.string().optional(), // filter by project tag
}).refine(
  (data) => data.scope !== 'select' || (data.agent_ids && data.agent_ids.length > 0),
  { message: 'agent_ids required when scope is "select"', path: ['agent_ids'] }
);

export type SyncExportRequest = z.infer<typeof SyncExportRequestSchema>;

// Export bundle - what gets returned
export interface SyncExportBundle {
  hub_name: string;
  exported_at: string;
  exported_by: string; // 'admin' or agent name
  scope: SyncScope;
  filters: {
    data_types: SyncDataType[] | 'all';
    date_from?: string;
    date_to?: string;
    project?: string;
  };
  agents: SyncExportAgentData[];
  stats: {
    total_agents: number;
    total_checkpoints: number;
    total_decisions: number;
    total_dead_ends: number;
    total_journal_entries: number;
  };
}

export interface SyncExportAgentData {
  agent_id: string;
  agent_name: string;
  developer: string;
  machine: string;
  checkpoints?: unknown[];
  decisions?: unknown[];
  dead_ends?: unknown[];
  journal?: unknown[];
  profile?: unknown;
}

// Import request - for importing a bundle
export const SyncImportRequestSchema = z.object({
  merge_strategy: z.enum(['append', 'replace']).default('append'), // append = add new entries, replace = overwrite
});

export type SyncImportRequest = z.infer<typeof SyncImportRequestSchema>;
