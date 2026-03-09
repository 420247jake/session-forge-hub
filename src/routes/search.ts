import { Router, Request, Response } from "express";
import { readdirSync } from "fs";
import { requireAdmin } from "../middleware/auth.js";
import { getAgentDecisions, getAgentDeadEnds } from "../storage/ingest.js";
import { getAgent } from "../storage/agents.js";
import { PATHS } from "../storage/paths.js";

export const searchRoutes = Router();

interface SearchResult {
  agent_id: string;
  agent_name: string;
  score: number;
  timestamp: string;
  [key: string]: unknown;
}

function basicSearch(text: string, query: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  const lowerText = text.toLowerCase();
  let score = 0;

  for (const word of words) {
    if (lowerText.includes(word)) {
      score += 2;
      // Bonus for exact word boundary match
      if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lowerText)) {
        score += 1;
      }
    }
  }

  return score;
}

// GET /api/search/decisions
searchRoutes.get("/decisions", requireAdmin, (req: Request, res: Response) => {
  const query = (req.query.q as string) || "";
  const projectFilter = req.query.project as string;
  const tagFilter = req.query.tags as string;
  const limit = parseInt(req.query.limit as string) || 30;

  if (!query && !projectFilter && !tagFilter) {
    res.status(400).json({ error: "Provide at least one of: q, project, tags" });
    return;
  }

  const results: SearchResult[] = [];
  const tags = tagFilter ? tagFilter.split(",") : [];

  try {
    const agentDirs = readdirSync(PATHS.data);
    for (const agentId of agentDirs) {
      const agent = getAgent(agentId);
      if (!agent || agent.status !== "active") continue;

      const decisions = getAgentDecisions(agentId, 200);
      for (const d of decisions) {
        // Project filter
        if (projectFilter && d.project !== projectFilter) continue;

        // Tag filter
        if (tags.length > 0 && !tags.some(t => d.tags?.includes(t))) continue;

        // Text search
        let score = 0;
        if (query) {
          const searchText = [d.choice, d.reasoning, ...(d.alternatives || []), d.outcome || ""].join(" ");
          score = basicSearch(searchText, query);
          if (score === 0) continue;
        } else {
          score = 1; // Matched by filter only
        }

        results.push({
          agent_id: agentId,
          agent_name: agent.name,
          score,
          timestamp: d.timestamp,
          choice: d.choice,
          reasoning: d.reasoning,
          project: d.project,
          tags: d.tags,
        });
      }
    }
  } catch { /* empty */ }

  results.sort((a, b) => b.score - a.score || b.timestamp.localeCompare(a.timestamp));
  res.json({ results: results.slice(0, limit), total: results.length });
});

// GET /api/search/dead-ends
searchRoutes.get("/dead-ends", requireAdmin, (req: Request, res: Response) => {
  const query = (req.query.q as string) || "";
  const projectFilter = req.query.project as string;
  const tagFilter = req.query.tags as string;
  const limit = parseInt(req.query.limit as string) || 30;

  if (!query && !projectFilter && !tagFilter) {
    res.status(400).json({ error: "Provide at least one of: q, project, tags" });
    return;
  }

  const results: SearchResult[] = [];
  const tags = tagFilter ? tagFilter.split(",") : [];

  try {
    const agentDirs = readdirSync(PATHS.data);
    for (const agentId of agentDirs) {
      const agent = getAgent(agentId);
      if (!agent || agent.status !== "active") continue;

      const deadEnds = getAgentDeadEnds(agentId, 100);
      for (const de of deadEnds) {
        if (projectFilter && de.project !== projectFilter) continue;
        if (tags.length > 0 && !tags.some(t => de.tags?.includes(t))) continue;

        let score = 0;
        if (query) {
          const searchText = [de.attempted, de.why_failed, de.lesson || ""].join(" ");
          score = basicSearch(searchText, query);
          if (score === 0) continue;
        } else {
          score = 1;
        }

        results.push({
          agent_id: agentId,
          agent_name: agent.name,
          score,
          timestamp: de.timestamp,
          attempted: de.attempted,
          why_failed: de.why_failed,
          lesson: de.lesson,
          project: de.project,
          tags: de.tags,
        });
      }
    }
  } catch { /* empty */ }

  results.sort((a, b) => b.score - a.score || b.timestamp.localeCompare(a.timestamp));
  res.json({ results: results.slice(0, limit), total: results.length });
});
