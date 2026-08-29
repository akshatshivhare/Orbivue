import time
from pathlib import Path
from typing import Any

from ..config import GEMINI_ANALYSIS_MODEL
from ..schemas.grounding import GeminiBoundingBox, GroundingBox, GroundingResponse
from .gemini_client import (
    GeminiAnalysisError,
    create_gemini_interaction,
    encode_image_part,
    error_type,
    parse_json_output,
    raise_user_facing_gemini_error,
)


def _grounding_schema() -> dict[str, Any]:
    return {
        "type": "array",
        "items": GeminiBoundingBox.model_json_schema(),
    }


def _normalize_gemini_grounding_boxes(raw_boxes: Any) -> list[GroundingBox]:
    if isinstance(raw_boxes, dict):
        if "box_2d" in raw_boxes:
            candidate_boxes = [raw_boxes]
        else:
            candidate_boxes = raw_boxes.get("bounding_boxes") or raw_boxes.get("boxes") or raw_boxes.get("detections") or []
    else:
        candidate_boxes = raw_boxes

    if not isinstance(candidate_boxes, list):
        return []

    normalized_boxes: list[GroundingBox] = []
    for index, item in enumerate(candidate_boxes):
        if not isinstance(item, dict):
            continue

        raw_box = item.get("box_2d") or item.get("box") or item.get("bbox")
        if not isinstance(raw_box, list) or len(raw_box) != 4:
            continue

        try:
            ymin, xmin, ymax, xmax = [float(value) for value in raw_box]
        except (TypeError, ValueError):
            continue

        if not all(0 <= value <= 1000 for value in (ymin, xmin, ymax, xmax)):
            continue
        if ymin >= ymax or xmin >= xmax:
            continue

        width = xmax - xmin
        height = ymax - ymin
        area = (width * height) / 1_000_000
        is_full_frame = ymin <= 25 and xmin <= 25 and ymax >= 975 and xmax >= 975
        if is_full_frame or area >= 0.90:
            continue

        label = str(item.get("label") or f"object {index + 1}").strip()
        if not label:
            label = f"object {index + 1}"

        normalized_boxes.append(
            {
                "label": label,
                "box": [
                    round(ymin / 1000.0, 4),
                    round(xmin / 1000.0, 4),
                    round(ymax / 1000.0, 4),
                    round(xmax / 1000.0, 4),
                ],
            }
        )

    return normalized_boxes


def _box_count_label(box_count: int) -> str:
    if box_count == 0:
        return "0 boxes"
    if box_count == 1:
        return "1 box"
    return "multiple boxes"


def _candidate_grounding_boxes(raw_boxes: Any) -> list[Any]:
    if isinstance(raw_boxes, dict):
        if "box_2d" in raw_boxes:
            return [raw_boxes]
        candidate_boxes = raw_boxes.get("bounding_boxes") or raw_boxes.get("boxes") or raw_boxes.get("detections") or []
    else:
        candidate_boxes = raw_boxes

    return candidate_boxes if isinstance(candidate_boxes, list) else []


def _log_grounding_box_debug(raw_boxes: Any, normalized_boxes: list[GroundingBox]) -> None:
    raw_candidates = _candidate_grounding_boxes(raw_boxes)
    print("[SatQuery Grounding] box count:", _box_count_label(len(normalized_boxes)))

    if not normalized_boxes:
        print("[SatQuery Grounding] raw Gemini box_2d:", [])
        print("[SatQuery Grounding] normalized 0-1 box:", [])
        print("[SatQuery Grounding] label:", "")
        return

    for index, normalized_box in enumerate(normalized_boxes):
        raw_box = []
        if index < len(raw_candidates) and isinstance(raw_candidates[index], dict):
            raw_box = raw_candidates[index].get("box_2d") or raw_candidates[index].get("box") or raw_candidates[index].get("bbox") or []
        print("[SatQuery Grounding] raw Gemini box_2d:", raw_box)
        print("[SatQuery Grounding] normalized 0-1 box:", normalized_box["box"])
        print("[SatQuery Grounding] label:", normalized_box["label"])


def ground_image_with_gemini(image_path: str, user_query: str) -> GroundingResponse:
    total_started_at = time.perf_counter()
    image_file = Path(image_path)
    prompt = (
        "Locate only the object or region requested by the user in this image. "
        "Return precise bounding boxes around the requested visible object. "
        "Do not return a box covering the entire image unless the user's requested object "
        "genuinely occupies the entire image. If the requested object is not clearly visible, "
        "return no bounding box.\n\n"
        f"User request: {user_query}"
    )

    try:
        api_started_at = time.perf_counter()
        interaction = create_gemini_interaction(
            input_parts=[
                encode_image_part(image_file),
                {
                    "type": "text",
                    "text": prompt,
                },
            ],
            max_output_tokens=180,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": _grounding_schema(),
            },
        )
        print("[SatQuery Grounding] Gemini API latency:", f"{time.perf_counter() - api_started_at:.3f}s")
    except GeminiAnalysisError:
        print("[SatQuery Grounding] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
        raise
    except Exception as error:
        print("[SatQuery Grounding] error type:", error_type(error))
        print("[SatQuery Grounding] error:", repr(error))
        print("[SatQuery Grounding] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
        raise_user_facing_gemini_error(
            error,
            "Gemini grounding could not be completed. Please try again.",
        )

    output_text = getattr(interaction, "output_text", None)
    normalization_started_at = time.perf_counter()
    if not isinstance(output_text, str) or not output_text.strip():
        print("[SatQuery Grounding] normalization latency:", f"{time.perf_counter() - normalization_started_at:.3f}s")
        _log_grounding_box_debug([], [])
        print("[SatQuery Grounding] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
        return {
            "mode": "grounding",
            "final_answer": "I could not confidently locate the requested object.",
            "bounding_boxes": [],
        }

    try:
        raw_boxes = parse_json_output(output_text)
    except Exception as error:
        print("[SatQuery Grounding] error type:", type(error).__name__)
        print("[SatQuery Grounding] error:", repr(error))
        print("[SatQuery Grounding] normalization latency:", f"{time.perf_counter() - normalization_started_at:.3f}s")
        _log_grounding_box_debug(output_text, [])
        print("[SatQuery Grounding] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
        return {
            "mode": "grounding",
            "final_answer": "I could not confidently locate the requested object.",
            "bounding_boxes": [],
        }

    normalized_boxes = _normalize_gemini_grounding_boxes(raw_boxes)
    print("[SatQuery Grounding] normalization latency:", f"{time.perf_counter() - normalization_started_at:.3f}s")
    _log_grounding_box_debug(raw_boxes, normalized_boxes)

    if not normalized_boxes:
        print("[SatQuery Grounding] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
        return {
            "mode": "grounding",
            "final_answer": "I could not confidently locate the requested object.",
            "bounding_boxes": [],
        }

    first_label = normalized_boxes[0]["label"]
    final_answer = f"The {first_label} is highlighted in the image."
    if len(normalized_boxes) > 1:
        final_answer = f"Highlighted {len(normalized_boxes)} matching regions in the image."

    print("[SatQuery Grounding] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
    return {
        "mode": "grounding",
        "final_answer": final_answer,
        "bounding_boxes": normalized_boxes,
    }
