#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { ForgeWatcher } from "./watcher.js";

const config = loadConfig(process.argv.slice(2));

if (!config.hubUrl) {
  console.error("Error: Hub URL required. Use --hub <url> or set in config file.");
  console.error("Run with --help for usage.");
  process.exit(1);
}

if (!config.agentApiKey) {
  console.error("Error: Agent API key required. Use --key <key> or set in config file.");
  console.error("Run with --help for usage.");
  process.exit(1);
}

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
