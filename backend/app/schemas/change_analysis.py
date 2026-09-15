from typing import Literal, NotRequired, TypedDict

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


class ChangeGuardMetadata(TypedDict, total=False):
    status: str
    qwen_called: bool
    exact_match: bool
    mean_absolute_difference: float | None
    changed_pixel_fraction: float | None
    pixel_change_threshold: float
    near_identical_mean_threshold: float
    near_identical_fraction_threshold: float
    semantic_verification: str
    original_size_t1: list[int]
    original_size_t2: list[int]
    comparison_size: list[int]
    dimension_normalized: bool
    normalization_method: str
    aspect_ratio_t1: float
    aspect_ratio_t2: float
    aspect_ratio_relative_difference: float
    alignment_warning: str | None


class ChangeAnalysisResponse(TypedDict):
    mode: str
    summary: str
    final_answer: str
    changes: list[ChangeItem]
    unchanged: list[str]
    limitations: list[str]
    change_map: None
    change_guard: NotRequired[ChangeGuardMetadata]
