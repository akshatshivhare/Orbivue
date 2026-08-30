import base64
import json
import mimetypes
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from ...config import OPENROUTER_API_KEY, OPENROUTER_VISION_MODEL
from ..gemini_client import GeminiAnalysisError

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterVisionProvider:
    name = "OpenRouter"
    model = OPENROUTER_VISION_MODEL
    coordinate_order = "xyxy"

    def analyze_image(self, image_path: Path, prompt: str, user_query: str) -> str:
        return self._chat_completion(
            request_type="analysis",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": _image_data_url(image_path)}},
                    ],
                }
            ],
            max_tokens=220,
        )

    def ground_image(
        self,
        image_path: Path,
        prompt: str,
        response_format: dict[str, Any] | None = None,
    ) -> str:
        return self._chat_completion(
            request_type="grounding",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": _image_data_url(image_path)}},
                    ],
                }
            ],
            max_tokens=220,
            force_json=True,
        )

    def analyze_temporal(self, image_t1_path: Path, image_t2_path: Path, prompt: str) -> str:
        return self._chat_completion(
            request_type="temporal",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Image 1 = T1 / BEFORE / earlier reference image."},
                        {"type": "image_url", "image_url": {"url": _image_data_url(image_t1_path)}},
                        {"type": "text", "text": "Image 2 = T2 / AFTER / later comparison image."},
                        {"type": "image_url", "image_url": {"url": _image_data_url(image_t2_path)}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            max_tokens=650,
            force_json=True,
        )

    def _chat_completion(
        self,
        *,
        request_type: str,
        messages: list[dict[str, Any]],
        max_tokens: int,
        force_json: bool = False,
    ) -> str:
        if not OPENROUTER_API_KEY:
            raise GeminiAnalysisError(
                "OpenRouter vision is unavailable because OPENROUTER_API_KEY is not configured.",
                error_type="missing_api_key",
                user_message="OpenRouter API key is not configured.",
            )

        payload: dict[str, Any] = {
            "model": OPENROUTER_VISION_MODEL,
            "messages": messages,
            "temperature": 0,
            "max_tokens": max_tokens,
        }
        if force_json:
            payload["response_format"] = {"type": "json_object"}

        request_started_at = time.perf_counter()
        print("[SatQuery OpenRouter] model:", OPENROUTER_VISION_MODEL)
        print("[SatQuery OpenRouter] request type:", request_type)

        request = urllib.request.Request(
            OPENROUTER_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                response_body = response.read().decode("utf-8")
                print("[SatQuery OpenRouter] status:", response.status)
        except urllib.error.HTTPError as error:
            error_body = error.read().decode("utf-8", errors="replace")
            print("[SatQuery OpenRouter] status:", error.code)
            print("[SatQuery OpenRouter] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
            if error.code == 429:
                raise GeminiAnalysisError(
                    error_body,
                    error_type="rate_limited",
                    user_message="OpenRouter is temporarily rate limited. Please try again in a moment.",
                ) from error
            raise GeminiAnalysisError(
                error_body,
                error_type=f"openrouter_http_{error.code}",
                user_message="OpenRouter vision request could not be completed. Please try again.",
            ) from error
        except urllib.error.URLError as error:
            print("[SatQuery OpenRouter] status: network_error")
            print("[SatQuery OpenRouter] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
            raise GeminiAnalysisError(
                str(error),
                error_type="openrouter_network_error",
                user_message="OpenRouter vision request could not reach the provider. Please try again.",
            ) from error

        print("[SatQuery OpenRouter] latency:", f"{time.perf_counter() - request_started_at:.3f}s")
        return _extract_message_text(response_body)


def _image_data_url(image_path: Path) -> str:
    mime_type = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
    encoded_image = base64.b64encode(image_path.read_bytes()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded_image}"


def _extract_message_text(response_body: str) -> str:
    try:
        payload = json.loads(response_body)
        choices = payload.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            text_parts = [
                str(part.get("text")).strip()
                for part in content
                if isinstance(part, dict) and part.get("type") == "text" and part.get("text")
            ]
            return "\n".join(text_parts).strip()
    except (json.JSONDecodeError, AttributeError):
        return ""

    return ""
