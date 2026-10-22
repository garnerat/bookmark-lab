"""Threshold math for one binary detector.

A score is a number from 0 to 1. Predicting positive means score >= threshold.
Cost is (false positives * fp_cost) + (false negatives * fn_cost).

The search is the same 0.01 grid as the eval threshold tuner demo. When two
cutoffs have the same cost, the higher one wins. It makes fewer positive
predictions, so a tie does not flip a coin.
"""

from __future__ import annotations


def evaluate(labels, scores, threshold):
    """Confusion counts, precision, recall, and F1 at one cutoff."""
    if len(labels) != len(scores):
        raise ValueError("labels and scores must be the same length")
    tp = fp = fn = tn = 0
    for label, score in zip(labels, scores):
        predicted = score >= threshold
        if predicted and label:
            tp += 1
        elif predicted and not label:
            fp += 1
        elif (not predicted) and label:
            fn += 1
        else:
            tn += 1
    precision = tp / (tp + fp) if (tp + fp) else None
    recall = tp / (tp + fn) if (tp + fn) else None
    f1 = None
    if precision is not None and recall is not None and (precision + recall) > 0:
        f1 = 2 * precision * recall / (precision + recall)
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "n": len(labels),
    }


def cost_of(metrics, fp_cost, fn_cost):
    return metrics["fp"] * fp_cost + metrics["fn"] * fn_cost


def choose_threshold(labels, scores, fp_cost, fn_cost):
    """Cutoff with the lowest cost on these rows. Ties go to the higher cutoff."""
    if not labels:
        raise ValueError("cannot choose a threshold on an empty slice")
    best = None
    for step in range(0, 101):
        threshold = step / 100
        metrics = evaluate(labels, scores, threshold)
        cost = cost_of(metrics, fp_cost, fn_cost)
        better = best is None or cost < best["cost"]
        tie = best is not None and cost == best["cost"] and threshold > best["threshold"]
        if better or tie:
            best = {"threshold": threshold, "cost": cost, "metrics": metrics}
    return best


def curve(labels, scores, fp_cost, fn_cost):
    """Cost, precision, and recall at every 0.01 cutoff. Used for the chart."""
    points = []
    for step in range(0, 101):
        threshold = step / 100
        metrics = evaluate(labels, scores, threshold)
        points.append(
            {
                "threshold": threshold,
                "cost": cost_of(metrics, fp_cost, fn_cost),
                "precision": metrics["precision"],
                "recall": metrics["recall"],
                "tp": metrics["tp"],
                "fp": metrics["fp"],
                "fn": metrics["fn"],
                "tn": metrics["tn"],
            }
        )
    return points
