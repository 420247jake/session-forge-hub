import { Router, Request, Response } from "express";
import { z } from "zod";
import { registerAgent, listAgents, getAgent, updateAgent, deactivateAgent, rotateAgentKey } from "../storage/agents.js";
import { requireAdmin } from "../middleware/auth.js";

export const agentRoutes = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  developer: z.string().min(1).max(100),
  machine: z.string().min(1).max(100),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// Register a new agent (admin only)
agentRoutes.post("/register", requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid registration data", details: parsed.error.issues });
      return;
    }

    const { agent, apiKey } = await registerAgent(parsed.data);

    res.status(201).json({
      message: "Agent registered successfully. Save the API key — it won't be shown again.",
      agent_id: agent.id,
      api_key: apiKey,
      agent: {
        id: agent.id,
        name: agent.name,
        developer: agent.developer,
        machine: agent.machine,
        registered_at: agent.registered_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    res.status(400).json({ error: message });
  }
});

// List all agents (admin only)
agentRoutes.get("/", requireAdmin, (_req: Request, res: Response) => {
  const agents = listAgents().map(a => ({
    id: a.id,
    name: a.name,
    developer: a.developer,
    machine: a.machine,
    status: a.status,
    registered_at: a.registered_at,
    last_seen: a.last_seen,
    total_checkpoints: a.total_checkpoints,
    total_decisions: a.total_decisions,
    total_dead_ends: a.total_dead_ends,
    total_journal_entries: a.total_journal_entries,
    tags: a.tags,
  }));

  res.json({ agents, count: agents.length });
});

// Get single agent
agentRoutes.get("/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;

  // Agents can only view themselves
  if (req.auth?.type === "agent" && req.auth.agentId !== id) {
    res.status(403).json({ error: "Agents can only view their own data" });
    return;
  }

  const agent = getAgent(id);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json({
    id: agent.id,
    name: agent.name,
    developer: agent.developer,
    machine: agent.machine,
    status: agent.status,
    registered_at: agent.registered_at,
    last_seen: agent.last_seen,
    total_checkpoints: agent.total_checkpoints,
    total_decisions: agent.total_decisions,
    total_dead_ends: agent.total_dead_ends,
    total_journal_entries: agent.total_journal_entries,
    tags: agent.tags,
  });
});

// Update agent (admin only)
agentRoutes.patch("/:id", requireAdmin, (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, tags } = req.body;

  const updated = updateAgent(id, { name, tags });
  if (!updated) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json({ message: "Agent updated", agent: updated });
});

// Deactivate agent (admin only)
agentRoutes.delete("/:id", requireAdmin, (req: Request, res: Response) => {
  const success = deactivateAgent(req.params.id as string);
  if (!success) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json({ message: "Agent deactivated" });
});

// Rotate agent key (admin only)
agentRoutes.post("/:id/rotate-key", requireAdmin, async (req: Request, res: Response) => {
  const newKey = await rotateAgentKey(req.params.id as string);
  if (!newKey) {
    res.status(404).json({ error: "Agent not found or inactive" });
    return;
  }
  res.json({
    message: "API key rotated. Save the new key — it won't be shown again.",
    api_key: newKey,
  });
});
