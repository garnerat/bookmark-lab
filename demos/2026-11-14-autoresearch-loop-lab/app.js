(function () {
  const model = globalThis.AutoresearchLab;
  const $ = (id) => document.getElementById(id);

  const state = {
    mode: model.DEFAULTS.mode,
    minutes: model.DEFAULTS.minutes,
    hours: model.DEFAULTS.hours,
    speed: model.DEFAULTS.speed,
    showFresh: false,
    step: 0,
    playing: false,
  };
  let timer = 0;
  let result = model.simulate(state);

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function el(name, attrs, kids) {
    const node = document.createElement(name);
    Object.keys(attrs || {}).forEach((key) => {
      if (key === "text") node.textContent = attrs[key];
      else if (attrs[key] != null) node.setAttribute(key, String(attrs[key]));
    });
    (kids || []).forEach((kid) => node.append(kid));
    return node;
  }

  function num(value) {
    return Number(value).toFixed(1);
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function maxStep() {
    return result.rows.length - 1;
  }

  function clampHours(value) {
    return Math.min(
      model.RANGES.hours.max,
      Math.max(model.RANGES.hours.min, Number.isFinite(value) ? Math.round(value) : model.DEFAULTS.hours)
    );
  }

  function stop() {
    state.playing = false;
    window.clearTimeout(timer);
    timer = 0;
    const run = $("run");
    run.setAttribute("aria-pressed", "false");
    run.textContent = "Run";
  }

  function schedule() {
    window.clearTimeout(timer);
    const delay = model.SPEED_MS[state.speed];
    timer = window.setTimeout(tick, delay);
  }

  function tick() {
    if (!state.playing) return;
    if (state.step >= maxStep()) {
      stop();
      render();
      return;
    }
    state.step += 1;
    render();
    if (state.step >= maxStep()) stop();
    else schedule();
  }

  function resimulate() {
    stop();
    state.step = 0;
    result = model.simulate({
      mode: state.mode,
      minutes: state.minutes,
      hours: state.hours,
    });
    render();
  }

  function setMode(mode) {
    state.mode = mode;
    ["locked", "self", "leaky"].forEach((id) => {
      $("mode-" + id).setAttribute("aria-pressed", id === mode ? "true" : "false");
    });
    resimulate();
    $("live").textContent = modeLabel(mode) + ". The night is reset.";
  }

  function modeLabel(mode) {
    if (mode === "self") return "Agent grades itself";
    if (mode === "leaky") return "Leaky check";
    return "Locked hold-out";
  }

  function budgetText() {
    const budget = result.budget;
    const fit = budget.fit;
    const hourLine = 60 % budget.minutes === 0
      ? plural(budget.perHour, "experiment") + " fit in an hour."
      : "The minutes do not divide an hour evenly.";
    let tail = "This replay has " + plural(budget.scripted, "scripted tweak") + ", so the log plays " + budget.played + ".";
    if (budget.truncated) {
      tail = "Only " + plural(budget.played, "experiment") + " fit, so the night ends before the later tweaks. The full list has " + budget.scripted + ".";
    } else if (fit > budget.scripted) {
      tail = "This replay plays " + plural(budget.scripted, "scripted tweak") + ", then stops. A real loop would keep going for the rest of the " + plural(fit, "experiment") + ".";
    }
    return plural(budget.minutes, "minute") + " each, over " + plural(budget.hours, "hour") + ": " + plural(fit, "experiment") + " fit. " + hourLine + " " + tail;
  }

  function modeNote() {
    if (state.mode === "self") {
      return "This check scores the pile the agent can read. The list is the ideas that lift that pile, including memorizing chart numbers. Rain, a lower cutoff, and the empty chair are not in this list.";
    }
    if (state.mode === "leaky") {
      return "Same early ideas as the locked check. The last tweak reads a column that is only written after the visit. The hold-out still has that column. Next month does not.";
    }
    return "The check scores a pile the agent cannot edit. Real features can stick. A tie, a noisy forecast, a lower cutoff, a memorized list, and the empty-chair column do not.";
  }

  function renderScores(visible) {
    const last = visible[visible.length - 1];
    const start = result.rows[0];
    const freshText = state.showFresh ? num(last.bestFresh) : "Hidden";
    const freshClass = !state.showFresh
      ? ""
      : last.bestFresh + 0.05 < start.bestFresh
        ? " drop"
        : last.bestFresh > start.bestFresh
          ? " keep"
          : "";
    const kept = visible.filter((row) => row.call === "KEEP").length;
    const discarded = visible.filter((row) => row.call === "DISCARD").length;
    $("scores").replaceChildren(
      el("div", { class: "score keep" }, [
        el("span", { class: "name", text: "Best on the check" }),
        el("strong", { text: num(last.bestReported) }),
        el("span", { class: "base", text: "started at " + num(start.reported) }),
      ]),
      el("div", { class: "score" }, [
        el("span", { class: "name", text: "Kept / discarded" }),
        el("strong", { text: kept + " / " + discarded }),
        el("span", { class: "base", text: "not counting the start" }),
      ]),
      el("div", { class: "score" + freshClass }, [
        el("span", { class: "name", text: "Next month" }),
        el("strong", { text: freshText }),
        el("span", {
          class: "base",
          text: state.showFresh ? "started at " + num(start.bestFresh) : "turn on the toggle",
        }),
      ]),
      el("div", { class: "score" }, [
        el("span", { class: "name", text: "Experiments that fit" }),
        el("strong", { text: String(result.budget.fit) }),
        el("span", { class: "base", text: "playing " + result.budget.played }),
      ])
    );
  }

  function renderLog(visible) {
    const body = $("log").querySelector("tbody");
    body.replaceChildren(
      ...visible.map((row) => {
        const callClass = row.call === "KEEP" ? "keep" : row.call === "DISCARD" ? "discard" : "start";
        return el("tr", row.round === state.step ? { class: "is-now" } : {}, [
          el("th", { scope: "row", text: String(row.round) }),
          el("td", {}, [
            el("span", { class: "tweak-title", text: row.title }),
            el("span", { class: "tweak-detail", text: row.detail }),
          ]),
          el("td", { text: num(row.reported) }),
          el("td", {}, [el("span", { class: "call " + callClass, text: row.call })]),
        ]);
      })
    );
  }

  function svgEl(name, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs).forEach((key) => node.setAttribute(key, String(attrs[key])));
    return node;
  }

  function renderChart(visible) {
    const svg = $("chart");
    svg.replaceChildren();
    const width = 360;
    const height = 220;
    const pad = { l: 36, r: 12, t: 16, b: 28 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const lastRound = Math.max(1, maxStep());
    let peak = 10;
    result.rows.forEach((row) => {
      peak = Math.max(peak, row.bestReported);
      if (state.showFresh) peak = Math.max(peak, row.bestFresh);
    });
    const yMax = Math.max(10, Math.ceil(peak / 10) * 10);
    const x = (round) => pad.l + (round / lastRound) * innerW;
    const y = (score) => pad.t + (1 - score / yMax) * innerH;
    [0, yMax / 2, yMax].forEach((tick) => {
      svg.append(svgEl("line", {
        x1: pad.l,
        x2: width - pad.r,
        y1: y(tick),
        y2: y(tick),
        stroke: "#e3d9c8",
        "stroke-width": 1,
      }));
      const label = svgEl("text", { x: 2, y: y(tick) + 4, fill: "#5c564c", "font-size": 11 });
      label.textContent = String(Math.round(tick));
      svg.append(label);
    });
    const xTicks = lastRound <= 8
      ? Array.from({ length: lastRound + 1 }, (_, index) => index)
      : [0, Math.round(lastRound / 2), lastRound];
    xTicks.forEach((round) => {
      const anchor = round === 0 ? "start" : round === lastRound ? "end" : "middle";
      const label = svgEl("text", {
        x: x(round),
        y: height - 8,
        fill: "#5c564c",
        "font-size": 11,
        "text-anchor": anchor,
      });
      label.textContent = String(round);
      svg.append(label);
    });

    function line(key, color) {
      const coords = visible
        .map((row) => x(row.round).toFixed(1) + "," + y(row[key]).toFixed(1))
        .join(" ");
      svg.append(svgEl("polyline", {
        points: coords,
        fill: "none",
        stroke: color,
        "stroke-width": 2.5,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }));
      visible.forEach((row) => {
        const hollow = row.call === "DISCARD";
        svg.append(svgEl("circle", {
          cx: x(row.round).toFixed(1),
          cy: y(row[key]).toFixed(1),
          r: row.round === state.step ? 5.5 : 3.5,
          fill: hollow ? "#fffcf7" : color,
          stroke: color,
          "stroke-width": 2,
        }));
      });
    }

    line("bestReported", "#1f4f48");
    if (state.showFresh) line("bestFresh", "#8a4b12");
    $("legend-fresh").hidden = !state.showFresh;

    const bits = visible.map((row) => "round " + row.round + " best " + num(row.bestReported));
    let desc = "Best score on the check: " + bits.join(", ") + ".";
    if (state.showFresh) {
      desc += " Next month, the kept rule: " + visible.map((row) => num(row.bestFresh)).join(", ") + ".";
    } else {
      desc += " Next month is hidden.";
    }
    $("chart-desc").textContent = desc;
    const end = visible[visible.length - 1];
    $("chart-caption").textContent = state.showFresh
      ? "The green line is the best score the check has accepted. The brown line is that kept rule on next month. A hollow dot is a tweak the check discarded."
      : "Green is the best score the check has accepted. A hollow dot is a discard, so the line stays flat. Next month is hidden until you show it. The latest kept score is " + num(end.bestReported) + ".";
  }

  function renderStaticBits() {
    const ref = result.reference;
    $("rates").textContent =
      ref.editMisses.rate.toFixed(1) + "% in the pile the agent can read, " +
      ref.holdMisses.rate.toFixed(1) + "% in the locked hold-out, and " +
      ref.freshMisses.rate.toFixed(1) + "% next month.";
    $("samples").replaceChildren(
      ...result.samples.map((row) => {
        const when = row.monday ? "Monday" : "a weekday that is not Monday";
        const rain = row.rain ? "rain in the forecast" : "no rain in the forecast";
        const opened = row.reminderOpened ? "reminder opened" : "reminder not opened";
        const outcome = row.noShow ? "missed the visit" : "showed up";
        return el("li", {
          text:
            row.id + ", " + row.visit + ", booked " + row.leadDays + " days out, " +
            row.priorNoshows + " prior misses, " + opened + ", " + when + ", " + rain +
            ". In this fiction they " + outcome + ".",
        });
      })
    );
    if (!$("rules").childElementCount) {
      $("rules").replaceChildren(
        ...model.RULE_LINES.map((line) => el("li", { text: line }))
      );
    }
  }

  function render() {
    const visible = result.rows.slice(0, state.step + 1);
    const current = visible[visible.length - 1];
    $("minutes-readout").textContent = plural(state.minutes, "minute");
    $("minutes").setAttribute("aria-valuenow", String(state.minutes));
    $("minutes").setAttribute("aria-valuetext", plural(state.minutes, "minute") + " per experiment");
    $("hours-readout").textContent = plural(state.hours, "hour");
    $("budget-note").textContent = budgetText();
    $("mode-note").textContent = modeNote();
    $("play-note").textContent = reducedMotion()
      ? "Rows appear at the speed you pick. Nothing slides."
      : "Run plays the rounds that fit in the night. Step adds one. Reset goes back to the starting rule.";
    renderScores(visible);
    renderChart(visible);
    renderLog(visible);
    renderStaticBits();
    const freshBit = state.showFresh ? " Next month for the kept rule is " + num(current.bestFresh) + "." : "";
    $("status").textContent =
      "Round " + current.round + " of " + maxStep() + ". " + current.title + ". Score " + num(current.reported) + ". " + current.call + "." + freshBit;
  }

  $("mode-locked").addEventListener("click", () => setMode("locked"));
  $("mode-self").addEventListener("click", () => setMode("self"));
  $("mode-leaky").addEventListener("click", () => setMode("leaky"));

  $("minutes").addEventListener("input", () => {
    state.minutes = Number($("minutes").value);
    resimulate();
  });

  $("hours").addEventListener("input", () => {
    state.hours = clampHours(Number($("hours").value));
    resimulate();
  });
  $("hours").addEventListener("change", () => {
    $("hours").value = String(state.hours);
  });

  $("reveal").addEventListener("click", () => {
    state.showFresh = !state.showFresh;
    $("reveal").setAttribute("aria-pressed", state.showFresh ? "true" : "false");
    render();
  });

  $("run").addEventListener("click", () => {
    if (state.playing) {
      stop();
      render();
      return;
    }
    if (state.step >= maxStep()) state.step = 0;
    state.playing = true;
    $("run").setAttribute("aria-pressed", "true");
    $("run").textContent = "Pause";
    render();
    schedule();
  });

  $("step").addEventListener("click", () => {
    stop();
    if (state.step < maxStep()) state.step += 1;
    render();
  });

  $("reset").addEventListener("click", () => {
    state.step = 0;
    stop();
    render();
    $("live").textContent = "Reset to the starting rule.";
  });

  ["slow", "normal", "fast"].forEach((speed) => {
    $("speed-" + speed).addEventListener("click", () => {
      state.speed = speed;
      ["slow", "normal", "fast"].forEach((id) => {
        $("speed-" + id).setAttribute("aria-pressed", id === speed ? "true" : "false");
      });
      if (state.playing) schedule();
    });
  });

  render();
})();
