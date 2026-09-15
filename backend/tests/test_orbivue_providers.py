from __future__ import annotations

import asyncio
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services.gemini_client import GeminiAnalysisError
from app.services.providers import (
    get_analysis_provider,
    get_grounding_provider,
    get_temporal_provider,
)
from app.services.temporal_change import _normalize_change_response


MODAL_BASE_URL = "https://akshatshivhare--orbivue-original-model-server-serve.modal.run"
API_KEY = "test-api-key"


class FakeTimeout:
    def __init__(self, timeout: float, *, connect: float | None = None) -> None:
        self.connect = connect if connect is not None else timeout
        self.read = timeout
        self.write = timeout
        self.pool = timeout


class FakeTimeoutException(Exception):
    pass


class FakeRequestError(Exception):
    pass


sys.modules.setdefault(
    "httpx",
    types.SimpleNamespace(
        AsyncClient=None,
        Timeout=FakeTimeout,
        TimeoutException=FakeTimeoutException,
        RequestError=FakeRequestError,
    ),
)


class FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self) -> dict:
        return self._payload


class FakeAsyncClient:
    calls: list[dict] = []
    response = FakeResponse(200, {"mode": "temporal", "final_answer": "ok"})

    def __init__(self, timeout: FakeTimeout) -> None:
        self.timeout = timeout

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, *_args) -> None:
        return None

    async def post(self, url: str, **kwargs):
        self.calls.append({"url": url, "timeout": self.timeout, **kwargs})
        return self.response


def _temp_image_file() -> Path:
    handle = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    handle.write(b"fake image bytes")
    handle.close()
    return Path(handle.name)


