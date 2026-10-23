"use strict";

var STEPS = [
  ["cards", "Cards"],
  ["score", "Score"],
  ["swap", "Flag"],
  ["ad", "Keep"],
  ["try", "Try it"]
];

var DETECTORS = {
  swap: {
    key: "swap",
    costId: "irrelevant_substitution",
    badge: "substitution",
    positiveWhenFits: false,
    title: "Flag a bad substitution",
    blurb: "Only substitution cards. Flagging means the swap does not fit.",
    positiveName: "Bad swap",
    negativeName: "Fits",
    predictPos: "Flag",
    predictNeg: "Show",
    fpShort: "Good swap flagged",
    fnShort: "Bad swap shown",
    tpShort: "Bad swap flagged",
    tnShort: "Good swap shown",
    allText: "Flagging every holdout swap",
    noneText: "Flagging none"
  },
  ad: {
    key: "ad",
    costId: "relevant_sponsored",
    badge: "sponsored",
    positiveWhenFits: true,
    title: "Keep a relevant ad",
    blurb: "Only sponsored cards. Keeping means the ad fits the query.",
    positiveName: "Fits",
    negativeName: "Does not fit",
    predictPos: "Keep",
    predictNeg: "Drop",
    fpShort: "Junk ad kept",
    fnShort: "Good ad dropped",
    tpShort: "Good ad kept",
    tnShort: "Junk ad dropped",
    allText: "Keeping every holdout ad",
    noneText: "Dropping every holdout ad"
  }
};

var SPOTLIGHTS = [
  ["lactose-milk-04", "Lactaid 2%"],
  ["gf-pasta-04", "Gluten-free penne"],
  ["dish-soap-02", "Store-brand dish soap"],
  ["dish-soap-05", "Mrs. Meyer's ad"]
];

