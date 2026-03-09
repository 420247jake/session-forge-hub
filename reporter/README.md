# session-forge-reporter

**Syncs your local session-forge data to a [session-forge hub](https://www.npmjs.com/package/session-forge-hub) server.**

This is the bridge between [`session-forge`](https://www.npmjs.com/package/session-forge) (running on each developer's machine) and [`session-forge-hub`](https://www.npmjs.com/package/session-forge-hub) (running on your company's LAN). It watches your local session-forge JSON files for changes and sends new entries to the hub over HTTP.

---

## How It Fits Together

```
Developer's Machine                          Company LAN Server
┌─────────────────────────────────┐          ┌──────────────────────────┐
│                                 │          │                          │
│  Claude Code                    │          │  session-forge hub       │
│       ↓ (MCP)                   │          │  http://192.168.x.x:3700 │
│  session-forge                  │          │                          │
│       ↓ (writes JSON)           │          │  Dashboard, Search,      │
│  ~/.session-forge/              │          │  Reports, Audit Log      │
│       ↓ (watches files)         │   HTTP   │                          │
│  session-forge-reporter  ───────────────→  │  REST API + JSON Storage │
│                                 │  (LAN)   │                          │
└─────────────────────────────────┘          └──────────────────────────┘
```

---

## Prerequisites

1. **session-forge** must be installed and configured in your Claude Code setup. This is what generates the data.
2. **session-forge hub** must be running on your network. Your team lead or IT admin sets this up.
3. You need an **agent API key** (`sfh_agent_...`) — your admin creates this in the hub dashboard.

---

## Quick Start

```bash
npx session-forge-reporter --hub http://YOUR_HUB_IP:3700 --key sfh_agent_...
```

That's it. On startup, it does a full sync of all existing data, then polls for new changes every 5 seconds.

---

## Configuration

### CLI Flags

```bash
npx session-forge-reporter \
  --hub <url>          # Hub server URL (required)
  --key <key>          # Agent API key (required)
  --forge-dir <dir>    # session-forge data directory (auto-detected)
  --poll <ms>          # Poll interval in milliseconds (default: 5000)
```

### Config File

Instead of CLI flags, create a config file:

**Linux/Mac:** `~/.session-forge-reporter.json`
**Windows:** `%APPDATA%/session-forge-reporter.json`

```json
{
  "hubUrl": "http://192.168.1.100:3700",
  "agentApiKey": "sfh_agent_..."
}
```

CLI flags override config file values.

---

## What It Syncs

The reporter watches these session-forge data files:

| File | What it contains |
|------|-----------------|
| `decisions.json` | Architectural decisions with reasoning and alternatives |
| `dead-ends.json` | Failed approaches with lessons learned |
| `journal.json` | Session summaries with breakthroughs and frustrations |
| `sessions/active.json` | Current session checkpoint (task, status, next steps) |
| `profile.json` | Developer profile and preferences |

Only **new entries** are sent after the initial sync. The reporter tracks how many entries it has already synced and only sends the delta.

---

## How It Works

1. **Startup** — full sync: reads all local data files and sends everything to the hub
2. **Polling** — every 5 seconds (configurable), checks file modification times
3. **Delta sync** — if a file changed, reads it and sends only new entries (by array index)
4. **Retry** — failed sends are retried with exponential backoff (up to 5 attempts)
5. **Auth errors** — 401/403 responses are not retried (bad key, deactivated agent)

---

## Zero Dependencies

This package uses only Node.js built-in modules (`fs`, `http`, `path`). No external dependencies.

---

## Related Packages

- [`session-forge`](https://www.npmjs.com/package/session-forge) — the MCP server that generates the data
- [`session-forge-hub`](https://www.npmjs.com/package/session-forge-hub) — the dashboard server that collects and displays it

---

## License

MIT

---

Built by [Jacob Terrell](https://github.com/420247jake)
