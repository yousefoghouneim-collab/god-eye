"""Satellite imagery in dossier — Microsoft Planetary Computer STAC.

Queries the free Planetary Computer STAC API (no key needed) for the
latest cloud-free Sentinel-2 L2A tile at a given lat/lng, returning:
  - thumbnail URL (served directly from Planetary Computer)
  - scene metadata: date, cloud cover, tile name

GET /osint/imagery/sentinel2?lat=&lng=
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/osint/imagery", tags=["imagery"])

# Simple in-memory LRU-ish cache keyed by rounded coordinates
_cache: dict[str, dict] = {}
_CACHE_TTL = 3600  # 1 h
_MAX_CACHE = 200

_PC_STAC_SEARCH = "https://planetarycomputer.microsoft.com/api/stac/v1/search"


async def _fetch_sentinel2_thumbnail(lat: float, lng: float) -> dict | None:
    """Query Planetary Computer STAC for the most recent cloud-free Sentinel-2 tile."""
    # bbox ~0.5° around the point
    delta = 0.5
    bbox = [lng - delta, lat - delta, lng + delta, lat + delta]

    payload: dict[str, Any] = {
        "collections": ["sentinel-2-l2a"],
        "bbox": bbox,
        "query": {"eo:cloud_cover": {"lt": 30}},
        "sortby": [{"field": "datetime", "direction": "desc"}],
        "limit": 1,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                _PC_STAC_SEARCH,
                json=payload,
                headers={"Accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            if not features:
                return None

            item = features[0]
            props = item.get("properties", {})
            assets = item.get("assets", {})

            # Prefer rendered_preview, else thumbnail, else overview
            thumb_url = (
                assets.get("rendered_preview", {}).get("href")
                or assets.get("thumbnail", {}).get("href")
                or assets.get("overview", {}).get("href")
            )

            # Planetary Computer assets require SAS token signing
            # Use the unsigned preview URL which is publicly accessible
            rendered = assets.get("rendered_preview", {})
            if rendered.get("href"):
                thumb_url = rendered["href"]

            return {
                "scene_id": item.get("id", ""),
                "date": props.get("datetime", "")[:10] if props.get("datetime") else "",
                "cloud_cover": props.get("eo:cloud_cover"),
                "tile_name": props.get("s2:mgrs_tile", ""),
                "platform": props.get("platform", "Sentinel-2"),
                "thumbnail_url": thumb_url,
                "stac_url": item.get("links", [{}])[0].get("href", "") if item.get("links") else "",
                "bbox": item.get("bbox", []),
            }
    except Exception:
        return None


@router.get("/sentinel2")
async def get_sentinel2(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> dict:
    """Return the latest cloud-free Sentinel-2 L2A thumbnail + metadata for a point."""
    # Cache key rounded to 0.1° for reasonable reuse
    cache_key = f"{lat:.1f},{lng:.1f}"
    now = time.time()

    if cache_key in _cache:
        entry = _cache[cache_key]
        if now - entry["ts"] < _CACHE_TTL:
            return {"ok": True, **entry["data"]} if entry["data"] else {"ok": False, "scene": None}

    scene = await _fetch_sentinel2_thumbnail(lat, lng)

    # Evict oldest if cache full
    if len(_cache) >= _MAX_CACHE:
        oldest = min(_cache, key=lambda k: _cache[k]["ts"])
        _cache.pop(oldest, None)

    _cache[cache_key] = {"data": scene, "ts": now}

    if not scene:
        return {"ok": False, "scene": None, "message": "No recent Sentinel-2 scene found."}
    return {"ok": True, "scene": scene}
