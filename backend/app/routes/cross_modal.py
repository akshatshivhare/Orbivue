import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile

from ..services.cross_modal import analyze_cross_modal as run_cross_modal_analysis
from ..services.gemini_client import GeminiAnalysisError
from ..utils.image_utils import save_upload_to_temp

router = APIRouter()


def _cross_modal_error_response(error: Exception) -> dict[str, str]:
    user_message = getattr(
        error,
        "user_message",
        "Cross-modal analysis could not be completed. Please try again.",
    )
    return {
        "mode": "cross_modal",
        "final_answer": user_message,
    }


@router.post("/api/cross-modal")
async def cross_modal(
    optical_image: UploadFile = File(...),
    sar_image: UploadFile = File(...),
    query: str = Form(..., min_length=1, max_length=600),
) -> dict[str, Any]:
    request_started_at = time.perf_counter()
    temp_paths: list[str] = []

    try:
        save_started_at = time.perf_counter()
        saved_optical = await save_upload_to_temp(optical_image, "Optical")
        saved_sar = await save_upload_to_temp(sar_image, "SAR")
        temp_paths.extend([saved_optical.path, saved_sar.path])
        print("[SatQuery CrossModal] image save:", f"{time.perf_counter() - save_started_at:.3f}s")
        print("[SatQuery CrossModal] optical bytes:", len(saved_optical.content))
        print("[SatQuery CrossModal] sar bytes:", len(saved_sar.content))

        try:
            result = await run_cross_modal_analysis(saved_optical.path, saved_sar.path, query)
        except GeminiAnalysisError as error:
            print("[SatQuery CrossModal] error type:", error.error_type)
            print("[SatQuery CrossModal] error:", repr(error))
            result = _cross_modal_error_response(error)
        except Exception as error:
            print("[SatQuery CrossModal] error type:", type(error).__name__)
            print("[SatQuery CrossModal] error:", repr(error))
            result = _cross_modal_error_response(error)
    finally:
        for temp_path in temp_paths:
            Path(temp_path).unlink(missing_ok=True)

    print("[SatQuery CrossModal] endpoint total latency:", f"{time.perf_counter() - request_started_at:.3f}s")
    return result
