"""Backward-compatible Gemini exports.

New code should import from backend.app.services.* directly. This module remains
so older imports do not accidentally break while the backend is modularized.
"""

from .config import GEMINI_ANALYSIS_MODEL, GEMINI_THINKING_LEVEL
from .services.gemini_client import GeminiAnalysisError
from .services.image_analysis import analyze_image_with_gemini
from .services.temporal_change import analyze_change_with_gemini
from .services.visual_grounding import ground_image_with_gemini

__all__ = [
    "GEMINI_ANALYSIS_MODEL",
    "GEMINI_THINKING_LEVEL",
    "GeminiAnalysisError",
    "analyze_image_with_gemini",
    "analyze_change_with_gemini",
    "ground_image_with_gemini",
]
