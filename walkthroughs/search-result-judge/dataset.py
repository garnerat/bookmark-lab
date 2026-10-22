"""Load the hand-labeled cards and check the labels against the spec.

The human decision on each card is `fits`: 1 if the product is the item the
query asks for, 0 if it is not. The badge (organic, substitution, sponsored)
is what the store UI already prints on the card. It is not a model output.

The two detectors fall out of those two fields:

- irrelevant substitution: badge is substitution and fits is 0
- relevant sponsored ad: badge is sponsored and fits is 1

Organic cards stay in the file so a results list looks like a results list.
Neither detector is tuned on them. The store is not asking "should I flag
this organic hit?" in this walkthrough.
"""

from __future__ import annotations

import hashlib
import importlib.util
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CASES_PATH = ROOT / "data" / "cases.py"

# This string is the spec. The labels in data/cases.py follow it, and the
# judge prompt pastes it in. If you change a rule, change the labels too.
RULES = """
A result fits only if it is the same product the query asks for.
- A nearby product does not fit. Oat milk is not whole milk. Almond milk is not oat milk. Yellow mustard is not Dijon. Jasmine rice is not basmati.
- If the query names a brand, size, count, flavor, fat level, roast, pack type, gender, shoe size, diaper size, or a dietary word (organic, unsweetened, gluten-free, lactose-free, unsalted, unscented, low sodium), the card must match that word.
- A different brand is fine when the query names none. An extra detail the query does not mention is fine.
- Equivalences: 2% milk and reduced fat milk are the same. When the card does not say 1%, 2%, skim, or reduced fat, vitamin D milk means whole milk. 64 fl oz is a half gallon. 128 fl oz is a gallon. EVOO means extra virgin olive oil.
- Not the same: pure olive oil is not extra virgin. Jelly is not jam, but preserves count as jam. Diet cola is not cola. A mega roll is not a double roll. Dishwasher pods are not dish soap. A cooking spray is not a bottle of oil.
""".strip()

BADGES = ("organic", "substitution", "sponsored")
CASES = ("exact", "extra_ok", "paraphrase", "near_miss", "off_topic")
FIT_CASES = ("exact", "extra_ok", "paraphrase")
MISS_CASES = ("near_miss", "off_topic")
SPLITS = ("tune", "holdout")

DETECTORS = (
    {
        "id": "irrelevant_substitution",
        "badge": "substitution",
        # High score means "this swap does not fit." That is 1 - P(fits).
        "positive_when_fits": False,
        "action": "Flag the substitution as irrelevant.",
        "fp_means": "A substitution that fits the query is flagged.",
        "fn_means": "A substitution that does not fit is shown to the shopper.",
    },
    {
        "id": "relevant_sponsored",
        "badge": "sponsored",
        # High score means "this ad fits." That is P(fits) itself.
        "positive_when_fits": True,
        "action": "Keep the sponsored card as a relevant ad.",
        "fp_means": "An ad that does not fit the query is kept.",
        "fn_means": "An ad that fits the query is suppressed.",
    },
)


