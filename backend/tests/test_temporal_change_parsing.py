from __future__ import annotations

import json
import unittest

from app.services.gemini_client import parse_json_output, strip_json_code_fences
from app.services.temporal_change import _normalize_change_response


class TemporalChangeParsingTests(unittest.TestCase):
    def test_parse_plain_temporal_json(self) -> None:
        payload = {
            "summary": "New construction is visible.",
            "final_answer": "Built environment changed.",
            "changes": [
                {
                    "category": "Built environment",
                    "change": "New structures",
                    "description": "New bright roof structures appear in the central area.",
                    "direction": "appeared",
                    "location": "central area",
                    "observability": "clearly_visible",
                }
            ],
            "unchanged_features": ["Main road alignment"],
            "possible_imaging_effects": ["illumination differences"],
            "limitations": ["Images may not be perfectly aligned."],
        }

        normalized = _normalize_change_response(payload, is_follow_up=False)

        self.assertEqual(normalized["summary"], "New construction is visible.")
        self.assertEqual(normalized["final_answer"], "Built environment changed.")
        self.assertEqual(normalized["changes"][0]["change"], "New structures")
        self.assertEqual(normalized["unchanged"], ["Main road alignment"])
        self.assertEqual(normalized["possible_imaging_effects"], ["illumination differences"])

    def test_parse_markdown_fenced_temporal_json_nested_in_final_answer(self) -> None:
        nested_payload = {
            "mode": "change_analysis",
            "summary": "Vegetation is reduced near new construction.",
            "final_answer": "The clearest change is reduced vegetation and new built area.",
            "changes": [
                {
                    "category": "Vegetation",
                    "change": "Reduced vegetation",
                    "description": "Green cover is reduced along the right side.",
                    "direction": "decreased",
                    "location": "right side",
                    "observability": "clearly_visible",
                }
            ],
            "unchanged": ["Water body"],
            "limitations": ["Resolution differences may affect fine details."],
        }
        outer_payload = {
            "mode": "temporal",
            "final_answer": f"```json\n{json.dumps(nested_payload)}\n```",
            "change_guard": {"status": "measurable_difference", "qwen_called": True},
        }

        normalized = _normalize_change_response(outer_payload, is_follow_up=False)

        self.assertEqual(normalized["summary"], nested_payload["summary"])
        self.assertEqual(normalized["final_answer"], nested_payload["final_answer"])
        self.assertEqual(normalized["changes"][0]["category"], "Vegetation")
        self.assertEqual(normalized["change_guard"]["status"], "measurable_difference")

    def test_parse_json_output_extracts_object_from_surrounding_text(self) -> None:
        parsed = parse_json_output('Here is the result:\n{"summary": "ok", "changes": []}\nThanks')

        self.assertEqual(parsed["summary"], "ok")

    def test_malformed_json_fallback_strips_fences(self) -> None:
        normalized = _normalize_change_response("```json\n{\"summary\": \"broken\"\n```", is_follow_up=False)

        self.assertNotIn("```", normalized["summary"])
        self.assertNotIn("```", normalized["final_answer"])
        self.assertIn('"summary"', normalized["summary"])

    def test_structured_hindi_temporal_result_is_preserved(self) -> None:
        normalized = _normalize_change_response(
            {
                "summary": "नए निर्माण और कम vegetation दिखाई दे रही है।",
                "final_answer": "दूसरी image में built-up area बढ़ा है।",
                "changes": [
                    {
                        "category": "Built environment",
                        "change": "नया construction",
                        "description": "central region में नई structures दिख रही हैं।",
                        "direction": "appeared",
                        "location": "central region",
                        "observability": "clearly_visible",
                    }
                ],
                "limitations": ["cloud cover कुछ हिस्सों को छुपा सकता है।"],
            },
            is_follow_up=False,
        )

        self.assertEqual(normalized["summary"], "नए निर्माण और कम vegetation दिखाई दे रही है।")
        self.assertEqual(normalized["changes"][0]["description"], "central region में नई structures दिख रही हैं।")

    def test_deterministic_no_change_guard_is_preserved(self) -> None:
        normalized = _normalize_change_response(
            {
                "final_answer": "No significant visible change was detected.",
                "change_guard": {
                    "status": "no_measurable_change",
                    "qwen_called": False,
                    "exact_match": True,
                    "mean_absolute_difference": 0.0,
                    "changed_pixel_fraction": 0.0,
                    "semantic_verification": "deterministic_no_change",
                },
            },
            is_follow_up=False,
        )

        self.assertEqual(normalized["change_guard"]["status"], "no_measurable_change")
        self.assertFalse(normalized["change_guard"]["qwen_called"])
        self.assertEqual(normalized["changes"], [])

    def test_strip_json_code_fences_handles_whitespace(self) -> None:
        self.assertEqual(strip_json_code_fences("``` json\n{\"ok\": true}\n```"), '{"ok": true}')


if __name__ == "__main__":
    unittest.main()
