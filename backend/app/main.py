from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import (
    ALLOWED_ORIGINS,
    ANALYSIS_PROVIDER,
    CROSS_MODAL_PROVIDER,
    GROUNDING_PROVIDER,
    TEMPORAL_PROVIDER,
    VISION_PROVIDER,
    gemini_api_key_loaded,
)
from .routes.analyze import router as analyze_router
from .routes.change_analysis import router as change_analysis_router
from .routes.cross_modal import router as cross_modal_router
from .routes.general import router as general_router
from .routes.location_imagery import router as location_imagery_router
from .routes.orchestrate import router as orchestrate_router

app = FastAPI(title="SatQuery AI Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(change_analysis_router)
app.include_router(cross_modal_router)
app.include_router(general_router)
app.include_router(location_imagery_router)
app.include_router(orchestrate_router)


@app.on_event("startup")
async def log_config_status() -> None:
    print("[SatQuery Config] Gemini API key loaded:", gemini_api_key_loaded())
    print("[SatQuery Config] allowed origins:", ALLOWED_ORIGINS)
    print("[SatQuery Provider] configured vision provider:", VISION_PROVIDER)
    print("[SatQuery Provider] analysis provider:", ANALYSIS_PROVIDER)
    print("[SatQuery Provider] grounding provider:", GROUNDING_PROVIDER)
    print("[SatQuery Provider] temporal provider:", TEMPORAL_PROVIDER)
    print("[SatQuery Provider] cross-modal provider:", CROSS_MODAL_PROVIDER)
