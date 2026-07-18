# GOD-EYE — Build Progress

## Phase 0 — Foundations & Scaffold
**Status: COMPLETE**

- [x] Extract all 5 reference zips into `Refernces/_extracted/`
- [x] Create monorepo scaffold (pnpm workspaces, packages/shared, packages/plugin-sdk, web, api, osint)
- [x] Design tokens (tokens.css) + self-hosted IBM Plex Sans/Mono/Condensed/Serif fonts
- [x] HUD shell (TopBar, LeftRail, RightRail, Ticker, CommandPalette, Legend)
- [x] Lint/typecheck/format configs; all 3 services verified working
- [x] Acceptance: dark formal cockpit shell renders; typecheck passes across all workspaces

---

## Phase 1 — The Rotating Earth
**Status: COMPLETE**

- [x] Fetch Earth textures (day topo-bathy 5400x2700, night lights 13500x6750, water specular, night sky, blue marble alt)
- [x] GlobeView with globe.gl v2 + Three.js: toned earth texture, teal-steel #2E5A6E atmosphere, 800-star starfield, graticule
- [x] Real-UTC day/night terminator via directional sun light from computed subsolar point
- [x] Night city-lights: custom ShaderMaterial sphere with additive blending, smoothstep terminator transition
- [x] MeshStandardMaterial upgrade: roughness 0.85, metalness 0.05, emissive dark teal, ACES filmic tone mapping
- [x] Camera: OrbitControls with drag/zoom/damping (factor 0.12), pan disabled, zoom 101-600 range
- [x] Idle auto-rotate after 60s (0.4 deg/s), pause on interaction, resume on mouseup/touchend
- [x] flyTo/flyToBounds with smooth animation (1200ms default)
- [x] GlobeApi exposed on window.globeApi — callable from console
- [x] Right-click emits lat/lng via contextmenu event
- [x] Visual modes: DEFAULT, SATELLITE, FLIR (amber tint), NVG (phosphor green), CRT (green + scanlines)
- [x] Teal outer glow sphere (BackSide, 12% opacity, slow rotation)
- [x] Graticule styled to --globe-grat (#1B2E38, 40% opacity)
- [x] ResizeObserver for responsive canvas
- [x] Full cleanup/dispose on destroy
- [x] Type-safe: GlobeExt type augmentation for globe.gl + three-globe methods
- [x] Typecheck passes across all workspaces

### Acceptance criteria (doc 07 §9)
- [x] Loads toned, lit, texture-mapped Earth with teal atmosphere and starfield
- [x] Real UTC day/night terminator visible; city lights on night side
- [x] Idle auto-rotation kicks in at 60s, stops on interaction
- [x] flyTo and select animate smoothly; GlobeApi callable from console
- [x] Visual-mode switch works without reload (DEFAULT/SATELLITE/FLIR/NVG/CRT)

---

## Phase 2 — Data Spine, First Live Layers, Dossier
**Status: UP NEXT**

- [ ] Shared normalized types + zod schemas
- [ ] API cache (Redis + stampede lock + freshness meta)
- [ ] Layer registry + left-rail catalog wired
- [ ] First live layers: Earthquakes (USGS), Active Fires (FIRMS), Natural Events (EONET), Aircraft (adsb.lol)
- [ ] Flat map renderer (deck.gl + MapLibre)
- [ ] Selection dossier + location dossier on right-click
- [ ] Command palette wired to layers + places
