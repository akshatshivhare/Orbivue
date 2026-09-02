from datetime import date, timedelta, timezone, datetime
import unittest
from unittest.mock import AsyncMock, patch

from app.services.nasa_cmr import (
    NASA_ARCHIVE_DATASET,
    NASA_NRT_DATASET,
    LOCATION_IMAGERY_MAX_RANGE_DAYS,
    build_aoi_bbox,
    extract_unique_granule_dates,
    nasa_metadata,
    select_latest_preview_date,
    validate_date_range,
    _query_merged_archive_and_nrt_dates,
)
from app.services.sentinel2 import (
    SENTINEL2_COLLECTION,
    Sentinel2NoScenesError,
    Sentinel2Scene,
    cloud_quality,
    deduplicate_scenes_by_date,
    select_best_latest_scene,
    sentinel2_metadata,
)
from app.services.copernicus_auth import CopernicusAuthError, copernicus_configured, get_copernicus_access_token


class LocationImageryTests(unittest.TestCase):
    def test_build_aoi_bbox_uses_west_south_east_north_order(self) -> None:
        west, south, east, north = build_aoi_bbox(23.25, 77.41, size_km=25)

        self.assertLess(west, 77.41)
        self.assertLess(south, 23.25)
        self.assertGreater(east, 77.41)
        self.assertGreater(north, 23.25)

    def test_extract_unique_granule_dates_deduplicates_and_sorts(self) -> None:
        payload = {
            "feed": {
                "entry": [
                    {"time_start": "2026-08-29T12:30:00.000Z"},
                    {"time_start": "2026-08-28T02:00:00.000Z"},
                    {"time_start": "2026-08-29T20:10:00.000Z"},
                    {"time_start": "not-a-date"},
                ]
            }
        }

        self.assertEqual(extract_unique_granule_dates(payload), ["2026-08-28", "2026-08-29"])

    def test_validate_date_range_rejects_inverted_range(self) -> None:
        with self.assertRaises(ValueError):
            validate_date_range(date(2026, 8, 30), date(2026, 8, 29))

    def test_validate_date_range_rejects_future_end_date(self) -> None:
        tomorrow = datetime.now(timezone.utc).date() + timedelta(days=1)

        with self.assertRaises(ValueError):
            validate_date_range(tomorrow, tomorrow)

    def test_validate_date_range_rejects_too_large_range(self) -> None:
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=LOCATION_IMAGERY_MAX_RANGE_DAYS + 1)

        with self.assertRaises(ValueError):
            validate_date_range(start, today)

    def test_nasa_metadata_identifies_archive_and_nrt_datasets(self) -> None:
        metadata = nasa_metadata()

        self.assertEqual(metadata["archive_dataset"], NASA_ARCHIVE_DATASET)
        self.assertEqual(metadata["near_real_time_dataset"], NASA_NRT_DATASET)

    def test_merged_archive_and_nrt_dates_are_deduplicated(self) -> None:
        async def run_test() -> list[str]:
            async def fake_query(_bbox, _start, _end, dataset=NASA_NRT_DATASET):
                if dataset == NASA_ARCHIVE_DATASET:
                    return ["2026-05-15", "2026-05-16"]
                return ["2026-05-16", "2026-05-17"]

            with patch("app.services.nasa_cmr._query_cmr_available_dates", side_effect=fake_query):
                return await _query_merged_archive_and_nrt_dates([77.2, 23.1, 77.5, 23.4], date(2026, 5, 15), date(2026, 5, 17))

        import asyncio

        self.assertEqual(asyncio.run(run_test()), ["2026-05-15", "2026-05-16", "2026-05-17"])

    def test_latest_preview_prefers_newest_nonblank_candidate(self) -> None:
        async def run_test() -> dict[str, str | None]:
            with (
                patch("app.services.nasa_cmr.get_nrt_available_dates", new=AsyncMock(return_value=["2026-08-29", "2026-08-30", "2026-08-31"])),
                patch("app.services.nasa_gibs.fetch_gibs_preview", new=AsyncMock(side_effect=[(b"blank", "image/jpeg"), (b"good", "image/jpeg")])),
                patch("app.services.nasa_gibs.preview_appears_blank", side_effect=[True, False]),
            ):
                return await select_latest_preview_date(23.25, 77.41)

        import asyncio

        self.assertEqual(
            asyncio.run(run_test()),
            {
                "latest_observation_date": "2026-08-31",
                "selected_preview_date": "2026-08-30",
                "preview_quality": "good",
            },
        )

    def test_sentinel2_cloud_quality_categories(self) -> None:
        self.assertEqual(cloud_quality(8.4), "good")
        self.assertEqual(cloud_quality(20.0), "good")
        self.assertEqual(cloud_quality(35.0), "fair")
        self.assertEqual(cloud_quality(75.0), "poor")
        self.assertEqual(cloud_quality(None), "unknown")

    def test_sentinel2_deduplicates_same_day_by_lowest_cloud_cover(self) -> None:
        scenes = [
            Sentinel2Scene("cloudy", "2026-08-28T05:00:00Z", "2026-08-28", 64.0),
            Sentinel2Scene("clearer", "2026-08-28T06:00:00Z", "2026-08-28", 6.3),
            Sentinel2Scene("other", "2026-08-29T06:00:00Z", "2026-08-29", 21.0),
        ]

        best_by_date = deduplicate_scenes_by_date(scenes)

        self.assertEqual(best_by_date["2026-08-28"].item_id, "clearer")
        self.assertEqual(sorted(best_by_date), ["2026-08-28", "2026-08-29"])

    def test_sentinel2_best_latest_prefers_newest_good_scene(self) -> None:
        scenes = [
            Sentinel2Scene("older-good", "2026-08-27T05:00:00Z", "2026-08-27", 8.0),
            Sentinel2Scene("newer-good", "2026-08-29T05:00:00Z", "2026-08-29", 12.0),
            Sentinel2Scene("newest-poor", "2026-08-31T05:00:00Z", "2026-08-31", 78.0),
        ]

        self.assertEqual(select_best_latest_scene(scenes).item_id, "newer-good")

    def test_sentinel2_best_latest_uses_newest_fair_when_no_good_scene(self) -> None:
        scenes = [
            Sentinel2Scene("older-fair", "2026-08-27T05:00:00Z", "2026-08-27", 42.0),
            Sentinel2Scene("newer-fair", "2026-08-29T05:00:00Z", "2026-08-29", 48.0),
            Sentinel2Scene("newest-poor", "2026-08-31T05:00:00Z", "2026-08-31", 78.0),
        ]

        self.assertEqual(select_best_latest_scene(scenes).item_id, "newer-fair")

    def test_sentinel2_metadata(self) -> None:
        metadata = sentinel2_metadata()

        self.assertEqual(metadata["provider"], "sentinel-2")
        self.assertEqual(metadata["collection"], SENTINEL2_COLLECTION)
        self.assertEqual(metadata["resolution_note"], "10 m RGB bands")

    def test_sentinel2_best_latest_raises_for_empty_scene_list(self) -> None:
        with self.assertRaises(Sentinel2NoScenesError):
            select_best_latest_scene([])

    def test_missing_copernicus_credentials_are_detected(self) -> None:
        async def run_test() -> None:
            with self.assertRaises(CopernicusAuthError):
                await get_copernicus_access_token()

        import asyncio

        with (
            patch("app.services.copernicus_auth.COPERNICUS_CLIENT_ID", None),
            patch("app.services.copernicus_auth.COPERNICUS_CLIENT_SECRET", None),
        ):
            self.assertFalse(copernicus_configured())
            asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main()
