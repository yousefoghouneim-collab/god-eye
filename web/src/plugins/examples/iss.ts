/**
 * ISS Tracker plugin — real-time ISS position via wheretheiss.at.
 * Updates every 10 seconds. No API key required.
 */
import { definePlugin } from '@god-eye/plugin-sdk';
import type { BaseEntity } from '@god-eye/shared';

const { manifest, plugin } = definePlugin(
  {
    id: 'iss-tracker',
    name: 'ISS Tracker',
    version: '1.0.0',
    description: 'Real-time International Space Station position (wheretheiss.at)',
    author: 'GOD-EYE',
    fetchInterval: 10_000,
    layer: {
      key: 'iss',
      label: 'ISS Position',
      icon: '🛸',
      category: 'tech',
      renderers: ['globe', 'flat'],
      source: 'wheretheiss.at',
      explanation: {
        purpose: 'Real-time ISS orbital position',
        source: 'wheretheiss.at (public, no key)',
        freshness: '10 seconds',
        confidence: 'High — directly from NASA telemetry relay',
        limitations: 'Single entity; no historical track',
      },
    },
  },
  async (ctx) => {
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544', {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`wheretheiss.at returned ${res.status}`);
    const data = await res.json() as {
      latitude: number;
      longitude: number;
      altitude: number;
      velocity: number;
      visibility: string;
      timestamp: number;
    };

    ctx.log(`ISS @ ${data.latitude.toFixed(2)}, ${data.longitude.toFixed(2)} alt=${data.altitude.toFixed(0)}km`);

    const entity: BaseEntity = {
      id: 'ISS-25544',
      type: 'satellite',
      lat: data.latitude,
      lng: data.longitude,
      label: `ISS  ${data.altitude.toFixed(0)}km  ${data.velocity.toFixed(0)}km/h`,
      source: 'wheretheiss.at',
      timestamp: data.timestamp * 1000,
    };

    return [entity];
  }
);

export { manifest, plugin };
