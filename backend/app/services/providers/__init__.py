from pathlib import Path
from typing import Any, Literal, Protocol

from ...config import ANALYSIS_PROVIDER, GROUNDING_PROVIDER, TEMPORAL_PROVIDER
from ..gemini_client import GeminiAnalysisError

CoordinateOrder = Literal["yxyx", "xyxy"]
ProviderTask = Literal["analysis", "grounding", "temporal"]


class VisionProvider(Protocol):
    name: str
    model: str
    coordinate_order: CoordinateOrder

    def analyze_image(self, image_path: Path, prompt: str, user_query: str) -> str:
        ...

    def ground_image(self, image_path: Path, prompt: str, response_format: dict[str, Any] | None = None) -> str:
        ...

    def analyze_temporal(self, image_t1_path: Path, image_t2_path: Path, prompt: str) -> str:
        ...


_providers: dict[str, VisionProvider] = {}


def _provider_name_for_task(task: ProviderTask) -> str:
    if task == "analysis":
        return ANALYSIS_PROVIDER
    if task == "grounding":
        return GROUNDING_PROVIDER
    return TEMPORAL_PROVIDER


def _create_provider(provider_name: str) -> VisionProvider:
    if provider_name == "openrouter":
        from .openrouter_provider import OpenRouterVisionProvider

        return OpenRouterVisionProvider()

    if provider_name == "orbivue":
        from .orbivue_analysis_provider import OrbiVueVisionProvider

        return OrbiVueVisionProvider()

    if provider_name == "gemini":
        from .gemini_provider import GeminiVisionProvider

        return GeminiVisionProvider()

    raise GeminiAnalysisError(
        f"Unsupported vision provider: {provider_name}",
        error_type="unsupported_provider",
        user_message="Configured vision provider is not supported.",
    )


def get_vision_provider(task: ProviderTask = "analysis") -> VisionProvider:
    provider_name = _provider_name_for_task(task)

    if provider_name == "orbivue" and task != "analysis":
        raise GeminiAnalysisError(
            f"OrbiVue provider is not supported for {task} requests yet.",
            error_type="unsupported_provider",
            user_message=f"OrbiVue provider is not supported for {task} requests yet.",
        )

    if provider_name not in _providers:
        _providers[provider_name] = _create_provider(provider_name)
        print("[SatQuery Provider] vision provider:", _providers[provider_name].name)

    return _providers[provider_name]


def get_analysis_provider() -> VisionProvider:
    return get_vision_provider("analysis")


def get_grounding_provider() -> VisionProvider:
    return get_vision_provider("grounding")


def get_temporal_provider() -> VisionProvider:
    return get_vision_provider("temporal")
