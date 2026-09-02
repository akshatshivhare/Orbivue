import asyncio
import time
from typing import Any

from ..config import LOCATION_IMAGERY_USER_AGENT

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
LOCATION_SEARCH_CACHE_TTL_SECONDS = 60 * 60
LOCATION_SEARCH_MAX_RESULTS = 5

_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_rate_limit_lock = asyncio.Lock()
_last_request_at = 0.0


class LocationSearchError(Exception):
    pass


async def search_locations(query: str) -> list[dict[str, Any]]:
    normalized_query = query.strip()
    if not normalized_query:
        raise ValueError("Location search query is required.")

    cache_key = normalized_query.casefold()
    cached = _cache.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[0] < LOCATION_SEARCH_CACHE_TTL_SECONDS:
        return cached[1]

    await _respect_nominatim_rate_limit()

    started_at = time.perf_counter()
    try:
        import httpx

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            headers={"User-Agent": LOCATION_IMAGERY_USER_AGENT},
        ) as client:
            response = await client.get(
                NOMINATIM_SEARCH_URL,
                params={
                    "q": normalized_query,
                    "format": "jsonv2",
                    "limit": LOCATION_SEARCH_MAX_RESULTS,
                    "addressdetails": 0,
                },
            )
    except httpx.TimeoutException as exc:
        raise LocationSearchError("Location provider timed out.") from exc
    except httpx.HTTPError as exc:
        raise LocationSearchError("Location provider could not be reached.") from exc

    print("[SatQuery Location] provider: OpenStreetMap Nominatim")
    print("[SatQuery Location] status:", response.status_code)
    print("[SatQuery Location] latency:", f"{time.perf_counter() - started_at:.3f}s")

    if response.status_code >= 400:
        raise LocationSearchError("Location provider returned an error.")

    try:
        payload = response.json()
    except ValueError as exc:
        raise LocationSearchError("Location provider returned invalid JSON.") from exc

    if not isinstance(payload, list):
        raise LocationSearchError("Location provider returned an unexpected response.")

    results = [_normalize_location_result(item) for item in payload[:LOCATION_SEARCH_MAX_RESULTS]]
    normalized_results = [item for item in results if item is not None]
    _cache[cache_key] = (time.monotonic(), normalized_results)
    return normalized_results


async def _respect_nominatim_rate_limit() -> None:
    global _last_request_at

    async with _rate_limit_lock:
        elapsed = time.monotonic() - _last_request_at
        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)
        _last_request_at = time.monotonic()


def _normalize_location_result(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None

    try:
        lat = float(item.get("lat"))
        lon = float(item.get("lon"))
    except (TypeError, ValueError):
        return None

    display_name = str(item.get("display_name") or "").strip()
    if not display_name:
        return None

    return {
        "display_name": display_name,
        "lat": lat,
        "lon": lon,
        "type": str(item.get("type") or item.get("class") or "place"),
    }
