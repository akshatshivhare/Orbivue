"""Deterministic image-space guard for recovered OrbiVue temporal analysis."""

from __future__ import annotations

from collections.abc import Callable
from types import ModuleType
from typing import Any

import numpy as np
from PIL import Image


PIXEL_CHANGE_THRESHOLD = 0.02
NEAR_IDENTICAL_MEAN_THRESHOLD = 0.005
NEAR_IDENTICAL_FRACTION_THRESHOLD = 0.005
ASPECT_RATIO_RELATIVE_TOLERANCE = 0.02
DIMENSION_NORMALIZATION_WARNING = (
    "Images had different pixel dimensions and were normalized to a common "
    "resolution for image-space comparison. This does not establish geospatial "
    "registration."
)

NO_SIGNIFICANT_VISIBLE_CHANGE = (
    "No significant visible change was detected between the two images."
)

INCOMPATIBLE_DIMENSIONS = (
    "Reliable change analysis could not be performed because the two images "
    "have different dimensions."
)

MODEL_GENERATED_NOTE = (
    "The model-generated semantic description has not been independently "
    "verified."
)

GuardedTemporalFn = Callable[[Image.Image, Image.Image, str], dict[str, Any]]


def _change_guard_metadata(
    *,
    status: str,
    qwen_called: bool,
    exact_match: bool,
    mean_absolute_difference: float | None,
    changed_pixel_fraction: float | None,
    semantic_verification: str,
    original_size_t1: tuple[int, int],
    original_size_t2: tuple[int, int],
    comparison_size: tuple[int, int],
    dimension_normalized: bool,
    normalization_method: str,
    aspect_ratio_t1: float,
    aspect_ratio_t2: float,
    aspect_ratio_relative_difference: float,
    alignment_warning: str | None,
) -> dict[str, Any]:
    return {
        "status": status,
        "qwen_called": qwen_called,
        "exact_match": exact_match,
        "mean_absolute_difference": mean_absolute_difference,
        "changed_pixel_fraction": changed_pixel_fraction,
        "pixel_change_threshold": PIXEL_CHANGE_THRESHOLD,
        "near_identical_mean_threshold": NEAR_IDENTICAL_MEAN_THRESHOLD,
        "near_identical_fraction_threshold": NEAR_IDENTICAL_FRACTION_THRESHOLD,
        "semantic_verification": semantic_verification,
        "original_size_t1": list(original_size_t1),
        "original_size_t2": list(original_size_t2),
        "comparison_size": list(comparison_size),
        "dimension_normalized": dimension_normalized,
        "normalization_method": normalization_method,
        "aspect_ratio_t1": aspect_ratio_t1,
        "aspect_ratio_t2": aspect_ratio_t2,
        "aspect_ratio_relative_difference": aspect_ratio_relative_difference,
        "alignment_warning": alignment_warning,
    }


def _with_change_guard(
    result: Any,
    change_guard: dict[str, Any],
    *,
    append_model_note: bool = False,
) -> dict[str, Any]:
    if isinstance(result, dict):
        response = dict(result)
    else:
        response = {
            "mode": "temporal",
            "final_answer": str(result),
        }

    if append_model_note and response.get("final_answer"):
        final_answer = str(response["final_answer"]).strip()
        notes = []
        if MODEL_GENERATED_NOTE not in final_answer:
            notes.append(MODEL_GENERATED_NOTE)
        alignment_warning = change_guard.get("alignment_warning")
        if isinstance(alignment_warning, str) and alignment_warning and alignment_warning not in final_answer:
            notes.append(alignment_warning)
        if notes:
            response["final_answer"] = f"{final_answer}\n\nNote: {' '.join(notes)}"

    response["change_guard"] = change_guard
    return response


