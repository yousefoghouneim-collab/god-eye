# GOD-EYE — Build Progress

## Phase 0 — Foundations & Scaffold
**Status: COMPLETE**

- [x] Extract all 5 reference zips into `Refernces/_extracted/`
- [x] Create monorepo scaffold (pnpm workspaces, packages/shared, packages/plugin-sdk, web, api, osint)
- [x] Design tokens (tokens.css) + self-hosted IBM Plex Sans/Mono/Condensed/Serif fonts
- [x] HUD shell (TopBar, LeftRail, RightRail, Ticker, CommandPalette, Legend)
- [x] Lint/typecheck/format configs; all 3 services verified working
- [x] Acceptance: dark formal cockpit shell renders; typecheck passes across all workspaces

### What shipped
- `web/`: Vite + TS strict + Preact — full HUD shell with topbar (brand + UTC clock + mode switcher), left rail (layer catalog with categories), canvas placeholder with reticle/vignette, right rail (dossier + status + AI intel panels with corner brackets), bottom ticker, command palette (Cmd+K)
- `api/`: Fastify server with health endpoint, CORS, dotenv
- `osint/`: FastAPI skeleton with health endpoint
- `packages/shared/`: Normalized entity types (Aircraft, Vessel, Earthquake, Fire, Conflict), layer definitions, freshness meta, visual mode types
- `packages/plugin-sdk/`: Plugin manifest + context + interface types
- Design tokens: full color palette per doc 03, visual mode overrides (DEFAULT/SATELLITE/FLIR/NVG/CRT), type scale, spacing grid
- Docker Compose, .env.example (all keys documented), .prettierrc, .gitignore
- THIRD_PARTY_NOTICES.md, DATA-ATTRIBUTION.md
- `scripts/fetch-textures.sh` ready for Phase 1

---

## Phase 1 — The Rotating Earth
**Status: UP NEXT**

- [ ] Fetch Earth textures (day/night/water/sky)
- [ ] GlobeView with globe.gl+Three.js: toned texture, teal atmosphere, starfield, graticule
- [ ] Real-UTC day/night terminator + night city-lights blend
- [ ] Camera: drag/zoom/damping; idle auto-rotate after 60s; flyTo/flyToBounds
- [ ] GlobeApi stub callable from console; right-click emits lat/lng
- [ ] Visual modes scaffold (DEFAULT/SATELLITE/CRT minimum)
