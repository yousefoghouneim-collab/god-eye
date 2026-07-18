"""
Entity graph — Wikidata knowledge base + OFAC sanctions screening.
All lookups are server-side; results are cached in-memory.
"""
import time
import re
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/osint/entity", tags=["entity"])

# ── In-memory OFAC cache (TTL 24h) ──────────────────────────────────────────
_ofac_cache: dict[str, Any] = {"data": None, "fetched_at": 0.0}
OFAC_TTL = 86_400  # 24 hours

OFAC_CSV_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv"


async def _load_ofac_list() -> list[dict[str, str]]:
    """Fetch and parse the OFAC SDN CSV (cached 24h)."""
    now = time.time()
    if _ofac_cache["data"] and now - _ofac_cache["fetched_at"] < OFAC_TTL:
        return _ofac_cache["data"]  # type: ignore[return-value]

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(OFAC_CSV_URL)
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="OFAC list unavailable")

    entries: list[dict[str, str]] = []
    for line in res.text.splitlines():
        # CSV columns: ent_num, sdn_name, sdn_type, program, title, call_sign, vess_type,
        #   tonnage, grt, vess_flag, vess_owner, remarks
        parts = line.split(",")
        if len(parts) >= 2:
            entries.append({
                "ent_num": parts[0].strip().strip('"'),
                "name": parts[1].strip().strip('"'),
                "type": parts[2].strip().strip('"') if len(parts) > 2 else "",
                "program": parts[3].strip().strip('"') if len(parts) > 3 else "",
            })

    _ofac_cache["data"] = entries
    _ofac_cache["fetched_at"] = now
    return entries


# ── Models ───────────────────────────────────────────────────────────────────
class EntitySearch(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def check_query(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 200:
            raise ValueError("Query must be 2-200 chars")
        return v


class EntityDetail(BaseModel):
    entity_id: str

    @field_validator("entity_id")
    @classmethod
    def check_id(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r"^[QP]\d+$", v):
            raise ValueError("Entity ID must be Q or P followed by digits (e.g. Q937)")
        return v


# ── Wikidata entity search ───────────────────────────────────────────────────
@router.post("/wikidata/search")
async def wikidata_search(query: EntitySearch) -> dict[str, Any]:
    """Search Wikidata entities by name."""
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            "https://www.wikidata.org/w/api.php",
            params={
                "action": "wbsearchentities",
                "search": query.query,
                "language": "en",
                "format": "json",
                "limit": 10,
                "type": "item",
            },
            headers={"User-Agent": "GOD-EYE/0.5 (private research)"},
        )
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="Wikidata search failed")
        data = res.json()
        results = [
            {
                "id": e.get("id"),
                "label": e.get("label"),
                "description": e.get("description"),
                "aliases": e.get("aliases", []),
                "url": e.get("url"),
            }
            for e in data.get("search", [])
        ]
        return {"source": "wikidata.org", "query": query.query, "data": results}


# ── Wikidata entity detail ────────────────────────────────────────────────────
@router.post("/wikidata/detail")
async def wikidata_detail(query: EntityDetail) -> dict[str, Any]:
    """Fetch simplified claims for a Wikidata entity."""
    eid = query.entity_id
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            f"https://www.wikidata.org/wiki/Special:EntityData/{eid}.json",
            headers={"User-Agent": "GOD-EYE/0.5 (private research)"},
        )
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="Wikidata entity fetch failed")
        raw = res.json()
        entity = raw.get("entities", {}).get(eid, {})

        # Extract labels, descriptions, aliases (English + fallback)
        def get_en(lang_map: dict) -> str | None:
            return lang_map.get("en", {}).get("value") or next(
                (v.get("value") for v in lang_map.values()), None
            )

        label = get_en(entity.get("labels", {}))
        description = get_en(entity.get("descriptions", {}))
        aliases = [a.get("value") for a in entity.get("aliases", {}).get("en", [])]

        # Key properties we care about (P-numbers → human-readable labels)
        PROP_LABELS: dict[str, str] = {
            "P31": "instance of",
            "P17": "country",
            "P27": "country of citizenship",
            "P569": "date of birth",
            "P570": "date of death",
            "P19": "place of birth",
            "P102": "political party",
            "P106": "occupation",
            "P21": "sex/gender",
            "P571": "inception",
            "P576": "dissolved",
            "P159": "headquarters",
            "P856": "website",
            "P18": "image",
        }

        claims_simplified: dict[str, list[str]] = {}
        for prop, label_prop in PROP_LABELS.items():
            prop_claims = entity.get("claims", {}).get(prop, [])
            values = []
            for claim in prop_claims[:3]:
                snak = claim.get("mainsnak", {})
                dv = snak.get("datavalue", {})
                if dv.get("type") == "string":
                    values.append(str(dv.get("value", "")))
                elif dv.get("type") == "wikibase-entityid":
                    values.append(dv.get("value", {}).get("id", ""))
                elif dv.get("type") == "time":
                    values.append(str(dv.get("value", {}).get("time", "")))
                elif dv.get("type") == "monolingualtext":
                    values.append(str(dv.get("value", {}).get("text", "")))
            if values:
                claims_simplified[label_prop] = values

        return {
            "source": "wikidata.org",
            "data": {
                "id": eid,
                "label": label,
                "description": description,
                "aliases": aliases,
                "claims": claims_simplified,
                "wikidata_url": f"https://www.wikidata.org/wiki/{eid}",
            },
        }


# ── OFAC SDN sanctions screening ─────────────────────────────────────────────
@router.post("/ofac/screen")
async def ofac_screen(query: EntitySearch) -> dict[str, Any]:
    """Screen a name against the OFAC Specially Designated Nationals list."""
    try:
        sdn_list = await _load_ofac_list()
    except HTTPException:
        return {
            "source": "OFAC SDN",
            "query": query.query,
            "status": "unavailable",
            "matches": [],
        }

    needle = query.query.lower()
    matches = [
        e for e in sdn_list
        if needle in e["name"].lower()
    ][:20]

    return {
        "source": "treasury.gov/ofac",
        "query": query.query,
        "total_screened": len(sdn_list),
        "hit_count": len(matches),
        "status": "MATCH" if matches else "CLEAR",
        "data": matches,
    }
