(function () {
  const model = globalThis.HoldoutLab;
  if (!model) return;

  const SHORT = {
    job: "Job",
    price: "Price",
    urgency: "Urgency",
    diagnosis: "No part",
    polite: "Thanks",
    next: "Next step",
    dollar: "Has $",
  };

  const state = {
    epoch: 0,
    split: true,
    leak: false,
    checks: model.presetChecks("written"),
    preset: "written",
    labels: {},
    group: "week",
    locked: null,
  };
  model.CHECKS.forEach((check) => {
    state.labels[check.id] = check.label;
  });

  const $ = (id) => document.getElementById(id);

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = String(value);
      else node.setAttribute(key, String(value));
    });
    (children || []).forEach((child) => {
      if (child == null) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function pct(value) {
    if (value == null || Number.isNaN(value)) return "—";
    return Math.round(value * 100) + "%";
  }

  function signature(checks) {
    return checks.slice().sort().join(",");
  }

  function options() {
    return { split: state.split, leak: state.leak, checks: state.checks };
  }

  function syncPreset() {
    const names = Object.keys(model.PRESETS);
    const match = names.find((name) => signature(model.presetChecks(name)) === signature(state.checks));
    state.preset = match || "custom";
  }

  function fitWords(text) {
    text.style.height = "auto";
    text.style.height = text.scrollHeight + "px";
  }

  function syncRubricInputs() {
    model.CHECKS.forEach((check) => {
      const box = $("check-" + check.id);
      const text = $("words-" + check.id);
      if (box) box.checked = state.checks.indexOf(check.id) !== -1;
      if (text) {
        text.value = state.labels[check.id];
        fitWords(text);
      }
    });
  }

  function buildRubric() {
    const root = $("rubric");
    root.replaceChildren();
    model.CHECKS.forEach((check) => {
      const box = el("input", {
        type: "checkbox",
        id: "check-" + check.id,
        "aria-label": "Grade this line: " + check.label,
      });
      box.checked = state.checks.indexOf(check.id) !== -1;
      box.addEventListener("change", () => {
        if (box.checked) state.checks.push(check.id);
        else state.checks = state.checks.filter((id) => id !== check.id);
        state.checks = model.normalizeChecks(state.checks);
        syncPreset();
        render();
      });
      const text = el("textarea", {
        id: "words-" + check.id,
        rows: "2",
        "aria-label": "Wording for " + SHORT[check.id],
      });
      text.value = state.labels[check.id];
      text.addEventListener("input", () => {
        state.labels[check.id] = text.value;
        fitWords(text);
      });
      root.append(el("div", { class: "check" }, [box, text]));
    });
  }

  function setEpoch(next) {
    const step = Math.max(0, Math.min(model.EPOCH_MAX, next));
    if (state.epoch === 0 && step > 0 && !state.locked) state.locked = signature(state.checks);
    if (step === 0) state.locked = null;
    state.epoch = step;
  }

  function rowsFor(group) {
    if (group === "tune") return model.CASES.filter((row) => row.group === "pool" && !row.holdout);
    if (group === "holdout") return model.CASES.filter((row) => row.holdout);
    return model.CASES.filter((row) => row.group === "week");
  }

  function placeLabel(row, summary) {
    if (row.group === "week") return "Next week · never tuned";
    if (row.holdout && summary.split && !summary.leak) return "Hold-out · sealed";
    if (row.holdout) return "Hold-out · copied into tuning";
    return "Tune set";
  }

  function pickFeatured(rows, fit) {
    let best = rows[0];
    let bestDrop = -Infinity;
    rows.forEach((row) => {
      const now = model.gradeCase(row, state.epoch, fit, state.checks);
      const base = model.gradeCase(row, 0, fit, state.checks);
      const drop = (base.score == null ? 0 : base.score) - (now.score == null ? 0 : now.score);
      const smellTie = Math.abs(drop - bestDrop) < 1e-9 && row.job === "smell" && best.job !== "smell";
      if (drop > bestDrop + 1e-9 || smellTie) {
        best = row;
        bestDrop = drop;
      }
    });
    return best;
  }

  function renderFolders(summary) {
    const sealed = summary.split && !summary.leak;
    const tuneBody = summary.fit.length + " messages the assistant may study.";
    const holdBody = sealed
      ? "6 messages sealed. They are scored and never studied."
      : "6 messages are in the tune folder too. This score is not a test.";
    const folders = [
      ["tune/", tuneBody, "folder on"],
      ["holdout/HOLDOUT.md", holdBody, sealed ? "folder" : "folder warn"],
      ["next-week/", "8 messages from the following week. This folder never enters tuning.", "folder"],
    ];
    $("folders").replaceChildren(
      ...folders.map(([title, body, cls]) =>
        el("div", { class: cls }, [el("strong", { text: title }), el("p", { text: body })])
      )
    );
    if (!summary.split) {
      $("hold-file").textContent =
        "holdout/HOLDOUT.md\nThis file was never written.\nEvery lab message was tuned and graded together.";
    } else if (summary.leak) {
      $("hold-file").textContent =
        "holdout/HOLDOUT.md\nMoved into tune/ by the leak switch.\nThe hold-out score is now a tune-set score.\nnext-week/ was not moved.";
    } else {
      $("hold-file").textContent =
        "holdout/HOLDOUT.md\nThese six messages were split off before tuning.\nDo not grade the assistant on them and also teach it with them.";
    }
  }

  function renderScores(summary, base) {
    const contaminated = !summary.split || summary.leak;
    const cards = [
      ["Tuned on", summary.train, base.train, false],
      ["Hold-out", summary.holdout, base.holdout, contaminated],
      ["Next week", summary.week, base.week, false],
    ];
    $("scores").replaceChildren(
      ...cards.map(([name, value, baseValue, suspect]) => {
        const down = value != null && baseValue != null && value + 1e-9 < baseValue;
        const note = suspect ? "also tuned · base " + pct(baseValue) : "base " + pct(baseValue);
        return el("div", { class: "score" + (down ? " down" : "") + (suspect ? " suspect" : "") }, [
          el("span", { class: "name", text: name }),
          el("strong", { text: pct(value) }),
          el("span", { class: "base", text: note }),
        ]);
      })
    );
  }

  function svgEl(name, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function drawChart(points, summary) {
    const svg = $("chart");
    svg.replaceChildren();
    const width = 360;
    const height = 210;
    const pad = { l: 36, r: 12, t: 16, b: 28 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const x = (epoch) => pad.l + (epoch / model.EPOCH_MAX) * innerW;
    const y = (score) => pad.t + (1 - score) * innerH;
    [0, 0.5, 1].forEach((tick) => {
      svg.append(
        svgEl("line", {
          x1: pad.l,
          x2: width - pad.r,
          y1: y(tick),
          y2: y(tick),
          stroke: "#e3d9c8",
          "stroke-width": 1,
        })
      );
      const label = svgEl("text", {
        x: 4,
        y: y(tick) + 4,
        fill: "#5c564c",
        "font-size": 11,
      });
      label.textContent = Math.round(tick * 100) + "";
      svg.append(label);
    });
    [0, 4, 8].forEach((epoch) => {
      const label = svgEl("text", {
        x: x(epoch),
        y: height - 8,
        fill: "#5c564c",
        "font-size": 11,
        "text-anchor": epoch === 0 ? "start" : epoch === 8 ? "end" : "middle",
      });
      label.textContent = String(epoch);
      svg.append(label);
    });
    const contaminated = !summary.split || summary.leak;
    const series = [
      ["train", "#1f4f48", ""],
      ["holdout", "#8a4b12", contaminated ? "5 4" : ""],
      ["week", "#245f86", "2 4"],
    ];
    const missing = points.some((row) => row.train == null);
    if (missing) {
      const note = svgEl("text", { x: pad.l, y: 100, fill: "#5c564c", "font-size": 14 });
      note.textContent = "Turn on a check to draw the curves.";
      svg.append(note);
      return;
    }
    svg.append(
      svgEl("line", {
        x1: x(summary.epoch),
        x2: x(summary.epoch),
        y1: pad.t,
        y2: pad.t + innerH,
        stroke: "#1c1916",
        "stroke-width": 1,
        "stroke-dasharray": "2 3",
      })
    );
    series.forEach(([key, color, dash]) => {
      const coords = points
        .map((row) => x(row.epoch).toFixed(1) + "," + y(row[key]).toFixed(1))
        .join(" ");
      const line = {
        points: coords,
        fill: "none",
        stroke: color,
        "stroke-width": 2.5,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      };
      if (dash) line["stroke-dasharray"] = dash;
      svg.append(svgEl("polyline", line));
      svg.append(
        svgEl("circle", {
          cx: x(summary.epoch),
          cy: y(summary[key]),
          r: 4.5,
          fill: color,
        })
      );
    });
  }

  function renderTable(points) {
    const body = $("epoch-table").querySelector("tbody");
    body.replaceChildren(
      ...points.map((row) => {
        const tr = el("tr", row.epoch === state.epoch ? { class: "is-now" } : {}, [
          el("th", { text: String(row.epoch), scope: "row" }),
          el("td", { text: pct(row.train) }),
          el("td", { text: pct(row.holdout) }),
          el("td", { text: pct(row.week) }),
        ]);
        return tr;
      })
    );
  }

  function chipList(grade) {
    return el(
      "div",
      { class: "chips" },
      grade.results.map((result) =>
        el("span", {
          class: "chip" + (result.pass ? " pass" : ""),
          text: SHORT[result.id] + (result.pass ? " pass" : " miss"),
        })
      )
    );
  }

  function renderCases(summary, fit) {
    const rows = rowsFor(state.group);
    const featured = pickFeatured(rows, fit);
    const grade = model.gradeCase(featured, state.epoch, fit, state.checks);
    const base = model.gradeCase(featured, 0, fit, state.checks);
    const featuredNode = el("article", { class: "card" }, [
      el("header", {}, [
        el("span", { class: "tag", text: placeLabel(featured, summary) }),
        el("span", { class: "stage", text: model.stageLabel(grade.stage) }),
      ]),
      el("p", { class: "msg", text: featured.message }),
      el("p", { class: "reply", text: grade.reply }),
      grade.stage === "base"
        ? null
        : el("p", { class: "caption", text: "Base assistant: " + base.reply }),
      state.checks.length ? chipList(grade) : el("p", { class: "caption", text: "No checks are on." }),
    ]);
    $("featured").replaceChildren(featuredNode);

    const rest = rows.filter((row) => row.id !== featured.id);
    const cards = rest.map((row) => {
        const item = model.gradeCase(row, state.epoch, fit, state.checks);
        return el("article", { class: "card" }, [
          el("header", {}, [
            el("span", { class: "tag", text: placeLabel(row, summary) }),
            el("span", { class: "stage", text: model.stageLabel(item.stage) }),
          ]),
          el("p", { class: "msg", text: row.message }),
          el("p", { class: "reply", text: item.reply }),
          state.checks.length ? chipList(item) : null,
        ]);
    });
    $("cases").replaceChildren(
      cards.length
        ? el("details", { class: "more" }, [
            el("summary", { text: "Other messages in this folder (" + cards.length + ")" }),
            ...cards,
          ])
        : null
    );
  }

  function render() {
    const points = model.curve(options());
    const summary = points[state.epoch];
    const base = points[0];
    const fit = new Set(summary.fit);
    const contaminated = !summary.split || summary.leak;

    $("split-on").setAttribute("aria-pressed", state.split ? "true" : "false");
    $("split-off").setAttribute("aria-pressed", state.split ? "false" : "true");
    $("leak").setAttribute("aria-pressed", state.leak ? "true" : "false");
    $("leak").disabled = !state.split;
    $("leak-detail").textContent = state.split
      ? "Copies the six sealed messages into the tune folder. Their score can look finished. Next week was never copied."
      : "Turn the sealed hold-out back on. There is no separate folder to leak.";

    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.preset === state.preset ? "true" : "false");
    });
    $("preset-detail").textContent = model.PRESETS[state.preset]
      ? model.PRESETS[state.preset].detail
      : "Custom mix of the lines below.";

    const changed = state.locked && state.epoch > 0 && state.locked !== signature(state.checks);
    $("lock-note").hidden = !changed;

    const slider = $("epoch");
    slider.value = String(state.epoch);
    slider.setAttribute("aria-valuenow", String(state.epoch));
    slider.setAttribute("aria-valuetext", summary.note);
    $("epoch-readout").textContent = "Epoch " + state.epoch;
    const loss = summary.loss;
    const nearZero = loss != null && loss <= 0.05 && summary.epoch > 0;
    $("sticky-loss").textContent = loss == null ? "Loss —" : "Loss " + loss.toFixed(2);
    $("sticky-loss").className = nearZero ? "warn" : "";
    $("sticky-hint").textContent = nearZero
      ? "Near zero. Be suspicious, not excited."
      : "Tune-set loss. Near zero means the studied messages were memorized.";
    $("epoch-note").textContent = summary.note;
    $("reading").textContent = model.reading(summary, base);
    $("legend-hold").textContent = contaminated ? "Hold-out (also tuned)" : "Hold-out";
    $("chart-caption").textContent = contaminated
      ? "The hold-out line is dashed because those messages were tuned on. Next week is the set that still tells the truth."
      : "The studied line climbs. A sealed hold-out rises while general rules help, then falls once the tune set is memorized.";
    $("chart-desc").textContent =
      "Epoch " +
      summary.epoch +
      ". Tuned on " +
      pct(summary.train) +
      ". Hold-out " +
      pct(summary.holdout) +
      ". Next week " +
      pct(summary.week) +
      ".";

    document.querySelectorAll("[data-group]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.group === state.group ? "true" : "false");
    });

    renderFolders(summary);
    renderScores(summary, base);
    drawChart(points, summary);
    renderTable(points);
    renderCases(summary, fit);

    $("live").textContent =
      "Epoch " +
      summary.epoch +
      ". Tuned on " +
      pct(summary.train) +
      ", hold-out " +
      pct(summary.holdout) +
      ", next week " +
      pct(summary.week) +
      ".";
  }

  $("epoch").addEventListener("input", () => {
    setEpoch(Number($("epoch").value));
    render();
  });
  $("split-on").addEventListener("click", () => {
    state.split = true;
    render();
  });
  $("split-off").addEventListener("click", () => {
    state.split = false;
    state.leak = false;
    render();
  });
  $("leak").addEventListener("click", () => {
    if (!state.split) return;
    state.leak = !state.leak;
    render();
  });
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      state.preset = button.dataset.preset;
      state.checks = model.presetChecks(state.preset);
      model.CHECKS.forEach((check) => {
        state.labels[check.id] = check.label;
      });
      syncRubricInputs();
      render();
    });
  });
  document.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => {
      state.group = button.dataset.group;
      render();
    });
  });

  buildRubric();
  syncRubricInputs();
  render();
})();
