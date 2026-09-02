from pathlib import Path
import os
import re

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - only used in minimal tooling environments.
    def load_dotenv(*_args: object, **_kwargs: object) -> bool:
        return False

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env", override=False)

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_ANALYSIS_MODEL = os.getenv("GEMINI_ANALYSIS_MODEL", "gemini-3.6-flash")
GEMINI_THINKING_LEVEL = os.getenv("GEMINI_THINKING_LEVEL", "minimal")
VISION_PROVIDER = os.getenv("VISION_PROVIDER", "gemini").strip().casefold()
ANALYSIS_PROVIDER = os.getenv("ANALYSIS_PROVIDER", VISION_PROVIDER).strip().casefold()
GROUNDING_PROVIDER = os.getenv("GROUNDING_PROVIDER", VISION_PROVIDER).strip().casefold()
TEMPORAL_PROVIDER = os.getenv("TEMPORAL_PROVIDER", VISION_PROVIDER).strip().casefold()
CROSS_MODAL_PROVIDER = os.getenv("CROSS_MODAL_PROVIDER", "orbivue").strip().casefold()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_VISION_MODEL = os.getenv(
    "OPENROUTER_VISION_MODEL",
    "qwen/qwen2.5-vl-32b-instruct:free",
)
ORBIVUE_API_URL = os.getenv("ORBIVUE_API_URL", "").strip().rstrip("/")
ORBIVUE_API_KEY = os.getenv("ORBIVUE_API_KEY")
ORBIVUE_GROUNDING_API_URL = os.getenv("ORBIVUE_GROUNDING_API_URL", "").strip().rstrip("/")
ORBIVUE_GROUNDING_API_KEY = os.getenv("ORBIVUE_GROUNDING_API_KEY")
ORBIVUE_TEMPORAL_API_URL = os.getenv("ORBIVUE_TEMPORAL_API_URL", "").strip().rstrip("/")
ORBIVUE_TEMPORAL_API_KEY = os.getenv("ORBIVUE_TEMPORAL_API_KEY")
ORBIVUE_CROSS_MODAL_API_URL = os.getenv("ORBIVUE_CROSS_MODAL_API_URL", "").strip().rstrip("/")
ORBIVUE_CROSS_MODAL_API_KEY = os.getenv("ORBIVUE_CROSS_MODAL_API_KEY")
COPERNICUS_CLIENT_ID = os.getenv("COPERNICUS_CLIENT_ID")
COPERNICUS_CLIENT_SECRET = os.getenv("COPERNICUS_CLIENT_SECRET")
LOCATION_IMAGERY_AOI_KM = float(os.getenv("LOCATION_IMAGERY_AOI_KM", "25"))
LOCATION_IMAGERY_MAX_RANGE_DAYS = int(os.getenv("LOCATION_IMAGERY_MAX_RANGE_DAYS", "90"))
LOCATION_IMAGERY_LATEST_LOOKBACK_DAYS = int(os.getenv("LOCATION_IMAGERY_LATEST_LOOKBACK_DAYS", "14"))
SENTINEL2_LATEST_LOOKBACK_DAYS = int(os.getenv("SENTINEL2_LATEST_LOOKBACK_DAYS", "30"))
SENTINEL2_GOOD_CLOUD_MAX = float(os.getenv("SENTINEL2_GOOD_CLOUD_MAX", "20"))
SENTINEL2_FAIR_CLOUD_MAX = float(os.getenv("SENTINEL2_FAIR_CLOUD_MAX", "50"))
LOCATION_IMAGERY_PREVIEW_SIZE = int(os.getenv("LOCATION_IMAGERY_PREVIEW_SIZE", "768"))
LOCATION_IMAGERY_USER_AGENT = os.getenv(
    "LOCATION_IMAGERY_USER_AGENT",
    "OrbiVue/0.1 location-imagery-prototype",
)

DEFAULT_ALLOWED_ORIGINS = [
    "https://orbivue.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def _normalize_origin(origin: str) -> str:
    cleaned_origin = origin.strip().strip("\"'")

    markdown_link_match = re.fullmatch(r"\[([^\]]+)\]\([^)]+\)", cleaned_origin)
    if markdown_link_match:
        cleaned_origin = markdown_link_match.group(1).strip()

    return cleaned_origin.rstrip("/")


def _parse_allowed_origins(raw_origins: str | None) -> list[str]:
    cleaned_origins = raw_origins.strip() if raw_origins else ""
    if cleaned_origins.startswith("[") and cleaned_origins.endswith("]"):
        cleaned_origins = cleaned_origins[1:-1]

    origins = cleaned_origins.split(",") if cleaned_origins else DEFAULT_ALLOWED_ORIGINS
    normalized_origins: list[str] = []

    for origin in origins:
        normalized_origin = _normalize_origin(origin)
        if normalized_origin and normalized_origin not in normalized_origins:
            normalized_origins.append(normalized_origin)

    return normalized_origins or DEFAULT_ALLOWED_ORIGINS


ALLOWED_ORIGINS = _parse_allowed_origins(os.getenv("ALLOWED_ORIGINS"))


def gemini_api_key_loaded() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))
