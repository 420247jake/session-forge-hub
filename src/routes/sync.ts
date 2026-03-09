import { Router, Request, Response, NextFunction } from 'express';
import { requireAdmin, requireAgentOrAdmin } from '../middleware/auth.js';
import { getAgent, listAgents } from '../storage/agents.js';
import {
  getAgentCheckpoints,
  getAgentDecisions,
  getAgentDeadEnds,
  getAgentJournal,
  getAgentProfile,
  ingestCheckpoint,
  ingestDecision,
  ingestDeadEnd,
  ingestJournal,
  ingestProfile,
} from '../storage/ingest.js';
import { readJson } from '../storage/store.js';
import { PATHS } from '../storage/paths.js';
import { SyncExportRequestSchema, SyncImportRequestSchema } from '../types/sync.js';
import type {
  SyncExportBundle,
  SyncExportAgentData,
  SyncDataType,
  SyncScope,
} from '../types/sync.js';
import type { HubConfig } from '../types/hub.js';
import type { SessionCheckpoint, DecisionEntry, DeadEndEntry, JournalEntry } from '../types/ingest.js';

export const syncRoutes = Router();

// All sync routes require authentication
syncRoutes.use(requireAgentOrAdmin);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_DATA_TYPES: SyncDataType[] = ['checkpoints', 'decisions', 'dead_ends', 'journal', 'profile'];

function filterByDateRange<T extends { timestamp?: string }>(
  entries: T[],
  dateFrom?: string,
  dateTo?: string,
): T[] {
  if (!dateFrom && !dateTo) return entries;

  return entries.filter((entry) => {
    const ts = (entry as Record<string, unknown>).timestamp as string | undefined;
    if (!ts) return true;
    if (dateFrom && ts < dateFrom) return false;
    if (dateTo && ts > dateTo) return false;
    return true;
  });
}

function filterByProject<T>(entries: T[], project?: string): T[] {
  if (!project) return entries;
  return entries.filter((entry) => (entry as Record<string, unknown>).project === project);
}

function collectAgentData(
  agentId: string,
  dataTypes: SyncDataType[],
  dateFrom?: string,
  dateTo?: string,
  project?: string,
): { data: Partial<SyncExportAgentData>; counts: { checkpoints: number; decisions: number; dead_ends: number; journal: number } } {
  const data: Partial<SyncExportAgentData> = {};
  const counts = { checkpoints: 0, decisions: 0, dead_ends: 0, journal: 0 };

  if (dataTypes.includes('checkpoints')) {
    let checkpoints = getAgentCheckpoints(agentId, 500);
    checkpoints = filterByDateRange(checkpoints, dateFrom, dateTo);
    data.checkpoints = checkpoints;
    counts.checkpoints = checkpoints.length;
  }

  if (dataTypes.includes('decisions')) {
    let decisions = getAgentDecisions(agentId, 200);
    decisions = filterByDateRange(decisions, dateFrom, dateTo);
    decisions = filterByProject(decisions, project);
    data.decisions = decisions;
    counts.decisions = decisions.length;
  }

  if (dataTypes.includes('dead_ends')) {
    let deadEnds = getAgentDeadEnds(agentId, 100);
    deadEnds = filterByDateRange(deadEnds, dateFrom, dateTo);
    deadEnds = filterByProject(deadEnds, project);
    data.dead_ends = deadEnds;
    counts.dead_ends = deadEnds.length;
  }

  if (dataTypes.includes('journal')) {
    let journal = getAgentJournal(agentId, 100);
    journal = filterByDateRange(journal, dateFrom, dateTo);
    data.journal = journal;
    counts.journal = journal.length;
  }

  if (dataTypes.includes('profile')) {
    data.profile = getAgentProfile(agentId);
  }

  return { data, counts };
}

// ─── POST /api/sync/export ────────────────────────────────────────────────────

syncRoutes.post('/export', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = SyncExportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid export request', details: parsed.error.issues });
      return;
    }

    const request = parsed.data;

    // Agents can only export their own data
    let scope: SyncScope = request.scope;
    if (req.auth?.type === 'agent') {
      scope = 'self';
    }

    // Determine which agents to export
    let agentIds: string[];

    if (scope === 'self') {
      if (!req.auth?.agentId) {
        res.status(400).json({ error: 'Agent ID not found in auth context' });
        return;
      }
      agentIds = [req.auth.agentId];
    } else if (scope === 'select') {
      agentIds = request.agent_ids || [];
    } else {
      // scope === 'all'
      agentIds = listAgents()
        .filter((a) => a.status === 'active')
        .map((a) => a.id);
    }

    // Determine data types to export
    const dataTypes: SyncDataType[] = request.data_types || ALL_DATA_TYPES;

    // Load hub config for hub_name
    const hubConfig = readJson<HubConfig | null>(PATHS.hub, null);
    const hubName = hubConfig?.hub_name || 'unknown';

    // Determine exported_by
    let exportedBy = 'admin';
    if (req.auth?.type === 'agent' && req.auth.agentId) {
      const agent = getAgent(req.auth.agentId);
      exportedBy = agent?.name || req.auth.agentId;
    }

    // Collect data for each agent
    const agentsData: SyncExportAgentData[] = [];
    const totalCounts = { checkpoints: 0, decisions: 0, dead_ends: 0, journal: 0 };

    for (const agentId of agentIds) {
      const agent = getAgent(agentId);
      if (!agent) continue;

      const { data, counts } = collectAgentData(
        agentId,
        dataTypes,
        request.date_from,
        request.date_to,
        request.project,
      );

      agentsData.push({
        agent_id: agentId,
        agent_name: agent.name,
        developer: agent.developer,
        machine: agent.machine,
        ...data,
      });

      totalCounts.checkpoints += counts.checkpoints;
      totalCounts.decisions += counts.decisions;
      totalCounts.dead_ends += counts.dead_ends;
      totalCounts.journal += counts.journal;
    }

    const bundle: SyncExportBundle = {
      hub_name: hubName,
      exported_at: new Date().toISOString(),
      exported_by: exportedBy,
      scope,
      filters: {
        data_types: request.data_types || 'all',
        date_from: request.date_from,
        date_to: request.date_to,
        project: request.project,
      },
      agents: agentsData,
      stats: {
        total_agents: agentsData.length,
        total_checkpoints: totalCounts.checkpoints,
        total_decisions: totalCounts.decisions,
        total_dead_ends: totalCounts.dead_ends,
        total_journal_entries: totalCounts.journal,
      },
    };

    res.json(bundle);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/sync/import ────────────────────────────────────────────────────

