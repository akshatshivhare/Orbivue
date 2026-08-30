from pathlib import Path
from typing import Any, Literal, Protocol

from ...config import VISION_PROVIDER

CoordinateOrder = Literal["yxyx", "xyxy"]


class VisionProvider(Protocol):
    name: str
    model: str
    coordinate_order: CoordinateOrder

    def analyze_image(self, image_path: Path, prompt: str) -> str:
        ...

    def ground_image(self, image_path: Path, prompt: str, response_format: dict[str, Any] | None = None) -> str:
        ...

    def analyze_temporal(self, image_t1_path: Path, image_t2_path: Path, prompt: str) -> str:
        ...


_provider: VisionProvider | None = None


def get_vision_provider() -> VisionProvider:
    global _provider

    if _provider is not None:
        return _provider

    if VISION_PROVIDER == "openrouter":
        from .openrouter_provider import OpenRouterVisionProvider

        _provider = OpenRouterVisionProvider()
    else:
        from .gemini_provider import GeminiVisionProvider

        _provider = GeminiVisionProvider()

    print("[SatQuery Provider] vision provider:", _provider.name)
    return _provider
