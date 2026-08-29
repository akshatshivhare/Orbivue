from typing import Any

from pydantic import BaseModel, Field


class DemoLoginRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: str | None = Field(default=None, max_length=120)


class ImageInput(BaseModel):
    id: str
    name: str
    format: str | None = None
    modality: str | None = None
    role: str | None = None
    size: int | None = None
    date: str | None = None


class AnalyzeRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=600)
    image_path: str | None = None
    inputs: list[ImageInput] = Field(default_factory=list)
    location: dict[str, Any] | None = None
    mode: str = "upload"
