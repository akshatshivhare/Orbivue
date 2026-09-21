from __future__ import annotations

import hashlib
import json
import os
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, Request

from ..config import (
    DAILY_REQUEST_LIMIT_CLIENT_SALT,
    DAILY_REQUEST_LIMIT_GLOBAL,
    DAILY_REQUEST_LIMIT_PER_CLIENT,
    DAILY_REQUEST_LIMIT_STATE_PATH,
)

try:
    INDIA_TIMEZONE = ZoneInfo("Asia/Kolkata")
except ZoneInfoNotFoundError:  # Windows test environments may not have the IANA tz database installed.
    INDIA_TIMEZONE = timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata")
PER_CLIENT_LIMIT_MESSAGE = "Daily analysis limit reached for this device/network. Please try again tomorrow."
GLOBAL_LIMIT_MESSAGE = "ORBIVUE demo has reached today's analysis limit. Please try again tomorrow."
LOCK_TIMEOUT_SECONDS = 5.0
STALE_LOCK_SECONDS = 30.0


def current_limit_day(now: datetime | None = None) -> str:
    current = now or datetime.now(INDIA_TIMEZONE)
    if current.tzinfo is None:
        current = current.replace(tzinfo=INDIA_TIMEZONE)
    return current.astimezone(INDIA_TIMEZONE).date().isoformat()


def client_identifier_from_request(request: Request) -> str | None:
    if request.client is None or not request.client.host:
        return None
    return _hash_client_host(request.client.host)


def enforce_daily_ai_request_limit(request: Request) -> None:
    client_id = client_identifier_from_request(request)
    limiter = DailyRequestLimiter()
    limiter.check_and_increment(client_id)


class DailyRequestLimiter:
    def __init__(
        self,
        *,
        state_path: str | Path | None = None,
        per_client_limit: int | None = None,
        global_limit: int | None = None,
    ) -> None:
        self.state_path = Path(state_path or DAILY_REQUEST_LIMIT_STATE_PATH)
        self.per_client_limit = DAILY_REQUEST_LIMIT_PER_CLIENT if per_client_limit is None else per_client_limit
        self.global_limit = DAILY_REQUEST_LIMIT_GLOBAL if global_limit is None else global_limit

    def check_and_increment(self, client_id: str | None, *, now: datetime | None = None) -> None:
        if self.per_client_limit <= 0 and self.global_limit <= 0:
            return

        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        with _file_lock(self.state_path):
            state = self._load_state()
            today = current_limit_day(now)
            if state.get("date") != today:
                state = _empty_state(today)

            global_count = _safe_int(state.get("global_count"))
            clients = state.setdefault("clients", {})
            if not isinstance(clients, dict):
                clients = {}
                state["clients"] = clients

            if self.global_limit > 0 and global_count >= self.global_limit:
                self._write_state(state)
                raise HTTPException(status_code=429, detail=GLOBAL_LIMIT_MESSAGE)

            if client_id and self.per_client_limit > 0:
                client_count = _safe_int(clients.get(client_id))
                if client_count >= self.per_client_limit:
                    self._write_state(state)
                    raise HTTPException(status_code=429, detail=PER_CLIENT_LIMIT_MESSAGE)
                clients[client_id] = client_count + 1

            state["global_count"] = global_count + 1
            self._write_state(state)

    def _load_state(self) -> dict[str, Any]:
        if not self.state_path.exists():
            return _empty_state(current_limit_day())

        try:
            payload = json.loads(self.state_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return _empty_state(current_limit_day())

        return payload if isinstance(payload, dict) else _empty_state(current_limit_day())

    def _write_state(self, state: dict[str, Any]) -> None:
        temp_path = self.state_path.with_suffix(f"{self.state_path.suffix}.tmp")
        temp_path.write_text(json.dumps(state, sort_keys=True), encoding="utf-8")
        os.replace(temp_path, self.state_path)


def _empty_state(day: str) -> dict[str, Any]:
    return {"date": day, "global_count": 0, "clients": {}}


def _hash_client_host(client_host: str) -> str:
    digest = hashlib.sha256(f"{DAILY_REQUEST_LIMIT_CLIENT_SALT}:{client_host}".encode("utf-8")).hexdigest()
    return digest


def _safe_int(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


@contextmanager
def _file_lock(state_path: Path) -> Iterator[None]:
    lock_path = state_path.with_suffix(f"{state_path.suffix}.lock")
    start = time.monotonic()
    lock_fd: int | None = None

    while True:
        try:
            lock_fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(lock_fd, str(os.getpid()).encode("utf-8"))
            break
        except FileExistsError:
            _remove_stale_lock(lock_path)
            if time.monotonic() - start > LOCK_TIMEOUT_SECONDS:
                raise HTTPException(status_code=503, detail="Daily analysis limit store is temporarily busy.")
            time.sleep(0.05)

    try:
        yield
    finally:
        if lock_fd is not None:
            os.close(lock_fd)
        lock_path.unlink(missing_ok=True)


def _remove_stale_lock(lock_path: Path) -> None:
    try:
        lock_age = time.time() - lock_path.stat().st_mtime
    except OSError:
        return

    if lock_age > STALE_LOCK_SECONDS:
        lock_path.unlink(missing_ok=True)
