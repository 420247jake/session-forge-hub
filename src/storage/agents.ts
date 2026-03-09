import { randomBytes } from "crypto";
import { readdirSync } from "fs";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { readJson, writeJson, ensureDir } from "./store.js";
import { PATHS, agentFile, agentDataDir } from "./paths.js";
import type { AgentRecord, AgentRegistration } from "../types/agent.js";
import type { HubConfig } from "../types/hub.js";

export function generateAgentKey(): string {
  return `sfh_agent_${randomBytes(16).toString("hex")}`;
}

export async function registerAgent(registration: AgentRegistration): Promise<{ agent: AgentRecord; apiKey: string }> {
  // Check max agents
  const hubConfig = readJson<HubConfig | null>(PATHS.hub, null);
  const agents = listAgents();
  const activeCount = agents.filter(a => a.status === "active").length;

  if (hubConfig && activeCount >= hubConfig.max_agents) {
    throw new Error(`Maximum agents reached (${hubConfig.max_agents}). Deactivate an agent first.`);
  }

  const id = uuidv4();
  const apiKey = generateAgentKey();
  const hash = await bcrypt.hash(apiKey, 12);

  const agent: AgentRecord = {
    id,
    name: registration.name,
    developer: registration.developer,
    machine: registration.machine,
    api_key_hash: hash,
    api_key_prefix: apiKey.substring(0, 18),
    registered_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    status: "active",
    total_checkpoints: 0,
    total_decisions: 0,
    total_dead_ends: 0,
    total_journal_entries: 0,
    tags: registration.tags || [],
  };

  ensureDir(PATHS.agents);
  writeJson(agentFile(id), agent);

  // Create agent data directory
  ensureDir(agentDataDir(id));

  return { agent, apiKey };
}

export function listAgents(): AgentRecord[] {
  try {
    const files = readdirSync(PATHS.agents).filter(f => f.endsWith(".json"));
    return files.map(f => {
      const id = f.replace(".json", "");
      return readJson<AgentRecord>(agentFile(id), null as unknown as AgentRecord);
    }).filter(Boolean);
  } catch {
    return [];
  }
}

export function getAgent(id: string): AgentRecord | null {
  return readJson<AgentRecord | null>(agentFile(id), null);
}

export function updateAgent(id: string, updates: Partial<Pick<AgentRecord, "name" | "tags" | "status">>): AgentRecord | null {
  const agent = getAgent(id);
  if (!agent) return null;

  if (updates.name !== undefined) agent.name = updates.name;
  if (updates.tags !== undefined) agent.tags = updates.tags;
  if (updates.status !== undefined) agent.status = updates.status;

  writeJson(agentFile(id), agent);
  return agent;
}

export function touchAgent(id: string): void {
  const agent = getAgent(id);
  if (agent) {
    agent.last_seen = new Date().toISOString();
    writeJson(agentFile(id), agent);
  }
}

export function incrementAgentStat(id: string, field: "total_checkpoints" | "total_decisions" | "total_dead_ends" | "total_journal_entries", amount: number = 1): void {
  const agent = getAgent(id);
  if (agent) {
    agent[field] += amount;
    agent.last_seen = new Date().toISOString();
    writeJson(agentFile(id), agent);
  }
}

export async function rotateAgentKey(id: string): Promise<string | null> {
  const agent = getAgent(id);
  if (!agent || agent.status !== "active") return null;

  const newKey = generateAgentKey();
  const hash = await bcrypt.hash(newKey, 12);

  agent.api_key_hash = hash;
  agent.api_key_prefix = newKey.substring(0, 18);
  writeJson(agentFile(id), agent);

  return newKey;
}

export function deactivateAgent(id: string): boolean {
  const agent = getAgent(id);
  if (!agent) return false;

  agent.status = "inactive";
  writeJson(agentFile(id), agent);
  return true;
}
