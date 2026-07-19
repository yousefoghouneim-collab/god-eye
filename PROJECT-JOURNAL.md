# GOD-EYE — Full Project Journal

> Everything that happened, every decision made, every phase built, and where we go next.
> Written for the project owner as a single reference document.

---

## What Is GOD-EYE?

GOD-EYE is a **self-hosted, real-time global intelligence platform** — think of it as a personal
version of the kind of situational-awareness dashboards used by intelligence agencies and military
operations centers. It shows a live rotating 3D Earth covered in real data: aircraft in flight,
earthquakes happening right now, active wildfires, satellites orbiting overhead, conflict events,
weather alerts, market prices, and more — all in one cockpit.

It was built entirely from scratch (with AI assistance via Claude Code) during sessions in 2025–2026,
synthesized from five open-source reference projects and documented in a full spec before a single
line of code was written.

**One command to run it:**
```bash
docker compose up --build
# Then open http://localhost:8080
```

---

## The Five Reference Projects (Inspiration Sources)

Before building, five open-source projects were studied and their best ideas were extracted:

| Project | What we took from it |
|---|---|
| **WorldMonitor** (AGPL-3.0) | Globe engine patterns, layer registry, curated geo datasets (military bases, ports, chokepoints, nuclear sites), country instability scoring |
| **ShadowBroker** (AGPL-3.0) | OSINT backend (recon toolkit, Shodan proxy, Telegram preview), CCTV proxy design, SAR layer architecture, radio panel structure, visual modes |
| **WorldWideView** (Elastic 2.0) | Plugin system design, DataBus pub/sub pattern, Agent Bus, MCP server transport, Cesium 3D integration |
| **god-eye Go CLI** (MIT) | AI-CVE correlation concepts, event bus architecture, continuous monitoring, agent scheduling |
| **gods-eye-view** (asset ref) | Visual aesthetic reference — CRT globe look, dossier panel style. No code copied. |

No code was copy-pasted verbatim. Ideas, data-source URLs, algorithms, and geometry data were
ported into a single unified stack.

---

## Tech Stack Chosen

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Vite + TypeScript (strict) | Fastest build path, matches strongest reference |
| UI panels | Preact | Lightweight, no React overhead for HUD panels |
| 3D globe | globe.gl + Three.js | Best rotating-Earth renderer available |
| Flat map | deck.gl + MapLibre GL | GPU-accelerated layers, dark-ops flat mode |
| Optional 3D | CesiumJS (lazy CDN load) | Google Photorealistic 3D Tiles |
| Node backend | Fastify | Fast, low-overhead API server |
| Python service | FastAPI + uvicorn | OSINT, SAR, imagery, CCTV, radio |
| Cache | Redis | Stampede-protected poll loop cache |
| Realtime | WebSocket DataBus | Live data fan-out to the browser |
| Local AI | Ollama (default) | No API key needed; also supports Groq/OpenRouter/Anthropic |
| Agent control | MCP server + Agent Bus | Let an LLM control the globe remotely |
| Plugin system | Manifest-driven | Add data sources without touching core code |
| Deploy | Docker Compose | Single command, self-hosted |

---

## Design Rules (Non-Negotiable)

These rules were set before any code was written and enforced throughout:

- **Fonts:** IBM Plex Sans + IBM Plex Mono (self-hosted). No Inter, no Geist.
- **Colors:** Dark ink background, amber accent (`#F59E0B`), steel signal palette. No purple, no violet, no glassmorphism.
- **Aesthetic:** Formal operational-intelligence instrument. Looks like something an analyst would actually use, not an "AI startup app".
- **Data is always real.** No mock data anywhere in the shipped product. If a source needs a key, the layer is hidden until the key is provided.
- **Secrets stay server-side.** No API keys, no SSRF-capable fetches ever reach the browser.
- **Rate limits respected.** All sources are cached in Redis at the intervals defined in the spec.

---

## Project Folder Structure

