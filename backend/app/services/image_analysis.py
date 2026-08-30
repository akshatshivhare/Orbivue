from pathlib import Path

from .gemini_client import (
    GeminiAnalysisError,
    error_type,
    raise_user_facing_gemini_error,
)
from .providers import get_vision_provider


def _is_generic_analysis_query(user_query: str) -> bool:
    normalized = " ".join(user_query.strip().casefold().split())
    generic_queries = {
        "describe",
        "describe this image",
        "what do you see",
        "what do you see?",
        "what is in this image",
        "what is in this image?",
        "what type of area is this",
        "what type of area is this?",
        "explain this satellite image",
        "explain this image",
        "what can you observe here",
        "what can you observe here?",
    }
    return normalized in generic_queries


def _build_analysis_prompt(user_query: str) -> str:
    if _is_generic_analysis_query(user_query):
        return (
            "Describe the important visible features in this satellite/aerial image. "
            "Mention roads, buildings, vegetation, water, infrastructure, terrain, "
            "and any notable structures if visible. Be concise and factual."
        )

    return (
        "Answer the user's question about this satellite/aerial image. "
        "Be concise, factual, and mention only visible evidence when possible.\n\n"
        f"User question: {user_query}"
    )


def analyze_image_with_gemini(image_path: str, user_query: str) -> str:
    image_file = Path(image_path)
    prompt = _build_analysis_prompt(user_query)
    provider = get_vision_provider()

    try:
        answer = provider.analyze_image(image_file, prompt)
    except GeminiAnalysisError as error:
        print("[SatQuery Analysis] error type:", error.error_type)
        print("[SatQuery Analysis] error:", repr(error))
        raise
    except Exception as error:
        print("[SatQuery Analysis] error type:", error_type(error))
        print("[SatQuery Analysis] error:", repr(error))
        raise_user_facing_gemini_error(
            error,
            "Gemini analysis could not be completed. Please try again.",
        )

    if not isinstance(answer, str) or not answer.strip():
        raise GeminiAnalysisError(
            f"{provider.name} returned an empty analysis response.",
            error_type="empty_response",
        )

    print("[SatQuery Analysis] provider:", provider.name)
    print("[SatQuery Analysis] model:", provider.model)
    print("[SatQuery Analysis] provider latency tracked by route/service caller")
    return answer.strip()
