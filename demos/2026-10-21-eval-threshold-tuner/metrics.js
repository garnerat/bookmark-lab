/* Pure scoring helpers for the threshold tuner. No DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EvalMetrics = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function evaluate(rows, judgeId, threshold) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const send = row.scores[judgeId] >= threshold;
      if (send && row.pass) tp += 1;
      else if (send && !row.pass) fp += 1;
      else if (!send && row.pass) fn += 1;
      else tn += 1;
    }
    const predicted = tp + fp;
    const actualGood = tp + fn;
    const precision = predicted === 0 ? null : tp / predicted;
    const recall = actualGood === 0 ? null : tp / actualGood;
    const f1 = precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);
    return { tp, fp, fn, tn, precision, recall, f1 };
  }

  function costOf(metrics, nCost) {
    return metrics.fp * nCost + metrics.fn;
  }

  /* Search the same 0.01 grid the slider can land on.
     Ties go to the higher cutoff, which sends fewer drafts. */
  function bestThreshold(rows, judgeId, nCost) {
    let best = null;
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const metrics = evaluate(rows, judgeId, t);
      const cost = costOf(metrics, nCost);
      if (!best || cost < best.cost || (cost === best.cost && t > best.t)) {
        best = { t, cost, tp: metrics.tp, fp: metrics.fp, fn: metrics.fn, tn: metrics.tn, precision: metrics.precision, recall: metrics.recall, f1: metrics.f1 };
      }
    }
    return best;
  }

  function curve(rows, judgeId) {
    const points = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const metrics = evaluate(rows, judgeId, t);
      points.push({
        t,
        tp: metrics.tp,
        fp: metrics.fp,
        fn: metrics.fn,
        tn: metrics.tn,
        precision: metrics.precision,
        recall: metrics.recall,
        f1: metrics.f1,
      });
    }
    return points;
  }

  function histogram(rows, judgeId, binCount) {
    const bins = [];
    for (let i = 0; i < binCount; i++) {
      bins.push({ lo: i / binCount, hi: (i + 1) / binCount, pass: 0, fail: 0 });
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let idx = Math.floor(row.scores[judgeId] * binCount);
      if (idx < 0) idx = 0;
      if (idx >= binCount) idx = binCount - 1;
      if (row.pass) bins[idx].pass += 1;
      else bins[idx].fail += 1;
    }
    return bins;
  }

  function reliability(rows, judgeId, groups) {
    const sorted = rows.slice().sort(function (a, b) {
      return a.scores[judgeId] - b.scores[judgeId] || a.id - b.id;
    });
    const base = Math.floor(sorted.length / groups);
    let extra = sorted.length % groups;
    const out = [];
    let index = 0;
    for (let g = 0; g < groups; g++) {
      const n = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      const slice = sorted.slice(index, index + n);
      index += n;
      let mean = 0;
      let good = 0;
      for (let i = 0; i < slice.length; i++) {
        mean += slice[i].scores[judgeId];
        if (slice[i].pass) good += 1;
      }
      out.push({ mean: mean / n, rate: good / n, n: n });
    }
    return out;
  }

  function brier(rows, judgeId) {
    let total = 0;
    for (let i = 0; i < rows.length; i++) {
      const y = rows[i].pass ? 1 : 0;
      const d = rows[i].scores[judgeId] - y;
      total += d * d;
    }
    return total / rows.length;
  }

  return {
    evaluate: evaluate,
    costOf: costOf,
    bestThreshold: bestThreshold,
    curve: curve,
    histogram: histogram,
    reliability: reliability,
    brier: brier,
  };
});
