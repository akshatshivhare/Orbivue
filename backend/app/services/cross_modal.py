import json
import time
from pathlib import Path
from typing import Any

from ..config import CROSS_MODAL_PROVIDER
from .gemini_client import GeminiAnalysisError
from .providers.orbivue_cross_modal_provider import OrbiVueCrossModalProvider

_cross_modal_providers: dict[str, OrbiVueCrossModalProvider] = {}


def get_cross_modal_provider() -> OrbiVueCrossModalProvider:
    if CROSS_MODAL_PROVIDER != "orbivue":
        raise GeminiAnalysisError(
            f"Unsupported cross-modal provider: {CROSS_MODAL_PROVIDER}",
            error_type="unsupported_cross_modal_provider",
            user_message="Configured cross-modal provider is not supported.",
        )

    if CROSS_MODAL_PROVIDER not in _cross_modal_providers:
        _cross_modal_providers[CROSS_MODAL_PROVIDER] = OrbiVueCrossModalProvider()
        print("[SatQuery Provider] loaded cross-modal provider:", CROSS_MODAL_PROVIDER)

    return _cross_modal_providers[CROSS_MODAL_PROVIDER]


async def analyze_cross_modal(optical_image_path: str, sar_image_path: str, query: str) -> dict[str, str]:
    total_started_at = time.perf_counter()
    provider = get_cross_modal_provider()
    query_text = query.strip()

    if not query_text:
        raise GeminiAnalysisError(
            "Cross-modal query is empty.",
            error_type="empty_cross_modal_query",
            user_message="Please enter a question for cross-modal analysis.",
        )

    print("[SatQuery CrossModal] provider:", provider.name)
    print("[SatQuery CrossModal] model:", provider.model)
    print("[SatQuery CrossModal] query:", query_text)

    try:
        provider_started_at = time.perf_counter()
        output_text = await provider.analyze_cross_modal(
            Path(optical_image_path),
            Path(sar_image_path),
            query_text,
        )
        print("[SatQuery CrossModal] provider latency:", f"{time.perf_counter() - provider_started_at:.3f}s")
    except GeminiAnalysisError:
        print("[SatQuery CrossModal] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
        raise

    normalization_started_at = time.perf_counter()
    try:
        payload: Any = json.loads(output_text) if isinstance(output_text, str) else {}
    except ValueError as error:
        raise GeminiAnalysisError(
            "Cross-modal provider returned malformed JSON.",
            error_type="cross_modal_malformed_json",
            user_message="Cross-modal provider returned an invalid response.",
        ) from error

    if not isinstance(payload, dict):
        raise GeminiAnalysisError(
            "Cross-modal provider response was not a JSON object.",
            error_type="cross_modal_invalid_response",
            user_message="Cross-modal provider returned an invalid response.",
        )

    final_answer = payload.get("final_answer")
    if not isinstance(final_answer, str) or not final_answer.strip():
        raise GeminiAnalysisError(
            "Cross-modal provider response was missing final_answer.",
            error_type="cross_modal_missing_final_answer",
            user_message="Cross-modal provider returned an incomplete response.",
        )

    result = {
        "mode": "cross_modal",
        "final_answer": final_answer.strip(),
    }
    print("[SatQuery CrossModal] normalization:", f"{time.perf_counter() - normalization_started_at:.3f}s")
    print("[SatQuery CrossModal] total latency:", f"{time.perf_counter() - total_started_at:.3f}s")
    return result
