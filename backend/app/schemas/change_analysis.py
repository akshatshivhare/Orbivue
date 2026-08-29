from typing import Literal, TypedDict

ChangeDirection = Literal[
    "increased",
    "decreased",
    "appeared",
    "disappeared",
    "modified",
    "unchanged",
    "uncertain",
]


class ChangeItem(TypedDict):
    category: str
    description: str
    direction: ChangeDirection
    confidence: float


class ChangeAnalysisResponse(TypedDict):
    mode: str
    summary: str
    final_answer: str
    changes: list[ChangeItem]
    unchanged: list[str]
    limitations: list[str]
    change_map: None
