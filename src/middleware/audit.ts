import { Request, Response, NextFunction } from "express";
import { readJson, writeJson } from "../storage/store.js";
import { PATHS } from "../storage/paths.js";
import type { AuditLog, AuditEntry } from "../types/hub.js";

const MAX_AUDIT_ENTRIES = 10_000;

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Capture original end to log after response
  const originalEnd = res.end;
  res.end = function (...args: Parameters<typeof originalEnd>) {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      agent_id: req.auth?.agentId || req.auth?.type || "anonymous",
      action: `${req.method} ${req.path}`,
      details: `${res.statusCode} (${Date.now() - start}ms)`,
      ip: req.ip || req.socket.remoteAddress || "unknown",
      success: res.statusCode < 400,
    };

    // Fire and forget — don't block response
    appendAuditEntry(entry);

    return originalEnd.apply(res, args);
  } as typeof originalEnd;

  next();
}

function appendAuditEntry(entry: AuditEntry): void {
  try {
    const log = readJson<AuditLog>(PATHS.audit, { schema_version: 1, entries: [] });
    log.entries.push(entry);

    // Rolling buffer
    if (log.entries.length > MAX_AUDIT_ENTRIES) {
      log.entries = log.entries.slice(-MAX_AUDIT_ENTRIES);
    }

    writeJson(PATHS.audit, log);
  } catch {
    // Audit logging should never crash the server
  }
}

export function getAuditLog(limit: number = 100): AuditEntry[] {
  const log = readJson<AuditLog>(PATHS.audit, { schema_version: 1, entries: [] });
  return log.entries.slice(-limit).reverse();
}
