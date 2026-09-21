import time
from pathlib import Path
from typing import Any

from ..schemas.change_analysis import ChangeAnalysisResponse, ChangeDirection, ChangeGuardMetadata, ChangeItem
from .gemini_client import (
    GeminiAnalysisError,
    error_type,
    parse_json_output,
    raise_user_facing_gemini_error,
)
from .providers import get_temporal_provider
from .response_language import language_instruction

ALLOWED_DIRECTIONS: set[str] = {
    "increased",
    "decreased",
    "appeared",
    "disappeared",
    "expanded",
    "contracted",
    "reduced",
    "altered",
    "modified",
    "unchanged",
    "uncertain",
}

ALLOWED_OBSERVABILITY: set[str] = {
    "clearly_visible",
    "possible",
    "not_reliably_observable",
}


def _normalize_confidence(value: Any) -> float | None:
    if value is None:
        return None

    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return None
    return round(max(0.0, min(1.0, confidence)), 3)


def _normalize_change_direction(value: Any) -> ChangeDirection:
    direction = str(value or "uncertain").strip().casefold()
    if direction in ALLOWED_DIRECTIONS:
        return direction  # type: ignore[return-value]
    return "uncertain"


def _normalize_observability(value: Any) -> str | None:
    observability = str(value or "").strip().casefold()
    return observability if observability in ALLOWED_OBSERVABILITY else None


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _normalize_optional_float(value: Any) -> float | None:
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_change_guard(value: Any) -> ChangeGuardMetadata | None:
    if not isinstance(value, dict):
        return None

    guard: ChangeGuardMetadata = {}
    for key in (
        "status",
        "semantic_verification",
        "normalization_method",
        "alignment_warning",
    ):
        raw_value = value.get(key)
        if raw_value is None and key == "alignment_warning":
            guard[key] = None  # type: ignore[literal-required]
        elif isinstance(raw_value, str) and raw_value.strip():
            guard[key] = raw_value.strip()  # type: ignore[literal-required]

    for key in ("qwen_called", "exact_match", "dimension_normalized"):
        raw_value = value.get(key)
        if isinstance(raw_value, bool):
            guard[key] = raw_value  # type: ignore[literal-required]

    for key in (
        "mean_absolute_difference",
        "changed_pixel_fraction",
        "pixel_change_threshold",
        "near_identical_mean_threshold",
        "near_identical_fraction_threshold",
        "aspect_ratio_t1",
        "aspect_ratio_t2",
        "aspect_ratio_relative_difference",
    ):
        if key in value:
            guard[key] = _normalize_optional_float(value.get(key))  # type: ignore[literal-required]

    for key in ("original_size_t1", "original_size_t2", "comparison_size"):
        raw_value = value.get(key)
        if (
            isinstance(raw_value, list)
            and len(raw_value) == 2
            and all(isinstance(item, int) for item in raw_value)
        ):
            guard[key] = raw_value  # type: ignore[literal-required]

    return guard or None


def _normalize_change_response(raw_response: Any, *, is_follow_up: bool) -> ChangeAnalysisResponse:
    if isinstance(raw_response, list):
        raw_response = raw_response[0] if raw_response and isinstance(raw_response[0], dict) else {}

    if not isinstance(raw_response, dict):
        raw_response = {}

    raw_changes = raw_response.get("changes") or []
    changes: list[ChangeItem] = []
    if isinstance(raw_changes, list):
        for index, item in enumerate(raw_changes):
            if not isinstance(item, dict):
                continue
            description = str(item.get("description") or "").strip()
            change = str(item.get("change") or "").strip()
            if not description:
                description = change
            if not description:
                continue
            category = str(item.get("category") or f"change {index + 1}").strip()
            normalized_item: ChangeItem = {
                "category": category,
                "description": description,
                "direction": _normalize_change_direction(item.get("direction")),
            }
            confidence = _normalize_confidence(item.get("confidence"))
            if confidence is not None:
                normalized_item["confidence"] = confidence
            if change:
                normalized_item["change"] = change
            location = str(item.get("location") or "").strip()
            if location:
                normalized_item["location"] = location
            observability = _normalize_observability(item.get("observability"))
            if observability:
                normalized_item["observability"] = observability  # type: ignore[typeddict-item]
            changes.append(normalized_item)

    summary = str(
        raw_response.get("summary")
        or raw_response.get("final_answer")
        or raw_response.get("answer")
        or raw_response.get("description")
        or ""
    ).strip()

    if not summary:
        summary = (
            "No significant visual change was confidently detected between T1 and T2."
            if not changes
            else "Visible changes were detected between T1 and T2."
        )

    final_answer = str(raw_response.get("final_answer") or raw_response.get("answer") or summary).strip()
    if not final_answer:
        final_answer = summary

    unchanged = _normalize_string_list(raw_response.get("unchanged"))
    unchanged_features = _normalize_string_list(raw_response.get("unchanged_features"))
    possible_imaging_effects = _normalize_string_list(raw_response.get("possible_imaging_effects"))
    response: ChangeAnalysisResponse = {
        "mode": "change_vqa" if is_follow_up else "change_analysis",
        "summary": summary,
        "final_answer": final_answer,
        "changes": changes,
        "unchanged": unchanged_features or unchanged,
        "limitations": _normalize_string_list(raw_response.get("limitations")),
        "change_map": None,
    }
    if unchanged_features:
        response["unchanged_features"] = unchanged_features
    if possible_imaging_effects:
        response["possible_imaging_effects"] = possible_imaging_effects
    change_guard = _normalize_change_guard(raw_response.get("change_guard"))
    if change_guard is not None:
        response["change_guard"] = change_guard

    return response


