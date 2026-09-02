import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from ..config import (
    LOCATION_IMAGERY_PREVIEW_SIZE,
    LOCATION_IMAGERY_USER_AGENT,
    SENTINEL2_FAIR_CLOUD_MAX,
    SENTINEL2_GOOD_CLOUD_MAX,
    SENTINEL2_LATEST_LOOKBACK_DAYS,
)
from .copernicus_auth import CopernicusAuthError, get_copernicus_access_token
from .nasa_cmr import build_aoi_bbox, validate_date_range, validate_lat_lon

SENTINEL2_PROVIDER = "sentinel-2"
SENTINEL2_PLATFORM = "Sentinel-2"
SENTINEL2_PRODUCT = "L2A"
SENTINEL2_COLLECTION = "sentinel-2-l2a"
SENTINEL2_RESOLUTION_NOTE = "10 m RGB bands"
SENTINEL2_CATALOG_URL = "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search"
SENTINEL2_PROCESS_URL = "https://sh.dataspace.copernicus.eu/process/v1"
SENTINEL2_EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: ["B04", "B03", "B02"],
    output: { bands: 3 }
  };
}

function evaluatePixel(sample) {
  return [
    2.5 * sample.B04,
    2.5 * sample.B03,
    2.5 * sample.B02
  ];
}
""".strip()

_search_cache: dict[str, tuple[float, list["Sentinel2Scene"]]] = {}
_SEARCH_CACHE_TTL_SECONDS = 20 * 60


class Sentinel2Error(Exception):
    pass


class Sentinel2UnavailableError(Sentinel2Error):
    pass


class Sentinel2NoScenesError(Sentinel2Error):
    pass


@dataclass(frozen=True)
class Sentinel2Scene:
    item_id: str
    acquisition_datetime: str
    date: str
    cloud_cover: float | None
    bbox: list[float] | None = None


def cloud_quality(cloud_cover: float | None) -> str:
    if cloud_cover is None:
        return "unknown"
    if cloud_cover <= SENTINEL2_GOOD_CLOUD_MAX:
        return "good"
    if cloud_cover <= SENTINEL2_FAIR_CLOUD_MAX:
        return "fair"
    return "poor"


def sentinel2_metadata() -> dict[str, str]:
    return {
        "provider": SENTINEL2_PROVIDER,
        "primary_provider": SENTINEL2_PROVIDER,
        "platform": SENTINEL2_PLATFORM,
        "product": SENTINEL2_PRODUCT,
        "collection": SENTINEL2_COLLECTION,
        "resolution_note": SENTINEL2_RESOLUTION_NOTE,
    }


async def get_sentinel2_available_dates(lat: float, lon: float, start: date, end: date) -> list[dict[str, object]]:
    scenes = await search_sentinel2_scenes(lat, lon, start, end)
    best_by_date = deduplicate_scenes_by_date(scenes)
    return [
        {
            "date": scene.date,
            "cloud_cover": scene.cloud_cover,
            "quality": cloud_quality(scene.cloud_cover),
        }
        for scene in sorted(best_by_date.values(), key=lambda scene: scene.date)
    ]


async def select_latest_sentinel2_scene(lat: float, lon: float) -> Sentinel2Scene:
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=SENTINEL2_LATEST_LOOKBACK_DAYS)
    scenes = await search_sentinel2_scenes(lat, lon, start, today)
    if not scenes:
        raise Sentinel2NoScenesError("No Sentinel-2 acquisitions were found for this location.")

    return select_best_latest_scene(scenes)


async def search_sentinel2_scenes(lat: float, lon: float, start: date, end: date) -> list[Sentinel2Scene]:
    normalized_lat, normalized_lon = validate_lat_lon(lat, lon)
    validate_date_range(start, end)
    bbox = build_aoi_bbox(normalized_lat, normalized_lon)
    cache_key = f"{','.join(str(value) for value in bbox)}:{start.isoformat()}:{end.isoformat()}"

    cached = _search_cache.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[0] < _SEARCH_CACHE_TTL_SECONDS:
        return cached[1]

    access_token = await _access_token_or_unavailable()
    scenes = await _query_catalog(bbox, start, end, access_token)
    _search_cache[cache_key] = (time.monotonic(), scenes)
    return scenes


async def render_sentinel2_preview(lat: float, lon: float, selected_date: date) -> tuple[bytes, str]:
    normalized_lat, normalized_lon = validate_lat_lon(lat, lon)
    validate_date_range(selected_date, selected_date)
    bbox = build_aoi_bbox(normalized_lat, normalized_lon)
    access_token = await _access_token_or_unavailable()
    started_at = time.perf_counter()

    request_payload = {
        "input": {
            "bounds": {
                "bbox": bbox,
                "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
            },
            "data": [
                {
                    "type": SENTINEL2_COLLECTION,
                    "dataFilter": {
                        "timeRange": {
                            "from": f"{selected_date.isoformat()}T00:00:00Z",
                            "to": f"{selected_date.isoformat()}T23:59:59Z",
                        },
                        "mosaickingOrder": "leastCC",
                    },
                }
            ],
        },
        "output": {
            "width": LOCATION_IMAGERY_PREVIEW_SIZE,
            "height": LOCATION_IMAGERY_PREVIEW_SIZE,
            "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
        },
        "evalscript": SENTINEL2_EVALSCRIPT,
    }

    try:
        import httpx

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=10.0, read=50.0),
            headers={
                "User-Agent": LOCATION_IMAGERY_USER_AGENT,
                "Authorization": f"Bearer {access_token}",
            },
        ) as client:
            response = await client.post(SENTINEL2_PROCESS_URL, json=request_payload)
    except httpx.TimeoutException as exc:
        raise Sentinel2UnavailableError("Sentinel-2 preview request timed out.") from exc
    except httpx.HTTPError as exc:
        raise Sentinel2UnavailableError("Sentinel-2 preview provider could not be reached.") from exc

    content_type = response.headers.get("content-type", "image/png").split(";")[0].strip()
    print("[SatQuery Sentinel-2 Process] date:", selected_date.isoformat())
    print("[SatQuery Sentinel-2 Process] bbox:", bbox)
    print("[SatQuery Sentinel-2 Process] status:", response.status_code)
    print("[SatQuery Sentinel-2 Process] content-type:", content_type)
    print("[SatQuery Sentinel-2 Process] bytes:", len(response.content))
    print("[SatQuery Sentinel-2 Process] latency:", f"{time.perf_counter() - started_at:.3f}s")

    if response.status_code in {401, 403}:
        raise Sentinel2UnavailableError("Sentinel-2 credentials were rejected.")
    if response.status_code == 429:
        raise Sentinel2UnavailableError("Sentinel-2 preview provider is rate limited.")
    if response.status_code >= 400:
        raise Sentinel2UnavailableError("Sentinel-2 preview provider returned an error.")
    if not content_type.startswith("image/"):
        raise Sentinel2UnavailableError("Sentinel-2 preview provider did not return an image.")

    return response.content, content_type


def deduplicate_scenes_by_date(scenes: list[Sentinel2Scene]) -> dict[str, Sentinel2Scene]:
    best_by_date: dict[str, Sentinel2Scene] = {}
    for scene in scenes:
        current = best_by_date.get(scene.date)
        if current is None or _cloud_sort_value(scene.cloud_cover) < _cloud_sort_value(current.cloud_cover):
            best_by_date[scene.date] = scene
    return best_by_date


def select_best_latest_scene(scenes: list[Sentinel2Scene]) -> Sentinel2Scene:
    if not scenes:
        raise Sentinel2NoScenesError("No Sentinel-2 acquisitions were found.")

    by_date = list(deduplicate_scenes_by_date(scenes).values())
    for max_cloud in (SENTINEL2_GOOD_CLOUD_MAX, SENTINEL2_FAIR_CLOUD_MAX):
        candidates = [scene for scene in by_date if scene.cloud_cover is not None and scene.cloud_cover <= max_cloud]
        if candidates:
            return max(candidates, key=lambda scene: scene.date)

    return max(by_date, key=lambda scene: scene.date)


async def _access_token_or_unavailable() -> str:
    try:
        return await get_copernicus_access_token()
    except CopernicusAuthError as exc:
        raise Sentinel2UnavailableError(str(exc)) from exc


async def _query_catalog(bbox: list[float], start: date, end: date, access_token: str) -> list[Sentinel2Scene]:
    started_at = time.perf_counter()
    payload = {
        "collections": [SENTINEL2_COLLECTION],
        "bbox": bbox,
        "datetime": f"{start.isoformat()}T00:00:00Z/{end.isoformat()}T23:59:59Z",
        "limit": 100,
    }

    try:
        import httpx

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            headers={
                "User-Agent": LOCATION_IMAGERY_USER_AGENT,
                "Authorization": f"Bearer {access_token}",
            },
        ) as client:
            response = await client.post(SENTINEL2_CATALOG_URL, json=payload)
    except httpx.TimeoutException as exc:
        raise Sentinel2UnavailableError("Sentinel-2 catalog request timed out.") from exc
    except httpx.HTTPError as exc:
        raise Sentinel2UnavailableError("Sentinel-2 catalog provider could not be reached.") from exc

    print("[SatQuery Sentinel-2 Catalog] collection:", SENTINEL2_COLLECTION)
    print("[SatQuery Sentinel-2 Catalog] bbox:", bbox)
    print("[SatQuery Sentinel-2 Catalog] datetime:", payload["datetime"])
    print("[SatQuery Sentinel-2 Catalog] status:", response.status_code)
    print("[SatQuery Sentinel-2 Catalog] latency:", f"{time.perf_counter() - started_at:.3f}s")

    if response.status_code in {401, 403}:
        raise Sentinel2UnavailableError("Sentinel-2 catalog credentials were rejected.")
    if response.status_code == 429:
        raise Sentinel2UnavailableError("Sentinel-2 catalog provider is rate limited.")
    if response.status_code >= 400:
        raise Sentinel2UnavailableError("Sentinel-2 catalog provider returned an error.")

    try:
        data: Any = response.json()
    except ValueError as exc:
        raise Sentinel2UnavailableError("Sentinel-2 catalog returned invalid JSON.") from exc

    if not isinstance(data, dict):
        raise Sentinel2UnavailableError("Sentinel-2 catalog returned an unexpected response.")

    features = data.get("features", [])
    if not isinstance(features, list):
        raise Sentinel2UnavailableError("Sentinel-2 catalog returned malformed features.")

    return [scene for feature in features if (scene := _scene_from_feature(feature))]


def _scene_from_feature(feature: Any) -> Sentinel2Scene | None:
    if not isinstance(feature, dict):
        return None

    properties = feature.get("properties")
    if not isinstance(properties, dict):
        properties = {}

    acquisition_datetime = properties.get("datetime") or feature.get("datetime")
    if not isinstance(acquisition_datetime, str) or len(acquisition_datetime) < 10:
        return None

    try:
        acquisition_date = datetime.fromisoformat(acquisition_datetime.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        acquisition_date = acquisition_datetime[:10]

    raw_cloud_cover = properties.get("eo:cloud_cover")
    if raw_cloud_cover is None:
        raw_cloud_cover = properties.get("cloudCover")
    cloud_cover = _number_or_none(raw_cloud_cover)
    raw_bbox = feature.get("bbox")
    bbox = [float(value) for value in raw_bbox] if isinstance(raw_bbox, list) and len(raw_bbox) == 4 else None

    return Sentinel2Scene(
        item_id=str(feature.get("id") or ""),
        acquisition_datetime=acquisition_datetime,
        date=acquisition_date,
        cloud_cover=cloud_cover,
        bbox=bbox,
    )


def _number_or_none(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _cloud_sort_value(cloud_cover: float | None) -> float:
    return cloud_cover if cloud_cover is not None else 101.0
