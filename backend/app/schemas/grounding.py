from typing import TypedDict

from pydantic import BaseModel, Field


class GeminiBoundingBox(BaseModel):
    box_2d: list[int] = Field(..., min_length=4, max_length=4)
    label: str


class GroundingBox(TypedDict):
    label: str
    box: list[float]


class GroundingResponse(TypedDict):
    mode: str
    final_answer: str
    bounding_boxes: list[GroundingBox]