```
God-eye/
├── app/                        ← The built platform (this folder)
│   ├── web/                    ← Vite + TypeScript frontend
│   │   ├── src/
│   │   │   ├── globe/          ← globe.gl rotating Earth
│   │   │   ├── map/            ← deck.gl + MapLibre flat map
│   │   │   ├── hud/            ← All overlay panels
│   │   │   ├── layers/         ← Layer registry + renderer
│   │   │   ├── bus/            ← DataBus, WebSocket client, Agent client
│   │   │   ├── cesium/         ← Cesium 3D (lazy CDN loader)
│   │   │   ├── plugins/        ← Plugin loader + example plugins
│   │   │   └── styles/         ← HUD CSS + visual modes
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   ├── api/                    ← Node.js Fastify backend
│   │   └── src/
│   │       ├── sources/        ← One file per live data source
│   │       ├── routes/         ← REST API routes
│   │       ├── cache/          ← Redis client + poll loop manager
│   │       ├── relay/          ← WebSocket relay
│   │       ├── analysis/       ← CII scoring + correlation engine
│   │       ├── ai/             ← AI gateway + intel brief generator
│   │       ├── mcp/            ← MCP server (SSE transport)
│   │       └── agent/          ← Agent Bus + AOI watches + watch-officer
│   ├── osint/                  ← Python FastAPI OSINT service
│   │   └── app/
│   │       ├── recon.py        ← IP/DNS/RDAP/BGP/CVE lookups
│   │       ├── entity.py       ← Wikidata + OFAC sanctions
│   │       ├── intel.py        ← Telegram preview + Shodan proxy
│   │       ├── sar.py          ← SAR watch areas + ASF Sentinel-1 scenes
│   │       ├── imagery.py      ← Sentinel-2 thumbnails (Planetary Computer)
│   │       ├── radio.py        ← KiwiSDR nodes + OpenMHZ scanner feeds
│   │       └── cctv.py         ← CCTV media proxy (allowlisted public cams)
│   ├── packages/
│   │   ├── shared/             ← Shared TypeScript types
│   │   └── plugin-sdk/         ← Plugin development SDK
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── README.md
│   ├── DATA-ATTRIBUTION.md
│   ├── THIRD_PARTY_NOTICES.md
│   ├── PROGRESS.md
│   └── PROJECT-JOURNAL.md      ← This file
├── docs/                       ← Original spec documents (00–07)
└── Refernces/                  ← Five reference project zips + extracted source
```

---

## Build Timeline — Phase by Phase

### Phase 0 — Foundations
**What was built:** The empty skeleton of the entire project.
- pnpm monorepo with `web/`, `api/`, `osint/`, `packages/shared/`, `packages/plugin-sdk/`
- Design tokens (colors, fonts, spacing) as CSS variables
- HUD shell (topbar, ticker bar, right rail) — no data yet, just the layout
- Lint + TypeScript strict mode configured across all workspaces
- Git repository initialized

**State at end:** An empty cockpit shell. Correct layout, correct design system, no data.

---

### Phase 1 — The Rotating Earth
**What was built:** The centerpiece — a live 3D globe.
- globe.gl + Three.js integration with real NASA earth textures
- Atmospheric haze, day/night terminator line, city lights on the dark side
- Auto-rotation (slow idle spin), smooth camera flyTo
- Right-click on globe → shows lat/lng coordinates
- `GlobeApi` interface for type-safe globe control
- 2D flat map mode (deck.gl + MapLibre) as an alternative view
- Visual mode foundation: DEFAULT and SATELLITE basemaps

**State at end:** A beautiful rotating Earth with no data on it yet.

---

### Phase 2 — Data Spine + First Live Layers
**What was built:** Everything needed to get live data onto the globe.
- Redis cache with stampede protection (prevents multiple fetches hitting the same source simultaneously)
- Poll loop manager — each data source has its own fetch interval
- WebSocket relay — broadcasts data from server to every connected browser in real time
- DataBus — pub/sub system inside the browser that routes data to the right layer
- Layer registry — 22 layer definitions (each with name, icon, color, category)
- **4 first live layers:** USGS Earthquakes · NASA FIRMS Fires · NASA EONET Events · adsb.lol Aircraft
- Selection dossier — click any marker on the globe to see its details
- Location dossier — right-click anywhere → reverse geocode via Nominatim + Wikipedia summary
- Command palette (`Cmd+K`) — search layers, geocode places, run commands

