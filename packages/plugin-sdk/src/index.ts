import type { LayerDef, GodEyeEntity } from '@god-eye/shared';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  layer: LayerDef;
  fetchInterval?: number;
  entrypoint: string;
}

export interface PluginContext {
  setData(records: GodEyeEntity[]): void;
  getViewport(): { north: number; south: number; east: number; west: number };
  log(msg: string): void;
}

export interface GodEyePlugin {
  init(ctx: PluginContext): Promise<void>;
  fetch(ctx: PluginContext): Promise<GodEyeEntity[]>;
  destroy?(): void;
}
