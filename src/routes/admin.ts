import { Router, Request, Response } from "express";
import { authMiddleware, requireAdmin } from "../middleware/auth.js";
import { getAuditLog } from "../middleware/audit.js";

export const adminRoutes = Router();

// Health check — no auth required
adminRoutes.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Everything else requires admin auth
adminRoutes.use(authMiddleware);
adminRoutes.use(requireAdmin);

// GET /api/admin/audit
adminRoutes.get("/audit", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const entries = getAuditLog(limit);
  res.json({ entries, count: entries.length });
});
