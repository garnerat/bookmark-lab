"""The phone page reads outputs/cards.json. Lock the numbers it has to match.

The combo is not a third model. On a decision score, a keyword score below
0.25 or at least 0.75 stands. The judge is used only in the band between.
"""

import json
import unittest
from pathlib import Path

from metrics import choose_threshold, cost_of, evaluate

ROOT = Path(__file__).resolve().parent
CARDS = json.loads((ROOT / "outputs" / "cards.json").read_text(encoding="utf-8"))
LOW = CARDS["combo"]["low"]
HIGH = CARDS["combo"]["high"]


def decision_score(card, positive_when_fits, scorer):
    judge = card["p_fit"] if positive_when_fits else 1.0 - card["p_fit"]
    keyword = card["overlap"] if positive_when_fits else 1.0 - card["overlap"]
    if scorer == "judge":
        return judge
    if scorer == "keyword":
        return keyword
    if keyword < LOW or keyword >= HIGH:
        return keyword
    return judge


def rows_for(badge, split):
    return [card for card in CARDS["cards"] if card["badge"] == badge and card["split"] == split]


def pack(badge, positive_when_fits, scorer, fp_cost, fn_cost):
    def labels_and_scores(split):
        rows = rows_for(badge, split)
        labels = [int(card["fits"]) if positive_when_fits else int(not card["fits"]) for card in rows]
        scores = [decision_score(card, positive_when_fits, scorer) for card in rows]
        return labels, scores

    tune_labels, tune_scores = labels_and_scores("tune")
    hold_labels, hold_scores = labels_and_scores("holdout")
    chosen = choose_threshold(tune_labels, tune_scores, fp_cost, fn_cost)
    holdout = evaluate(hold_labels, hold_scores, chosen["threshold"])
    return chosen["threshold"], holdout, cost_of(holdout, fp_cost, fn_cost)


class CardsTest(unittest.TestCase):
    def test_export_shape(self):
        self.assertEqual(len(CARDS["cards"]), 244)
        self.assertEqual(CARDS["model"], "Qwen/Qwen2.5-1.5B-Instruct")
        self.assertEqual(CARDS["costs"]["irrelevant_substitution"], {"fp": 1.0, "fn": 5.0})
        self.assertEqual(CARDS["costs"]["relevant_sponsored"], {"fp": 4.0, "fn": 1.0})
        self.assertEqual((LOW, HIGH), (0.25, 0.75))
        highlights = {card["id"] for card in CARDS["cards"] if card.get("highlight")}
        self.assertEqual(
            highlights,
            {
                "lactose-milk-04",
                "gf-pasta-04",
                "dish-soap-01",
                "dish-soap-02",
                "dish-soap-03",
                "dish-soap-04",
                "dish-soap-05",
                "dish-soap-06",
            },
        )

    def test_anchors(self):
        by_id = {card["id"]: card for card in CARDS["cards"]}
        self.assertEqual(by_id["evoo-06"]["overlap"], 0)
        self.assertGreater(by_id["evoo-06"]["p_fit"], 0.96)
        self.assertGreater(by_id["lactose-milk-04"]["p_fit"], 0.99)
        self.assertLess(by_id["gf-pasta-04"]["p_fit"], 0.99)
        self.assertGreater(by_id["gf-pasta-04"]["p_fit"], 0.98)
        self.assertLess(by_id["dish-soap-02"]["p_fit"], 0.02)
        self.assertLess(by_id["dish-soap-05"]["p_fit"], 0.02)

    def test_saved_cutoffs_and_combo(self):
        # Judge and keyword cutoffs are the ones printed in outputs/REPORT.txt.
        # Combo is computed here from the same scores.
        cases = {
            ("substitution", False, "judge", 1, 5): (0.02, 29, 14, 2, 3, 24),
            ("substitution", False, "keyword", 1, 5): (0.19, 28, 1, 3, 16, 16),
            ("substitution", False, "combo", 1, 5): (0.05, 26, 0, 5, 17, 25),
            ("sponsored", True, "judge", 4, 1): (0.59, 14, 3, 2, 14, 14),
            ("sponsored", True, "keyword", 4, 1): (1.00, 12, 1, 4, 16, 8),
            ("sponsored", True, "combo", 4, 1): (0.81, 12, 1, 4, 16, 8),
        }
        for (badge, positive, scorer, fp_cost, fn_cost), expected in cases.items():
            threshold, metrics, cost = pack(badge, positive, scorer, fp_cost, fn_cost)
            got = (
                threshold,
                metrics["tp"],
                metrics["fp"],
                metrics["fn"],
                metrics["tn"],
                cost,
            )
            self.assertEqual(got, expected, f"{badge} {scorer}")


if __name__ == "__main__":
    unittest.main()