def _build_temporal_prompt(
    *,
    query: str,
    date_t1: str | None,
    date_t2: str | None,
    is_follow_up: bool,
    response_language: str = "en",
) -> str:
    t1_label = f"T1 / BEFORE / earlier reference image{f' ({date_t1})' if date_t1 else ''}"
    t2_label = f"T2 / AFTER / later comparison image{f' ({date_t2})' if date_t2 else ''}"
    prompt = (
        "You are the temporal Earth-observation analysis component of OrbiVue.\n\n"
        f"{language_instruction(response_language)} Translate only user-facing string fields such as summary, final_answer, descriptions, unchanged_features, possible_imaging_effects, and limitations. Keep enum/schema values unchanged.\n\n"
        "You are given two images of the same or approximately the same geographic location captured at different times.\n"
        f"IMAGE 1 is {t1_label}.\n"
        f"IMAGE 2 is {t2_label}.\n\n"
        "Compare IMAGE 2 / T2 / AFTER against IMAGE 1 / T1 / BEFORE. Never reverse the direction.\n"
        "Identify only visually supported changes. Evaluate built environment, roads/infrastructure, "
        "vegetation or land cover, water features, bare land, construction, agricultural patterns, terrain, "
        "large objects, and landscape disturbance.\n"
        "Distinguish real change from differences caused by resolution, zoom, crop, viewing angle, lighting, "
        "season, cloud cover, shadow, image quality, or color correction. Do not invent precise percentages, "
        "physical land area, causes, or damage. If a category has no supported visible change, do not include "
        "it in changes; mention it only if useful as an unchanged feature or limitation.\n\n"
        "For every reported change, classify observability as one of: clearly_visible, possible, "
        "not_reliably_observable. Use not_reliably_observable when the images do not support a reliable "
        "semantic conclusion.\n\n"
        "Return ONE strict JSON object only with this schema:\n"
        "{\n"
        '  "mode": "change_analysis" or "change_vqa",\n'
        '  "summary": "2-4 sentence overall change summary.",\n'
        '  "final_answer": "Direct answer for the user, concise and cautious.",\n'
        '  "changes": [\n'
        '    {\n'
        '      "category": "Built environment | Vegetation | Water | Road / infrastructure | Buildings / structures | Bare land | Other visible change",\n'
        '      "change": "Short label for what changed.",\n'
        '      "description": "Careful visual description without unsupported area claims.",\n'
        '      "direction": "appeared|disappeared|increased|decreased|expanded|contracted|altered|modified|unchanged|uncertain",\n'
        '      "location": "upper-left / central / lower-right / etc., or not reliably observable",\n'
        '      "observability": "clearly_visible|possible|not_reliably_observable"\n'
        '    }\n'
        '  ],\n'
        '  "unchanged_features": ["..."],\n'
        '  "possible_imaging_effects": ["cloud differences", "illumination differences"],\n'
        '  "limitations": ["..."],\n'
        '  "change_map": null\n'
        "}\n"
        "Do not include confidence scores unless the model has a real calibrated value, which it usually does not.\n"
    )

    if is_follow_up:
        return (
            f"{prompt}\nAnswer this follow-up change question using BOTH images and the T2-relative-to-T1 comparison:\n{query}"
        )

    return f"{prompt}\nProvide the initial concise temporal change analysis."


def analyze_change_with_gemini(
    image_t1_path: str,
    image_t2_path: str,
    user_query: str | None = None,
    date_t1: str | None = None,
    date_t2: str | None = None,
    response_language: str = "en",
) -> ChangeAnalysisResponse:
    total_started_at = time.perf_counter()
    image_t1 = Path(image_t1_path)
    image_t2 = Path(image_t2_path)
    query_text = (user_query or "").strip()
    is_follow_up = bool(query_text)
    t1_bytes = image_t1.read_bytes()
    t2_bytes = image_t2.read_bytes()
    provider = get_temporal_provider()
    prompt = _build_temporal_prompt(
        query=query_text,
        date_t1=date_t1,
        date_t2=date_t2,
        is_follow_up=is_follow_up,
        response_language=response_language,
    )

    try:
        api_started_at = time.perf_counter()
        print("[SatQuery Change] provider:", provider.name)
        print("[SatQuery Change] model:", provider.model)
        print("[SatQuery Change] T1 bytes:", len(t1_bytes))
        print("[SatQuery Change] T2 bytes:", len(t2_bytes))
        print("[SatQuery Change] query:", query_text)
        output_text = provider.analyze_temporal(image_t1, image_t2, prompt)
        print("[SatQuery Change] api latency:", f"{time.perf_counter() - api_started_at:.3f}s")
    except GeminiAnalysisError:
        print("[SatQuery Change] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
        raise
    except Exception as error:
        print("[SatQuery Change] error type:", error_type(error))
        print("[SatQuery Change] error:", repr(error))
        print("[SatQuery Change] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
        raise_user_facing_gemini_error(
            error,
            "Gemini change analysis could not be completed. Please try again.",
        )

    normalization_started_at = time.perf_counter()
    try:
        parsed = parse_json_output(output_text) if isinstance(output_text, str) else {}
    except Exception as error:
        print("[SatQuery Change] normalization error:", repr(error))
        parsed = {
            "summary": output_text.strip() if isinstance(output_text, str) else "",
            "final_answer": output_text.strip() if isinstance(output_text, str) else "",
            "changes": [],
            "unchanged": [],
            "limitations": [f"{provider.name} did not return parseable structured JSON."],
        }

    normalized = _normalize_change_response(parsed, is_follow_up=is_follow_up)
    print("[SatQuery Change] normalization:", f"{time.perf_counter() - normalization_started_at:.3f}s")
    print("[SatQuery Change] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
    return normalized
