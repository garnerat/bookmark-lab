"""Cost curve and score histogram for one detector.

The solid cost line is the tune split. That is the curve the cutoff minimizes.
The dashed line is the holdout split, drawn so you can see it, not so you can
pick a cutoff from it. A threshold of 0.30 on the judge is not the same
decision as 0.30 on the keyword baseline, so the baseline stays in the table.
"""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

PAPER = "#fffdf8"
INK = "#1c1915"
MUTED = "#7a6d5d"
POSITIVE = "#8f3d2b"
NEGATIVE = "#1e4d3a"


def plot_detector(path, title, scores, labels, tune_cost, holdout_cost, chosen, positive_name, negative_name):
    scores = np.asarray(scores, dtype=float)
    labels = np.asarray(labels, dtype=int)
    tune_cost = np.asarray(tune_cost, dtype=float)
    holdout_cost = np.asarray(holdout_cost, dtype=float)
    thresholds = np.arange(101) / 100

    fig, axes = plt.subplots(1, 2, figsize=(11.2, 4.5), facecolor=PAPER)
    for axis in axes:
        axis.set_facecolor(PAPER)
        axis.tick_params(colors=INK)
        for spine in axis.spines.values():
            spine.set_color("#e3d8c8")

    _histogram(axes[0], scores, labels, positive_name, negative_name)
    _cost(axes[1], thresholds, tune_cost, holdout_cost, chosen)
    fig.suptitle(title, color=INK, fontsize=13, x=0.02, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.94))
    fig.savefig(path, dpi=140, bbox_inches="tight", facecolor=PAPER)
    plt.close(fig)


def _histogram(axis, scores, labels, positive_name, negative_name):
    edges = np.linspace(0, 1, 11)
    pos = scores[labels == 1]
    neg = scores[labels == 0]
    axis.hist(neg, bins=edges, color=NEGATIVE, alpha=0.8, label=negative_name)
    axis.hist(pos, bins=edges, color=POSITIVE, alpha=0.65, label=positive_name)
    axis.set_xlim(0, 1)
    axis.set_xlabel("Judge score on the holdout slice")
    axis.set_ylabel("Cards")
    axis.set_title("Scores, holdout")
    axis.legend(frameon=False, fontsize=9)


def _cost(axis, thresholds, tune_cost, holdout_cost, chosen):
    axis.plot(thresholds, tune_cost, color=INK, linewidth=2, label="Tune cost (this is minimized)")
    axis.plot(
        thresholds,
        holdout_cost,
        color=MUTED,
        linewidth=1.5,
        linestyle="--",
        label="Holdout cost (not used to choose)",
    )
    chosen_index = int(round(chosen * 100))
    axis.axvline(chosen, color=POSITIVE, linewidth=1.5, label=f"Chosen {chosen:.2f}")
    if abs(chosen - 0.5) > 1e-9:
        axis.axvline(0.5, color=NEGATIVE, linewidth=1, linestyle=":", label="0.50")
    axis.scatter([chosen], [tune_cost[chosen_index]], color=POSITIVE, zorder=3)
    # Keep the label on the plot even when the cutoff sits on the left edge.
    text_x = min(chosen + 0.03, 0.72)
    axis.annotate(
        f"chosen {chosen:.2f}\ntune cost {tune_cost[chosen_index]:.0f}",
        xy=(chosen, tune_cost[chosen_index]),
        xytext=(text_x, tune_cost[chosen_index]),
        color=POSITIVE,
        fontsize=8,
        va="bottom",
    )
    axis.set_xlim(0, 1)
    axis.set_ylim(0, max(float(tune_cost.max()), float(holdout_cost.max()), 1) * 1.12)
    axis.set_xlabel("Threshold")
    axis.set_ylabel("Cost")
    axis.set_title("Cost by threshold")
    axis.legend(frameon=False, fontsize=8)
