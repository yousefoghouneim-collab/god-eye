import type { LayerDef, GodEyeEntity } from '@god-eye/shared';

export type { LayerDef, GodEyeEntity };

// ── Manifest ─────────────────────────────────────────────────────────────────
export interface PluginManifest {
  /** Unique slug, e.g. "iss-tracker" */
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  /** Layer definition wired into the left-rail catalog */
  layer: LayerDef;
  /** Poll interval in milliseconds (default 30 000) */
  fetchInterval?: number;
}

// ── Context provided to plugins ───────────────────────────────────────────────
export interface PluginContext {
  /** Push a new set of entities to the globe/map renderer */
  setData(records: GodEyeEntity[]): void;
  /** Current viewport bounding box */
  getViewport(): { north: number; south: number; east: number; west: number };
  /** Write a log line visible in the plugin panel */
  log(msg: string): void;
  /** Retrieve an env/config value set by the user (never exposes secrets to network) */
  getConfig(key: string): string | undefined;
}

// ── Plugin interface ─────────────────────────────────────────────────────────
export interface GodEyePlugin {
  /** Called once on installation; should validate config and set up state */
  init(ctx: PluginContext): Promise<void>;
  /** Called on every poll tick; should return current entity array */
  fetch(ctx: PluginContext): Promise<GodEyeEntity[]>;
  /** Called on uninstall; clean up timers/resources */
  destroy?(): void;
}

// ── Installed plugin record (runtime) ────────────────────────────────────────
export interface InstalledPlugin {
  manifest: PluginManifest;
  instance: GodEyePlugin;
  status: 'active' | 'error' | 'disabled';
  lastFetch?: number;
  lastError?: string;
  entityCount: number;
}

// ── Helper: create a minimal plugin from a fetch function ────────────────────
export function definePlugin(
  manifest: PluginManifest,
  fetcher: (ctx: PluginContext) => Promise<GodEyeEntity[]>,
): { manifest: PluginManifest; plugin: GodEyePlugin } {
  return {
    manifest,
    plugin: {
      async init() { /* no-op */ },
      fetch: fetcher,
    },
  };
}
