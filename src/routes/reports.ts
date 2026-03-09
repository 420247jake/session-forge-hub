import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { listAgents } from "../storage/agents.js";
import { getAgentDecisions, getAgentDeadEnds, getAgentCheckpoints, getAgentJournal } from "../storage/ingest.js";
import { readJson, writeJson } from "../storage/store.js";
import { PATHS } from "../storage/paths.js";
import { join } from "path";
import type { DailyReport } from "../types/reports.js";

export const reportRoutes = Router();

function generateDailyReport(dateStr: string): DailyReport {
  const agents = listAgents().filter(a => a.status === "active");
  const report: DailyReport = {
    date: dateStr,
    generated_at: new Date().toISOString(),
    agents_active: 0,
    total_checkpoints: 0,
    total_decisions: 0,
    total_dead_ends: 0,
    total_journal_entries: 0,
    top_projects: [],
    top_tags: [],
    highlights: { breakthroughs: [], critical_dead_ends: [], key_decisions: [] },
  };

  const projectCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const agent of agents) {
    let agentActive = false;

    // Checkpoints for this date
    const checkpoints = getAgentCheckpoints(agent.id, 500);
    const todayCheckpoints = checkpoints.filter(c => c.timestamp.startsWith(dateStr));
    report.total_checkpoints += todayCheckpoints.length;
    if (todayCheckpoints.length > 0) agentActive = true;

    // Decisions for this date
    const decisions = getAgentDecisions(agent.id, 200);
    const todayDecisions = decisions.filter(d => d.timestamp.startsWith(dateStr));
    report.total_decisions += todayDecisions.length;
    if (todayDecisions.length > 0) agentActive = true;

    for (const d of todayDecisions) {
      if (d.project) projectCounts.set(d.project, (projectCounts.get(d.project) || 0) + 1);
      for (const t of d.tags || []) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      report.highlights.key_decisions.push({ agent: agent.name, text: d.choice });
    }

    // Dead ends for this date
    const deadEnds = getAgentDeadEnds(agent.id, 100);
    const todayDeadEnds = deadEnds.filter(de => de.timestamp.startsWith(dateStr));
    report.total_dead_ends += todayDeadEnds.length;
    if (todayDeadEnds.length > 0) agentActive = true;

    for (const de of todayDeadEnds) {
      report.highlights.critical_dead_ends.push({ agent: agent.name, text: `${de.attempted}: ${de.why_failed}` });
    }

    // Journal entries for this date
    const journal = getAgentJournal(agent.id, 100);
    const todayJournal = journal.filter(j => j.timestamp.startsWith(dateStr));
    report.total_journal_entries += todayJournal.length;

    for (const j of todayJournal) {
      for (const b of j.breakthroughs || []) {
        report.highlights.breakthroughs.push({ agent: agent.name, text: b });
      }
    }

    if (agentActive) report.agents_active++;
  }

  report.top_projects = Array.from(projectCounts.entries())
    .map(([project, count]) => ({ project, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  report.top_tags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Limit highlights
  report.highlights.key_decisions = report.highlights.key_decisions.slice(0, 10);
  report.highlights.critical_dead_ends = report.highlights.critical_dead_ends.slice(0, 10);
  report.highlights.breakthroughs = report.highlights.breakthroughs.slice(0, 10);

  return report;
}

// GET /api/reports/daily
reportRoutes.get("/daily", requireAdmin, (req: Request, res: Response) => {
  const dateStr = (req.query.date as string) || new Date().toISOString().split("T")[0];
  const reportPath = join(PATHS.dailyReports, `${dateStr}.json`);

  // Check cache
  let report = readJson<DailyReport | null>(reportPath, null);

  // Regenerate if not cached or if it's today (live data)
  const isToday = dateStr === new Date().toISOString().split("T")[0];
  if (!report || isToday) {
    report = generateDailyReport(dateStr);
    writeJson(reportPath, report);
  }

  res.json(report);
});

// POST /api/reports/generate (force regenerate)
reportRoutes.post("/generate", requireAdmin, (req: Request, res: Response) => {
  const dateStr = (req.body.date as string) || new Date().toISOString().split("T")[0];
  const report = generateDailyReport(dateStr);
  const reportPath = join(PATHS.dailyReports, `${dateStr}.json`);
  writeJson(reportPath, report);
  res.json(report);
});
