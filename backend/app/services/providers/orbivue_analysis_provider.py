import asyncio
import time
from pathlib import Path
from typing import Any

import httpx

from ...config import ORBIVUE_API_KEY, ORBIVUE_API_URL
from ..gemini_client import GeminiAnalysisError


class OrbiVueVisionProvider:
    name = "OrbiVue"
    model = "orbivue-single-image-analysis"
    coordinate_order = "yxyx"

    def analyze_image(self, image_path: Path, prompt: str, user_query: str) -> str:
        return asyncio.run(self._analyze_image_async(image_path, user_query))

    def ground_image(self, image_path: Path, prompt: str, response_format: dict[str, Any] | None = None) -> str:
        raise GeminiAnalysisError(
            "OrbiVue provider does not support visual grounding yet.",
            error_type="unsupported_provider",
            user_message="OrbiVue provider does not support visual grounding yet.",
        )

    def analyze_temporal(self, image_t1_path: Path, image_t2_path: Path, prompt: str) -> str:
        raise GeminiAnalysisError(
            "OrbiVue provider does not support temporal change analysis yet.",
            error_type="unsupported_provider",
            user_message="OrbiVue provider does not support temporal change analysis yet.",
        )

    async def _analyze_image_async(self, image_path: Path, user_query: str) -> str:
        if not ORBIVUE_API_URL:
            raise GeminiAnalysisError(
                "OrbiVue API URL is not configured.",
                error_type="missing_orbivue_api_url",
                user_message="OrbiVue analysis provider is not configured.",
            )

        if not ORBIVUE_API_KEY:
            raise GeminiAnalysisError(
                "OrbiVue API key is not configured.",
                error_type="missing_orbivue_api_key",
                user_message="OrbiVue analysis provider is not configured.",
            )

        predict_url = f"{ORBIVUE_API_URL}/predict"
        request_started_at = time.perf_counter()
        print("[SatQuery OrbiVue] request type: analysis")
        print("[SatQuery OrbiVue] endpoint:", predict_url)

        try:
            image_bytes = image_path.read_bytes()
            async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
                response = await client.post(
                    predict_url,
                    headers={"X-API-Key": ORBIVUE_API_KEY},
                    data={"query": user_query},
                    files={
                        "image": (
                            image_path.name,
                            image_bytes,
                            _mime_type(image_path),
                        )
                    },
                )
        except httpx.TimeoutException as error:
            print("[SatQuery OrbiVue] status: timeout")
            print("[SatQuery OrbiVue] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
            raise GeminiAnalysisError(
                str(error),
                error_type="orbivue_timeout",
                user_message="OrbiVue analysis timed out. Please try again.",
            ) from error
        except httpx.RequestError as error:
            print("[SatQuery OrbiVue] status: connection_error")
            print("[SatQuery OrbiVue] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
            raise GeminiAnalysisError(
                str(error),
                error_type="orbivue_connection_error",
                user_message="OrbiVue analysis provider could not be reached. Please try again.",
            ) from error

        print("[SatQuery OrbiVue] status:", response.status_code)
        print("[SatQuery OrbiVue] latency:", f"{time.perf_counter() - request_started_at:.3f}s")

        if response.status_code != 200:
            raise GeminiAnalysisError(
                _safe_response_excerpt(response.text),
                error_type=f"orbivue_http_{response.status_code}",
                user_message="OrbiVue analysis provider returned an error. Please try again.",
            )

        try:
            payload = response.json()
        except ValueError as error:
            raise GeminiAnalysisError(
                "OrbiVue API returned malformed JSON.",
                error_type="orbivue_malformed_json",
                user_message="OrbiVue analysis provider returned an invalid response.",
            ) from error

        if not isinstance(payload, dict):
            raise GeminiAnalysisError(
                "OrbiVue API response was not a JSON object.",
                error_type="orbivue_invalid_response",
                user_message="OrbiVue analysis provider returned an invalid response.",
            )

        final_answer = payload.get("final_answer")
        if not isinstance(final_answer, str) or not final_answer.strip():
            raise GeminiAnalysisError(
                "OrbiVue API response was missing final_answer.",
                error_type="orbivue_missing_final_answer",
                user_message="OrbiVue analysis provider returned an incomplete response.",
            )

        return final_answer.strip()


def _mime_type(image_path: Path) -> str:
    suffix = image_path.suffix.casefold()
    if suffix in {".png"}:
        return "image/png"
    if suffix in {".webp"}:
        return "image/webp"
    if suffix in {".tif", ".tiff"}:
        return "image/tiff"
    return "image/jpeg"


def _safe_response_excerpt(response_text: str) -> str:
    return response_text[:500] if response_text else "Empty response from OrbiVue API."
