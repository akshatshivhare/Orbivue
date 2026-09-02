import time
from io import BytesIO
from datetime import date
from urllib.parse import urlencode

from ..config import LOCATION_IMAGERY_PREVIEW_SIZE, LOCATION_IMAGERY_USER_AGENT
from .nasa_cmr import GIBS_TRUE_COLOR_LAYER, build_aoi_bbox, validate_lat_lon

NASA_GIBS_WMS_URL = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
NASA_GIBS_WMS_VERSION = "1.1.1"
NASA_GIBS_IMAGE_FORMAT = "image/jpeg"


class NasaGibsError(Exception):
    pass


def build_preview_proxy_url(lat: float, lon: float, selected_date: str) -> str:
    return f"/api/location-imagery/preview?{urlencode({'lat': lat, 'lon': lon, 'date': selected_date})}"


async def fetch_gibs_preview(
    lat: float,
    lon: float,
    selected_date: date,
    preview_size: int = LOCATION_IMAGERY_PREVIEW_SIZE,
) -> tuple[bytes, str]:
    normalized_lat, normalized_lon = validate_lat_lon(lat, lon)
    bbox = build_aoi_bbox(normalized_lat, normalized_lon)
    bbox_text = ",".join(str(value) for value in bbox)
    started_at = time.perf_counter()

    try:
        import httpx

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=8.0, read=25.0),
            headers={"User-Agent": LOCATION_IMAGERY_USER_AGENT},
        ) as client:
            response = await client.get(
                NASA_GIBS_WMS_URL,
                params={
                    "SERVICE": "WMS",
                    "VERSION": NASA_GIBS_WMS_VERSION,
                    "REQUEST": "GetMap",
                    "LAYERS": GIBS_TRUE_COLOR_LAYER,
                    "STYLES": "",
                    "FORMAT": NASA_GIBS_IMAGE_FORMAT,
                    "TRANSPARENT": "FALSE",
                    "SRS": "EPSG:4326",
                    "TIME": selected_date.isoformat(),
                    "BBOX": bbox_text,
                    "WIDTH": preview_size,
                    "HEIGHT": preview_size,
                },
            )
    except httpx.TimeoutException as exc:
        raise NasaGibsError("NASA GIBS preview request timed out.") from exc
    except httpx.HTTPError as exc:
        raise NasaGibsError("NASA GIBS could not be reached.") from exc

    content_type = response.headers.get("content-type", NASA_GIBS_IMAGE_FORMAT).split(";")[0].strip()
    print("[NASA GIBS] date:", selected_date.isoformat())
    print("[NASA GIBS] bbox:", bbox_text)
    print("[NASA GIBS] layer:", GIBS_TRUE_COLOR_LAYER)
    print("[NASA GIBS] WMS version:", NASA_GIBS_WMS_VERSION)
    print("[NASA GIBS] HTTP status:", response.status_code)
    print("[NASA GIBS] content-type:", content_type)
    print("[NASA GIBS] bytes:", len(response.content))
    print("[SatQuery NASA GIBS] latency:", f"{time.perf_counter() - started_at:.3f}s")

    if response.status_code >= 400:
        raise NasaGibsError("NASA GIBS returned an error.")

    if not content_type.startswith("image/"):
        raise NasaGibsError("NASA GIBS did not return an image.")

    if preview_appears_blank(response.content):
        print("[NASA GIBS] warning: preview appears blank/no-data")

    return response.content, content_type


def preview_appears_blank(image_content: bytes) -> bool:
    try:
        from PIL import Image

        with Image.open(BytesIO(image_content)) as image:
            thumbnail = image.convert("RGB")
            thumbnail.thumbnail((64, 64))
            pixels = list(thumbnail.getdata())
            extrema = thumbnail.getextrema()
    except Exception:
        return False

    if not pixels:
        return False

    near_white_pixels = 0
    low_variance_pixels = 0
    for red, green, blue in pixels:
        if red >= 245 and green >= 245 and blue >= 245:
            near_white_pixels += 1
        if max(red, green, blue) - min(red, green, blue) <= 4:
            low_variance_pixels += 1

    total_pixels = len(pixels)
    channel_means = [
        sum(pixel[channel_index] for pixel in pixels) / total_pixels
        for channel_index in range(3)
    ]
    channel_ranges = [channel_max - channel_min for channel_min, channel_max in extrema]
    bright_low_contrast = min(channel_means) > 230 and max(channel_ranges) < 45

    return (
        near_white_pixels / total_pixels > 0.92
        or low_variance_pixels / total_pixels > 0.98
        or bright_low_contrast
    )


_preview_appears_blank = preview_appears_blank
