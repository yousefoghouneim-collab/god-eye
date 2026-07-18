"""SAR (Synthetic Aperture Radar) ground-change watch areas.

Endpoints:
  GET  /osint/sar/status          — feature status + signup hints
  GET  /osint/sar/aois            — list operator-defined AOIs
  POST /osint/sar/aois            — add / replace an AOI
  DELETE /osint/sar/aois/{aoi_id} — remove an AOI
  GET  /osint/sar/scenes          — Sentinel-1 scene catalog (ASF Search, free)
  GET  /osint/sar/near?lat=&lng=&radius_km= — scenes within radius of a point

Mode A = free Sentinel-1 scene catalog via ASF Search (no key).
Mode B = NASA OPERA / Copernicus EGMS deformation products (requires free
         Earthdata account token — gated behind EARTHDATA_TOKEN env var).
"""

from __future__ import annotations

import math
import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/osint/sar", tags=["sar"])

# ── In-memory AOI store ───────────────────────────────────────────────────────
_aois: dict[str, dict] = {}

# ── Simple in-memory cache ────────────────────────────────────────────────────
_scene_cache: dict[str, Any] = {"data": None, "ts": 0}
_SCENE_TTL = 3600  # 1 hour


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── ASF Search helper (Mode A — keyless) ─────────────────────────────────────
async def _fetch_asf_scenes(limit: int = 200) -> list[dict]:
    """Query ASF Search for recent Sentinel-1 GRD scenes (free, no account)."""
    now = time.time()
    if _scene_cache["data"] is not None and now - _scene_cache["ts"] < _SCENE_TTL:
        return _scene_cache["data"]  # type: ignore[return-value]

    url = "https://api.daac.asf.alaska.edu/services/search/param"
    params = {
        "platform": "Sentinel-1",
        "processingLevel": "GRD_HD",
        "maxResults": limit,
        "output": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            raw = resp.json()
            # ASF returns [[features], [metadata]] — first list is results
            results_list = raw[0] if isinstance(raw, list) and raw else []
            scenes = []
            for item in results_list:
                props = item if isinstance(item, dict) else {}
                scenes.append({
                    "scene_id": props.get("granuleName", props.get("fileID", "")),
                    "platform": props.get("platform", "Sentinel-1"),
                    "date": props.get("startTime", ""),
                    "lat": float(props.get("centerLat", 0)),
                    "lon": float(props.get("centerLon", 0)),
                    "path": props.get("pathNumber"),
                    "frame": props.get("frameNumber"),
                    "orbit_direction": props.get("flightDirection", ""),
                    "browse_url": props.get("browse", ""),
                    "download_url": props.get("downloadUrl", ""),
                    "size_mb": props.get("sizeMB", 0),
                })
            _scene_cache["data"] = scenes
            _scene_cache["ts"] = now
            return scenes
    except Exception:
        return _scene_cache["data"] or []


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def sar_status() -> dict:
    """Returns Mode A/B capability status and setup hints."""
    mode_b_enabled = bool(os.getenv("EARTHDATA_TOKEN"))
    copernicus_enabled = bool(os.getenv("COPERNICUS_TOKEN"))
    return {
        "ok": True,
        "mode_a": {
            "enabled": True,
            "description": "Free Sentinel-1 scene catalog via ASF Search (no account needed).",
            "source": "NASA Earthdata / ASF DAAC",
        },
        "mode_b": {
            "enabled": mode_b_enabled,
            "description": "NASA OPERA / Copernicus EGMS deformation products (free Earthdata token required).",
            "source": "NASA OPERA + Copernicus EGMS",
            "signup_url": "https://urs.earthdata.nasa.gov/",
            "env_key": "EARTHDATA_TOKEN",
        },
        "copernicus": {
            "enabled": copernicus_enabled,
            "description": "Copernicus Sentinel Hub (CDSE) optical/SAR tiles (free account required).",
            "signup_url": "https://dataspace.copernicus.eu/",
            "env_key": "COPERNICUS_TOKEN",
        },
        "aoi_count": len(_aois),
        "help": None if mode_b_enabled else [
            "1. Create a free NASA Earthdata account at https://urs.earthdata.nasa.gov/",
            "2. Generate a Bearer token in your profile.",
            "3. Set EARTHDATA_TOKEN=<token> in your .env file and restart the OSINT service.",
            "4. Mode B (deformation products) will activate automatically.",
        ],
    }


@router.get("/aois")
async def sar_aoi_list() -> dict:
    return {"ok": True, "aois": list(_aois.values())}


class SarAoiPayload(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field("", max_length=400)
    center_lat: float = Field(..., ge=-90, le=90)
    center_lon: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(25.0, ge=1.0, le=500.0)
    category: str = Field("watchlist", max_length=40)


@router.post("/aois")
async def sar_aoi_upsert(payload: SarAoiPayload) -> dict:
    aoi_id = payload.id.strip().lower()
    aoi = {
        "id": aoi_id,
        "name": payload.name.strip(),
        "description": payload.description.strip(),
        "center_lat": payload.center_lat,
        "center_lon": payload.center_lon,
        "radius_km": payload.radius_km,
        "category": payload.category.strip().lower(),
        "created_at": int(time.time() * 1000),
    }
    _aois[aoi_id] = aoi
    return {"ok": True, "aoi": aoi}


@router.delete("/aois/{aoi_id}")
async def sar_aoi_delete(aoi_id: str) -> dict:
    aoi_id = aoi_id.strip().lower()
    if aoi_id not in _aois:
        raise HTTPException(status_code=404, detail="AOI not found")
    _aois.pop(aoi_id)
    return {"ok": True, "removed": aoi_id}


@router.get("/scenes")
async def sar_scenes(
    aoi_id: str = Query(""),
    limit: int = Query(100, ge=1, le=500),
) -> dict:
    """Return Sentinel-1 scenes. Optionally filter to scenes within an AOI's radius."""
    scenes = await _fetch_asf_scenes()
    if aoi_id:
        aoi = _aois.get(aoi_id.strip().lower())
        if aoi:
            scenes = [
                s for s in scenes
                if _haversine_km(s["lat"], s["lon"], aoi["center_lat"], aoi["center_lon"])
                   <= aoi["radius_km"]
            ]
    return {
        "ok": True,
        "count": len(scenes[:limit]),
        "scenes": scenes[:limit],
        "mode_a_enabled": True,
        "mode_b_enabled": bool(os.getenv("EARTHDATA_TOKEN")),
    }


@router.get("/near")
async def sar_near(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(50.0, ge=1.0, le=2000.0),
    limit: int = Query(20, ge=1, le=200),
) -> dict:
    """Return Sentinel-1 scenes within radius_km of (lat, lng)."""
    scenes = await _fetch_asf_scenes()
    matches = []
    for s in scenes:
        dist = _haversine_km(lat, lng, s["lat"], s["lon"])
        if dist <= radius_km:
            matches.append({**s, "distance_km": round(dist, 2)})
    matches.sort(key=lambda x: x["distance_km"])
    return {"ok": True, "count": len(matches[:limit]), "scenes": matches[:limit]}
