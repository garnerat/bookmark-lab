"""The hand labels stay inside the spec, and the hard cards stay hard."""

import unittest

import baseline
from dataset import RULES, dataset_sha256, load_rows
from judge import messages


def card_text(row):
    return f"{row['title']} {row['details']}".lower()


class DatasetTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = load_rows()
        cls.by_title = {}
        for row in cls.rows:
            cls.by_title[(row["query_id"], row["title"], row["details"])] = row

    def row(self, query_id, title, details=None):
        matches = [
            row
            for row in self.rows
            if row["query_id"] == query_id and row["title"] == title and (details is None or row["details"] == details)
        ]
        self.assertEqual(len(matches), 1, f"{query_id} / {title} / {details}")
        return matches[0]

    def test_size_and_split(self):
        self.assertGreaterEqual(len(self.rows), 150)
        self.assertLessEqual(len(self.rows), 250)
        queries = {}
        for row in self.rows:
            queries[row["query_id"]] = row["split"]
        self.assertGreaterEqual(len(queries), 30)
        self.assertGreaterEqual(sum(split == "tune" for split in queries.values()), 16)
        self.assertGreaterEqual(sum(split == "holdout" for split in queries.values()), 12)
        for detector, badge in (
            ("irrelevant_substitution", "substitution"),
            ("relevant_sponsored", "sponsored"),
        ):
            for split in ("tune", "holdout"):
                slice_rows = [row for row in self.rows if row["badge"] == badge and row["split"] == split]
                positives = sum(row[detector] for row in slice_rows)
                self.assertGreaterEqual(positives, 5, f"{detector} {split} positives")
                self.assertGreaterEqual(len(slice_rows) - positives, 5, f"{detector} {split} negatives")

    def test_prompt_contains_the_rules(self):
        text = messages(self.rows[0])[1]["content"]
        self.assertIn(RULES, text)
        # The badge is known to the store. The prompt asks only whether the
        # product fits, so the card text does not include a badge line.
        self.assertNotIn("Badge:", text)
        self.assertNotIn(self.rows[0]["badge"], f"{self.rows[0]['title']} {self.rows[0]['details']}".lower())

    def test_hard_paraphrases_hide_the_easy_words(self):
        vitamin = self.row("whole-milk", "Borden Vitamin D Milk")
        self.assertEqual(vitamin["fits"], 1)
        self.assertNotIn("whole", card_text(vitamin))
        reduced = self.row("milk-2pct", "Store Brand Reduced Fat Milk", "64 fl oz")
        self.assertEqual(reduced["fits"], 1)
        self.assertNotIn("2%", card_text(reduced))
        self.assertNotIn("half", card_text(reduced))
        self.assertNotIn("gallon", card_text(reduced))
        evoo = self.row("evoo", "Colavita EVOO")
        self.assertEqual(evoo["fits"], 1)
        blob = card_text(evoo)
        self.assertNotIn("extra", blob)
        self.assertNotIn("virgin", blob)
        self.assertNotIn("olive", blob)
        gallon = self.row("organic-gallon", "Organic Valley Whole Milk", "128 fl oz")
        self.assertEqual(gallon["fits"], 1)
        self.assertNotIn("gallon", card_text(gallon))

    def test_baseline_cannot_solve_the_paraphrases_by_overlap(self):
        evoo = self.row("evoo", "Colavita EVOO")
        self.assertEqual(baseline.fit_score(evoo["query"], evoo["title"], evoo["details"]), 0)
        reduced = self.row("milk-2pct", "Store Brand Reduced Fat Milk", "64 fl oz")
        self.assertLess(baseline.fit_score(reduced["query"], reduced["title"], reduced["details"]), 0.5)
        vitamin = self.row("whole-milk", "Borden Vitamin D Milk")
        self.assertLess(baseline.fit_score(vitamin["query"], vitamin["title"], vitamin["details"]), 1)

    def test_spotlight_misses(self):
        self.assertEqual(self.row("whole-milk", "Great Value 2% Reduced Fat Milk")["fits"], 0)
        self.assertEqual(self.row("evoo", "Store Brand Pure Olive Oil")["fits"], 0)
        self.assertEqual(self.row("cola", "Diet Coke")["fits"], 0)
        self.assertEqual(self.row("shoes", "Brooks Ghost Men's Running Shoes", "size 11")["fits"], 0)
        self.assertEqual(self.row("diapers", "Pampers Swaddlers Size 3")["fits"], 0)
        self.assertEqual(self.row("jam", "Smucker's Strawberry Jelly")["fits"], 0)
        self.assertEqual(self.row("jam", "Bonne Maman Strawberry Preserves")["fits"], 1)
        self.assertEqual(self.row("toilet-paper", "Store Brand Toilet Paper", "12 mega rolls")["fits"], 0)
        self.assertEqual(self.row("dish-soap", "Cascade Dishwasher Pods")["fits"], 0)
        self.assertEqual(self.row("batteries", "Duracell Coppertop AAA")["fits"], 0)
        self.assertEqual(self.row("dog-food", "Purina Pro Plan Salmon", "cat food, 3 lb")["fits"], 0)
        margarine = self.row("butter", "I Can't Believe It's Not Butter")
        self.assertEqual(margarine["fits"], 0)
        self.assertEqual(baseline.fit_score(margarine["query"], margarine["title"], margarine["details"]), 1)

    def test_hash_changes_when_a_label_changes(self):
        original = dataset_sha256(self.rows)
        tweaked = [dict(row) for row in self.rows]
        tweaked[0] = dict(tweaked[0], fits=1 - tweaked[0]["fits"])
        self.assertNotEqual(original, dataset_sha256(tweaked))


if __name__ == "__main__":
    unittest.main()
