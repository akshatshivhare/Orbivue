import time
from pathlib import Path
from typing import Any

from ..schemas.grounding import GeminiBoundingBox, GroundingBox, GroundingResponse
from .gemini_client import (
    GeminiAnalysisError,
    error_type,
    parse_json_output,
    raise_user_facing_gemini_error,
)
from .providers import CoordinateOrder, get_grounding_provider

try:
    from PIL import Image
except ImportError:  # pragma: no cover - Pillow is listed in backend requirements
    Image = None


def _grounding_schema() -> dict[str, Any]:
    return {
        "type": "array",
        "items": GeminiBoundingBox.model_json_schema(),
    }


def _image_size(image_path: Path) -> tuple[int, int] | None:
    if Image is None:
        return None

    try:
        with Image.open(image_path) as image:
            return image.size
    except Exception:
        return None


def _normalize_coordinate_box(
    *,
    raw_box: list[Any],
    coordinate_order: CoordinateOrder,
    image_size: tuple[int, int] | None,
) -> list[float] | None:
    try:
        values = [float(value) for value in raw_box]
    except (TypeError, ValueError):
        return None

    if len(values) != 4:
        return None

    if coordinate_order == "xyxy":
        raw_xmin, raw_ymin, raw_xmax, raw_ymax = values
    else:
        raw_ymin, raw_xmin, raw_ymax, raw_xmax = values

    if raw_ymin >= raw_ymax or raw_xmin >= raw_xmax:
        return None

    max_value = max(raw_ymin, raw_xmin, raw_ymax, raw_xmax)

    if 0 <= min(raw_ymin, raw_xmin, raw_ymax, raw_xmax) and max_value <= 1:
        ymin, xmin, ymax, xmax = raw_ymin, raw_xmin, raw_ymax, raw_xmax
    elif coordinate_order == "yxyx" and max_value <= 1000:
        ymin, xmin, ymax, xmax = raw_ymin / 1000.0, raw_xmin / 1000.0, raw_ymax / 1000.0, raw_xmax / 1000.0
    elif image_size is not None:
        image_width, image_height = image_size
        if image_width <= 0 or image_height <= 0:
            return None
        ymin, xmin, ymax, xmax = (
            raw_ymin / image_height,
            raw_xmin / image_width,
            raw_ymax / image_height,
            raw_xmax / image_width,
        )
    elif max_value <= 1000:
        ymin, xmin, ymax, xmax = raw_ymin / 1000.0, raw_xmin / 1000.0, raw_ymax / 1000.0, raw_xmax / 1000.0
    else:
        return None

    ymin = round(max(0.0, min(1.0, ymin)), 4)
    xmin = round(max(0.0, min(1.0, xmin)), 4)
    ymax = round(max(0.0, min(1.0, ymax)), 4)
    xmax = round(max(0.0, min(1.0, xmax)), 4)

    if ymin >= ymax or xmin >= xmax:
        return None

    width = xmax - xmin
    height = ymax - ymin
    is_full_frame = ymin <= 0.025 and xmin <= 0.025 and ymax >= 0.975 and xmax >= 0.975
    if is_full_frame or width * height >= 0.90:
        return None

    return [ymin, xmin, ymax, xmax]


