# GOD-EYE — Build Progress

## Phase 0 — Foundations & Scaffold
**Status: COMPLETE**

- [x] Monorepo scaffold, design tokens, HUD shell, lint/typecheck

---

## Phase 1 — The Rotating Earth
**Status: COMPLETE**

- [x] globe.gl + Three.js: textures, atmosphere, terminator, city lights, visual modes
- [x] Camera, auto-rotate, flyTo, GlobeApi, right-click lat/lng

---

## Phase 2 — Data Spine + First Live Layers + Dossier
**Status: COMPLETE**

- [x] Redis cache + stampede protection + poll loops
- [x] 4 initial live layers (USGS, FIRMS, EONET, adsb.lol)
- [x] REST + WebSocket relay + DataBus + layer registry (22 layers)
- [x] Selection dossier, globe renderer, flat map (deck.gl + MapLibre)
- [x] Location dossier (Nominatim), command palette (layers + geocode + commands)

---

## Phase 3 — Breadth of Layers
**Status: COMPLETE**

### Live data sources (8 total)
- [x] Earthquakes (USGS, 5min), Fires (FIRMS, 15min), EONET (30min), Aircraft (adsb.lol, 30s)
- [x] Volcanoes (GVP, 24h), Conflicts (GDELT, 30min), Weather (NWS, 10min)
- [x] Satellites (CelesTrak + satellite.js SGP4, 2min) — ~700 tracked

### Curated static datasets
- [x] Military Bases (32), Chokepoints (13), Ports (17), Nuclear Sites (10)

---

## Phase 4 — Analysis Brain (CII, Correlation, AI)
**Status: COMPLETE**

### Country Instability Index (CII)
- [x] Multi-factor scoring: conflict + seismic + fire + weather per 36 countries
- [x] Levels: low/normal/elevated/high/critical with component breakdown
- [x] API endpoint: `/api/analysis/cii`
- [x] Right-rail CII summary panel with color-coded scores

### Correlation Engine
- [x] Spatial clustering (300km radius) across all live streams
- [x] Multi-layer convergence detection (2+ streams in same area)
- [x] Severity classification: low/medium/high/critical
- [x] API endpoint: `/api/analysis/correlations`
- [x] Right-rail convergence alerts panel

### AI Gateway
- [x] Unified chat interface for 4 providers: Ollama (default), Groq, OpenRouter, Anthropic
- [x] Ollama tier presets: lean (3B), balanced (8B), heavy (70B)
- [x] Config API: GET/POST `/api/ai/config`, `/api/ai/tiers`
- [x] Graceful degradation when AI is offline

### AI Intel Panel
- [x] Situational brief generator using CII + correlation + layer data
- [x] System prompt: formal intelligence analyst persona
- [x] On-demand brief button in right-rail AI INTEL panel
- [x] Entity-specific brief endpoint: POST `/api/ai/brief/entity`
- [x] Auto-refresh CII + correlation summaries every 5 min
- [x] Live feeds count in system status panel

### New files
- `api/src/analysis/country-instability.ts` — CII scoring engine
- `api/src/analysis/correlation.ts` — Cross-stream convergence detector
- `api/src/ai/gateway.ts` — Multi-provider AI gateway
- `api/src/ai/briefs.ts` — Intelligence brief generator
- `api/src/routes/analysis.ts` — CII + correlation API routes
- `api/src/routes/ai.ts` — AI config + brief API routes
- `web/src/hud/ai-intel.ts` — AI Intel panel + CII/correlation display

### All 4 workspaces typecheck clean

---

## Phase 5 — OSINT Depth
**Status: COMPLETE**

### OSINT Recon Toolkit (Python FastAPI)
- [x] 7 SSRF-guarded endpoints: IP geo, DNS, RDAP/WHOIS, Cert Transparency, BGP/ASN, CVE Search, Reverse DNS
- [x] Wired into `osint/app/main.py`; proxied via Vite `/osint/*` → port 8001
- [x] Frontend RECON panel: tabbed UI, IP/domain/keyword inputs, formatted results

### Entity Graph (Wikidata + OFAC)
- [x] Wikidata entity search (`/wikidata/search`) and detail (`/wikidata/detail`) — no key needed
- [x] OFAC SDN sanctions screening (`/ofac/screen`) — in-memory 24h cache
- [x] Frontend ENTITY panel: 3 tabs (search/detail/OFAC), bottom-left overlay