syncRoutes.post('/import', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse merge strategy from query or body wrapper
    const strategyParsed = SyncImportRequestSchema.safeParse({
      merge_strategy: req.query.merge_strategy || req.body.merge_strategy || 'append',
    });
    if (!strategyParsed.success) {
      res.status(400).json({ error: 'Invalid import options', details: strategyParsed.error.issues });
      return;
    }

    const { merge_strategy } = strategyParsed.data;

    // The bundle is the request body (or nested under "bundle")
    const bundle: SyncExportBundle = req.body.bundle || req.body;

    if (!bundle.agents || !Array.isArray(bundle.agents)) {
      res.status(400).json({ error: 'Invalid import bundle: missing agents array' });
      return;
    }

    const results: Array<{
      agent_id: string;
      agent_name: string;
      status: 'imported' | 'skipped';
      reason?: string;
      imported: { checkpoints: number; decisions: number; dead_ends: number; journal: number; profile: boolean };
    }> = [];

    for (const agentData of bundle.agents) {
      const agent = getAgent(agentData.agent_id);
      if (!agent) {
        results.push({
          agent_id: agentData.agent_id,
          agent_name: agentData.agent_name,
          status: 'skipped',
          reason: 'Agent not registered on this hub',
          imported: { checkpoints: 0, decisions: 0, dead_ends: 0, journal: 0, profile: false },
        });
        continue;
      }

      const imported = { checkpoints: 0, decisions: 0, dead_ends: 0, journal: 0, profile: false };

      // Import checkpoints
      if (agentData.checkpoints && Array.isArray(agentData.checkpoints)) {
        for (const cp of agentData.checkpoints as SessionCheckpoint[]) {
          if (cp.timestamp && cp.task && cp.intent) {
            ingestCheckpoint(agentData.agent_id, cp);
            imported.checkpoints++;
          }
        }
      }

      // Import decisions
      if (agentData.decisions && Array.isArray(agentData.decisions)) {
        for (const d of agentData.decisions as DecisionEntry[]) {
          if (d.timestamp && d.choice && d.reasoning) {
            ingestDecision(agentData.agent_id, d);
            imported.decisions++;
          }
        }
      }

      // Import dead ends
      if (agentData.dead_ends && Array.isArray(agentData.dead_ends)) {
        for (const de of agentData.dead_ends as DeadEndEntry[]) {
          if (de.timestamp && de.attempted && de.why_failed) {
            ingestDeadEnd(agentData.agent_id, de);
            imported.dead_ends++;
          }
        }
      }

      // Import journal
      if (agentData.journal && Array.isArray(agentData.journal)) {
        for (const j of agentData.journal as JournalEntry[]) {
          if (j.timestamp && j.session_summary) {
            ingestJournal(agentData.agent_id, j);
            imported.journal++;
          }
        }
      }

      // Import profile (always replaces)
      if (agentData.profile && typeof agentData.profile === 'object') {
        ingestProfile(agentData.agent_id, agentData.profile as Parameters<typeof ingestProfile>[1]);
        imported.profile = true;
      }

      results.push({
        agent_id: agentData.agent_id,
        agent_name: agentData.agent_name,
        status: 'imported',
        imported,
      });
    }

    const totalImported = results.reduce(
      (acc, r) => ({
        checkpoints: acc.checkpoints + r.imported.checkpoints,
        decisions: acc.decisions + r.imported.decisions,
        dead_ends: acc.dead_ends + r.imported.dead_ends,
        journal: acc.journal + r.imported.journal,
      }),
      { checkpoints: 0, decisions: 0, dead_ends: 0, journal: 0 },
    );

    res.json({
      message: `Import complete: ${results.filter((r) => r.status === 'imported').length} agents imported, ${results.filter((r) => r.status === 'skipped').length} skipped`,
      merge_strategy,
      agents: results,
      totals: totalImported,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/sync/agents ─────────────────────────────────────────────────────

syncRoutes.get('/agents', requireAdmin, (_req: Request, res: Response, next: NextFunction) => {
  try {
    const agents = listAgents();

    const agentSummaries = agents
      .filter((a) => a.status === 'active')
      .map((a) => ({
        id: a.id,
        name: a.name,
        developer: a.developer,
        machine: a.machine,
        counts: {
          checkpoints: a.total_checkpoints,
          decisions: a.total_decisions,
          dead_ends: a.total_dead_ends,
          journal: a.total_journal_entries,
        },
      }));

    res.json({
      agents: agentSummaries,
      total: agentSummaries.length,
    });
  } catch (err) {
    next(err);
  }
});
