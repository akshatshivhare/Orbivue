import asyncio
import math
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

from ..config import (
    LOCATION_IMAGERY_AOI_KM,
    LOCATION_IMAGERY_LATEST_LOOKBACK_DAYS,
    LOCATION_IMAGERY_MAX_RANGE_DAYS,
    LOCATION_IMAGERY_USER_AGENT,
)

NASA_CMR_GRANULES_URL = "https://cmr.earthdata.nasa.gov/search/granules.json"
NASA_SOURCE = "NASA"
NASA_PLATFORM = "Suomi-NPP"
NASA_INSTRUMENT = "VIIRS"
NASA_ARCHIVE_DATASET = "VNP02IMG"
NASA_NRT_DATASET = "VNP02IMG_NRT"
NASA_DATASET = NASA_NRT_DATASET
NASA_DATASET_VERSION = "2"
GIBS_TRUE_COLOR_LAYER = "VIIRS_SNPP_CorrectedReflectance_TrueColor"
LATEST_PREVIEW_CANDIDATE_COUNT = 7
LATEST_PREVIEW_SAMPLE_SIZE = 192

_availability_cache: dict[str, tuple[float, list[str]]] = {}
_AVAILABILITY_CACHE_TTL_SECONDS = 20 * 60


class NasaCmrError(Exception):
    pass


class NoImageryError(Exception):
    pass


def validate_lat_lon(lat: float, lon: float) -> tuple[float, float]:
    try:
        normalized_lat = float(lat)
        normalized_lon = float(lon)
    except (TypeError, ValueError) as exc:
        raise ValueError("Latitude and longitude must be numeric.") from exc

    if not math.isfinite(normalized_lat) or not -90 <= normalized_lat <= 90:
        raise ValueError("Latitude must be between -90 and 90.")
    if not math.isfinite(normalized_lon) or not -180 <= normalized_lon <= 180:
        raise ValueError("Longitude must be between -180 and 180.")

    return normalized_lat, normalized_lon


def build_aoi_bbox(lat: float, lon: float, size_km: float = LOCATION_IMAGERY_AOI_KM) -> list[float]:
    normalized_lat, normalized_lon = validate_lat_lon(lat, lon)
    if normalized_lat <= -89.0 or normalized_lat >= 89.0:
        raise ValueError("Location is too close to the poles for this prototype AOI.")
    if size_km <= 0:
        raise ValueError("AOI size must be positive.")

    half_size_km = size_km / 2
    lat_delta = half_size_km / 111.32
    lon_delta = half_size_km / (111.32 * math.cos(math.radians(normalized_lat)))

    west = max(-180.0, normalized_lon - lon_delta)
    south = max(-90.0, normalized_lat - lat_delta)
    east = min(180.0, normalized_lon + lon_delta)
    north = min(90.0, normalized_lat + lat_delta)

    return [round(west, 6), round(south, 6), round(east, 6), round(north, 6)]


def parse_iso_date(value: str, label: str) -> date:
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"{label} must use YYYY-MM-DD format.") from exc

    return parsed


def validate_date_range(start: date, end: date) -> None:
    today = datetime.now(timezone.utc).date()
    if start > end:
        raise ValueError("start must be on or before end.")
    if end > today:
        raise ValueError("end must not be in the future.")
    if (end - start).days > LOCATION_IMAGERY_MAX_RANGE_DAYS:
        raise ValueError(f"Date range must be {LOCATION_IMAGERY_MAX_RANGE_DAYS} days or less.")


async def get_available_dates(lat: float, lon: float, start: date, end: date) -> list[str]:
    normalized_lat, normalized_lon = validate_lat_lon(lat, lon)
    validate_date_range(start, end)
    bbox = build_aoi_bbox(normalized_lat, normalized_lon)
    cache_key = f"merged:{','.join(str(value) for value in bbox)}:{start.isoformat()}:{end.isoformat()}"

    cached = _availability_cache.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[0] < _AVAILABILITY_CACHE_TTL_SECONDS:
        return cached[1]

    dates = await _query_merged_archive_and_nrt_dates(bbox, start, end)
    _availability_cache[cache_key] = (time.monotonic(), dates)
    return dates


async def get_nrt_available_dates(lat: float, lon: float, start: date, end: date) -> list[str]:
    normalized_lat, normalized_lon = validate_lat_lon(lat, lon)
    validate_date_range(start, end)
    bbox = build_aoi_bbox(normalized_lat, normalized_lon)
    cache_key = f"nrt:{','.join(str(value) for value in bbox)}:{start.isoformat()}:{end.isoformat()}"

    cached = _availability_cache.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[0] < _AVAILABILITY_CACHE_TTL_SECONDS:
        return cached[1]

    dates = await _query_cmr_available_dates(bbox, start, end, dataset=NASA_NRT_DATASET)
    _availability_cache[cache_key] = (time.monotonic(), dates)
    return dates


async def get_latest_available_date(lat: float, lon: float, lookback_days: int = LOCATION_IMAGERY_LATEST_LOOKBACK_DAYS) -> str:
    today = datetime.now(timezone.utc).date()
    start = today.fromordinal(today.toordinal() - max(1, lookback_days))
    dates = await get_nrt_available_dates(lat, lon, start, today)
    if not dates:
        raise NoImageryError("No recent VIIRS imagery was found for this location.")

    return dates[-1]


