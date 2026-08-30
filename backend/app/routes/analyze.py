import asyncio
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..agent_router import route_query, route_vision_intent
from ..mapping_tools import generate_3d_terrain, generate_thermal_map
from ..services.gemini_client import GeminiAnalysisError
from ..services.image_analysis import analyze_image_with_gemini
from ..services.providers import get_vision_provider
from ..services.visual_grounding import ground_image_with_gemini
from ..utils.image_utils import save_upload_to_temp

router = APIRouter()


def _analysis_error_response(error: Exception) -> dict[str, Any]:
    user_message = getattr(
        error,
        "user_message",
        "Gemini analysis could not be completed. Please try again.",
    )
    return {
        "mode": "analysis",
        "final_answer": user_message,
        "bounding_boxes": [],
        "error": str(error),
    }


def _grounding_error_response(error: Exception) -> dict[str, Any]:
    user_message = getattr(
        error,
        "user_message",
        "Gemini grounding could not be completed. Please try again.",
    )
    return {
        "mode": "grounding",
        "final_answer": user_message,
        "bounding_boxes": [],
        "error": str(error),
    }


@router.post("/api/analyze")
async def analyze(
    query: str = Form(..., min_length=1, max_length=600),
    image: UploadFile | None = File(default=None),
) -> dict[str, Any]:
    request_started_at = time.perf_counter()
    temp_path = ""
    print("[SatQuery Timing] /api/analyze received")

    route_started_at = time.perf_counter()
    routing = await route_query(query)
    print("[SatQuery Timing] router:", f"{time.perf_counter() - route_started_at:.3f}s")
    selected_tool = routing["selected_tool"]
    analysis_mode = "analysis"
    final_answer = ""
    bounding_boxes: list[dict[str, Any]] = []

    try:
        if image is None or not image.filename:
            raise HTTPException(
                status_code=400,
                detail="An image file is required for the selected analysis workflow.",
            )

        save_started_at = time.perf_counter()
        saved = await save_upload_to_temp(image, "Single-image")
        temp_path = saved.path
        print(
            "[SatQuery Timing] image save:",
            f"{time.perf_counter() - save_started_at:.3f}s",
            f"({len(saved.content)} bytes)",
        )

        if selected_tool in {"VQA", "CHANGE_DETECTION"}:
            intent_started_at = time.perf_counter()
            vision_intent = await route_vision_intent(query)
            expected_mode = vision_intent["mode"]
            print("[SatQuery Router] mode:", expected_mode)
            print(
                "[SatQuery Timing] vision intent:",
                f"{time.perf_counter() - intent_started_at:.3f}s",
                vision_intent,
            )

            provider = get_vision_provider()
            if expected_mode == "analysis":
                print("[SatQuery Analysis] provider:", provider.name)
                print("[SatQuery Analysis] model:", provider.model)
                analysis_started_at = time.perf_counter()
                try:
                    final_answer = await asyncio.to_thread(
                        analyze_image_with_gemini,
                        temp_path,
                        query,
                    )
                except GeminiAnalysisError as error:
                    print("[SatQuery Analysis] error type:", error.error_type)
                    print("[SatQuery Analysis] error:", repr(error))
                    tool_output = _analysis_error_response(error)
                    final_answer = tool_output["final_answer"]
                except Exception as error:
                    print("[SatQuery Analysis] error type:", type(error).__name__)
                    print("[SatQuery Analysis] error:", repr(error))
                    tool_output = _analysis_error_response(error)
                    final_answer = tool_output["final_answer"]
                finally:
                    print(
                        "[SatQuery Analysis] latency:",
                        f"{time.perf_counter() - analysis_started_at:.3f}s",
                    )
                analysis_mode = "analysis"
                bounding_boxes = []
                print("[SatQuery Analysis] user query:", query)
                print("[SatQuery Analysis] final output:", final_answer)
            else:
                print("[SatQuery Grounding] provider:", provider.name)
                print("[SatQuery Grounding] model:", provider.model)
                print("[SatQuery Grounding] user query:", query)
                grounding_started_at = time.perf_counter()
                try:
                    tool_output = await asyncio.to_thread(
                        ground_image_with_gemini,
                        temp_path,
                        query,
                    )
                except GeminiAnalysisError as error:
                    print("[SatQuery Grounding] error type:", error.error_type)
                    print("[SatQuery Grounding] error:", repr(error))
                    tool_output = _grounding_error_response(error)
                except Exception as error:
                    print("[SatQuery Grounding] error type:", type(error).__name__)
                    print("[SatQuery Grounding] error:", repr(error))
                    tool_output = _grounding_error_response(error)
                finally:
                    print(
                        "[SatQuery Grounding] endpoint latency:",
                        f"{time.perf_counter() - grounding_started_at:.3f}s",
                    )

                analysis_mode = str(tool_output["mode"])
                final_answer = str(tool_output["final_answer"])
                bounding_boxes = tool_output["bounding_boxes"]
        elif selected_tool == "3D_MAP":
            tool_result = await generate_3d_terrain(temp_path)
            final_answer = str(tool_result.get("message", "3D terrain generation completed."))
            analysis_mode = "analysis"
            bounding_boxes = []
        elif selected_tool == "THERMAL_MAP":
            tool_result = await generate_thermal_map(temp_path)
            final_answer = str(tool_result.get("message", "Thermal map generation completed."))
            analysis_mode = "analysis"
            bounding_boxes = []
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported selected_tool: {selected_tool}")
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)

    response_payload = {
        "mode": analysis_mode,
        "final_answer": final_answer,
        "bounding_boxes": bounding_boxes,
    }
    print("[SatQuery Total] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
    return response_payload
