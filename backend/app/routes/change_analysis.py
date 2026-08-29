import asyncio
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile

from ..services.gemini_client import GeminiAnalysisError
from ..services.temporal_change import analyze_change_with_gemini
from ..utils.image_utils import save_upload_to_temp

router = APIRouter()


def _change_error_response(error: Exception) -> dict[str, Any]:
    user_message = getattr(
        error,
        "user_message",
        "Gemini change analysis could not be completed. Please try again.",
    )
    return {
        "mode": "change_analysis",
        "summary": user_message,
        "final_answer": user_message,
        "changes": [],
        "unchanged": [],
        "limitations": [],
        "change_map": None,
        "error": str(error),
    }


@router.post("/api/change-analyze")
async def change_analyze(
    image_t1: UploadFile = File(...),
    image_t2: UploadFile = File(...),
    query: str = Form(default="", max_length=600),
    date_t1: str | None = Form(default=None),
    date_t2: str | None = Form(default=None),
) -> dict[str, Any]:
    request_started_at = time.perf_counter()
    temp_paths: list[str] = []

    try:
        save_started_at = time.perf_counter()
        saved_t1 = await save_upload_to_temp(image_t1, "T1 / BEFORE")
        saved_t2 = await save_upload_to_temp(image_t2, "T2 / AFTER")
        temp_paths.extend([saved_t1.path, saved_t2.path])
        print("[SatQuery Change] image save:", f"{time.perf_counter() - save_started_at:.3f}s")

        if (
            saved_t1.filename == saved_t2.filename
            and len(saved_t1.content) == len(saved_t2.content)
            and saved_t1.content == saved_t2.content
        ):
            print("[SatQuery Change] identical input files: true")

        try:
            result = await asyncio.to_thread(
                analyze_change_with_gemini,
                saved_t1.path,
                saved_t2.path,
                query,
                date_t1,
                date_t2,
            )
        except GeminiAnalysisError as error:
            print("[SatQuery Change] error type:", error.error_type)
            print("[SatQuery Change] error:", repr(error))
            result = _change_error_response(error)
        except Exception as error:
            print("[SatQuery Change] error type:", type(error).__name__)
            print("[SatQuery Change] error:", repr(error))
            result = _change_error_response(error)
    finally:
        for temp_path in temp_paths:
            Path(temp_path).unlink(missing_ok=True)

    print("[SatQuery Change] endpoint total latency:", f"{time.perf_counter() - request_started_at:.3f}s")
    return result