async def select_latest_preview_date(
    lat: float,
    lon: float,
    lookback_days: int = LOCATION_IMAGERY_LATEST_LOOKBACK_DAYS,
) -> dict[str, str | None]:
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=max(1, lookback_days))
    nrt_dates = await get_nrt_available_dates(lat, lon, start, today)
    if not nrt_dates:
        raise NoImageryError("No recent VIIRS imagery was found for this location.")

    latest_observation_date = nrt_dates[-1]
    candidate_dates = list(reversed(nrt_dates[-LATEST_PREVIEW_CANDIDATE_COUNT:]))
    first_fetchable_date: str | None = None

    from .nasa_gibs import fetch_gibs_preview, preview_appears_blank

    print("[SatQuery NASA Latest] NRT candidates:", candidate_dates)
    for candidate_date_text in candidate_dates:
        try:
            preview_bytes, _content_type = await fetch_gibs_preview(
                lat,
                lon,
                parse_iso_date(candidate_date_text, "candidate date"),
                preview_size=LATEST_PREVIEW_SAMPLE_SIZE,
            )
        except Exception as exc:
            print("[SatQuery NASA Latest] preview probe failed:", candidate_date_text, type(exc).__name__)
            continue

        if first_fetchable_date is None:
            first_fetchable_date = candidate_date_text

        is_blank = preview_appears_blank(preview_bytes)
        print("[SatQuery NASA Latest] preview candidate:", candidate_date_text)
        print("[SatQuery NASA Latest] preview blank:", is_blank)
        if not is_blank:
            return {
                "latest_observation_date": latest_observation_date,
                "selected_preview_date": candidate_date_text,
                "preview_quality": "good",
            }

    return {
        "latest_observation_date": latest_observation_date,
        "selected_preview_date": first_fetchable_date or latest_observation_date,
        "preview_quality": "poor",
    }


async def ensure_date_available(lat: float, lon: float, selected_date: date) -> None:
    validate_date_range(selected_date, selected_date)
    dates = await get_available_dates(lat, lon, selected_date, selected_date)
    if selected_date.isoformat() not in dates:
        raise NoImageryError("No VIIRS imagery is available for this location on the requested date.")


async def _query_merged_archive_and_nrt_dates(bbox: list[float], start: date, end: date) -> list[str]:
    archive_task = _query_cmr_available_dates(bbox, start, end, dataset=NASA_ARCHIVE_DATASET)
    nrt_task = _query_cmr_available_dates(bbox, start, end, dataset=NASA_NRT_DATASET)
    archive_dates, nrt_dates = await asyncio.gather(archive_task, nrt_task)
    return sorted(set(archive_dates).union(nrt_dates))


async def _query_cmr_available_dates(
    bbox: list[float],
    start: date,
    end: date,
    dataset: str = NASA_NRT_DATASET,
) -> list[str]:
    temporal = f"{start.isoformat()}T00:00:00Z,{end.isoformat()}T23:59:59Z"
    started_at = time.perf_counter()

    try:
        import httpx

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(20.0, connect=8.0),
            headers={"User-Agent": LOCATION_IMAGERY_USER_AGENT},
        ) as client:
            response = await client.get(
                NASA_CMR_GRANULES_URL,
                params={
                    "short_name": dataset,
                    "version": NASA_DATASET_VERSION,
                    "bounding_box": ",".join(str(value) for value in bbox),
                    "temporal": temporal,
                    "page_size": 2000,
                    "sort_key[]": "start_date",
                },
            )
    except httpx.TimeoutException as exc:
        raise NasaCmrError("NASA CMR request timed out.") from exc
    except httpx.HTTPError as exc:
        raise NasaCmrError("NASA CMR could not be reached.") from exc

    print("[SatQuery NASA CMR] collection:", dataset)
    print("[SatQuery NASA CMR] bbox:", bbox)
    print("[SatQuery NASA CMR] temporal:", temporal)
    print("[SatQuery NASA CMR] status:", response.status_code)
    print("[SatQuery NASA CMR] latency:", f"{time.perf_counter() - started_at:.3f}s")

    if response.status_code >= 400:
        raise NasaCmrError("NASA CMR returned an error.")

    try:
        payload = response.json()
    except ValueError as exc:
        raise NasaCmrError("NASA CMR returned invalid JSON.") from exc

    return extract_unique_granule_dates(payload)


def extract_unique_granule_dates(payload: Any) -> list[str]:
    entries = payload
    if isinstance(payload, dict):
        entries = payload.get("feed", {}).get("entry", [])

    if not isinstance(entries, list):
        raise NasaCmrError("NASA CMR returned an unexpected response.")

    unique_dates: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue

        timestamp = entry.get("time_start") or entry.get("updated")
        if not isinstance(timestamp, str) or len(timestamp) < 10:
            continue

        try:
            parsed_date = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).date()
        except ValueError:
            continue

        unique_dates.add(parsed_date.isoformat())

    return sorted(unique_dates)


def nasa_metadata() -> dict[str, str]:
    return {
        "source": NASA_SOURCE,
        "platform": NASA_PLATFORM,
        "instrument": NASA_INSTRUMENT,
        "dataset": NASA_NRT_DATASET,
        "archive_dataset": NASA_ARCHIVE_DATASET,
        "near_real_time_dataset": NASA_NRT_DATASET,
    }
