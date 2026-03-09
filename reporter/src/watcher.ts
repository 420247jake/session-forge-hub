import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { sendWithRetry } from "./sender.js";
import type { ReporterConfig } from "./config.js";

interface WatchedFile {
  path: string;
  lastModified: number;
  lastEntryCount: number;
  type: "decisions" | "dead-ends" | "journal" | "checkpoints" | "profile";
  endpoint: string;
  arrayKey: string;
}

export class ForgeWatcher {
  private config: ReporterConfig;
  private files: WatchedFile[];
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(config: ReporterConfig) {
    this.config = config;

    const dir = config.forgeDataDir;
    this.files = [
      { path: join(dir, "decisions.json"), lastModified: 0, lastEntryCount: 0, type: "decisions", endpoint: "/api/ingest/decision", arrayKey: "decisions" },
      { path: join(dir, "dead-ends.json"), lastModified: 0, lastEntryCount: 0, type: "dead-ends", endpoint: "/api/ingest/dead-end", arrayKey: "dead_ends" },
      { path: join(dir, "journal.json"), lastModified: 0, lastEntryCount: 0, type: "journal", endpoint: "/api/ingest/journal", arrayKey: "sessions" },
      { path: join(dir, "sessions", "active.json"), lastModified: 0, lastEntryCount: 0, type: "checkpoints", endpoint: "/api/ingest/checkpoint", arrayKey: "_single" },
      { path: join(dir, "profile.json"), lastModified: 0, lastEntryCount: 0, type: "profile", endpoint: "/api/ingest/profile", arrayKey: "_single" },
    ];
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    // Initialize last known state
    for (const file of this.files) {
      this.initializeFile(file);
    }

    console.log(`[reporter] Watching ${this.config.forgeDataDir}`);
    console.log(`[reporter] Polling every ${this.config.pollIntervalMs}ms`);

    this.interval = setInterval(() => this.poll(), this.config.pollIntervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log("[reporter] Stopped");
  }

  private initializeFile(file: WatchedFile): void {
    if (!existsSync(file.path)) return;

    try {
      const stat = statSync(file.path);
      file.lastModified = stat.mtimeMs;

      if (file.arrayKey !== "_single") {
        const data = JSON.parse(readFileSync(file.path, "utf-8"));
        const entries = data[file.arrayKey] || [];
        file.lastEntryCount = entries.length;
      }
    } catch {
      // File might not exist yet
    }
  }

  private async poll(): Promise<void> {
    for (const file of this.files) {
      if (!existsSync(file.path)) continue;

      try {
        const stat = statSync(file.path);
        if (stat.mtimeMs <= file.lastModified) continue;

        // File changed
        file.lastModified = stat.mtimeMs;
        const raw = readFileSync(file.path, "utf-8");
        const data = JSON.parse(raw);

        if (file.arrayKey === "_single") {
          // Single-object files (checkpoint, profile)
          await this.sendSingle(file, data);
        } else {
          // Array-based files — send only new entries
          await this.sendNewEntries(file, data);
        }
      } catch (err) {
        // Silently skip — file might be mid-write
      }
    }
  }

  private async sendSingle(file: WatchedFile, data: unknown): Promise<void> {
    const result = await sendWithRetry(
      this.config.hubUrl,
      this.config.agentApiKey,
      file.endpoint,
      data,
      this.config.retryMaxAttempts
    );

    if (result.success) {
      console.log(`[reporter] Synced ${file.type}`);
    } else {
      console.error(`[reporter] Failed to sync ${file.type}: ${result.error || result.status}`);
    }
  }

  private async sendNewEntries(file: WatchedFile, data: Record<string, unknown>): Promise<void> {
    const entries = (data[file.arrayKey] || []) as unknown[];
    const newCount = entries.length;

    if (newCount <= file.lastEntryCount) {
      file.lastEntryCount = newCount;
      return;
    }

    // Send only new entries
    const newEntries = entries.slice(file.lastEntryCount);
    let sent = 0;

    for (const entry of newEntries) {
      const result = await sendWithRetry(
        this.config.hubUrl,
        this.config.agentApiKey,
        file.endpoint,
        entry,
        this.config.retryMaxAttempts
      );

      if (result.success) {
        sent++;
      } else {
        console.error(`[reporter] Failed to sync ${file.type} entry: ${result.error || result.status}`);
        break; // Stop on failure to maintain order
      }
    }

    file.lastEntryCount = file.lastEntryCount + sent;
    if (sent > 0) {
      console.log(`[reporter] Synced ${sent} new ${file.type}`);
    }
  }

  async syncAll(): Promise<void> {
    console.log("[reporter] Full sync starting...");

    for (const file of this.files) {
      if (!existsSync(file.path)) continue;

      try {
        const raw = readFileSync(file.path, "utf-8");
        const data = JSON.parse(raw);

        if (file.arrayKey === "_single") {
          await this.sendSingle(file, data);
        } else {
          const entries = (data[file.arrayKey] || []) as unknown[];
          const count = entries.length;
          // Reset count to 0 to send everything
          file.lastEntryCount = 0;
          console.log(`[reporter] Syncing ${count} ${file.type} entries...`);
          await this.sendNewEntries(file, data);
        }
      } catch {
        console.error(`[reporter] Failed to read ${file.path}`);
      }
    }

    console.log("[reporter] Full sync complete");
  }
}