def compare_temporal_images(
    before: Image.Image,
    after: Image.Image,
) -> tuple[Image.Image, Image.Image, dict[str, Any]]:
    """Compare RGB images without interpreting physical change."""

    before_rgb = before.convert("RGB")
    after_rgb = after.convert("RGB")
    original_size_t1 = before_rgb.size
    original_size_t2 = after_rgb.size
    aspect_ratio_t1 = _aspect_ratio(original_size_t1)
    aspect_ratio_t2 = _aspect_ratio(original_size_t2)
    aspect_ratio_relative_difference = _relative_aspect_ratio_difference(
        aspect_ratio_t1,
        aspect_ratio_t2,
    )
    dimension_normalized = False
    normalization_method = "none"
    alignment_warning = None
    comparison_after_rgb = after_rgb

    if before_rgb.size != after_rgb.size:
        if aspect_ratio_relative_difference > ASPECT_RATIO_RELATIVE_TOLERANCE:
            guard = _change_guard_metadata(
                status="incompatible",
                qwen_called=False,
                exact_match=False,
                mean_absolute_difference=None,
                changed_pixel_fraction=None,
                semantic_verification="not_performed",
                original_size_t1=original_size_t1,
                original_size_t2=original_size_t2,
                comparison_size=before_rgb.size,
                dimension_normalized=False,
                normalization_method="none",
                aspect_ratio_t1=aspect_ratio_t1,
                aspect_ratio_t2=aspect_ratio_t2,
                aspect_ratio_relative_difference=aspect_ratio_relative_difference,
                alignment_warning=None,
            )
            guard["image_t1_size"] = list(before_rgb.size)
            guard["image_t2_size"] = list(after_rgb.size)
            return before_rgb, after_rgb, guard

        dimension_normalized = True
        normalization_method = "resize_t2_to_t1"
        alignment_warning = DIMENSION_NORMALIZATION_WARNING
        comparison_after_rgb = after_rgb.resize(before_rgb.size, Image.Resampling.BILINEAR)

    before_array = np.asarray(before_rgb)
    after_array = np.asarray(comparison_after_rgb)

    if np.array_equal(before_array, after_array):
        guard = _change_guard_metadata(
            status="no_measurable_change",
            qwen_called=False,
            exact_match=not dimension_normalized,
            mean_absolute_difference=0.0,
            changed_pixel_fraction=0.0,
            semantic_verification="deterministic_no_change",
            original_size_t1=original_size_t1,
            original_size_t2=original_size_t2,
            comparison_size=before_rgb.size,
            dimension_normalized=dimension_normalized,
            normalization_method=normalization_method,
            aspect_ratio_t1=aspect_ratio_t1,
            aspect_ratio_t2=aspect_ratio_t2,
            aspect_ratio_relative_difference=aspect_ratio_relative_difference,
            alignment_warning=alignment_warning,
        )
        guard["image_t1_size"] = list(before_rgb.size)
        guard["image_t2_size"] = list(after_rgb.size)
        return before_rgb, after_rgb, guard

    before_normalized = before_array.astype(np.float64) / 255.0
    after_normalized = after_array.astype(np.float64) / 255.0
    absolute_difference = np.abs(before_normalized - after_normalized)

    mean_absolute_difference = float(absolute_difference.mean())
    max_channel_difference = absolute_difference.max(axis=2)
    changed_pixel_fraction = float(
        np.count_nonzero(max_channel_difference > PIXEL_CHANGE_THRESHOLD)
        / max_channel_difference.size
    )

    if (
        mean_absolute_difference <= NEAR_IDENTICAL_MEAN_THRESHOLD
        and changed_pixel_fraction <= NEAR_IDENTICAL_FRACTION_THRESHOLD
    ):
        status = "no_measurable_change"
        qwen_called = False
        semantic_verification = "deterministic_no_change"
    else:
        status = "measurable_difference"
        qwen_called = True
        semantic_verification = "model_generated_unverified"

    guard = _change_guard_metadata(
        status=status,
        qwen_called=qwen_called,
        exact_match=False,
        mean_absolute_difference=mean_absolute_difference,
        changed_pixel_fraction=changed_pixel_fraction,
        semantic_verification=semantic_verification,
        original_size_t1=original_size_t1,
        original_size_t2=original_size_t2,
        comparison_size=before_rgb.size,
        dimension_normalized=dimension_normalized,
        normalization_method=normalization_method,
        aspect_ratio_t1=aspect_ratio_t1,
        aspect_ratio_t2=aspect_ratio_t2,
        aspect_ratio_relative_difference=aspect_ratio_relative_difference,
        alignment_warning=alignment_warning,
    )
    return before_rgb, after_rgb, guard


def _aspect_ratio(size: tuple[int, int]) -> float:
    width, height = size
    return float(width) / float(height)


def _relative_aspect_ratio_difference(aspect_ratio_t1: float, aspect_ratio_t2: float) -> float:
    denominator = max(abs(aspect_ratio_t1), abs(aspect_ratio_t2))
    return 0.0 if denominator == 0 else abs(aspect_ratio_t1 - aspect_ratio_t2) / denominator


