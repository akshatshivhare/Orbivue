from typing import Any
from uuid import uuid4

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import HTMLResponse

from ..schemas.analysis import DemoLoginRequest

router = APIRouter()


@router.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "satquery-ai"}


@router.post("/api/session/demo-login")
def demo_login(payload: DemoLoginRequest) -> dict[str, Any]:
    return {
        "status": "ok",
        "user": {
            "name": payload.name.strip(),
            "email": payload.email,
            "role": "demo-user",
            "session_type": "demo",
        },
    }


@router.post("/api/upload")
async def upload(file: UploadFile = File(...)) -> dict[str, Any]:
    content = await file.read()
    extension = (file.filename or "upload").rsplit(".", 1)[-1].lower()
    return {
        "status": "ok",
        "file": {
            "id": f"upload-{uuid4().hex[:8]}",
            "name": file.filename,
            "format": extension,
            "content_type": file.content_type,
            "size": len(content),
            "stored": False,
        },
    }


@router.get("/api/search/location")
def search_location(q: str = Query(..., min_length=1, max_length=120)) -> dict[str, Any]:
    return {
        "status": "ok",
        "source": "dummy",
        "query": q,
        "results": [
            {
                "id": "dummy-indore",
                "name": f"{q.title()} demo scene",
                "center": [75.8577, 22.7196],
                "bbox": [75.7777, 22.6596, 75.9377, 22.7796],
                "provider": "dummy-mapbox-sentinel",
            }
        ],
    }


@router.get("/api/report/{run_id}")
def report(run_id: str) -> HTMLResponse:
    html = f"""
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>SatQuery AI Dummy Report</title>
      </head>
      <body>
        <h1>SatQuery AI Dummy Report</h1>
        <p>Run ID: {run_id}</p>
        <p>This is a placeholder report. Real report generation will be added later.</p>
      </body>
    </html>
    """
    return HTMLResponse(content=html)
