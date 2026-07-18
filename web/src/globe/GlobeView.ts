/**
 * GlobeView — GOD-EYE 3D rotating Earth
 *
 * globe.gl v2 + Three.js. Toned texture, teal atmosphere, starfield,
 * day/night terminator with city lights, auto-rotate, camera controls,
 * visual mode switching, and a stable GlobeApi.
 */

import Globe from 'globe.gl';
import type { GlobeExt } from './globe-ext';
import * as THREE from 'three';
import { getSubsolarPoint, subsolarToDirection } from './solar';
import type { VisualMode } from '@god-eye/shared';

// ─── Texture URLs ───
const TEXTURES = {
  DEFAULT: '/textures/earth-topo-bathy.jpg',
  SATELLITE: '/textures/earth-blue-marble.jpg',
  water: '/textures/earth-water.png',
  night: '/textures/earth-night.jpg',
  sky: '/textures/night-sky.png',
} as const;

// ─── Types ───
export interface GlobeApi {
  flyTo(opts: { lat: number; lng: number; altitude?: number; ms?: number }): void;
  flyToBounds(points: Array<{ lat: number; lng: number }>, ms?: number): void;
  select(entityId: string | null): void;
  setAutoRotate(enabled: boolean): void;
  setMode(mode: 'globe' | 'flat' | 'cesium'): void;
  setVisualMode(mode: VisualMode): void;
  getViewport(): { lat: number; lng: number; altitude: number };
  on(event: string, cb: (data: unknown) => void): void;
  destroy(): void;
}

type EventCb = (data: unknown) => void;

