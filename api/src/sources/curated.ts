/**
 * Curated static geo datasets — military bases, ports, chokepoints, etc.
 * Data adapted from public sources (ASIAR HKU 2020, EIA, WRI, Epoch AI).
 * Served as static layers with long TTL.
 */
import type { BaseEntity } from '@god-eye/shared';

// ─── Military Bases (subset of ASIAR dataset, HKU 2020 + CONUS) ───
export const MILITARY_BASES: BaseEntity[] = [
  { id: 'norfolk', type: 'base', lat: 36.95, lng: -76.31, label: 'Norfolk Naval — Atlantic Fleet HQ', source: 'curated' },
  { id: 'fort_liberty', type: 'base', lat: 35.14, lng: -79.0, label: 'Fort Liberty — XVIII Airborne Corps', source: 'curated' },
  { id: 'pendleton', type: 'base', lat: 33.38, lng: -117.4, label: 'Camp Pendleton — 1st Marine Div', source: 'curated' },
  { id: 'san_diego', type: 'base', lat: 32.68, lng: -117.13, label: 'Naval San Diego — Pacific Fleet', source: 'curated' },
  { id: 'nellis', type: 'base', lat: 36.24, lng: -115.03, label: 'Nellis AFB — Red Flag', source: 'curated' },
  { id: 'langley', type: 'base', lat: 37.08, lng: -76.36, label: 'Langley AFB — ACC HQ', source: 'curated' },
  { id: 'cheyenne', type: 'base', lat: 38.74, lng: -104.85, label: 'Cheyenne Mountain — NORAD', source: 'curated' },
  { id: 'peterson', type: 'base', lat: 38.82, lng: -104.71, label: 'Peterson SFB — US Space Cmd', source: 'curated' },
  { id: 'kings_bay', type: 'base', lat: 30.8, lng: -81.52, label: 'Kings Bay — SSBN Atlantic', source: 'curated' },
  { id: 'kitsap', type: 'base', lat: 47.56, lng: -122.66, label: 'Naval Kitsap — SSBN Pacific', source: 'curated' },
  { id: 'yokosuka', type: 'base', lat: 35.28, lng: 139.67, label: 'Yokosuka — 7th Fleet HQ', source: 'curated' },
  { id: 'rota', type: 'base', lat: 36.62, lng: -6.35, label: 'Naval Rota — Aegis BMD', source: 'curated' },
  { id: 'incirlik', type: 'base', lat: 37.0, lng: 35.43, label: 'Incirlik AB — US/Turkey', source: 'curated' },
  { id: 'ramstein', type: 'base', lat: 49.44, lng: 7.6, label: 'Ramstein AB — USAFE HQ', source: 'curated' },
  { id: 'diego_garcia', type: 'base', lat: -7.32, lng: 72.42, label: 'Diego Garcia — Indian Ocean', source: 'curated' },
  { id: 'guam', type: 'base', lat: 13.48, lng: 144.8, label: 'Andersen AFB — Pacific power', source: 'curated' },
  { id: 'al_udeid', type: 'base', lat: 25.12, lng: 51.31, label: 'Al Udeid — CENTCOM Forward', source: 'curated' },
  { id: 'al_dhafra', type: 'base', lat: 24.25, lng: 54.55, label: 'Al Dhafra — USAF UAE', source: 'curated' },
  { id: 'camp_humphreys', type: 'base', lat: 36.96, lng: 127.03, label: 'Camp Humphreys — USFK HQ', source: 'curated' },
  { id: 'kadena', type: 'base', lat: 26.35, lng: 127.77, label: 'Kadena AB — Okinawa', source: 'curated' },
  { id: 'djibouti', type: 'base', lat: 11.55, lng: 43.15, label: 'Camp Lemonnier — HOA', source: 'curated' },
  { id: 'thule', type: 'base', lat: 76.53, lng: -68.7, label: 'Pituffik SB — Arctic radar', source: 'curated' },
  // Russia
  { id: 'kaliningrad', type: 'base', lat: 54.71, lng: 20.51, label: 'Kaliningrad — Baltic Fleet', source: 'curated' },
  { id: 'sevastopol', type: 'base', lat: 44.6, lng: 33.5, label: 'Sevastopol — Black Sea Fleet', source: 'curated' },
  { id: 'vladivostok', type: 'base', lat: 43.12, lng: 131.9, label: 'Vladivostok — Pacific Fleet', source: 'curated' },
  { id: 'murmansk', type: 'base', lat: 68.97, lng: 33.09, label: 'Murmansk — Northern Fleet', source: 'curated' },
  { id: 'tartus', type: 'base', lat: 34.89, lng: 35.87, label: 'Tartus — Russian Med base', source: 'curated' },
  { id: 'hmeimim', type: 'base', lat: 35.41, lng: 35.95, label: 'Hmeimim — Russian Syria', source: 'curated' },
  // China
  { id: 'zhanjiang', type: 'base', lat: 21.2, lng: 110.4, label: 'Zhanjiang — South Sea Fleet', source: 'curated' },
  { id: 'yulin', type: 'base', lat: 18.23, lng: 109.52, label: 'Yulin — SSBN Hainan', source: 'curated' },
  { id: 'djibouti_cn', type: 'base', lat: 11.59, lng: 43.06, label: 'PLA Support Base Djibouti', source: 'curated' },
  { id: 'ream', type: 'base', lat: 10.51, lng: 103.63, label: 'Ream Naval — Cambodia/China', source: 'curated' },
];

