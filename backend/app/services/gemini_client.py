import base64
import json
import mimetypes
import re
import time
from pathlib import Path
from typing import Any

from ..config import GEMINI_ANALYSIS_MODEL, GEMINI_API_KEY, GEMINI_THINKING_LEVEL

try:
    from google import genai
except ImportError:  # pragma: no cover - handled at runtime with a clean API response
    genai = None

_client: Any | None = None
MAX_RATE_LIMIT_RETRIES = 1
DEFAULT_RATE_LIMIT_RETRY_SECONDS = 5.0
RATE_LIMIT_RETRY_BUFFER_SECONDS = 0.75


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


def _error_text(error: Exception) -> str:
    return f"{error}\n{error!r}"


def retry_after_seconds(error: Exception) -> float | None:
    error_text = _error_text(error)
    retry_match = re.search(r"please\s+retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s", error_text, flags=re.IGNORECASE)
    if not retry_match:
        retry_match = re.search(r"retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s", error_text, flags=re.IGNORECASE)

    if not retry_match:
        return None

    try:
        return float(retry_match.group(1))
    except ValueError:
        return None


def is_rate_limited(error: Exception) -> bool:
    error_text = repr(error).casefold()
    return (
        "429" in error_text
        or "ratelimit" in error_text
        or "rate limit" in error_text
        or "quota exceeded" in error_text
        or "resource_exhausted" in error_text
    )


def is_non_retriable_quota(error: Exception) -> bool:
    if retry_after_seconds(error) is not None:
        return False

    error_text = repr(error).casefold()
    hard_quota_markers = (
        "daily",
        "per day",
        "per-day",
        "billing",
        "upgrade",
        "insufficient quota",
    )
    return is_rate_limited(error) and any(marker in error_text for marker in hard_quota_markers)


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
    if is_rate_limited(error):
        return "rate_limited"
    if is_model_unavailable(error):
        return "model_unavailable"
    if is_temporary_unavailable(error):
        return "temporary_unavailable"
    return type(error).__name__


def _rate_limit_user_message(retry_seconds: float | None = None) -> str:
    wait_seconds = retry_seconds if retry_seconds is not None else 30
    display_seconds = max(30, int(round(wait_seconds)))
    return f"Gemini is temporarily rate limited. Please wait about {display_seconds} seconds and try again."


def _call_with_rate_limit_retry(operation: Any, **kwargs: Any) -> Any:
    retry_attempt = 0

    while True:
        try:
            result = operation(**kwargs)
            if retry_attempt:
                print("[SatQuery Gemini] retry succeeded")
            return result
        except Exception as error:
            if not is_rate_limited(error):
                raise

            server_retry_hint = retry_after_seconds(error)
            print("[SatQuery Gemini] rate limited")
            print(
                "[SatQuery Gemini] server retry hint:",
                f"{server_retry_hint:.2f}s" if server_retry_hint is not None else "none",
            )

            if retry_attempt >= MAX_RATE_LIMIT_RETRIES or is_non_retriable_quota(error):
                print("[SatQuery Gemini] retry exhausted")
                raise GeminiAnalysisError(
                    str(error),
                    error_type="rate_limited",
                    user_message=_rate_limit_user_message(server_retry_hint),
                ) from error

            retry_attempt += 1
            retry_delay = (
                server_retry_hint + RATE_LIMIT_RETRY_BUFFER_SECONDS
                if server_retry_hint is not None
                else DEFAULT_RATE_LIMIT_RETRY_SECONDS
            )
            retry_delay = max(0.0, retry_delay)

            print("[SatQuery Gemini] retrying in:", f"{retry_delay:.1f}s")
            print("[SatQuery Gemini] retry attempt:", retry_attempt)
            time.sleep(retry_delay)


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

    return _call_with_rate_limit_retry(interactions.create, **kwargs)


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
    if next_error_type == "rate_limited":
        raise GeminiAnalysisError(
            str(error),
            error_type=next_error_type,
            user_message=_rate_limit_user_message(retry_after_seconds(error)),
        ) from error
    raise GeminiAnalysisError(
        str(error),
        error_type=next_error_type,
        user_message=default_message,
    ) from error
