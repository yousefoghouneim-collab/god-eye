/**
 * Selection Dossier — renders entity details into the right-rail panel.
 * Listens to DataBus 'selection:change' events.
 */
import { DataBus } from '../bus/data-bus.js';
import type {
  GodEyeEntity,
  AircraftEntity,
  EarthquakeEntity,
  FireEntity,
} from '@god-eye/shared';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTime(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

function renderAircraft(e: AircraftEntity): string {
  return `
    <div class="dossier__type">AIRCRAFT</div>
    <div class="dossier__grid">
      <span class="hud-label">CALLSIGN</span><span class="telemetry">${escHtml(e.callsign ?? '—')}</span>
      <span class="hud-label">ICAO24</span><span class="telemetry">${escHtml(e.icao24)}</span>
      <span class="hud-label">ALTITUDE</span><span class="telemetry">${e.altitude != null ? e.altitude.toLocaleString() + ' ft' : '—'}</span>
      <span class="hud-label">VELOCITY</span><span class="telemetry">${e.velocity != null ? e.velocity.toFixed(0) + ' kt' : '—'}</span>
      <span class="hud-label">HEADING</span><span class="telemetry">${e.heading != null ? e.heading.toFixed(0) + '°' : '—'}</span>
      <span class="hud-label">ON GROUND</span><span class="telemetry">${e.onGround ? 'YES' : 'NO'}</span>
      <span class="hud-label">POSITION</span><span class="telemetry">${e.lat.toFixed(4)}°, ${e.lng.toFixed(4)}°</span>
      <span class="hud-label">UPDATED</span><span class="telemetry">${formatTime(e.timestamp)}</span>
      <span class="hud-label">SOURCE</span><span class="telemetry">${escHtml(e.source)}</span>
    </div>`;
}

function renderEarthquake(e: EarthquakeEntity): string {
  return `
    <div class="dossier__type">EARTHQUAKE</div>
    <div class="dossier__grid">
      <span class="hud-label">MAGNITUDE</span><span class="telemetry" style="color: var(--signal-amber)">${e.magnitude.toFixed(1)}</span>
      <span class="hud-label">DEPTH</span><span class="telemetry">${e.depth.toFixed(1)} km</span>
      <span class="hud-label">LOCATION</span><span class="telemetry">${escHtml(e.place ?? '—')}</span>
      <span class="hud-label">TSUNAMI</span><span class="telemetry" style="color: ${e.tsunamiWarning ? 'var(--signal-red)' : 'var(--text-lo)'}">${e.tsunamiWarning ? 'WARNING' : 'None'}</span>
      <span class="hud-label">POSITION</span><span class="telemetry">${e.lat.toFixed(4)}°, ${e.lng.toFixed(4)}°</span>
      <span class="hud-label">TIME</span><span class="telemetry">${formatTime(e.timestamp)}</span>
      <span class="hud-label">SOURCE</span><span class="telemetry">${escHtml(e.source)}</span>
    </div>`;
}

function renderFire(e: FireEntity): string {
  return `
    <div class="dossier__type">ACTIVE FIRE</div>
    <div class="dossier__grid">
      <span class="hud-label">BRIGHTNESS</span><span class="telemetry" style="color: var(--signal-orange)">${e.brightness.toFixed(1)}K</span>
      <span class="hud-label">FRP</span><span class="telemetry">${e.frp != null ? e.frp.toFixed(1) + ' MW' : '—'}</span>
      <span class="hud-label">CONFIDENCE</span><span class="telemetry">${escHtml(e.confidence ?? '—')}</span>
      <span class="hud-label">SATELLITE</span><span class="telemetry">${escHtml(e.satellite ?? '—')}</span>
      <span class="hud-label">POSITION</span><span class="telemetry">${e.lat.toFixed(4)}°, ${e.lng.toFixed(4)}°</span>
      <span class="hud-label">DETECTED</span><span class="telemetry">${formatTime(e.timestamp)}</span>
      <span class="hud-label">SOURCE</span><span class="telemetry">${escHtml(e.source)}</span>
    </div>`;
}

function renderGeneric(e: GodEyeEntity): string {
  return `
    <div class="dossier__type">${escHtml(e.type.toUpperCase())}</div>
    <div class="dossier__grid">
      <span class="hud-label">ID</span><span class="telemetry">${escHtml(e.id)}</span>
      <span class="hud-label">LABEL</span><span class="telemetry">${escHtml(e.label ?? '—')}</span>
      <span class="hud-label">POSITION</span><span class="telemetry">${e.lat.toFixed(4)}°, ${e.lng.toFixed(4)}°</span>
      <span class="hud-label">TIME</span><span class="telemetry">${formatTime(e.timestamp)}</span>
      <span class="hud-label">SOURCE</span><span class="telemetry">${escHtml(e.source)}</span>
    </div>`;
}

function renderEntity(entity: GodEyeEntity): string {
  switch (entity.type) {
    case 'aircraft': return renderAircraft(entity as AircraftEntity);
    case 'earthquake': return renderEarthquake(entity as EarthquakeEntity);
    case 'fire': return renderFire(entity as FireEntity);
    default: return renderGeneric(entity);
  }
}

export function initDossier() {
  DataBus.on('selection:change', (payload) => {
    const entity = payload as GodEyeEntity;
    const panel = document.querySelector('#selection-dossier .panel__body');
    if (!panel) return;
    panel.innerHTML = renderEntity(entity);
  });
}
