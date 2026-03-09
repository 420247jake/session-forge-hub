import { join } from "path";
import { platform, env } from "process";

function getDefaultDataDir(): string {
  if (platform === "win32") {
    return join(env.APPDATA || join(env.USERPROFILE || "C:\\Users\\Default", "AppData", "Roaming"), "session-forge-hub");
  }
  return join(env.HOME || "/tmp", ".session-forge-hub");
}

export const config = {
  port: parseInt(env.PORT || "3700", 10),
  host: env.HOST || "0.0.0.0",
  dataDir: env.SESSION_FORGE_HUB_DIR || getDefaultDataDir(),
  hubName: env.HUB_NAME || "session-forge hub",
  maxAgents: parseInt(env.MAX_AGENTS || "50", 10),
  retentionDays: parseInt(env.RETENTION_DAYS || "90", 10),
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY || null,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY || null,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || null,
  },
};
