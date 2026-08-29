import time
from pathlib import Path
from typing import Any, Literal

import torch
from PIL import Image
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = "vikhyatk/moondream2"
MODEL_REVISION = "2024-08-26"
MAX_IMAGE_SIDE = 1280

_model: Any | None = None
_tokenizer: Any | None = None
_device = "cuda" if torch.cuda.is_available() else "cpu"
_torch_dtype = torch.float16 if _device == "cuda" else torch.float32
_supports_vqa_generation_config: bool | None = None
_supports_caption_generation_config: bool | None = None


def _cuda_memory_mb() -> float:
    if not torch.cuda.is_available():
        return 0.0
    return round(torch.cuda.memory_allocated() / (1024 * 1024), 2)


def _model_device_and_dtype(model: Any) -> tuple[str, str]:
    try:
        parameter = next(model.parameters())
        return str(parameter.device), str(parameter.dtype)
    except StopIteration:
        return _device, str(_torch_dtype)


def _get_model_and_tokenizer() -> tuple[Any, Any]:
    global _model, _tokenizer

    if _model is None:
        load_started_at = time.perf_counter()
        _model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            revision=MODEL_REVISION,
            trust_remote_code=True,
            torch_dtype=_torch_dtype,
        ).to(_device)
        _model.eval()
        print("[SatQuery Timing] model load:", f"{time.perf_counter() - load_started_at:.3f}s")

    if _tokenizer is None:
        tokenizer_started_at = time.perf_counter()
        _tokenizer = AutoTokenizer.from_pretrained(
            MODEL_ID,
            revision=MODEL_REVISION,
            trust_remote_code=True,
        )
        print("[SatQuery Timing] tokenizer load:", f"{time.perf_counter() - tokenizer_started_at:.3f}s")

    return _model, _tokenizer


def preload_vision_model() -> None:
    _get_model_and_tokenizer()


def is_model_cached() -> bool:
    return _model is not None and _tokenizer is not None


def get_runtime_diagnostics() -> dict[str, Any]:
    model_device = _device
    model_dtype = str(_torch_dtype)
    if _model is not None:
        model_device, model_dtype = _model_device_and_dtype(_model)

    return {
        "cuda_available": torch.cuda.is_available(),
        "selected_device": _device,
        "model_cached": is_model_cached(),
        "model_device": model_device,
        "model_dtype": model_dtype,
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
        "gpu_allocated_mb": _cuda_memory_mb(),
        "vqa_generation_kwargs_supported": _supports_vqa_generation_config,
        "caption_generation_kwargs_supported": _supports_caption_generation_config,
    }


VisionTask = Literal["vqa", "caption"]


def get_model_name() -> str:
    return f"{MODEL_ID}@{MODEL_REVISION}"


def analyze_single_image(
    image_path: str,
    query: str,
    max_new_tokens: int = 96,
    task: VisionTask = "vqa",
) -> str:
    global _supports_vqa_generation_config, _supports_caption_generation_config

    image = None

    try:
        retrieval_started_at = time.perf_counter()
        was_cached = is_model_cached()
        model, tokenizer = _get_model_and_tokenizer()
        model_device, model_dtype = _model_device_and_dtype(model)
        print("[SatQuery] model already cached:", was_cached)
        print("[SatQuery]", "WARM REQUEST" if was_cached else "COLD REQUEST")
        print("[SatQuery] cuda available:", torch.cuda.is_available())
        print("[SatQuery] device:", _device)
        print("[SatQuery] model device:", model_device)
        print("[SatQuery] model dtype:", model_dtype)
        print("[SatQuery] gpu:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu")
        print("[SatQuery] gpu allocated before inference:", f"{_cuda_memory_mb()} MB")
        print("[SatQuery] model retrieval:", f"{time.perf_counter() - retrieval_started_at:.3f}s")
        print("[SatQuery] vision task:", task)

        preprocess_started_at = time.perf_counter()
        image = Image.open(Path(image_path)).convert("RGB")
        image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.Resampling.LANCZOS)
        print("[SatQuery Timing] image preprocessing:", f"{time.perf_counter() - preprocess_started_at:.3f}s")

        answer = None
        generation_kwargs = {
            "max_new_tokens": max_new_tokens,
            "do_sample": False,
            "num_beams": 1,
        }
        print("[SatQuery] generation max_new_tokens:", max_new_tokens)
        print("[SatQuery] beam search enabled:", generation_kwargs["num_beams"] > 1)

        inference_started_at = time.perf_counter()
        with torch.inference_mode():
            if task == "caption" and hasattr(model, "caption"):
                if _supports_caption_generation_config is not False:
                    try:
                        captions = model.caption(
                            [image],
                            tokenizer,
                            length="short",
                            max_new_tokens=max_new_tokens,
                            do_sample=False,
                            num_beams=1,
                        )
                        _supports_caption_generation_config = True
                    except TypeError:
                        _supports_caption_generation_config = False
                        captions = model.caption([image], tokenizer, length="short")

                if _supports_caption_generation_config is False:
                    captions = model.caption([image], tokenizer, length="short")

                answer = captions[0] if isinstance(captions, list) and captions else captions
                print("[SatQuery] gpu allocated after caption:", f"{_cuda_memory_mb()} MB")
            else:
                encoded_image = model.encode_image(image)
                print("[SatQuery] gpu allocated after image encoding:", f"{_cuda_memory_mb()} MB")
                if _supports_vqa_generation_config is not False:
                    try:
                        answer = model.answer_question(encoded_image, query, tokenizer, **generation_kwargs)
                        _supports_vqa_generation_config = True
                    except TypeError:
                        _supports_vqa_generation_config = False

                if answer is None:
                    answer = model.answer_question(encoded_image, query, tokenizer)
                print("[SatQuery] gpu allocated after generation:", f"{_cuda_memory_mb()} MB")
        print("[SatQuery Timing] vision inference:", f"{time.perf_counter() - inference_started_at:.3f}s")

        answer_text = str(answer).strip()
        try:
            generated_token_count = len(tokenizer.encode(answer_text, add_special_tokens=False))
        except Exception:
            generated_token_count = len(answer_text.split())
        print("[SatQuery] actual generated token count:", generated_token_count)

        return answer_text
    finally:
        if image is not None:
            image.close()

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