// ─── Strategic Chokepoints (13 canonical) ───
export const CHOKEPOINTS: BaseEntity[] = [
  { id: 'suez', type: 'port', lat: 30.5, lng: 32.3, label: 'Suez Canal — 12% global trade', source: 'curated' },
  { id: 'malacca', type: 'port', lat: 2.5, lng: 101.5, label: 'Strait of Malacca — 25% global trade', source: 'curated' },
  { id: 'hormuz', type: 'port', lat: 26.5, lng: 56.5, label: 'Strait of Hormuz — 21% global oil', source: 'curated' },
  { id: 'bab_el_mandeb', type: 'port', lat: 12.6, lng: 43.3, label: 'Bab el-Mandeb — Red Sea gate', source: 'curated' },
  { id: 'panama', type: 'port', lat: 9.0, lng: -79.5, label: 'Panama Canal — Americas transit', source: 'curated' },
  { id: 'taiwan', type: 'port', lat: 24.0, lng: 119.5, label: 'Taiwan Strait — chip supply', source: 'curated' },
  { id: 'cape', type: 'port', lat: -34.4, lng: 18.5, label: 'Cape of Good Hope — Suez bypass', source: 'curated' },
  { id: 'gibraltar', type: 'port', lat: 36.0, lng: -5.4, label: 'Strait of Gibraltar — Med-Atlantic', source: 'curated' },
  { id: 'bosphorus', type: 'port', lat: 41.1, lng: 29.05, label: 'Bosphorus — Black Sea gate', source: 'curated' },
  { id: 'korea', type: 'port', lat: 34.0, lng: 129.0, label: 'Korea Strait', source: 'curated' },
  { id: 'dover', type: 'port', lat: 51.1, lng: 1.3, label: 'Strait of Dover', source: 'curated' },
  { id: 'lombok', type: 'port', lat: -8.5, lng: 115.8, label: 'Lombok Strait — Malacca alt', source: 'curated' },
];

