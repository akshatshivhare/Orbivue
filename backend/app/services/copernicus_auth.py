import time
from dataclasses import dataclass
from typing import Any

from ..config import COPERNICUS_CLIENT_ID, COPERNICUS_CLIENT_SECRET, LOCATION_IMAGERY_USER_AGENT

COPERNICUS_TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
)
TOKEN_EXPIRY_SAFETY_SECONDS = 60

_cached_token: "CopernicusAccessToken | None" = None


class CopernicusAuthError(Exception):
    pass


@dataclass(frozen=True)
class CopernicusAccessToken:
    access_token: str
    expires_at: float


def copernicus_configured() -> bool:
    return bool(COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET)


async def get_copernicus_access_token() -> str:
    global _cached_token

    if not copernicus_configured():
        raise CopernicusAuthError("Copernicus credentials are not configured.")

    now = time.time()
    if _cached_token and _cached_token.expires_at - TOKEN_EXPIRY_SAFETY_SECONDS > now:
        return _cached_token.access_token

    started_at = time.perf_counter()
    try:
        import httpx

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(20.0, connect=8.0),
            headers={"User-Agent": LOCATION_IMAGERY_USER_AGENT},
        ) as client:
            response = await client.post(
                COPERNICUS_TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": COPERNICUS_CLIENT_ID,
                    "client_secret": COPERNICUS_CLIENT_SECRET,
                },
            )
    except httpx.TimeoutException as exc:
        raise CopernicusAuthError("Copernicus authentication timed out.") from exc
    except httpx.HTTPError as exc:
        raise CopernicusAuthError("Copernicus authentication could not reach the provider.") from exc

    print("[SatQuery Copernicus Auth] status:", response.status_code)
    print("[SatQuery Copernicus Auth] latency:", f"{time.perf_counter() - started_at:.3f}s")

    if response.status_code in {401, 403}:
        raise CopernicusAuthError("Copernicus credentials were rejected.")
    if response.status_code == 429:
        raise CopernicusAuthError("Copernicus authentication is rate limited.")
    if response.status_code >= 400:
        raise CopernicusAuthError("Copernicus authentication returned an error.")

    try:
        payload: Any = response.json()
    except ValueError as exc:
        raise CopernicusAuthError("Copernicus authentication returned invalid JSON.") from exc

    if not isinstance(payload, dict):
        raise CopernicusAuthError("Copernicus authentication returned an unexpected response.")

    access_token = payload.get("access_token")
    expires_in = payload.get("expires_in", 300)
    if not isinstance(access_token, str) or not access_token:
        raise CopernicusAuthError("Copernicus authentication did not return an access token.")

    try:
        expires_in_seconds = max(60, int(expires_in))
    except (TypeError, ValueError):
        expires_in_seconds = 300

    _cached_token = CopernicusAccessToken(
        access_token=access_token,
        expires_at=now + expires_in_seconds,
    )
    return access_token
