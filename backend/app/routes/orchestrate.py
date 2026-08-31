import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..services.gemini_client import GeminiAnalysisError
from ..services.orchestrator import (
    OrchestrationValidationError,
    build_execution_plan,
    classify_input_configuration,
    execute_plan,
)
from ..utils.image_utils import save_upload_to_temp

router = APIRouter()


@router.post("/api/orchestrate")
async def orchestrate(
    query: str = Form(..., min_length=1, max_length=600),
    image: UploadFile | None = File(default=None),
    image_t1: UploadFile | None = File(default=None),
    image_t2: UploadFile | None = File(default=None),
    optical_image: UploadFile | None = File(default=None),
    sar_image: UploadFile | None = File(default=None),
) -> dict[str, Any]:
    request_started_at = time.perf_counter()
    temp_paths: list[str] = []

    try:
        input_configuration = classify_input_configuration(
            has_image=_has_upload(image),
            has_image_t1=_has_upload(image_t1),
            has_image_t2=_has_upload(image_t2),
            has_optical_image=_has_upload(optical_image),
            has_sar_image=_has_upload(sar_image),
        )
        plan = build_execution_plan(query, input_configuration)

        saved_paths: dict[str, str] = {}
        save_started_at = time.perf_counter()

        if input_configuration.mode == "single_image":
            saved = await save_upload_to_temp(image, "Single-image")
            saved_paths["image_path"] = saved.path
            temp_paths.append(saved.path)
            print("[OrbiVue Orchestrator] single-image bytes:", len(saved.content))
        elif input_configuration.mode == "temporal":
            saved_t1 = await save_upload_to_temp(image_t1, "T1 / BEFORE")
            saved_t2 = await save_upload_to_temp(image_t2, "T2 / AFTER")
            saved_paths["image_t1_path"] = saved_t1.path
            saved_paths["image_t2_path"] = saved_t2.path
            temp_paths.extend([saved_t1.path, saved_t2.path])
            print("[OrbiVue Orchestrator] T1 bytes:", len(saved_t1.content))
            print("[OrbiVue Orchestrator] T2 bytes:", len(saved_t2.content))
        else:
            saved_optical = await save_upload_to_temp(optical_image, "Optical")
            saved_sar = await save_upload_to_temp(sar_image, "SAR")
            saved_paths["optical_image_path"] = saved_optical.path
            saved_paths["sar_image_path"] = saved_sar.path
            temp_paths.extend([saved_optical.path, saved_sar.path])
            print("[OrbiVue Orchestrator] optical bytes:", len(saved_optical.content))
            print("[OrbiVue Orchestrator] sar bytes:", len(saved_sar.content))

        print("[OrbiVue Orchestrator] image save:", f"{time.perf_counter() - save_started_at:.3f}s")
        return await execute_plan(plan=plan, query=query, **saved_paths)
    except OrchestrationValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except GeminiAnalysisError as error:
        print("[OrbiVue Orchestrator] error type:", error.error_type)
        print("[OrbiVue Orchestrator] error:", repr(error))
        raise HTTPException(status_code=502, detail=error.user_message) from error
    except Exception as error:
        print("[OrbiVue Orchestrator] error type:", type(error).__name__)
        print("[OrbiVue Orchestrator] error:", repr(error))
        raise HTTPException(status_code=500, detail="Orchestration could not be completed. Please try again.") from error
    finally:
        for temp_path in temp_paths:
            Path(temp_path).unlink(missing_ok=True)
        print("[OrbiVue Orchestrator] endpoint total latency:", f"{time.perf_counter() - request_started_at:.3f}s")


def _has_upload(upload: UploadFile | None) -> bool:
    return bool(upload is not None and upload.filename)
