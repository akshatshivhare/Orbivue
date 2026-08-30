import asyncio
import json
import time
from pathlib import Path
from typing import Any

import httpx

from ...config import ORBIVUE_GROUNDING_API_KEY, ORBIVUE_GROUNDING_API_URL
from ..gemini_client import GeminiAnalysisError


class OrbiVueGroundingProvider:
    name = "OrbiVue Grounding"
    model = "orbivue-visual-grounding"
    coordinate_order = "yxyx"

    def analyze_image(self, image_path: Path, prompt: str, user_query: str) -> str:
        raise GeminiAnalysisError(
            "OrbiVue grounding provider does not support single-image analysis.",
            error_type="unsupported_provider",
            user_message="OrbiVue grounding provider does not support single-image analysis.",
        )

    def ground_image(self, image_path: Path, prompt: str, response_format: dict[str, Any] | None = None) -> str:
        return asyncio.run(self._ground_image_async(image_path, _extract_user_query(prompt)))

    def analyze_temporal(self, image_t1_path: Path, image_t2_path: Path, prompt: str) -> str:
        raise GeminiAnalysisError(
            "OrbiVue grounding provider does not support temporal change analysis.",
            error_type="unsupported_provider",
            user_message="OrbiVue grounding provider does not support temporal change analysis.",
        )

    async def _ground_image_async(self, image_path: Path, user_query: str) -> str:
        if not ORBIVUE_GROUNDING_API_URL:
            raise GeminiAnalysisError(
                "OrbiVue grounding API URL is not configured.",
                error_type="missing_orbivue_grounding_api_url",
                user_message="OrbiVue grounding provider is not configured.",
            )

        if not ORBIVUE_GROUNDING_API_KEY:
            raise GeminiAnalysisError(
                "OrbiVue grounding API key is not configured.",
                error_type="missing_orbivue_grounding_api_key",
                user_message="OrbiVue grounding provider is not configured.",
            )

        ground_url = f"{ORBIVUE_GROUNDING_API_URL}/ground"
        request_started_at = time.perf_counter()
        print("[SatQuery OrbiVue Grounding] request type: grounding")
        print("[SatQuery OrbiVue Grounding] endpoint:", ground_url)

        try:
            image_bytes = image_path.read_bytes()
            async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
                response = await client.post(
                    ground_url,
                    headers={"X-API-Key": ORBIVUE_GROUNDING_API_KEY},
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
            print("[SatQuery OrbiVue Grounding] status: timeout")
            print("[SatQuery OrbiVue Grounding] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
            raise GeminiAnalysisError(
                str(error),
                error_type="orbivue_grounding_timeout",
                user_message="OrbiVue grounding timed out. Please try again.",
            ) from error
        except httpx.RequestError as error:
            print("[SatQuery OrbiVue Grounding] status: connection_error")
            print("[SatQuery OrbiVue Grounding] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
            raise GeminiAnalysisError(
                str(error),
                error_type="orbivue_grounding_connection_error",
                user_message="OrbiVue grounding provider could not be reached. Please try again.",
            ) from error

        print("[SatQuery OrbiVue Grounding] status:", response.status_code)
        print("[SatQuery OrbiVue Grounding] latency:", f"{time.perf_counter() - request_started_at:.3f}s")

        if response.status_code != 200:
            raise GeminiAnalysisError(
                _safe_response_excerpt(response.text),
                error_type=f"orbivue_grounding_http_{response.status_code}",
                user_message="OrbiVue grounding provider returned an error. Please try again.",
            )

        try:
            payload = response.json()
        except ValueError as error:
            raise GeminiAnalysisError(
                "OrbiVue grounding API returned malformed JSON.",
                error_type="orbivue_grounding_malformed_json",
                user_message="OrbiVue grounding provider returned an invalid response.",
            ) from error

        if not isinstance(payload, dict):
            raise GeminiAnalysisError(
                "OrbiVue grounding API response was not a JSON object.",
                error_type="orbivue_grounding_invalid_response",
                user_message="OrbiVue grounding provider returned an invalid response.",
            )

        if "bounding_boxes" not in payload:
            raise GeminiAnalysisError(
                "OrbiVue grounding API response was missing bounding_boxes.",
                error_type="orbivue_grounding_missing_bounding_boxes",
                user_message="OrbiVue grounding provider returned an incomplete response.",
            )

        bounding_boxes = payload.get("bounding_boxes")
        if not isinstance(bounding_boxes, list):
            raise GeminiAnalysisError(
                "OrbiVue grounding API bounding_boxes was not a list.",
                error_type="orbivue_grounding_invalid_bounding_boxes",
                user_message="OrbiVue grounding provider returned malformed bounding boxes.",
            )

        for box in bounding_boxes:
            if _valid_normalized_box(box) is None:
                raise GeminiAnalysisError(
                    "OrbiVue grounding API returned malformed bounding box values.",
                    error_type="orbivue_grounding_malformed_box",
                    user_message="OrbiVue grounding provider returned malformed bounding boxes.",
                )

        final_answer = payload.get("final_answer")
        if not isinstance(final_answer, str) or not final_answer.strip():
            final_answer = (
                "I could not confidently find the requested object in this image."
                if not bounding_boxes
                else "The requested object has been highlighted."
            )

        return json.dumps(
            {
                "mode": "grounding",
                "final_answer": final_answer.strip(),
                "bounding_boxes": bounding_boxes,
            }
        )


def _extract_user_query(prompt: str) -> str:
    marker = "User request:"
    if marker in prompt:
        return prompt.rsplit(marker, 1)[-1].strip()
    return prompt.strip()


def _valid_normalized_box(raw_box: Any) -> list[float] | None:
    if not isinstance(raw_box, list) or len(raw_box) != 4:
        return None

    try:
        ymin, xmin, ymax, xmax = [float(value) for value in raw_box]
    except (TypeError, ValueError):
        return None

    if not (0 <= ymin < ymax <= 1 and 0 <= xmin < xmax <= 1):
        return None

    return [ymin, xmin, ymax, xmax]


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
    return response_text[:500] if response_text else "Empty response from OrbiVue grounding API."