class OrbiVueProviderTests(unittest.TestCase):
    def setUp(self) -> None:
        FakeAsyncClient.calls = []
        FakeAsyncClient.response = FakeResponse(200, {"mode": "temporal", "final_answer": "ok"})

    def test_provider_selection_uses_orbivue_for_analysis_grounding_temporal(self) -> None:
        from app.services import providers

        with (
            patch.object(providers, "ANALYSIS_PROVIDER", "orbivue"),
            patch.object(providers, "GROUNDING_PROVIDER", "orbivue"),
            patch.object(providers, "TEMPORAL_PROVIDER", "orbivue"),
            patch.dict(providers._providers, {}, clear=True),
        ):
            self.assertEqual(get_analysis_provider().name, "OrbiVue")
            self.assertEqual(get_grounding_provider().name, "OrbiVue Grounding")
            self.assertEqual(get_temporal_provider().name, "OrbiVue Temporal")

    def test_analysis_provider_posts_to_analyze_with_api_key(self) -> None:
        from app.services.providers import orbivue_analysis_provider as module

        image_path = _temp_image_file()
        try:
            FakeAsyncClient.response = FakeResponse(200, {"mode": "analysis", "final_answer": "analysis ok"})
            with (
                patch.object(module, "ORBIVUE_API_URL", MODAL_BASE_URL),
                patch.object(module, "ORBIVUE_API_KEY", API_KEY),
                patch.object(module.httpx, "AsyncClient", FakeAsyncClient),
            ):
                answer = asyncio.run(module.OrbiVueVisionProvider()._analyze_image_async(image_path, "Describe"))

            self.assertEqual(answer, "analysis ok")
            self.assertEqual(FakeAsyncClient.calls[0]["url"], f"{MODAL_BASE_URL}/analyze")
            self.assertEqual(FakeAsyncClient.calls[0]["headers"]["X-API-Key"], API_KEY)
            self.assertEqual(FakeAsyncClient.calls[0]["timeout"].read, module.ORBIVUE_ANALYSIS_TIMEOUT_SECONDS)
        finally:
            image_path.unlink(missing_ok=True)

    def test_grounding_provider_posts_to_ground_and_preserves_boxes(self) -> None:
        from app.services.providers import orbivue_grounding_provider as module

        image_path = _temp_image_file()
        boxes = [[0.1, 0.2, 0.3, 0.4]]
        try:
            FakeAsyncClient.response = FakeResponse(
                200,
                {"mode": "grounding", "final_answer": "highlighted", "bounding_boxes": boxes},
            )
            with (
                patch.object(module, "ORBIVUE_GROUNDING_API_URL", MODAL_BASE_URL),
                patch.object(module, "ORBIVUE_GROUNDING_API_KEY", API_KEY),
                patch.object(module.httpx, "AsyncClient", FakeAsyncClient),
            ):
                output = asyncio.run(module.OrbiVueGroundingProvider()._ground_image_async(image_path, "stadium"))

            payload = json.loads(output)
            self.assertEqual(FakeAsyncClient.calls[0]["url"], f"{MODAL_BASE_URL}/ground")
            self.assertEqual(FakeAsyncClient.calls[0]["headers"]["X-API-Key"], API_KEY)
            self.assertEqual(FakeAsyncClient.calls[0]["timeout"].read, module.ORBIVUE_GROUNDING_TIMEOUT_SECONDS)
            self.assertEqual(payload["bounding_boxes"], boxes)
        finally:
            image_path.unlink(missing_ok=True)

    def test_temporal_provider_posts_to_change_and_preserves_change_guard(self) -> None:
        from app.services.providers import orbivue_temporal_provider as module

        image_t1_path = _temp_image_file()
        image_t2_path = _temp_image_file()
        change_guard = {
            "status": "no_measurable_change",
            "qwen_called": False,
            "exact_match": True,
            "mean_absolute_difference": 0.0,
            "changed_pixel_fraction": 0.0,
            "pixel_change_threshold": 0.02,
            "near_identical_mean_threshold": 0.005,
            "near_identical_fraction_threshold": 0.005,
            "semantic_verification": "deterministic_no_change",
            "original_size_t1": [512, 512],
            "original_size_t2": [1024, 1024],
            "comparison_size": [512, 512],
            "dimension_normalized": True,
            "normalization_method": "resize_t2_to_t1",
            "aspect_ratio_t1": 1.0,
            "aspect_ratio_t2": 1.0,
            "aspect_ratio_relative_difference": 0.0,
            "alignment_warning": (
                "Images had different pixel dimensions and were normalized to "
                "a common resolution for image-space comparison. This does not "
                "establish geospatial registration."
            ),
        }
        try:
            FakeAsyncClient.response = FakeResponse(
                200,
                {"mode": "temporal", "final_answer": "no visible change", "change_guard": change_guard},
            )
            with (
                patch.object(module, "ORBIVUE_TEMPORAL_API_URL", MODAL_BASE_URL),
                patch.object(module, "ORBIVUE_TEMPORAL_API_KEY", API_KEY),
                patch.object(module.httpx, "AsyncClient", FakeAsyncClient),
            ):
                output = asyncio.run(
                    module.OrbiVueTemporalProvider()._analyze_temporal_async(
                        image_t1_path,
                        image_t2_path,
                        "Compare",
                    )
                )

            payload = json.loads(output)
            self.assertEqual(FakeAsyncClient.calls[0]["url"], f"{MODAL_BASE_URL}/change")
            self.assertEqual(FakeAsyncClient.calls[0]["headers"]["X-API-Key"], API_KEY)
            self.assertEqual(FakeAsyncClient.calls[0]["timeout"].read, module.ORBIVUE_TEMPORAL_TIMEOUT_SECONDS)
            self.assertEqual(payload["change_guard"], change_guard)

            normalized = _normalize_change_response(payload, is_follow_up=False)
            self.assertEqual(normalized["change_guard"], change_guard)
        finally:
            image_t1_path.unlink(missing_ok=True)
            image_t2_path.unlink(missing_ok=True)

    def test_cross_modal_provider_posts_to_cross_modal_with_api_key(self) -> None:
        from app.services.providers import orbivue_cross_modal_provider as module

        optical_path = _temp_image_file()
        sar_path = _temp_image_file()
        try:
            FakeAsyncClient.response = FakeResponse(200, {"mode": "cross_modal", "final_answer": "cross ok"})
            with (
                patch.object(module, "ORBIVUE_CROSS_MODAL_API_URL", MODAL_BASE_URL),
                patch.object(module, "ORBIVUE_CROSS_MODAL_API_KEY", API_KEY),
                patch.object(module.httpx, "AsyncClient", FakeAsyncClient),
            ):
                output = asyncio.run(
                    module.OrbiVueCrossModalProvider().analyze_cross_modal(
                        optical_path,
                        sar_path,
                        "Compare",
                    )
                )

            payload = json.loads(output)
            self.assertEqual(payload["final_answer"], "cross ok")
            self.assertEqual(FakeAsyncClient.calls[0]["url"], f"{MODAL_BASE_URL}/cross-modal")
            self.assertEqual(FakeAsyncClient.calls[0]["headers"]["X-API-Key"], API_KEY)
            self.assertEqual(FakeAsyncClient.calls[0]["timeout"].read, module.ORBIVUE_CROSS_MODAL_TIMEOUT_SECONDS)
        finally:
            optical_path.unlink(missing_ok=True)
            sar_path.unlink(missing_ok=True)

    def test_provider_http_failure_returns_clean_error(self) -> None:
        from app.services.providers import orbivue_analysis_provider as module

        image_path = _temp_image_file()
        try:
            FakeAsyncClient.response = FakeResponse(503, text="temporarily unavailable")
            with (
                patch.object(module, "ORBIVUE_API_URL", MODAL_BASE_URL),
                patch.object(module, "ORBIVUE_API_KEY", API_KEY),
                patch.object(module.httpx, "AsyncClient", FakeAsyncClient),
            ):
                with self.assertRaises(GeminiAnalysisError) as context:
                    asyncio.run(module.OrbiVueVisionProvider()._analyze_image_async(image_path, "Describe"))

            self.assertEqual(context.exception.error_type, "orbivue_http_503")
            self.assertEqual(
                context.exception.user_message,
                "OrbiVue analysis provider returned an error. Please try again.",
            )
        finally:
            image_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