def augment_temporal_query(query: str, change_guard: dict[str, Any]) -> str:
    normalized_warning = ""
    alignment_warning = change_guard.get("alignment_warning")
    if isinstance(alignment_warning, str) and alignment_warning:
        normalized_warning = f"{alignment_warning}\n\n"

    return (
        "The deterministic image comparison found measurable image-space "
        "pixel differences.\n"
        "Mean normalized absolute RGB difference: "
        f"{change_guard['mean_absolute_difference']:.12f}.\n"
        "Fraction of pixels exceeding the conservative difference threshold "
        f"({change_guard['pixel_change_threshold']:.6f}): "
        f"{change_guard['changed_pixel_fraction']:.12f}.\n\n"
        f"{normalized_warning}"
        "These pixel statistics do not represent real-world changed area. "
        "Only describe changes that are directly supported by comparing BOTH "
        "images. Do not invent objects, removals, additions, causes, damage, "
        "physical area, or land-use changes. Dimension normalization, if any, "
        "does not establish geospatial registration.\n\n"
        "Perform a careful visual comparison from IMAGE 1 / T1 / BEFORE to "
        "IMAGE 2 / T2 / AFTER. Evaluate these categories without forcing a "
        "change when evidence is weak:\n"
        "1. Overall change summary.\n"
        "2. Built environment changes: new/removed structures, visible "
        "expansion or contraction, roads, or infrastructure alterations.\n"
        "3. Vegetation / land-cover changes: vegetation gain/loss, bare "
        "ground, or agricultural pattern changes when visibly observable.\n"
        "4. Water changes: shoreline or water-extent changes only when "
        "clearly visible.\n"
        "5. Other visible differences: large objects, construction, or "
        "landscape disturbance.\n"
        "6. Potential non-semantic differences: cloud, shadow, illumination, "
        "season, image quality, or resolution.\n\n"
        "For each reported item distinguish one of: CLEARLY VISIBLE CHANGE, "
        "POSSIBLE CHANGE, NOT RELIABLY OBSERVABLE. If a category has no "
        "supported visible change, return \"None clearly observed\" in the "
        "summary or limitations rather than inventing a change.\n\n"
        "Return one strict JSON object using this directional schema:\n"
        "{\n"
        '  "mode": "change_analysis",\n'
        '  "summary": "2-4 sentence overall change summary.",\n'
        '  "final_answer": "Concise answer for the user.",\n'
        '  "changes": [\n'
        '    {\n'
        '      "category": "Built environment | Vegetation | Water | Road / infrastructure | Buildings / structures | Bare land | Other visible change",\n'
        '      "change": "Short change label.",\n'
        '      "description": "Careful visual description.",\n'
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
        "Do not include confidence scores unless a calibrated value is truly "
        "available. If structured JSON cannot fully express the result, keep "
        "the summary and final_answer accurate and cautious.\n\n"
        "Original user question:\n"
        f"{query}"
    )


def analyze_temporal_with_guard(
    before: Image.Image,
    after: Image.Image,
    query: str,
    original_analyze_temporal: GuardedTemporalFn,
) -> dict[str, Any]:
    before_rgb, after_rgb, change_guard = compare_temporal_images(before, after)

    if change_guard["status"] == "incompatible":
        return {
            "mode": "temporal",
            "final_answer": INCOMPATIBLE_DIMENSIONS,
            "change_guard": change_guard,
        }

    if change_guard["status"] == "no_measurable_change":
        return {
            "mode": "temporal",
            "final_answer": NO_SIGNIFICANT_VISIBLE_CHANGE,
            "change_guard": change_guard,
        }

    augmented_query = augment_temporal_query(query, change_guard)
    result = original_analyze_temporal(before_rgb, after_rgb, augmented_query)
    return _with_change_guard(result, change_guard, append_model_note=True)


def make_guarded_analyze_temporal(
    original_analyze_temporal: GuardedTemporalFn,
) -> GuardedTemporalFn:
    def guarded_analyze_temporal(
        image_t1: Image.Image,
        image_t2: Image.Image,
        query: str,
    ) -> dict[str, Any]:
        return analyze_temporal_with_guard(
            image_t1,
            image_t2,
            query,
            original_analyze_temporal,
        )

    guarded_analyze_temporal.__name__ = "guarded_analyze_temporal"
    setattr(guarded_analyze_temporal, "__orbivue_temporal_guard__", True)
    setattr(
        guarded_analyze_temporal,
        "__orbivue_original_analyze_temporal__",
        original_analyze_temporal,
    )
    return guarded_analyze_temporal


def install_temporal_guard(
    recovered_main: ModuleType,
    temporal_model: ModuleType | None = None,
) -> GuardedTemporalFn:
    """Patch recovered app.main's direct temporal reference in-place."""

    current = getattr(recovered_main, "analyze_temporal")
    if getattr(current, "__orbivue_temporal_guard__", False):
        return current

    original = getattr(
        recovered_main,
        "__orbivue_original_analyze_temporal__",
        current,
    )
    guarded = make_guarded_analyze_temporal(original)
    setattr(recovered_main, "__orbivue_original_analyze_temporal__", original)
    setattr(recovered_main, "analyze_temporal", guarded)

    if temporal_model is not None:
        setattr(temporal_model, "__orbivue_original_analyze_temporal__", original)
        setattr(temporal_model, "analyze_temporal", guarded)

    return guarded
