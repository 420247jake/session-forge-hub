import { Router, Request, Response } from "express";
import { z } from "zod";
import { ingestCheckpoint, ingestDecision, ingestDeadEnd, ingestJournal, ingestProfile } from "../storage/ingest.js";
import { getAgent } from "../storage/agents.js";

export const ingestRoutes = Router();

// Agents can only submit their own data
function validateAgentAccess(req: Request, res: Response): string | null {
  if (req.auth?.type !== "agent") {
    res.status(403).json({ error: "Only agents can submit data" });
    return null;
  }
  const agentId = req.auth.agentId!;
  const agent = getAgent(agentId);
  if (!agent || agent.status !== "active") {
    res.status(403).json({ error: "Agent not found or inactive" });
    return null;
  }
  return agentId;
}

const checkpointSchema = z.object({
  timestamp: z.string(),
  task: z.string().min(1),
  intent: z.string().min(1),
  status: z.enum(["IN_PROGRESS", "BLOCKED", "WAITING_USER", "COMPLETED"]),
  files_touched: z.array(z.string()).optional(),
  recent_actions: z.array(z.string()).optional(),
  next_steps: z.array(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
  tool_call_count: z.number().optional(),
  errors_encountered: z.array(z.string()).optional(),
  key_findings: z.array(z.string()).optional(),
  decisions_made: z.array(z.string()).optional(),
  dead_ends_hit: z.array(z.string()).optional(),
});

const decisionSchema = z.object({
  timestamp: z.string(),
  choice: z.string().min(1),
  alternatives: z.array(z.string()).optional(),
  reasoning: z.string().min(1),
  outcome: z.string().nullable().optional(),
  project: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  related_dead_ends: z.array(z.string()).optional(),
});

const deadEndSchema = z.object({
  timestamp: z.string(),
  attempted: z.string().min(1),
  why_failed: z.string().min(1),
  lesson: z.string().optional(),
  project: z.string().nullable().optional(),
  files_involved: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  led_to_decision: z.string().nullable().optional(),
});

const journalSchema = z.object({
  timestamp: z.string(),
  session_summary: z.string().min(1),
  key_moments: z.array(z.string()).optional(),
  emotional_context: z.string().nullable().optional(),
  breakthroughs: z.array(z.string()).optional(),
  frustrations: z.array(z.string()).optional(),
  collaboration_notes: z.string().nullable().optional(),
});

const profileSchema = z.object({
  name: z.string().nullable(),
  preferences: z.record(z.string()).optional(),
  projects: z.array(z.string()).optional(),
  notes: z.array(z.object({ text: z.string(), timestamp: z.string() })).optional(),
});

// POST /api/ingest/checkpoint
ingestRoutes.post("/checkpoint", (req: Request, res: Response) => {
  const agentId = validateAgentAccess(req, res);
  if (!agentId) return;

  const parsed = checkpointSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid checkpoint data", details: parsed.error.issues });
    return;
  }

  ingestCheckpoint(agentId, parsed.data);
  res.json({ message: "Checkpoint ingested", agent_id: agentId });
});

// POST /api/ingest/decision
ingestRoutes.post("/decision", (req: Request, res: Response) => {
  const agentId = validateAgentAccess(req, res);
  if (!agentId) return;

  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid decision data", details: parsed.error.issues });
    return;
  }

  ingestDecision(agentId, parsed.data);
  res.json({ message: "Decision ingested", agent_id: agentId });
});

// POST /api/ingest/dead-end
ingestRoutes.post("/dead-end", (req: Request, res: Response) => {
  const agentId = validateAgentAccess(req, res);
  if (!agentId) return;

  const parsed = deadEndSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid dead end data", details: parsed.error.issues });
    return;
  }

  ingestDeadEnd(agentId, parsed.data);
  res.json({ message: "Dead end ingested", agent_id: agentId });
});

// POST /api/ingest/journal
ingestRoutes.post("/journal", (req: Request, res: Response) => {
  const agentId = validateAgentAccess(req, res);
  if (!agentId) return;

  const parsed = journalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid journal data", details: parsed.error.issues });
    return;
  }

  ingestJournal(agentId, parsed.data);
  res.json({ message: "Journal entry ingested", agent_id: agentId });
});

// POST /api/ingest/profile
ingestRoutes.post("/profile", (req: Request, res: Response) => {
  const agentId = validateAgentAccess(req, res);
  if (!agentId) return;

  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile data", details: parsed.error.issues });
    return;
  }

  ingestProfile(agentId, parsed.data);
  res.json({ message: "Profile ingested", agent_id: agentId });
});

// POST /api/ingest/batch
ingestRoutes.post("/batch", (req: Request, res: Response) => {
  const agentId = validateAgentAccess(req, res);
  if (!agentId) return;

  const { checkpoints, decisions, dead_ends, journal_entries, profile } = req.body;
  let ingested = 0;

  if (checkpoints && Array.isArray(checkpoints)) {
    for (const cp of checkpoints) {
      const parsed = checkpointSchema.safeParse(cp);
      if (parsed.success) { ingestCheckpoint(agentId, parsed.data); ingested++; }
    }
  }

  if (decisions && Array.isArray(decisions)) {
    for (const d of decisions) {
      const parsed = decisionSchema.safeParse(d);
      if (parsed.success) { ingestDecision(agentId, parsed.data); ingested++; }
    }
  }

  if (dead_ends && Array.isArray(dead_ends)) {
    for (const de of dead_ends) {
      const parsed = deadEndSchema.safeParse(de);
      if (parsed.success) { ingestDeadEnd(agentId, parsed.data); ingested++; }
    }
  }

  if (journal_entries && Array.isArray(journal_entries)) {
    for (const j of journal_entries) {
      const parsed = journalSchema.safeParse(j);
      if (parsed.success) { ingestJournal(agentId, parsed.data); ingested++; }
    }
  }

  if (profile) {
    const parsed = profileSchema.safeParse(profile);
    if (parsed.success) { ingestProfile(agentId, parsed.data); ingested++; }
  }

  res.json({ message: `Batch ingested: ${ingested} entries`, agent_id: agentId, ingested });
});