export function createGlobeView(container: HTMLElement): GlobeApi {
  let destroyed = false;
  let autoRotateTimer: ReturnType<typeof setTimeout> | null = null;
  let terminatorTimer: ReturnType<typeof setInterval> | null = null;
  let extrasRafId: number | null = null;
  const listeners: Record<string, EventCb[]> = {};

  // Three.js objects we manage
  let sunLight: THREE.DirectionalLight | null = null;
  let nightMesh: THREE.Mesh | null = null;
  let starField: THREE.Points | null = null;
  let outerGlow: THREE.Mesh | null = null;

  // ─── Create globe ───
  const globe = new Globe(container, {
    animateIn: false,
    rendererConfig: {
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    },
  }) as unknown as GlobeExt;

  const initW = container.clientWidth || window.innerWidth;
  const initH = container.clientHeight || window.innerHeight;

  globe
    .globeImageUrl(TEXTURES.DEFAULT)
    .bumpImageUrl(TEXTURES.water)
    .backgroundImageUrl('')
    .atmosphereColor('#2E5A6E')      // teal-steel per doc 03
    .atmosphereAltitude(0.18)
    .showGraticules(true)
    .width(initW)
    .height(initH)
    .pointOfView({ lat: 25, lng: 55, altitude: 2.5 }); // Start at Dubai

  // Style the canvas to fill container
  const canvas = container.querySelector('canvas');
  if (canvas) {
    (canvas as HTMLElement).style.cssText =
      'position:absolute;top:0;left:0;width:100%!important;height:100%!important;';
  }

  // ─── Orbit controls ───
  const controls = globe.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.zoomSpeed = 1.2;
  controls.minDistance = 101;
  controls.maxDistance = 600;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;

  // ─── Scene enhancements ───
  const scene = globe.scene();
  const renderer = globe.renderer();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  // Upgrade to MeshStandardMaterial for proper lighting
  const oldMat = globe.globeMaterial();
  const stdMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.05,
    emissive: new THREE.Color(0x0a1f2e),
    emissiveIntensity: 0.2,
  });
  if ('map' in oldMat && oldMat.map) {
    stdMat.map = oldMat.map as THREE.Texture;
  }
  globe.globeMaterial(stdMat);

  // Directional "sun" light — positioned from real UTC subsolar point
  sunLight = new THREE.DirectionalLight(0xfff5e6, 1.8);
  scene.add(sunLight);

  // Ambient fill
  const ambientLight = new THREE.AmbientLight(0x1a2a3a, 0.6);
  scene.add(ambientLight);

  // Teal atmospheric outer glow
  const glowGeo = new THREE.SphereGeometry(2.12, 48, 48);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x2E5A6E,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.12,
  });
  outerGlow = new THREE.Mesh(glowGeo, glowMat);
  scene.add(outerGlow);

  // Starfield
  const starCount = 800;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 60 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);
    const b = 0.4 + Math.random() * 0.6;
    starColors[i * 3] = b;
    starColors[i * 3 + 1] = b;
    starColors[i * 3 + 2] = b * (0.8 + Math.random() * 0.2);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  starField = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.9 }),
  );
  scene.add(starField);

  // ─── Night lights (city lights on dark side) ───
  // Globe radius is 1 in scene units; night mesh wraps just outside
  const nightGeo = new THREE.SphereGeometry(1.002, 64, 32);
  const nightTex = new THREE.TextureLoader().load(TEXTURES.night);
  nightTex.colorSpace = THREE.SRGBColorSpace;
  const nightShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      nightTex: { value: nightTex },
      sunDir: { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D nightTex;
      uniform vec3 sunDir;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        float sunDot = dot(vNormal, sunDir);
        float nightFactor = smoothstep(0.0, -0.15, sunDot);
        vec4 nightColor = texture2D(nightTex, vUv);
        float luminance = dot(nightColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 boosted = nightColor.rgb * (1.0 + luminance * 2.0);
        gl_FragColor = vec4(boosted * 0.8, nightFactor * luminance * 1.5);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
  });
  nightMesh = new THREE.Mesh(nightGeo, nightShaderMat);
  scene.add(nightMesh);

  // ─── Graticule styling ───
  setTimeout(() => {
    scene.traverse((obj: THREE.Object3D) => {
      const line = obj as THREE.LineSegments;
      if (line.isLineSegments) {
        const mat = line.material as THREE.LineBasicMaterial;
        if (mat.isLineBasicMaterial) {
          mat.color.set(0x1B2E38); // --globe-grat
          mat.opacity = 0.4;
          mat.transparent = true;
        }
      }
    });
  }, 500);

  // ─── Update sun position ───
  function updateTerminator() {
    if (destroyed || !sunLight) return;
    const subsolar = getSubsolarPoint(new Date());
    const [x, y, z] = subsolarToDirection(subsolar);
    sunLight.position.set(x * 50, y * 50, z * 50);
    sunLight.lookAt(0, 0, 0);
    if (nightMesh) {
      (nightMesh.material as THREE.ShaderMaterial).uniforms.sunDir.value.set(x, y, z);
    }
  }
  updateTerminator();
  terminatorTimer = setInterval(updateTerminator, 60_000);

  // ─── Extras animation loop ───
  function animateExtras() {
    if (destroyed) return;
    if (outerGlow) outerGlow.rotation.y += 0.0002;
    if (starField) starField.rotation.y += 0.00004;
    extrasRafId = requestAnimationFrame(animateExtras);
  }
  animateExtras();

  // ─── Auto-rotate with idle timer ───
  function pauseAutoRotate() {
    controls.autoRotate = false;
    if (autoRotateTimer) clearTimeout(autoRotateTimer);
  }

  function scheduleResumeAutoRotate() {
    if (autoRotateTimer) clearTimeout(autoRotateTimer);
    autoRotateTimer = setTimeout(() => {
      if (!destroyed) controls.autoRotate = true;
    }, 60_000);
  }

  if (canvas) {
    canvas.addEventListener('mousedown', pauseAutoRotate);
    canvas.addEventListener('touchstart', pauseAutoRotate, { passive: true });
    canvas.addEventListener('mouseup', scheduleResumeAutoRotate);
    canvas.addEventListener('touchend', scheduleResumeAutoRotate);
  }

  // ─── Right-click → emit lat/lng ───
  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const coords = globe.toGlobeCoords(x, y);
    if (coords) {
      emit('contextmenu', { lat: coords.lat, lng: coords.lng });
    }
  });

  // ─── Resize handling ───
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        globe.width(width).height(height);
      }
    }
  });
  resizeObserver.observe(container);

  // ─── Event emitter ───
  function emit(event: string, data: unknown) {
    listeners[event]?.forEach((cb) => cb(data));
  }

  // ─── Visual mode switching ───
  function applyVisualMode(mode: VisualMode) {
    const mat = globe.globeMaterial() as THREE.MeshStandardMaterial;

    switch (mode) {
      case 'DEFAULT':
        globe.globeImageUrl(TEXTURES.DEFAULT);
        globe.atmosphereColor('#2E5A6E');
        if (mat.isMeshStandardMaterial) {
          mat.emissive.set(0x0a1f2e);
          mat.emissiveIntensity = 0.2;
        }
        if (outerGlow) (outerGlow.material as THREE.MeshBasicMaterial).color.set(0x2E5A6E);
        if (nightMesh) nightMesh.visible = true;
        if (sunLight) sunLight.intensity = 1.8;
        break;

      case 'SATELLITE':
        globe.globeImageUrl(TEXTURES.SATELLITE);
        globe.atmosphereColor('#3A6A80');
        if (mat.isMeshStandardMaterial) {
          mat.emissive.set(0x0a1520);
          mat.emissiveIntensity = 0.15;
        }
        if (outerGlow) (outerGlow.material as THREE.MeshBasicMaterial).color.set(0x3A6A80);
        if (nightMesh) nightMesh.visible = true;
        if (sunLight) sunLight.intensity = 2.0;
        break;

      case 'FLIR':
        globe.globeImageUrl(TEXTURES.DEFAULT);
        globe.atmosphereColor('#4A3200');
        if (mat.isMeshStandardMaterial) {
          mat.emissive.set(0x2a1800);
          mat.emissiveIntensity = 0.5;
          mat.color.set(0xFFAA00);
        }
        if (outerGlow) (outerGlow.material as THREE.MeshBasicMaterial).color.set(0x4A3200);
        if (nightMesh) nightMesh.visible = false;
        if (sunLight) sunLight.intensity = 0.5;
        break;

      case 'NVG':
        globe.globeImageUrl(TEXTURES.DEFAULT);
        globe.atmosphereColor('#0F5A2C');
        if (mat.isMeshStandardMaterial) {
          mat.emissive.set(0x0a2a12);
          mat.emissiveIntensity = 0.6;
          mat.color.set(0x39FF7A);
        }
        if (outerGlow) (outerGlow.material as THREE.MeshBasicMaterial).color.set(0x0F5A2C);
        if (nightMesh) nightMesh.visible = false;
        if (sunLight) sunLight.intensity = 0.3;
        break;

      case 'CRT':
        globe.globeImageUrl(TEXTURES.DEFAULT);
        globe.atmosphereColor('#1A4A30');
        if (mat.isMeshStandardMaterial) {
          mat.emissive.set(0x0a2a18);
          mat.emissiveIntensity = 0.35;
          mat.color.set(0xffffff);
        }
        if (outerGlow) (outerGlow.material as THREE.MeshBasicMaterial).color.set(0x1A4A30);
        if (nightMesh) nightMesh.visible = true;
        if (sunLight) sunLight.intensity = 1.5;
        break;

      default:
        break;
    }

    // Reset color for non-tinted modes
    if (mode === 'DEFAULT' || mode === 'SATELLITE' || mode === 'CRT') {
      if (mat.isMeshStandardMaterial) mat.color.set(0xffffff);
    }
  }

  // ─── GlobeApi ───
  const api: GlobeApi = {
    flyTo({ lat, lng, altitude = 1.5, ms = 1200 }) {
      if (destroyed) return;
      pauseAutoRotate();
      globe.pointOfView({ lat, lng, altitude }, ms);
      scheduleResumeAutoRotate();
    },

    flyToBounds(points, ms = 1200) {
      if (destroyed || points.length === 0) return;
      const lats = points.map((p) => p.lat);
      const lngs = points.map((p) => p.lng);
      const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const latSpan = Math.max(...lats) - Math.min(...lats);
      const lngSpan = Math.max(...lngs) - Math.min(...lngs);
      const span = Math.max(latSpan, lngSpan);
      const altitude = Math.max(0.3, span / 40);
      api.flyTo({ lat, lng, altitude, ms });
    },

    select(_entityId) {
      // Selection will be implemented with layers in Phase 2
    },

    setAutoRotate(enabled) {
      if (autoRotateTimer) clearTimeout(autoRotateTimer);
      controls.autoRotate = enabled;
    },

    setMode(_mode) {
      // Mode switching (globe/flat/cesium) handled at shell level
    },

    setVisualMode(mode) {
      applyVisualMode(mode);
      document.documentElement.setAttribute('data-style', mode);
      localStorage.setItem('god-eye-style', mode);
    },

    getViewport() {
      const pov = globe.pointOfView();
      return { lat: pov.lat, lng: pov.lng, altitude: pov.altitude };
    },

    on(event: string, cb: EventCb) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (autoRotateTimer) clearTimeout(autoRotateTimer);
      if (terminatorTimer) clearInterval(terminatorTimer);
      if (extrasRafId != null) cancelAnimationFrame(extrasRafId);
      resizeObserver.disconnect();

      // Dispose Three.js objects
      for (const obj of [outerGlow, nightMesh, starField]) {
        if (!obj) continue;
        scene.remove(obj);
        obj.geometry.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m.dispose();
      }
      if (sunLight) scene.remove(sunLight);
      scene.remove(ambientLight);

      globe._destructor();
    },
  };

  // Expose on window for console access
  (window as unknown as Record<string, unknown>).globeApi = api;

  return api;
}
