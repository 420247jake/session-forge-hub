import { join } from "path";
import { config } from "../config.js";

export const PATHS = {
  root: config.dataDir,
  hub: join(config.dataDir, "hub.json"),
  stats: join(config.dataDir, "stats.json"),
  audit: join(config.dataDir, "audit.json"),
  agents: join(config.dataDir, "agents"),
  data: join(config.dataDir, "data"),
  reports: join(config.dataDir, "reports"),
  dailyReports: join(config.dataDir, "reports", "daily"),
  weeklyReports: join(config.dataDir, "reports", "weekly"),
};

export function agentFile(agentId: string): string {
  return join(PATHS.agents, `${agentId}.json`);
}

export function agentDataDir(agentId: string): string {
  return join(PATHS.data, agentId);
}

export function agentDataFile(agentId: string, file: string): string {
  return join(PATHS.data, agentId, file);
}
