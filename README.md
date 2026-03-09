# session-forge hub

**Team intelligence for AI coding — on YOUR infrastructure.**

Your developers are making hundreds of decisions, hitting dead ends, and building institutional knowledge every day through AI coding assistants. session-forge hub gives you visibility into all of it — without sending a single byte to anyone else's servers.

---

## Why Local-First Matters

Every AI coding session generates sensitive data: architectural decisions, debugging history, file paths, code context, failed approaches. This is your company's intellectual property.

Cloud-hosted alternatives route this data through third-party servers. You're trusting someone else with your proprietary code intelligence, your team's workflow patterns, and your project architecture.

**session-forge hub runs on YOUR network. Zero external calls. Zero analytics. Zero phone-home. Your data never leaves your infrastructure.**

---

## What It Does

- **Dashboard** — see all your developers' AI coding activity in one place
- **Agent Registry** — each Claude Code instance registers with a unique API key
- **Live Activity Feed** — real-time view of checkpoints, decisions, dead ends across the team
- **Cross-Agent Search** — search all decisions and dead ends across all developers
- **Daily Reports** — auto-generated summaries with highlights, top projects, breakthroughs
- **Audit Log** — every API call logged with timestamp, agent, IP, and action
- **Security-First** — bcrypt-hashed API keys, rate limiting, no external dependencies

---

## Architecture

```
Company's Local Server
┌──────────────────────────────────────────────┐
│  session-forge hub (Node + Express)          │
│  http://192.168.x.x:3700                     │
│                                              │
│  REST API  ←→  Dashboard  ←→  JSON Storage   │
└──────────────────────────────────────────────┘
        ↑ HTTP POST (LAN only)
        │
   ┌────┴────────────────────────────────────┐
   │  Developer Machines:                    │
   │                                         │
   │  Claude Code → session-forge (MCP)      │
   │                    ↓                    │
   │              local JSON files           │
   │                    ↓                    │
   │         session-forge-reporter          │
   │         (watches & syncs to hub)        │
   └─────────────────────────────────────────┘
```

---

## Quick Start

### 1. Start the hub

```bash
npx session-forge-hub
```

On first run, it generates your admin API key and prints it to the terminal. **Save it — it's shown once.**

### 2. Open the dashboard

Navigate to `http://localhost:3700` and enter your admin key.

### 3. Register an agent

In the dashboard, click "Register Agent" and fill in:
- **Name**: e.g. "Alice's Claude Code"
- **Developer**: e.g. "Alice"
- **Machine**: e.g. "alice-macbook"

You'll get an agent API key. Give this to the developer.

### 4. Start the reporter on each developer's machine

```bash
npx session-forge-reporter --hub http://YOUR_HUB_IP:3700 --key sfh_agent_...
```

The reporter watches session-forge's local JSON files and syncs new entries to the hub.

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
