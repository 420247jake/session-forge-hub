import { request } from "http";
import { request as httpsRequest } from "https";
import { URL } from "url";
import { writeFileSync, readFileSync } from "fs";

export interface SendResult {
  success: boolean;
  status?: number;
  body?: string;
  error?: string;
}

export async function sendToHub(hubUrl: string, apiKey: string, path: string, data: unknown): Promise<SendResult> {
  return new Promise((resolve) => {
    try {
      const url = new URL(path, hubUrl);
      const payload = JSON.stringify(data);
      const isHttps = url.protocol === "https:";

      const req = (isHttps ? httpsRequest : request)(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "Authorization": `Bearer ${apiKey}`,
        },
      }, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => {
          resolve({
            success: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            body,
          });
        });
      });

      req.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ success: false, error: "Request timed out" });
      });

      req.write(payload);
      req.end();
    } catch (err) {
      resolve({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });
}

export async function sendWithRetry(hubUrl: string, apiKey: string, path: string, data: unknown, maxAttempts: number): Promise<SendResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await sendToHub(hubUrl, apiKey, path, data);
    if (result.success) return result;

    // Don't retry on auth errors
    if (result.status === 401 || result.status === 403) return result;

    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return { success: false, error: `Failed after ${maxAttempts} attempts` };
}

// --- Sync: GET request helper ---

export async function getFromHub(hubUrl: string, apiKey: string, path: string): Promise<SendResult> {
  return new Promise((resolve) => {
    try {
      const url = new URL(path, hubUrl);
      const isHttps = url.protocol === "https:";

      const req = (isHttps ? httpsRequest : request)(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      }, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => {
          resolve({
            success: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            body,
          });
        });
      });

      req.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      req.setTimeout(30000, () => {
        req.destroy();
        resolve({ success: false, error: "Request timed out" });
      });

      req.end();
    } catch (err) {
      resolve({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });
}

// --- Sync: Export hub data to file ---

export async function syncExport(
  hubUrl: string,
  apiKey: string,
  outputPath: string,
  scope: string,
  agentIds: string[],
): Promise<void> {
  console.log("[sync] Exporting data from hub...");

  const body: Record<string, unknown> = { scope };
  if (scope === "select" && agentIds.length > 0) {
    body.agent_ids = agentIds;
  }

  const result = await sendToHub(hubUrl, apiKey, "/api/sync/export", body);

  if (!result.success) {
    console.error(`[sync] Export failed: ${result.error || `HTTP ${result.status}`}`);
    if (result.body) {
      try {
        const err = JSON.parse(result.body);
        console.error(`[sync] ${err.error || result.body}`);
      } catch {
        console.error(`[sync] ${result.body}`);
      }
    }
    process.exit(1);
  }

  try {
    const bundle = JSON.parse(result.body || "{}");
    writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf-8");
    console.log(`[sync] Export complete: ${outputPath}`);
    console.log(`[sync] Agents: ${bundle.stats?.total_agents || 0}`);
    console.log(`[sync] Checkpoints: ${bundle.stats?.total_checkpoints || 0}`);
    console.log(`[sync] Decisions: ${bundle.stats?.total_decisions || 0}`);
    console.log(`[sync] Dead ends: ${bundle.stats?.total_dead_ends || 0}`);
    console.log(`[sync] Journal entries: ${bundle.stats?.total_journal_entries || 0}`);
  } catch (err) {
    console.error("[sync] Failed to write export file:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// --- Sync: Import data from file to hub ---

export async function syncImport(
  hubUrl: string,
  apiKey: string,
  importPath: string,
): Promise<void> {
  console.log(`[sync] Importing data from ${importPath}...`);

  let bundle: unknown;
  try {
    const raw = readFileSync(importPath, "utf-8");
    bundle = JSON.parse(raw);
  } catch (err) {
    console.error("[sync] Failed to read import file:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const result = await sendToHub(hubUrl, apiKey, "/api/sync/import?merge_strategy=append", bundle);

  if (!result.success) {
    console.error(`[sync] Import failed: ${result.error || `HTTP ${result.status}`}`);
    if (result.body) {
      try {
        const err = JSON.parse(result.body);
        console.error(`[sync] ${err.error || result.body}`);
      } catch {
        console.error(`[sync] ${result.body}`);
      }
    }
    process.exit(1);
  }

  try {
    const response = JSON.parse(result.body || "{}");
    console.log(`[sync] ${response.message || "Import complete"}`);
    if (response.agents) {
      for (const agent of response.agents) {
        const status = agent.status === "imported" ? "OK" : "SKIP";
        console.log(`[sync]   ${status}: ${agent.agent_name} (${agent.imported?.checkpoints || 0} cp, ${agent.imported?.decisions || 0} dec, ${agent.imported?.dead_ends || 0} de, ${agent.imported?.journal || 0} jnl)`);
      }
    }
  } catch {
    console.log("[sync] Import complete");
  }
}
