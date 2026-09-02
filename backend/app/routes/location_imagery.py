from datetime import date

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from ..services.location_search import LocationSearchError, search_locations
from ..services.nasa_cmr import (
    GIBS_TRUE_COLOR_LAYER,
    NasaCmrError,
    NoImageryError,
    build_aoi_bbox,
    ensure_date_available,
    get_available_dates,
    nasa_metadata,
    parse_iso_date,
    select_latest_preview_date,
    validate_lat_lon,
)
from ..services.nasa_gibs import NasaGibsError, build_preview_proxy_url, fetch_gibs_preview
from ..services.sentinel2 import (
    Sentinel2NoScenesError,
    Sentinel2UnavailableError,
    cloud_quality,
    get_sentinel2_available_dates,
    render_sentinel2_preview,
    select_latest_sentinel2_scene,
    sentinel2_metadata,
)

router = APIRouter()


@router.get("/api/location/search")
async def location_search(q: str = Query(..., min_length=1, max_length=120)) -> list[dict[str, object]]:
    try:
        return await search_locations(q)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LocationSearchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/api/location-imagery/availability")
async def location_imagery_availability(
    lat: float = Query(...),
    lon: float = Query(...),
    start: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> dict[str, object]:
    try:
        start_date = parse_iso_date(start, "start")
        end_date = parse_iso_date(end, "end")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        sentinel_dates = await get_sentinel2_available_dates(lat, lon, start_date, end_date)
        if sentinel_dates:
            return {
                **sentinel2_metadata(),
                "fallback_used": False,
                "available_dates": sentinel_dates,
            }
    except (Sentinel2UnavailableError, Sentinel2NoScenesError) as exc:
        print("[SatQuery Satellite Explorer] Sentinel-2 availability fallback:", type(exc).__name__)
        sentinel_error = str(exc)
    else:
        sentinel_error = "No Sentinel-2 acquisitions were found for this range."

    try:
        dates = await get_available_dates(lat, lon, start_date, end_date)
    except NasaCmrError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        **nasa_metadata(),
        "provider": "nasa-viirs",
        "fallback_used": True,
        "fallback_reason": sentinel_error,
        "available_dates": [
            {
                "date": imagery_date,
                "cloud_cover": None,
                "quality": "unknown",
            }
            for imagery_date in dates
        ],
    }


@router.get("/api/location-imagery/latest")
async def latest_location_imagery(lat: float = Query(...), lon: float = Query(...)) -> dict[str, object]:
    try:
        normalized_lat, normalized_lon = validate_lat_lon(lat, lon)
        bbox = build_aoi_bbox(normalized_lat, normalized_lon)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        sentinel_scene = await select_latest_sentinel2_scene(normalized_lat, normalized_lon)
        return {
            **sentinel2_metadata(),
            "fallback_used": False,
            "latest_observation_date": sentinel_scene.date,
            "selected_preview_date": sentinel_scene.date,
            "cloud_cover": sentinel_scene.cloud_cover,
            "preview_quality": cloud_quality(sentinel_scene.cloud_cover),
            "bbox": bbox,
            "preview_url": _preview_url(normalized_lat, normalized_lon, sentinel_scene.date, provider="sentinel-2"),
        }
    except (Sentinel2UnavailableError, Sentinel2NoScenesError) as exc:
        print("[SatQuery Satellite Explorer] Sentinel-2 latest fallback:", type(exc).__name__)
        sentinel_error = str(exc)

    try:
        latest_selection = await select_latest_preview_date(normalized_lat, normalized_lon)
    except NoImageryError as exc:
        return {
            **nasa_metadata(),
            "provider": "nasa-viirs",
            "fallback_used": True,
            "fallback_reason": sentinel_error,
            "layer": GIBS_TRUE_COLOR_LAYER,
            "date": None,
            "latest_observation_date": None,
            "selected_preview_date": None,
            "preview_quality": "poor",
            "lat": lat,
            "lon": lon,
            "bbox": build_aoi_bbox(normalized_lat, normalized_lon),
            "preview_url": None,
            "status": "no_imagery",
            "message": str(exc),
            "resolution_note": "VIIRS imagery-resolution source; visual preview from NASA GIBS",
        }
    except NasaCmrError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    selected_preview_date = latest_selection["selected_preview_date"]
    return {
        **nasa_metadata(),
        "provider": "nasa-viirs",
        "fallback_used": True,
        "fallback_reason": sentinel_error,
        "layer": GIBS_TRUE_COLOR_LAYER,
        "date": selected_preview_date,
        "latest_observation_date": latest_selection["latest_observation_date"],
        "selected_preview_date": selected_preview_date,
        "preview_quality": latest_selection["preview_quality"],
        "lat": normalized_lat,
        "lon": normalized_lon,
        "bbox": bbox,
        "preview_url": build_preview_proxy_url(normalized_lat, normalized_lon, str(selected_preview_date))
        if selected_preview_date
        else None,
        "resolution_note": "VIIRS imagery-resolution source; visual preview from NASA GIBS",
    }


@router.get("/api/location-imagery/preview")
async def location_imagery_preview(
    lat: float = Query(...),
    lon: float = Query(...),
    selected_date: str | None = Query(None, alias="date", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    provider: str = Query("auto", pattern=r"^(auto|sentinel-2|nasa-viirs)$"),
) -> Response:
    if selected_date is None:
        raise HTTPException(status_code=400, detail="date is required.")

    try:
        parsed_date: date = parse_iso_date(selected_date, "date")
        if provider in {"auto", "sentinel-2"}:
            try:
                sentinel_dates = await get_sentinel2_available_dates(lat, lon, parsed_date, parsed_date)
                if sentinel_dates:
                    content, content_type = await render_sentinel2_preview(lat, lon, parsed_date)
                    return Response(content=content, media_type=content_type)
                if provider == "sentinel-2":
                    raise NoImageryError("No Sentinel-2 imagery is available for this location on the requested date.")
            except (Sentinel2UnavailableError, Sentinel2NoScenesError) as exc:
                if provider == "sentinel-2":
                    raise HTTPException(status_code=502, detail=str(exc)) from exc
                print("[SatQuery Satellite Explorer] Sentinel-2 preview fallback:", type(exc).__name__)

        await ensure_date_available(lat, lon, parsed_date)
        content, content_type = await fetch_gibs_preview(lat, lon, parsed_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except NoImageryError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except NasaCmrError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except NasaGibsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return Response(content=content, media_type=content_type)


def _preview_url(lat: float, lon: float, selected_date: str, provider: str) -> str:
    return f"/api/location-imagery/preview?lat={lat}&lon={lon}&date={selected_date}&provider={provider}"
