from __future__ import annotations

import types
import unittest

import numpy as np
from PIL import Image

from deployment.modal.temporal_guard import (
    ASPECT_RATIO_RELATIVE_TOLERANCE,
    DIMENSION_NORMALIZATION_WARNING,
    NO_SIGNIFICANT_VISIBLE_CHANGE,
    analyze_temporal_with_guard,
    compare_temporal_images,
    install_temporal_guard,
)


def _image_from_array(array: np.ndarray) -> Image.Image:
    return Image.fromarray(array.astype(np.uint8), "RGB")


class TemporalGuardTests(unittest.TestCase):
    def test_exact_identical_skips_qwen(self) -> None:
        image = Image.new("RGB", (24, 24), (10, 120, 200))

        def original(*_args):
            raise AssertionError("Qwen should not be called for identical images")

        result = analyze_temporal_with_guard(image, image, "What changed?", original)

        self.assertEqual(result["mode"], "temporal")
        self.assertEqual(result["final_answer"], NO_SIGNIFICANT_VISIBLE_CHANGE)
        self.assertEqual(result["change_guard"]["status"], "no_measurable_change")
        self.assertFalse(result["change_guard"]["qwen_called"])
        self.assertTrue(result["change_guard"]["exact_match"])
        self.assertEqual(result["change_guard"]["mean_absolute_difference"], 0.0)
        self.assertEqual(result["change_guard"]["changed_pixel_fraction"], 0.0)
        self.assertFalse(result["change_guard"]["dimension_normalized"])
        self.assertEqual(result["change_guard"]["normalization_method"], "none")
        self.assertEqual(result["change_guard"]["original_size_t1"], [24, 24])
        self.assertEqual(result["change_guard"]["original_size_t2"], [24, 24])
        self.assertEqual(result["change_guard"]["comparison_size"], [24, 24])

    def test_tiny_compression_like_difference_skips_qwen(self) -> None:
        before_array = np.full((32, 32, 3), 120, dtype=np.uint8)
        after_array = before_array.copy()
        after_array[:, :, 1] = 121

        def original(*_args):
            raise AssertionError("Qwen should not be called for near-identical images")

        result = analyze_temporal_with_guard(
            _image_from_array(before_array),
            _image_from_array(after_array),
            "Any visible differences?",
            original,
        )

        guard = result["change_guard"]
        self.assertEqual(guard["status"], "no_measurable_change")
        self.assertFalse(guard["qwen_called"])
        self.assertFalse(guard["exact_match"])
        self.assertLessEqual(
            guard["mean_absolute_difference"],
            guard["near_identical_mean_threshold"],
        )
        self.assertLessEqual(
            guard["changed_pixel_fraction"],
            guard["near_identical_fraction_threshold"],
        )

    def test_real_changed_patch_calls_original_once_with_augmented_query(self) -> None:
        before_array = np.zeros((40, 40, 3), dtype=np.uint8)
        after_array = before_array.copy()
        after_array[10:30, 10:30, :] = 255
        calls = []

        def original(image_t1, image_t2, query):
            calls.append((image_t1, image_t2, query))
            return {"mode": "temporal", "final_answer": "A visible patch changed."}

        result = analyze_temporal_with_guard(
            _image_from_array(before_array),
            _image_from_array(after_array),
            "What changed?",
            original,
        )

        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][0].size, (40, 40))
        self.assertEqual(calls[0][1].size, (40, 40))
        self.assertEqual(calls[0][0].mode, "RGB")
        self.assertEqual(calls[0][1].mode, "RGB")
        self.assertIn("Mean normalized absolute RGB difference", calls[0][2])
        self.assertIn("Original user question:\nWhat changed?", calls[0][2])
        self.assertIn("do not represent real-world changed area", calls[0][2])
        self.assertEqual(result["change_guard"]["status"], "measurable_difference")
        self.assertTrue(result["change_guard"]["qwen_called"])
        self.assertEqual(
            result["change_guard"]["semantic_verification"],
            "model_generated_unverified",
        )
        self.assertIn("model-generated semantic description", result["final_answer"])

    def test_dimension_mismatch_returns_incompatible_without_qwen(self) -> None:
        before = Image.new("RGB", (24, 24), (0, 0, 0))
        after = Image.new("RGB", (25, 24), (0, 0, 0))

        def original(*_args):
            raise AssertionError("Qwen should not be called for mismatched dimensions")

        result = analyze_temporal_with_guard(before, after, "Compare", original)

        guard = result["change_guard"]
        self.assertEqual(guard["status"], "incompatible")
        self.assertFalse(guard["qwen_called"])
        self.assertIsNone(guard["mean_absolute_difference"])
        self.assertIsNone(guard["changed_pixel_fraction"])
        self.assertEqual(guard["semantic_verification"], "not_performed")
        self.assertEqual(guard["image_t1_size"], [24, 24])
        self.assertEqual(guard["image_t2_size"], [25, 24])
        self.assertFalse(guard["dimension_normalized"])
        self.assertEqual(guard["normalization_method"], "none")
        self.assertGreater(guard["aspect_ratio_relative_difference"], ASPECT_RATIO_RELATIVE_TOLERANCE)

    def test_same_scene_different_resolution_same_aspect_ratio_is_normalized(self) -> None:
        before = Image.new("RGB", (40, 20), (90, 130, 170))
        after = before.resize((80, 40), Image.Resampling.BILINEAR)

        def original(*_args):
            raise AssertionError("Qwen should not be called for same content after normalization")

        result = analyze_temporal_with_guard(before, after, "Compare", original)

        guard = result["change_guard"]
        self.assertEqual(guard["status"], "no_measurable_change")
        self.assertFalse(guard["qwen_called"])
        self.assertFalse(guard["exact_match"])
        self.assertTrue(guard["dimension_normalized"])
        self.assertEqual(guard["normalization_method"], "resize_t2_to_t1")
        self.assertEqual(guard["alignment_warning"], DIMENSION_NORMALIZATION_WARNING)
        self.assertEqual(guard["original_size_t1"], [40, 20])
        self.assertEqual(guard["original_size_t2"], [80, 40])
        self.assertEqual(guard["comparison_size"], [40, 20])
        self.assertEqual(guard["mean_absolute_difference"], 0.0)
        self.assertEqual(guard["changed_pixel_fraction"], 0.0)
        self.assertEqual(result["final_answer"], NO_SIGNIFICANT_VISIBLE_CHANGE)

    def test_changed_patch_different_resolution_same_aspect_ratio_calls_original_once(self) -> None:
        before = Image.new("RGB", (40, 20), (0, 0, 0))
        after = Image.new("RGB", (80, 40), (0, 0, 0))
        after_array = np.asarray(after).copy()
        after_array[10:30, 20:60, :] = 255
        after = _image_from_array(after_array)
        calls = []

        def original(image_t1, image_t2, query):
            calls.append((image_t1, image_t2, query))
            return {"mode": "temporal", "final_answer": "The bright patch changed."}

        result = analyze_temporal_with_guard(before, after, "What changed?", original)

        guard = result["change_guard"]
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][0].size, (40, 20))
        self.assertEqual(calls[0][1].size, (80, 40))
        self.assertIn(DIMENSION_NORMALIZATION_WARNING, calls[0][2])
        self.assertEqual(guard["status"], "measurable_difference")
        self.assertTrue(guard["qwen_called"])
        self.assertTrue(guard["dimension_normalized"])
        self.assertEqual(guard["normalization_method"], "resize_t2_to_t1")
        self.assertEqual(guard["original_size_t1"], [40, 20])
        self.assertEqual(guard["original_size_t2"], [80, 40])
        self.assertEqual(guard["comparison_size"], [40, 20])
        self.assertIn("model-generated semantic description", result["final_answer"])
        self.assertIn("does not establish geospatial registration", result["final_answer"])

    def test_metadata_reports_dimensions_and_aspect_ratios(self) -> None:
        before = Image.new("RGB", (100, 50), (0, 0, 0))
        after = Image.new("RGB", (201, 100), (0, 0, 0))

        _, _, guard = compare_temporal_images(before, after)

        self.assertEqual(guard["original_size_t1"], [100, 50])
        self.assertEqual(guard["original_size_t2"], [201, 100])
        self.assertEqual(guard["comparison_size"], [100, 50])
        self.assertTrue(guard["dimension_normalized"])
        self.assertEqual(guard["normalization_method"], "resize_t2_to_t1")
        self.assertEqual(guard["aspect_ratio_t1"], 2.0)
        self.assertEqual(guard["aspect_ratio_t2"], 2.01)
        self.assertLessEqual(guard["aspect_ratio_relative_difference"], ASPECT_RATIO_RELATIVE_TOLERANCE)

    def test_guard_metrics_are_deterministic(self) -> None:
        before_array = np.arange(48, dtype=np.uint8).reshape((4, 4, 3))
        after_array = before_array.copy()
        after_array[1:3, 1:3, :] = 255
        before = _image_from_array(before_array)
        after = _image_from_array(after_array)

        first = compare_temporal_images(before, after)[2]
        second = compare_temporal_images(before, after)[2]

        self.assertEqual(first, second)

    def test_normalized_dimension_metrics_are_deterministic(self) -> None:
        before = Image.new("RGB", (50, 25), (10, 20, 30))
        after = Image.new("RGB", (100, 50), (10, 20, 30))

        first = compare_temporal_images(before, after)[2]
        second = compare_temporal_images(before, after)[2]

        self.assertEqual(first, second)

    def test_route_regression_keeps_response_shape_with_change_guard(self) -> None:
        image = Image.new("RGB", (20, 20), (30, 40, 50))

        def original(_image_t1, _image_t2, _query):
            return {"mode": "temporal", "final_answer": "Original temporal answer."}

        recovered_main = types.ModuleType("fake_recovered_main")
        recovered_main.analyze_temporal = original
        install_temporal_guard(recovered_main)

        def change():
            return recovered_main.analyze_temporal(image, image, "What changed?")

        payload = change()

        self.assertEqual(set(payload), {"mode", "final_answer", "change_guard"})
        self.assertEqual(payload["mode"], "temporal")
        self.assertEqual(payload["change_guard"]["status"], "no_measurable_change")
        self.assertFalse(payload["change_guard"]["qwen_called"])


if __name__ == "__main__":
    unittest.main()