**State at end:** A live globe with earthquakes, fires, natural events, and aircraft. Clicking anything shows its data.

---

### Phase 3 — Full Breadth of Data Layers
**What was built:** All the remaining keyless (no API key needed) data sources.

**5 more live sources added:**
- Smithsonian GVP — active volcanoes worldwide (6h cache)
- GDELT Project — conflict and geopolitical events (30min cache)
- NOAA NWS — weather alerts (10min cache)
- CelesTrak + satellite.js SGP4 — ~700 satellites tracked with real orbital math (2h TLE refresh, 2min position update)
- Yahoo Finance + CoinGecko + alternative.me — market indices, crypto prices, Fear & Greed index (5min cache)

**4 curated static datasets:**
- 32 military bases worldwide
- 13 global maritime chokepoints
- 17 major ports
- 10 nuclear sites

**State at end:** 9 live data sources. The globe looks like a real intelligence platform.

---

### Phase 4 — Analysis Brain
**What was built:** The system that thinks about the data, not just displays it.

**Country Instability Index (CII):**
- Scores 36 countries on a scale of low/normal/elevated/high/critical
- Uses real data: conflict events + seismic activity + fires + weather alerts per country
- Displayed in a right-rail panel with color-coded scores and component breakdowns

**Correlation Engine:**
- Scans all live data streams for geographic convergence (multiple bad things happening in the same 300km radius)
- Classifies severity: low / medium / high / critical
- Shows convergence alerts in the right rail

**AI Gateway (4 providers):**
- Ollama (runs locally, no key needed) — lean (3B), balanced (8B), heavy (70B) model tiers
- Groq (fast cloud inference, requires `GROQ_API_KEY`)
- OpenRouter (multi-model cloud, requires `OPENROUTER_API_KEY`)
- Anthropic Claude (requires `ANTHROPIC_API_KEY`)
- Graceful degradation: if no AI is available, the panel shows a clear message

**AI Intel Panel:**
- On-demand intelligence brief: feeds CII + correlations + layer state into the AI
- Returns a formal analyst-style brief about the current global situation
- Entity-specific briefs: click a marker, get an AI analysis of that specific event
- `Shift+B` keyboard shortcut

**State at end:** The platform doesn't just show data — it analyzes and summarizes it.

---

### Phase 5 — OSINT Depth
**What was built:** Open-source intelligence lookup tools.

