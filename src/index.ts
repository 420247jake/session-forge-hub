#!/usr/bin/env node

import express from "express";
import helmet from "helmet";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { config } from "./config.js";
import { PATHS } from "./storage/paths.js";
import { readJson, writeJson, ensureDir } from "./storage/store.js";
import { authMiddleware } from "./middleware/auth.js";
import { auditMiddleware } from "./middleware/audit.js";
import { rateLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errors.js";
import { agentRoutes } from "./routes/agents.js";
import { ingestRoutes } from "./routes/ingest.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { adminRoutes } from "./routes/admin.js";
import { searchRoutes } from "./routes/search.js";
import { reportRoutes } from "./routes/reports.js";
import { stripeRoutes } from "./routes/stripe.js";
import { syncRoutes } from "./routes/sync.js";
import type { HubConfig } from "./types/hub.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function initHub(): Promise<string | null> {
  // Ensure all data directories exist
  ensureDir(PATHS.root);
  ensureDir(PATHS.agents);
  ensureDir(PATHS.data);
  ensureDir(PATHS.dailyReports);
  ensureDir(PATHS.weeklyReports);

  // Check if this is first run
  const existing = readJson<HubConfig | null>(PATHS.hub, null);
  if (existing) return null;

  // First run — generate admin key
  const adminKey = `sfh_admin_${randomBytes(16).toString("hex")}`;
  const hash = await bcrypt.hash(adminKey, 12);

  const hubConfig: HubConfig = {
    admin_key_hash: hash,
    admin_key_prefix: adminKey.substring(0, 18),
    hub_name: config.hubName,
    created_at: new Date().toISOString(),
    max_agents: config.maxAgents,
    retention_days: config.retentionDays,
    schema_version: 1,
  };

  writeJson(PATHS.hub, hubConfig);
  return adminKey;
}

async function main() {
  const adminKey = await initHub();

  const app = express();

  // Security headers (no external resources)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://js.stripe.com"],
        frameSrc: ["https://js.stripe.com"],
        imgSrc: ["'self'", "data:"],
      },
    },
  }));

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Serve static dashboard
  const publicDir = join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  // Audit + rate limiting on API routes
  app.use("/api", rateLimiter);
  app.use("/api", auditMiddleware);

  // API routes
  app.use("/api/agents", authMiddleware, agentRoutes);
  app.use("/api/ingest", authMiddleware, ingestRoutes);
  app.use("/api/dashboard", authMiddleware, dashboardRoutes);
  app.use("/api/search", authMiddleware, searchRoutes);
  app.use("/api/reports", authMiddleware, reportRoutes);
  app.use("/api/sync", authMiddleware, syncRoutes);
  app.use("/api/admin", adminRoutes); // has its own auth checks
  app.use("/api/donate", stripeRoutes);

  // Error handler
  app.use(errorHandler);

  app.listen(config.port, config.host, () => {
    console.log("");
    console.log("  ╔══════════════════════════════════════════════╗");
    console.log("  ║          session-forge hub v1.0.0            ║");
    console.log("  ╠══════════════════════════════════════════════╣");
    console.log(`  ║  Dashboard: http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.port}${" ".repeat(Math.max(0, 17 - String(config.port).length))}║`);
    console.log(`  ║  Data dir:  ${config.dataDir.length > 32 ? "..." + config.dataDir.slice(-29) : config.dataDir.padEnd(32)}║`);
    console.log("  ╚══════════════════════════════════════════════╝");

    if (adminKey) {
      console.log("");
      console.log("  ┌─ FIRST RUN ─────────────────────────────────┐");
      console.log("  │                                              │");
      console.log("  │  Your admin API key (save it — shown ONCE):  │");
      console.log("  │                                              │");
      console.log(`  │  ${adminKey}  │`);
      console.log("  │                                              │");
      console.log("  │  Use this key to:                            │");
      console.log("  │  • Access the dashboard                      │");
      console.log("  │  • Register agents                           │");
      console.log("  │  • View reports                              │");
      console.log("  │                                              │");
      console.log("  └──────────────────────────────────────────────┘");
    }

    console.log("");
  });
}

main().catch((err) => {
  console.error("Failed to start session-forge hub:", err);
  process.exit(1);
});
