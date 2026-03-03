<p align="center">
  <img src="https://img.shields.io/badge/status-alpha-violet" alt="Status: Alpha" />
  <img src="https://img.shields.io/badge/platform-macOS-blue" alt="Platform: macOS" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT" />
  <img src="https://img.shields.io/badge/tests-327%20passing-brightgreen" alt="Tests: 327 passing" />
</p>

# Hive Desktop

**Local AI Agent Workflow Runtime**

Hive Desktop is a native desktop app that lets you wire MCP (Model Context Protocol) tools into persistent, event-driven workflows using natural language. Discover tools from [Hive Market](https://hivemarket.ai), install them locally, and build automations that run on your machine. Your API keys never leave your device.

> Think "local-first n8n" meets "App Store for AI tools" — but you describe what you want in plain English and AI builds the workflow for you.

---

## Why Hive Desktop?

| Existing Tools | Problem |
|---|---|
| n8n / Activepieces | Visual node builders — powerful but complex, no AI, no tool marketplace |
| OpenClaw | Chat assistant, not a workflow runtime |
| Composio | Cloud-based — your API keys leave your machine |
| Custom scripts | No UI, no scheduling, no error handling, no discoverability |

**Hive Desktop fills the gap:** a local-first, native desktop app with a built-in tool marketplace, natural language workflow creation, and persistent scheduling — all running on your machine.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Tauri v2 Shell (Rust)              │
│  System tray  ·  Auto-updater  ·  Keychain  │
└──────────────────┬──────────────────────────┘
                   │ spawn on app start
┌──────────────────▼──────────────────────────┐
│          Runtime Server (Node.js)            │
│  Fastify HTTP + WebSocket on localhost       │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ MCP Mgr  │ │ Workflow │ │ AI Planner  │  │
│  │ spawn /  │ │ Engine   │ │ NL→workflow │  │
│  │ connect  │ │ schedule │ │ Claude API  │  │
│  │ call     │ │ execute  │ │             │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
│  ┌──────────┐ ┌──────────┐                   │
│  │  Vault   │ │ Hive API │                   │
│  │ AES-256  │ │ discover │                   │
│  │ encrypt  │ │ install  │                   │
│  └──────────┘ └──────────┘                   │
└─────────────────────────────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼──────────────────────────┐
│        React Frontend (Tauri Webview)        │
│  Dashboard · Workflows · Servers · Vault     │
│  React 19  ·  TypeScript  ·  Tailwind  ·     │
│  shadcn/ui                                   │
└─────────────────────────────────────────────┘
```

**Why this stack:**
- **Rust** (Tauri v2) for what Rust is good at: ~15MB binary, native OS integration, system tray, auto-updates
- **Node.js** for what Node is good at: MCP SDK, async I/O, npm ecosystem, process management
- **React** for the UI, same design language as Hive Market

---

## Features

### MCP Server Management
- Browse and install MCP tools from [Hive Market](https://hivemarket.ai)
- Start, stop, restart servers with process lifecycle management
- Connect to servers via MCP stdio transport
- Discover and call tools interactively from the UI
- View real-time server logs

### Workflow Engine
- **5 trigger types:** cron schedule, interval, webhook, file watch, manual
- **5 step types:** MCP tool call, condition, transform, delay, notify
- Variable passing between steps with expression evaluation
- Error handling strategies per step: stop, continue, retry
- Run history with execution logs

### AI Workflow Planner
- Describe what you want in plain English
- Claude API generates the workflow definition
- Preview steps, triggers, and required servers before confirming
- Auto-detects which MCP servers are needed
- One-click install of missing servers from Hive Market

### 10 Built-in Templates
1. **Payment Monitor** — Stripe: large payments → Slack notification
2. **Issue Triager** — GitHub: new issue → AI categorize → auto-label
3. **Error Alerter** — Sentry: new error → GitHub issue + Slack
4. **Daily Digest** — Cron: GitHub + Stripe + analytics → email summary
5. **Deploy Watcher** — Vercel: deployment failure → Slack alert
6. **Customer Onboarding** — Stripe: new customer → welcome email
7. **Dependency Auditor** — Weekly: npm audit → create vulnerability issues
8. **Content Pipeline** — File watch: markdown → process → CMS
9. **Competitor Monitor** — Daily: search mentions → summarize → email
10. **Database Backup Alert** — Interval: backup status → alert on failure

### Security
- **Local-first:** everything runs on your machine, nothing phones home
- **Encrypted vault:** AES-256-GCM encrypted credential storage
- **Process isolation:** each MCP server runs as a separate process

---

## Getting Started

### Prerequisites

```bash
# Rust (required for Tauri)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 20+
# https://nodejs.org

# pnpm
npm install -g pnpm
```

### Install & Run

```bash
# Clone
git clone https://github.com/AtomicIntuition/hive-desktop.git
cd hive-desktop

# Install dependencies
pnpm install

# Development mode (opens Tauri window + hot reload)
pnpm dev

# Or run just the runtime server (no Tauri window)
pnpm --filter @hive-desktop/runtime dev
```

### Build for Production

```bash
# Build all packages
pnpm build

# Build the Tauri app (produces .dmg / .app)
pnpm tauri build
```

---

## Project Structure

```
hive-desktop/
├── apps/desktop/              # Tauri + React app
│   ├── src/                   # React frontend
│   │   ├── components/        # UI components (dashboard, servers, workflows, vault)
│   │   ├── hooks/             # React hooks (runtime, servers, workflows, websocket)
│   │   ├── stores/            # Zustand state stores
│   │   ├── pages/             # Route pages
│   │   └── lib/               # Runtime client, utilities, constants
│   └── src-tauri/             # Rust backend (window, tray, IPC, auto-updater)
│
├── packages/
│   ├── runtime/               # Node.js runtime engine
│   │   └── src/
│   │       ├── mcp/           # MCP manager, client, registry, installer
│   │       ├── workflow/      # Engine, runner, scheduler, templates, context
│   │       ├── ai/            # Claude API provider, NL→workflow planner
│   │       ├── vault/         # AES-256 encrypted credential store
│   │       ├── routes/        # Fastify REST API (servers, workflows, vault, market, ai)
│   │       └── db/            # SQLite schema + connection
│   └── shared/                # Shared TypeScript types
│
├── tests/runtime/             # Runtime unit tests (182 tests)
├── .github/workflows/         # CI + release pipelines
└── turbo.json                 # Turborepo config
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Desktop shell | Tauri v2 | ~15MB binary, native tray/notifications/auto-updater |
| Runtime | Node.js + Fastify | MCP SDK is TypeScript, async I/O for server management |
| Frontend | React 19 + Vite | Fast dev, TypeScript-first |
| Styling | Tailwind v4 + shadcn/ui | Consistent design system |
| State | Zustand | Lightweight, TypeScript-first |
| Database | better-sqlite3 | Zero-config embedded database |
| MCP | @modelcontextprotocol/sdk | Official SDK, stdio transport |
| AI | Anthropic SDK | Claude API for NL→workflow |
| Testing | Vitest | 327 tests across 51 files |
| Build | pnpm workspaces + Turborepo | Monorepo orchestration |

---

## Testing

```bash
# Run all tests
pnpm test

# Runtime tests only (182 tests)
pnpm --filter @hive-desktop/runtime test

# Frontend tests only (145 tests)
pnpm --filter @hive-desktop/app test
```

**327 tests** covering:
- Runtime: MCP lifecycle, workflow engine, scheduler, AI planner, vault encryption, all HTTP routes
- Frontend: all Zustand stores, all React hooks, all components, all pages

---

## How It Works

### 1. Browse & Install Tools
The app connects to the [Hive Market API](https://hivemarket.ai) to browse available MCP servers. Click "Install" to download and configure a server locally.

### 2. Create a Workflow
Either pick from 10 built-in templates or describe what you want:

> "Watch my Stripe and Slack me when a payment over $500 comes in"

The AI planner will:
1. Parse your intent → monitor Stripe, filter by amount, notify via Slack
2. Check which MCP servers are needed → `stripe-mcp`, `slack-mcp`
3. Offer to install any missing servers
4. Generate the workflow definition
5. Show a preview for your approval

### 3. Run & Monitor
Workflows run on schedule, on file changes, via webhooks, or manually. The dashboard shows real-time status, run history, and error counts.

---

## API

The runtime server exposes a REST API on `localhost:45678`:

| Endpoint | Description |
|---|---|
| `GET /api/health` | Runtime status |
| `GET /api/servers` | List installed MCP servers |
| `POST /api/servers/install` | Install a server from Hive Market |
| `POST /api/servers/:id/start` | Start a server process |
| `POST /api/servers/:id/stop` | Stop a server process |
| `POST /api/servers/:id/connect` | Connect via MCP protocol |
| `GET /api/workflows` | List workflows |
| `POST /api/workflows` | Create a workflow |
| `POST /api/workflows/:id/run` | Trigger a workflow run |
| `GET /api/vault` | List stored credentials |
| `POST /api/vault` | Store an encrypted credential |
| `GET /api/market/tools` | Search Hive Market |
| `POST /api/ai/plan-workflow` | AI: natural language → workflow |
| `POST /api/ai/confirm-workflow` | AI: confirm and create workflow |

---

## Hive Ecosystem

| Project | Description | Repo |
|---|---|---|
| **Hive Market** | MCP tool marketplace — discover, install, publish | [hive-market](https://github.com/AtomicIntuition/hive-market) |
| **Hive Desktop** | Local AI workflow runtime — this repo | [hive-desktop](https://github.com/AtomicIntuition/hive-desktop) |

---

## Contributing

Contributions welcome. Please open an issue first to discuss what you'd like to change.

```bash
# Development
pnpm install
pnpm dev

# Run tests before submitting
pnpm test
pnpm build
```

---

## License

MIT
