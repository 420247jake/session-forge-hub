import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { readdirSync } from "fs";
import { readJson } from "../storage/store.js";
import { PATHS, agentFile } from "../storage/paths.js";
import type { HubConfig, AuthContext } from "../types/hub.js";
import type { AgentRecord } from "../types/agent.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header. Use: Bearer <api_key>" });
    return;
  }

  const key = authHeader.slice(7);

  // Check if admin key
  if (key.startsWith("sfh_admin_")) {
    const hubConfig = readJson<HubConfig | null>(PATHS.hub, null);
    if (!hubConfig) {
      res.status(500).json({ error: "Hub not initialized" });
      return;
    }

    const valid = await bcrypt.compare(key, hubConfig.admin_key_hash);
    if (valid) {
      req.auth = { type: "admin" };
      next();
      return;
    }

    res.status(403).json({ error: "Invalid admin key" });
    return;
  }

  // Check if agent key
  if (key.startsWith("sfh_agent_")) {
    const agentId = await findAgentByKey(key);
    if (agentId) {
      req.auth = { type: "agent", agentId };
      next();
      return;
    }

    res.status(403).json({ error: "Invalid agent key" });
    return;
  }

  res.status(401).json({ error: "Unrecognized key format. Keys start with sfh_admin_ or sfh_agent_" });
}

async function findAgentByKey(key: string): Promise<string | null> {
  try {
    const files = readdirSync(PATHS.agents).filter(f => f.endsWith(".json"));
    for (const file of files) {
      const agent = readJson<AgentRecord | null>(agentFile(file.replace(".json", "")), null);
      if (!agent || agent.status !== "active") continue;

      // Quick prefix check before expensive bcrypt
      if (key.substring(0, 18) !== agent.api_key_prefix) continue;

      const valid = await bcrypt.compare(key, agent.api_key_hash);
      if (valid) return agent.id;
    }
  } catch {
    // agents dir may not exist yet
  }
  return null;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.type !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function requireAgentOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}