// ─── Major Ports (top 30 + strategic) ───
export const PORTS: BaseEntity[] = [
  { id: 'shanghai', type: 'port', lat: 31.23, lng: 121.47, label: 'Shanghai — 47M+ TEU #1', source: 'curated' },
  { id: 'singapore', type: 'port', lat: 1.26, lng: 103.84, label: 'Singapore — 37M+ TEU #2', source: 'curated' },
  { id: 'ningbo', type: 'port', lat: 29.87, lng: 121.55, label: 'Ningbo-Zhoushan — 33M+ TEU #3', source: 'curated' },
  { id: 'shenzhen', type: 'port', lat: 22.52, lng: 114.05, label: 'Shenzhen — 30M+ TEU #4', source: 'curated' },
  { id: 'busan', type: 'port', lat: 35.1, lng: 129.04, label: 'Busan — 22M+ TEU #7', source: 'curated' },
  { id: 'rotterdam', type: 'port', lat: 51.9, lng: 4.5, label: 'Rotterdam — EU #1 14M+ TEU', source: 'curated' },
  { id: 'jebel_ali', type: 'port', lat: 25.01, lng: 55.06, label: 'Jebel Ali — ME #1 14M+ TEU', source: 'curated' },
  { id: 'antwerp', type: 'port', lat: 51.26, lng: 4.4, label: 'Antwerp-Bruges — EU #2', source: 'curated' },
  { id: 'los_angeles', type: 'port', lat: 33.73, lng: -118.26, label: 'Los Angeles — US #1', source: 'curated' },
  { id: 'new_york_nj', type: 'port', lat: 40.67, lng: -74.04, label: 'NY/NJ — US East #1', source: 'curated' },
  { id: 'piraeus', type: 'port', lat: 37.94, lng: 23.65, label: 'Piraeus — COSCO Med hub', source: 'curated' },
  { id: 'ras_tanura', type: 'port', lat: 26.64, lng: 50.16, label: 'Ras Tanura — 6.5M bpd oil', source: 'curated' },
  { id: 'ras_laffan', type: 'port', lat: 25.93, lng: 51.54, label: 'Ras Laffan — LNG #1 77Mt/yr', source: 'curated' },
  { id: 'houston', type: 'port', lat: 29.73, lng: -95.02, label: 'Houston — US petrochemical', source: 'curated' },
  { id: 'djibouti_port', type: 'port', lat: 11.59, lng: 43.15, label: 'Djibouti — Bab el-Mandeb', source: 'curated' },
  { id: 'gwadar', type: 'port', lat: 25.12, lng: 62.33, label: 'Gwadar — CPEC', source: 'curated' },
  { id: 'hambantota', type: 'port', lat: 6.12, lng: 81.12, label: 'Hambantota — Chinese lease', source: 'curated' },
];

// ─── Nuclear Sites ───
export const NUCLEAR_SITES: BaseEntity[] = [
  { id: 'natanz', type: 'base', lat: 33.72, lng: 51.73, label: 'Natanz — Iran enrichment', source: 'curated' },
  { id: 'fordow', type: 'base', lat: 34.88, lng: 51.99, label: 'Fordow — Iran enrichment', source: 'curated' },
  { id: 'dimona', type: 'base', lat: 31.0, lng: 35.14, label: 'Dimona — Israel nuclear', source: 'curated' },
  { id: 'yongbyon', type: 'base', lat: 39.8, lng: 125.75, label: 'Yongbyon — DPRK nuclear', source: 'curated' },
  { id: 'punggye', type: 'base', lat: 41.28, lng: 129.08, label: 'Punggye-ri — DPRK test site', source: 'curated' },
  { id: 'semipalatinsk', type: 'base', lat: 50.44, lng: 77.8, label: 'Semipalatinsk — KZ test site', source: 'curated' },
  { id: 'parchin', type: 'base', lat: 35.52, lng: 51.77, label: 'Parchin — Iran military', source: 'curated' },
  { id: 'bushehr', type: 'base', lat: 28.83, lng: 50.89, label: 'Bushehr — Iran reactor', source: 'curated' },
  { id: 'la_hague', type: 'base', lat: 49.68, lng: -1.88, label: 'La Hague — France reprocessing', source: 'curated' },
  { id: 'sellafield', type: 'base', lat: 54.42, lng: -3.5, label: 'Sellafield — UK reprocessing', source: 'curated' },
];

// ─── All curated datasets ───
export const CURATED_DATASETS: Record<string, BaseEntity[]> = {
  bases: MILITARY_BASES,
  chokepoints: CHOKEPOINTS,
  ports: PORTS,
  nuclear: NUCLEAR_SITES,
};
