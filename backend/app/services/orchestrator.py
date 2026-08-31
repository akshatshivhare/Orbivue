import asyncio
import time
from dataclasses import dataclass
from typing import Any, Literal

from .cross_modal import analyze_cross_modal
from .gemini_client import GeminiAnalysisError
from .image_analysis import analyze_image_with_gemini
from .temporal_change import analyze_change_with_gemini
from .visual_grounding import ground_image_with_gemini

InputMode = Literal["single_image", "temporal", "cross_modal"]
SingleImageIntent = Literal["analysis", "grounding", "analysis_and_grounding"]
PlanStep = Literal["analysis", "grounding", "temporal", "cross_modal"]


class OrchestrationValidationError(ValueError):
    pass


@dataclass(frozen=True)
class InputConfiguration:
    mode: InputMode
    reason: str


@dataclass(frozen=True)
class ExecutionPlan:
    input_mode: InputMode
    intent: SingleImageIntent | Literal["change_analysis", "cross_modal_analysis"]
    selected_route: str
    reason: str
    steps: list[PlanStep]


def classify_input_configuration(
    *,
    has_image: bool,
    has_image_t1: bool,
    has_image_t2: bool,
    has_optical_image: bool,
    has_sar_image: bool,
) -> InputConfiguration:
    single_count = int(has_image)
    temporal_count = int(has_image_t1) + int(has_image_t2)
    cross_modal_count = int(has_optical_image) + int(has_sar_image)
    active_groups = sum(
        [
            single_count > 0,
            temporal_count > 0,
            cross_modal_count > 0,
        ]
    )

    if active_groups == 0:
        raise OrchestrationValidationError(
            "Attach exactly one valid input set: image, image_t1 + image_t2, or optical_image + sar_image."
        )

    if active_groups > 1:
        raise OrchestrationValidationError(
            "Ambiguous input combination. Use only one input set at a time: single image, temporal pair, or Optical + SAR pair."
        )

    if has_image:
        return InputConfiguration("single_image", "Single image input detected.")

    if temporal_count:
        if not (has_image_t1 and has_image_t2):
            raise OrchestrationValidationError("Temporal analysis requires both image_t1 and image_t2.")
        return InputConfiguration("temporal", "Bi-temporal T1/T2 pair detected.")

    if cross_modal_count:
        if not (has_optical_image and has_sar_image):
            raise OrchestrationValidationError("Cross-modal analysis requires both optical_image and sar_image.")
        return InputConfiguration("cross_modal", "Optical and SAR pair detected.")

    raise OrchestrationValidationError("Unsupported input configuration.")


def classify_single_image_intent(query: str) -> SingleImageIntent:
    normalized_query = _normalize_query(query)
    has_analysis = _has_analysis_intent(normalized_query)
    has_grounding = _has_grounding_intent(normalized_query)

    if has_analysis and has_grounding:
        return "analysis_and_grounding"
    if has_grounding:
        return "grounding"
    return "analysis"


def build_execution_plan(query: str, input_configuration: InputConfiguration) -> ExecutionPlan:
    if input_configuration.mode == "cross_modal":
        return ExecutionPlan(
            input_mode="cross_modal",
            intent="cross_modal_analysis",
            selected_route="cross_modal",
            reason=input_configuration.reason,
            steps=["cross_modal"],
        )

    if input_configuration.mode == "temporal":
        return ExecutionPlan(
            input_mode="temporal",
            intent="change_analysis",
            selected_route="temporal",
            reason=input_configuration.reason,
            steps=["temporal"],
        )

    intent = classify_single_image_intent(query)
    if intent == "analysis_and_grounding":
        return ExecutionPlan(
            input_mode="single_image",
            intent=intent,
            selected_route="analysis+grounding",
            reason="Query requests both scene analysis and spatial localization.",
            steps=["analysis", "grounding"],
        )

    if intent == "grounding":
        return ExecutionPlan(
            input_mode="single_image",
            intent=intent,
            selected_route="grounding",
            reason="Single image with spatial localization intent.",
            steps=["grounding"],
        )

    return ExecutionPlan(
        input_mode="single_image",
        intent="analysis",
        selected_route="analysis",
        reason="Single image with general visual analysis intent.",
        steps=["analysis"],
    )


