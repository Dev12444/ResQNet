"""Photo-based severity hint with Gemini Vision (PRD "Could" #14). Owner: BE2.

`assess_photo(photo_url)` accepts a data URL (data:image/jpeg;base64,...) or an http(s) URL
and returns a PhotoAssessment, or None if there is no usable image / AI is unavailable.
Never raises. Used by classifier.classify(..., photo_url=...) to adjust severity/hazards.
"""
from __future__ import annotations

import base64
import binascii
import ipaddress
import logging
import re
import socket
from urllib.parse import urlparse
from dataclasses import asdict, dataclass, field

import httpx

from app.services import llm

log = logging.getLogger("resqnet.vision")

MAX_BYTES = 6 * 1024 * 1024
FETCH_TIMEOUT_SEC = 5
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
_DATA_URL = re.compile(r"^data:(image/[\w.+-]+);base64,(.+)$", re.S)

HAZARDS = [
    "trapped_people", "gas_leak", "fire_spread", "rising_water", "electrical",
    "structural", "injuries", "blocked_road", "chemical", "other",
]
INCIDENT_TYPES = ["flood", "fire", "road_accident", "industrial", "medical", "building_collapse", "other"]


@dataclass
class PhotoAssessment:
    relevant: bool                 # does the photo actually show an emergency scene?
    type: str | None
    severity_hint: int | None      # 1..5
    hazards: list[str] = field(default_factory=list)
    description: str = ""
    confidence: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


SYSTEM = """You assess photos sent with emergency reports to a control room in Ahmedabad, India.
Describe only what is visible. Do not guess things you cannot see. If the photo does not show an
emergency scene (e.g. a selfie, a screenshot, a wallpaper, a blank image), set relevant=false."""

PROMPT = """Assess this photo attached to an emergency report.
Return: relevant, type, severity_hint (1 minor .. 5 mass-casualty/city-scale), hazards visible now,
a one-sentence English description of what is visible, and confidence 0-1."""

SCHEMA = {
    "type": "object",
    "properties": {
        "relevant": {"type": "boolean"},
        "type": {"type": ["string", "null"], "enum": INCIDENT_TYPES + [None]},
        "severity_hint": {"type": ["integer", "null"], "minimum": 1, "maximum": 5},
        "hazards": {"type": "array", "items": {"type": "string", "enum": HAZARDS}},
        "description": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["relevant", "type", "severity_hint", "hazards", "description", "confidence"],
}


def _is_public_url(url: str) -> bool:
    """Block SSRF: only http(s) to hosts that resolve to public IPs."""
    try:
        u = urlparse(url)
        if u.scheme not in ("http", "https") or not u.hostname:
            return False
        for info in socket.getaddrinfo(u.hostname, u.port or (443 if u.scheme == "https" else 80)):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except (ValueError, OSError):
        return False


def _load_image(photo_url: str) -> tuple[bytes, str] | None:
    photo_url = photo_url.strip()
    if m := _DATA_URL.match(photo_url):
        mime = m.group(1).lower()
        try:
            data = base64.b64decode(m.group(2), validate=False)
        except (binascii.Error, ValueError):
            return None
    elif photo_url.startswith(("http://", "https://")):
        if not _is_public_url(photo_url):
            log.info("Refusing to fetch non-public photo URL")
            return None
        try:
            # No redirects: a public URL could otherwise redirect to an internal address.
            # Streamed with a hard cap: a huge (or endless) response is abandoned at MAX_BYTES instead
            # of being read into memory first and size-checked afterwards.
            with (
                httpx.Client(timeout=FETCH_TIMEOUT_SEC, follow_redirects=False) as client,
                client.stream("GET", photo_url) as r,
            ):
                r.raise_for_status()
                mime = r.headers.get("content-type", "").split(";")[0].strip().lower()
                chunks, size = [], 0
                for chunk in r.iter_bytes():
                    size += len(chunk)
                    if size > MAX_BYTES:
                        log.info("Photo at %s is larger than %d bytes; skipped", photo_url[:80], MAX_BYTES)
                        return None
                    chunks.append(chunk)
            data = b"".join(chunks)
        except httpx.HTTPError as e:
            log.info("Could not fetch photo %s: %s", photo_url[:80], e)
            return None
    else:
        return None  # e.g. a bare filename from a demo form
    if mime == "image/jpg":
        mime = "image/jpeg"
    if mime not in ALLOWED_MIME or not data or len(data) > MAX_BYTES:
        return None
    return data, mime


def assess_photo(photo_url: str | None) -> PhotoAssessment | None:
    """Never raises. None if no usable image or AI unavailable."""
    if not photo_url:
        return None
    try:
        loaded = _load_image(photo_url)
        if loaded is None:
            return None
        data = llm.generate_json_with_image(PROMPT, loaded[0], loaded[1], SCHEMA, system=SYSTEM)
        if not isinstance(data, dict):
            return None
        sev = data.get("severity_hint")
        return PhotoAssessment(
            relevant=bool(data.get("relevant")),
            type=data.get("type") if data.get("type") in INCIDENT_TYPES else None,
            severity_hint=max(1, min(5, int(sev))) if isinstance(sev, (int, float)) else None,
            hazards=[h for h in (data.get("hazards") or []) if h in HAZARDS],
            description=str(data.get("description") or "")[:300],
            confidence=max(0.0, min(1.0, float(data.get("confidence") or 0))),
        )
    except Exception as e:
        log.exception("assess_photo failed: %s", e)
        return None
