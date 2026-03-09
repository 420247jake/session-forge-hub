import { Router, Request, Response } from "express";
import { listAgents, getAgent } from "../storage/agents.js";
import { getAgentCheckpoints, getAgentDecisions, getAgentDeadEnds, getAgentJournal, getAgentProfile } from "../storage/ingest.js";
import { readJson } from "../storage/store.js";
import { PATHS } from "../storage/paths.js";
import { requireAdmin } from "../middleware/auth.js";
import type { HubStats } from "../types/hub.js";

export const dashboardRoutes = Router();

// GET /api/dashboard/overview (admin only)
dashboardRoutes.get("/overview", requireAdmin, (_req: Request, res: Response) => {
  const agents = listAgents();
  const now = Date.now();
  const oneHourAgo = now - 3_600_000;

  const activeAgents = agents.filter(a => a.status === "active");
  const recentlyActive = activeAgents.filter(a => new Date(a.last_seen).getTime() > oneHourAgo);

  const totals = agents.reduce((acc, a) => ({
    checkpoints: acc.checkpoints + a.total_checkpoints,
    decisions: acc.decisions + a.total_decisions,
    dead_ends: acc.dead_ends + a.total_dead_ends,
    journal_entries: acc.journal_entries + a.total_journal_entries,
  }), { checkpoints: 0, decisions: 0, dead_ends: 0, journal_entries: 0 });

  res.json({
    hub_name: readJson<{ hub_name: string }>(PATHS.hub, { hub_name: "session-forge hub" }).hub_name,
    agents: {
      total: agents.length,
      active: activeAgents.length,
      online_now: recentlyActive.length,
    },
    totals,
    agents_list: activeAgents.map(a => ({
      id: a.id,
      name: a.name,
      developer: a.developer,
      machine: a.machine,
      last_seen: a.last_seen,
      total_checkpoints: a.total_checkpoints,
      total_decisions: a.total_decisions,
      total_dead_ends: a.total_dead_ends,
    })),
  });
});

// GET /api/dashboard/activity (admin only — recent events across all agents)
dashboardRoutes.get("/activity", requireAdmin, (_req: Request, res: Response) => {
  const agents = listAgents().filter(a => a.status === "active");
  const events: Array<{ type: string; agent_id: string; agent_name: string; timestamp: string; summary: string }> = [];

  for (const agent of agents) {
    // Get recent checkpoints
    const checkpoints = getAgentCheckpoints(agent.id, 5);
    for (const cp of checkpoints) {
      events.push({
        type: "checkpoint",
        agent_id: agent.id,
        agent_name: agent.name,
        timestamp: cp.timestamp,
        summary: `${cp.task} — ${cp.status}`,
      });
    }

    // Get recent decisions
    const decisions = getAgentDecisions(agent.id, 5);
    for (const d of decisions) {
      events.push({
        type: "decision",
        agent_id: agent.id,
        agent_name: agent.name,
        timestamp: d.timestamp,
        summary: d.choice,
      });
    }

    // Get recent dead ends
    const deadEnds = getAgentDeadEnds(agent.id, 5);
    for (const de of deadEnds) {
      events.push({
        type: "dead_end",
        agent_id: agent.id,
        agent_name: agent.name,
        timestamp: de.timestamp,
        summary: `${de.attempted} — ${de.why_failed}`,
      });
    }

    // Get recent journal entries
    const journal = getAgentJournal(agent.id, 3);
    for (const j of journal) {
      events.push({
        type: "journal",
        agent_id: agent.id,
        agent_name: agent.name,
        timestamp: j.timestamp,
        summary: j.session_summary,
      });
    }
  }

  // Sort by timestamp descending, limit to 50
  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json({ events: events.slice(0, 50) });
});

// GET /api/dashboard/agent/:id/activity
dashboardRoutes.get("/agent/:id/activity", (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (req.auth?.type === "agent" && req.auth.agentId !== id) {
    res.status(403).json({ error: "Agents can only view their own data" });
    return;
  }

  const agent = getAgent(id);
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

  const checkpoints = getAgentCheckpoints(id, 20);
  const decisions = getAgentDecisions(id, 20);
  const deadEnds = getAgentDeadEnds(id, 20);
  const journal = getAgentJournal(id, 10);
  const profile = getAgentProfile(id);

  res.json({ agent: { id: agent.id, name: agent.name, developer: agent.developer }, checkpoints, decisions, dead_ends: deadEnds, journal, profile });
});

// GET /api/dashboard/agent/:id/decisions
dashboardRoutes.get("/agent/:id/decisions", (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (req.auth?.type === "agent" && req.auth.agentId !== id) {
    res.status(403).json({ error: "Agents can only view their own data" });
    return;
  }
  const limit = parseInt(req.query.limit as string) || 50;
  res.json({ decisions: getAgentDecisions(id, limit) });
});

// GET /api/dashboard/agent/:id/dead-ends
dashboardRoutes.get("/agent/:id/dead-ends", (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (req.auth?.type === "agent" && req.auth.agentId !== id) {
    res.status(403).json({ error: "Agents can only view their own data" });
    return;
  }
  const limit = parseInt(req.query.limit as string) || 50;
  res.json({ dead_ends: getAgentDeadEnds(id, limit) });
});

// GET /api/dashboard/agent/:id/checkpoints
dashboardRoutes.get("/agent/:id/checkpoints", (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (req.auth?.type === "agent" && req.auth.agentId !== id) {
    res.status(403).json({ error: "Agents can only view their own data" });
    return;
  }
  const limit = parseInt(req.query.limit as string) || 50;
  res.json({ checkpoints: getAgentCheckpoints(id, limit) });
});
