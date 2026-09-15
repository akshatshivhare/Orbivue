"""Modal deployment for the recovered original OrbiVue model server.

This file intentionally lives outside the runtime FastAPI backend. It packages
the recovered Lightning app for Modal and preserves its lazy model loading:
models are imported at container startup, but weights are loaded only when each
HTTP route is called.
"""

from __future__ import annotations

import os
from pathlib import Path

import modal


APP_NAME = "orbivue-original-model-server"
REMOTE_APP_ROOT = "/root/orbivue_original"
HF_CACHE_PATH = "/root/.cache/huggingface"
ANALYSIS_ADAPTER_PATH = "/models/analysis_adapter"
LOCAL_TEMPORAL_GUARD_PATH = Path(__file__).with_name("temporal_guard.py").resolve()

LOCAL_RECOVERED_APP_DIR = Path(
    os.getenv(
        "ORBIVUE_RECOVERED_APP_DIR",
        r"C:\Datasets\ORBIVUE\Original-Lightning-Backup\app",
    )
).resolve()

if os.name == "nt" and not LOCAL_RECOVERED_APP_DIR.exists():
    raise RuntimeError(
        "Recovered OrbiVue app source was not found. Set "
        "ORBIVUE_RECOVERED_APP_DIR to the recovered Lightning app directory."
    )


app = modal.App(APP_NAME)

models_volume = modal.Volume.from_name("orbivue-models", create_if_missing=False)
hf_cache_volume = modal.Volume.from_name("orbivue-hf-cache", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1", "libglib2.0-0")
    .pip_install(
        "fastapi",
        "uvicorn",
        "python-multipart",
        "python-dotenv",
        "pillow",
        "numpy",
        "torch",
        "torchvision",
        "transformers",
        "accelerate",
        "bitsandbytes",
        "peft",
        "safetensors",
        "qwen-vl-utils",
        "sentencepiece",
        "protobuf",
    )
    .env(
        {
            "HF_HOME": HF_CACHE_PATH,
            "TRANSFORMERS_CACHE": HF_CACHE_PATH,
            "HF_HUB_CACHE": f"{HF_CACHE_PATH}/hub",
            "TOKENIZERS_PARALLELISM": "false",
        }
    )
    .add_local_file(
        str(LOCAL_TEMPORAL_GUARD_PATH),
        remote_path=f"{REMOTE_APP_ROOT}/temporal_guard.py",
    )
    .add_local_dir(str(LOCAL_RECOVERED_APP_DIR), remote_path=f"{REMOTE_APP_ROOT}/app")
)


@app.function(
    image=image,
    gpu=["T4", "L4", "A10G"],
    secrets=[modal.Secret.from_name("orbivue-model-api-key", environment_name="main", required_keys=["ORBIVUE_MODEL_API_KEY"])],
    volumes={
        "/models": models_volume,
        HF_CACHE_PATH: hf_cache_volume,
    },
    min_containers=0,
    max_containers=1,
    scaledown_window=300,
    timeout=900,
)
@modal.asgi_app()
def serve():
    """Serve the recovered FastAPI app through Modal's ASGI adapter."""

    import sys

    runtime_root = Path(REMOTE_APP_ROOT)
    if str(runtime_root) not in sys.path:
        sys.path.insert(0, str(runtime_root))

    # Importing app.main registers the original routes. The recovered model
    # modules keep weights lazy, so this import does not load Qwen/GroundingDINO.
    import app.main as recovered_main
    from app.models import temporal as temporal_model
    from app.models import analysis as analysis_model
    from temporal_guard import install_temporal_guard

    # The recovered Lightning code used a relative local adapter path. On Modal
    # the trained adapter is mounted from the existing orbivue-models volume.
    analysis_model.ADAPTER_PATH = ANALYSIS_ADAPTER_PATH
    install_temporal_guard(recovered_main, temporal_model)

    print("[OrbiVue Modal] app source:", REMOTE_APP_ROOT)
    print("[OrbiVue Modal] analysis adapter path:", analysis_model.ADAPTER_PATH)
    print("[OrbiVue Modal] temporal guard: enabled")
    print("[OrbiVue Modal] HF cache:", HF_CACHE_PATH)
    print("[OrbiVue Modal] min_containers: 0")
    print("[OrbiVue Modal] max_containers: 1")
    print("[OrbiVue Modal] scaledown_window: 300s")

    return recovered_main.app
