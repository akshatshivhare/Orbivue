# OrbiVue Original Model Server on Modal

This deployment serves the recovered original OrbiVue Lightning FastAPI app on
Modal with automatic on-demand startup and scale-to-zero behavior.

## What It Serves

The Modal ASGI app preserves the recovered server routes:

- `GET /`
- `GET /health`
- `POST /analyze`
- `POST /predict`
- `POST /ground`
- `POST /change`
- `POST /cross-modal`

The original `X-API-Key` auth behavior is preserved through the
`ORBIVUE_MODEL_API_KEY` environment variable supplied by a Modal Secret.

## Scale-To-Zero

The deployment uses:

- `min_containers=0`
- `max_containers=1`
- `scaledown_window=300`
- GPU fallback order: `T4`, `L4`, then `A10G`

This means no GPU container is kept warm continuously. Modal starts the GPU
container on the first request and scales it down after roughly five idle
minutes.

## Lazy Model Loading

The recovered model modules are not eagerly loaded at container startup:

- `/analyze` and `/predict` lazily load Qwen/Qwen2.5-VL-3B-Instruct plus the
  trained LoRA adapter from `/models/analysis_adapter`.
- `/ground` lazily loads IDEA-Research/grounding-dino-tiny and
  openai/clip-vit-base-patch32.
- `/change` lazily loads the base Qwen temporal model.
- `/cross-modal` reuses the temporal/base Qwen singleton from the recovered
  implementation.

## Temporal Guard

`POST /change` is wrapped by a deterministic CPU image-space guard before the
recovered Qwen temporal implementation is called.

- Exact identical images return a deterministic no-change response and skip
  Qwen.
- Near-identical images skip Qwen when both fixed thresholds pass:
  mean normalized absolute RGB difference `<= 0.005` and changed pixel fraction
  `<= 0.005`, where changed pixels use max-channel difference `> 0.02`.
- Differently sized images are only normalized for deterministic comparison
  when their relative aspect-ratio difference is `<= 0.02`; T2 is resized to T1
  dimensions with PIL bilinear resampling for metrics only.
- Clearly different aspect ratios return an incompatible response and skip Qwen.
- Measurable image-space differences call the original recovered temporal Qwen
  path and return `change_guard.semantic_verification` as
  `model_generated_unverified`.

Dimension normalization does not establish geospatial registration, and pixel
statistics must not be interpreted as physical changed land area.

## Volumes

Required existing model volume:

- Modal Volume `orbivue-models` mounted at `/models`
- Analysis adapter expected at `/models/analysis_adapter`

The expected adapter file is:

- `/models/analysis_adapter/adapter_model.safetensors`

Persistent Hugging Face cache volume:

- Modal Volume `orbivue-hf-cache` mounted at `/root/.cache/huggingface`

The cache volume allows base Hugging Face model files to persist after the
first remote download.

## Secret Setup

Create the Modal secret without hardcoding the value in source:

```powershell
modal secret create orbivue-model-api-key ORBIVUE_MODEL_API_KEY="your-secret-value"
```

## Deploy

Run from the OrbiVue repo root:

```powershell
modal deploy deployment/modal/orbivue_original_server.py
```

If the recovered Lightning app is not at the default local path, set:

```powershell
$env:ORBIVUE_RECOVERED_APP_DIR="C:\Datasets\ORBIVUE\Original-Lightning-Backup\app"
modal deploy deployment/modal/orbivue_original_server.py
```

Modal prints the public URL after deployment. It will look similar to:

```text
https://<workspace>--orbivue-original-model-server-serve.modal.run
```

## Health Test

```powershell
curl.exe https://<workspace>--orbivue-original-model-server-serve.modal.run/health
```

Expected:

```json
{"status":"ok","service":"orbivue-model-server"}
```

## Route Tests

Analysis:

```powershell
curl.exe -X POST https://<workspace>--orbivue-original-model-server-serve.modal.run/analyze `
  -H "X-API-Key: your-secret-value" `
  -F "image=@test.jpg" `
  -F "query=Describe this satellite image."
```

Grounding:

```powershell
curl.exe -X POST https://<workspace>--orbivue-original-model-server-serve.modal.run/ground `
  -H "X-API-Key: your-secret-value" `
  -F "image=@test.jpg" `
  -F "query=highlight the stadium"
```

Temporal change:

```powershell
curl.exe -X POST https://<workspace>--orbivue-original-model-server-serve.modal.run/change `
  -H "X-API-Key: your-secret-value" `
  -F "image_t1=@before.jpg" `
  -F "image_t2=@after.jpg" `
  -F "query=What changed between these two images?"
```

Cross-modal:

```powershell
curl.exe -X POST https://<workspace>--orbivue-original-model-server-serve.modal.run/cross-modal `
  -H "X-API-Key: your-secret-value" `
  -F "optical_image=@optical.jpg" `
  -F "sar_image=@sar.jpg" `
  -F "query=Compare the optical and SAR observations."
```
