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


_providers: dict[tuple[ProviderTask, str], VisionProvider] = {}


def _provider_name_for_task(task: ProviderTask) -> str:
    if task == "analysis":
        return ANALYSIS_PROVIDER
    if task == "grounding":
        return GROUNDING_PROVIDER
    return TEMPORAL_PROVIDER


def _create_provider(provider_name: str, task: ProviderTask) -> VisionProvider:
    if provider_name == "openrouter":
        from .openrouter_provider import OpenRouterVisionProvider

        return OpenRouterVisionProvider()

    if provider_name == "orbivue":
        if task == "analysis":
            from .orbivue_analysis_provider import OrbiVueVisionProvider

            return OrbiVueVisionProvider()

        if task == "grounding":
            from .orbivue_grounding_provider import OrbiVueGroundingProvider

            return OrbiVueGroundingProvider()

        raise GeminiAnalysisError(
            "OrbiVue provider is not supported for temporal requests yet.",
            error_type="unsupported_provider",
            user_message="OrbiVue provider is not supported for temporal requests yet.",
        )

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
    provider_key = (task, provider_name)

    if provider_key not in _providers:
        _providers[provider_key] = _create_provider(provider_name, task)
        print("[SatQuery Provider] vision provider:", _providers[provider_key].name)
        print("[SatQuery Provider] task:", task)

    return _providers[provider_key]


def get_analysis_provider() -> VisionProvider:
    return get_vision_provider("analysis")


def get_grounding_provider() -> VisionProvider:
    return get_vision_provider("grounding")


def get_temporal_provider() -> VisionProvider:
    return get_vision_provider("temporal")
