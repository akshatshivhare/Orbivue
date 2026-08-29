from pathlib import Path

from ..config import GEMINI_ANALYSIS_MODEL
from .gemini_client import (
    GeminiAnalysisError,
    create_gemini_interaction,
    encode_image_part,
    error_type,
    raise_user_facing_gemini_error,
)


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

    try:
        interaction = create_gemini_interaction(
            input_parts=[
                encode_image_part(image_file),
                {
                    "type": "text",
                    "text": prompt,
                },
            ],
            max_output_tokens=220,
        )
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

    answer = getattr(interaction, "output_text", None)
    if not isinstance(answer, str) or not answer.strip():
        raise GeminiAnalysisError(
            "Gemini returned an empty analysis response.",
            error_type="empty_response",
        )

    print("[SatQuery Analysis] model:", GEMINI_ANALYSIS_MODEL)
    print("[SatQuery Analysis] provider latency tracked by route/service caller")
    return answer.strip()
