# GOD-EYE — Data Attribution

All live data sources are credited below. Attribution strings are displayed
in the UI where provider terms require it. Cache intervals are observed to
respect rate limits on volunteer-run and free-tier endpoints.

---

## Live Data Sources

| Layer | Provider | License / Terms | Attribution String | Cache |
|---|---|---|---|---|
| Earthquakes | USGS Earthquake Hazards Program | Public Domain | "USGS Earthquake Hazards Program" | 5 min |
| Active Fires | NASA FIRMS (VIIRS/MODIS) | [FIRMS Terms](https://firms.modaps.eosdis.nasa.gov/usfs/api/area/) | "NASA FIRMS / USFS" | 15 min |
| Natural Events | NASA EONET | Public Domain | "NASA EONET" | 30 min |
| Aircraft | adsb.lol | ODbL 1.0 | "adsb.lol contributors (ODbL)" | 30 s |
| Volcanoes | Smithsonian Global Volcanism Program | [GVP Terms](https://volcano.si.edu/gvp_useterms.cfm) | "Smithsonian GVP" | 6 h |
| Conflicts | GDELT Project | CC BY 4.0 | "GDELT Project" | 30 min |
| Weather Alerts | NOAA National Weather Service | Public Domain | "NOAA / NWS" | 10 min |
| Satellites (TLE) | CelesTrak (Dr T.S. Kelso) | [CelesTrak Terms](https://celestrak.org/) | "CelesTrak / Space-Track" | 2 h |
| Markets (indices) | Yahoo Finance (unofficial proxy) | For personal research only | — | 5 min |
| Crypto prices | CoinGecko API | [CoinGecko Terms](https://www.coingecko.com/en/api/documentation) | "CoinGecko" | 5 min |
| Fear & Greed | alternative.me | Free for non-commercial use | "alternative.me" | 1 h |

## Geocoding & Enrichment

| Service | License / Terms | Notes |
|---|---|---|
| Nominatim (OpenStreetMap) | ODbL 1.0 | "© OpenStreetMap contributors" — displayed in map attribution. Usage Policy: 1 req/s, no bulk. |
| Wikidata | CC0 1.0 | Free for all use. |
| Wikipedia REST API | CC BY-SA 3.0 | Summaries attributed per article. |

## Satellite Imagery

| Service | License / Terms | Notes |
|---|---|---|
| Microsoft Planetary Computer (Sentinel-2 L2A) | [PC Terms](https://planetarycomputer.microsoft.com/docs/overview/terms-of-use/) | Free, no key needed. ESA Copernicus data (CC BY-SA 3.0 IGO). |
| NASA ASF DAAC (Sentinel-1 scenes) | [ASF Terms](https://asf.alaska.edu/data-basics/data-use/) | Free. ESA Copernicus data. |

## CCTV / Traffic Cameras

| Source | License / Terms |
|---|---|
| TfL Jam Cams (Transport for London) | [TfL Open Data](https://tfl.gov.uk/corporate/about-tfl/how-we-work/open-data-users/) — CC BY |
| NYC DOT Traffic Cameras | [NYC Open Data](https://data.cityofnewyork.us/) — Public Domain |
| Singapore LTA Traffic Images | [data.gov.sg](https://data.gov.sg/about) — Singapore Open Government Licence |
| Austin Mobility (Texas DOT) | Public Domain |
| California DOT (Caltrans CWWP2) | Public Domain (CA State) |
| Colorado DOT (COtrip) | Public Domain |

All CCTV sources are public traffic-authority cameras only, proxied server-side.

## Radio

| Source | Terms |
|---|---|
| KiwiSDR node directory | Publicly-listed receivers; individual owner terms apply per node. |
| OpenMHZ scanner feeds | [OpenMHZ Terms](https://www.openmhz.com/) — fair use, no scraping at scale. |

## Basemap / Globe Textures

Earth textures sourced from NASA Visible Earth (public domain).
Graticule geometry from Natural Earth (public domain).
Map tiles: © OpenStreetMap contributors (ODbL) when flat map is active.

---

## Compliance Notes

- **Rate limits** are observed via server-side Redis caching at the cadences above.
- **Attribution strings** required by provider terms are rendered in the map attribution bar
  and in this file.
- **Non-commercial** clauses (alternative.me, Yahoo Finance proxy) limit this deployment to
  personal / research use. Do not deploy as a commercial service without obtaining appropriate
  API agreements from each provider.
- **ADS-B ODbL**: any redistribution of adsb.lol data requires attribution and share-alike.
  This deployment caches locally and does not redistribute the raw feed.
