"""CCTV media proxy — public traffic cameras (opt-in).

Only traffic/transport department cameras that are explicitly public are
proxied. The allowlist below covers:
  - TfL Jam Cams (London, UK)
  - NYC DOT webcams
  - Singapore LTA cameras (data.gov.sg)
  - Austin Mobility (Texas, US)
  - California DOT (CWWP2)
  - Colorado DOT (COtrip)
  - Oregon DOT (TripCheck)

Every redirect is re-validated against the allowlist before following.
SSRF-hardened: no private IPs, no non-HTTP schemes, max 3 redirect hops.

Endpoints:
  GET /osint/cctv/cameras   — curated list of public cameras
  GET /osint/cctv/media     — proxy a camera snapshot/stream by URL
"""

from __future__ import annotations

import logging
import re
from urllib.parse import urljoin, urlparse, quote

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, StreamingResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/osint/cctv", tags=["cctv"])

# ── Allowlist ─────────────────────────────────────────────────────────────────
_ALLOWED_HOSTS: frozenset[str] = frozenset({
    # TfL London jam cams
    "s3-eu-west-1.amazonaws.com",
    "jamcams.tfl.gov.uk",
    # NYC DOT
    "webcams.nyctmc.org",
    # Singapore LTA
    "images.data.gov.sg",
    # Austin TX mobility
    "cctv.austinmobility.io",
    # California DOT (Caltrans)
    "cwwp2.dot.ca.gov",
    "wzmedia.dot.ca.gov",
    # Colorado DOT (COtrip)
    "publicstreamer1.cotrip.org",
    "publicstreamer2.cotrip.org",
    "publicstreamer3.cotrip.org",
    "publicstreamer4.cotrip.org",
    "cocam.carsprogram.org",
    # Oregon DOT
    "tripcheck.com",
    "www.tripcheck.com",
})

# Block RFC1918 / loopback by pattern — belt-and-suspenders
_PRIVATE_IP_RE = re.compile(
    r"^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|localhost$|0\.0\.0\.0$)",
    re.IGNORECASE,
)

_MAX_REDIRECTS = 3
_CONNECT_TIMEOUT = 3.0
_READ_TIMEOUT = 12.0


def _host_allowed(hostname: str | None) -> bool:
    if not hostname:
        return False
    h = hostname.strip().lower()
    # Reject private ranges
    if _PRIVATE_IP_RE.match(h):
        return False
    for allowed in _ALLOWED_HOSTS:
        if h == allowed or h.endswith(f".{allowed}"):
            return True
    return False


def _infer_media_type(url: str, content_type: str) -> str:
    ct = (content_type or "").split(";", 1)[0].strip().lower()
    if ct and ct not in {"application/octet-stream", "binary/octet-stream"}:
        return content_type
    path = urlparse(url).path.lower()
    if path.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if path.endswith(".png"):
        return "image/png"
    if path.endswith(".webp"):
        return "image/webp"
    if path.endswith((".m3u8", ".m3u")):
        return "application/vnd.apple.mpegurl"
    if path.endswith(".mp4"):
        return "video/mp4"
    return content_type or "application/octet-stream"


def _rewrite_m3u8(base_url: str, body: str) -> str:
    """Rewrite HLS playlist segment/key URLs to go through our proxy."""
    lines = []
    for raw in body.splitlines():
        stripped = raw.strip()
        if not stripped:
            lines.append(raw)
            continue
        if stripped.startswith("#"):
            import re as _re
            def _rw(m: re.Match) -> str:
                orig = m.group(1)
                abs_url = urljoin(base_url, orig)
                parsed = urlparse(abs_url)
                if parsed.scheme not in ("http", "https"):
                    return m.group(0)
                if not _host_allowed(parsed.hostname):
                    return m.group(0)
                return f'URI="{_proxied(abs_url)}"'
            lines.append(_re.sub(r'URI="([^"]+)"', _rw, raw))
        else:
            abs_url = urljoin(base_url, stripped)
            parsed = urlparse(abs_url)
            if parsed.scheme in ("http", "https") and _host_allowed(parsed.hostname):
                lines.append(_proxied(abs_url))
            else:
                lines.append(raw)
    return "\n".join(lines) + ("\n" if body.endswith("\n") else "")


def _proxied(url: str) -> str:
    return f"/osint/cctv/media?url={quote(url, safe='')}"