async def execute_plan(
    *,
    plan: ExecutionPlan,
    query: str,
    image_path: str | None = None,
    image_t1_path: str | None = None,
    image_t2_path: str | None = None,
    optical_image_path: str | None = None,
    sar_image_path: str | None = None,
) -> dict[str, Any]:
    started_at = time.perf_counter()
    print("[OrbiVue Orchestrator] input mode:", plan.input_mode)
    print("[OrbiVue Orchestrator] intent:", plan.intent)
    print("[OrbiVue Orchestrator] plan:", " -> ".join(plan.steps))

    try:
        if plan.steps == ["analysis"]:
            final_answer = await _run_analysis(image_path, query)
            return _base_response(plan, final_answer=final_answer, bounding_boxes=[])

        if plan.steps == ["grounding"]:
            grounding = await _run_grounding(image_path, query)
            return _base_response(
                plan,
                final_answer=str(grounding.get("final_answer", "")),
                bounding_boxes=grounding.get("bounding_boxes", []),
            )

        if plan.steps == ["analysis", "grounding"]:
            warnings: list[str] = []
            analysis_answer = ""
            grounding_answer = ""
            bounding_boxes: Any = []

            try:
                analysis_answer = await _run_analysis(image_path, query)
            except GeminiAnalysisError as error:
                warnings.append(f"analysis failed: {error.user_message}")

            try:
                grounding = await _run_grounding(image_path, query)
                grounding_answer = str(grounding.get("final_answer", ""))
                bounding_boxes = grounding.get("bounding_boxes", [])
            except GeminiAnalysisError as error:
                warnings.append(f"grounding failed: {error.user_message}")

            if not analysis_answer and not grounding_answer:
                raise GeminiAnalysisError(
                    "Both analysis and grounding specialists failed.",
                    error_type="orchestration_multi_tool_failed",
                    user_message="The selected analysis and grounding tools could not complete. Please try again.",
                )

            response = _base_response(
                plan,
                final_answer=_combine_analysis_and_grounding(analysis_answer, grounding_answer),
                bounding_boxes=bounding_boxes,
            )
            if warnings:
                response["warnings"] = warnings
            return response

        if plan.steps == ["temporal"]:
            print("[OrbiVue Orchestrator] executing: temporal")
            if not image_t1_path or not image_t2_path:
                raise OrchestrationValidationError("Temporal execution requires both saved image_t1 and image_t2 paths.")
            temporal = await asyncio.to_thread(analyze_change_with_gemini, image_t1_path, image_t2_path, query)
            return _base_response(plan, final_answer=str(temporal.get("final_answer", "")))

        if plan.steps == ["cross_modal"]:
            print("[OrbiVue Orchestrator] executing: cross_modal")
            if not optical_image_path or not sar_image_path:
                raise OrchestrationValidationError("Cross-modal execution requires both saved optical and SAR image paths.")
            cross_modal = await analyze_cross_modal(optical_image_path, sar_image_path, query)
            return _base_response(plan, final_answer=str(cross_modal.get("final_answer", "")))

        raise GeminiAnalysisError(
            f"Unsupported orchestration plan: {plan.steps}",
            error_type="unsupported_orchestration_plan",
            user_message="The orchestrator could not execute the selected plan.",
        )
    finally:
        print("[OrbiVue Orchestrator] total latency:", f"{time.perf_counter() - started_at:.3f}s")


def _base_response(
    plan: ExecutionPlan,
    *,
    final_answer: str,
    bounding_boxes: Any | None = None,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "mode": "orchestrated",
        "selected_route": plan.selected_route,
        "tools_used": plan.steps,
        "reason": plan.reason,
        "final_answer": final_answer,
    }
    if bounding_boxes is not None:
        response["bounding_boxes"] = bounding_boxes
    return response


async def _run_analysis(image_path: str | None, query: str) -> str:
    print("[OrbiVue Orchestrator] executing: analysis")
    if not image_path:
        raise OrchestrationValidationError("Analysis execution requires a saved image path.")
    return await asyncio.to_thread(analyze_image_with_gemini, image_path, query)


async def _run_grounding(image_path: str | None, query: str) -> dict[str, Any]:
    print("[OrbiVue Orchestrator] executing: grounding")
    if not image_path:
        raise OrchestrationValidationError("Grounding execution requires a saved image path.")
    return await asyncio.to_thread(ground_image_with_gemini, image_path, query)


def _combine_analysis_and_grounding(analysis_answer: str, grounding_answer: str) -> str:
    parts: list[str] = []
    if analysis_answer.strip():
        parts.append(f"Analysis:\n{analysis_answer.strip()}")
    if grounding_answer.strip():
        parts.append(f"Grounding:\n{grounding_answer.strip()}")
    return "\n\n".join(parts)


def _normalize_query(query: str) -> str:
    return " ".join(query.strip().casefold().split())


def _has_analysis_intent(query: str) -> bool:
    analysis_markers = (
        "describe",
        "explain",
        "what is visible",
        "what can you see",
        "what do you see",
        "analyze",
        "summarize this area",
        "summarise this area",
        "what type of",
        "is there",
        "what features",
        "scene description",
        "overview",
        "tell me about",
    )
    return any(marker in query for marker in analysis_markers)


def _has_grounding_intent(query: str) -> bool:
    if any(
        marker in query
        for marker in (
            "locate",
            "highlight",
            "show me",
            "show the",
            "mark",
            "where is",
            "where are",
            "identify the location of",
            "identify the position of",
            "draw a box",
            "bounding box",
            "point out",
            "kaha",
            "कहा",
            "कहाँ",
        )
    ):
        return True

    if "find" in query and not any(marker in query for marker in ("find out", "find whether", "find if")):
        return True

    if "detect" in query and not any(marker in query for marker in ("detect changes", "change detection")):
        return True

    return False
