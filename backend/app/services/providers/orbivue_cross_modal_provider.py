import json
import time
from pathlib import Path
from typing import Any

import httpx

from ...config import ORBIVUE_CROSS_MODAL_API_KEY, ORBIVUE_CROSS_MODAL_API_URL
from ..gemini_client import GeminiAnalysisError


class OrbiVueCrossModalProvider:
    name = "OrbiVue Cross-Modal"
    model = "orbivue-cross-modal-optical-sar"

    async def analyze_cross_modal(self, optical_image_path: Path, sar_image_path: Path, query: str) -> str:
        if not ORBIVUE_CROSS_MODAL_API_URL:
            raise GeminiAnalysisError(
                "OrbiVue cross-modal API URL is not configured.",
                error_type="missing_orbivue_cross_modal_api_url",
                user_message="OrbiVue cross-modal provider is not configured.",
            )

        if not ORBIVUE_CROSS_MODAL_API_KEY:
            raise GeminiAnalysisError(
                "OrbiVue cross-modal API key is not configured.",
                error_type="missing_orbivue_cross_modal_api_key",
                user_message="OrbiVue cross-modal provider is not configured.",
            )

        cross_modal_url = f"{ORBIVUE_CROSS_MODAL_API_URL}/cross-modal"
        request_started_at = time.perf_counter()
        print("[SatQuery OrbiVue CrossModal] request type: cross_modal")
        print("[SatQuery OrbiVue CrossModal] endpoint:", cross_modal_url)

        try:
            optical_bytes = optical_image_path.read_bytes()
            sar_bytes = sar_image_path.read_bytes()
            async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
                response = await client.post(
                    cross_modal_url,
                    headers={"X-API-Key": ORBIVUE_CROSS_MODAL_API_KEY},
                    data={"query": query},
                    files={
                        "optical_image": (
                            optical_image_path.name,
                            optical_bytes,
                            _mime_type(optical_image_path),
                        ),
                        "sar_image": (
                            sar_image_path.name,
                            sar_bytes,
                            _mime_type(sar_image_path),
                        ),
                    },
                )
        except httpx.TimeoutException as error:
            print("[SatQuery OrbiVue CrossModal] status: timeout")
            print("[SatQuery OrbiVue CrossModal] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
            raise GeminiAnalysisError(
                str(error),
                error_type="orbivue_cross_modal_timeout",
                user_message="OrbiVue cross-modal analysis timed out. Please try again.",
            ) from error
        except httpx.RequestError as error:
            print("[SatQuery OrbiVue CrossModal] status: connection_error")
            print("[SatQuery OrbiVue CrossModal] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
            raise GeminiAnalysisError(
                str(error),
                error_type="orbivue_cross_modal_connection_error",
                user_message="OrbiVue cross-modal provider could not be reached. Please try again.",
            ) from error

        print("[SatQuery OrbiVue CrossModal] status:", response.status_code)
        print("[SatQuery OrbiVue CrossModal] latency:", f"{time.perf_counter() - request_started_at:.3f}s")

        if response.status_code != 200:
            raise GeminiAnalysisError(
                _safe_response_excerpt(response.text),
                error_type=f"orbivue_cross_modal_http_{response.status_code}",
                user_message="OrbiVue cross-modal provider returned an error. Please try again.",
            )

        try:
            payload = response.json()
        except ValueError as error:
            raise GeminiAnalysisError(
                "OrbiVue cross-modal API returned malformed JSON.",
                error_type="orbivue_cross_modal_malformed_json",
                user_message="OrbiVue cross-modal provider returned an invalid response.",
            ) from error

        if not isinstance(payload, dict):
            raise GeminiAnalysisError(
                "OrbiVue cross-modal API response was not a JSON object.",
                error_type="orbivue_cross_modal_invalid_response",
                user_message="OrbiVue cross-modal provider returned an invalid response.",
            )

        final_answer = payload.get("final_answer")
        if not isinstance(final_answer, str) or not final_answer.strip():
            raise GeminiAnalysisError(
                "OrbiVue cross-modal API response was missing final_answer.",
                error_type="orbivue_cross_modal_missing_final_answer",
                user_message="OrbiVue cross-modal provider returned an incomplete response.",
            )

        return json.dumps(
            {
                "mode": "cross_modal",
                "final_answer": final_answer.strip(),
            }
        )


def _mime_type(image_path: Path) -> str:
    suffix = image_path.suffix.casefold()
    if suffix == ".png":
        return "image/png"
    if suffix == ".webp":
        return "image/webp"
    if suffix in {".tif", ".tiff"}:
        return "image/tiff"
    return "image/jpeg"


def _safe_response_excerpt(response_text: str) -> str:
    return response_text[:500] if response_text else "Empty response from OrbiVue cross-modal API."
