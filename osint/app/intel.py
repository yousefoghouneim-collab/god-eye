"""
Signals intelligence endpoints (opt-in):
  - Telegram public channel preview (no key required)
  - Shodan host lookup (requires SHODAN_API_KEY env var)

Both are server-proxied to avoid SSRF and key exposure.
"""
import os
import re
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.recon import validate_ip  # re-use SSRF guard

router = APIRouter(prefix="/osint/intel", tags=["intel"])

SHODAN_KEY = os.environ.get("SHODAN_API_KEY", "")

# ── Models ───────────────────────────────────────────────────────────────────
class TelegramQuery(BaseModel):
    channel: str

    @field_validator("channel")
    @classmethod
    def check_channel(cls, v: str) -> str:
        v = v.strip().lstrip("@")
        if not re.match(r"^[a-zA-Z0-9_]{3,64}$", v):
            raise ValueError("Invalid Telegram channel handle")
        return v


class ShodanQuery(BaseModel):
    ip: str

    @field_validator("ip")
    @classmethod
    def check_ip(cls, v: str) -> str:
        return validate_ip(v)


# ── Telegram public channel preview ─────────────────────────────────────────
def _parse_tg_messages(html: str) -> list[dict[str, str]]:
    """Extract messages from t.me/s/{channel} HTML (no external parser needed)."""
    messages: list[dict[str, str]] = []

    # Each message block starts with tgme_widget_message_wrap
    blocks = re.split(r'class="tgme_widget_message_wrap', html)[1:]

    for block in blocks[:20]:
        # Message ID
        mid_m = re.search(r'data-post="[^/]+/(\d+)"', block)
        mid = mid_m.group(1) if mid_m else ""

        # Date
        date_m = re.search(r'datetime="([^"]+)"', block)
        date = date_m.group(1) if date_m else ""

        # Text: strip all HTML tags from the message text div
        text_m = re.search(
            r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>',
            block, re.DOTALL
        )
        raw_text = text_m.group(1) if text_m else ""
        # Strip tags, collapse whitespace
        text = re.sub(r"<[^>]+>", " ", raw_text)
        text = re.sub(r"\s+", " ", text).strip()
        # Decode common HTML entities
        text = (text
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", '"')
                .replace("&#39;", "'")
                .replace("&nbsp;", " "))

        if text or mid:
            messages.append({"id": mid, "date": date, "text": text[:500]})

    return messages


@router.post("/telegram")
async def telegram_preview(query: TelegramQuery) -> dict[str, Any]:
    """
    Preview the latest posts from a public Telegram channel.
    Only works for public channels. No API key required.
    """
    url = f"https://t.me/s/{query.channel}"
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        try:
            res = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; GOD-EYE/0.5)",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Telegram fetch error: {e}") from e

        if res.status_code == 404:
            raise HTTPException(status_code=404, detail="Channel not found or private")
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Telegram returned {res.status_code}")

    # Extract channel title
    title_m = re.search(r'<div class="tgme_channel_info_header_title[^"]*"[^>]*>(.*?)</div>', res.text)
    title = re.sub(r"<[^>]+>", "", title_m.group(1)).strip() if title_m else query.channel

    # Extract subscriber count
    sub_m = re.search(r'(\d[\d\s]*)\s*(?:subscribers?|members?)', res.text, re.IGNORECASE)
    subscribers = sub_m.group(0).strip() if sub_m else None

    messages = _parse_tg_messages(res.text)

    return {
        "source": "t.me",
        "channel": query.channel,
        "title": title,
        "subscribers": subscribers,
        "message_count": len(messages),
        "data": messages,
    }


# ── Shodan host lookup ───────────────────────────────────────────────────────
@router.post("/shodan")
async def shodan_host(query: ShodanQuery) -> dict[str, Any]:
    """
    Shodan host lookup. Requires SHODAN_API_KEY environment variable.
    Returns open ports, services, vulnerabilities, and geolocation.
    """
    if not SHODAN_KEY:
        raise HTTPException(
            status_code=503,
            detail="Shodan not configured. Set SHODAN_API_KEY environment variable.",
        )

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            res = await client.get(
                f"https://api.shodan.io/shodan/host/{query.ip}",
                params={"key": SHODAN_KEY, "minify": "true"},
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Shodan API error: {e}") from e

        if res.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid Shodan API key")
        if res.status_code == 404:
            raise HTTPException(status_code=404, detail="No Shodan data for this IP")
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Shodan returned {res.status_code}")

        data = res.json()

    # Extract key fields only
    ports = sorted(set(data.get("ports", [])))
    vulns = list(data.get("vulns", {}).keys())
    tags = data.get("tags", [])

    # Summarize banners (first 5 services)
    services: list[dict[str, Any]] = []
    for item in data.get("data", [])[:5]:
        services.append({
            "port": item.get("port"),
            "transport": item.get("transport"),
            "product": item.get("product"),
            "version": item.get("version"),
            "banner": (item.get("data") or "")[:200],
        })

    return {
        "source": "shodan.io",
        "ip": query.ip,
        "data": {
            "country": data.get("country_name"),
            "city": data.get("city"),
            "org": data.get("org"),
            "isp": data.get("isp"),
            "asn": data.get("asn"),
            "hostnames": data.get("hostnames", [])[:5],
            "domains": data.get("domains", [])[:5],
            "ports": ports,
            "tags": tags,
            "vulns": vulns[:20],
            "services": services,
            "last_update": data.get("last_update"),
        },
    }
