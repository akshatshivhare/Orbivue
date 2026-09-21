from __future__ import annotations

import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.services import daily_request_limiter as limiter_module


class DailyRequestLimitTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.state_path = Path(self.temp_dir.name) / "daily_limits.json"
        self.patches = [
            patch.object(limiter_module, "DAILY_REQUEST_LIMIT_STATE_PATH", str(self.state_path)),
            patch.object(limiter_module, "DAILY_REQUEST_LIMIT_PER_CLIENT", 10),
            patch.object(limiter_module, "DAILY_REQUEST_LIMIT_GLOBAL", 40),
        ]
        for patcher in self.patches:
            patcher.start()
            self.addCleanup(patcher.stop)
        self.addCleanup(self.temp_dir.cleanup)
        self.client = TestClient(app)

    def test_request_below_limit_is_allowed(self) -> None:
        with (
            patch("app.routes.analyze.route_query", new=AsyncMock(return_value={"selected_tool": "VQA"})),
            patch("app.routes.analyze.route_vision_intent", new=AsyncMock(return_value={"mode": "analysis"})),
            patch("app.routes.analyze.analyze_image_with_gemini", return_value="analysis ok") as analyze_mock,
        ):
            response = self.client.post(
                "/api/analyze",
                data={"query": "Describe this image"},
                files={"image": ("scene.jpg", b"fake-image", "image/jpeg")},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["final_answer"], "analysis ok")
        analyze_mock.assert_called_once()

    def test_per_client_limit_exceeded_returns_429(self) -> None:
        with patch.object(limiter_module, "DAILY_REQUEST_LIMIT_PER_CLIENT", 1):
            with (
                patch("app.routes.analyze.route_query", new=AsyncMock(return_value={"selected_tool": "VQA"})),
                patch("app.routes.analyze.route_vision_intent", new=AsyncMock(return_value={"mode": "analysis"})),
                patch("app.routes.analyze.analyze_image_with_gemini", return_value="analysis ok") as analyze_mock,
            ):
                first = self.client.post(
                    "/api/analyze",
                    data={"query": "Describe this image"},
                    files={"image": ("scene.jpg", b"fake-image", "image/jpeg")},
                )
                second = self.client.post(
                    "/api/analyze",
                    data={"query": "Describe this image"},
                    files={"image": ("scene.jpg", b"fake-image", "image/jpeg")},
                )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertEqual(
            second.json()["detail"],
            "Daily analysis limit reached for this device/network. Please try again tomorrow.",
        )
        analyze_mock.assert_called_once()

    def test_global_limit_exceeded_returns_429(self) -> None:
        with (
            patch.object(limiter_module, "DAILY_REQUEST_LIMIT_PER_CLIENT", 100),
            patch.object(limiter_module, "DAILY_REQUEST_LIMIT_GLOBAL", 1),
            patch("app.routes.change_analysis.analyze_change_with_gemini", return_value={"final_answer": "change ok"}) as change_mock,
        ):
            first = self.client.post(
                "/api/change-analyze",
                data={"query": ""},
                files={
                    "image_t1": ("before.jpg", b"before-image", "image/jpeg"),
                    "image_t2": ("after.jpg", b"after-image", "image/jpeg"),
                },
            )
            second = self.client.post(
                "/api/change-analyze",
                data={"query": ""},
                files={
                    "image_t1": ("before.jpg", b"before-image", "image/jpeg"),
                    "image_t2": ("after.jpg", b"after-image", "image/jpeg"),
                },
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertEqual(
            second.json()["detail"],
            "ORBIVUE demo has reached today's analysis limit. Please try again tomorrow.",
        )
        change_mock.assert_called_once()

    def test_next_day_reset_allows_requests_again(self) -> None:
        limiter = limiter_module.DailyRequestLimiter(
            state_path=self.state_path,
            per_client_limit=1,
            global_limit=2,
        )
        client_id = limiter_module._hash_client_host("203.0.113.10")
        limiter.check_and_increment(client_id, now=datetime(2026, 9, 20, 10, 0, tzinfo=limiter_module.INDIA_TIMEZONE))

        with self.assertRaises(HTTPException):
            limiter.check_and_increment(client_id, now=datetime(2026, 9, 20, 11, 0, tzinfo=limiter_module.INDIA_TIMEZONE))

        limiter.check_and_increment(client_id, now=datetime(2026, 9, 21, 0, 1, tzinfo=limiter_module.INDIA_TIMEZONE))

    def test_health_endpoint_is_not_counted(self) -> None:
        with patch.object(limiter_module, "DAILY_REQUEST_LIMIT_GLOBAL", 1):
            health = self.client.get("/health")
            api_health = self.client.get("/api/health")

            with patch("app.routes.cross_modal.run_cross_modal_analysis", new=AsyncMock(return_value={"mode": "cross_modal", "final_answer": "ok"})):
                first = self.client.post(
                    "/api/cross-modal",
                    data={"query": "Compare"},
                    files={
                        "optical_image": ("optical.jpg", b"optical", "image/jpeg"),
                        "sar_image": ("sar.jpg", b"sar", "image/jpeg"),
                    },
                )

        self.assertEqual(health.status_code, 200)
        self.assertEqual(api_health.status_code, 200)
        self.assertEqual(first.status_code, 200)

    def test_location_endpoint_is_not_counted(self) -> None:
        with patch.object(limiter_module, "DAILY_REQUEST_LIMIT_GLOBAL", 1):
            general_location = self.client.get("/api/search/location?q=indore")
            with patch("app.routes.location_imagery.search_locations", new=AsyncMock(return_value=[{"name": "Indore"}])):
                satellite_location = self.client.get("/api/location/search?q=indore")

            with patch("app.routes.cross_modal.run_cross_modal_analysis", new=AsyncMock(return_value={"mode": "cross_modal", "final_answer": "ok"})):
                first = self.client.post(
                    "/api/cross-modal",
                    data={"query": "Compare"},
                    files={
                        "optical_image": ("optical.jpg", b"optical", "image/jpeg"),
                        "sar_image": ("sar.jpg", b"sar", "image/jpeg"),
                    },
                )

        self.assertEqual(general_location.status_code, 200)
        self.assertEqual(satellite_location.status_code, 200)
        self.assertEqual(first.status_code, 200)


if __name__ == "__main__":
    unittest.main()
