(function () {
  const model = globalThis.EmeansRace;
  const COLORS = [
    "#1d4e89", "#0f6e56", "#8a4b12", "#8f3d2b", "#5b3a8c",
    "#1f6f8a", "#6d470c", "#9a3d62", "#3d6b2f", "#245f86",
    "#7a4e2d", "#2f5d62", "#6b3f69", "#3e5a8c", "#8a5a12", "#4d6748",
  ];

  const playButton = document.getElementById("play");
  const stepButton = document.getElementById("step");
  const resetButton = document.getElementById("reset");
  const reseedButton = document.getElementById("reseed");
  const kSlider = document.getElementById("k");
  const callsSlider = document.getElementById("calls");
  const epochSlider = document.getElementById("epochs");
  const seedInput = document.getElementById("seed");
  const emaButton = document.getElementById("mode-ema");
  const avgButton = document.getElementById("mode-avg");
  const cosineButton = document.getElementById("cosine");
  const reviveButton = document.getElementById("revive");
  const finalizeButton = document.getElementById("finalize");
  const cosineDetail = document.getElementById("cosine-detail");
  const kReadout = document.getElementById("k-readout");
  const callsReadout = document.getElementById("calls-readout");
  const epochsReadout = document.getElementById("epochs-readout");
  const lloydNow = document.getElementById("lloyd-now");
  const lloydEp = document.getElementById("lloyd-ep");
  const emaNow = document.getElementById("ema-now");
  const emaEp = document.getElementById("ema-ep");
  const lloyd25 = document.getElementById("lloyd-25");
  const crossEl = document.getElementById("cross");
  const crossNote = document.getElementById("cross-note");
  const statusEl = document.getElementById("status");
  const lloydTouch = document.getElementById("lloyd-touch");
  const emaTouch = document.getElementById("ema-touch");
  const lloydMap = document.getElementById("lloyd-map");
  const emaMap = document.getElementById("ema-map");
  const chart = document.getElementById("chart");
  const live = document.getElementById("live");

  let race = null;
  let calls = null;
  let callsKey = "";
  let built = "";
  let playing = false;
  let frameId = 0;
  let announcedKey = "";
  let labels = new Uint16Array(0);
  let rebuildTimer = 0;

  function formatInt(value) {
    return Math.round(value).toLocaleString("en-US");
  }

  function formatEpoch(value) {
    if (value == null || Number.isNaN(value)) return "not yet";
    const rounded = Math.round(value * 100) / 100;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
    return rounded.toFixed(2);
  }

  function formatMse(value) {
    return value.toFixed(5);
  }

  function readSeed() {
    const value = Number(seedInput.value);
    if (!Number.isInteger(value) || value < 1 || value > 99999) return model.DEFAULTS.seed;
    return value;
  }

  function pressed(button) {
    return button.getAttribute("aria-pressed") === "true";
  }

  function setPressed(button, on) {
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function options() {
    return {
      n: Number(callsSlider.value),
      k: Number(kSlider.value),
      epochs: Number(epochSlider.value),
      seed: readSeed(),
      ema: pressed(emaButton),
      cosine: pressed(cosineButton),
      revive: pressed(reviveButton),
      finalize: pressed(finalizeButton),
    };
  }

  function signature(opts) {
    return [opts.n, opts.k, opts.epochs, opts.seed, opts.ema, opts.cosine, opts.revive, opts.finalize].join(":");
  }

  function ensureCalls(n, seed) {
    const key = n + ":" + seed;
    if (!calls || callsKey !== key) {
      calls = model.makeCalls(n, seed);
      callsKey = key;
    }
    return calls;
  }

  function stop() {
    playing = false;
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  function rebuild(force) {
    const opts = options();
    const sig = signature(opts);
    if (!force && race && sig === built) return;
    stop();
    built = sig;
    announcedKey = "";
    race = model.createRace({
      n: opts.n,
      k: opts.k,
      epochs: opts.epochs,
      seed: opts.seed,
      ema: opts.ema,
      cosine: opts.cosine,
      revive: opts.revive,
      finalize: opts.finalize,
      points: ensureCalls(opts.n, opts.seed),
    });
    render();
    announce(true);
  }

  function finished() {
    return race.finishedE && race.epochsL >= race.epochs;
  }

  function currentAlpha() {
    if (!race.ema) return null;
    if (!race.cosine || race.batches === 0) return race.recipe.alpha0;
    return model.scheduledAlpha(race.recipe.alpha0, race.batches - 1, race.totalSteps);
  }

  function latest(series) {
    return series[series.length - 1].loss;
  }

  function statusText() {
    const law = race.recipe;
    const alpha = currentAlpha();
    const sentences = [];
    sentences.push(
      "Lloyd has used " + race.epochsL + " of " + race.epochs +
      " passes and read " + formatInt(race.totalTouchedL) + " calls."
    );
    sentences.push(
      "The e-means-style run has used " + formatEpoch(race.seen / race.n) + " of " + race.epochs +
      " passes and read " + formatInt(race.totalTouchedE) + " calls."
    );
    if (race.batches === 0) {
      sentences.push(
        "A Lloyd step reads all " + formatInt(race.n) + " calls. An e-means-style step reads " +
        formatInt(law.batchSize) + "."
      );
    } else {
      sentences.push(
        "A Lloyd step reads all " + formatInt(race.n) + " calls. The last e-means-style step read " +
        formatInt(race.lastTouchedE) + " (a full batch is " + formatInt(law.batchSize) + ")."
      );
    }
    if (race.ema) {
      sentences.push(
        "Quality-law batch " + law.batchSize + ". Step now " + alpha.toFixed(3) +
        (race.cosine
          ? ", cooling from " + law.alpha0.toFixed(3) + " toward " + law.alphaFloor.toFixed(3) + "."
          : ", held at the start step because cosine decay is off.")
      );
    } else {
      sentences.push(
        "Running average: old assignments stay in the sum. The batch is still " +
        law.batchSize + " calls. Cosine decay has no step to cool."
      );
    }
    sentences.push("Dead clusters revived: " + race.splits + ".");
    if (race.finalized && race.finalizeDelta != null) {
      sentences.push("The closing mean changed the error by " + race.finalizeDelta.toFixed(6) + ".");
    } else if (race.finalize) {
      sentences.push("The closing mean runs once, after the last pass.");
    } else {
      sentences.push("The closing mean is off.");
    }
    if (race.crossEpoch != null) {
      sentences.push(
        "The e-means-style error first went at or under Lloyd’s 25-pass error at pass " +
        formatEpoch(race.crossEpoch) + "."
      );
    } else if (finished()) {
      sentences.push("The e-means-style run finished still above Lloyd’s 25-pass error.");
    } else {
      sentences.push("The e-means-style run has not gone under Lloyd’s 25-pass error yet.");
    }
    return sentences.join(" ");
  }

  function announcement() {
    if (finished()) {
      if (race.crossEpoch == null) {
        return "Race finished. The e-means-style run stayed above Lloyd’s 25-pass error.";
      }
      return "Race finished. The e-means-style run went under Lloyd’s 25-pass error at pass " +
        formatEpoch(race.crossEpoch) + ".";
    }
    return "Lloyd pass " + race.epochsL + ". e-means-style pass " + formatEpoch(race.seen / race.n) +
      ". Lloyd’s last step read " + formatInt(race.lastTouchedL) + " calls. The last batch read " +
      formatInt(race.lastTouchedE) + ".";
  }

  function announce(force) {
    const key = race.epochsL + ":" + Math.floor(race.seen / race.n) + ":" + (finished() ? "done" : "run");
    if (!force && key === announcedKey) return;
    announcedKey = key;
    live.textContent = announcement();
  }

  function paintReadouts() {
    const k = kSlider.value;
    const n = Number(callsSlider.value);
    const epochs = epochSlider.value;
    kReadout.textContent = k + " zones";
    callsReadout.textContent = formatInt(n) + " calls";
    epochsReadout.textContent = epochs + " passes";
    kSlider.setAttribute("aria-valuenow", k);
    kSlider.setAttribute("aria-valuetext", k + " zones");
    callsSlider.setAttribute("aria-valuenow", String(n));
    callsSlider.setAttribute("aria-valuetext", formatInt(n) + " calls");
    epochSlider.setAttribute("aria-valuenow", epochs);
    epochSlider.setAttribute("aria-valuetext", epochs + " passes");
  }

  function render() {
    paintReadouts();
    const lossL = latest(race.lossLloyd);
    const lossE = latest(race.lossE);
    lloydNow.textContent = formatMse(lossL);
    emaNow.textContent = formatMse(lossE);
    lloydEp.textContent = "pass " + race.epochsL + " of " + race.epochs;
    emaEp.textContent = "pass " + formatEpoch(race.seen / race.n) + " of " + race.epochs;
    lloyd25.textContent = formatMse(race.lloyd25);
    if (race.crossEpoch == null) {
      crossEl.textContent = "not yet";
      crossNote.textContent = finished() ? "stayed above" : "still above the line";
    } else {
      crossEl.textContent = "pass " + formatEpoch(race.crossEpoch);
      crossNote.textContent = "e-means-style";
    }
    lloydTouch.textContent = race.epochsL === 0 ? "reads all " + formatInt(race.n) : "last step " + formatInt(race.lastTouchedL);
    emaTouch.textContent = race.batches === 0 ? "batch " + formatInt(race.recipe.batchSize) : "last step " + formatInt(race.lastTouchedE);
    statusEl.textContent = statusText();
    cosineDetail.textContent = race.ema
      ? "On: the step cools from its start down to a tenth of that start. Off: the step stays put."
      : "A running average has no step to cool. Turn EMA back on to use the cosine schedule. The choice here is kept.";
    playButton.textContent = playing ? "Pause" : (finished() ? "Play again" : "Play");
    setPressed(playButton, playing);
    drawMap(lloydMap, race.lloydX, race.lloydY, "Lloyd map, pass " + race.epochsL + ", error " + formatMse(lossL));
    drawMap(emaMap, race.emaX, race.emaY, "e-means-style map, pass " + formatEpoch(race.seen / race.n) + ", error " + formatMse(lossE));
    drawChart();
  }

  function drawMap(canvas, cx, cy, label) {
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 280;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, width, height);
    const pad = 14;
    const innerW = Math.max(1, width - pad * 2);
    const innerH = Math.max(1, height - pad * 2);
    const n = race.n;
    const k = cx.length;
    if (labels.length !== n) labels = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      const px = race.x[i];
      const py = race.y[i];
      let best = Infinity;
      let bj = 0;
      for (let j = 0; j < k; j++) {
        const dx = px - cx[j];
        const dy = py - cy[j];
        const dist = dx * dx + dy * dy;
        if (dist < best) {
          best = dist;
          bj = j;
        }
      }
      labels[i] = bj;
    }
    ctx.globalAlpha = 0.55;
    for (let j = 0; j < k; j++) {
      ctx.beginPath();
      ctx.fillStyle = COLORS[j % COLORS.length];
      for (let i = 0; i < n; i++) {
        if (labels[i] !== j) continue;
        const x = pad + race.x[i] * innerW;
        const y = pad + (1 - race.y[i]) * innerH;
        ctx.rect(x - 1.15, y - 1.15, 2.3, 2.3);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const shop = model.ZONES[0];
    const sx = pad + shop.x * innerW;
    const sy = pad + (1 - shop.y) * innerH;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 7);
    ctx.lineTo(sx + 5.5, sy);
    ctx.lineTo(sx, sy + 7);
    ctx.lineTo(sx - 5.5, sy);
    ctx.closePath();
    ctx.fillStyle = "#1c1916";
    ctx.fill();
    for (let j = 0; j < k; j++) {
      const x = pad + cx[j] * innerW;
      const y = pad + (1 - cy[j]) * innerH;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#fffdf8";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS[j % COLORS.length];
      ctx.stroke();
    }
    canvas.setAttribute("aria-label", label);
  }

  function drawChart() {
    const width = chart.clientWidth || 320;
    const height = chart.clientHeight || 230;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    chart.width = Math.round(width * dpr);
    chart.height = Math.round(height * dpr);
    const ctx = chart.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const left = 54;
    const right = 10;
    const top = 12;
    const bottom = 26;
    const plotW = Math.max(1, width - left - right);
    const plotH = Math.max(1, height - top - bottom);
    let lo = race.lloyd25;
    let hi = race.lloyd25;
    function take(loss) {
      if (loss < lo) lo = loss;
      if (loss > hi) hi = loss;
    }
    for (let i = 0; i < race.lossLloyd.length; i++) take(race.lossLloyd[i].loss);
    for (let i = 0; i < race.lossE.length; i++) take(race.lossE[i].loss);
    const span = hi - lo || 1e-6;
    lo -= span * 0.1;
    hi += span * 0.12;
    function X(epoch) {
      return left + (epoch / race.epochs) * plotW;
    }
    function Y(loss) {
      return top + ((hi - loss) / (hi - lo)) * plotH;
    }
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5c564c";
    ctx.strokeStyle = "#e3d9c8";
    ctx.lineWidth = 1;
    for (let t = 0; t < 3; t++) {
      const loss = lo + ((hi - lo) * t) / 2;
      const y = Y(loss);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();
      ctx.fillText(loss.toFixed(4), left - 6, y);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const step = Math.max(1, Math.round(race.epochs / 4));
    for (let epoch = 0; epoch <= race.epochs; epoch += step) {
      ctx.fillText(String(epoch), X(epoch), top + plotH + 6);
    }
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#8a4b12";
    ctx.beginPath();
    const yRef = Y(race.lloyd25);
    ctx.moveTo(left, yRef);
    ctx.lineTo(width - right, yRef);
    ctx.stroke();
    ctx.restore();
    strokeSeries(ctx, race.lossLloyd, X, Y, "#1d4e89");
    strokeSeries(ctx, race.lossE, X, Y, "#0f6e56");
    if (race.crossEpoch != null) {
      let best = race.lossE[0];
      let bestGap = Infinity;
      for (let i = 0; i < race.lossE.length; i++) {
        const gap = Math.abs(race.lossE[i].epoch - race.crossEpoch);
        if (gap < bestGap) {
          bestGap = gap;
          best = race.lossE[i];
        }
      }
      ctx.beginPath();
      ctx.arc(X(best.epoch), Y(best.loss), 5, 0, Math.PI * 2);
      ctx.fillStyle = "#0f6e56";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fffdf8";
      ctx.stroke();
    }
  }

  function strokeSeries(ctx, series, X, Y, color) {
    if (!series.length) return;
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let i = 0; i < series.length; i++) {
      const x = X(series[i].epoch);
      const y = Y(series[i].loss);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function batchesThisFrame() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return Math.max(1, race.recipe.stepsPerEpoch - race.batchInEpoch);
    return race.n >= 16000 ? 2 : 4;
  }

  function frame() {
    if (!playing) return;
    const count = batchesThisFrame();
    for (let i = 0; i < count; i++) {
      if (finished()) break;
      race.stepTogether();
    }
    render();
    announce(false);
    if (finished()) {
      stop();
      render();
      announce(true);
      return;
    }
    frameId = requestAnimationFrame(frame);
  }

  function onPlay() {
    if (playing) {
      stop();
      render();
      announce(true);
      return;
    }
    if (finished()) rebuild(true);
    playing = true;
    render();
    frameId = requestAnimationFrame(frame);
  }

  function onStep() {
    stop();
    if (finished()) {
      render();
      announce(true);
      return;
    }
    race.stepTogether();
    render();
    announce(true);
  }

  function scheduleRebuild() {
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(function () {
      rebuild(false);
    }, 80);
  }

  playButton.addEventListener("click", onPlay);
  stepButton.addEventListener("click", onStep);
  resetButton.addEventListener("click", function () {
    rebuild(true);
    announce(true);
  });
  reseedButton.addEventListener("click", function () {
    const next = Math.min(99999, readSeed() + 1);
    seedInput.value = String(next);
    rebuild(true);
    announce(true);
  });
  kSlider.addEventListener("input", function () {
    paintReadouts();
    scheduleRebuild();
  });
  callsSlider.addEventListener("input", function () {
    paintReadouts();
    scheduleRebuild();
  });
  epochSlider.addEventListener("input", function () {
    paintReadouts();
    scheduleRebuild();
  });
  seedInput.addEventListener("change", function () {
    rebuild(true);
  });
  emaButton.addEventListener("click", function () {
    setPressed(emaButton, true);
    setPressed(avgButton, false);
    rebuild(true);
  });
  avgButton.addEventListener("click", function () {
    setPressed(emaButton, false);
    setPressed(avgButton, true);
    rebuild(true);
  });
  cosineButton.addEventListener("click", function () {
    setPressed(cosineButton, !pressed(cosineButton));
    rebuild(true);
  });
  reviveButton.addEventListener("click", function () {
    setPressed(reviveButton, !pressed(reviveButton));
    rebuild(true);
  });
  finalizeButton.addEventListener("click", function () {
    setPressed(finalizeButton, !pressed(finalizeButton));
    rebuild(true);
  });
  window.addEventListener("resize", function () {
    if (race) render();
  });

  rebuild(true);
})();
