from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
from typing import Any

from .archive_catalog import ArchiveCatalog


SUPPORTED_EXTENSIONS = {".tif", ".tiff", ".png", ".jpg", ".jpeg"}
SIDECAR_FIELDS = {
    "scene_id",
    "acquisition_datetime",
    "sensor",
    "source",
    "product_type",
    "cloud_cover",
}


@dataclass(frozen=True)
class IngestResult:
    path: str
    status: str
    reason: str | None = None
    id: int | None = None
    duplicate_of_id: int | None = None
    warnings: list[str] | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            key: value
            for key, value in {
                "path": self.path,
                "status": self.status,
                "reason": self.reason,
                "id": self.id,
                "duplicate_of_id": self.duplicate_of_id,
                "warnings": self.warnings or [],
            }.items()
            if value not in (None, [])
        }


class ArchiveIngestionService:
    def __init__(self, catalog: ArchiveCatalog | None = None) -> None:
        self.catalog = catalog or ArchiveCatalog()

    def ingest_path(self, path: Path, *, recursive: bool = True) -> dict[str, Any]:
        if path.is_file():
            results = [self.ingest_file(path).as_dict()]
        elif path.is_dir():
            pattern = "**/*" if recursive else "*"
            results = [
                self.ingest_file(candidate).as_dict()
                for candidate in sorted(path.glob(pattern))
                if candidate.is_file() and not _is_sidecar_file(candidate)
            ]
        else:
            results = [
                IngestResult(
                    path=str(path),
                    status="error",
                    reason="Path does not exist or is not readable.",
                ).as_dict()
            ]

        summary: dict[str, int] = {}
        for result in results:
            status = str(result["status"])
            summary[status] = summary.get(status, 0) + 1

        return {
            "status": "ok",
            "root": str(path),
            "recursive": recursive,
            "summary": summary,
            "results": results,
        }

    def ingest_file(self, path: Path) -> IngestResult:
        resolved_path = path.expanduser().resolve()
        if resolved_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            return IngestResult(
                path=str(resolved_path),
                status="unsupported",
                reason="Unsupported archive file type.",
            )

        try:
            sha256 = _sha256(resolved_path)
            file_path = str(resolved_path)
            existing_at_path = self.catalog.get_by_path(file_path)
            existing_by_hash = self.catalog.get_by_sha256(sha256)

            if existing_at_path and existing_at_path["sha256"] == sha256:
                return IngestResult(
                    path=file_path,
                    status="skipped",
                    reason="File already ingested with the same checksum.",
                    id=int(existing_at_path["id"]),
                )

            if existing_by_hash and existing_by_hash["file_path"] != file_path:
                return IngestResult(
                    path=file_path,
                    status="duplicate_content",
                    reason="Same content already exists at another archive path.",
                    duplicate_of_id=int(existing_by_hash["id"]),
                )

            metadata, warnings = extract_metadata(resolved_path)
            record = {
                **metadata,
                "filename": resolved_path.name,
                "file_path": file_path,
                "file_size_bytes": resolved_path.stat().st_size,
                "sha256": sha256,
            }

            now = datetime.now(timezone.utc).isoformat()
            if existing_at_path:
                record["ingested_at"] = existing_at_path["ingested_at"]
                record["updated_at"] = now
                item = self.catalog.update_by_path(file_path, record)
                return IngestResult(path=file_path, status="updated", id=int(item["id"]), warnings=warnings)

            record["ingested_at"] = now
            record["updated_at"] = now
            item = self.catalog.insert(record)
            return IngestResult(path=file_path, status="ingested", id=int(item["id"]), warnings=warnings)
        except Exception as exc:  # Batch ingestion should continue on per-file failures.
            return IngestResult(path=str(resolved_path), status="error", reason=str(exc))


def extract_metadata(path: Path) -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    file_type = _file_type(path)
    base: dict[str, Any] = {
        "scene_id": None,
        "file_type": file_type,
        "width": None,
        "height": None,
        "band_count": None,
        "crs": None,
        "native_bounds_min_x": None,
        "native_bounds_min_y": None,
        "native_bounds_max_x": None,
        "native_bounds_max_y": None,
        "centroid_lat": None,
        "centroid_lon": None,
        "acquisition_datetime": None,
        "sensor": None,
        "source": None,
        "product_type": None,
        "cloud_cover": None,
    }

    intrinsic_metadata: dict[str, Any]
    if path.suffix.lower() in {".tif", ".tiff"}:
        intrinsic_metadata, extraction_warnings = _extract_raster_metadata(path)
    else:
        intrinsic_metadata, extraction_warnings = _extract_image_metadata(path)
    warnings.extend(extraction_warnings)
    base["file_type"] = intrinsic_metadata.get("file_type") or file_type
    _merge_missing(base, intrinsic_metadata)

    sidecar, sidecar_warnings = _load_sidecar(path)
    warnings.extend(sidecar_warnings)
    _merge_missing(base, sidecar)

    base["metadata_json"] = {
        "intrinsic": intrinsic_metadata,
        "sidecar": sidecar,
        "warnings": warnings,
    }
    return base, warnings


