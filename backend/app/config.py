import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_ANALYSIS_MODEL = os.getenv("GEMINI_ANALYSIS_MODEL", "gemini-3.6-flash")
GEMINI_THINKING_LEVEL = os.getenv("GEMINI_THINKING_LEVEL", "minimal")

DEFAULT_ALLOWED_ORIGINS = [
    "https://orbivue.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def _normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/")


def _parse_allowed_origins(raw_origins: str | None) -> list[str]:
    origins = raw_origins.split(",") if raw_origins else DEFAULT_ALLOWED_ORIGINS
    normalized_origins: list[str] = []

    for origin in origins:
        normalized_origin = _normalize_origin(origin)
        if normalized_origin and normalized_origin not in normalized_origins:
            normalized_origins.append(normalized_origin)

    return normalized_origins or DEFAULT_ALLOWED_ORIGINS


ALLOWED_ORIGINS = _parse_allowed_origins(os.getenv("ALLOWED_ORIGINS"))


def gemini_api_key_loaded() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))
