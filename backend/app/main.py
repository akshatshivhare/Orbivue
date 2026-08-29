from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOWED_ORIGINS, gemini_api_key_loaded
from .routes.analyze import router as analyze_router
from .routes.change_analysis import router as change_analysis_router
from .routes.general import router as general_router

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
app.include_router(general_router)


@app.on_event("startup")
async def log_config_status() -> None:
    print("[SatQuery Config] Gemini API key loaded:", gemini_api_key_loaded())
    print("[SatQuery Config] allowed origins:", ALLOWED_ORIGINS)
