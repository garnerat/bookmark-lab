(function () {
  "use strict";

  var model = globalThis.ExpertTierLab;
  if (!model) return;

  var state = null;
  var timer = null;
  var TICK_MS = 680;
  var ns = "http://www.w3.org/2000/svg";
  var live = document.getElementById("live");
  var lastLive = "";

  function $(id) { return document.getElementById(id); }

  function selected(attr, fallback) {
    var node = document.querySelector("[" + attr + "][aria-pressed='true']");
    return node ? node.getAttribute(attr) : fallback;
  }

  function setPressed(attr, value) {
    document.querySelectorAll("[" + attr + "]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute(attr) === value ? "true" : "false");
    });
  }

  function readConfig() {
    return {
      vramSlots: Number($("vram").value),
      ramSlots: Number($("ram").value),
      ssd: selected("data-ssd", "pcie4"),
      skew: Number($("skew").value) / 100,
      policy: selected("data-policy", "lfu"),
      prefetch: $("prefetch").getAttribute("aria-pressed") === "true",
      mispredict: Number($("miss").value) / 100,
      scenario: selected("data-scenario", "note")
    };
  }

  function announce(text) {
    if (!live || text === lastLive) return;
    lastLive = text;
    live.textContent = text;
  }

  function ensure(container, n) {
    var cell;
    while (container.children.length > n) container.removeChild(container.lastChild);
    while (container.children.length < n) {
      cell = document.createElement("span");
      cell.className = "cell";
      cell.setAttribute("aria-hidden", "true");
      container.appendChild(cell);
    }
  }

  function paintSlots(container, slots, hitIds) {
    var hit = {};
    var i;
    var entry;
    var cell;
    for (i = 0; i < hitIds.length; i++) hit[hitIds[i]] = true;
    ensure(container, slots.length);
    for (i = 0; i < slots.length; i++) {
      entry = slots[i];
      cell = container.children[i];
      if (!entry) {
        cell.className = "cell empty";
        cell.textContent = "";
      } else if (hit[entry.id]) {
        cell.className = "cell hit";
        cell.textContent = String(entry.id);
      } else {
        cell.className = "cell resident";
        cell.textContent = String(entry.id);
      }
    }
  }

  function paintCatalog(container, stats) {
    var read = {};
    var waste = {};
    var i;
    var cell;
    ensure(container, model.EXPERTS);
    for (i = 0; i < stats.wastedIds.length; i++) waste[stats.wastedIds[i]] = true;
    for (i = 0; i < stats.prefetchIds.length; i++) {
      if (!waste[stats.prefetchIds[i]]) read[stats.prefetchIds[i]] = true;
    }
    for (i = 0; i < stats.ssdMissIds.length; i++) read[stats.ssdMissIds[i]] = true;
    for (i = 0; i < model.EXPERTS; i++) {
      cell = container.children[i];
      if (waste[i]) cell.className = "cell waste";
      else if (read[i]) cell.className = "cell read";
      else cell.className = "cell cold";
    }
  }

  function renderTape(stats) {
    var tape = $("tape");
    var i;
    var el;
    while (tape.firstChild) tape.removeChild(tape.firstChild);
    for (i = 0; i < stats.words.length; i++) {
      el = document.createElement(i === stats.wordIndex ? "mark" : "span");
      el.textContent = stats.words[i];
      tape.appendChild(el);
      if (i < stats.words.length - 1) tape.appendChild(document.createTextNode(" "));
    }
  }

  function drawChart(history) {
    var svg = $("chart");
    var ceiling = model.ceilingTok;
    var max = ceiling;
    var w = 300;
    var h = 120;
    var pad = 8;
    var i;
    var pts = [];
    var line;
    var top;
    var label;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (i = 0; i < history.length; i++) {
      if (history[i].tokPerSec > max) max = history[i].tokPerSec;
    }
    function px(i) {
      if (history.length < 2) return pad;
      return pad + ((w - pad * 2) * i) / (history.length - 1);
    }
    function py(v) {
      return h - pad - ((h - pad * 2) * v) / max;
    }
    top = document.createElementNS(ns, "line");
    top.setAttribute("x1", String(pad));
    top.setAttribute("x2", String(w - pad));
    top.setAttribute("y1", py(ceiling).toFixed(2));
    top.setAttribute("y2", py(ceiling).toFixed(2));
    top.setAttribute("stroke", "#c4b6a4");
    top.setAttribute("stroke-dasharray", "3 4");
    top.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(top);
    for (i = 0; i < history.length; i++) {
      pts.push(px(i).toFixed(2) + "," + py(history[i].tokPerSec).toFixed(2));
    }
    if (history.length === 1) {
      pts.push((w - pad).toFixed(2) + "," + py(history[0].tokPerSec).toFixed(2));
    }
    var area = document.createElementNS(ns, "polygon");
    var areaPts = pts.slice();
    areaPts.push((w - pad).toFixed(2) + "," + (h - pad).toFixed(2));
    areaPts.push(pad.toFixed(2) + "," + (h - pad).toFixed(2));
    area.setAttribute("points", areaPts.join(" "));
    area.setAttribute("fill", "rgba(138, 75, 42, 0.16)");
    area.setAttribute("stroke", "none");
    svg.appendChild(area);
    line = document.createElementNS(ns, "polyline");
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#8a4b2a");
    line.setAttribute("stroke-width", "2.5");
    line.setAttribute("stroke-linejoin", "round");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("vector-effect", "non-scaling-stroke");
    line.setAttribute("points", pts.join(" "));
    svg.appendChild(line);
    label = "Modeled tok/s for " + history.length + " token" + (history.length === 1 ? "" : "s") +
      ". Latest " + model.formatTok(history[history.length - 1].tokPerSec) +
      ". Dashed line is the made-up ceiling, about " + model.formatTok(ceiling) + ".";
    svg.setAttribute("aria-label", label);
    $("chart-ceil").textContent = "ceiling " + model.formatTok(ceiling);
  }

  function renderBanners(stats, config) {
    var host = $("banners");
    var lines = [];
    while (host.firstChild) host.removeChild(host.firstChild);
    if (stats.cliff) {
      lines.push({
        kind: "cliff",
        text: "VRAM has " + config.vramSlots + " slots and this token routes " + model.ACTIVE +
          " experts. The quoted post says VRAM has to fit at least the active experts. This sketch adds a made-up stall, so modeled tok/s falls."
      });
    }
    if (config.skew <= 0.15) {
      lines.push({
        kind: "spread",
        text: "Routing is near-uniform, so the " + (config.vramSlots + config.ramSlots) +
          " cache slots cover a thin slice of the " + model.EXPERTS +
          " experts. SSD bandwidth does most of the work."
      });
    }
    if (!config.prefetch) {
      lines.push({
        kind: "spread",
        text: "Prefetch is off. An expert on the SSD is read when the token asks for it."
      });
    } else if (stats.wastedReads > 0) {
      lines.push({
        kind: "waste",
        text: "Prefetch read " + stats.wastedReads + " expert" + (stats.wastedReads === 1 ? "" : "s") +
          " this token did not use (" + model.formatBytes(stats.wastedBytes) + "). Those bytes still come off the SSD."
      });
    }
    lines.forEach(function (line) {
      var box = document.createElement("div");
      var p = document.createElement("p");
      box.className = "banner " + line.kind;
      p.textContent = line.text;
      box.appendChild(p);
      host.appendChild(box);
    });
  }

  function render() {
    var stats = state.last;
    var totals = state.totals;
    var config = readConfig();
    var ssd = model.SSD[config.ssd];
    var avgBytes = totals.tokens ? totals.ssdBytes / totals.tokens : 0;
    $("vram-val").textContent = String(config.vramSlots);
    $("ram-val").textContent = String(config.ramSlots);
    $("skew-val").textContent = Math.round(config.skew * 100) + "%";
    $("miss-val").textContent = Math.round(config.mispredict * 100) + "%";
    $("prefetch").textContent = config.prefetch ? "Prefetch on" : "Prefetch off";
    $("job-label").textContent = config.scenario === "mixed"
      ? "Topic-hopping afternoon. Four fictional handouts, four expert bands."
      : "One visit note. Mara Ellison's knee draft stays on the office Mac mini.";
    renderTape(stats);
    $("story").textContent = "Token " + (stats.index + 1) + ", \u201c" + stats.word + ".\u201d " + model.describe(stats);
    $("vram-rate").textContent = model.formatPct(model.rate(totals.vramHits, totals.tokens));
    $("vram-now").textContent = "this token " + stats.vramHits + " of " + model.ACTIVE;
    $("ram-rate").textContent = model.formatPct(model.rate(totals.ramHits, totals.tokens));
    $("ram-now").textContent = "this token " + stats.ramHits + " of " + model.ACTIVE;
    $("ssd-rate").textContent = model.formatPct(model.rate(totals.ssdMisses, totals.tokens));
    $("ssd-now").textContent = "this token " + stats.ssdMisses + " of " + model.ACTIVE;
    $("ssd-bytes").textContent = model.formatBytes(stats.ssdBytes);
    $("ssd-bytes-avg").textContent = "average " + model.formatBytes(avgBytes) + " · " + ssd.label + " " + ssd.gbps + " GB/s";
    $("wasted").textContent = model.formatBytes(stats.wastedBytes);
    $("wasted-now").textContent = config.prefetch ? "this token" : "prefetch is off";
    $("toks").textContent = model.formatTok(stats.tokPerSec);
    $("toks-now").textContent = stats.cliff ? "cliff stall is on" : "made-up model, this token";
    $("vram-meta").textContent = stats.vramResidents.length + " of " + config.vramSlots + " filled · " + stats.vramHits + " hits";
    $("ram-meta").textContent = stats.ramResidents.length + " of " + config.ramSlots + " filled · " + stats.ramHits + " hits";
    $("ssd-meta").textContent = model.formatBytes(stats.ssdBytes) + " read · " + stats.wastedReads + " unused";
    paintSlots($("vram-grid"), state.vram, stats.vramHitIds);
    paintSlots($("ram-grid"), state.ram, stats.ramHitIds);
    paintCatalog($("ssd-grid"), stats);
    $("vram-grid").setAttribute("aria-label", "VRAM tier, " + stats.vramHits + " hits this token");
    $("ram-grid").setAttribute("aria-label", "RAM tier, " + stats.ramHits + " hits this token");
    $("ssd-grid").setAttribute("aria-label", "SSD catalog, " + model.formatBytes(stats.ssdBytes) + " read this token");
    drawChart(state.history);
    renderBanners(stats, config);
    announce(
      "Token " + (stats.index + 1) + ". " + model.describe(stats) +
      " " + model.formatTok(stats.tokPerSec) + " modeled tok/s. " +
      model.formatBytes(stats.ssdBytes) + " from SSD."
    );
  }

  function pause() {
    if (timer) clearInterval(timer);
    timer = null;
    $("play").setAttribute("aria-pressed", "false");
  }

  function play() {
    if (timer) return;
    timer = setInterval(function () {
      model.step(state);
      render();
    }, TICK_MS);
    $("play").setAttribute("aria-pressed", "true");
  }

  function revealMetrics() {
    var node = document.querySelector(".metrics");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!node || !node.scrollIntoView) return;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }

  function restart(steps) {
    var n = steps || 1;
    var i;
    state = model.create(readConfig());
    for (i = 0; i < n; i++) model.step(state);
    render();
  }

  function runBatch(steps) {
    pause();
    restart(steps);
    revealMetrics();
  }

  function onControl() {
    var was = !!timer;
    pause();
    restart(1);
    if (was) play();
  }

  document.querySelectorAll("[data-ssd], [data-policy], [data-scenario]").forEach(function (button) {
    button.addEventListener("click", function () {
      var attr = button.hasAttribute("data-ssd") ? "data-ssd" : button.hasAttribute("data-policy") ? "data-policy" : "data-scenario";
      setPressed(attr, button.getAttribute(attr));
      onControl();
    });
  });

  ["vram", "ram", "skew", "miss"].forEach(function (id) {
    $(id).addEventListener("input", onControl);
  });

  $("prefetch").addEventListener("click", function () {
    var on = $("prefetch").getAttribute("aria-pressed") === "true";
    $("prefetch").setAttribute("aria-pressed", on ? "false" : "true");
    onControl();
  });

  $("play").addEventListener("click", function () {
    if (timer) pause();
    else play();
  });
  $("pause").addEventListener("click", pause);
  $("step").addEventListener("click", function () {
    pause();
    model.step(state);
    render();
  });
  $("reset").addEventListener("click", function () {
    pause();
    restart(1);
  });
  $("warm").addEventListener("click", function () {
    runBatch(28);
  });

  $("show-warm").addEventListener("click", function () {
    $("vram").value = "24";
    $("ram").value = "48";
    $("skew").value = "100";
    $("miss").value = "0";
    setPressed("data-ssd", "pcie4");
    setPressed("data-policy", "lfu");
    setPressed("data-scenario", "note");
    $("prefetch").setAttribute("aria-pressed", "true");
    runBatch(28);
  });
  $("show-uniform").addEventListener("click", function () {
    $("skew").value = "0";
    $("vram").value = "24";
    $("ram").value = "48";
    setPressed("data-scenario", "mixed");
    setPressed("data-ssd", "pcie4");
    $("prefetch").setAttribute("aria-pressed", "false");
    runBatch(28);
  });
  $("show-cliff").addEventListener("click", function () {
    $("vram").value = "8";
    $("ram").value = "48";
    $("skew").value = "100";
    setPressed("data-scenario", "note");
    $("prefetch").setAttribute("aria-pressed", "false");
    runBatch(28);
  });
  $("show-waste").addEventListener("click", function () {
    $("vram").value = "24";
    $("ram").value = "48";
    $("skew").value = "100";
    $("miss").value = "100";
    setPressed("data-scenario", "note");
    setPressed("data-ssd", "pcie4");
    $("prefetch").setAttribute("aria-pressed", "true");
    runBatch(28);
  });

  restart(1);
  if (!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    play();
  }
})();
