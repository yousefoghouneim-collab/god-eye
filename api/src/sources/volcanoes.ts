import type { BaseEntity } from '@god-eye/shared';

// Smithsonian GVP Holocene volcanoes via NOAA
const GVP_URL = 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json&maxFeatures=2000';

interface GVPFeature {
  properties: {
    Volcano_Number: number;
    Volcano_Name: string;
    Primary_Volcano_Type: string;
    Last_Eruption_Year: number | null;
    Country: string;
    Elevation: number;
  };
  geometry: {
    coordinates: [number, number];
  };
}

interface GVPResponse {
  features: GVPFeature[];
}

export async function fetchVolcanoes(): Promise<BaseEntity[]> {
  const res = await fetch(GVP_URL);
  if (!res.ok) throw new Error(`GVP ${res.status}`);
  const data = (await res.json()) as GVPResponse;
  return data.features
    .filter((f) => f.geometry?.coordinates)
    .map((f) => ({
      id: `volcano-${f.properties.Volcano_Number}`,
      type: 'volcano' as const,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      label: `${f.properties.Volcano_Name} (${f.properties.Country})`,
      source: 'gvp',
    }));
}

export const VOLCANO_KEY = 'volcanoes:holocene';
export const VOLCANO_TTL = 24 * 60 * 60 * 1000; // 24h — static dataset
export const VOLCANO_SOURCE = 'gvp';
