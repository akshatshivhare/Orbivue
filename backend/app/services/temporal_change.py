import time
from pathlib import Path
from typing import Any

from ..config import GEMINI_ANALYSIS_MODEL
from ..schemas.change_analysis import ChangeAnalysisResponse, ChangeDirection, ChangeItem
from .gemini_client import (
    GeminiAnalysisError,
    create_gemini_interaction,
    encode_image_part,
    error_type,
    parse_json_output,
    raise_user_facing_gemini_error,
)

ALLOWED_DIRECTIONS: set[str] = {
    "increased",
    "decreased",
    "appeared",
    "disappeared",
    "modified",
    "unchanged",
    "uncertain",
}


def _normalize_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0
    return round(max(0.0, min(1.0, confidence)), 3)


def _normalize_change_direction(value: Any) -> ChangeDirection:
    direction = str(value or "uncertain").strip().casefold()
    if direction in ALLOWED_DIRECTIONS:
        return direction  # type: ignore[return-value]
    return "uncertain"


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


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
            if not description:
                continue
            category = str(item.get("category") or f"change {index + 1}").strip()
            changes.append(
                {
                    "category": category,
                    "description": description,
                    "direction": _normalize_change_direction(item.get("direction")),
                    "confidence": _normalize_confidence(item.get("confidence")),
                }
            )

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

    return {
        "mode": "change_vqa" if is_follow_up else "change_analysis",
        "summary": summary,
        "final_answer": final_answer,
        "changes": changes,
        "unchanged": _normalize_string_list(raw_response.get("unchanged")),
        "limitations": _normalize_string_list(raw_response.get("limitations")),
        "change_map": None,
    }


def _build_temporal_prompt(
    *,
    query: str,
    date_t1: str | None,
    date_t2: str | None,
    is_follow_up: bool,
) -> str:
    t1_label = f"T1 / BEFORE / earlier reference image{f' ({date_t1})' if date_t1 else ''}"
    t2_label = f"T2 / AFTER / later comparison image{f' ({date_t2})' if date_t2 else ''}"
    prompt = (
        "You are the temporal Earth-observation analysis component of OrbiVue.\n\n"
        "You are given two images of the same or approximately the same geographic location captured at different times.\n"
        f"IMAGE 1 is {t1_label}.\n"
        f"IMAGE 2 is {t2_label}.\n\n"
        "Compare IMAGE 2 / T2 / AFTER against IMAGE 1 / T1 / BEFORE. Never reverse the direction.\n"
        "Identify only visually supported changes. Pay attention to buildings, built-up area, roads, "
        "infrastructure, vegetation, water bodies, bare land, construction, urban expansion, agricultural "
        "patterns, terrain, land-cover differences, and other clearly visible significant changes.\n"
        "Distinguish real change from differences caused by resolution, zoom, crop, viewing angle, lighting, "
        "season, cloud cover, or color correction. Do not invent precise percentages. If alignment or image "
        "quality makes a conclusion uncertain, say so.\n\n"
        "Return ONE strict JSON object only with this schema:\n"
        "{\n"
        '  "mode": "change_analysis" or "change_vqa",\n'
        '  "summary": "Concise overall explanation.",\n'
        '  "final_answer": "Direct answer for the user.",\n'
        '  "changes": [{"category": "urbanization", "description": "...", "direction": "increased", "confidence": 0.91}],\n'
        '  "unchanged": ["..."],\n'
        '  "limitations": ["..."],\n'
        '  "change_map": null\n'
        "}\n"
        'Allowed direction values: "increased", "decreased", "appeared", "disappeared", "modified", "unchanged", "uncertain".\n'
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
) -> ChangeAnalysisResponse:
    total_started_at = time.perf_counter()
    image_t1 = Path(image_t1_path)
    image_t2 = Path(image_t2_path)
    query_text = (user_query or "").strip()
    is_follow_up = bool(query_text)
    t1_bytes = image_t1.read_bytes()
    t2_bytes = image_t2.read_bytes()
    prompt = _build_temporal_prompt(
        query=query_text,
        date_t1=date_t1,
        date_t2=date_t2,
        is_follow_up=is_follow_up,
    )

    try:
        api_started_at = time.perf_counter()
        print("[SatQuery Change] provider: Gemini")
        print("[SatQuery Change] model:", GEMINI_ANALYSIS_MODEL)
        print("[SatQuery Change] T1 bytes:", len(t1_bytes))
        print("[SatQuery Change] T2 bytes:", len(t2_bytes))
        print("[SatQuery Change] query:", query_text)
        interaction = create_gemini_interaction(
            input_parts=[
                {
                    "type": "text",
                    "text": "IMAGE 1 = T1 / BEFORE / earlier reference image.",
                },
                encode_image_part(image_t1),
                {
                    "type": "text",
                    "text": "IMAGE 2 = T2 / AFTER / later comparison image.",
                },
                encode_image_part(image_t2),
                {
                    "type": "text",
                    "text": prompt,
                },
            ],
            max_output_tokens=500,
        )
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

    output_text = getattr(interaction, "output_text", None)
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
            "limitations": ["Gemini did not return parseable structured JSON."],
        }

    normalized = _normalize_change_response(parsed, is_follow_up=is_follow_up)
    print("[SatQuery Change] normalization:", f"{time.perf_counter() - normalization_started_at:.3f}s")
    print("[SatQuery Change] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
    return normalized