def load_queries(path=CASES_PATH):
    spec = importlib.util.spec_from_file_location("search_cases", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.QUERIES


def decision_label(fits, positive_when_fits):
    """1 if this detector should fire, 0 if it should not."""
    return int(fits) if positive_when_fits else int(not fits)


def decision_score(fit_probability, positive_when_fits):
    """Turn P(fits) into a score where higher means 'do the action'."""
    probability = float(fit_probability)
    return probability if positive_when_fits else 1.0 - probability


def flatten(queries):
    rows = []
    for query in queries:
        for index, result in enumerate(query["results"], start=1):
            fits = int(result["fits"])
            row = {
                "id": f"{query['id']}-{index:02d}",
                "query_id": query["id"],
                "split": query["split"],
                "query": query["query"],
                "badge": result["badge"],
                "title": result["title"],
                "details": result["details"],
                "fits": fits,
                "case": result["case"],
                "note": result["note"],
            }
            for detector in DETECTORS:
                if row["badge"] == detector["badge"]:
                    row[detector["id"]] = decision_label(fits, detector["positive_when_fits"])
                else:
                    row[detector["id"]] = None
            rows.append(row)
    validate(rows)
    return rows


def validate(rows):
    if not rows:
        raise ValueError("dataset is empty")
    seen_ids = set()
    query_splits = {}
    query_text = {}
    for row in rows:
        if row["id"] in seen_ids:
            raise ValueError(f"duplicate id {row['id']}")
        seen_ids.add(row["id"])
        if row["split"] not in SPLITS:
            raise ValueError(f"{row['id']}: bad split {row['split']}")
        if row["badge"] not in BADGES:
            raise ValueError(f"{row['id']}: bad badge {row['badge']}")
        if row["case"] not in CASES:
            raise ValueError(f"{row['id']}: bad case {row['case']}")
        if row["fits"] not in (0, 1):
            raise ValueError(f"{row['id']}: fits must be 0 or 1")
        if row["fits"] == 1 and row["case"] not in FIT_CASES:
            raise ValueError(f"{row['id']}: a fit is tagged {row['case']}")
        if row["fits"] == 0 and row["case"] not in MISS_CASES:
            raise ValueError(f"{row['id']}: a miss is tagged {row['case']}")
        if not row["note"].strip():
            raise ValueError(f"{row['id']}: missing note")
        previous = query_splits.setdefault(row["query_id"], row["split"])
        if previous != row["split"]:
            raise ValueError(f"{row['query_id']} is in both splits")
        previous_text = query_text.setdefault(row["query_id"], row["query"])
        if previous_text != row["query"]:
            raise ValueError(f"{row['query_id']} has two query strings")
        if row["badge"] == "substitution":
            expected = 0 if row["fits"] else 1
            if row["irrelevant_substitution"] != expected:
                raise ValueError(f"{row['id']}: substitution label mismatch")
            if row["relevant_sponsored"] is not None:
                raise ValueError(f"{row['id']}: substitution should not have an ad label")
        elif row["badge"] == "sponsored":
            if row["relevant_sponsored"] != row["fits"]:
                raise ValueError(f"{row['id']}: sponsored label mismatch")
            if row["irrelevant_substitution"] is not None:
                raise ValueError(f"{row['id']}: ad should not have a substitution label")
        else:
            if row["irrelevant_substitution"] is not None or row["relevant_sponsored"] is not None:
                raise ValueError(f"{row['id']}: organic row should not be in a detector")


def dataset_sha256(rows):
    """Fingerprint of the spec plus the cards. Score cache uses this."""
    lines = [RULES]
    for row in rows:
        lines.append(
            "\t".join(
                [
                    row["id"],
                    row["split"],
                    row["query"],
                    row["badge"],
                    row["title"],
                    row["details"],
                    str(row["fits"]),
                    row["case"],
                    row["note"],
                ]
            )
        )
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()


def inventory(rows):
    """Short text inventory. `python dataset.py` prints this."""
    query_ids = {row["query_id"] for row in rows}
    queries = {}
    for row in rows:
        queries[row["query_id"]] = row["split"]
    split_counts = Counter(queries.values())
    lines = [
        f"rows {len(rows)}",
        f"queries {len(query_ids)} (tune {split_counts['tune']}, holdout {split_counts['holdout']})",
    ]
    for badge in BADGES:
        badge_rows = [row for row in rows if row["badge"] == badge]
        fits = sum(row["fits"] for row in badge_rows)
        lines.append(f"{badge}: {len(badge_rows)} cards, {fits} fit, {len(badge_rows) - fits} do not")
    for detector in DETECTORS:
        for split in SPLITS:
            slice_rows = [
                row for row in rows if row["badge"] == detector["badge"] and row["split"] == split
            ]
            positives = sum(row[detector["id"]] for row in slice_rows)
            lines.append(
                f"{detector['id']} {split}: {len(slice_rows)} cards, {positives} positive, {len(slice_rows) - positives} negative"
            )
    return "\n".join(lines)


def load_rows():
    return flatten(load_queries())


if __name__ == "__main__":
    print(inventory(load_rows()))