### Markets Panel
- [x] Live 9th data source: Yahoo Finance indices + commodities (5min TTL)
- [x] CoinGecko crypto prices + 24h change (5min TTL)
- [x] alternative.me Fear & Greed Index (5min TTL)
- [x] `/api/layers/markets` REST + WS broadcast; poll loop #9
- [x] Frontend MKTS panel: color-coded index/crypto/sentiment table

### SIGINT Panel (Telegram + Shodan)
- [x] Telegram public channel preview — no key, regex HTML parse, up to 20 messages
- [x] Shodan host lookup — proxied, requires `SHODAN_API_KEY` env var, graceful degradation
- [x] Frontend SIGINT panel: tabbed Telegram/Shodan UI, structured output

### New files
- `osint/app/recon.py` — 7 SSRF-guarded recon endpoints
- `osint/app/entity.py` — Wikidata + OFAC entity graph
- `osint/app/intel.py` — Telegram preview + Shodan proxy
- `api/src/sources/markets.ts` — Markets data fetcher (9th live source)
- `web/src/hud/recon-panel.ts` — RECON overlay panel
- `web/src/hud/entity-panel.ts` — ENTITY overlay panel
- `web/src/hud/markets-panel.ts` — MKTS overlay panel
- `web/src/hud/intel-panel.ts` — SIGINT overlay panel

### Topbar buttons added: RECON · ENTITY · MKTS · SIGINT
### All workspaces typecheck clean

---

## Phase 6 — Agent & Automation
**Status: COMPLETE**

