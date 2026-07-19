/**
 * Extended globe.gl instance type.
 * globe.gl inherits many methods from three-globe but
 * TypeScript's module augmentation doesn't always resolve
 * through the extends chain. We define a utility type instead.
 */
import type { GlobeInstance } from 'globe.gl';
import type { Material, Scene, WebGLRenderer } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface GlobeExt extends GlobeInstance {
  globeImageUrl(): string | null;
  globeImageUrl(url: string): GlobeExt;
  bumpImageUrl(): string | null;
  bumpImageUrl(url: string): GlobeExt;
  showGraticules(): boolean;
  showGraticules(show: boolean): GlobeExt;
  atmosphereColor(): string;
  atmosphereColor(color: string): GlobeExt;
  atmosphereAltitude(): number;
  atmosphereAltitude(alt: number): GlobeExt;
  globeMaterial(): Material;
  globeMaterial(mat: Material): GlobeExt;
  showAtmosphere(): boolean;
  showAtmosphere(show: boolean): GlobeExt;
  backgroundImageUrl(): string | null;
  backgroundImageUrl(url: string | null): GlobeExt;
  pathTransitionDuration(): number;
  pathTransitionDuration(ms: number): GlobeExt;
  width(): number;
  width(w: number): GlobeExt;
  height(): number;
  height(h: number): GlobeExt;
  pointOfView(): { lat: number; lng: number; altitude: number };
  pointOfView(pov: { lat?: number; lng?: number; altitude?: number }, ms?: number): GlobeExt;
  scene(): Scene;
  renderer(): WebGLRenderer;
  controls(): OrbitControls;
  toGlobeCoords(x: number, y: number): { lat: number; lng: number } | null;
  _destructor(): void;

  // Points layer
  pointsData(): object[];
  pointsData(data: object[]): GlobeExt;
  pointLat(fn: string | ((d: object) => number)): GlobeExt;
  pointLng(fn: string | ((d: object) => number)): GlobeExt;
  pointAltitude(fn: number | ((d: object) => number)): GlobeExt;
  pointRadius(fn: number | ((d: object) => number)): GlobeExt;
  pointColor(fn: string | ((d: object) => string)): GlobeExt;
  pointLabel(fn: string | ((d: object) => string)): GlobeExt;
  pointsMerge(merge: boolean): GlobeExt;
  pointsTransitionDuration(ms: number): GlobeExt;
  onPointClick(fn: (point: object, event: MouseEvent) => void): GlobeExt;

  // Arcs layer
  arcsData(): object[];
  arcsData(data: object[]): GlobeExt;
  arcStartLat(fn: string | ((d: object) => number)): GlobeExt;
  arcStartLng(fn: string | ((d: object) => number)): GlobeExt;
  arcEndLat(fn: string | ((d: object) => number)): GlobeExt;
  arcEndLng(fn: string | ((d: object) => number)): GlobeExt;
  arcColor(fn: string | ((d: object) => string)): GlobeExt;
  arcAltitude(fn: number | ((d: object) => number)): GlobeExt;
  arcStroke(fn: number | ((d: object) => number)): GlobeExt;
  arcDashLength(fn: number | ((d: object) => number)): GlobeExt;
  arcDashGap(fn: number | ((d: object) => number)): GlobeExt;
  arcDashAnimateTime(ms: number | ((d: object) => number)): GlobeExt;

  // Labels layer
  labelsData(): object[];
  labelsData(data: object[]): GlobeExt;
  labelLat(fn: string | ((d: object) => number)): GlobeExt;
  labelLng(fn: string | ((d: object) => number)): GlobeExt;
  labelText(fn: string | ((d: object) => string)): GlobeExt;
  labelSize(fn: number | ((d: object) => number)): GlobeExt;
  labelColor(fn: string | ((d: object) => string)): GlobeExt;
  labelAltitude(fn: number | ((d: object) => number)): GlobeExt;
  labelResolution(n: number): GlobeExt;
  labelIncludeDot(fn: boolean | ((d: object) => boolean)): GlobeExt;
  labelDotRadius(fn: number | ((d: object) => number)): GlobeExt;

  // HTML elements layer
  htmlElementsData(): object[];
  htmlElementsData(data: object[]): GlobeExt;
  htmlLat(fn: string | ((d: object) => number)): GlobeExt;
  htmlLng(fn: string | ((d: object) => number)): GlobeExt;
  htmlAltitude(fn: number | ((d: object) => number)): GlobeExt;
  htmlElement(fn: string | ((d: object) => HTMLElement)): GlobeExt;
}
