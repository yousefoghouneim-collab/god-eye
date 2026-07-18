"""Radio intercept sources — KiwiSDR + OpenMHZ.

Endpoints (all server-side proxied to respect rate limits):
  GET /osint/radio/kiwisdr              — KiwiSDR node list (linkfanel mirror, 24h cache)
  GET /osint/radio/openmhz/systems      — OpenMHZ scanner system list (30min cache)
  GET /osint/radio/openmhz/calls/{sys}  — Recent calls for a system (5min cache)
  GET /osint/radio/nearest?lat=&lng=    — Nearest OpenMHZ system by great-circle distance

All endpoints degrade gracefully when upstream is unreachable.
"""

from __future__ import annotations

import math
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/osint/radio", tags=["radio"])

# ── In-memory cache ───────────────────────────────────────────────────────────
_kiwi_cache: dict[str, Any] = {"data": None, "ts": 0}
_KIWI_TTL = 86400  # 24h — node list changes slowly

_openmhz_systems_cache: dict[str, Any] = {"data": None, "ts": 0}
_OPENMHZ_SYSTEMS_TTL = 1800  # 30min

_openmhz_calls_cache: dict[str, dict] = {}  # sys_name → {data, ts}
_OPENMHZ_CALLS_TTL = 300  # 5min


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── KiwiSDR ───────────────────────────────────────────────────────────────────
# linkfanel mirror aggregates publicly-listed KiwiSDR receivers
_KIWI_URL = "http://kiwisdr.com/public/"

async def _fetch_kiwisdr_nodes() -> list[dict]:
    now = time.time()
    if _kiwi_cache["data"] is not None and now - _kiwi_cache["ts"] < _KIWI_TTL:
        return _kiwi_cache["data"]  # type: ignore[return-value]

    # The KiwiSDR public list is HTML; use the community JSON mirror at rx-888
    # Fallback: parse status.kiwisdr.com JSON API
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "http://rx-888.kiwisdr.com/status/rx.json",
                headers={"User-Agent": "GOD-EYE/0.2 (private research)"},
            )
            resp.raise_for_status()
            raw = resp.json()
            nodes = []
            for item in (raw if isinstance(raw, list) else raw.get("receivers", [])):
                n: dict = {
                    "id": str(item.get("id", "")),
                    "name": item.get("name", ""),
                    "lat": float(item.get("lat", item.get("latitude", 0))),
                    "lon": float(item.get("lon", item.get("longitude", 0))),
                    "url": item.get("url", item.get("addr", "")),
                    "users": item.get("users", 0),
                    "users_max": item.get("users_max", 4),
                    "snr": item.get("snr"),
                    "gps": item.get("gps"),
                }
                nodes.append(n)
            _kiwi_cache["data"] = nodes
            _kiwi_cache["ts"] = now
            return nodes
    except Exception:
        return _kiwi_cache["data"] or []


# ── OpenMHZ ───────────────────────────────────────────────────────────────────
_OPENMHZ_BASE = "https://api.openmhz.com"

async def _fetch_openmhz_systems() -> list[dict]:
    now = time.time()
    if _openmhz_systems_cache["data"] is not None and now - _openmhz_systems_cache["ts"] < _OPENMHZ_SYSTEMS_TTL:
        return _openmhz_systems_cache["data"]  # type: ignore[return-value]
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{_OPENMHZ_BASE}/systems",
                headers={"User-Agent": "GOD-EYE/0.2 (private research)"})
            resp.raise_for_status()
            data = resp.json()
            systems = data.get("systems", data if isinstance(data, list) else [])
            result = []
            for s in systems:
                result.append({
                    "sys_name": s.get("sys_name", s.get("systemName", "")),
                    "name": s.get("name", s.get("systemName", "")),
                    "city": s.get("city", ""),
                    "state": s.get("state", ""),
                    "country": s.get("country", "US"),
                    "lat": float(s.get("lat", s.get("latitude", 0))),
                    "lon": float(s.get("lon", s.get("longitude", 0))),
                    "num_calls": s.get("num_calls", s.get("numCalls", 0)),
                    "last_updated": s.get("last_updated", s.get("lastUpdated", "")),
                })
            _openmhz_systems_cache["data"] = result
            _openmhz_systems_cache["ts"] = now
            return result
    except Exception:
        return _openmhz_systems_cache["data"] or []


async def _fetch_openmhz_calls(sys_name: str, limit: int = 20) -> list[dict]:
    now = time.time()
    cached = _openmhz_calls_cache.get(sys_name)
    if cached and now - cached["ts"] < _OPENMHZ_CALLS_TTL:
        return cached["data"]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{_OPENMHZ_BASE}/{sys_name}/calls",
                params={"filter-type": "all", "limit": limit},
                headers={"User-Agent": "GOD-EYE/0.2 (private research)"},
            )
            resp.raise_for_status()
            data = resp.json()
            calls = data.get("calls", data if isinstance(data, list) else [])
            result = []
            for c in calls[:limit]:
                result.append({
                    "id": c.get("id", ""),
                    "time": c.get("time", c.get("start_time", "")),
                    "talkgroup_num": c.get("talkgroup_num", c.get("talkgroupNum", "")),
                    "talkgroup_description": c.get("talkgroup_description", c.get("talkgroupDescription", "")),
                    "call_length": c.get("call_length", c.get("callLength", 0)),
                    "audio_url": c.get("url", c.get("filename", "")),
                    "emergency": c.get("emergency", False),
                    "freq": c.get("freq", 0),
                })
            _openmhz_calls_cache[sys_name] = {"data": result, "ts": now}
            return result
    except Exception:
        return (cached or {}).get("data", [])


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/kiwisdr")
async def radio_kiwisdr(
    limit: int = Query(200, ge=1, le=1000),
) -> dict:
    """Return public KiwiSDR SDR receiver nodes."""
    nodes = await _fetch_kiwisdr_nodes()
    return {"ok": True, "count": len(nodes[:limit]), "nodes": nodes[:limit]}


@router.get("/openmhz/systems")
async def radio_openmhz_systems(
    limit: int = Query(100, ge=1, le=500),
) -> dict:
    """Return OpenMHZ scanner systems."""
    systems = await _fetch_openmhz_systems()
    return {"ok": True, "count": len(systems[:limit]), "systems": systems[:limit]}


@router.get("/openmhz/calls/{sys_name}")
async def radio_openmhz_calls(
    sys_name: str,
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """Return recent scanner calls for a system (rate-limited: 20/min)."""
    if not sys_name.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid sys_name")
    calls = await _fetch_openmhz_calls(sys_name, limit)
    return {"ok": True, "sys_name": sys_name, "count": len(calls), "calls": calls}


@router.get("/nearest")
async def radio_nearest(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    limit: int = Query(5, ge=1, le=20),
) -> dict:
    """Return nearest OpenMHZ scanner systems to a point."""
    systems = await _fetch_openmhz_systems()
    scored = []
    for s in systems:
        if not s["lat"] and not s["lon"]:
            continue
        dist = _haversine_km(lat, lng, s["lat"], s["lon"])
        scored.append({**s, "distance_km": round(dist, 1)})
    scored.sort(key=lambda x: x["distance_km"])
    return {"ok": True, "count": len(scored[:limit]), "systems": scored[:limit]}
