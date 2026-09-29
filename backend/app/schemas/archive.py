from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ArchiveIngestRequest(BaseModel):
    path: str = Field(..., min_length=1, max_length=1000)
    recursive: bool = True


class ArchiveItem(BaseModel):
    id: int
    scene_id: str | None = None
    filename: str
    file_path: str
    file_type: str
    file_size_bytes: int
    sha256: str
    width: int | None = None
    height: int | None = None
    band_count: int | None = None
    crs: str | None = None
    native_bounds_min_x: float | None = None
    native_bounds_min_y: float | None = None
    native_bounds_max_x: float | None = None
    native_bounds_max_y: float | None = None
    centroid_lat: float | None = None
    centroid_lon: float | None = None
    acquisition_datetime: str | None = None
    sensor: str | None = None
    source: str | None = None
    product_type: str | None = None
    cloud_cover: float | None = None
    metadata_json: dict[str, Any]
    ingested_at: str
    updated_at: str


class ArchiveItemsResponse(BaseModel):
    items: list[ArchiveItem]
    total: int
    limit: int
    offset: int