def _normalize_provider_grounding_boxes(
    raw_boxes: Any,
    *,
    coordinate_order: CoordinateOrder,
    image_size: tuple[int, int] | None,
) -> list[GroundingBox]:
    if isinstance(raw_boxes, list) and len(raw_boxes) == 4 and all(isinstance(value, (int, float, str)) for value in raw_boxes):
        normalized_box = _normalize_coordinate_box(
            raw_box=raw_boxes,
            coordinate_order=coordinate_order,
            image_size=image_size,
        )
        return [{"label": "object", "box": normalized_box}] if normalized_box is not None else []

    if isinstance(raw_boxes, dict):
        if "box_2d" in raw_boxes:
            candidate_boxes = [raw_boxes]
        else:
            candidate_boxes = (
                raw_boxes.get("objects")
                or raw_boxes.get("bounding_boxes")
                or raw_boxes.get("boxes")
                or raw_boxes.get("detections")
                or []
            )
    else:
        candidate_boxes = raw_boxes

    if not isinstance(candidate_boxes, list):
        return []

    normalized_boxes: list[GroundingBox] = []
    for index, item in enumerate(candidate_boxes):
        if not isinstance(item, dict):
            continue

        if "bbox" in item:
            raw_box = item.get("bbox")
            raw_coordinate_order: CoordinateOrder = "xyxy"
        elif "box_2d" in item:
            raw_box = item.get("box_2d")
            raw_coordinate_order = "yxyx"
        else:
            raw_box = item.get("box")
            raw_coordinate_order = coordinate_order

        if not isinstance(raw_box, list) or len(raw_box) != 4:
            continue

        normalized_box = _normalize_coordinate_box(
            raw_box=raw_box,
            coordinate_order=raw_coordinate_order,
            image_size=image_size,
        )
        if normalized_box is None:
            continue

        label = str(item.get("label") or f"object {index + 1}").strip()
        if not label:
            label = f"object {index + 1}"

        normalized_boxes.append(
            {
                "label": label,
                "box": normalized_box,
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
        candidate_boxes = (
            raw_boxes.get("objects")
            or raw_boxes.get("bounding_boxes")
            or raw_boxes.get("boxes")
            or raw_boxes.get("detections")
            or []
        )
    else:
        candidate_boxes = raw_boxes

    return candidate_boxes if isinstance(candidate_boxes, list) else []


def _log_grounding_box_debug(raw_boxes: Any, normalized_boxes: list[GroundingBox]) -> None:
    raw_candidates = _candidate_grounding_boxes(raw_boxes)
    print("[SatQuery Grounding] box count:", _box_count_label(len(normalized_boxes)))

    if not normalized_boxes:
        print("[SatQuery Grounding] raw provider box:", [])
        print("[SatQuery Grounding] normalized 0-1 box:", [])
        print("[SatQuery Grounding] label:", "")
        return

    for index, normalized_box in enumerate(normalized_boxes):
        raw_box = []
        if index < len(raw_candidates) and isinstance(raw_candidates[index], dict):
            raw_box = raw_candidates[index].get("box_2d") or raw_candidates[index].get("box") or raw_candidates[index].get("bbox") or []
        print("[SatQuery Grounding] raw provider box:", raw_box)
        print("[SatQuery Grounding] normalized 0-1 box:", normalized_box["box"])
        print("[SatQuery Grounding] label:", normalized_box["label"])


def ground_image_with_gemini(image_path: str, user_query: str) -> GroundingResponse:
    total_started_at = time.perf_counter()
    image_file = Path(image_path)
    provider = get_grounding_provider()
    image_size = _image_size(image_file)
    prompt = (
        "Locate only the object or region requested by the user in this image. "
        "Return precise bounding boxes around the requested visible object. "
        "Do not return a box covering the entire image unless the user's requested object "
        "genuinely occupies the entire image. If the requested object is not clearly visible, "
        "return no bounding box. Return ONLY strict JSON. For OpenRouter/Qwen return this shape: "
        '{"objects":[{"label":"requested object","bbox":[x1,y1,x2,y2]}]}. '
        "Coordinates may be normalized 0..1 or image pixel coordinates.\n\n"
        f"User request: {user_query}"
    )

    try:
        api_started_at = time.perf_counter()
        output_text = provider.ground_image(
            image_file,
            prompt,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": _grounding_schema(),
            },
        )
        print("[SatQuery Grounding] provider API latency:", f"{time.perf_counter() - api_started_at:.3f}s")
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

    normalized_boxes = _normalize_provider_grounding_boxes(
        raw_boxes,
        coordinate_order=provider.coordinate_order,
        image_size=image_size,
    )
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
