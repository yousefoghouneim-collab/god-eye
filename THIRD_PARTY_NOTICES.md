# Third-Party Notices

This project incorporates ideas, data-source URLs, algorithms, and public
geometry data from the following open-source references. Framework-specific
code was ported (not copied verbatim) to our unified stack.

---

## Reference Projects

### WorldMonitor
- **License:** AGPL-3.0
- **Used for:** globe engine patterns, layer registry design, curated geo
  datasets (military bases, ports, chokepoints, nuclear sites), feed catalog
  (`feeds.ts` source tier model), correlation engine concepts, country
  instability index algorithm, CII scoring methodology.

### ShadowBroker
- **License:** AGPL-3.0
- **Used for:** OSINT backend patterns (recon toolkit, Shodan proxy, Telegram
  preview), CCTV proxy allowlist design, SAR layer architecture, radio
  intercept panel structure, visual mode concepts, data attribution format.

### WorldWideView
- **License:** Elastic License 2.0
- **Used for:** plugin system design (manifest, context, loader), DataBus
  pub/sub pattern, Agent Bus and MCP server transport concepts, Cesium 3D
  integration patterns.

### god-eye (Go CLI)
- **License:** MIT
- **Used for:** AI-CVE correlation concepts, event bus architecture, continuous
  monitoring and diff-engine design, agent scheduling patterns.

### gods-eye-view
- **License:** n/a (asset-only reference)
- **Used for:** visual aesthetic reference only (CRT globe hero look, dossier
  panel aesthetic). No code copied.

---

## Key npm Dependencies

| Package | License | Purpose |
|---|---|---|
| globe.gl | MIT | 3D rotating Earth |
| three | MIT | WebGL renderer |
| deck.gl | MIT | GPU-accelerated flat map layers |
| maplibre-gl | BSD-3-Clause | 2D vector map tiles |
| satellite.js | MIT | SGP4 orbit propagation |
| preact | MIT | Lightweight UI panels |
| fastify | MIT | Node.js API server |
| ioredis | MIT | Redis client |
| ws | MIT | WebSocket relay |
| zod | MIT | Schema validation |
| httpx | BSD-3-Clause | Python async HTTP |
| fastapi | MIT | Python OSINT service |
| uvicorn | BSD-3-Clause | Python ASGI server |
| h3-js | Apache-2.0 | Hexagonal binning |
| supercluster | ISC | Point clustering |
| d3-geo | ISC | Geographic projections |
| topojson | ISC | Topology data |

See `web/package.json`, `api/package.json`, and `osint/pyproject.toml` for
the complete dependency list and version pins.

---

## Fonts

IBM Plex Sans, IBM Plex Sans Condensed, IBM Plex Mono, IBM Plex Serif
- **License:** SIL Open Font License 1.1
- **Source:** IBM / Google Fonts
- Self-hosted under `web/public/fonts/`

---

## AGPL-3.0 Notice (WorldMonitor, ShadowBroker)

GOD-EYE is intended for **private, self-hosted personal use**.

If you distribute GOD-EYE or run it as a network service for third parties,
sections of the codebase derived from WorldMonitor or ShadowBroker (AGPL-3.0)
require you to make the complete corresponding source code available to users
of the service. Prefer porting ideas and algorithms rather than copying
verbatim blocks to keep provenance clean.

## Elastic License 2.0 Notice (WorldWideView)

The Elastic License 2.0 prohibits providing the software as a managed service
and circumventing license key functionality. This project ports *concepts and
patterns*, not verbatim Elastic-licensed code, for personal use only.
