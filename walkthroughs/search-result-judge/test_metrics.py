"""Arithmetic checks for the cutoff search. No model."""

import unittest

from metrics import choose_threshold, cost_of, evaluate


class MetricsTest(unittest.TestCase):
    def test_perfect_separation_below_one_half(self):
        # The shape from the decision-model essay: every positive is 0.40 and
        # every negative is 0.10. A cutoff of 0.50 catches nothing.
        labels = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]
        scores = [0.40, 0.40, 0.40, 0.40, 0.40, 0.10, 0.10, 0.10, 0.10, 0.10]
        at_half = evaluate(labels, scores, 0.50)
        self.assertEqual((at_half["tp"], at_half["fp"], at_half["fn"], at_half["tn"]), (0, 0, 5, 5))
        self.assertIsNone(at_half["precision"])
        chosen = choose_threshold(labels, scores, fp_cost=1, fn_cost=1)
        self.assertEqual(chosen["threshold"], 0.40)
        self.assertEqual(chosen["cost"], 0)
        self.assertEqual(chosen["metrics"]["tp"], 5)
        self.assertEqual(chosen["metrics"]["fp"], 0)

    def test_tie_goes_to_the_higher_cutoff(self):
        labels = [1, 0]
        scores = [0.20, 0.80]
        # Every cutoff below 0.20 predicts both positive: cost = 1*fp.
        # 0.20 through 0.80 predict only the negative: one fp, one fn, cost 1+1=2
        # above 0.80 predicts nothing: one fn, cost 1.
        # With equal costs the cheapest is "predict nothing", and the highest
        # such cutoff on the grid is 1.00.
        chosen = choose_threshold(labels, scores, fp_cost=1, fn_cost=1)
        self.assertEqual(chosen["threshold"], 1.0)
        self.assertEqual(chosen["metrics"]["fn"], 1)
        self.assertEqual(chosen["metrics"]["fp"], 0)

    def test_expensive_false_negative_lowers_the_cutoff(self):
        labels = [1, 1, 0]
        scores = [0.90, 0.40, 0.30]
        cautious = choose_threshold(labels, scores, fp_cost=1, fn_cost=1)
        hungry = choose_threshold(labels, scores, fp_cost=1, fn_cost=10)
        self.assertGreaterEqual(cautious["threshold"], hungry["threshold"])
        self.assertLess(hungry["threshold"], 0.50)
        self.assertEqual(hungry["metrics"]["fn"], 0)

    def test_cost_uses_the_weights(self):
        metrics = evaluate([1, 0, 0], [0.2, 0.9, 0.8], 0.5)
        self.assertEqual((metrics["tp"], metrics["fp"], metrics["fn"]), (0, 2, 1))
        self.assertEqual(cost_of(metrics, fp_cost=4, fn_cost=5), 13)


if __name__ == "__main__":
    unittest.main()
