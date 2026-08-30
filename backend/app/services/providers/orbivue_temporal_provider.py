import asyncio
import json
import time
from pathlib import Path
from typing import Any

import httpx

from ...config import ORBIVUE_TEMPORAL_API_KEY, ORBIVUE_TEMPORAL_API_URL
from ..gemini_client import GeminiAnalysisError


class OrbiVueTemporalProvider:
    name = "OrbiVue Temporal"
    model = "orbivue-temporal-change"
    coordinate_order = "yxyx"

    def analyze_image(self, image_path: Path, prompt: str, user_query: str) -> str:
        raise GeminiAnalysisError(
            "OrbiVue temporal provider does not support single-image analysis.",
            error_type="unsupported_provider",
            user_message="OrbiVue temporal provider does not support single-image analysis.",
        )

    def ground_image(self, image_path: Path, prompt: str, response_format: dict[str, Any] | None = None) -> str:
        raise GeminiAnalysisError(
            "OrbiVue temporal provider does not support visual grounding.",
            error_type="unsupported_provider",
            user_message="OrbiVue temporal provider does not support visual grounding.",
        )

    def analyze_temporal(self, image_t1_path: Path, image_t2_path: Path, prompt: str) -> str:
        return asyncio.run(self._analyze_temporal_async(image_t1_path, image_t2_path, _extract_user_query(prompt)))

    async def _analyze_temporal_async(self, image_t1_path: Path, image_t2_path: Path, user_query: str) -> str:
        if not ORBIVUE_TEMPORAL_API_URL:
            raise GeminiAnalysisError(
                "OrbiVue temporal API URL is not configured.",
                error_type="missing_orbivue_temporal_api_url",
                user_message="OrbiVue temporal provider is not configured.",
            )

        if not ORBIVUE_TEMPORAL_API_KEY:
            raise GeminiAnalysisError(
                "OrbiVue temporal API key is not configured.",
                error_type="missing_orbivue_temporal_api_key",
                user_message="OrbiVue temporal provider is not configured.",
            )

        change_url = f"{ORBIVUE_TEMPORAL_API_URL}/change"
        request_started_at = time.perf_counter()
        print("[SatQuery OrbiVue Temporal] request type: temporal")
        print("[SatQuery OrbiVue Temporal] endpoint:", change_url)

        try:
            image_t1_bytes = image_t1_path.read_bytes()
            image_t2_bytes = image_t2_path.read_bytes()
            async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
                response = await client.post(
                    change_url,
                    headers={"X-API-Key": ORBIVUE_TEMPORAL_API_KEY},
                    data={"query": user_query},
                    files={
                        "image_t1": (
                            image_t1_path.name,
                            image_t1_bytes,
                            _mime_type(image_t1_path),
                        ),
                        "image_t2": (
                            image_t2_path.name,
                            image_t2_bytes,
                            _mime_type(image_t2_path),
                        ),
                    },
                )
        except httpx.TimeoutException as error:
            print("[SatQuery OrbiVue Temporal] status: timeout")
            print("[SatQuery OrbiVue Temporal] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
            raise GeminiAnalysisError(
                str(error),
                error_type="orbivue_temporal_timeout",
                user_message="OrbiVue temporal change analysis timed out. Please try again.",
            ) from error
        except httpx.RequestError as error:
            print("[SatQuery OrbiVue Temporal] status: connection_error")
            print("[SatQuery OrbiVue Temporal] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
            raise GeminiAnalysisError(
                str(error),
                error_type="orbivue_temporal_connection_error",
                user_message="OrbiVue temporal provider could not be reached. Please try again.",
            ) from error

        print("[SatQuery OrbiVue Temporal] status:", response.status_code)
        print("[SatQuery OrbiVue Temporal] latency:", f"{time.perf_counter() - request_started_at:.3f}s")

        if response.status_code != 200:
            raise GeminiAnalysisError(
                _safe_response_excerpt(response.text),
                error_type=f"orbivue_temporal_http_{response.status_code}",
                user_message="OrbiVue temporal provider returned an error. Please try again.",
            )

        try:
            payload = response.json()
        except ValueError as error:
            raise GeminiAnalysisError(
                "OrbiVue temporal API returned malformed JSON.",
                error_type="orbivue_temporal_malformed_json",
                user_message="OrbiVue temporal provider returned an invalid response.",
            ) from error

        if not isinstance(payload, dict):
            raise GeminiAnalysisError(
                "OrbiVue temporal API response was not a JSON object.",
                error_type="orbivue_temporal_invalid_response",
                user_message="OrbiVue temporal provider returned an invalid response.",
            )

        final_answer = payload.get("final_answer")
        if not isinstance(final_answer, str) or not final_answer.strip():
            raise GeminiAnalysisError(
                "OrbiVue temporal API response was missing final_answer.",
                error_type="orbivue_temporal_missing_final_answer",
                user_message="OrbiVue temporal provider returned an incomplete response.",
            )

        return json.dumps(
            {
                "mode": "temporal",
                "final_answer": final_answer.strip(),
            }
        )


def _extract_user_query(prompt: str) -> str:
    follow_up_marker = "Answer this follow-up change question using BOTH images and the T2-relative-to-T1 comparison:"
    if follow_up_marker in prompt:
        return prompt.rsplit(follow_up_marker, 1)[-1].strip()

    return "Provide the initial concise temporal change analysis."


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
    return response_text[:500] if response_text else "Empty response from OrbiVue temporal API."
