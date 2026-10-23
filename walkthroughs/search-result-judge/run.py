"""Score the cards, pick a cutoff for each decision, write the results.

    python run.py

Reuses outputs/scores.jsonl when the model and the dataset match, so editing
costs.json does not call the model again. Pass --rescore to call it anyway.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import baseline
import charts
import judge
from dataset import DETECTORS, dataset_sha256, decision_score, inventory, load_rows
from metrics import choose_threshold, cost_of, curve, evaluate

ROOT = Path(__file__).resolve().parent
DEFAULT_COSTS = ROOT / "costs.json"
OUTPUTS = ROOT / "outputs"


def parse_args():
    parser = argparse.ArgumentParser(description="Run the search-result judge walkthrough.")
    parser.add_argument("--costs", type=Path, default=DEFAULT_COSTS)
    parser.add_argument("--rescore", action="store_true", help="Call the model even if saved scores match.")
    parser.add_argument(
        "--reuse-scores",
        action="store_true",
        help="Use saved scores or exit. Do not call the model.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Score only the first N cards and write outputs/smoke. A quick check, not the result.",
    )
    args = parser.parse_args()
    if args.rescore and args.reuse_scores:
        parser.error("Pass only one of --rescore and --reuse-scores.")
    return args


def load_costs(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    costs = {}
    for detector in DETECTORS:
        block = data[detector["id"]]
        fp_cost = float(block["fp"])
        fn_cost = float(block["fn"])
        if fp_cost < 0 or fn_cost < 0:
            raise ValueError(f"{detector['id']}: costs must be >= 0")
        costs[detector["id"]] = {"fp": fp_cost, "fn": fn_cost}
    return costs


def round_floats(value):
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, dict):
        return {key: round_floats(item) for key, item in value.items()}
    if isinstance(value, list):
        return [round_floats(item) for item in value]
    return value


def write_json(path, payload):
    path.write_text(json.dumps(round_floats(payload), indent=2) + "\n", encoding="utf-8")


def cache_paths(out_dir):
    return out_dir / "score_meta.json", out_dir / "scores.jsonl"


def cache_is_current(meta, fingerprint, model_name):
    return (
        meta.get("dataset_sha256") == fingerprint
        and meta.get("prompt_version") == judge.PROMPT_VERSION
        and meta.get("model") == model_name
        and meta.get("backend") == _backend_name()
    )


def _backend_name():
    import os

    return os.environ.get("JUDGE_BACKEND", "local").strip().lower()


def _expected_model_name():
    import os

    if _backend_name() == "openai":
        return os.environ.get("OPENAI_MODEL", "")
    return os.environ.get("JUDGE_MODEL", judge.DEFAULT_MODEL)


def load_cached_scores(out_dir, fingerprint):
    meta_path, scores_path = cache_paths(out_dir)
    if not meta_path.exists() or not scores_path.exists():
        return None
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    if not cache_is_current(meta, fingerprint, _expected_model_name()):
        return None
    scores = []
    for line in scores_path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            scores.append(json.loads(line))
    return meta, scores


def save_scores(out_dir, meta, scores):
    meta_path, scores_path = cache_paths(out_dir)
    write_json(meta_path, meta)
    lines = [json.dumps(round_floats(row)) for row in scores]
    scores_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def obtain_scores(rows, out_dir, fingerprint, rescore, reuse_only):
    cached = None if rescore else load_cached_scores(out_dir, fingerprint)
    if cached is not None:
        print(f"Reusing saved scores in {out_dir} (model was not called).")
        return cached
    if reuse_only:
        raise SystemExit(
            "No matching saved scores. Run without --reuse-scores, or pass --rescore, "
            "to call the model."
        )
    print(f"Scoring {len(rows)} cards with the judge. This runs the model on CPU.")
    started = time.time()

    def progress(done, total):
        print(f"  scored {done}/{total}", flush=True)

    meta, scores = judge.score_rows(rows, progress=progress)
    meta["dataset_sha256"] = fingerprint
    save_scores(out_dir, meta, scores)
    print(f"Scoring finished in {time.time() - started:.1f}s.")
    return meta, scores


def slice_records(rows, detector, score_by_id):
    records = []
    for row in rows:
        if row["badge"] != detector["badge"]:
            continue
        scored = score_by_id[row["id"]]
        overlap = baseline.fit_score(row["query"], row["title"], row["details"])
        records.append(
            {
                **row,
                "p_fit": scored["p_fit"],
                "yes_no_mass": scored["yes_no_mass"],
                "judge_score": decision_score(scored["p_fit"], detector["positive_when_fits"]),
                "baseline_score": decision_score(overlap, detector["positive_when_fits"]),
                "label": row[detector["id"]],
            }
        )
    return records


def pack_scorer(records, score_key, fp_cost, fn_cost):
    """Choose the cutoff on tune. Report tune, holdout, 0.50, and a peeking oracle."""
    tune = [row for row in records if row["split"] == "tune"]
    holdout = [row for row in records if row["split"] == "holdout"]
    tune_labels = [row["label"] for row in tune]
    tune_scores = [row[score_key] for row in tune]
    hold_labels = [row["label"] for row in holdout]
    hold_scores = [row[score_key] for row in holdout]
    chosen = choose_threshold(tune_labels, tune_scores, fp_cost, fn_cost)
    at_half = evaluate(hold_labels, hold_scores, 0.5)
    at_choice = evaluate(hold_labels, hold_scores, chosen["threshold"])
    oracle = choose_threshold(hold_labels, hold_scores, fp_cost, fn_cost)
    return {
        "threshold": chosen["threshold"],
        "tune": {
            "cost": chosen["cost"],
            "metrics": chosen["metrics"],
            "cost_at_half": cost_of(evaluate(tune_labels, tune_scores, 0.5), fp_cost, fn_cost),
            "metrics_at_half": evaluate(tune_labels, tune_scores, 0.5),
        },
        "holdout": {
            "metrics": at_choice,
            "cost": cost_of(at_choice, fp_cost, fn_cost),
            "metrics_at_half": at_half,
            "cost_at_half": cost_of(at_half, fp_cost, fn_cost),
        },
        "holdout_oracle": {
            "threshold": oracle["threshold"],
            "cost": oracle["cost"],
            "metrics": oracle["metrics"],
            "note": "This cutoff was fit on the holdout. Do not cite it as the result.",
        },
        "flag_all_holdout_cost": (len(hold_labels) - sum(hold_labels)) * fp_cost,
        "flag_none_holdout_cost": sum(hold_labels) * fn_cost,
        "curves": {
            "tune": curve(tune_labels, tune_scores, fp_cost, fn_cost),
            "holdout": curve(hold_labels, hold_scores, fp_cost, fn_cost),
        },
    }


def brief(row, score_key):
    return {
        "id": row["id"],
        "query": row["query"],
        "title": row["title"],
        "details": row["details"],
        "case": row["case"],
        "fits": row["fits"],
        "label": row["label"],
        "score": row[score_key],
        "p_fit": row["p_fit"],
        "note": row["note"],
    }


def mistakes(records, score_key, threshold, kind, limit=8):
    if kind == "fp":
        rows = [row for row in records if row["label"] == 0 and row[score_key] >= threshold]
        rows.sort(key=lambda row: (-row[score_key], row["id"]))
    else:
        rows = [row for row in records if row["label"] == 1 and row[score_key] < threshold]
        rows.sort(key=lambda row: (row[score_key], row["id"]))
    return [brief(row, score_key) for row in rows[:limit]]


def by_case(records, score_key, threshold):
    groups = {}
    for row in records:
        bucket = groups.setdefault(row["case"], {"n": 0, "positives": 0, "correct": 0})
        bucket["n"] += 1
        bucket["positives"] += int(row["label"])
        predicted = row[score_key] >= threshold
        if predicted == bool(row["label"]):
            bucket["correct"] += 1
    return [{"case": case, **groups[case]} for case in ("exact", "extra_ok", "paraphrase", "near_miss", "off_topic") if case in groups]


def organic_summary(rows, score_by_id):
    holdout = [row for row in rows if row["badge"] == "organic" and row["split"] == "holdout"]
    if not holdout:
        return None
    correct = 0
    fit_scores = []
    miss_scores = []
    for row in holdout:
        p_fit = score_by_id[row["id"]]["p_fit"]
        predicted = p_fit >= 0.5
        if predicted == bool(row["fits"]):
            correct += 1
        (fit_scores if row["fits"] else miss_scores).append(p_fit)
    return {
        "n": len(holdout),
        "accuracy_at_half": correct / len(holdout),
        "mean_p_fit_when_fits": sum(fit_scores) / len(fit_scores) if fit_scores else None,
        "mean_p_fit_when_not": sum(miss_scores) / len(miss_scores) if miss_scores else None,
        "note": "Organic cards are not one of the two decisions. 0.50 here is only a glance, not a tuned cutoff.",
    }


def extreme_examples(rows, scores):
    """Three real cards: most sure it fits, most sure it does not, closest to 0.50.

    Yes/No mass is about 1 on every card in this run, so ranking by mass does
    not show anything. Rank by P(fits) instead.
    """
    by_id = {row["id"]: row for row in rows}

    def pack(scored):
        row = by_id[scored["id"]]
        return {
            "id": row["id"],
            "query": row["query"],
            "title": row["title"],
            "details": row["details"],
            "fits": row["fits"],
            "badge": row["badge"],
            "p_fit": scored["p_fit"],
            "yes_no_mass": scored["yes_no_mass"],
            "top": scored["top"][:5],
        }

    highest = max(scores, key=lambda row: (row["p_fit"], row["id"]))
    lowest = min(scores, key=lambda row: (row["p_fit"], row["id"]))
    nearest = min(scores, key=lambda row: (abs(row["p_fit"] - 0.5), row["id"]))
    return pack(highest), pack(lowest), pack(nearest)


def series(points, key):
    return [point[key] for point in points]


def build_detector_report(detector, records, costs):
    fp_cost = costs["fp"]
    fn_cost = costs["fn"]
    judge_pack = pack_scorer(records, "judge_score", fp_cost, fn_cost)
    baseline_pack = pack_scorer(records, "baseline_score", fp_cost, fn_cost)
    holdout = [row for row in records if row["split"] == "holdout"]
    judge_t = judge_pack["threshold"]
    base_t = baseline_pack["threshold"]
    return {
        "id": detector["id"],
        "action": detector["action"],
        "fp_means": detector["fp_means"],
        "fn_means": detector["fn_means"],
        "badge": detector["badge"],
        "positive_when_fits": detector["positive_when_fits"],
        "fp_cost": fp_cost,
        "fn_cost": fn_cost,
        "n_tune": sum(row["split"] == "tune" for row in records),
        "n_holdout": len(holdout),
        "holdout_positives": sum(row["label"] for row in holdout),
        "holdout_positive_rate": (sum(row["label"] for row in holdout) / len(holdout)) if holdout else None,
        "judge": {key: value for key, value in judge_pack.items() if key != "curves"},
        "baseline": {key: value for key, value in baseline_pack.items() if key != "curves"},
        "holdout_errors": {
            "judge": {
                "false_positives": mistakes(holdout, "judge_score", judge_t, "fp"),
                "false_negatives": mistakes(holdout, "judge_score", judge_t, "fn"),
            },
            "baseline": {
                "false_positives": mistakes(holdout, "baseline_score", base_t, "fp"),
                "false_negatives": mistakes(holdout, "baseline_score", base_t, "fn"),
            },
        },
        "holdout_by_case": by_case(holdout, "judge_score", judge_t),
        "_curves": {
            "judge_tune_cost": series(judge_pack["curves"]["tune"], "cost"),
            "judge_holdout_cost": series(judge_pack["curves"]["holdout"], "cost"),
            "judge_holdout_precision": series(judge_pack["curves"]["holdout"], "precision"),
            "judge_holdout_recall": series(judge_pack["curves"]["holdout"], "recall"),
            "baseline_tune_cost": series(baseline_pack["curves"]["tune"], "cost"),
            "baseline_holdout_cost": series(baseline_pack["curves"]["holdout"], "cost"),
        },
        "_holdout_scores": [row["judge_score"] for row in holdout],
        "_holdout_labels": [row["label"] for row in holdout],
    }


def fmt_rate(value):
    if value is None:
        return "n/a"
    return f"{value * 100:.1f}%"


def fmt_f1(value):
    if value is None:
        return "n/a"
    return f"{value:.3f}"


def fmt_num(value):
    if value is None:
        return "n/a"
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


def matrix_block(metrics):
    return (
        f"                 predicted yes   predicted no\n"
        f"actual yes       {metrics['tp']:<15} {metrics['fn']}\n"
        f"actual no        {metrics['fp']:<15} {metrics['tn']}"
    )


def scorer_section(name, pack, fp_cost, fn_cost):
    hold = pack["holdout"]
    tune = pack["tune"]
    chosen = pack["threshold"]
    lines = [
        f"{name}",
        f"  cutoff chosen on tune: {chosen:.2f}    default: 0.50    difference: {chosen - 0.5:+.2f}",
        f"  tune cost at chosen cutoff: {fmt_num(tune['cost'])}    tune cost at 0.50: {fmt_num(tune['cost_at_half'])}",
        "  holdout at the chosen cutoff:",
        f"    precision {fmt_rate(hold['metrics']['precision'])}   recall {fmt_rate(hold['metrics']['recall'])}   "
        f"f1 {fmt_f1(hold['metrics']['f1'])}   cost {fmt_num(hold['cost'])}",
        "    " + matrix_block(hold["metrics"]).replace("\n", "\n    "),
        "  holdout at 0.50:",
        f"    precision {fmt_rate(hold['metrics_at_half']['precision'])}   recall {fmt_rate(hold['metrics_at_half']['recall'])}   "
        f"f1 {fmt_f1(hold['metrics_at_half']['f1'])}   cost {fmt_num(hold['cost_at_half'])}",
        "    " + matrix_block(hold["metrics_at_half"]).replace("\n", "\n    "),
        f"  holdout cost if every card is flagged: {fmt_num(pack['flag_all_holdout_cost'])}",
        f"  holdout cost if nothing is flagged: {fmt_num(pack['flag_none_holdout_cost'])}",
        f"  holdout oracle cutoff {pack['holdout_oracle']['threshold']:.2f} would cost {fmt_num(pack['holdout_oracle']['cost'])}. "
        "That peeks. It is not the result.",
        f"  false positive: {fp_cost:g}    false negative: {fn_cost:g}",
    ]
    return "\n".join(lines)


def error_lines(title, rows):
    lines = [title]
    if not rows:
        lines.append("  (none)")
        return lines
    for row in rows:
        lines.append(
            f"  {row['id']}  score {row['score']:.2f}  p_fit {row['p_fit']:.2f}  {row['case']}\n"
            f"    query: {row['query']}\n"
            f"    card: {row['title']} — {row['details']}\n"
            f"    note: {row['note']}"
        )
    return lines


def render_report(payload):
    data = payload["dataset"]
    model = payload["model"]
    lines = [
        "Search-result judge",
        f"Backend: {model.get('backend')}    Model: {model.get('model')}    dtype: {model.get('dtype')}",
        f"Revision: {model.get('revision')}",
        f"Prompt version: {model.get('prompt_version')}    Dataset sha256: {data['sha256'][:12]}",
        f"Cards: {data['rows']}    Queries: {data['queries']} (tune {data['tune_queries']}, holdout {data['holdout_queries']})",
        f"Mean Yes/No token mass: {payload['score_stats']['mean_yes_no_mass']:.3f}",
        f"Cards where Yes+No is under half the distribution: {payload['score_stats']['rows_below_half_mass']}",
        "",
        inventory_text(payload),
    ]
    lines += ["", "Three cards, by P(fits):"]
    for label, key in (
        ("Highest P(fits)", "example_highest_p_fit"),
        ("Lowest P(fits)", "example_lowest_p_fit"),
        ("Closest to 0.50", "example_nearest_half"),
    ):
        card = payload[key]
        lines += [
            f"{label}: {card['id']}  fits={card['fits']}  {card['badge']}",
            f"  query: {card['query']}",
            f"  card: {card['title']} — {card['details']}",
            f"  p_fit {card['p_fit']:.3f}  yes+no mass {card['yes_no_mass']:.3f}",
            "  top: " + ", ".join(f"{item['token']!r} {item['prob']:.3f}" for item in card["top"]),
        ]
    organic = payload.get("organic_holdout")
    if organic:
        lines += [
            "",
            "Organic holdout cards, not used to tune either detector:",
            f"  n {organic['n']}  accuracy if p_fit >= 0.50: {fmt_rate(organic['accuracy_at_half'])}",
            f"  mean p_fit when the card fits: {fmt_num(organic['mean_p_fit_when_fits'])}",
            f"  mean p_fit when it does not: {fmt_num(organic['mean_p_fit_when_not'])}",
        ]
    for detector in payload["detectors"]:
        lines += [
            "",
            "=" * 72,
            detector["id"],
            detector["action"],
            f"Slice: {detector['badge']} cards. Holdout n={detector['n_holdout']}, tune n={detector['n_tune']}.",
            f"Holdout base rate: {detector['holdout_positives']}/{detector['n_holdout']} positive "
            f"({fmt_rate(detector['holdout_positive_rate'])}). "
            "A judge that flags every card would have this precision.",
            f"False positive means: {detector['fp_means']}",
            f"False negative means: {detector['fn_means']}",
            "",
            scorer_section("Judge", detector["judge"], detector["fp_cost"], detector["fn_cost"]),
            "",
            scorer_section("Baseline", detector["baseline"], detector["fp_cost"], detector["fn_cost"]),
            "",
            "Holdout judge mistakes (confident ones first):",
        ]
        lines += error_lines("  False positives", detector["holdout_errors"]["judge"]["false_positives"])
        lines += error_lines("  False negatives", detector["holdout_errors"]["judge"]["false_negatives"])
        lines.append("Holdout by case, judge, at the chosen cutoff (correct / n):")
        for bucket in detector["holdout_by_case"]:
            lines.append(
                f"  {bucket['case']:<12} {bucket['correct']}/{bucket['n']} correct, {bucket['positives']} positive"
            )
    lines.append("")
    return "\n".join(lines)


def inventory_text(payload):
    return payload["dataset"]["inventory"]


def dataset_counts(rows):
    queries = {}
    for row in rows:
        queries[row["query_id"]] = row["split"]
    return {
        "rows": len(rows),
        "queries": len(queries),
        "tune_queries": sum(split == "tune" for split in queries.values()),
        "holdout_queries": sum(split == "holdout" for split in queries.values()),
        "inventory": inventory(rows),
    }


def write_example_prompt(out_dir, row, meta):
    chunks = []
    for message in judge.messages(row):
        chunks.append(f"## {message['role']}\n{message['content']}")
    (out_dir / "example_prompt.txt").write_text("\n\n".join(chunks) + "\n", encoding="utf-8")
    templated = meta.get("templated_example") or ""
    if templated:
        (out_dir / "example_templated_prompt.txt").write_text(templated, encoding="utf-8")


# The phone page reads this file. Keyword overlap is computed here, with the
# same function the report uses, so the page cannot drift from the baseline.
# The combo band is part of the page, not a third model: obvious keyword
# scores stand, and the judge is used only in the middle.
COMBO_LOW = 0.25
COMBO_HIGH = 0.75
TEACHING_CARD_IDS = ("lactose-milk-01", "litter-03", "broth-06")
HIGHLIGHTS = {
    "lactose-milk-04": (
        "Notable miss. Lactaid 2% for lactose-free whole milk. The fat is wrong. "
        "The judge is almost sure it fits, so a flag cutoff of 0.02 lets it through."
    ),
    "gf-pasta-04": (
        "Notable miss. Gluten-free penne for gluten-free spaghetti. The shape is wrong, "
        "and the judge still says Yes."
    ),
    "dish-soap-01": (
        "Dawn dish soap, an ordinary result that fits. It is not in either tuned decision. "
        "Every dish-soap card in this run is scored as if it does not fit."
    ),
    "dish-soap-02": (
        "Notable miss. Store-brand dish soap that fits. P(fits) is about 0.006, "
        "so a flag cutoff of 0.02 calls it a bad swap."
    ),
    "dish-soap-03": (
        "Cascade dishwasher pods. The rules say pods are not dish soap, so this is a bad swap. "
        "The judge agrees."
    ),
    "dish-soap-04": (
        "Softsoap hand soap. It does not fit, and the judge is sure."
    ),
    "dish-soap-05": (
        "Notable miss. Mrs. Meyer's is a sponsored dish soap that fits. "
        "P(fits) is about 0.011, so the ad cutoff drops it."
    ),
    "dish-soap-06": (
        "Cascade Platinum pods, a sponsored ad that does not fit. The judge drops it."
    ),
}


def write_cards(out_dir, rows, meta, score_by_id, fingerprint, costs):
    """One JSON file the phone page can load. Scores come from the saved run."""
    cards = []
    by_id = {}
    for row in rows:
        scored = score_by_id[row["id"]]
        overlap = baseline.fit_score(row["query"], row["title"], row["details"])
        card = {
            "id": row["id"],
            "query_id": row["query_id"],
            "split": row["split"],
            "query": row["query"],
            "badge": row["badge"],
            "title": row["title"],
            "details": row["details"],
            "fits": row["fits"],
            "case": row["case"],
            "note": row["note"],
            "p_fit": scored["p_fit"],
            "yes_mass": scored["yes_mass"],
            "no_mass": scored["no_mass"],
            "overlap": overlap,
        }
        if row["id"] in TEACHING_CARD_IDS:
            card["top"] = scored.get("top", [])[:5]
        reason = HIGHLIGHTS.get(row["id"])
        if reason:
            card["highlight"] = True
            card["highlight_reason"] = reason
        cards.append(card)
        by_id[card["id"]] = card

    evoo = by_id["evoo-06"]
    if evoo["overlap"] != 0 or abs(evoo["p_fit"] - 0.963) > 0.002:
        raise SystemExit(
            f"evoo-06 anchor moved: overlap {evoo['overlap']} p_fit {evoo['p_fit']}"
        )
    if by_id["lactose-milk-04"]["p_fit"] <= 0.99:
        raise SystemExit(f"lactose-milk-04 p_fit is {by_id['lactose-milk-04']['p_fit']}")
    if by_id["dish-soap-02"]["p_fit"] >= 0.02:
        raise SystemExit(f"dish-soap-02 p_fit is {by_id['dish-soap-02']['p_fit']}")

    payload = {
        "source": (
            "Exported by run.py from the scored run in this folder. "
            "p_fit is the judge's P(fits). overlap is the keyword baseline. "
            "Nothing in this file is filled in by hand."
        ),
        "model": meta.get("model"),
        "revision": meta.get("revision"),
        "dtype": meta.get("dtype"),
        "prompt_version": meta.get("prompt_version"),
        "dataset_sha256": fingerprint,
        "costs": costs,
        "combo": {
            "low": COMBO_LOW,
            "high": COMBO_HIGH,
            "rule": (
                "On a decision score, use the keyword score when it is below 0.25 "
                "or at least 0.75. Use the judge score on the unsure band in between."
            ),
        },
        "cards": cards,
    }
    write_json(out_dir / "cards.json", payload)
    print(f"Wrote cards.json ({len(cards)} cards)")


def main():
    args = parse_args()
    rows = load_rows()
    if args.limit:
        rows = rows[: args.limit]
        out_dir = OUTPUTS / "smoke"
    else:
        out_dir = OUTPUTS
    out_dir.mkdir(parents=True, exist_ok=True)
    fingerprint = dataset_sha256(rows)
    costs = load_costs(args.costs)
    meta, scores = obtain_scores(rows, out_dir, fingerprint, args.rescore, args.reuse_scores)
    score_by_id = {row["id"]: row for row in scores}
    missing = [row["id"] for row in rows if row["id"] not in score_by_id]
    if missing:
        raise SystemExit(f"Saved scores are missing {len(missing)} cards, starting at {missing[0]}.")

    write_example_prompt(out_dir, rows[0], meta)
    highest, lowest, nearest = extreme_examples(rows, scores)
    masses = [row["yes_no_mass"] for row in scores]
    detectors = []
    curves = {}
    for detector in DETECTORS:
        records = slice_records(rows, detector, score_by_id)
        report = build_detector_report(detector, records, costs[detector["id"]])
        if not args.limit:
            chart_path = out_dir / f"{detector['id']}.png"
            chart_names = {
                "irrelevant_substitution": ("Bad substitution", "Substitution that fits"),
                "relevant_sponsored": ("Relevant ad", "Ad that does not fit"),
            }
            positive_name, negative_name = chart_names[detector["id"]]
            charts.plot_detector(
                chart_path,
                detector["id"].replace("_", " "),
                report["_holdout_scores"],
                report["_holdout_labels"],
                report["_curves"]["judge_tune_cost"],
                report["_curves"]["judge_holdout_cost"],
                report["judge"]["threshold"],
                positive_name,
                negative_name,
            )
            print(f"Wrote {chart_path.name}")
        curves[detector["id"]] = report["_curves"]
        detectors.append(report)

    public_detectors = []
    for report in detectors:
        public = {key: value for key, value in report.items() if not key.startswith("_")}
        public_detectors.append(public)

    payload = {
        "model": {
            "backend": meta.get("backend"),
            "model": meta.get("model"),
            "revision": meta.get("revision"),
            "dtype": meta.get("dtype"),
            "prompt_version": meta.get("prompt_version"),
            "yes_tokens": meta.get("yes_tokens"),
            "no_tokens": meta.get("no_tokens"),
            "prompt_tokens_max": meta.get("prompt_tokens_max"),
            "prompt_tokens_example": meta.get("prompt_tokens_example"),
        },
        "dataset": {**dataset_counts(rows), "sha256": fingerprint},
        "costs": costs,
        "score_stats": {
            "mean_yes_no_mass": sum(masses) / len(masses),
            "min_yes_no_mass": min(masses),
            "max_yes_no_mass": max(masses),
            "rows_below_half_mass": sum(mass < 0.5 for mass in masses),
        },
        "example_highest_p_fit": highest,
        "example_lowest_p_fit": lowest,
        "example_nearest_half": nearest,
        "organic_holdout": None if args.limit else organic_summary(rows, score_by_id),
        "detectors": public_detectors,
    }
    # prompt token counts are filled by the local scorer when it ran. Older
    # caches may not have them; the report just omits the numbers.
    write_json(out_dir / "results.json", payload)
    write_json(out_dir / "curves.json", curves)
    report_text = render_report(payload)
    (out_dir / "REPORT.txt").write_text(report_text, encoding="utf-8")
    if not args.limit:
        write_cards(out_dir, rows, meta, score_by_id, fingerprint, costs)
    print(report_text)


if __name__ == "__main__":
    main()
