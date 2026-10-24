(function (root) {
  "use strict";

  // Round estimates for the fictional Wren & Co. task. Not a tokenizer.
  var WRITE = 150;
  var PLAN = 72;
  var QUESTION = 28;
  var READER_TASK = 48;
  var SUMMARY_GOOD = 140;
  var SUMMARY_SHORT = 64;

  var FILES = [
    { id: "schema", name: "schema.md", label: "Schema", weight: 18 },
    { id: "customers", name: "customers.json", label: "Customers", weight: 37 },
    { id: "bookings", name: "bookings.json", label: "Bookings", weight: 45 }
  ];

  var DEFAULTS = {
    ratio: 40,
    frontierInPrice: 3,
    frontierOutPrice: 15,
    frontierTps: 50,
    readerInPrice: 0.1,
    readerOutPrice: 0.4,
    readerTps: 200
  };

  function allocate(total, weights) {
    var sum = 0;
    var i;
    for (i = 0; i < weights.length; i += 1) sum += weights[i];
    if (total <= 0 || sum <= 0) return weights.map(function () { return 0; });
    var raw = weights.map(function (w) { return (total * w) / sum; });
    var base = raw.map(function (n) { return Math.floor(n); });
    var used = 0;
    for (i = 0; i < base.length; i += 1) used += base[i];
    var left = total - used;
    var order = raw.map(function (n, idx) {
      return { i: idx, frac: n - base[idx] };
    });
    order.sort(function (a, b) {
      if (b.frac !== a.frac) return b.frac - a.frac;
      return a.i - b.i;
    });
    var out = base.slice();
    for (i = 0; i < left; i += 1) out[order[i].i] += 1;
    return out;
  }

  function money(tokens, pricePerMillion) {
    return (tokens / 1000000) * pricePerMillion;
  }

  function clampNum(value, min, fallback) {
    var n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, n);
  }

  function pricePair(inputTokens, outputTokens, inPrice, outPrice) {
    var inputCost = money(inputTokens, inPrice);
    var outputCost = money(outputTokens, outPrice);
    return {
      input: inputTokens,
      output: outputTokens,
      tokens: inputTokens + outputTokens,
      inputCost: inputCost,
      outputCost: outputCost,
      cost: inputCost + outputCost
    };
  }

  function compute(raw) {
    var src = raw || {};
    var ratio = Math.round(clampNum(src.ratio, 1, DEFAULTS.ratio));
    var dropped = Boolean(src.dropped);
    var frontierInPrice = clampNum(src.frontierInPrice, 0, DEFAULTS.frontierInPrice);
    var frontierOutPrice = clampNum(src.frontierOutPrice, 0, DEFAULTS.frontierOutPrice);
    var frontierTps = clampNum(src.frontierTps, 1, DEFAULTS.frontierTps);
    var readerInPrice = clampNum(src.readerInPrice, 0, DEFAULTS.readerInPrice);
    var readerOutPrice = clampNum(src.readerOutPrice, 0, DEFAULTS.readerOutPrice);
    var readerTps = clampNum(src.readerTps, 1, DEFAULTS.readerTps);

    var readTokens = ratio * WRITE;
    var shares = allocate(readTokens, FILES.map(function (f) { return f.weight; }));
    var summaryTokens = dropped ? SUMMARY_SHORT : SUMMARY_GOOD;
    var summaryShares = allocate(summaryTokens, shares);

    var files = FILES.map(function (f, i) {
      return {
        id: f.id,
        name: f.name,
        label: f.label,
        tokens: shares[i]
      };
    });

    var oneIn = QUESTION + readTokens;
    var oneOut = PLAN + WRITE;
    var one = pricePair(oneIn, oneOut, frontierInPrice, frontierOutPrice);
    one.seconds = one.tokens / frontierTps;
    one.frontierTokens = one.tokens;
    one.readerTokens = 0;

    var jobs = files.map(function (f, i) {
      var input = READER_TASK + f.tokens;
      var output = summaryShares[i];
      var tokens = input + output;
      return {
        id: f.id,
        name: f.name,
        label: f.label,
        input: input,
        output: output,
        tokens: tokens,
        seconds: tokens / readerTps
      };
    });

    var slowest = jobs[0];
    var readerInput = 0;
    var readerOutput = 0;
    var j;
    for (j = 0; j < jobs.length; j += 1) {
      readerInput += jobs[j].input;
      readerOutput += jobs[j].output;
      if (jobs[j].seconds > slowest.seconds) slowest = jobs[j];
    }
    var reader = pricePair(readerInput, readerOutput, readerInPrice, readerOutPrice);
    reader.seconds = slowest.seconds;

    var plannerOut = dropped ? PLAN : PLAN + WRITE;
    var planner = pricePair(QUESTION + summaryTokens, plannerOut, frontierInPrice, frontierOutPrice);
    planner.seconds = planner.tokens / frontierTps;

    var splitCost = reader.cost + planner.cost;
    var splitSeconds = reader.seconds + planner.seconds;
    var splitTokens = reader.tokens + planner.tokens;

    return {
      ratio: ratio,
      dropped: dropped,
      shipped: !dropped,
      writeTokens: WRITE,
      planTokens: PLAN,
      questionTokens: QUESTION,
      readerTaskTokens: READER_TASK,
      summaryTokens: summaryTokens,
      readTokens: readTokens,
      files: files,
      jobs: jobs,
      slowestId: slowest.id,
      prices: {
        frontierIn: frontierInPrice,
        frontierOut: frontierOutPrice,
        frontierTps: frontierTps,
        readerIn: readerInPrice,
        readerOut: readerOutPrice,
        readerTps: readerTps
      },
      one: one,
      reader: reader,
      planner: planner,
      split: {
        tokens: splitTokens,
        cost: splitCost,
        seconds: splitSeconds,
        frontierTokens: planner.tokens,
        readerTokens: reader.tokens,
        inputCost: reader.inputCost + planner.inputCost,
        outputCost: reader.outputCost + planner.outputCost
      }
    };
  }

  function cheapestRatio(raw) {
    var src = raw || {};
    var best = null;
    var r;
    for (r = 1; r <= 80; r += 1) {
      var next = {};
      var key;
      for (key in src) if (Object.prototype.hasOwnProperty.call(src, key)) next[key] = src[key];
      next.ratio = r;
      next.dropped = false;
      var run = compute(next);
      if (run.split.cost < run.one.cost && run.split.seconds < run.one.seconds) {
        best = r;
        break;
      }
    }
    return best;
  }

  root.SplitModel = {
    WRITE: WRITE,
    PLAN: PLAN,
    QUESTION: QUESTION,
    READER_TASK: READER_TASK,
    SUMMARY_GOOD: SUMMARY_GOOD,
    SUMMARY_SHORT: SUMMARY_SHORT,
    FILES: FILES,
    DEFAULTS: DEFAULTS,
    allocate: allocate,
    compute: compute,
    cheapestRatio: cheapestRatio
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