var state = {
  step: "cards",
  scorer: "judge",
  swap: { fp: 1, fn: 5, step: 2 },
  ad: { fp: 4, fn: 1, step: 59 },
  defaults: null,
  listSplit: "holdout",
  cell: null,
  openId: null,
  query: "",
  focus: null,
  notice: "",
  scrollTo: null,
  data: null,
  checkErrors: []
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function formatCost(value) {
  if (Math.abs(value - Math.round(value)) < 1e-6) return String(Math.round(value));
  return value.toFixed(1);
}

function formatPct(value) {
  if (value === null || value === undefined) return "n/a";
  return (Math.round(value * 1000) / 10).toFixed(1) + "%";
}

function formatScore(value) {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

function formatCut(step) {
  return (step / 100).toFixed(2);
}

function cards() {
  return state.data.cards;
}

function byId(id) {
  return state.data.byId[id];
}

function detOf(key) {
  return DETECTORS[key];
}

function keywordScore(card, det) {
  return det.positiveWhenFits ? card.overlap : 1 - card.overlap;
}

function judgeScore(card, det) {
  return det.positiveWhenFits ? card.p_fit : 1 - card.p_fit;
}

function decisionScore(card, det, scorer) {
  var judge = judgeScore(card, det);
  var keyword = keywordScore(card, det);
  if (scorer === "judge") return judge;
  if (scorer === "keyword") return keyword;
  var band = state.data.combo;
  if (keyword < band.low || keyword >= band.high) return keyword;
  return judge;
}

function usesJudge(card, det) {
  var keyword = keywordScore(card, det);
  var band = state.data.combo;
  return keyword >= band.low && keyword < band.high;
}

function labelOf(card, det) {
  return det.positiveWhenFits ? card.fits : card.fits ? 0 : 1;
}

function sliceRows(detKey, split) {
  var det = detOf(detKey);
  return cards().filter(function (card) {
    return card.badge === det.badge && (!split || card.split === split);
  });
}

function evaluate(rows, det, scorer, step) {
  var threshold = step / 100;
  var tp = 0;
  var fp = 0;
  var fn = 0;
  var tn = 0;
  rows.forEach(function (card) {
    var label = labelOf(card, det);
    var predicted = decisionScore(card, det, scorer) >= threshold;
    if (predicted && label) tp += 1;
    else if (predicted && !label) fp += 1;
    else if (!predicted && label) fn += 1;
    else tn += 1;
  });
  return {
    tp: tp,
    fp: fp,
    fn: fn,
    tn: tn,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    n: rows.length
  };
}

function costOf(metrics, fpCost, fnCost) {
  return metrics.fp * fpCost + metrics.fn * fnCost;
}

function sweep(rows, det, scorer, fpCost, fnCost) {
  var best = null;
  var points = [];
  for (var step = 0; step <= 100; step += 1) {
    var metrics = evaluate(rows, det, scorer, step);
    var cost = costOf(metrics, fpCost, fnCost);
    points.push({ step: step, cost: cost, metrics: metrics });
    var better = !best || cost < best.cost || (cost === best.cost && step > best.step);
    if (better) best = points[points.length - 1];
  }
  return { points: points, best: best };
}

function prices(detKey) {
  return state[detKey];
}

function runSelfCheck() {
  var errors = [];
  function expectStep(detKey, scorer, fp, fn, split, expected) {
    var found = sweep(sliceRows(detKey, split), detOf(detKey), scorer, fp, fn).best.step;
    if (found !== expected) {
      errors.push(detKey + " " + scorer + " " + split + " cutoff " + formatCut(found));
    }
  }
  expectStep("swap", "judge", 1, 5, "tune", 2);
  expectStep("ad", "judge", 4, 1, "tune", 59);
  expectStep("swap", "keyword", 1, 5, "tune", 19);
  expectStep("ad", "keyword", 4, 1, "tune", 100);
  var swap = evaluate(sliceRows("swap", "holdout"), detOf("swap"), "judge", 2);
  if (swap.tp !== 29 || swap.fp !== 14 || swap.fn !== 2 || swap.tn !== 3) {
    errors.push("swap holdout matrix " + [swap.tp, swap.fp, swap.fn, swap.tn].join("/"));
  }
  var ad = evaluate(sliceRows("ad", "holdout"), detOf("ad"), "judge", 59);
  if (ad.tp !== 14 || ad.fp !== 3 || ad.fn !== 2 || ad.tn !== 14) {
    errors.push("ad holdout matrix " + [ad.tp, ad.fp, ad.fn, ad.tn].join("/"));
  }
  ["evoo-06", "lactose-milk-04", "gf-pasta-04", "dish-soap-02", "dish-soap-05"].forEach(function (id) {
    if (!byId(id)) errors.push("missing " + id);
  });
  if (byId("evoo-06").overlap !== 0) errors.push("evoo overlap");
  if (byId("lactose-milk-04").p_fit <= 0.99) errors.push("lactaid p_fit");
  if (byId("dish-soap-02").p_fit >= 0.02) errors.push("dish soap p_fit");
  return errors;
}

function scorerName(scorer) {
  if (scorer === "judge") return "Judge";
  if (scorer === "keyword") return "Keywords";
  return "Combo";
}

function renderSteps() {
  var nav = document.getElementById("steps");
  nav.innerHTML = STEPS.map(function (pair) {
    var current = pair[0] === state.step ? ' aria-current="step"' : "";
    return '<button type="button" data-action="step" data-step="' + pair[0] + '"' + current + ">" + pair[1] + "</button>";
  }).join("");
}

function nextButton(step, label) {
  return '<button type="button" class="next" data-action="step" data-step="' + step + '">' + esc(label) + "</button>";
}

function massBar(card) {
  var yes = card.yes_mass;
  var no = card.no_mass;
  var total = yes + no || 1;
  var yesPct = (yes / total) * 100;
  var noPct = (no / total) * 100;
  return (
    '<div class="mass" aria-hidden="true"><div class="yes" style="width:' +
    yesPct.toFixed(2) +
    '%"></div><div class="no" style="width:' +
    noPct.toFixed(2) +
    '%"></div></div>'
  );
}

function detail(card, detKey) {
  var rows = [
    ["Query", card.query],
    ["Product", card.title],
    ["Details", card.details],
    ["Human label", card.fits ? "Fits" : "Does not fit"],
    ["Why", card.note],
    ["P(fits)", formatScore(card.p_fit)],
    ["Yes mass", formatScore(card.yes_mass)],
    ["No mass", formatScore(card.no_mass)],
    ["Keyword overlap", formatScore(card.overlap)]
  ];
  var html = massBar(card);
  html += "<dl>" + rows.map(function (row) {
    return "<dt>" + esc(row[0]) + "</dt><dd>" + esc(row[1]) + "</dd>";
  }).join("") + "</dl>";
  ["swap", "ad"].forEach(function (key) {
    var det = detOf(key);
    if (card.badge !== det.badge) return;
    var judge = judgeScore(card, det);
    var keyword = keywordScore(card, det);
    var combo = decisionScore(card, det, "combo");
    var who = usesJudge(card, det) ? "the judge" : "the keyword score";
    html += "<p><strong>" + esc(det.title) + ".</strong> Judge score " + formatScore(judge) +
      ". Keyword score " + formatScore(keyword) +
      ". Combo uses " + who + ", score " + formatScore(combo) + ".</p>";
    if (detKey === key) {
      var onJudge = judge >= prices(key).step / 100;
      var onKey = keyword >= prices(key).step / 100;
      var onCombo = combo >= prices(key).step / 100;
      html += "<p>At the current cutoff " + formatCut(prices(key).step) + ": judge would " +
        (onJudge ? det.predictPos.toLowerCase() : det.predictNeg.toLowerCase()) +
        ", keywords would " + (onKey ? det.predictPos.toLowerCase() : det.predictNeg.toLowerCase()) +
        ", combo would " + (onCombo ? det.predictPos.toLowerCase() : det.predictNeg.toLowerCase()) + ".</p>";
    }
  });
  if (card.highlight_reason) html += "<p>" + esc(card.highlight_reason) + "</p>";
  if (card.top && card.top.length) {
    html += "<p>Next-token top: " + card.top.slice(0, 4).map(function (item) {
      return esc(item.token) + " " + formatScore(item.prob);
    }).join(", ") + ".</p>";
  }
  return '<div class="detail">' + html + "</div>";
}

function cardView(card, detKey) {
  var open = state.openId === card.id;
  var det = detKey ? detOf(detKey) : null;
  var decision = "";
  if (det) {
    var on = decisionScore(card, det, state.scorer) >= prices(detKey).step / 100;
    decision = '<span class="pill' + (on ? " on" : "") + '">' + (on ? det.predictPos : det.predictNeg) + "</span>";
  }
  var spot = card.highlight ? '<span class="pill spot">Notable</span>' : "";
  return (
    '<article class="card' + (card.highlight ? " spot" : "") + (open ? " open" : "") + '" id="card-' + esc(card.id) + '">' +
      '<button type="button" class="card-hit" data-action="open" data-id="' + esc(card.id) + '" aria-expanded="' + open + '">' +
        '<span class="kicker">' + esc(card.badge) + " · " + esc(card.split) + " " + spot + decision + "</span>" +
        '<span class="title">' + esc(card.title) + "</span>" +
        '<span class="sub">' + esc(card.query) + "</span>" +
        '<span class="nums">P(fits) ' + formatScore(card.p_fit) + " · words " + formatScore(card.overlap) + "</span>" +
      "</button>" +
      (open ? detail(card, detKey) : "") +
    "</article>"
  );
}

function teachingCard(id) {
  return cardView(byId(id), null);
}

function scoreStory() {
  var high = byId("lactose-milk-01");
  var low = byId("litter-03");
  var mid = byId("broth-06");
  var lactaid = byId("lactose-milk-04");
  var evoo = byId("evoo-06");
  return (
    '<section class="stack prose">' +
      "<h2>Yes or No becomes a score</h2>" +
      "<p>The model is not asked to type a percentage. The prompt ends with “Yes or No:” and we read the probability of the next token.</p>" +
      "<p><strong>P(fits) = P(Yes) / (P(Yes) + P(No)).</strong> Other words are ignored. On this run, Yes and No together are essentially the whole distribution.</p>" +
      '<div class="examples">' +
        "<div><p><strong>Almost sure it fits.</strong> " + esc(high.title) + " for “" + esc(high.query) + "”. Yes " +
          formatScore(high.yes_mass) + ", No " + formatScore(high.no_mass) + ", P(fits) " + formatScore(high.p_fit) + ".</p>" +
          massBar(high) + teachingCard(high.id) + "</div>" +
        "<div><p><strong>Almost sure it does not.</strong> " + esc(low.title) + ", “" + esc(low.details) + "”, for “" + esc(low.query) + "”. This card is in the tune split. P(fits) " +
          formatScore(low.p_fit) + ".</p>" + massBar(low) + teachingCard(low.id) + "</div>" +
        "<div><p><strong>A coin flip.</strong> " + esc(mid.title) + " for “" + esc(mid.query) + "”. Yes and No are each " +
          formatScore(mid.yes_mass) + ". This one is tune, not a holdout result. P(fits) " + formatScore(mid.p_fit) + ".</p>" +
          massBar(mid) + teachingCard(mid.id) + "</div>" +
      "</div>" +
      "<p>That probability is not a decision yet. Each decision uses a score where a higher number means “do it.”</p>" +
      "<p><strong>Flag a bad swap</strong> uses 1 − P(fits). " + esc(lactaid.title) + " has P(fits) " + formatScore(lactaid.p_fit) +
        ", so the flag score is " + formatScore(1 - lactaid.p_fit) + ". A cutoff of 0.02 does not flag it.</p>" +
      "<p><strong>Keep an ad</strong> uses P(fits) itself. " + esc(evoo.title) + " has P(fits) " + formatScore(evoo.p_fit) +
        " and keyword overlap " + formatScore(evoo.overlap) + ". The card says EVOO, not the words in “" + esc(evoo.query) + ".”</p>" +
      nextButton("swap", "Next: flag a bad swap") +
    "</section>"
  );
}

function cardsStory() {
  var all = cards();
  var queries = {};
  var tuneQueries = {};
  var holdQueries = {};
  all.forEach(function (card) {
    queries[card.query_id] = true;
    if (card.split === "tune") tuneQueries[card.query_id] = true;
    else holdQueries[card.query_id] = true;
  });
  var counts = { organic: 0, substitution: 0, sponsored: 0 };
  all.forEach(function (card) { counts[card.badge] += 1; });
  return (
    '<section class="stack prose">' +
      "<h2>What the cards are</h2>" +
      "<p>Each row is one product under one grocery query. A person decided whether it fits. The store already printed a badge. The model never sees that badge.</p>" +
      "<p><strong>Organic</strong> (" + counts.organic + ") is an ordinary result. This walkthrough does not tune a cutoff on it.</p>" +
      "<p><strong>Substitution</strong> (" + counts.substitution + ") is something the store swapped in. The decision is whether to flag it.</p>" +
      "<p><strong>Sponsored</strong> (" + counts.sponsored + ") is an ad. The decision is whether to keep it.</p>" +
      "<p>" + all.length + " cards, " + Object.keys(queries).length + " queries. " +
        Object.keys(tuneQueries).length + " queries are tune, where the cutoff is chosen. " +
        Object.keys(holdQueries).length + " are holdout. A query is never in both.</p>" +
      "<p>P(fits) is the judge. Words is the share of query words that appear on the card. Both numbers are from the saved run of " +
        esc(state.data.model) + ", " + esc(state.data.dtype) + ". They are not filled in by hand.</p>" +
      spotlightRow() +
      '<label class="slider"><span class="row"><span>Find a card</span></span>' +
        '<input class="search" id="finder" type="search" enterkeyhint="search" placeholder="Query, product, or id" value="' + esc(state.query) + '"></label>' +
      '<div id="live"></div>' +
      nextButton("score", "Next: how the score is made") +
    "</section>"
  );
}

function spotlightRow() {
  var chips = SPOTLIGHTS.map(function (pair) {
    return '<button type="button" class="chip" data-action="spotlight" data-id="' + pair[0] + '">' + esc(pair[1]) + "</button>";
  }).join("");
  chips += '<button type="button" class="chip" data-action="dish-soap">Dish-soap cards</button>';
  return '<div class="chips">' + chips + "</div>";
}

function visibleCards(detKey) {
  var list = detKey ? sliceRows(detKey, state.listSplit) : cards().slice();
  if (state.focus === "dish-soap") {
    list = cards().filter(function (card) { return card.query_id === "dish-soap"; });
  } else if (state.focus) {
    list = cards().filter(function (card) { return card.id === state.focus; });
  }
  if (state.cell && detKey && state.focus !== "dish-soap") {
    var det = detOf(detKey);
    var kind = state.cell.kind;
    var split = state.cell.split;
    list = sliceRows(detKey, split).filter(function (card) {
      var label = labelOf(card, det);
      var predicted = decisionScore(card, det, state.scorer) >= prices(detKey).step / 100;
      if (kind === "tp") return predicted && label;
      if (kind === "fp") return predicted && !label;
      if (kind === "fn") return !predicted && label;
      return !predicted && !label;
    });
  }
  if (!detKey && state.query.trim()) {
    var q = state.query.trim().toLowerCase();
    list = list.filter(function (card) {
      return (card.query + " " + card.title + " " + card.details + " " + card.id + " " + card.note).toLowerCase().indexOf(q) !== -1;
    });
  }
  list = list.slice().sort(function (a, b) {
    if (a.highlight !== b.highlight) return a.highlight ? -1 : 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return list;
}

function listBlock(detKey) {
  var list = visibleCards(detKey);
  var head = "";
  if (detKey && state.focus !== "dish-soap") {
    head =
      '<div class="list-head"><p>' + list.length + " cards</p>" +
      '<div class="seg" role="group" aria-label="Which split to list">' +
        '<button type="button" data-action="list-split" data-split="tune" aria-pressed="' + (state.listSplit === "tune") + '">Tune</button>' +
        '<button type="button" data-action="list-split" data-split="holdout" aria-pressed="' + (state.listSplit === "holdout") + '">Holdout</button>' +
      "</div></div>";
    if (state.cell) {
      head += '<button type="button" class="text-btn" data-action="clear-cell">Showing one cell of the ' +
        esc(state.cell.split) + " matrix. Show the whole list.</button>";
    }
  } else if (state.focus) {
    head = '<button type="button" class="text-btn" data-action="clear-focus">Showing a highlighted set. Show the list again.</button>';
  } else {
    head = "<p class=\"note\">" + list.length + " cards. Tap one.</p>";
  }
  var body = list.length ? list.map(function (card) { return cardView(card, detKey); }).join("") : "<p>No cards in this slice.</p>";
  return head + '<div class="stack">' + body + "</div>";
}

function sparkline(tune, hold, currentStep) {
  var max = 1;
  tune.points.forEach(function (point) { if (point.cost > max) max = point.cost; });
  hold.points.forEach(function (point) { if (point.cost > max) max = point.cost; });
  function path(points) {
    return points.map(function (point, index) {
      var x = point.step;
      var y = (36 - (point.cost / max) * 32).toFixed(2);
      return (index ? "L" : "M") + x + " " + y;
    }).join("");
  }
  function line(step, color) {
    return '<line x1="' + step + '" y1="2" x2="' + step + '" y2="38" stroke="' + color + '" stroke-width="0.8"/>';
  }
  return (
    '<div class="chart" data-action="chart" role="group" aria-label="Cost at every cutoff. Tap to move the cutoff.">' +
      '<svg viewBox="0 0 100 40" preserveAspectRatio="none">' +
        line(50, "#1e4d3a") +
        line(tune.best.step, "#7a6d5d") +
        line(currentStep, "#8f3d2b") +
        '<path d="' + path(tune.points) + '" fill="none" stroke="#1c1915" stroke-width="1.4" vector-effect="non-scaling-stroke"/>' +
        '<path d="' + path(hold.points) + '" fill="none" stroke="#8f3d2b" stroke-width="1.4" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>' +
      "</svg></div>" +
      '<p class="legend"><span><i></i>Tune cost</span><span><i class="hold"></i>Holdout cost</span>' +
      '<span><i class="now"></i>Cutoff</span><span><i class="half"></i>0.50</span></p>'
  );
}

function matrixButton(det, splitName, kind, count, short, tone, pressed) {
  return '<button type="button" class="' + tone + '" data-action="cell" data-split="' + splitName + '" data-kind="' + kind + '" aria-pressed="' + pressed + '">' +
    "<b>" + count + "</b><span>" + esc(short) + "</span></button>";
}

function splitPanel(name, point, det, detKey) {
  var metrics = point.metrics;
  var title = name === "tune" ? "Tune" : "Holdout";
  var pressed = function (kind) {
    return state.cell && state.cell.split === name && state.cell.kind === kind;
  };
  return (
    '<section class="panel"><h3>' + title + "</h3>" +
      '<p class="costline">Cost <strong>' + formatCost(point.cost) + "</strong></p>" +
      '<p class="pr">Precision ' + formatPct(metrics.precision) + "<br>Recall " + formatPct(metrics.recall) + "<br>" + metrics.n + " cards</p>" +
      '<div class="matrix">' +
        matrixButton(det, name, "tp", metrics.tp, det.tpShort, "ok", pressed("tp")) +
        matrixButton(det, name, "fn", metrics.fn, det.fnShort, "bad", pressed("fn")) +
        matrixButton(det, name, "fp", metrics.fp, det.fpShort, "bad", pressed("fp")) +
        matrixButton(det, name, "tn", metrics.tn, det.tnShort, "ok", pressed("tn")) +
      "</div></section>"
  );
}

function comparisonStrip(detKey) {
  var det = detOf(detKey);
  var price = prices(detKey);
  var buttons = ["judge", "keyword", "combo"].map(function (scorer) {
    var best = sweep(sliceRows(detKey, "tune"), det, scorer, price.fp, price.fn).best;
    var hold = evaluate(sliceRows(detKey, "holdout"), det, scorer, best.step);
    var cost = costOf(hold, price.fp, price.fn);
    var pressed = state.scorer === scorer && price.step === best.step;
    return '<button type="button" data-action="use-scorer" data-scorer="' + scorer + '" data-step="' + best.step + '" aria-pressed="' + pressed + '">' +
      scorerName(scorer) + "<strong>" + formatCost(cost) + "</strong><small>at " + formatCut(best.step) + "</small></button>";
  }).join("");
  return '<div class="stack"><p class="note">Holdout cost when each scorer uses the cutoff it picked on tune. Tap one to jump there.</p><div class="seg">' + buttons + "</div></div>";
}

function decisionStory(detKey) {
  var det = detOf(detKey);
  var price = prices(detKey);
  return (
    '<section class="stack">' +
      "<div class=\"prose\"><h2>" + esc(det.title) + "</h2><p>" + esc(det.blurb) + "</p>" +
      '<p id="price-line"></p>' +
      "<p>The cutoff we would ship is the cheapest one on tune. A tie takes the higher cutoff. The holdout column is the check. 0.50 is marked so you can compare it.</p></div>" +
      (state.notice ? '<div class="banner">' + esc(state.notice) + ' <button type="button" class="chip" data-action="dismiss">Dismiss</button></div>' : "") +
      '<div class="stack"><p class="note">Which score</p><div class="seg" role="group" aria-label="Which score">' +
        ["judge", "keyword", "combo"].map(function (scorer) {
          return '<button type="button" data-action="scorer" data-scorer="' + scorer + '" aria-pressed="' + (state.scorer === scorer) + '">' + scorerName(scorer) + "</button>";
        }).join("") +
      "</div></div>" +
      sliderBlock(detKey, "step", "Cutoff", formatCut(price.step), 0, 100, 1) +
      sliderBlock(detKey, "fp", "Cost of a false alarm", formatCost(price.fp), 0, 10, 1) +
      sliderBlock(detKey, "fn", "Cost of a miss", formatCost(price.fn), 0, 10, 1) +
      '<div class="jumps">' +
        '<button type="button" data-action="jump-tune" data-det="' + detKey + '">Use tune’s cheapest cutoff</button>' +
        '<button type="button" data-action="jump-half" data-det="' + detKey + '">Use 0.50</button>' +
        '<button type="button" data-action="jump-peek" data-det="' + detKey + '">Peek at holdout’s cheapest</button>' +
        '<button type="button" data-action="reset" data-det="' + detKey + '">Reset prices</button>' +
      "</div>" +
      '<div id="live"></div>' +
      nextButton(detKey === "swap" ? "ad" : "try", detKey === "swap" ? "Next: keep a relevant ad" : "Next: try it yourself") +
    "</section>"
  );
}

function sliderBlock(detKey, key, label, shown, min, max, step) {
  var value = prices(detKey)[key];
  return (
    '<label class="slider"><span class="row"><span>' + label + "</span><span>" + shown + "</span></span>" +
      '<input type="range" data-slider="' + detKey + "." + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"></label>'
  );
}

function lessonText(detKey, tune, hold) {
  var step = prices(detKey).step;
  var at = hold.points[step].cost;
  var half = hold.points[50].cost;
  var tuneAt = tune.points[step].cost;
  var tuneHalf = tune.points[50].cost;
  var best = tune.best;
  var peek = hold.best;
  var where = "The slider is at " + formatCut(step) + ". Tune cost here is " + formatCost(tuneAt) +
    " (at 0.50 it is " + formatCost(tuneHalf) + "). Holdout cost here is " + formatCost(at) +
    " (at 0.50 it is " + formatCost(half) + ").";
  var picked = "";
  if (step === best.step) {
    if (at > half) {
      picked = " This is the cutoff tune picked. On holdout it costs more than 0.50. Tuning helped the split it could see.";
    } else if (at < half) {
      picked = " This is the cutoff tune picked. It also costs less on holdout than 0.50.";
    } else {
      picked = " This is the cutoff tune picked. On holdout it costs the same as 0.50.";
    }
  } else {
    picked = " Tune’s cheapest is " + formatCut(best.step) + ", cost " + formatCost(best.cost) +
      " on tune and " + formatCost(hold.points[best.step].cost) + " on holdout.";
  }
  var peekText = " Holdout’s own cheapest cutoff is " + formatCut(peek.step) + ", cost " + formatCost(peek.cost) +
    ". That peeks at the holdout labels, so it is not the result.";
  return "<p>" + where + picked + peekText + "</p>";
}

function extremeLine(detKey, holdRows) {
  var det = detOf(detKey);
  var price = prices(detKey);
  var positives = 0;
  holdRows.forEach(function (card) { if (labelOf(card, det)) positives += 1; });
  var negatives = holdRows.length - positives;
  var allCost = negatives * price.fp;
  var noneCost = positives * price.fn;
  return "<p class=\"note\">" + det.allText + " costs " + formatCost(allCost) + ". " + det.noneText + " costs " + formatCost(noneCost) + ".</p>";
}

function comboLine(detKey) {
  if (state.scorer !== "combo") return "";
  var det = detOf(detKey);
  var rows = sliceRows(detKey, state.listSplit);
  var unsure = rows.filter(function (card) { return usesJudge(card, det); }).length;
  var band = state.data.combo;
  return "<p>Combo rule: if the keyword score is below " + band.low + " or at least " + band.high +
    ", keep it. Otherwise ask the judge. In this " + state.listSplit + " list, the judge is used on " +
    unsure + " of " + rows.length + " cards.</p>";
}

function syncPriceLine() {
  var line = document.getElementById("price-line");
  if (!line) return;
  var price = prices(state.step);
  line.textContent = "A miss costs " + formatCost(price.fn) + ". A false alarm costs " + formatCost(price.fp) +
    ". Total cost is false alarms times " + formatCost(price.fp) + " plus misses times " + formatCost(price.fn) + ".";
}

function paintLive() {
  var live = document.getElementById("live");
  if (!live) {
    syncPriceLine();
    return;
  }
  if (state.step === "cards") {
    live.innerHTML = listBlock(null);
    return;
  }
  var detKey = state.step;
  var det = detOf(detKey);
  var price = prices(detKey);
  var tune = sweep(sliceRows(detKey, "tune"), det, state.scorer, price.fp, price.fn);
  var hold = sweep(sliceRows(detKey, "holdout"), det, state.scorer, price.fp, price.fn);
  var hereTune = tune.points[price.step];
  var hereHold = hold.points[price.step];
  live.innerHTML =
    comboLine(detKey) +
    sparkline(tune, hold, price.step) +
    '<div class="prose">' + lessonText(detKey, tune, hold) + "</div>" +
    '<div class="cols">' +
      splitPanel("tune", hereTune, det, detKey) +
      splitPanel("holdout", hereHold, det, detKey) +
    "</div>" +
    comparisonStrip(detKey) +
    extremeLine(detKey, sliceRows(detKey, "holdout")) +
    spotlightRow() +
    listBlock(detKey);
  syncPriceLine();
}

function tryStory() {
  return (
    '<section class="stack">' +
      "<div class=\"prose\"><h2>Try it</h2><p>The first five change this page. Adding a card or swapping the model needs the Python run, because this page cannot call the model.</p></div>" +
      prompt(1, "Price a missed swap the same as a false flag",
        "A miss is 5 and a false flag is 1, so tune picks a very low cutoff. Set them equal and see where the cutoff moves. Compare that holdout cost with 0.50.",
        '<button type="button" data-action="ex-equal">Set both costs to 1</button>') +
      prompt(2, "Make a dropped good ad the expensive mistake",
        "Keeping a junk ad is 4 and dropping a good ad is 1, so the cutoff sits above 0.50. Flip those prices.",
        '<button type="button" data-action="ex-flip-ad">Set false alarm to 1 and miss to 4</button>') +
      prompt(3, "Let keywords decide the obvious cards",
        "If the keyword score is under 0.25 or at least 0.75, keep it. Ask the judge only for the middle. Then read the holdout-cost strip on each decision.",
        '<button type="button" data-action="ex-combo">Use the combo on the swap decision</button>') +
      prompt(4, "Open the misses",
        "Lactaid 2% is lactose-free and the wrong fat. Gluten-free penne is the wrong shape. The dish-soap cards are scored as if none of them fit.",
        '<button type="button" data-action="spotlight" data-id="lactose-milk-04">Open Lactaid 2%</button>' +
        '<button type="button" data-action="spotlight" data-id="gf-pasta-04">Open gluten-free penne</button>' +
        '<button type="button" data-action="dish-soap">Open the dish-soap cards</button>') +
      prompt(5, "See which split the tuning helped",
        "On ads, with the original prices, put the slider on tune’s cheapest cutoff. Then tap 0.50. Compare the two columns.",
        '<button type="button" data-action="ex-holdout">Show the ad decision at tune’s cutoff</button>') +
      prompt(6, "Add a card, or swap the model",
        "Those change the dataset hash or the model name, so the next Python run calls the model again. The phone page cannot do that.",
        '<a class="as-button" href="./WALKTHROUGH.md">Open the run-it-yourself steps</a>') +
      nextButton("cards", "Back to the cards") +
    "</section>"
  );
}

function prompt(number, title, body, control) {
  return '<article class="prompt"><h2>' + number + ". " + esc(title) + "</h2><p>" + esc(body) + "</p>" + control + "</article>";
}

function render() {
  renderSteps();
  var app = document.getElementById("app");
  var html = "";
  if (state.step === "cards") html = cardsStory();
  else if (state.step === "score") html = scoreStory();
  else if (state.step === "swap" || state.step === "ad") html = decisionStory(state.step);
  else html = tryStory();
  app.innerHTML = html;
  bindControls();
  paintLive();
  if (state.scrollTo) {
    var node = document.getElementById("card-" + state.scrollTo);
    if (node) node.scrollIntoView({ block: "center" });
    state.scrollTo = null;
  }
}

function bindControls() {
  var finder = document.getElementById("finder");
  if (finder) {
    finder.addEventListener("input", function () {
      state.query = finder.value;
      state.focus = null;
      paintLive();
    });
  }
  document.querySelectorAll("[data-slider]").forEach(function (input) {
    input.addEventListener("input", function () {
      var parts = input.dataset.slider.split(".");
      state[parts[0]][parts[1]] = Number(input.value);
      var label = input.parentNode.querySelector(".row span:last-child");
      if (label) label.textContent = parts[1] === "step" ? formatCut(state[parts[0]].step) : formatCost(state[parts[0]][parts[1]]);
      paintLive();
    });
  });
}

function setStep(step) {
  if (!STEPS.some(function (pair) { return pair[0] === step; })) return;
  state.step = step;
  if (location.hash !== "#" + step) location.hash = step;
  render();
}

function applyDefaults(detKey) {
  var defaults = state.defaults[detOf(detKey).costId];
  state[detKey].fp = defaults.fp;
  state[detKey].fn = defaults.fn;
}

function jumpToTune(detKey) {
  var price = prices(detKey);
  var best = sweep(sliceRows(detKey, "tune"), detOf(detKey), state.scorer, price.fp, price.fn).best;
  price.step = best.step;
}

function onClick(event) {
  var el = event.target.closest("[data-action]");
  if (!el || !state.data) return;
  var action = el.dataset.action;
  if (action === "step") {
    state.notice = "";
    setStep(el.dataset.step);
    return;
  }
  if (action === "scorer") {
    state.scorer = el.dataset.scorer;
    render();
    return;
  }
  if (action === "use-scorer") {
    state.scorer = el.dataset.scorer;
    state[state.step].step = Number(el.dataset.step);
    render();
    return;
  }
  if (action === "open") {
    var id = el.dataset.id;
    state.openId = state.openId === id ? null : id;
    var live = document.getElementById("live");
    var existing = document.getElementById("card-" + id);
    if (live && existing && live.contains(existing)) paintLive();
    else render();
    return;
  }
  if (action === "list-split") {
    state.listSplit = el.dataset.split;
    state.cell = null;
    paintLive();
    return;
  }
  if (action === "cell") {
    var same = state.cell && state.cell.split === el.dataset.split && state.cell.kind === el.dataset.kind;
    state.cell = same ? null : { split: el.dataset.split, kind: el.dataset.kind };
    if (state.cell) state.listSplit = state.cell.split;
    state.focus = null;
    paintLive();
    return;
  }
  if (action === "clear-cell") {
    state.cell = null;
    paintLive();
    return;
  }
  if (action === "clear-focus") {
    state.focus = null;
    state.openId = null;
    paintLive();
    return;
  }
  if (action === "spotlight") {
    openCard(el.dataset.id);
    return;
  }
  if (action === "dish-soap") {
    state.focus = "dish-soap";
    state.openId = "dish-soap-02";
    state.cell = null;
    state.query = "";
    state.scrollTo = "dish-soap-02";
    state.notice = "Every dish-soap card in this run. Store-brand soap and Mrs. Meyer’s fit, and the judge scores both near zero.";
    setStep("cards");
    return;
  }
  if (action === "dismiss") {
    state.notice = "";
    render();
    return;
  }
  if (action === "jump-tune") {
    jumpToTune(el.dataset.det);
    render();
    return;
  }
  if (action === "jump-half") {
    state[el.dataset.det].step = 50;
    render();
    return;
  }
  if (action === "jump-peek") {
    var key = el.dataset.det;
    var price = prices(key);
    state[key].step = sweep(sliceRows(key, "holdout"), detOf(key), state.scorer, price.fp, price.fn).best.step;
    state.notice = "This cutoff was chosen by looking at the holdout. It is not the result.";
    render();
    return;
  }
  if (action === "reset") {
    applyDefaults(el.dataset.det);
    state.scorer = "judge";
    jumpToTune(el.dataset.det);
    state.notice = "";
    render();
    return;
  }
  if (action === "chart") {
    if (state.step !== "swap" && state.step !== "ad") return;
    var rect = el.getBoundingClientRect();
    var ratio = (event.clientX - rect.left) / rect.width;
    var detKey = state.step;
    state[detKey].step = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    var slider = document.querySelector('[data-slider="' + detKey + '.step"]');
    if (slider) {
      slider.value = String(state[detKey].step);
      var shown = slider.parentNode.querySelector(".row span:last-child");
      if (shown) shown.textContent = formatCut(state[detKey].step);
    }
    paintLive();
    return;
  }
  if (action === "ex-equal") {
    state.swap.fp = 1;
    state.swap.fn = 1;
    state.scorer = "judge";
    jumpToTune("swap");
    state.listSplit = "holdout";
    state.cell = null;
    state.focus = null;
    state.notice = "Both costs are 1. Look at the cutoff tune picked, then tap 0.50 and compare the holdout cost.";
    setStep("swap");
    return;
  }
  if (action === "ex-flip-ad") {
    state.ad.fp = 1;
    state.ad.fn = 4;
    state.scorer = "judge";
    jumpToTune("ad");
    state.listSplit = "holdout";
    state.cell = null;
    state.focus = null;
    state.notice = "A junk ad costs 1 and a dropped good ad costs 4. See whether tune’s cutoff fell below 0.50.";
    setStep("ad");
    return;
  }
  if (action === "ex-combo") {
    state.scorer = "combo";
    applyDefaults("swap");
    jumpToTune("swap");
    state.listSplit = "holdout";
    state.cell = null;
    state.focus = null;
    state.notice = "Combo is on. Read the strip under the matrices, then open Keep an ad and read that strip too.";
    setStep("swap");
    return;
  }
  if (action === "ex-holdout") {
    state.scorer = "judge";
    applyDefaults("ad");
    jumpToTune("ad");
    state.listSplit = "holdout";
    state.cell = null;
    state.focus = null;
    state.notice = "Slider is on the cutoff tune picked. Compare the two cost numbers, then tap 0.50.";
    setStep("ad");
    return;
  }
}

function openCard(id) {
  var card = byId(id);
  if (!card) return;
  state.focus = id;
  state.openId = id;
  state.cell = null;
  state.query = "";
  state.scrollTo = id;
  state.listSplit = card.split;
  var step = "cards";
  if (card.badge === "substitution") step = "swap";
  else if (card.badge === "sponsored") step = "ad";
  if (card.badge === "substitution" || card.badge === "sponsored") state.focus = null;
  state.notice = card.highlight_reason || "";
  setStep(step);
}

function showCheck() {
  var box = document.getElementById("check");
  if (!state.checkErrors.length) {
    box.hidden = true;
    document.body.dataset.check = "ok";
    return;
  }
  box.hidden = false;
  box.className = "banner error";
  box.textContent = "The page’s math does not match the saved run: " + state.checkErrors.join("; ") + ".";
  document.body.dataset.check = "fail";
}

function boot() {
  document.body.addEventListener("click", onClick);
  window.addEventListener("hashchange", function () {
    var step = location.hash.replace("#", "");
    if (!STEPS.some(function (pair) { return pair[0] === step; })) return;
    if (step === state.step) return;
    state.step = step;
    render();
  });
  fetch("outputs/cards.json")
    .then(function (response) {
      if (!response.ok) throw new Error("outputs/cards.json " + response.status);
      return response.json();
    })
    .then(function (data) {
      data.byId = {};
      data.cards.forEach(function (card) { data.byId[card.id] = card; });
      state.data = data;
      state.defaults = data.costs;
      applyDefaults("swap");
      applyDefaults("ad");
      state.scorer = "judge";
      jumpToTune("swap");
      jumpToTune("ad");
      state.checkErrors = runSelfCheck();
      showCheck();
      var hash = location.hash.replace("#", "");
      if (STEPS.some(function (pair) { return pair[0] === hash; })) state.step = hash;
      render();
    })
    .catch(function (error) {
      document.getElementById("app").textContent = "The scored cards did not load (" + error.message + ").";
    });
}

boot();
