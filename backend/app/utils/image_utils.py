import tempfile
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, UploadFile

from ..config import MAX_UPLOAD_BYTES

VALID_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".geotiff", ".webp"}


@dataclass(frozen=True)
class SavedUpload:
    path: str
    content: bytes
    filename: str
    content_type: str


async def save_upload_to_temp(upload: UploadFile | None, label: str) -> SavedUpload:
    if upload is None or not upload.filename:
        raise HTTPException(status_code=400, detail=f"{label} image file is required.")

    content = await upload.read()
    if not content:
        raise HTTPException(status_code=400, detail=f"{label} image file is empty.")

    if len(content) > MAX_UPLOAD_BYTES:
        max_size_mb = MAX_UPLOAD_BYTES / (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"{label} image must be {max_size_mb:.0f} MB or smaller.")

    content_type = upload.content_type or ""
    suffix = Path(upload.filename).suffix or ".jpg"
    if suffix.casefold() not in VALID_IMAGE_SUFFIXES and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"{label} must be a valid image file.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(content)
        temp_path = temp_file.name

    return SavedUpload(
        path=temp_path,
        content=content,
        filename=upload.filename,
        content_type=content_type,
    )