def _extract_raster_metadata(path: Path) -> tuple[dict[str, Any], list[str]]:
    try:
        import rasterio
        from rasterio.warp import transform as transform_coordinates
    except ImportError:
        image_metadata, warnings = _extract_image_metadata(path)
        warnings.append("rasterio is not installed; geospatial metadata could not be read.")
        return image_metadata, warnings

    with rasterio.open(path) as dataset:
        bounds = dataset.bounds
        is_georeferenced = _raster_dataset_is_georeferenced(dataset)
        metadata: dict[str, Any] = {
            "file_type": "geotiff" if is_georeferenced else "tiff",
            "width": dataset.width,
            "height": dataset.height,
            "band_count": dataset.count,
            "crs": str(dataset.crs) if dataset.crs else None,
            "native_bounds_min_x": bounds.left,
            "native_bounds_min_y": bounds.bottom,
            "native_bounds_max_x": bounds.right,
            "native_bounds_max_y": bounds.top,
        }

        native_centroid_x = (bounds.left + bounds.right) / 2
        native_centroid_y = (bounds.bottom + bounds.top) / 2
        if dataset.crs:
            try:
                lon_values, lat_values = transform_coordinates(
                    dataset.crs,
                    "EPSG:4326",
                    [native_centroid_x],
                    [native_centroid_y],
                )
                metadata["centroid_lon"] = float(lon_values[0])
                metadata["centroid_lat"] = float(lat_values[0])
            except Exception:
                metadata["centroid_lon"] = None
                metadata["centroid_lat"] = None

        tags = {key.lower(): value for key, value in dataset.tags().items()}
        metadata["scene_id"] = _first_value(tags, ["scene_id", "sceneid", "id"])
        metadata["acquisition_datetime"] = _first_value(
            tags,
            ["acquisition_datetime", "acquisition_date", "datetime", "date", "time_start"],
        )
        metadata["sensor"] = _first_value(tags, ["sensor", "platform", "instrument"])
        metadata["source"] = _first_value(tags, ["source", "provider"])
        metadata["product_type"] = _first_value(tags, ["product_type", "product"])
        metadata["cloud_cover"] = _parse_float(_first_value(tags, ["cloud_cover", "cloudcover"]))
        metadata["raster_tags"] = tags
        return metadata, []


def _extract_image_metadata(path: Path) -> tuple[dict[str, Any], list[str]]:
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Pillow is required to inspect PNG/JPEG archive files.") from exc

    with Image.open(path) as image:
        metadata: dict[str, Any] = {
            "file_type": image.format.lower() if image.format else path.suffix.lower().lstrip("."),
            "width": image.width,
            "height": image.height,
            "band_count": len(image.getbands()),
            "image_mode": image.mode,
        }
        try:
            exif = image.getexif()
            if exif:
                metadata["exif"] = {str(key): str(value) for key, value in exif.items()}
        except Exception:
            metadata["exif"] = {}
    return metadata, []


def _load_sidecar(path: Path) -> tuple[dict[str, Any], list[str]]:
    sidecar_path = path.with_suffix(".json")
    if not sidecar_path.exists():
        return {}, []

    try:
        payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {}, [f"Sidecar metadata could not be read: {exc}"]

    if not isinstance(payload, dict):
        return {}, ["Sidecar metadata must be a JSON object."]

    cleaned: dict[str, Any] = {}
    warnings: list[str] = []
    for field in SIDECAR_FIELDS:
        if field not in payload:
            continue
        value = payload[field]
        if value in (None, ""):
            continue
        if field == "cloud_cover":
            cloud_cover = _parse_float(value)
            if cloud_cover is None:
                warnings.append("Sidecar cloud_cover was ignored because it is not numeric.")
                continue
            cleaned[field] = cloud_cover
        else:
            cleaned[field] = str(value)
    return cleaned, warnings


def _merge_missing(target: dict[str, Any], source: dict[str, Any]) -> None:
    for key in target:
        if target[key] is None and source.get(key) is not None:
            target[key] = source[key]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _file_type(path: Path) -> str:
    extension = path.suffix.lower()
    if extension in {".tif", ".tiff"}:
        return "tiff"
    if extension in {".jpg", ".jpeg"}:
        return "jpeg"
    return extension.lstrip(".")


def _is_sidecar_file(path: Path) -> bool:
    return path.suffix.lower() == ".json"


def _raster_dataset_is_georeferenced(dataset: Any) -> bool:
    if dataset.crs:
        return True

    try:
        transform = dataset.transform
        if transform and not transform.is_identity:
            return True
    except Exception:
        pass

    try:
        gcps_value = dataset.gcps
        gcps, gcp_crs = gcps_value() if callable(gcps_value) else gcps_value
        if gcps or gcp_crs:
            return True
    except Exception:
        pass

    return False


def _first_value(values: dict[str, Any], keys: list[str]) -> str | None:
    for key in keys:
        value = values.get(key)
        if value not in (None, ""):
            return str(value)
    return None


def _parse_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
