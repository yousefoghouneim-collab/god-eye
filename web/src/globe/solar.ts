/** Compute the subsolar point (lat/lng where the sun is directly overhead) from a Date. */
export function getSubsolarPoint(date: Date): { lat: number; lng: number } {
  const jd = toJulianDate(date);
  const n = jd - 2451545.0; // days since J2000.0

  // Mean longitude and anomaly of the Sun
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * (Math.PI / 180);

  // Ecliptic longitude
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * (Math.PI / 180);

  // Obliquity of the ecliptic
  const epsilon = 23.439 * (Math.PI / 180);

  // Declination (latitude of subsolar point)
  const lat = Math.asin(Math.sin(epsilon) * Math.sin(lambda)) * (180 / Math.PI);

  // Equation of time (minutes)
  const B = ((360 / 365) * (n - 81)) * (Math.PI / 180);
  const EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Hour angle → longitude
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lng = -((utcHours - 12) * 15 + EoT / 4);

  return { lat, lng: ((lng + 540) % 360) - 180 };
}

function toJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Convert lat/lng to a Three.js-style direction vector (unit sphere). */
export function subsolarToDirection(subsolar: { lat: number; lng: number }): [number, number, number] {
  const latRad = subsolar.lat * (Math.PI / 180);
  const lngRad = subsolar.lng * (Math.PI / 180);
  return [
    Math.cos(latRad) * Math.sin(lngRad),
    Math.sin(latRad),
    Math.cos(latRad) * Math.cos(lngRad),
  ];
}
