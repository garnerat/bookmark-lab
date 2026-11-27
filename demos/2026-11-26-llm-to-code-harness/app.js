(function () {
  "use strict";

  var model = globalThis.LlmToCodeLab;
  if (!model) return;

  var ns = "http://www.w3.org/2000/svg";
  var TICK_MS = 42;
  var trace = null;
  var cursor = 0;
  var playing = false;
  var timer = null;
  var live = document.getElementById("live");
  var lastLive = "";
  var pillsReady = false;
  var seenCode = {};
  var bannerAnnounced = false;

  function $(id) { return document.getElementById(id); }

  function announce(text) {
    if (!live || !text || text === lastLive) return;
    lastLive = text;
    live.textContent = text;
  }

  function syncLabels() {
    var count = Number($("count").value);
    var threshold = Number($("threshold").value);
    var every = Number($("every").value);
    var surpriseOn = $("surprise").getAttribute("aria-pressed") === "true";
    var spotOn = $("spot").getAttribute("aria-pressed") === "true";
    $("count-val").textContent = String(count);
    $("threshold-val").textContent = String(threshold);
    $("every-val").textContent = "1 in " + every;
    $("surprise").textContent = surpriseOn ? "Surprise on" : "Surprise off";
    $("spot").textContent = spotOn ? "Spot-check on" : "Spot-check off";
    $("every").setAttribute("aria-disabled", spotOn ? "false" : "true");
  }

  function readConfig() {
    return {
      count: Number($("count").value),
      threshold: Number($("threshold").value),
      surprise: $("surprise").getAttribute("aria-pressed") === "true",
      spotCheck: $("spot").getAttribute("aria-pressed") === "true",
      spotEvery: Number($("every").value)
    };
  }

  function applyConfig(config) {
    $("count").value = String(config.count);
    $("threshold").value = String(config.threshold);
    $("every").value = String(config.spotEvery);
    $("surprise").setAttribute("aria-pressed", config.surprise ? "true" : "false");
    $("spot").setAttribute("aria-pressed", config.spotCheck ? "true" : "false");
    syncLabels();
  }

  function ensurePills() {
    var holder = $("pills");
    var i;
    var pill;
    if (pillsReady) return;
    for (i = 0; i < model.STEPS.length; i++) {
      pill = document.createElement("span");
      pill.className = "pill llm";
      pill.textContent = "LLM";
      holder.appendChild(pill);
    }
    pillsReady = true;
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.lastChild);
  }

  function line(svg, x1, y1, x2, y2, stroke, width, dash) {
    var el = document.createElementNS(ns, "line");
    el.setAttribute("x1", String(x1));
    el.setAttribute("y1", String(y1));
    el.setAttribute("x2", String(x2));
    el.setAttribute("y2", String(y2));
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", String(width));
    if (dash) el.setAttribute("stroke-dasharray", dash);
    svg.appendChild(el);
  }

  function poly(svg, points, stroke, width, dash) {
    var el = document.createElementNS(ns, "polyline");
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", String(width));
    el.setAttribute("stroke-linejoin", "round");
    el.setAttribute("stroke-linecap", "round");
    if (dash) el.setAttribute("stroke-dasharray", dash);
    el.setAttribute("points", points.join(" "));
    svg.appendChild(el);
  }

  function drawCharts(rows, upto, surpriseAt) {
    var cost = $("cost-chart");
    var catchSvg = $("catch-chart");
    var last = rows[rows.length - 1];
    var max = last.baselineCents || 1;
    var n = rows.length;
    var w = 300;
    var h = 120;
    var pad = 8;
    var i;
    var row;
    var pts;
    var catchPts;
    var rate;
    clearNode(cost);
    clearNode(catchSvg);
    line(cost, pad, h - pad, w - pad, h - pad, "#e3d6c6", 1);
    line(catchSvg, pad, h - pad, w - pad, h - pad, "#e3d6c6", 1);
    line(catchSvg, pad, pad, w - pad, pad, "#e3d6c6", 1);
    function x(index) {
      if (n === 1) return pad;
      return pad + (index / (n - 1)) * (w - pad * 2);
    }
    function yCost(cents) {
      return h - pad - (cents / max) * (h - pad * 2);
    }
    function yRate(value) {
      return h - pad - value * (h - pad * 2);
    }
    pts = [];
    catchPts = [];
    for (i = 0; i < upto; i++) {
      row = rows[i];
      pts.push(x(i).toFixed(2) + "," + yCost(row.harnessCents).toFixed(2));
      if (row.catchTotal > 0) {
        rate = row.catchHits / row.catchTotal;
        catchPts.push(x(i).toFixed(2) + "," + yRate(rate).toFixed(2));
      }
    }
    if (upto > 0) {
      line(cost, x(0), yCost(0), x(upto - 1), yCost(rows[upto - 1].baselineCents), "#8a8175", 2, "5 4");
      poly(cost, pts, "#1c6b45", 2.5);
    }
    if (surpriseAt > 0) {
      line(cost, x(surpriseAt - 1), pad, x(surpriseAt - 1), h - pad, "#9c3418", 1.5);
      line(catchSvg, x(surpriseAt - 1), pad, x(surpriseAt - 1), h - pad, "#9c3418", 1.5);
    }
    if (catchPts.length) {
      rate = rows[upto - 1].catchTotal ? rows[upto - 1].catchHits / rows[upto - 1].catchTotal : 0;
      poly(catchSvg, catchPts, rate < 0.5 ? "#9f2d2d" : "#1c6b45", 2.5);
    }
  }

  function paintLog(rows, upto) {
    var list = $("log");
    var seenText = Object.create(null);
    var lastDemote = null;
    var misses = 0;
    var demotes = 0;
    var shown = [];
    var i;
    var e;
    var ev;
    var item;
    clearNode(list);
    for (i = 0; i < upto; i++) {
      for (e = 0; e < rows[i].events.length; e++) {
        ev = rows[i].events[e];
        if (ev.kind === "miss") {
          misses += 1;
          if (!seenText[ev.text]) {
            seenText[ev.text] = true;
            shown.push({ kind: "miss", text: ev.text, invoice: rows[i].i });
          }
        } else if (ev.kind === "demote") {
          demotes += 1;
          lastDemote = { kind: "demote", text: ev.text, invoice: rows[i].i };
        }
      }
    }
    if (!misses && !demotes) {
      $("log-count").textContent = "Nothing has gone wrong yet.";
      return;
    }
    $("log-count").textContent = misses + " replayed answers were wrong. " + demotes + " rules were demoted.";
    if (lastDemote) shown.push(lastDemote);
    for (i = 0; i < shown.length; i++) {
      item = document.createElement("li");
      item.className = shown[i].kind;
      item.textContent = "Invoice " + shown[i].invoice + ". " + shown[i].text;
      list.appendChild(item);
    }
  }

  function syncBanner(row) {
    var surpriseRow;
    var eventText;
    var e;
    if (!trace || !trace.surpriseAt || row.i < trace.surpriseAt) {
      $("banner").hidden = true;
      $("banner").textContent = "";
      return;
    }
    surpriseRow = trace.rows[trace.surpriseAt - 1];
    eventText = "";
    for (e = 0; e < surpriseRow.events.length; e++) {
      if (surpriseRow.events[e].kind === "surprise") eventText = surpriseRow.events[e].text;
    }
    if (!eventText) return;
    $("banner").hidden = false;
    $("banner").textContent = "Invoice " + surpriseRow.i + ". " + eventText;
    if (!bannerAnnounced) {
      bannerAnnounced = true;
      announce("Vendor surprise. " + eventText);
    }
  }

  function paint(row) {
    var i;
    var step;
    var pill;
    var board;
    var badge;
    var anyCheck = false;
    var avgHarness;
    var avgBase;
    var catchRate;
    ensurePills();
    $("progress").textContent = "Invoice " + row.i + " of " + trace.count;
    $("bar").style.width = (row.i / trace.count * 100) + "%";
    $("who").textContent = row.name + " · " + row.kitchen;
    $("blurb").textContent = row.blurb;
    for (i = 0; i < row.steps.length; i++) {
      step = row.steps[i];
      pill = $("pills").children[i];
      pill.className = "pill " + step.via + (step.correct ? "" : " bad");
      pill.textContent = step.via === "check" ? "CHECK" : (step.via === "code" ? "CODE" : "LLM");
      if (step.via === "check") anyCheck = true;
      board = row.board[step.id];
      badge = $("badge-" + step.id);
      badge.textContent = board.label;
      badge.className = "badge " + board.label.toLowerCase() + (board.stale ? " bad" : "") + (board.justGraduated ? " flash" : "");
      $("detail-" + step.id).textContent = board.justGraduated
        ? "Graduated on this invoice. The next matching invoice replays the saved answer. " + board.detail
        : board.detail;
      $("replay-" + step.id).textContent = board.replay ? "Replaying — " + board.replay : "";
      if (board.label === "CODE" && !seenCode[step.id]) {
        seenCode[step.id] = true;
        announce(model.stepById(step.id).title + " is now code for every regular vendor. Handwritten slips still call the model.");
      }
    }
    $("sample-note").textContent = anyCheck
      ? "This invoice was in the spot-check sample. Graduated steps were asked of the model again."
      : "";
    $("harness").textContent = model.formatUsd(row.harnessCents);
    $("harness-sub").textContent = model.formatUsd(model.LLM_CENTS) + " illustrative per model step";
    $("baseline").textContent = model.formatUsd(row.baselineCents);
    $("baseline-sub").textContent = "Same invoices, every step on the model";
    $("avoided").textContent = String(row.avoided);
    $("avoided-sub").textContent = "of " + row.totalSteps + " model steps";
    avgHarness = row.harnessMs / row.i;
    avgBase = row.baselineMs / row.i;
    $("latency").textContent = model.formatSeconds(avgHarness);
    $("latency-sub").textContent = "per invoice · all-model " + model.formatSeconds(avgBase);
    $("accuracy").textContent = model.formatPct(row.correctSteps / row.totalSteps);
    $("accuracy-sub").textContent = row.correctSteps + " of " + row.totalSteps + " step answers";
    $("metric-acc").className = "metric acc" + (row.correctSteps / row.totalSteps < 0.95 ? " is-bad" : "");
    if (!row.catchTotal) {
      $("catch").textContent = "No jumps yet";
      $("catch-sub").textContent = "Lines more than 8% above the last order";
      $("metric-catch").className = "metric catch";
    } else {
      catchRate = row.catchHits / row.catchTotal;
      $("catch").textContent = model.formatPct(catchRate);
      $("catch-sub").textContent = row.catchHits + " of " + row.catchTotal + " jumps flagged";
      $("metric-catch").className = "metric catch" + (catchRate < 0.5 ? " is-bad" : "");
    }
    drawCharts(trace.rows, row.i, trace.surpriseAt);
    paintLog(trace.rows, row.i);
    syncBanner(row);
  }

  function finish() {
    var row = trace.rows[trace.rows.length - 1];
    var catchText = row.catchTotal ? model.formatPct(row.catchHits / row.catchTotal) : "no jumps";
    playing = false;
    $("pause").textContent = "Pause";
    $("pause").setAttribute("aria-pressed", "false");
    announce("Finished " + trace.count + " invoices. Harness " + model.formatUsd(row.harnessCents) + ", all-model " + model.formatUsd(row.baselineCents) + ", catch rate " + catchText + ".");
  }

  function stop() {
    playing = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    $("pause").textContent = "Pause";
    $("pause").setAttribute("aria-pressed", "false");
  }

  function tick() {
    if (!playing || !trace) return;
    paint(trace.rows[cursor]);
    cursor += 1;
    if (cursor >= trace.rows.length) {
      finish();
      return;
    }
    timer = setTimeout(tick, TICK_MS);
  }

  function start(scroll) {
    var lab;
    stop();
    seenCode = {};
    bannerAnnounced = false;
    $("banner").hidden = true;
    $("banner").textContent = "";
    trace = model.run(readConfig());
    cursor = 0;
    playing = true;
    $("pause").textContent = "Pause";
    $("pause").setAttribute("aria-pressed", "true");
    announce("Running " + trace.count + " invoices.");
    if (scroll) {
      lab = $("lab");
      if (lab && lab.scrollIntoView) lab.scrollIntoView({ block: "start" });
    }
    tick();
  }

  function pauseOrResume() {
    if (!trace) return;
    if (playing) {
      playing = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      $("pause").textContent = "Resume";
      $("pause").setAttribute("aria-pressed", "false");
      return;
    }
    if (cursor >= trace.rows.length) return;
    playing = true;
    $("pause").textContent = "Pause";
    $("pause").setAttribute("aria-pressed", "true");
    tick();
  }

  function skip() {
    if (!trace) trace = model.run(readConfig());
    stop();
    cursor = trace.rows.length;
    paint(trace.rows[trace.rows.length - 1]);
    finish();
  }

  function reset() {
    stop();
    trace = null;
    cursor = 0;
    seenCode = {};
    bannerAnnounced = false;
    $("banner").hidden = true;
    $("banner").textContent = "";
    $("progress").textContent = "Press Run. The quiet month is the default.";
    $("bar").style.width = "0%";
    $("who").textContent = "";
    $("blurb").textContent = "";
    $("sample-note").textContent = "";
    clearNode($("pills"));
    pillsReady = false;
    clearNode($("log"));
    $("log-count").textContent = "Nothing has gone wrong yet.";
    clearNode($("cost-chart"));
    clearNode($("catch-chart"));
    ["vendor", "extract", "map", "price", "route"].forEach(function (id) {
      $("badge-" + id).textContent = "—";
      $("badge-" + id).className = "badge wait";
      $("detail-" + id).textContent = "";
      $("replay-" + id).textContent = "";
    });
    $("harness").textContent = "$0.00";
    $("baseline").textContent = "$0.00";
    $("avoided").textContent = "0";
    $("avoided-sub").textContent = "of 0 model steps";
    $("latency").textContent = "0.0 s";
    $("latency-sub").textContent = "all-model 0.0 s";
    $("accuracy").textContent = "—";
    $("accuracy-sub").textContent = "Answers matching the scripted invoice";
    $("catch").textContent = "No jumps yet";
    $("catch-sub").textContent = "Lines more than 8% above the last order";
    $("metric-acc").className = "metric acc";
    $("metric-catch").className = "metric catch";
  }

  $("count").addEventListener("input", syncLabels);
  $("threshold").addEventListener("input", syncLabels);
  $("every").addEventListener("input", syncLabels);
  $("surprise").addEventListener("click", function () {
    var on = $("surprise").getAttribute("aria-pressed") === "true";
    $("surprise").setAttribute("aria-pressed", on ? "false" : "true");
    syncLabels();
  });
  $("spot").addEventListener("click", function () {
    var on = $("spot").getAttribute("aria-pressed") === "true";
    $("spot").setAttribute("aria-pressed", on ? "false" : "true");
    syncLabels();
  });
  $("run").addEventListener("click", function () { start(false); });
  $("pause").addEventListener("click", pauseOrResume);
  $("skip").addEventListener("click", skip);
  $("reset").addEventListener("click", reset);
  $("try-quiet").addEventListener("click", function () {
    applyConfig(model.PRESETS.quiet);
    start(true);
  });
  $("try-stale").addEventListener("click", function () {
    applyConfig(model.PRESETS.stale);
    start(true);
  });
  $("try-spot").addEventListener("click", function () {
    applyConfig(model.PRESETS.spot);
    start(true);
  });

  syncLabels();
})();
