"""
OSINT Recon Toolkit — server-side intelligence lookups.
All queries validated and SSRF-guarded. For authorized assets only.
"""

import ipaddress
import re
import socket
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/osint/recon", tags=["recon"])

# ── SSRF Guard ──────────────────────────────────────────────
PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def is_private_ip(ip_str: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip_str)
        return any(addr in net for net in PRIVATE_RANGES)
    except ValueError:
        return False


def validate_domain(domain: str) -> str:
    domain = domain.strip().lower()
    if not re.match(r"^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$", domain):
        raise HTTPException(status_code=400, detail="Invalid domain")
    return domain


def validate_ip(ip: str) -> str:
    ip = ip.strip()
    try:
        ipaddress.ip_address(ip)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IP address")
    if is_private_ip(ip):
        raise HTTPException(status_code=403, detail="Private/internal IPs not allowed")
    return ip


# ── Models ──────────────────────────────────────────────────
class IPQuery(BaseModel):
    ip: str

    @field_validator("ip")
    @classmethod
    def check_ip(cls, v: str) -> str:
        return validate_ip(v)


class DomainQuery(BaseModel):
    domain: str

    @field_validator("domain")
    @classmethod
    def check_domain(cls, v: str) -> str:
        return validate_domain(v)


class CVEQuery(BaseModel):
    keyword: str

    @field_validator("keyword")
    @classmethod
    def check_keyword(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Keyword must be 2-100 chars")
        return v


# ── IP Geolocation ──────────────────────────────────────────
@router.post("/ip-geo")
async def ip_geo(query: IPQuery) -> dict[str, Any]:
    """IP geolocation via ip-api.com (free, no key)."""
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"http://ip-api.com/json/{query.ip}?fields=66846719")
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="IP geo lookup failed")
        return {"source": "ip-api.com", "data": res.json()}


# ── DNS Lookup ──────────────────────────────────────────────
@router.post("/dns")
async def dns_lookup(query: DomainQuery) -> dict[str, Any]:
    """DNS resolution via Google DoH."""
    results: dict[str, Any] = {"domain": query.domain, "records": {}}
    async with httpx.AsyncClient(timeout=10) as client:
        for rtype in ["A", "AAAA", "MX", "NS", "TXT", "CNAME"]:
            try:
                res = await client.get(
                    "https://dns.google/resolve",
                    params={"name": query.domain, "type": rtype},
                )
                if res.status_code == 200:
                    data = res.json()
                    if "Answer" in data:
                        results["records"][rtype] = [
                            a.get("data") for a in data["Answer"]
                        ]
            except httpx.HTTPError:
                continue
    return {"source": "dns.google", "data": results}


# ── RDAP/WHOIS ──────────────────────────────────────────────
@router.post("/rdap")
async def rdap_lookup(query: DomainQuery) -> dict[str, Any]:
    """RDAP domain registration info."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        res = await client.get(f"https://rdap.org/domain/{query.domain}")
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="RDAP lookup failed")
        data = res.json()
        # Extract key fields
        return {
            "source": "rdap.org",
            "data": {
                "name": data.get("ldhName"),
                "status": data.get("status"),
                "events": data.get("events", [])[:5],
                "nameservers": [
                    ns.get("ldhName") for ns in data.get("nameservers", [])
                ],
                "registrar": next(
                    (
                        e.get("vcardArray", [[]])[1][1][3]
                        if len(e.get("vcardArray", [[]])) > 1
                        and len(e["vcardArray"][1]) > 1
                        else None
                    )
                    for e in data.get("entities", [])
                    if "registrar" in e.get("roles", [])
                ),
            },
        }


# ── Certificate Transparency ───────────────────────────────
@router.post("/certs")
async def cert_transparency(query: DomainQuery) -> dict[str, Any]:
    """Certificate transparency log search via crt.sh."""
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            f"https://crt.sh/?q=%.{query.domain}&output=json",
        )
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="crt.sh lookup failed")
        certs = res.json()
        # Return most recent 20
        return {
            "source": "crt.sh",
            "data": [
                {
                    "id": c.get("id"),
                    "issuer": c.get("issuer_name"),
                    "common_name": c.get("common_name"),
                    "not_before": c.get("not_before"),
                    "not_after": c.get("not_after"),
                }
                for c in certs[:20]
            ],
        }


# ── BGP/ASN ─────────────────────────────────────────────────
@router.post("/bgp")
async def bgp_lookup(query: IPQuery) -> dict[str, Any]:
    """BGP/ASN info via bgpview.io."""
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"https://api.bgpview.io/ip/{query.ip}")
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="BGP lookup failed")
        return {"source": "bgpview.io", "data": res.json().get("data", {})}


# ── CVE Search ──────────────────────────────────────────────
@router.post("/cve")
async def cve_search(query: CVEQuery) -> dict[str, Any]:
    """CVE search via NIST NVD API (no key for basic search)."""
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            "https://services.nvd.nist.gov/rest/json/cves/2.0",
            params={"keywordSearch": query.keyword, "resultsPerPage": 10},
        )
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="NVD lookup failed")
        data = res.json()
        vulns = data.get("vulnerabilities", [])
        return {
            "source": "nvd.nist.gov",
            "total": data.get("totalResults", 0),
            "data": [
                {
                    "id": v["cve"]["id"],
                    "description": (
                        v["cve"]["descriptions"][0]["value"][:200]
                        if v["cve"].get("descriptions")
                        else ""
                    ),
                    "published": v["cve"].get("published"),
                    "severity": (
                        v["cve"]
                        .get("metrics", {})
                        .get("cvssMetricV31", [{}])[0]
                        .get("cvssData", {})
                        .get("baseSeverity")
                        if v["cve"].get("metrics", {}).get("cvssMetricV31")
                        else None
                    ),
                }
                for v in vulns[:10]
            ],
        }


# ── Reverse DNS ─────────────────────────────────────────────
@router.post("/reverse-dns")
async def reverse_dns(query: IPQuery) -> dict[str, Any]:
    """Reverse DNS lookup."""
    try:
        hostnames = socket.gethostbyaddr(query.ip)
        return {
            "source": "local-resolver",
            "data": {"ip": query.ip, "hostname": hostnames[0], "aliases": hostnames[1]},
        }
    except socket.herror:
        return {"source": "local-resolver", "data": {"ip": query.ip, "hostname": None}}
