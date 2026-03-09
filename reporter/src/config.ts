import { join } from "path";
import { platform, env } from "process";
import { readFileSync, existsSync } from "fs";

export interface ReporterConfig {
  hubUrl: string;
  agentApiKey: string;
  forgeDataDir: string;
  pollIntervalMs: number;
  batchMode: boolean;
  retryMaxAttempts: number;
  // Sync mode options
  syncMode: false | "export" | "import";
  syncOutput: string;
  syncImportFile: string;
  syncScope: "all" | "self" | "select";
  syncAgentIds: string[];
}

function getDefaultForgeDir(): string {
  if (platform === "win32") {
    return join(env.APPDATA || join(env.USERPROFILE || "C:\\Users\\Default", "AppData", "Roaming"), "session-forge");
  }
  return join(env.HOME || "/tmp", ".session-forge");
}

function getConfigFilePath(): string {
  if (platform === "win32") {
    return join(env.APPDATA || "", "session-forge-reporter.json");
  }
  return join(env.HOME || "/tmp", ".session-forge-reporter.json");
}

export function loadConfig(args: string[]): ReporterConfig {
  const config: ReporterConfig = {
    hubUrl: "",
    agentApiKey: "",
    forgeDataDir: env.SESSION_FORGE_DIR || getDefaultForgeDir(),
    pollIntervalMs: 5000,
    batchMode: true,
    retryMaxAttempts: 5,
    syncMode: false,
    syncOutput: "",
    syncImportFile: "",
    syncScope: "all",
    syncAgentIds: [],
  };

  // Try config file first
  const configPath = getConfigFilePath();
  if (existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(readFileSync(configPath, "utf-8"));
      if (fileConfig.hubUrl) config.hubUrl = fileConfig.hubUrl;
      if (fileConfig.agentApiKey) config.agentApiKey = fileConfig.agentApiKey;
      if (fileConfig.forgeDataDir) config.forgeDataDir = fileConfig.forgeDataDir;
      if (fileConfig.pollIntervalMs) config.pollIntervalMs = fileConfig.pollIntervalMs;
      if (fileConfig.batchMode !== undefined) config.batchMode = fileConfig.batchMode;
    } catch {
      console.error(`Failed to read config file: ${configPath}`);
    }
  }

  // CLI args override config file
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--hub":
        config.hubUrl = args[++i] || "";
        break;
      case "--key":
        config.agentApiKey = args[++i] || "";
        break;
      case "--forge-dir":
        config.forgeDataDir = args[++i] || config.forgeDataDir;
        break;
      case "--poll":
        config.pollIntervalMs = parseInt(args[++i]) || 5000;
        break;
      case "sync":
        // Next arg determines export or import
        config.syncMode = "export"; // default sync mode
        break;
      case "--output":
        config.syncOutput = args[++i] || "";
        break;
      case "--import":
        config.syncMode = "import";
        config.syncImportFile = args[++i] || "";
        break;
      case "--scope":
        config.syncScope = (args[++i] || "all") as "all" | "self" | "select";
        break;
      case "--agents":
        config.syncAgentIds = (args[++i] || "").split(",").filter(Boolean);
        if (config.syncAgentIds.length > 0) config.syncScope = "select";
        break;
      case "--help":
        console.log(`
session-forge-reporter — Sync your session-forge data to a hub server

Usage:
  npx session-forge-reporter --hub <url> --key <api_key>

Watch mode (default):
  Watches local session-forge data and pushes changes to the hub.

Sync mode:
  npx session-forge-reporter sync --hub <url> --key <admin_key> --output backup.json
  npx session-forge-reporter sync --hub <url> --key <admin_key> --import backup.json
  npx session-forge-reporter sync --hub <url> --key <admin_key> --agents id1,id2 --output partial.json

Options:
  --hub <url>        Hub server URL (e.g. http://192.168.1.100:3700)
  --key <key>        API key (sfh_agent_... for watch, sfh_admin_... for sync)
  --forge-dir <dir>  Session-forge data directory (default: auto-detected)
  --poll <ms>        Poll interval in milliseconds (default: 5000)
  --output <file>    Export hub data to this JSON file
  --import <file>    Import data from a JSON file into the hub
  --scope <scope>    Export scope: all, self, select (default: all)
  --agents <ids>     Comma-separated agent IDs (implies --scope select)
  --help             Show this help

Config file:
  Create ~/.session-forge-reporter.json (or %APPDATA%/session-forge-reporter.json):
  {
    "hubUrl": "http://192.168.1.100:3700",
    "agentApiKey": "sfh_agent_..."
  }
`);
        process.exit(0);
    }
  }

  return config;
}
