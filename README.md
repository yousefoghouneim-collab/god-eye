# GOD-EYE

**Self-hosted, Palantir-class real-time global-intelligence platform.**
A single-operator situational-awareness cockpit with a live rotating 3D Earth,
60+ live public data streams, local AI analysis, and an MCP/agent control channel.

---

## Quick Start (Docker)

```bash
# 1. Clone and enter the app directory
cd app/

# 2. Copy environment template and optionally add API keys
cp .env.example .env

# 3. One command — builds images, starts all services
docker compose up --build

# 4. Open http://localhost:8080
```

The app runs fully with **zero API keys** using the keyless data sources.
Each optional key in `.env` lights up additional layers and capabilities.

---

## Architecture

| Service | Port | Description |
|---|---|---|
| `web` | 8080 | Vite build served by nginx; proxies `/api` and `/osint` |
| `api` | 3001 | Node.js / Fastify — data poll loops, WebSocket relay, AI gateway, MCP server, Agent Bus |
| `osint` | 8001 | Python / FastAPI — OSINT recon, entity graph, Telegram, Shodan, SAR, imagery, radio, CCTV |
| `redis` | 6379 | Cache + freshness metadata for all poll loops |
| `ollama` | 11434 | (optional) Local AI — uncomment in docker-compose.yml |

---

## Development Setup

Requirements: Node 20+, pnpm 9+, Python 3.12+, Redis (or Docker).

```bash
# Install dependencies
pnpm install

# Start all services concurrently (dev mode with hot-reload)
pnpm dev

# Or start services individually:
pnpm --filter api dev          # Node API on :3001
pnpm --filter web dev          # Vite on :5173
cd osint && uvicorn app.main:app --reload --port 8001
```

Typecheck all workspaces:
```bash
pnpm -r typecheck
```

---

## Data Layers (keyless)

All layers below work with zero API keys:

| Layer | Source | Refresh |
|---|---|---|
| Earthquakes | USGS FDSNWS | 5 min |
| Active Fires | NASA FIRMS VIIRS | 15 min |
| Natural Events | NASA EONET | 30 min |
| Aircraft | adsb.lol | 30 s |
| Volcanoes | Smithsonian GVP | 6 h |
| Conflict Events | GDELT | 30 min |
| Weather Alerts | NOAA NWS | 10 min |
| Satellites | CelesTrak SGP4 | 2 h |
| Markets | Yahoo Finance / CoinGecko / alternative.me | 5 min |
| Military Bases | Curated (32 bases) | static |
| Chokepoints | Curated (13) | static |
| Ports | Curated (17) | static |
| Nuclear Sites | Curated (10) | static |

---

## Optional Features (require API keys / accounts)

| Feature | Required | How to enable |
|---|---|---|
| Shodan host lookup | `SHODAN_API_KEY` | https://shodan.io |
| SAR Mode B (deformation) | `EARTHDATA_TOKEN` | https://urs.earthdata.nasa.gov (free) |
| Copernicus SAR/optical | `COPERNICUS_TOKEN` | https://dataspace.copernicus.eu (free) |
| Cesium Photoreal 3D | `GOOGLE_MAPS_API_KEY` | Google Maps Platform |
| AI briefs (Groq) | `GROQ_API_KEY` | https://groq.com |
| AI briefs (Anthropic) | `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| AI briefs (OpenRouter) | `OPENROUTER_API_KEY` | https://openrouter.ai |
| AI briefs (local) | Ollama running | `docker compose up ollama` |
| Agent Bus (LLM control) | `AGENT_SECRET` | `openssl rand -hex 32` |

---

## Panels & Controls

**Topbar buttons (left→right):**
`3D/2D` toggle · `RECON` · `ENTITY` · `MKTS` · `SIGINT` · `WATCH` · `PLUGINS`
`PRESETS` · `SAR` · `RADIO` · `CCTV` · `3D+` · `HEALTH` · visual mode · `?`

**Keyboard shortcuts** (press `?` or `Shift+?`):
- `Cmd/Ctrl+K` — Command palette
- `V` — Cycle visual mode
- `M` — Toggle 3D globe / 2D flat map
- `Shift+R/E/M/S/W/P/H` — Toggle panels (Recon/Entity/Markets/SIGINT/Watch/Presets/Health)
- `Shift+B` — Generate AI brief
- `Shift+X` — Export situation brief
- `Escape` — Close overlay

**Right-click the globe** → location dossier (geocode + Sentinel-2 satellite thumbnail)

---

## Visual Modes

Cycle with `V` key or the topbar button:

| Mode | Look |
|---|---|
| DEFAULT | Dark cartographic ops (standard) |
| SATELLITE | Imagery basemap |
| FLIR | Thermal amber-on-black + desaturated globe |
| NVG | Night-vision phosphor green + grain overlay |
| CRT | Retro phosphor green + scanlines + subtle flicker |
| DOSSIER | High-contrast classified-document look |

---

## MCP Server (AI control)

Connect any MCP client (e.g. Claude Desktop) to control the globe:

```
Endpoint: http://localhost:8080/mcp/sse  (SSE transport)
Messages: http://localhost:8080/mcp/messages?sessionId=<uuid>
```

Available tools: `fly_to`, `set_layer`, `list_layers`, `place_pin`,
`clear_pins`, `get_dossier`, `list_alerts`, `get_cii`, `search_telemetry`,
`osint_lookup`

---

## Attribution

See `DATA-ATTRIBUTION.md` for all data source credits and license notes.
See `THIRD_PARTY_NOTICES.md` for reference project and npm package notices.

GOD-EYE is for **private, self-hosted personal use**. See notices files
before redistributing or operating as a public service.
