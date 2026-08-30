from pathlib import Path
from typing import Any

from ...config import GEMINI_ANALYSIS_MODEL
from ..gemini_client import create_gemini_interaction, encode_image_part


class GeminiVisionProvider:
    name = "Gemini"
    model = GEMINI_ANALYSIS_MODEL
    coordinate_order = "yxyx"

    def analyze_image(self, image_path: Path, prompt: str) -> str:
        interaction = create_gemini_interaction(
            input_parts=[
                encode_image_part(image_path),
                {
                    "type": "text",
                    "text": prompt,
                },
            ],
            max_output_tokens=220,
        )
        return _output_text(interaction)

    def ground_image(
        self,
        image_path: Path,
        prompt: str,
        response_format: dict[str, Any] | None = None,
    ) -> str:
        interaction = create_gemini_interaction(
            input_parts=[
                encode_image_part(image_path),
                {
                    "type": "text",
                    "text": prompt,
                },
            ],
            max_output_tokens=180,
            response_format=response_format,
        )
        return _output_text(interaction)

    def analyze_temporal(self, image_t1_path: Path, image_t2_path: Path, prompt: str) -> str:
        interaction = create_gemini_interaction(
            input_parts=[
                {
                    "type": "text",
                    "text": "IMAGE 1 = T1 / BEFORE / earlier reference image.",
                },
                encode_image_part(image_t1_path),
                {
                    "type": "text",
                    "text": "IMAGE 2 = T2 / AFTER / later comparison image.",
                },
                encode_image_part(image_t2_path),
                {
                    "type": "text",
                    "text": prompt,
                },
            ],
            max_output_tokens=500,
        )
        return _output_text(interaction)


def _output_text(interaction: Any) -> str:
    output_text = getattr(interaction, "output_text", None)
    return output_text.strip() if isinstance(output_text, str) else ""
