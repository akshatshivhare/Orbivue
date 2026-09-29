from __future__ import annotations

from pathlib import Path
from contextlib import contextmanager
import json
import sqlite3
from typing import Any

from .. import config


ARCHIVE_COLUMNS = [
    "id",
    "scene_id",
    "filename",
    "file_path",
    "file_type",
    "file_size_bytes",
    "sha256",
    "width",
    "height",
    "band_count",
    "crs",
    "native_bounds_min_x",
    "native_bounds_min_y",
    "native_bounds_max_x",
    "native_bounds_max_y",
    "centroid_lat",
    "centroid_lon",
    "acquisition_datetime",
    "sensor",
    "source",
    "product_type",
    "cloud_cover",
    "metadata_json",
    "ingested_at",
    "updated_at",
]


class ArchiveCatalog:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = Path(db_path or config.ORBIVUE_ARCHIVE_DB_PATH).expanduser()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    @contextmanager
    def _connection(self) -> Any:
        connection = self._connect()
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _ensure_schema(self) -> None:
        with self._connection() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS archive_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scene_id TEXT,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL UNIQUE,
                    file_type TEXT NOT NULL,
                    file_size_bytes INTEGER NOT NULL,
                    sha256 TEXT NOT NULL UNIQUE,
                    width INTEGER,
                    height INTEGER,
                    band_count INTEGER,
                    crs TEXT,
                    native_bounds_min_x REAL,
                    native_bounds_min_y REAL,
                    native_bounds_max_x REAL,
                    native_bounds_max_y REAL,
                    centroid_lat REAL,
                    centroid_lon REAL,
                    acquisition_datetime TEXT,
                    sensor TEXT,
                    source TEXT,
                    product_type TEXT,
                    cloud_cover REAL,
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    ingested_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute("CREATE INDEX IF NOT EXISTS idx_archive_sensor ON archive_items(sensor)")
            connection.execute("CREATE INDEX IF NOT EXISTS idx_archive_source ON archive_items(source)")
            connection.execute("CREATE INDEX IF NOT EXISTS idx_archive_acquired ON archive_items(acquisition_datetime)")

    def get_by_path(self, file_path: str) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM archive_items WHERE file_path = ?",
                (file_path,),
            ).fetchone()
        return _row_to_dict(row)

    def get_by_sha256(self, sha256: str) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM archive_items WHERE sha256 = ?",
                (sha256,),
            ).fetchone()
        return _row_to_dict(row)

    def insert(self, record: dict[str, Any]) -> dict[str, Any]:
        values = _record_values(record)
        insert_columns = [column for column in ARCHIVE_COLUMNS if column != "id"]
        placeholders = ", ".join("?" for _ in insert_columns)
        with self._connection() as connection:
            cursor = connection.execute(
                f"INSERT INTO archive_items ({', '.join(insert_columns)}) VALUES ({placeholders})",
                [values[column] for column in insert_columns],
            )
            item_id = int(cursor.lastrowid)
        item = self.get_item(item_id)
        if item is None:  # pragma: no cover - defensive guard for unexpected sqlite behavior.
            raise RuntimeError("Archive item was inserted but could not be read back.")
        return item

    def update_by_path(self, file_path: str, record: dict[str, Any]) -> dict[str, Any]:
        values = _record_values(record)
        update_columns = [column for column in ARCHIVE_COLUMNS if column not in {"id", "file_path", "ingested_at"}]
        assignments = ", ".join(f"{column} = ?" for column in update_columns)
        with self._connection() as connection:
            connection.execute(
                f"UPDATE archive_items SET {assignments} WHERE file_path = ?",
                [values[column] for column in update_columns] + [file_path],
            )
        item = self.get_by_path(file_path)
        if item is None:  # pragma: no cover - defensive guard for unexpected sqlite behavior.
            raise RuntimeError("Archive item was updated but could not be read back.")
        return item

    def get_item(self, item_id: int) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM archive_items WHERE id = ?",
                (item_id,),
            ).fetchone()
        return _row_to_dict(row)

    def list_items(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        sensor: str | None = None,
        source: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict[str, Any]:
        where: list[str] = []
        params: list[Any] = []

        if sensor:
            where.append("sensor = ?")
            params.append(sensor)
        if source:
            where.append("source = ?")
            params.append(source)
        if date_from:
            where.append("acquisition_datetime >= ?")
            params.append(date_from)
        if date_to:
            where.append("acquisition_datetime <= ?")
            params.append(date_to)

        where_sql = f"WHERE {' AND '.join(where)}" if where else ""
        safe_limit = max(1, min(limit, 200))
        safe_offset = max(0, offset)

        with self._connection() as connection:
            total = connection.execute(
                f"SELECT COUNT(*) FROM archive_items {where_sql}",
                params,
            ).fetchone()[0]
            rows = connection.execute(
                f"""
                SELECT * FROM archive_items
                {where_sql}
                ORDER BY COALESCE(acquisition_datetime, ingested_at) DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                params + [safe_limit, safe_offset],
            ).fetchall()

        return {
            "items": [_row_to_dict(row) for row in rows],
            "total": int(total),
            "limit": safe_limit,
            "offset": safe_offset,
        }

    def status(self) -> dict[str, Any]:
        with self._connection() as connection:
            total = connection.execute("SELECT COUNT(*) FROM archive_items").fetchone()[0]
            sensors = [
                row[0]
                for row in connection.execute(
                    "SELECT DISTINCT sensor FROM archive_items WHERE sensor IS NOT NULL ORDER BY sensor"
                ).fetchall()
            ]
            sources = [
                row[0]
                for row in connection.execute(
                    "SELECT DISTINCT source FROM archive_items WHERE source IS NOT NULL ORDER BY source"
                ).fetchall()
            ]
        return {
            "status": "ok",
            "item_count": int(total),
            "db_path": str(self.db_path),
            "sensors": sensors,
            "sources": sources,
        }


def _record_values(record: dict[str, Any]) -> dict[str, Any]:
    values = {column: record.get(column) for column in ARCHIVE_COLUMNS}
    values["metadata_json"] = json.dumps(record.get("metadata_json") or {}, sort_keys=True)
    return values


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None

    item = {column: row[column] for column in ARCHIVE_COLUMNS}
    try:
        item["metadata_json"] = json.loads(item["metadata_json"] or "{}")
    except json.JSONDecodeError:
        item["metadata_json"] = {}
    return item
