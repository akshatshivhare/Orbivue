from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from .. import config
from ..schemas.archive import ArchiveIngestRequest, ArchiveItem, ArchiveItemsResponse
from ..services.archive_catalog import ArchiveCatalog
from ..services.archive_ingestion import ArchiveIngestionService, SUPPORTED_EXTENSIONS

router = APIRouter()


@router.get("/api/archive/status")
def archive_status() -> dict[str, object]:
    catalog = ArchiveCatalog(config.ORBIVUE_ARCHIVE_DB_PATH)
    return {
        **catalog.status(),
        "archive_root": str(_archive_root()),
        "supported_extensions": sorted(SUPPORTED_EXTENSIONS),
    }


@router.post("/api/archive/ingest")
def ingest_archive(payload: ArchiveIngestRequest) -> dict[str, object]:
    ingest_path = _resolve_archive_path(payload.path)
    catalog = ArchiveCatalog(config.ORBIVUE_ARCHIVE_DB_PATH)
    service = ArchiveIngestionService(catalog)
    return service.ingest_path(ingest_path, recursive=payload.recursive)


@router.get("/api/archive/items", response_model=ArchiveItemsResponse)
def list_archive_items(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sensor: str | None = Query(None, min_length=1, max_length=120),
    source: str | None = Query(None, min_length=1, max_length=120),
    date_from: str | None = Query(None, min_length=1, max_length=80),
    date_to: str | None = Query(None, min_length=1, max_length=80),
) -> dict[str, object]:
    catalog = ArchiveCatalog(config.ORBIVUE_ARCHIVE_DB_PATH)
    return catalog.list_items(
        limit=limit,
        offset=offset,
        sensor=sensor,
        source=source,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/api/archive/items/{item_id}", response_model=ArchiveItem)
def get_archive_item(item_id: int) -> dict[str, object]:
    catalog = ArchiveCatalog(config.ORBIVUE_ARCHIVE_DB_PATH)
    item = catalog.get_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Archive item not found.")
    return item


def _archive_root() -> Path:
    return Path(config.ORBIVUE_ARCHIVE_ROOT).expanduser().resolve()


def _resolve_archive_path(requested_path: str) -> Path:
    root = _archive_root()
    candidate = Path(requested_path).expanduser()
    if not candidate.is_absolute():
        candidate = root / candidate

    resolved = candidate.resolve()
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="Archive ingest path must stay inside ORBIVUE_ARCHIVE_ROOT.") from exc

    if not resolved.exists():
        raise HTTPException(status_code=404, detail="Archive ingest path does not exist.")

    return resolved