**RECON panel** (click any IP, domain, or keyword):
- IP geolocation
- DNS records lookup
- RDAP/WHOIS domain registration info
- Certificate Transparency logs (who issued SSL certs for a domain)
- BGP/ASN routing information
- CVE vulnerability search
- Reverse DNS lookup
- All SSRF-protected (can't be abused to hit internal servers)

**ENTITY panel** (research any person, organization, or place):
- Wikidata search and detail lookup (structured knowledge graph, no key needed)
- OFAC SDN sanctions screening (checks if an entity is on the US Treasury sanctions list)

**SIGINT panel** (signals intelligence):
- Telegram public channel preview (reads public channels without an account)
- Shodan host lookup (see what ports/services are exposed on any IP — requires `SHODAN_API_KEY`)

**State at end:** Full OSINT workstation built into the platform.

---

### Phase 6 — Agent & Automation
**What was built:** The ability for an AI agent (or LLM) to control the globe remotely.

**MCP Server** (Model Context Protocol):
- Any MCP-compatible AI client (e.g. Claude Desktop) can connect and control GOD-EYE
- Transport: Server-Sent Events at `GET /mcp/sse`
- 10 tools available: `fly_to`, `set_layer`, `list_layers`, `place_pin`, `clear_pins`, `get_dossier`, `list_alerts`, `get_cii`, `search_telemetry`, `osint_lookup`
- Example: "Claude, fly to Tehran and show me the conflict layer" → globe moves and layer toggles

**Agent Bus** (HTTP command channel):
- `POST /api/agent/command` — send HMAC-signed commands from any script or automation
- `GET /api/agent/events` — Server-Sent Events stream for receiving alerts
- Disabled by default; enabled by setting `AGENT_SECRET` in `.env`

**AOI Watches** (Area of Interest monitoring):
- Define a bounding box on the map with a label
- The system continuously checks if new earthquakes or aircraft enter that area
- Sends an alert via the Agent Bus + shows a ticker notification in the browser

**AI Watch-Officer** (autonomous monitoring):
- Runs on a configurable interval (default: every 5 minutes)
- Scans CII + correlations for material changes since last scan
- If something significant changed, generates a one-sentence AI brief and shows it in the ticker
- Controlled via `WATCH_OFFICER_ENABLED=true` in `.env`
- WATCH panel in topbar: configure interval, minimum severity, view recent alerts

**State at end:** An AI agent can fly the globe, query layers, and watch for developments autonomously.

---

### Phase 7 — Plugin System, Time Machine, Presets, Export
**What was built:** Power-user features for a professional workflow.

**Plugin System:**
- `@god-eye/plugin-sdk` — a TypeScript SDK for writing custom data layers
- Drop in a plugin file → it polls its source and feeds data into the globe like any native layer
- Built-in example plugins: ISS tracker (10-second updates), GeoJSON file loader
- PLUGINS panel: install/uninstall, see entity counts, last fetch time, error logs

**Time Machine:**
- Timeline bar at the bottom of the screen
- Switch between LIVE mode and HISTORICAL mode
- In historical mode: pick a time window (1h to 7d), scrub through time, play at 1×–30× speed
- Time-aware layers (earthquakes, fires, conflicts, weather) filter their data to the selected window

**Saved View Presets:**
- Save the current state of the globe (which layers are on, camera position, visual mode, time range)
- Load it back in one click
- Up to 20 presets stored in browser localStorage
- PRESETS panel in topbar

**Situation Brief Export:**
- `Shift+X` or the EXPORT button in the AI Intel panel
- Collects: top 5 unstable countries, active convergence alerts, data feed status, AI brief text
- Formats it as a clean plaintext intelligence card
- Copies to clipboard AND downloads as `god-eye-brief-YYYY-MM-DD.txt`

**State at end:** A complete professional analyst workflow — custom sources, time travel, saved views, exportable reports.

---

### Phase 8 — Advanced Sensors & Imagery
**What was built:** Satellite imagery, radio intercepts, CCTV feeds, and synthetic aperture radar.

**SAR (Synthetic Aperture Radar) Panel:**
- Define ground-change watch areas (AOIs) on the map
- Fetches real Sentinel-1 GRD satellite scene catalog from NASA ASF (free, no key)
- Shows available SAR passes over your AOI with download links
- Mode B (advanced deformation analysis) unlocked by adding `EARTHDATA_TOKEN` to `.env`
- SAR topbar button

**Sentinel-2 Imagery in Dossier:**
- Right-click anywhere on the globe → location dossier now includes a satellite photo
- Fetches the latest cloud-free Sentinel-2 L2A image from Microsoft Planetary Computer (free, no key)
- Shows date, cloud cover %, tile name alongside the thumbnail

**Radio Intercept Panel:**
- KiwiSDR tab: lists publicly-available software-defined radio receivers worldwide (node name, location, frequency range, OPEN link)
- Scanner tab: OpenMHZ police/fire/EMS scanner feeds → system list → recent call recordings → audio player
- RADIO topbar button

**CCTV Overlay Panel:**
- Live traffic camera feeds from public authorities: Transport for London, NYC DOT, Singapore LTA, Austin TX, California DOT, Colorado DOT
- Server-side media proxy (SSRF-hardened — cannot be abused to access private servers)
- Live image viewer with 5-second auto-refresh
- Opt-in disclaimer (user must acknowledge cameras are public authority feeds)
- CCTV topbar button

**Cesium Photoreal 3D Mode:**
- `3D+` topbar button: switches the entire view to Google Photorealistic 3D Tiles
- Street-level 3D imagery of any location on Earth
- Lazy-loaded from CDN (doesn't add to the app bundle size)
- Requires `GOOGLE_MAPS_API_KEY` — button is dimmed with a tooltip if key is absent

**State at end:** The platform can now look at the Earth from orbit (Sentinel-2), listen to radio (KiwiSDR/OpenMHZ), watch traffic cameras (CCTV), and detect ground change from radar (SAR).

---

### Phase 9 — Final Polish & Packaging
**What was built:** Everything needed to ship the platform professionally.

**Complete Visual Modes (6 total, cycle with `V` key):**
- `DEFAULT` — Dark cartographic ops look (standard)
- `SATELLITE` — Imagery basemap
- `FLIR` — Thermal amber-on-black; globe desaturated and sepia-tinted
- `NVG` — Night-vision phosphor green; SVG film grain overlay; vignette
- `CRT` — Retro phosphor green; CSS scanlines; subtle screen flicker animation
- `DOSSIER` — High-contrast classified-document look; IBM Plex Serif on panel titles; amber left border
- All animations disabled automatically if user has `prefers-reduced-motion` set in their OS

**Keyboard Shortcuts Overlay (`Shift+?`):**

| Key | Action |
|---|---|
| `Cmd/Ctrl+K` | Command palette |
| `V` | Cycle visual mode |
| `M` | Toggle 3D globe / 2D flat map |
| `L` | Jump to live / exit time machine |
| `Shift+R` | Toggle RECON panel |
| `Shift+E` | Toggle ENTITY panel |
| `Shift+M` | Toggle MARKETS panel |
| `Shift+S` | Toggle SIGINT panel |
| `Shift+W` | Toggle WATCH panel |
| `Shift+P` | Toggle PLUGINS panel |
| `Shift+H` | Toggle HEALTH panel |
| `Shift+B` | Generate AI brief |
| `Shift+X` | Export situation brief |
| `Escape` | Close any open overlay |

**Freshness / Health Dashboard (HEALTH topbar button):**
- Shows the age of every data source (green = fresh, amber = stale, red = down)
- Shows Node API + Python OSINT service health
- Shows which optional features are enabled (AI, Cesium, Shodan, Earthdata, Copernicus)

**Docker Compose Finalization:**
- `web/Dockerfile` — multi-stage: Node 20 builds the Vite app → nginx serves the static files
- `web/nginx.conf` — routes `/api/*` to Node API, `/osint/*` to Python service, handles WebSocket upgrades, SSE buffering, SPA fallback, gzip, asset caching
- `api/Dockerfile` — multi-stage: TypeScript compiled → clean Node 20 runtime image
- `osint/Dockerfile` — Python 3.12-slim with 2 uvicorn workers
- All services start with proper health checks and startup ordering

**Documentation:**
- `README.md` — Full quick-start guide, architecture table, data layers, optional features, keyboard shortcuts, visual modes, MCP connection info
- `DATA-ATTRIBUTION.md` — Every data source credited with license/terms and required attribution strings
- `THIRD_PARTY_NOTICES.md` — All five reference projects, npm dependency licenses, font licenses, AGPL-3.0 and Elastic 2.0 compliance notes
- `.env.example` — Fully commented template for all optional API keys and configuration variables

**State at end:** The platform is complete, typechecked clean across all workspaces, and ships with `docker compose up --build`.

---

## Current Status

**All 9 phases complete. Build is ship-ready.**

```
Phases completed:    0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9
TypeScript check:    PASS (all 4 workspaces)
Docker build:        PASS
Git repository:      github.com/yousefoghouneim-collab/god-eye (private)
Last commit:         "Phases 2-9: full GOD-EYE platform build" (86 files, 13,333 insertions)
```

**What works with zero API keys:**
- Rotating 3D globe with all 6 visual modes
- 9 live data sources (earthquakes, fires, natural events, aircraft, volcanoes, conflicts, weather, satellites, markets)
- 4 curated datasets (military bases, chokepoints, ports, nuclear sites)
- CII country instability scoring
- Correlation engine (convergence alerts)
- OSINT recon toolkit (IP, DNS, RDAP, BGP, CVE, certs)
- Entity graph (Wikidata + OFAC)
- Sentinel-2 imagery in location dossier
- CCTV panel (TfL, NYC DOT, Singapore LTA, Austin, CA, CO)
- KiwiSDR radio nodes
- Plugin system, time machine, presets, export
- MCP server (AI agent control)
- Health dashboard, keyboard shortcuts, all visual modes

**What requires optional API keys:**
| Feature | Key |
|---|---|
| Shodan host lookup | `SHODAN_API_KEY` |
| SAR Mode B (deformation) | `EARTHDATA_TOKEN` (free signup) |
| Cesium Photoreal 3D | `GOOGLE_MAPS_API_KEY` |
| AI briefs via Groq | `GROQ_API_KEY` |
| AI briefs via Anthropic | `ANTHROPIC_API_KEY` |
| AI briefs via OpenRouter | `OPENROUTER_API_KEY` |
| Agent Bus | `AGENT_SECRET` (self-generated) |

---

## What Is Next — Deployment

The platform is built and pushed to GitHub. The next step is making it accessible at your own domain.

### Why Vercel Does NOT Work Here

Vercel is a platform for static websites and serverless functions. GOD-EYE requires:
- A long-running Node.js server with WebSocket connections
- A long-running Python server
- A Redis database

None of these run on Vercel. The website would load but all data would fail.

### The Right Approach — A Server + Your GoDaddy Domain

**How it looks when done:**
```
yourdomain.com  →  your server  →  Docker Compose runs everything
```

**Step-by-step plan:**

**Step 1 — Rent a server (~$5–6/month)**
- Recommended: **Hetzner CX22** (2 CPU, 4GB RAM, €3.99/month) at hetzner.com
- Alternative: **DigitalOcean Droplet** ($6/month) — more beginner-friendly dashboard
- Choose Ubuntu 24.04 as the operating system

**Step 2 — Install Docker on the server**
```bash
curl -fsSL https://get.docker.com | sh
```

**Step 3 — Clone the repo onto the server**
```bash
git clone https://github.com/yousefoghouneim-collab/god-eye.git
cd god-eye/app
cp .env.example .env
# (optionally add your API keys to .env)
```

**Step 4 — Run it**
```bash
docker compose up -d --build
# The app is now running on port 8080
```

**Step 5 — Point your GoDaddy domain**
- In your GoDaddy DNS settings, add an **A record**:
  - Name: `@` (or `www`, or a subdomain like `god-eye`)
  - Value: your server's IP address
  - TTL: 600
- Wait ~10 minutes for DNS to propagate

**Step 6 — Add HTTPS (free, one command)**
```bash
# Install Caddy (automatic SSL)
apt install caddy

# Create /etc/caddy/Caddyfile:
yourdomain.com {
    reverse_proxy localhost:8080
}

systemctl restart caddy
```

Done. `https://yourdomain.com` → GOD-EYE, full platform, live data, secure connection.

---

## Files in This Project Worth Knowing

| File | What it is |
|---|---|
| `README.md` | Quick start guide and feature overview |
| `PROGRESS.md` | Detailed build log of every phase |
| `PROJECT-JOURNAL.md` | This file — full project history |
| `DATA-ATTRIBUTION.md` | Credits and licenses for every data source |
| `THIRD_PARTY_NOTICES.md` | Legal notices for reference projects and npm packages |
| `.env.example` | Template for all optional API keys |
| `docker-compose.yml` | The one command to run everything |

---

*Last updated: July 2026. All 9 build phases complete.*
