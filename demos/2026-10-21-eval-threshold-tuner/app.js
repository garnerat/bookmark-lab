(function () {
  var M = window.EvalMetrics;
  var DATA = window.EVAL_DATA;
  var readout = document.getElementById("readout");
  if (!M || !DATA || !DATA.rows) {
    if (readout) readout.textContent = "The demo data failed to load.";
    return;
  }

  var JUDGES = {
    calibrated: {
      name: "Calibrated",
      blurb: "Built so a score lines up with the share of drafts at that score that are actually good. Good and bad drafts still overlap, so the cutoff still changes which mistakes you make.",
    },
    overconfident: {
      name: "Overconfident",
      blurb: "Same ranking as the calibrated judge, with scores pushed up and toward the extremes. The precision–recall curve matches. 0.50 is a looser gate here, and a high score is more sure of itself than the labels support.",
    },
    weak: {
      name: "Weak",
      blurb: "Scores are squeezed toward the middle, and noise changes the ranking. Good and bad drafts pile up together, so no cutoff separates them cleanly.",
    },
  };

  var COL = {
    ink: "#1c1915",
    muted: "#5c5348",
    line: "#e3d8c8",
    pass: "#1e4d3a",
    fail: "#8f3d2b",
    paper: "#fffdf8",
    grid: "#efe6da",
  };

  var state = { judge: "calibrated", threshold: 0.5, costN: 5, filter: "all" };
  var rows = DATA.rows;
  var goodCount = rows.filter(function (r) { return r.pass; }).length;
  var failPattern = null;

  document.getElementById("data-count").textContent = String(rows.length);
  var facts = document.getElementById("facts");
  DATA.facts.forEach(function (fact) {
    var li = document.createElement("li");
    li.textContent = fact;
    facts.appendChild(li);
  });

  var thresholdInput = document.getElementById("threshold");
  var costInput = document.getElementById("cost");

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function pct(x) { return x == null ? "—" : (100 * x).toFixed(1) + "%"; }
  function f1text(x) { return x == null ? "—" : x.toFixed(2); }
  function drafts(n, singular) {
    return n + " " + (n === 1 ? singular : singular + "s");
  }

  function kind(row) {
    var send = row.scores[state.judge] >= state.threshold;
    if (send && row.pass) return "tp";
    if (send && !row.pass) return "fp";
    if (!send && row.pass) return "fn";
    return "tn";
  }

  function matches(row) {
    var k = kind(row);
    if (state.filter === "all") return true;
    if (state.filter === "send") return k === "tp" || k === "fp";
    if (state.filter === "hold") return k === "fn" || k === "tn";
    return k === state.filter;
  }

  function frame(canvas) {
    var cssW = canvas.clientWidth || canvas.parentElement.clientWidth || 320;
    var cssH = 240;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = "12px Segoe UI, system-ui, sans-serif";
    var pad = { l: 44, r: 14, t: 16, b: 32 };
    return { ctx: ctx, w: cssW, h: cssH, pad: pad, plotW: cssW - pad.l - pad.r, plotH: cssH - pad.t - pad.b };
  }

  function hatch(ctx) {
    if (failPattern) return failPattern;
    var tile = document.createElement("canvas");
    tile.width = 6;
    tile.height = 6;
    var c = tile.getContext("2d");
    c.fillStyle = COL.fail;
    c.fillRect(0, 0, 6, 6);
    c.strokeStyle = "rgba(255,253,248,0.5)";
    c.beginPath();
    c.moveTo(0, 6);
    c.lineTo(6, 0);
    c.stroke();
    failPattern = ctx.createPattern(tile, "repeat");
    return failPattern;
  }

  function axisBox(view) {
    var ctx = view.ctx;
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(view.pad.l + 0.5, view.pad.t + 0.5, view.plotW, view.plotH);
  }

  function sameT(a, b) { return Math.round(a * 100) === Math.round(b * 100); }

  function yTicks(view, max, digits) {
    var ctx = view.ctx;
    ctx.fillStyle = COL.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    [0, 0.5, 1].forEach(function (frac) {
      var y = view.pad.t + view.plotH - frac * view.plotH;
      var value = max * frac;
      var text = digits == null ? String(Math.round(value)) : value.toFixed(digits);
      ctx.fillText(text, view.pad.l - 6, y);
    });
  }

  function xTicks01(view) {
    var ctx = view.ctx;
    ctx.fillStyle = COL.muted;
    ctx.textBaseline = "top";
    [0, 0.5, 1].forEach(function (v) {
      ctx.textAlign = v === 0 ? "left" : v === 1 ? "right" : "center";
      ctx.fillText(v.toFixed(1), view.pad.l + v * view.plotW, view.pad.t + view.plotH + 6);
    });
  }

  function drawHistogram(bins, threshold) {
    var view = frame(document.getElementById("hist"));
    var ctx = view.ctx;
    failPattern = null;
    var max = 1;
    bins.forEach(function (b) { max = Math.max(max, b.pass + b.fail); });
    axisBox(view);
    yTicks(view, max);
    var slot = view.plotW / bins.length;
    bins.forEach(function (b, i) {
      var base = view.pad.l + i * slot;
      var gap = Math.min(4, slot * 0.12);
      var bw = Math.max(2, (slot - gap * 3) / 2);
      var ph = (b.pass / max) * view.plotH;
      var fh = (b.fail / max) * view.plotH;
      var y0 = view.pad.t + view.plotH;
      ctx.fillStyle = COL.pass;
      ctx.fillRect(base + gap, y0 - ph, bw, ph);
      ctx.fillStyle = hatch(ctx);
      ctx.fillRect(base + gap * 2 + bw, y0 - fh, bw, fh);
    });
    var tx = view.pad.l + clamp(threshold, 0, 1) * view.plotW;
    ctx.strokeStyle = COL.ink;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(tx, view.pad.t);
    ctx.lineTo(tx, view.pad.t + view.plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COL.ink;
    ctx.textBaseline = "bottom";
    ctx.textAlign = tx > view.pad.l + view.plotW - 40 ? "right" : "left";
    ctx.fillText(threshold.toFixed(2), tx + (ctx.textAlign === "right" ? -4 : 4), view.pad.t + 14);
    xTicks01(view);
  }

  function xy(view, x, y) {
    return {
      x: view.pad.l + clamp(x, 0, 1) * view.plotW,
      y: view.pad.t + (1 - clamp(y, 0, 1)) * view.plotH,
    };
  }

  function drawMarker(ctx, x, y, kindName) {
    ctx.beginPath();
    if (kindName === "diamond") {
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 7, y);
      ctx.closePath();
      ctx.fillStyle = COL.pass;
      ctx.fill();
      return;
    }
    ctx.arc(x, y, kindName === "open" ? 5 : 6, 0, Math.PI * 2);
    if (kindName === "open") {
      ctx.fillStyle = COL.paper;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COL.ink;
      ctx.stroke();
      return;
    }
    ctx.fillStyle = COL.ink;
    ctx.fill();
  }

  function drawPR(points, baseRate, threshold, bestT) {
    var view = frame(document.getElementById("pr"));
    var ctx = view.ctx;
    axisBox(view);
    yTicks(view, 1, 1);
    xTicks01(view);
    var yBase = view.pad.t + (1 - baseRate) * view.plotH;
    ctx.strokeStyle = COL.line;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(view.pad.l, yBase);
    ctx.lineTo(view.pad.l + view.plotW, yBase);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = COL.fail;
    ctx.lineWidth = 2;
    var started = false;
    points.forEach(function (p) {
      if (p.precision == null || p.recall == null) return;
      var pt = xy(view, p.recall, p.precision);
      if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.lineWidth = 1;
    function mark(t, kindName) {
      var p = points[Math.round(t * 100)];
      if (!p || p.precision == null) return;
      var pt = xy(view, p.recall, p.precision);
      drawMarker(ctx, pt.x, pt.y, kindName);
    }
    if (!sameT(threshold, 0.5)) mark(0.5, "open");
    if (!sameT(threshold, bestT)) mark(bestT, "diamond");
    mark(threshold, "current");
  }

  function drawCost(points, nCost, threshold, bestT) {
    var view = frame(document.getElementById("cost-chart"));
    var ctx = view.ctx;
    var costs = points.map(function (p) { return p.fp * nCost + p.fn; });
    var max = Math.max.apply(null, costs.concat([1]));
    axisBox(view);
    yTicks(view, max);
    xTicks01(view);
    ctx.beginPath();
    ctx.strokeStyle = COL.brick;
    ctx.lineWidth = 2;
    costs.forEach(function (c, i) {
      var x = view.pad.l + (i / 100) * view.plotW;
      var y = view.pad.t + (1 - c / max) * view.plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.lineWidth = 1;
    var tx = view.pad.l + threshold * view.plotW;
    ctx.strokeStyle = COL.ink;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(tx, view.pad.t);
    ctx.lineTo(tx, view.pad.t + view.plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    var bi = Math.round(bestT * 100);
    var bx = view.pad.l + (bi / 100) * view.plotW;
    var by = view.pad.t + (1 - costs[bi] / max) * view.plotH;
    drawMarker(ctx, bx, by, "diamond");
  }

  function drawCal(points) {
    var view = frame(document.getElementById("cal"));
    var ctx = view.ctx;
    axisBox(view);
    yTicks(view, 1, 1);
    xTicks01(view);
    ctx.strokeStyle = COL.muted;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(view.pad.l, view.pad.t + view.plotH);
    ctx.lineTo(view.pad.l + view.plotW, view.pad.t);
    ctx.stroke();
    ctx.setLineDash([]);
    points.forEach(function (p) {
      var pt = xy(view, p.mean, p.rate);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = Math.abs(p.mean - p.rate) >= 0.08 ? COL.fail : COL.pass;
      ctx.fill();
    });
  }

  function calibrationSentence(points) {
    var worst = points[0];
    points.forEach(function (p) {
      if (Math.abs(p.mean - p.rate) > Math.abs(worst.mean - worst.rate)) worst = p;
    });
    var gap = Math.abs(worst.mean - worst.rate);
    if (gap < 0.06) {
      return "The biggest gap on this chart is small, so a score is close to the share of drafts that are actually good.";
    }
    var mean = worst.mean.toFixed(2);
    var rate = Math.round(worst.rate * 100);
    if (worst.mean > worst.rate) {
      return "Biggest gap: drafts scored near " + mean + " are actually good " + rate + "% of the time. The judge is too sure those drafts are good.";
    }
    return "Biggest gap: drafts scored near " + mean + " are actually good " + rate + "% of the time. The judge is too pessimistic there.";
  }

  function renderList() {
    var list = document.getElementById("list");
    var names = {
      all: "drafts",
      send: "sent drafts",
      hold: "held drafts",
      fp: "false passes",
      fn: "false fails",
      tp: "true passes",
      tn: "true fails",
    };
    var shown = rows.filter(matches).sort(function (a, b) {
      return b.scores[state.judge] - a.scores[state.judge] || a.id - b.id;
    });
    document.getElementById("list-count").textContent = "Showing " + shown.length + " " + names[state.filter];
    var frag = document.createDocumentFragment();
    if (!shown.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No drafts in this group at the current cutoff.";
      frag.appendChild(empty);
    }
    shown.forEach(function (row) {
      var k = kind(row);
      var art = document.createElement("article");
      art.className = "ex " + k;
      var top = document.createElement("div");
      top.className = "ex-top";
      var score = document.createElement("span");
      score.className = "score";
      score.textContent = row.scores[state.judge].toFixed(2);
      var truth = document.createElement("span");
      truth.className = "badge " + (row.pass ? "good" : "bad");
      truth.textContent = row.pass ? "Good" : "Bad";
      var decision = document.createElement("span");
      decision.className = "badge";
      var decisionName = { tp: "Sent · true pass", fp: "Sent · false pass", fn: "Held · false fail", tn: "Held · true fail" };
      decision.textContent = decisionName[k];
      var who = document.createElement("span");
      who.className = "who";
      who.textContent = row.topic + " · " + row.customer;
      top.appendChild(score);
      top.appendChild(truth);
      top.appendChild(decision);
      top.appendChild(who);
      var draft = document.createElement("p");
      draft.className = "draft";
      draft.textContent = row.draft;
      var why = document.createElement("p");
      why.className = "why";
      why.textContent = row.why;
      art.appendChild(top);
      art.appendChild(draft);
      art.appendChild(why);
      frag.appendChild(art);
    });
    list.replaceChildren(frag);
  }

  function render() {
    var judge = JUDGES[state.judge];
    document.getElementById("judge-blurb").textContent = judge.blurb;
    document.querySelectorAll("[data-judge]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-judge") === state.judge ? "true" : "false");
    });
    document.getElementById("threshold-label").textContent = state.threshold.toFixed(2);
    document.getElementById("cost-label").textContent = state.costN + "×";
    thresholdInput.value = state.threshold.toFixed(2);
    costInput.value = String(state.costN);
    thresholdInput.setAttribute("aria-valuetext", state.threshold.toFixed(2));
    costInput.setAttribute("aria-valuetext", state.costN + " times");

    var metrics = M.evaluate(rows, state.judge, state.threshold);
    var best = M.bestThreshold(rows, state.judge, state.costN);
    var atDefault = M.evaluate(rows, state.judge, 0.5);
    var cost = M.costOf(metrics, state.costN);
    var sent = metrics.tp + metrics.fp;
    var held = metrics.fn + metrics.tn;

    document.getElementById("m-precision").textContent = pct(metrics.precision);
    document.getElementById("m-precision-hint").textContent = metrics.precision == null
      ? "Nothing is sent, so precision is undefined"
      : metrics.tp + " of " + sent + " sent are good";
    document.getElementById("m-recall").textContent = pct(metrics.recall);
    document.getElementById("m-recall-hint").textContent = metrics.tp + " of " + goodCount + " good drafts are sent";
    document.getElementById("m-f1").textContent = f1text(metrics.f1);
    document.getElementById("m-fp").textContent = String(metrics.fp);
    document.getElementById("m-fn").textContent = String(metrics.fn);
    document.getElementById("m-cost").textContent = String(cost);
    document.getElementById("m-cost-hint").textContent = metrics.fp + "×" + state.costN + " + " + metrics.fn;

    document.getElementById("n-tp").textContent = String(metrics.tp);
    document.getElementById("n-fp").textContent = String(metrics.fp);
    document.getElementById("n-fn").textContent = String(metrics.fn);
    document.getElementById("n-tn").textContent = String(metrics.tn);
    document.getElementById("fp-weight").textContent = "False pass · ×" + state.costN;
    ["tp", "fp", "fn", "tn"].forEach(function (key) {
      document.getElementById("cell-" + key).setAttribute("aria-pressed", state.filter === key ? "true" : "false");
    });
    document.querySelectorAll(".filters button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-filter") === state.filter ? "true" : "false");
    });

    document.getElementById("d-fp").textContent = String(atDefault.fp);
    document.getElementById("d-fn").textContent = String(atDefault.fn);
    document.getElementById("d-cost").textContent = String(M.costOf(atDefault, state.costN));
    document.getElementById("current-name").textContent = "This cutoff " + state.threshold.toFixed(2);
    document.getElementById("c-fp").textContent = String(metrics.fp);
    document.getElementById("c-fn").textContent = String(metrics.fn);
    document.getElementById("c-cost").textContent = String(cost);
    document.getElementById("best-name").textContent = "Cheapest " + best.t.toFixed(2);
    document.getElementById("b-fp").textContent = String(best.fp);
    document.getElementById("b-fn").textContent = String(best.fn);
    document.getElementById("b-cost").textContent = String(best.cost);
    document.getElementById("row-default").className = sameT(state.threshold, 0.5) ? "mark" : "";
    document.getElementById("row-current").className = "mark";
    document.getElementById("row-best").className = sameT(best.t, state.threshold) ? "mark" : "";

    var sentence = "Cutoff " + state.threshold.toFixed(2) + " on the " + judge.name.toLowerCase() + " judge sends " + sent + " of " + rows.length + " drafts and holds " + held + ". ";
    sentence += metrics.fp + " bad " + (metrics.fp === 1 ? "draft reaches" : "drafts reach") + " a customer, and " + metrics.fn + " good " + (metrics.fn === 1 ? "draft is" : "drafts are") + " held for a person. ";
    sentence += "At " + state.costN + "×, this cutoff costs " + cost + ". The cheapest cutoff on this set is " + best.t.toFixed(2) + ", at cost " + best.cost + ".";
    if (sameT(state.threshold, 0.5) && !sameT(best.t, 0.5)) {
      sentence += " 0.50 is the usual default, and it is not the cheapest cutoff here.";
    } else if (sameT(state.threshold, best.t)) {
      sentence += " This is the cheapest cutoff at this cost ratio.";
    }
    readout.textContent = sentence;

    var bins = M.histogram(rows, state.judge, 10);
    var curve = M.curve(rows, state.judge);
    var rel = M.reliability(rows, state.judge, 8);
    drawHistogram(bins, state.threshold);
    drawPR(curve, goodCount / rows.length, state.threshold, best.t);
    drawCost(curve, state.costN, state.threshold, best.t);
    drawCal(rel);
    document.getElementById("cal-note").textContent = calibrationSentence(rel);
    document.getElementById("brier").textContent = "Brier score " + M.brier(rows, state.judge).toFixed(3) + " on these " + rows.length + " drafts (lower fits the labels better). Computed on this synthetic set, not taken from the essay.";
    renderList();
  }

  document.querySelectorAll("[data-judge]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.judge = btn.getAttribute("data-judge");
      render();
    });
  });
  thresholdInput.addEventListener("input", function () {
    state.threshold = Math.round(Number(thresholdInput.value) * 100) / 100;
    render();
  });
  costInput.addEventListener("input", function () {
    state.costN = Number(costInput.value);
    render();
  });
  document.getElementById("use-default").addEventListener("click", function () {
    state.threshold = 0.5;
    render();
  });
  document.getElementById("use-best").addEventListener("click", function () {
    state.threshold = M.bestThreshold(rows, state.judge, state.costN).t;
    render();
  });
  document.querySelectorAll("[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.filter = btn.getAttribute("data-filter");
      render();
      if (btn.classList.contains("cell")) {
        document.getElementById("list").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  });

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 120);
  });

  render();
})();