async def _proxy_response(url: str) -> Response | StreamingResponse:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid scheme")
    if not _host_allowed(parsed.hostname):
        raise HTTPException(status_code=403, detail="Host not in allowlist")

    current_url = url
    hops = 0
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(_CONNECT_TIMEOUT, read=_READ_TIMEOUT),
        follow_redirects=False,
        headers={"User-Agent": "Mozilla/5.0 (compatible; GOD-EYE/0.2 traffic-cam-proxy)"},
    ) as client:
        while True:
            resp = await client.get(current_url)
            if resp.is_redirect:
                if hops >= _MAX_REDIRECTS:
                    raise HTTPException(status_code=502, detail="Redirect chain too long")
                location = resp.headers.get("location", "")
                next_url = urljoin(current_url, location)
                next_parsed = urlparse(next_url)
                if next_parsed.scheme not in ("http", "https"):
                    raise HTTPException(status_code=502, detail="Redirect to non-HTTP")
                if not _host_allowed(next_parsed.hostname):
                    raise HTTPException(status_code=502, detail="Redirect to disallowed host")
                current_url = next_url
                hops += 1
                continue
            break

        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail="Upstream error")

        content_type = _infer_media_type(current_url, resp.headers.get("content-type", ""))
        is_hls = ".m3u8" in current_url.lower() or "mpegurl" in content_type.lower()

        cache_secs = 10 if is_hls else 30
        headers = {
            "Cache-Control": f"public, max-age={cache_secs}",
            "Access-Control-Allow-Origin": "*",
        }

        if is_hls:
            body = resp.text
            if "#EXTM3U" in body:
                body = _rewrite_m3u8(current_url, body)
            return Response(content=body, media_type=content_type, headers=headers)

        return Response(content=resp.content, media_type=content_type, headers=headers)


# ── Curated camera list ───────────────────────────────────────────────────────
# Only public, terms-compliant, transport-authority cameras.
_CAMERAS = [
    {
        "id": "tfl-jc-00001",
        "name": "London – Tower Bridge",
        "city": "London", "country": "GB",
        "lat": 51.5055, "lon": -0.0754,
        "url": "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.00838.jpg",
        "type": "image/jpeg",
        "source": "TfL Jam Cams (CC BY)",
    },
    {
        "id": "tfl-jc-00002",
        "name": "London – Waterloo Bridge",
        "city": "London", "country": "GB",
        "lat": 51.5037, "lon": -0.1156,
        "url": "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.00767.jpg",
        "type": "image/jpeg",
        "source": "TfL Jam Cams (CC BY)",
    },
    {
        "id": "nyc-dot-001",
        "name": "NYC – Brooklyn Bridge",
        "city": "New York", "country": "US",
        "lat": 40.7061, "lon": -73.9969,
        "url": "https://webcams.nyctmc.org/api/cameras/5b24a7e4-c6ca-4df2-8e8b-3f9ecf0bd869/image",
        "type": "image/jpeg",
        "source": "NYC DOT (public domain)",
    },
    {
        "id": "sg-lta-001",
        "name": "Singapore – Orchard Road",
        "city": "Singapore", "country": "SG",
        "lat": 1.3044, "lon": 103.8320,
        "url": "https://images.data.gov.sg/api/traffic-images/2703",
        "type": "image/jpeg",
        "source": "Singapore LTA (OGL)",
    },
    {
        "id": "sg-lta-002",
        "name": "Singapore – Changi Airport",
        "city": "Singapore", "country": "SG",
        "lat": 1.3644, "lon": 103.9915,
        "url": "https://images.data.gov.sg/api/traffic-images/9701",
        "type": "image/jpeg",
        "source": "Singapore LTA (OGL)",
    },
    {
        "id": "austin-001",
        "name": "Austin TX – I-35 @ Downtown",
        "city": "Austin", "country": "US",
        "lat": 30.2672, "lon": -97.7431,
        "url": "https://cctv.austinmobility.io/image/2a7a7dc8-6b9b-4db6-9bd8-ea6bc27bd9f0.jpg",
        "type": "image/jpeg",
        "source": "Austin Mobility (public)",
    },
]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/cameras")
async def cctv_cameras() -> dict:
    """Return curated list of public CCTV camera sources."""
    return {
        "ok": True,
        "count": len(_CAMERAS),
        "cameras": _CAMERAS,
        "disclaimer": (
            "Only public traffic-authority cameras are listed. "
            "Images are proxied from allowlisted government/transport sources. "
            "All sources are opt-in and respect provider terms."
        ),
    }


@router.get("/media")
async def cctv_media(url: str = Query(..., min_length=10)) -> Response | StreamingResponse:
    """Proxy a CCTV media URL (allowlisted hosts only)."""
    return await _proxy_response(url)
