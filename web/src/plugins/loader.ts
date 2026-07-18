/**
 * Plugin loader — installs, polls, and uninstalls GodEyePlugin instances.
 * Registered plugins get their own poll loop and DataBus feed.
 */
import type { PluginManifest, GodEyePlugin, InstalledPlugin, PluginContext } from '@god-eye/plugin-sdk';
import type { GodEyeEntity } from '@god-eye/shared';
import { DataBus } from '../bus/data-bus.js';

const DEFAULT_INTERVAL = 30_000;

// ── Runtime registry ──────────────────────────────────────────────────────────
const plugins = new Map<string, InstalledPlugin & { timer?: ReturnType<typeof setInterval> }>();

// ── Plugin logs (last 50 lines per plugin) ────────────────────────────────────
const logs = new Map<string, string[]>();

function pluginLog(id: string, msg: string) {
  const buf = logs.get(id) ?? [];
  buf.unshift(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
  if (buf.length > 50) buf.length = 50;
  logs.set(id, buf);
  DataBus.emit('plugin:log', { id, msg });
}

// ── Context factory ────────────────────────────────────────────────────────────
function makeContext(id: string, onData: (entities: GodEyeEntity[]) => void): PluginContext {
  return {
    setData: onData,
    getViewport() {
      // Best-effort: read globe viewport from window if available
      const vp = (window as unknown as Record<string, unknown>)['__globeViewport'] as
        { north: number; south: number; east: number; west: number } | undefined;
      return vp ?? { north: 90, south: -90, east: 180, west: -180 };
    },
    log(msg: string) { pluginLog(id, msg); },
    getConfig(key: string) {
      return localStorage.getItem(`god-eye-plugin-${id}-${key}`) ?? undefined;
    },
  };
}

// ── Install ───────────────────────────────────────────────────────────────────
export async function installPlugin(
  manifest: PluginManifest,
  plugin: GodEyePlugin,
): Promise<void> {
  if (plugins.has(manifest.id)) {
    throw new Error(`Plugin "${manifest.id}" already installed`);
  }

  const record: InstalledPlugin & { timer?: ReturnType<typeof setInterval> } = {
    manifest,
    instance: plugin,
    status: 'active',
    entityCount: 0,
  };
  plugins.set(manifest.id, record);

  const ctx = makeContext(manifest.id, (entities) => {
    record.entityCount = entities.length;
    // Broadcast as a regular layer:data event using the plugin's layer key
    DataBus.emit('layer:data', { layer: manifest.layer.key, data: entities });
  });

  // Init
  try {
    await plugin.init(ctx);
    pluginLog(manifest.id, `Installed: ${manifest.name} v${manifest.version}`);
  } catch (e) {
    record.status = 'error';
    record.lastError = String(e);
    pluginLog(manifest.id, `Init error: ${e}`);
    return;
  }

  // Announce the new layer to the HUD
  DataBus.emit('plugin:installed', { manifest });

  // Poll loop
  const interval = manifest.fetchInterval ?? DEFAULT_INTERVAL;
  async function poll() {
    try {
      const entities = await plugin.fetch(ctx);
      ctx.setData(entities);
      record.lastFetch = Date.now();
      record.status = 'active';
    } catch (e) {
      record.status = 'error';
      record.lastError = String(e);
      pluginLog(manifest.id, `Fetch error: ${e}`);
    }
  }

  poll(); // immediate first fetch
  record.timer = setInterval(poll, interval);
}

// ── Uninstall ─────────────────────────────────────────────────────────────────
export function uninstallPlugin(id: string) {
  const record = plugins.get(id);
  if (!record) return;
  if (record.timer) clearInterval(record.timer);
  record.instance.destroy?.();
  plugins.delete(id);
  logs.delete(id);
  DataBus.emit('plugin:uninstalled', { id });
  // Clear layer data
  DataBus.emit('layer:data', { layer: record.manifest.layer.key, data: [] });
}

// ── Accessors ─────────────────────────────────────────────────────────────────
export function listPlugins(): InstalledPlugin[] {
  return [...plugins.values()].map(({ timer: _t, ...rest }) => rest);
}

export function getPluginLogs(id: string): string[] {
  return logs.get(id) ?? [];
}

export function isPluginInstalled(id: string): boolean {
  return plugins.has(id);
}
