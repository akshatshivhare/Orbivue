import base64
import json
import mimetypes
from pathlib import Path
from typing import Any

from ..config import GEMINI_ANALYSIS_MODEL, GEMINI_API_KEY, GEMINI_THINKING_LEVEL

try:
    from google import genai
except ImportError:  # pragma: no cover - handled at runtime with a clean API response
    genai = None

_client: Any | None = None


class GeminiAnalysisError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        error_type: str = "unknown",
        user_message: str | None = None,
    ) -> None:
        super().__init__(message)
        self.error_type = error_type
        self.user_message = user_message or message


def get_gemini_client() -> Any:
    global _client

    if genai is None:
        raise GeminiAnalysisError(
            "Gemini analysis is unavailable because the google-genai package is not installed.",
            error_type="missing_dependency",
        )

    if not GEMINI_API_KEY:
        raise GeminiAnalysisError(
            "Gemini analysis is unavailable because GEMINI_API_KEY is not configured.",
            error_type="missing_api_key",
            user_message="Gemini API key is not configured.",
        )

    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)

    return _client


def encode_image_part(image_path: Path) -> dict[str, str]:
    return {
        "type": "image",
        "data": base64.b64encode(image_path.read_bytes()).decode("utf-8"),
        "mime_type": mimetypes.guess_type(image_path.name)[0] or "image/jpeg",
    }


def parse_json_output(output_text: str) -> Any:
    cleaned = output_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
        cleaned = cleaned.removesuffix("```").strip()
    return json.loads(cleaned)


def is_temporary_unavailable(error: Exception) -> bool:
    error_text = repr(error).casefold()
    temporary_markers = (
        "503",
        "unavailable",
        "high demand",
        "overloaded",
        "temporarily",
        "try again later",
    )
    return any(marker in error_text for marker in temporary_markers)


def is_model_unavailable(error: Exception) -> bool:
    error_text = repr(error).casefold()
    return (
        "no longer available" in error_text
        or (("404" in error_text or "not_found" in error_text or "not found" in error_text)
            and ("model" in error_text or "models/" in error_text))
    )


def error_type(error: Exception) -> str:
    if isinstance(error, GeminiAnalysisError):
        return error.error_type
    if is_model_unavailable(error):
        return "model_unavailable"
    if is_temporary_unavailable(error):
        return "temporary_unavailable"
    return type(error).__name__


def create_gemini_interaction(
    *,
    input_parts: list[dict[str, Any]],
    max_output_tokens: int,
    response_format: dict[str, Any] | None = None,
) -> Any:
    client = get_gemini_client()
    interactions = getattr(client, "interactions", None)
    if interactions is None or not hasattr(interactions, "create"):
        raise GeminiAnalysisError(
            "The installed google-genai SDK does not expose client.interactions.create.",
            error_type="interactions_api_unavailable",
        )

    kwargs: dict[str, Any] = {
        "model": GEMINI_ANALYSIS_MODEL,
        "input": input_parts,
        "generation_config": {
            "max_output_tokens": max_output_tokens,
            "thinking_level": GEMINI_THINKING_LEVEL,
        },
    }
    if response_format is not None:
        kwargs["response_format"] = response_format

    return interactions.create(**kwargs)


def raise_user_facing_gemini_error(error: Exception, default_message: str) -> None:
    next_error_type = error_type(error)
    if next_error_type == "model_unavailable":
        raise GeminiAnalysisError(
            str(error),
            error_type=next_error_type,
            user_message="Configured Gemini model is unavailable.",
        ) from error
    if next_error_type == "temporary_unavailable":
        raise GeminiAnalysisError(
            str(error),
            error_type=next_error_type,
            user_message="Gemini is temporarily busy. Please try again.",
        ) from error
    raise GeminiAnalysisError(
        str(error),
        error_type=next_error_type,
        user_message=default_message,
    ) from error
