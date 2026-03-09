# session-forge hub

**Team intelligence for AI coding — on YOUR infrastructure.**

Your developers are making hundreds of decisions, hitting dead ends, and building institutional knowledge every day through AI coding assistants. session-forge hub gives you visibility into all of it — without sending a single byte to anyone else's servers.

https://github.com/420247jake/session-forge-hub/raw/main/promo/sessionforge.mp4

---

## Prerequisites

**This project requires [`session-forge`](https://www.npmjs.com/package/session-forge)** — the MCP server that Claude Code uses to track decisions, dead ends, journal entries, and session state. Each developer on your team needs session-forge installed and configured in their Claude Code setup.

If your developers aren't already using session-forge, start there first:
```bash
npx session-forge
```

session-forge hub does NOT replace session-forge. It sits alongside it. session-forge continues to work exactly as before — hub just gives your team a shared dashboard to see everyone's data in one place.

---

## How the Three Pieces Fit Together

There are **three separate npm packages** involved. Here's what each one does:

| Package | Who installs it | What it does |
|---------|----------------|--------------|
| [`session-forge`](https://www.npmjs.com/package/session-forge) | Each developer | MCP server that Claude Code talks to. Saves decisions, dead ends, journal entries as local JSON files. **You probably already have this.** |
| [`session-forge-hub`](https://www.npmjs.com/package/session-forge-hub) | IT admin / team lead | Dashboard server that runs on your LAN. Collects data from all developers. Shows activity, search, reports. |
| [`session-forge-reporter`](https://www.npmjs.com/package/session-forge-reporter) | Each developer | Watches session-forge's local JSON files and syncs new entries to the hub over your local network. This is the bridge between session-forge and the hub. |

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

**session-forge works without the hub.** The hub is optional — it just adds team-wide visibility. If a developer never runs the reporter, their data stays local and nothing breaks.

---

## Why Local-First Matters

Every AI coding session generates sensitive data: architectural decisions, debugging history, file paths, code context, failed approaches. This is your company's intellectual property.

Cloud-hosted alternatives route this data through third-party servers. You're trusting someone else with your proprietary code intelligence, your team's workflow patterns, and your project architecture.

**session-forge hub runs on YOUR network. Zero external calls. Zero analytics. Zero phone-home. Your data never leaves your infrastructure.**

---

## What the Hub Dashboard Shows

- **Overview** — stats cards, agent grid, recent activity feed across all developers
- **Agents** — register, monitor, and manage each Claude Code instance
- **Activity Feed** — real-time view of checkpoints, decisions, dead ends across the team
- **Cross-Agent Search** — search all decisions and dead ends across all developers
- **Daily Reports** — auto-generated summaries with highlights, top projects, breakthroughs
- **Audit Log** — every API call logged with timestamp, agent, IP, and action
- **Security Page** — educational content about why local-first matters
- **Sync & Export** — export/import all agent data with scope filters (all, self, select)
- **Remote Access Guide** — setup instructions for VPN, Nginx, and Cloudflare Tunnel
- **Donate** — optional Stripe integration if you want to support development

---

## Quick Start

### 1. Make sure developers have session-forge

Each developer needs session-forge configured in their Claude Code. If they don't have it yet:
```bash
npx session-forge
```
Then add it to their Claude Code MCP settings. See the [session-forge docs](https://www.npmjs.com/package/session-forge) for setup.

### 2. Start the hub (on your LAN server or any machine)

```bash
npx session-forge-hub
```

On first run, it generates your admin API key and prints it to the terminal. **Save it — it's shown once.**

### 3. Open the dashboard

Navigate to `http://localhost:3700` (or your server's LAN IP) and enter your admin key.

### 4. Register each developer as an agent

In the dashboard, click "Register Agent" and fill in:
- **Name**: e.g. "Alice's Claude Code"
- **Developer**: e.g. "Alice"
- **Machine**: e.g. "alice-macbook"

You'll get an agent API key. Give this to the developer.

### 5. Each developer runs the reporter

On each developer's machine (where session-forge is already saving data):

```bash
npx session-forge-reporter --hub http://YOUR_HUB_IP:3700 --key sfh_agent_...
```

The reporter watches session-forge's local JSON files and syncs new entries to the hub. It does a full sync on startup, then polls for changes every 5 seconds.

---

## Configuration

### Hub Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3700` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `SESSION_FORGE_HUB_DIR` | `~/.session-forge-hub` | Data directory |
| `HUB_NAME` | `session-forge hub` | Name shown in dashboard |
| `MAX_AGENTS` | `50` | Maximum registered agents |
| `RETENTION_DAYS` | `90` | Data retention period |
| `STRIPE_SECRET_KEY` | — | Optional: Stripe secret key for donations |
| `STRIPE_PUBLISHABLE_KEY` | — | Optional: Stripe publishable key |

### Reporter

```bash
# CLI flags
npx session-forge-reporter --hub <url> --key <key> [--forge-dir <dir>] [--poll <ms>]

# Or config file (~/.session-forge-reporter.json)
{
  "hubUrl": "http://192.168.1.100:3700",
  "agentApiKey": "sfh_agent_..."
}

# Sync mode — export all hub data to a file
npx session-forge-reporter sync --hub <url> --key <admin_key> --output backup.json

# Sync mode — import data from a file
npx session-forge-reporter sync --hub <url> --key <admin_key> --import backup.json

# Export specific agents only
npx session-forge-reporter sync --hub <url> --key <admin_key> --agents id1,id2 --output partial.json
```

---

## Security Model

### API Keys
- **Admin key** (`sfh_admin_...`) — full dashboard access, agent management
- **Agent keys** (`sfh_agent_...`) — can only submit and read own data
- All keys bcrypt-hashed (cost 12) before storage
- Keys shown exactly once on generation, never stored in plaintext

### Network
- All traffic stays on your local network
- No external network calls — ever
- No CDN dependencies (all assets bundled)
- No analytics, no telemetry, no tracking
- Helmet.js security headers

### Rate Limiting
- 120 requests/minute per IP
- Prevents abuse without blocking normal usage

### Audit
- Every API call logged: timestamp, agent ID, action, IP, success/failure
- Rolling buffer of 10,000 entries
- Viewable in dashboard and via API

---

## API Reference

### Agent Management (Admin key)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agents/register` | Register new agent |
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/:id` | Get agent details |
| DELETE | `/api/agents/:id` | Deactivate agent |
| POST | `/api/agents/:id/rotate-key` | Rotate API key |

### Data Ingestion (Agent key)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ingest/checkpoint` | Submit checkpoint |
| POST | `/api/ingest/decision` | Submit decision |
| POST | `/api/ingest/dead-end` | Submit dead end |
| POST | `/api/ingest/journal` | Submit journal entry |
| POST | `/api/ingest/profile` | Update profile |
| POST | `/api/ingest/batch` | Batch submit |

### Dashboard (Admin key)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/overview` | Hub overview stats |
| GET | `/api/dashboard/activity` | Recent activity feed |
| GET | `/api/dashboard/agent/:id/activity` | Agent activity |

### Search (Admin key)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search/decisions?q=` | Search decisions |
| GET | `/api/search/dead-ends?q=` | Search dead ends |

### Reports (Admin key)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/daily?date=` | Daily report |

### Sync & Export (Admin or Agent key)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sync/export` | Export data bundle (scope: all, self, select) |
| POST | `/api/sync/import` | Import data bundle (admin only) |
| GET | `/api/sync/agents` | List agents for sync UI |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/health` | Health check (no auth) |
| GET | `/api/admin/audit` | Audit log |

---

## Storage

All data stored as plain JSON files:

```
~/.session-forge-hub/
  hub.json              # Hub config + admin key hash
  audit.json            # Audit log
  agents/
    {id}.json           # Agent metadata per registered agent
  data/
    {id}/               # Per-agent data directory
      checkpoints.json
      decisions.json
      dead-ends.json
      journal.json
      profile.json
  reports/
    daily/{date}.json   # Generated daily reports
```

---

## Support

session-forge hub is free and open-source. If it's saving your team time, consider supporting development:

- [GitHub Sponsors](https://github.com/sponsors/420247jake)
- The hub includes a built-in donation page at `/donate.html` (Stripe integration, optional)

---

## License

MIT

---

Built by [Jacob Terrell](https://github.com/420247jake)
