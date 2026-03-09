import { readdirSync } from "fs";
import { readJson, writeJson, ensureDir } from "./store.js";
import { PATHS, agentDataDir, agentDataFile } from "./paths.js";
import { incrementAgentStat, touchAgent } from "./agents.js";
import type { SessionCheckpoint, DecisionEntry, DeadEndEntry, JournalEntry, UserProfile } from "../types/ingest.js";

interface DataFile<T> {
  schema_version: number;
  entries: T[];
}

const MAX_ENTRIES = {
  checkpoints: 500,
  decisions: 200,
  dead_ends: 100,
  journal: 100,
};

function appendEntry<T>(agentId: string, fileName: string, entry: T, maxKey: keyof typeof MAX_ENTRIES): void {
  ensureDir(agentDataDir(agentId));
  const filePath = agentDataFile(agentId, `${fileName}.json`);
  const data = readJson<DataFile<T>>(filePath, { schema_version: 1, entries: [] });

  data.entries.push(entry);

  // Cap entries
  const max = MAX_ENTRIES[maxKey];
  if (data.entries.length > max) {
    data.entries = data.entries.slice(-max);
  }

  writeJson(filePath, data);
}

export function ingestCheckpoint(agentId: string, checkpoint: SessionCheckpoint): void {
  appendEntry(agentId, "checkpoints", checkpoint, "checkpoints");
  incrementAgentStat(agentId, "total_checkpoints");
  touchAgent(agentId);
}

export function ingestDecision(agentId: string, decision: DecisionEntry): void {
  appendEntry(agentId, "decisions", decision, "decisions");
  incrementAgentStat(agentId, "total_decisions");
  touchAgent(agentId);
}

export function ingestDeadEnd(agentId: string, deadEnd: DeadEndEntry): void {
  appendEntry(agentId, "dead-ends", deadEnd, "dead_ends");
  incrementAgentStat(agentId, "total_dead_ends");
  touchAgent(agentId);
}

export function ingestJournal(agentId: string, entry: JournalEntry): void {
  appendEntry(agentId, "journal", entry, "journal");
  incrementAgentStat(agentId, "total_journal_entries");
  touchAgent(agentId);
}

export function ingestProfile(agentId: string, profile: UserProfile): void {
  ensureDir(agentDataDir(agentId));
  writeJson(agentDataFile(agentId, "profile.json"), { schema_version: 1, ...profile });
  touchAgent(agentId);
}

export function getAgentCheckpoints(agentId: string, limit: number = 50): SessionCheckpoint[] {
  const data = readJson<DataFile<SessionCheckpoint>>(agentDataFile(agentId, "checkpoints.json"), { schema_version: 1, entries: [] });
  return data.entries.slice(-limit).reverse();
}

export function getAgentDecisions(agentId: string, limit: number = 50): DecisionEntry[] {
  const data = readJson<DataFile<DecisionEntry>>(agentDataFile(agentId, "decisions.json"), { schema_version: 1, entries: [] });
  return data.entries.slice(-limit).reverse();
}

export function getAgentDeadEnds(agentId: string, limit: number = 50): DeadEndEntry[] {
  const data = readJson<DataFile<DeadEndEntry>>(agentDataFile(agentId, "dead-ends.json"), { schema_version: 1, entries: [] });
  return data.entries.slice(-limit).reverse();
}

export function getAgentJournal(agentId: string, limit: number = 20): JournalEntry[] {
  const data = readJson<DataFile<JournalEntry>>(agentDataFile(agentId, "journal.json"), { schema_version: 1, entries: [] });
  return data.entries.slice(-limit).reverse();
}

export function getAgentProfile(agentId: string): UserProfile | null {
  const data = readJson<(UserProfile & { schema_version: number }) | null>(agentDataFile(agentId, "profile.json"), null);
  return data;
}

export function getAllDecisions(): Array<DecisionEntry & { agent_id: string }> {
  const results: Array<DecisionEntry & { agent_id: string }> = [];

  try {
    const agentDirs = readdirSync(PATHS.data);
    for (const agentId of agentDirs) {
      const decisions = getAgentDecisions(agentId, 200);
      for (const d of decisions) {
        results.push({ ...d, agent_id: agentId });
      }
    }
  } catch { /* empty data dir */ }

  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getAllDeadEnds(): Array<DeadEndEntry & { agent_id: string }> {
  const results: Array<DeadEndEntry & { agent_id: string }> = [];

  try {
    const agentDirs = readdirSync(PATHS.data);
    for (const agentId of agentDirs) {
      const deadEnds = getAgentDeadEnds(agentId, 100);
      for (const d of deadEnds) {
        results.push({ ...d, agent_id: agentId });
      }
    }
  } catch { /* empty data dir */ }

  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
