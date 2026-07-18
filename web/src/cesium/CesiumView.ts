/**
 * CesiumView — feature-flagged Google Photorealistic 3D Tiles mode.
 *
 * Activation requirements:
 *   - GOOGLE_MAPS_API_KEY set in .env (server returns feature flag via /api/config)
 *   - User explicitly clicks the CESIUM button (opt-in)
 *
 * Cesium is loaded lazily from CDN (not bundled) to avoid bloating the main
 * bundle with ~4MB of Cesium JS.
 *
 * When active: shows a separate full-screen Cesium viewer on top of the globe.
 * The globe/flat-map renderers are paused (hidden) while Cesium is active.
 * Toggling off restores the previous renderer.
 */

declare global {
  interface Window {
    Cesium?: CesiumLib;
    CESIUM_BASE_URL?: string;
  }
}

// Minimal Cesium type stubs (we load from CDN, types not bundled)
interface CesiumViewer {
  camera: {
    flyTo: (opts: { destination: unknown; orientation?: unknown }) => void;
    positionCartographic: { longitude: number; latitude: number; height: number };
  };
  scene: { primitives: { add: (p: unknown) => unknown } };
  destroy: () => void;
}

interface CesiumLib {
  Ion: { defaultAccessToken: string };
  Viewer: new (container: HTMLElement | string, opts?: Record<string, unknown>) => CesiumViewer;
  Cartesian3: { fromDegrees: (lng: number, lat: number, alt?: number) => unknown };
  Math: { toRadians: (deg: number) => number };
  HeadingPitchRange: new (heading: number, pitch: number, range: number) => unknown;
  createGooglePhotorealistic3DTileset: (opts?: Record<string, unknown>) => Promise<unknown>;
}

const CESIUM_VERSION = '1.114';
const CESIUM_CDN = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

let viewer: CesiumViewer | null = null;
let containerEl: HTMLElement | null = null;
let _active = false;
let _googleMapsKey: string | null = null;

// ── CDN loader ────────────────────────────────────────────────────────────────

async function loadCesiumFromCDN(): Promise<void> {
  if (window.Cesium) return; // already loaded

  return new Promise((resolve, reject) => {
    // Set base URL before loading Cesium
    window.CESIUM_BASE_URL = `${CESIUM_CDN}/`;

    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${CESIUM_CDN}/Widgets/widgets.css`;
    document.head.appendChild(link);

    // JS
    const script = document.createElement('script');
    script.src = `${CESIUM_CDN}/Cesium.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Cesium from CDN'));
    document.head.appendChild(script);
  });
}

// ── Initializer ───────────────────────────────────────────────────────────────

export async function initCesiumView(apiKey: string): Promise<boolean> {
  _googleMapsKey = apiKey;

  try {
    await loadCesiumFromCDN();
  } catch (err) {
    console.warn('[CesiumView] CDN load failed:', err);
    return false;
  }

  const Cesium = window.Cesium;
  if (!Cesium) return false;

  // Create container
  containerEl = document.createElement('div');
  containerEl.id = 'cesium-container';
  containerEl.style.cssText = 'position:fixed;inset:0;z-index:500;display:none;';
  document.body.appendChild(containerEl);

  // Inject close button overlay
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ EXIT 3D';
  closeBtn.className = 'topbar__mode';
  closeBtn.style.cssText = `
    position:absolute;top:12px;right:12px;z-index:501;
    padding:6px 14px;font-size:var(--fs-11);
    background:rgba(10,15,20,0.85);border:1px solid var(--signal-amber);
    cursor:pointer;
  `;
  closeBtn.addEventListener('click', () => toggleCesiumMode());
  containerEl.appendChild(closeBtn);

  // Cesium viewer div
  const viewerDiv = document.createElement('div');
  viewerDiv.id = 'cesium-viewer-div';
  viewerDiv.style.cssText = 'width:100%;height:100%;';
  containerEl.appendChild(viewerDiv);

  return true;
}

// ── Activate / deactivate ─────────────────────────────────────────────────────

async function activateCesium(): Promise<void> {
  if (!containerEl) return;
  const Cesium = window.Cesium;
  if (!Cesium) return;

  const viewerDiv = document.getElementById('cesium-viewer-div');
  if (!viewerDiv) return;

  // Hide globe/flat renderers
  const globeEl = document.getElementById('globe-container');
  const flatEl = document.getElementById('flat-map-container');
  if (globeEl) globeEl.style.visibility = 'hidden';
  if (flatEl) flatEl.style.visibility = 'hidden';

  containerEl.style.display = 'block';

  if (!viewer) {
    viewer = new Cesium.Viewer(viewerDiv, {
      timeline: false,
      animation: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
    });

    // Load Google Photorealistic 3D Tiles
    if (_googleMapsKey && Cesium.createGooglePhotorealistic3DTileset) {
      try {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset({
          key: _googleMapsKey,
        });
        viewer.scene.primitives.add(tileset);
        console.log('[CesiumView] Google Photorealistic 3D Tiles loaded');
      } catch (err) {
        console.warn('[CesiumView] 3D Tiles load failed:', err);
      }
    }
  }

  _active = true;

  // Update button text
  const btn = document.getElementById('cesium-toggle-btn');
  if (btn) btn.textContent = '3D●';
}

function deactivateCesium(): void {
  if (!containerEl) return;
  containerEl.style.display = 'none';

  // Restore renderers
  const globeEl = document.getElementById('globe-container');
  const flatEl = document.getElementById('flat-map-container');
  if (globeEl) globeEl.style.visibility = '';
  if (flatEl) flatEl.style.visibility = '';

  _active = false;

  const btn = document.getElementById('cesium-toggle-btn');
  if (btn) btn.textContent = '3D+';
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isCesiumActive(): boolean {
  return _active;
}

export function toggleCesiumMode(): void {
  if (_active) {
    deactivateCesium();
  } else {
    activateCesium().catch(console.warn);
  }
}

export function cesiumFlyTo(lat: number, lng: number, altitudeM = 1500): void {
  if (!viewer || !window.Cesium) return;
  const dest = window.Cesium.Cartesian3.fromDegrees(lng, lat, altitudeM);
  viewer.camera.flyTo({
    destination: dest,
    orientation: {
      heading: window.Cesium.Math.toRadians(0),
      pitch: window.Cesium.Math.toRadians(-35),
    },
  });
}

export function getCesiumCamera(): { lat: number; lng: number; altitudeM: number } | null {
  if (!viewer || !window.Cesium) return null;
  const cart = viewer.camera.positionCartographic;
  return {
    lat: (cart.latitude * 180) / Math.PI,
    lng: (cart.longitude * 180) / Math.PI,
    altitudeM: cart.height,
  };
}
