from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.routes import archive as archive_route
from app.services.archive_catalog import ArchiveCatalog
from app.services.archive_ingestion import ArchiveIngestionService

try:
    from PIL import Image
except ImportError:  # pragma: no cover - dependency is declared for the app.
    Image = None


@unittest.skipIf(Image is None, "Pillow is required for archive ingestion image tests.")
class ArchiveIngestionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "archive_data"
        self.root.mkdir()
        self.db_path = Path(self.temp_dir.name) / "archive.db"
        self.catalog = ArchiveCatalog(self.db_path)
        self.service = ArchiveIngestionService(self.catalog)
        self.addCleanup(self.temp_dir.cleanup)

    def test_png_metadata_is_ingested(self) -> None:
        image_path = self._write_image("scene.png", size=(8, 5))

        result = self.service.ingest_file(image_path)
        item = self.catalog.get_item(result.id or 0)

        self.assertEqual(result.status, "ingested")
        self.assertIsNotNone(item)
        self.assertEqual(item["width"], 8)
        self.assertEqual(item["height"], 5)
        self.assertEqual(item["band_count"], 3)
        self.assertIsNone(item["centroid_lat"])
        self.assertIsNone(item["centroid_lon"])

    def test_jpeg_sidecar_metadata_fills_missing_fields(self) -> None:
        image_path = self._write_image("scene.jpg")
        image_path.with_suffix(".json").write_text(
            json.dumps(
                {
                    "scene_id": "S2A_DEMO_001",
                    "acquisition_datetime": "2026-09-20T05:30:00Z",
                    "sensor": "Sentinel-2",
                    "source": "demo-archive",
                    "product_type": "L2A",
                    "cloud_cover": 7.5,
                }
            ),
            encoding="utf-8",
        )

        result = self.service.ingest_file(image_path)
        item = self.catalog.get_item(result.id or 0)

        self.assertEqual(result.status, "ingested")
        self.assertEqual(item["scene_id"], "S2A_DEMO_001")
        self.assertEqual(item["sensor"], "Sentinel-2")
        self.assertEqual(item["source"], "demo-archive")
        self.assertEqual(item["cloud_cover"], 7.5)

    def test_duplicate_same_path_is_skipped(self) -> None:
        image_path = self._write_image("scene.png")

        first = self.service.ingest_file(image_path)
        second = self.service.ingest_file(image_path)

        self.assertEqual(first.status, "ingested")
        self.assertEqual(second.status, "skipped")
        self.assertEqual(first.id, second.id)

    def test_same_checksum_different_path_is_duplicate_content(self) -> None:
        image_path = self._write_image("scene.png")
        duplicate_path = self.root / "copy.png"
        duplicate_path.write_bytes(image_path.read_bytes())

        first = self.service.ingest_file(image_path)
        duplicate = self.service.ingest_file(duplicate_path)

        self.assertEqual(first.status, "ingested")
        self.assertEqual(duplicate.status, "duplicate_content")
        self.assertEqual(duplicate.duplicate_of_id, first.id)

    def test_changed_same_path_updates_record(self) -> None:
        image_path = self._write_image("scene.png", size=(4, 4), color=(10, 20, 30))
        first = self.service.ingest_file(image_path)
        Image.new("RGB", (7, 6), (90, 20, 10)).save(image_path)

        second = self.service.ingest_file(image_path)
        item = self.catalog.get_item(first.id or 0)

        self.assertEqual(second.status, "updated")
        self.assertEqual(first.id, second.id)
        self.assertEqual(item["width"], 7)
        self.assertEqual(item["height"], 6)

    def test_directory_ingestion_skips_unsupported_and_malformed_sidecar(self) -> None:
        self._write_image("valid.png")
        self._write_image("bad_sidecar.jpg").with_suffix(".json").write_text("{not-json", encoding="utf-8")
        (self.root / "notes.txt").write_text("not imagery", encoding="utf-8")

        result = self.service.ingest_path(self.root)
        statuses = [item["status"] for item in result["results"]]

        self.assertEqual(result["summary"]["ingested"], 2)
        self.assertEqual(result["summary"]["unsupported"], 1)
        self.assertIn("unsupported", statuses)
        warning_result = next(item for item in result["results"] if item["path"].endswith("bad_sidecar.jpg"))
        self.assertTrue(warning_result["warnings"])

    def test_archive_filters(self) -> None:
        first = self._write_image("sentinel.png", color=(1, 2, 3))
        first.with_suffix(".json").write_text(json.dumps({"sensor": "Sentinel-2", "source": "local"}), encoding="utf-8")
        second = self._write_image("landsat.png", color=(4, 5, 6))
        second.with_suffix(".json").write_text(json.dumps({"sensor": "Landsat", "source": "local"}), encoding="utf-8")
        self.service.ingest_path(self.root)

        filtered = self.catalog.list_items(sensor="Sentinel-2")

        self.assertEqual(filtered["total"], 1)
        self.assertEqual(filtered["items"][0]["filename"], "sentinel.png")

    def test_api_rejects_ingest_outside_archive_root(self) -> None:
        client = TestClient(app)
        outside = Path(self.temp_dir.name) / "outside.png"
        Image.new("RGB", (2, 2)).save(outside)

        with (
            patch.object(config, "ORBIVUE_ARCHIVE_ROOT", str(self.root)),
            patch.object(config, "ORBIVUE_ARCHIVE_DB_PATH", str(self.db_path)),
            patch.object(archive_route.config, "ORBIVUE_ARCHIVE_ROOT", str(self.root)),
            patch.object(archive_route.config, "ORBIVUE_ARCHIVE_DB_PATH", str(self.db_path)),
        ):
            response = client.post("/api/archive/ingest", json={"path": str(outside)})

        self.assertEqual(response.status_code, 403)

    def test_api_lists_ingested_items(self) -> None:
        client = TestClient(app)
        image_path = self._write_image("scene.png")

        with (
            patch.object(config, "ORBIVUE_ARCHIVE_ROOT", str(self.root)),
            patch.object(config, "ORBIVUE_ARCHIVE_DB_PATH", str(self.db_path)),
            patch.object(archive_route.config, "ORBIVUE_ARCHIVE_ROOT", str(self.root)),
            patch.object(archive_route.config, "ORBIVUE_ARCHIVE_DB_PATH", str(self.db_path)),
        ):
            ingest = client.post("/api/archive/ingest", json={"path": image_path.name})
            listing = client.get("/api/archive/items")

        self.assertEqual(ingest.status_code, 200)
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()["total"], 1)

    def test_geotiff_metadata_is_ingested_when_rasterio_is_available(self) -> None:
        try:
            import numpy
            import rasterio
            from rasterio.transform import from_origin
        except ImportError:
            self.skipTest("rasterio/numpy are not available in this environment.")

        image_path = self.root / "scene.tif"
        data = numpy.ones((1, 4, 3), dtype="uint8")
        with rasterio.open(
            image_path,
            "w",
            driver="GTiff",
            height=4,
            width=3,
            count=1,
            dtype="uint8",
            crs="EPSG:4326",
            transform=from_origin(75.0, 23.0, 0.1, 0.1),
        ) as dataset:
            dataset.write(data)

        result = self.service.ingest_file(image_path)
        item = self.catalog.get_item(result.id or 0)

        self.assertEqual(result.status, "ingested")
        self.assertEqual(item["file_type"], "geotiff")
        self.assertEqual(item["crs"], "EPSG:4326")
        self.assertIsNotNone(item["centroid_lat"])
        self.assertIsNotNone(item["centroid_lon"])

    def _write_image(
        self,
        name: str,
        *,
        size: tuple[int, int] = (3, 2),
        color: tuple[int, int, int] = (12, 34, 56),
    ) -> Path:
        path = self.root / name
        Image.new("RGB", size, color).save(path)
        return path


if __name__ == "__main__":
    unittest.main()