### MCP Server
- [x] SSE transport at `GET /mcp/sse` + `POST /mcp/messages?sessionId=<uuid>`
- [x] JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`, `ping`
- [x] 10 tools: `fly_to`, `set_layer`, `list_layers`, `place_pin`, `clear_pins`, `get_dossier`, `list_alerts`, `get_cii`, `search_telemetry`, `osint_lookup`
- [x] Globe commands broadcast via WS relay; data tools read Redis cache directly
- [x] Discovery endpoint: `GET /mcp` with tool list

### Agent Bus
- [x] `POST /api/agent/command` — HMAC-signed (AGENT_SECRET), forwards to browser via WS
- [x] `GET /api/agent/events` — SSE stream for agent observers
- [x] `GET/POST /api/agent/watches` + `DELETE /api/agent/watches/:id` — AOI CRUD
- [x] Disabled gracefully when AGENT_SECRET not set

### Browser Agent Client
- [x] WS `agent:command` messages dispatched via DataBus
- [x] Handlers: `fly_to`, `set_layer`, `place_pin`, `clear_pins`, `get_dossier`, `aoi_alert`, `watch_officer_alert`
- [x] Toast notifications for commands; ticker integration for AOI/watch-officer alerts

### AI Watch-Officer Mode
- [x] Periodic scan (configurable, env: WATCH_OFFICER_ENABLED/INTERVAL_MS/MIN_SEVERITY)
- [x] Detects material changes in CII + correlations since last scan
- [x] AI brief snippet via chat gateway (1-sentence ticker item)
- [x] Config API: `GET/POST /api/agent/watch-officer`
- [x] WATCH panel in topbar: enable/disable, interval, min-severity, AOI watch list + recent alerts

### AOI Watches
- [x] Bounding-box watch areas (lat1,lng1,lat2,lng2 + label)
- [x] Real-time entity ingestion check on earthquake + aircraft poll loops
- [x] Alerts via Agent Bus SSE + browser ticker

### New files
- `api/src/mcp/tools.ts`, `api/src/mcp/index.ts`
- `api/src/agent/bus.ts`, `api/src/agent/watches.ts`, `api/src/agent/watch-officer.ts`
- `web/src/bus/agent-client.ts`
- `web/src/hud/watch-officer.ts`

### Topbar button added: WATCH
### All workspaces typecheck clean

---

## Phase 7 — Plugin System, Time Machine, Presets, Brief Export
**Status: COMPLETE**

### Plugin System
- [x] `@god-eye/plugin-sdk` workspace package: `PluginManifest`, `PluginContext`, `GodEyePlugin`, `definePlugin()` helper
- [x] `web/src/plugins/loader.ts` — `installPlugin()` / `uninstallPlugin()` / `listPlugins()` / `getPluginLogs()`
- [x] Poll loop per plugin; context `setData()` emits `DataBus 'layer:data'` → transparent globe rendering
- [x] Example plugins: `iss.ts` (ISS tracker, 10s), `geojson.ts` (GeoJSON FeatureCollection loader)
- [x] PLUGINS panel: lists builtins, install/remove, entity count, last fetch age, error display, log viewer

### Time Machine
- [x] Timeline bar floating above ticker at `bottom:36px`
- [x] LIVE/HISTORICAL toggle, play/pause, speed selector (1×–30×), window (1h–7d), range scrubber
- [x] `DataBus.emit('timeline:range', {from, to, live})` drives all time-aware layers
- [x] Time-aware layers: earthquakes, fires, eonet, conflicts, weather
- [x] `window.__timeMachine = { getTimeRange }` for cross-module access

### Saved View Presets
- [x] `ViewPreset` captures: enabled layers, camera (lat/lng/altitude), visual mode, time range
- [x] localStorage key `god-eye-presets`; up to 20 presets
- [x] PRESETS panel (centered, top:48px): name input, save/load/delete; restores all state on load

### One-Key Situation Brief Export
- [x] EXPORT button injected into AI INTEL panel title bar
- [x] Collects: CII top 5, active convergence alerts, data feed status, AI brief text, session context
- [x] Formats as ASCII plaintext card, copies to clipboard + downloads `god-eye-brief-YYYY-MM-DD.txt`

### New files
- `packages/plugin-sdk/src/index.ts` — plugin SDK (enhanced)
- `web/src/plugins/loader.ts` — plugin loader + poll loop manager
- `web/src/plugins/examples/iss.ts` — ISS example plugin
- `web/src/plugins/examples/geojson.ts` — GeoJSON example plugin
- `web/src/hud/plugin-panel.ts` — PLUGINS overlay panel
- `web/src/hud/time-machine.ts` — timeline scrubber bar
- `web/src/hud/presets.ts` — saved view presets panel

### Topbar buttons added: PLUGINS · PRESETS
### All workspaces typecheck clean

---

---

## Phase 8 — Advanced Sensors & Imagery
**Status: COMPLETE**

### SAR Ground-Change Watch Areas
- [x] `osint/app/sar.py`: in-memory AOI CRUD (add/remove/list), Sentinel-1 scene catalog via ASF Search (free, no key), Mode B flag for NASA OPERA/Copernicus (EARTHDATA_TOKEN env var)
- [x] Endpoints: `/osint/sar/status`, `/osint/sar/aois`, `/osint/sar/scenes`, `/osint/sar/near`
- [x] `web/src/hud/sar-panel.ts`: SAR panel (right 360px); AOI editor, scene list, near-cursor query, Mode B status + setup hints
- [x] Topbar button: SAR

### Sentinel-2 Imagery in Dossier
- [x] `osint/app/imagery.py`: Microsoft Planetary Computer STAC API (free, no key) → latest cloud-free Sentinel-2 L2A thumbnail for any lat/lng (1h cache)
- [x] Location dossier auto-fetches and displays thumbnail + date/cloud-cover/tile metadata

### Radio Intercept Panel
- [x] `osint/app/radio.py`: KiwiSDR nodes (rx-888 JSON mirror, 24h cache), OpenMHZ systems (30min cache), recent calls (5min cache), nearest-by-coordinates
- [x] `web/src/hud/radio-panel.ts`: RADIO panel (bottom-left); KIWISDR tab (node list + OPEN link), SCANNER tab (system list → call list → audio player)
- [x] Topbar button: RADIO

### CCTV Overlay Panel + Media Proxy
- [x] `osint/app/cctv.py`: allowlisted media proxy (TfL London, NYC DOT, Singapore LTA, Austin TX, CA/CO/OR DOT); SSRF-hardened (private IP block + redirect re-validation + max 3 hops); HLS playlist URL rewriting
- [x] 6 curated public traffic-authority cameras seeded
- [x] `web/src/hud/cctv-panel.ts`: CCTV panel (centered bottom); camera list, live image viewer, 5s auto-refresh, disclaimer
- [x] Topbar button: CCTV

### Cesium Photoreal 3D Mode (feature-flagged)
- [x] `/api/config` endpoint: exposes CESIUM_ENABLED, SHODAN_ENABLED, EARTHDATA_ENABLED, COPERNICUS_ENABLED, AI_ENABLED
- [x] `web/src/cesium/CesiumView.ts`: lazy CDN loader (no bundle bloat), Google Photorealistic 3D Tiles (GOOGLE_MAPS_API_KEY), `flyTo`, `getCesiumCamera`
- [x] Topbar button `3D+`: dimmed with tooltip when key absent; fully activates when key present
- [x] Restores globe/flat renderers on exit

### New files
- `osint/app/sar.py`, `osint/app/imagery.py`, `osint/app/radio.py`, `osint/app/cctv.py`
- `web/src/cesium/CesiumView.ts`
- `web/src/hud/sar-panel.ts`, `radio-panel.ts`, `cctv-panel.ts`

### Topbar buttons added: SAR · RADIO · CCTV · 3D+
### All workspaces typecheck clean

---

---

## Phase 9 — Polish & Packaging
**Status: COMPLETE**

### Visual Modes (complete)
- [x] `web/src/styles/visual-modes.css` — CRT scanlines + `@keyframes crt-flicker`, NVG SVG grain + `@keyframes nvg-grain`, FLIR desaturate/sepia filter, DOSSIER high-contrast token remap + IBM Plex Serif panel titles
- [x] `prefers-reduced-motion` disables all animations; soft vignette on DEFAULT/SATELLITE
- [x] DOSSIER added to `VISUAL_MODES` cycle (6 modes total)

### Keyboard Shortcuts Overlay
- [x] `web/src/hud/shortcuts-overlay.ts` — full `<kbd>`-styled overlay; `Shift+?` toggle
- [x] Global handler: V (visual), M (renderer), L (live), Shift+R/E/M/S/W/P/H (panels), Shift+B (AI brief), Shift+X (export), Escape (close overlay)
- [x] `?` button in topbar opens overlay

### Freshness / Health Dashboard
- [x] `web/src/hud/health-panel.ts` — parallel fetches to `/api/freshness`, `/api/config`, `/api/health`, `/osint/health`
- [x] Color-coded rows: fresh/stale/down per data source; feature flag status; service health
- [x] HEALTH topbar button

### Docker Compose Finalization
- [x] `web/Dockerfile` — multi-stage: node:20-alpine Vite build → nginx:1.27-alpine
- [x] `web/nginx.conf` — `/api/` proxy, `/ws` WebSocket upgrade, `/mcp` SSE (buffering off), `/osint/` proxy, SPA fallback, gzip, asset caching
- [x] `api/Dockerfile` — multi-stage: tsc build → node:20-alpine runtime (prod deps only)
- [x] `osint/Dockerfile` — python:3.12-slim; 2 uvicorn workers
- [x] `docker-compose.yml` — `condition: service_healthy` startup ordering; web on 8080:80; Ollama commented with pull instructions
- [x] `docker compose up --build` → full stack at http://localhost:8080

### Documentation
- [x] `app/README.md` — Quick Start, architecture table, dev setup, data layers, optional features, keyboard shortcuts, visual modes, MCP info
- [x] `app/DATA-ATTRIBUTION.md` — all live sources, geocoding, imagery, CCTV, radio, basemap, compliance notes
- [x] `app/THIRD_PARTY_NOTICES.md` — 5 references, npm deps table, font license, AGPL-3.0 + Elastic 2.0 notices
- [x] `app/.env.example` — complete template with all optional keys, EARTHDATA_TOKEN, COPERNICUS_TOKEN, AGENT_SECRET, watch-officer vars

### New/updated files
- `web/src/styles/visual-modes.css`
- `web/src/hud/shortcuts-overlay.ts`, `health-panel.ts`
- `web/Dockerfile`, `web/nginx.conf`, `api/Dockerfile`, `osint/Dockerfile`
- `docker-compose.yml` (updated), `README.md`, `DATA-ATTRIBUTION.md`, `THIRD_PARTY_NOTICES.md`, `.env.example`

### All workspaces typecheck clean — build is SHIP-READY
