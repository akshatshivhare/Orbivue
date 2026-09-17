"""CPU-only Modal deployment for the original OrbiVue FastAPI backend."""

from __future__ import annotations

import sys
import os
from pathlib import Path
import modal


APP_NAME = "orbivue-backend"
REMOTE_APP_ROOT = "/root/orbivue_backend"
LOCAL_REPO_ROOT = Path(__file__).resolve().parents[2] if os.name == "nt" else Path("/root")
LOCAL_BACKEND_APP_DIR = LOCAL_REPO_ROOT / "backend" / "app"
LOCAL_REQUIREMENTS = Path(__file__).with_name("backend_requirements.txt")

app = modal.App(APP_NAME)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_requirements(str(LOCAL_REQUIREMENTS))
    .add_local_dir(str(LOCAL_BACKEND_APP_DIR), remote_path=f"{REMOTE_APP_ROOT}/app")
)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("orbivue-backend-env", environment_name="main")],
    min_containers=0,
    max_containers=3,
    scaledown_window=300,
    timeout=900,
)
@modal.asgi_app()
def serve():
    """Serve backend/app/main.py through Modal ASGI without GPU resources."""

    if REMOTE_APP_ROOT not in sys.path:
        sys.path.insert(0, REMOTE_APP_ROOT)

    from app.main import app as fastapi_app

    return fastapi_app
