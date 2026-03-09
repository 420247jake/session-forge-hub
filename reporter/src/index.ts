#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { ForgeWatcher } from "./watcher.js";
import { syncExport, syncImport } from "./sender.js";

const config = loadConfig(process.argv.slice(2));

if (!config.hubUrl) {
  console.error("Error: Hub URL required. Use --hub <url> or set in config file.");
  console.error("Run with --help for usage.");
  process.exit(1);
}

if (!config.agentApiKey) {
  console.error("Error: API key required. Use --key <key> or set in config file.");
  console.error("Run with --help for usage.");
  process.exit(1);
}

// --- Sync mode ---
if (config.syncMode) {
  console.log("");
  console.log("  session-forge-reporter v1.0.0 (sync mode)");
  console.log(`  Hub:  ${config.hubUrl}`);
  console.log(`  Key:  ${config.agentApiKey.substring(0, 18)}...`);
  console.log("");

  if (config.syncMode === "import") {
    if (!config.syncImportFile) {
      console.error("Error: Import file required. Use --import <file>");
      process.exit(1);
    }
    syncImport(config.hubUrl, config.agentApiKey, config.syncImportFile);
  } else {
    // export
    const output = config.syncOutput || `session-forge-hub-export-${new Date().toISOString().split("T")[0]}.json`;
    syncExport(config.hubUrl, config.agentApiKey, output, config.syncScope, config.syncAgentIds);
  }
} else {
  // --- Watch mode (default) ---
  console.log("");
  console.log("  session-forge-reporter v1.0.0");
  console.log(`  Hub:      ${config.hubUrl}`);
  console.log(`  Key:      ${config.agentApiKey.substring(0, 18)}...`);
  console.log(`  Watching: ${config.forgeDataDir}`);
  console.log("");

  const watcher = new ForgeWatcher(config);

  // Do a full sync on start, then watch for changes
  watcher.syncAll().then(() => {
    watcher.start();
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[reporter] Shutting down...");
    watcher.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    watcher.stop();
    process.exit(0);
  });
}
