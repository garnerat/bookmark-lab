(function () {
  const model = globalThis.GrowthTimeline;
  if (!model) return;

  const SVG = "http://www.w3.org/2000/svg";
  const VIEW_W = 760;
  const PAD_L = 56;
  const PAD_R = 52;
  const PAD_T = 16;
  const PLOT_H = 270;

  const $ = (id) => document.getElementById(id);

  const state = {
    selected: model.COINCIDENCE_MONTH,
    scrolled: false,
  };

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = String(value);
      else node.setAttribute(key, String(value));
    });
    (children || []).forEach((child) => {
      if (child == null || child === false) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function svgEl(name, attrs) {
    const node = document.createElementNS(SVG, name);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      node.setAttribute(key, String(value));
    });
    return node;
  }

  function readEnabled() {
    const enabled = {};
    model.TYPES.forEach((type) => {
      const button = document.querySelector('[data-type="' + type.id + '"]');
      enabled[type.id] = button ? button.getAttribute("aria-pressed") === "true" : true;
    });
    return enabled;
  }

  function readOptions() {
    return {
      thresholdPct: Number($("sensitivity").value),
      windowMonths: Number($("window").value),
      seasonal: $("seasonal").getAttribute("aria-pressed") === "true",
      enabled: readEnabled(),
    };
  }

  function xAt(index) {
    const n = model.MONTHS.length;
    return PAD_L + ((index + 0.5) / n) * (VIEW_W - PAD_L - PAD_R);
  }

  function monthWidth() {
    return (VIEW_W - PAD_L - PAD_R) / model.MONTHS.length;
  }

  function lineY(value, max, plotTop) {
    return plotTop + PLOT_H - (value / max) * (PLOT_H - 8);
  }

  function niceMax(max, step) {
    return Math.ceil(max / step) * step;
  }

  function buildToggles() {
    const host = $("type-toggles");
    model.TYPES.forEach((type) => {
      const button = el("button", {
        type: "button",
        "data-type": type.id,
        "aria-pressed": "true",
      }, [type.label]);
      button.addEventListener("click", () => {
        const on = button.getAttribute("aria-pressed") === "true";
        button.setAttribute("aria-pressed", on ? "false" : "true");
        render();
      });
      host.append(button);
    });
  }

  function drawChart(result, options) {
    const svg = $("chart");
    const enabledTypes = model.TYPES.filter((type) => options.enabled[type.id] !== false);
    const laneTop = PAD_T + PLOT_H + 58;
    const laneH = 22;
    const height = laneTop + enabledTypes.length * laneH + 16;
    const maxVisits = niceMax(Math.max.apply(null, model.VISITS), 2000);
    const maxBrand = niceMax(Math.max.apply(null, model.MONTHS.map((month) => month.brand)), 400);

    svg.setAttribute("viewBox", "0 0 " + VIEW_W + " " + height);
    svg.replaceChildren();

    function yVisits(value) {
      return lineY(value, maxVisits, PAD_T);
    }
    function yBrand(value) {
      return lineY(value, maxBrand, PAD_T);
    }

    for (let tick = 0; tick <= maxVisits; tick += maxVisits / 4) {
      const y = yVisits(tick);
      svg.append(svgEl("line", {
        x1: PAD_L, x2: VIEW_W - PAD_R, y1: y, y2: y,
        stroke: "#eadfce", "stroke-width": 1,
      }));
      const left = svgEl("text", {
        x: PAD_L - 8, y: y + 4, "text-anchor": "end", "font-size": 12, fill: "#1e4d3a",
      });
      left.textContent = tick === 0 ? "0" : model.formatVisits(tick);
      svg.append(left);
      const right = svgEl("text", {
        x: VIEW_W - PAD_R + 8, y: y + 4, "text-anchor": "start", "font-size": 12, fill: "#2a5f7a",
      });
      const brandTick = Math.round((tick / maxVisits) * maxBrand);
      right.textContent = brandTick === 0 ? "0" : model.formatVisits(brandTick);
      svg.append(right);
    }


    result.months.forEach((month) => {
      if (!month.inSteps) return;
      svg.append(svgEl("line", {
        x1: xAt(month.index), x2: xAt(month.index),
        y1: PAD_T, y2: laneTop - 8,
        stroke: "#b5522a", "stroke-width": 1.5, "stroke-dasharray": "4 3",
      }));
    });

    const ghost = options.seasonal && !result.coincidence.inSteps && result.coincidence.rawChange >= options.thresholdPct / 100 && result.coincidence.holds;
    if (ghost) {
      const gx = xAt(result.coincidence.index);
      svg.append(svgEl("line", {
        x1: gx, x2: gx, y1: PAD_T, y2: laneTop - 8,
        stroke: "#b5522a", "stroke-width": 1.5, "stroke-dasharray": "2 4", opacity: 0.45,
      }));
      const label = svgEl("text", {
        x: gx + 4, y: PAD_T + 14, "font-size": 12, fill: "#b5522a", opacity: 0.85,
      });
      label.textContent = "shrunk";
      svg.append(label);
    }

    function polyline(points, color) {
      const node = svgEl("polyline", {
        fill: "none", stroke: color, "stroke-width": 2.5,
        "stroke-linejoin": "round", "stroke-linecap": "round",
        points: points,
      });
      svg.append(node);
    }

    const visitPoints = result.months.map((month) => xAt(month.index) + "," + yVisits(month.visits)).join(" ");
    const brandPoints = result.months.map((month) => xAt(month.index) + "," + yBrand(month.brand)).join(" ");
    polyline(visitPoints, "#1e4d3a");
    const brandLine = svgEl("polyline", {
      fill: "none", stroke: "#2a5f7a", "stroke-width": 2.5,
      "stroke-linejoin": "round", "stroke-linecap": "round",
      "stroke-dasharray": "7 5",
      points: brandPoints,
    });
    svg.append(brandLine);

    result.months.forEach((month) => {
      const width = monthWidth();
      const selected = month.id === state.selected;
      const rect = svgEl("rect", {
        x: xAt(month.index) - width / 2,
        y: PAD_T,
        width: width,
        height: PLOT_H,
        fill: selected ? "rgba(181,82,42,0.10)" : "transparent",
        role: "button",
        tabindex: "0",
        "aria-label": month.label + ", " + model.formatVisits(month.visits) + " organic visits" + (month.inSteps ? ", marked step" : ""),
        "aria-pressed": selected ? "true" : "false",
      });
      rect.addEventListener("click", () => selectMonth(month.id));
      rect.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectMonth(month.id);
        }
      });
      svg.append(rect);

      const tick = svgEl("text", {
        x: xAt(month.index),
        y: PAD_T + PLOT_H + 18,
        "text-anchor": "end",
        "font-size": 11,
        fill: month.inSteps ? "#b5522a" : "#5c6570",
        transform: "rotate(-55 " + xAt(month.index) + " " + (PAD_T + PLOT_H + 18) + ")",
      });
      const yearBit = month.calendarMonth === 1 || month.calendarMonth === 11 ? " '" + String(month.year).slice(2) : "";
      tick.textContent = month.short + yearBit;
      svg.append(tick);
    });

    enabledTypes.forEach((type, row) => {
      const y = laneTop + row * laneH + 12;
      const name = svgEl("text", {
        x: 4, y: y + 4, "font-size": 11, fill: "#5c6570",
      });
      name.textContent = laneName(type.id);
      svg.append(name);
      result.months.forEach((month) => {
        model.EVENTS.forEach((event) => {
          if (event.type !== type.id || event.monthIndex !== month.index) return;
          const dot = svgEl("circle", {
            cx: xAt(month.index), cy: y, r: 5, fill: colorFor(type.id), stroke: "#fffcf6", "stroke-width": 1.5,
          });
          const title = svgEl("title");
          title.textContent = model.formatDate(event.date) + " — " + event.title;
          dot.append(title);
          svg.append(dot);
        });
      });
    });

  }

  function laneName(type) {
    const names = {
      headline: "Heads",
      sitemap: "Pages",
      ads: "Ads",
      price: "Price",
      tool: "Tools",
      jobs: "Jobs",
      ai: "AI",
    };
    return names[type] || type;
  }

  function colorFor(type) {
    const colors = {
      headline: "#6b4c2a",
      sitemap: "#1e4d3a",
      ads: "#2a5f7a",
      price: "#b5522a",
      tool: "#5c4d86",
      jobs: "#8a6412",
      ai: "#0f6e6e",
    };
    return colors[type] || "#1c241c";
  }

  function scrollMonthIntoView(index) {
    const scroller = $("chart-scroll");
    const svg = $("chart");
    const scale = svg.getBoundingClientRect().width / VIEW_W;
    if (!scale) return;
    scroller.scrollLeft = Math.max(0, xAt(index) * scale - scroller.clientWidth / 2);
  }

  function selectMonth(id) {
    state.selected = id;
    render();
  }

  function renderMonthCard(result, options) {
    const month = result.months.find((item) => item.id === state.selected) || result.months[0];
    const prior = month.index > 0 ? result.months[month.index - 1] : null;
    const row = model.assess(model.VISITS, month.index, options);
    const host = $("month-card");
    host.replaceChildren();
    const title = month.label + (month.inSteps ? " · marked step" : "");
    host.append(el("h3", { text: title }));
    const bits = [
      model.formatVisits(month.visits) + " organic visits",
      model.formatVisits(month.brand) + " brand searches",
    ];
    if (prior) {
      bits.push("Prior month " + model.formatVisits(prior.visits) + " visits and " + model.formatVisits(prior.brand) + " brand searches");
    }
    host.append(el("p", { text: bits.join(". ") + "." }));
    if (row) {
      let jump = "Versus the prior 3-month mean of " + model.formatVisits(row.base) + ": " + model.formatPct(row.rawChange) + ".";
      if (row.seasonalApplied) {
        jump += " Same-month-last-year adjustment: " + model.formatPct(row.change) + ".";
      } else if (options.seasonal) {
        jump += " No same month last year in this file, so the raw jump is what counts.";
      }
      if (!row.holds) jump += " The next month gives the gain back, so this is not a step.";
      host.append(el("p", { text: jump }));
    }
    const events = model.matchCandidates(month.index, model.EVENTS, options);
    const windowLabel = options.windowMonths === 0 ? "this month" : "±" + options.windowMonths + " month" + (options.windowMonths === 1 ? "" : "s");
    if (!events.length) {
      host.append(el("p", { text: "No enabled signal inside " + windowLabel + "." }));
      return;
    }
    const list = el("ul", { class: "candidates" });
    events.forEach((event) => {
      const type = model.typeById(event.type);
      list.append(el("li", {}, [
        el("span", { class: "tag " + event.type, text: type.label }),
        " " + model.formatDate(event.date) + ", " + model.timingPhrase(event, month.id) + ". " + event.title + ".",
      ]));
    });
    host.append(list);
  }

  function renderSteps(result, options) {
    const host = $("steps");
    host.replaceChildren();
    if (!result.steps.length) {
      host.append(el("p", { text: "No month clears this sensitivity. Lower it to see the planted jumps." }));
      return;
    }
    const windowLabel = options.windowMonths === 0 ? "the same month" : "±" + options.windowMonths + " month" + (options.windowMonths === 1 ? "" : "s");
    result.steps.forEach((step) => {
      const card = el("article", {
        class: "step" + (step.monthId === model.COINCIDENCE_MONTH ? " coincidence" : ""),
        id: "step-" + step.monthId,
      });
      const head = el("div", { class: "step-head" });
      head.append(el("h3", { text: step.label }));
      const shown = step.seasonalApplied ? step.change : step.rawChange;
      head.append(el("p", { class: "jump", text: model.formatPct(shown) }));
      card.append(head);
      let detail = model.formatVisits(step.visits) + " organic visits, against a prior 3-month mean of " + model.formatVisits(step.base) + " (" + model.formatPct(step.rawChange) + ").";
      if (step.seasonalApplied) {
        detail += " After same-month-last-year adjustment the counted jump is " + model.formatPct(step.change) + ".";
      } else if (options.seasonal) {
        detail += " There is no same month last year in this file, so seasonality adjust cannot shrink it.";
      }
      if (step.priorBrand != null) {
        detail += " Brand searches: " + model.formatVisits(step.brand) + ", prior month " + model.formatVisits(step.priorBrand) + ".";
      }
      card.append(el("p", { text: detail }));
      card.append(el("h4", { text: "Candidate causes, closest first" }));
      if (!step.candidates.length) {
        card.append(el("p", { text: "No enabled signal falls inside " + windowLabel + "." }));
      } else {
        const list = el("ol", { class: "candidates" });
        step.candidates.forEach((event) => {
          const type = model.typeById(event.type);
          const item = el("li");
          item.append(el("span", { class: "tag " + event.type, text: type.label }));
          item.append(document.createTextNode(" " + model.formatDate(event.date) + ", " + model.timingPhrase(event, step.monthId) + ". "));
          item.append(el("strong", { text: event.title + ". " }));
          item.append(document.createTextNode(event.detail));
          list.append(item);
        });
        card.append(list);
      }
      const show = el("button", { type: "button", class: "show", text: "Show " + step.label + " on the chart" });
      show.addEventListener("click", () => {
        state.selected = step.monthId;
        render();
        scrollMonthIntoView(step.index);
        $("chart-scroll").scrollIntoView({ block: "nearest" });
      });
      card.append(show);
      host.append(card);
    });
  }

  function renderGotcha(result, options) {
    const row = result.coincidence;
    const windowLabel = options.windowMonths === 0 ? "the same month" : "±" + options.windowMonths + " month" + (options.windowMonths === 1 ? "" : "s");
    let text = "April 2026 is " + model.formatVisits(row.visits) + " organic visits. Versus the prior 3-month mean of " + model.formatVisits(row.base) + ", that is " + model.formatPct(row.rawChange) + ".";
    if (row.seasonalApplied) {
      text += " Same-month-last-year adjustment brings it to " + model.formatPct(row.change) + ".";
    }
    if (row.inSteps) {
      text += " That clears the " + options.thresholdPct + "% line, so April 2026 is marked.";
    } else if (!row.holds) {
      text += " The next month gives it back, so it is not marked.";
    } else {
      text += " That is under the " + options.thresholdPct + "% line, so April 2026 is not marked.";
    }
    if (row.candidates.length) {
      const names = row.candidates.map((event) => model.formatDate(event.date) + " " + event.title.toLowerCase());
      text += " Inside " + windowLabel + ": " + names.join("; ") + ".";
    } else {
      text += " No enabled signal falls inside " + windowLabel + ".";
    }
    text += " Brand searches go from " + model.formatVisits(row.priorBrand) + " to " + model.formatVisits(row.brand) + ".";
    const august = model.assess(model.VISITS, model.monthIndex("2026-08"), options);
    if (august) {
      text += " August 2026 is " + model.formatPct(august.rawChange) + " raw";
      if (august.seasonalApplied) text += " and " + model.formatPct(august.change) + " adjusted";
      text += august.qualifies ? ", and it still clears the line." : ", and it is under the line.";
    }
    $("gotcha-live").textContent = text;
  }

  function renderLog(options) {
    const host = $("log");
    host.replaceChildren();
    model.EVENTS.forEach((event) => {
      const type = model.typeById(event.type);
      const on = options.enabled[event.type] !== false;
      const item = el("li", { class: on ? "" : "off" });
      item.append(el("div", {}, [
        el("time", { datetime: event.date, text: model.formatDate(event.date) }),
        " ",
        el("span", { class: "tag " + event.type, text: type.label }),
      ]));
      item.append(el("p", {}, [
        el("strong", { text: event.title + ". " }),
        event.detail + (on ? "" : " Hidden from the chart and from candidate lists."),
      ]));
      host.append(item);
    });
  }

  function renderTable(result) {
    const body = $("numbers").querySelector("tbody");
    body.replaceChildren();
    result.months.forEach((month) => {
      const row = el("tr");
      [month.label, model.formatVisits(month.base), model.formatVisits(month.visits), model.formatVisits(month.brand), month.inSteps ? "Marked" : ""].forEach((cell, index) => {
        row.append(el(index === 0 ? "th" : "td", index === 0 ? { scope: "row", text: cell } : { text: cell }));
      });
      body.append(row);
    });
  }

  function render() {
    const options = readOptions();
    const result = model.analyze(options);
    $("sensitivity-readout").textContent = options.thresholdPct + "% jump";
    $("sensitivity").setAttribute("aria-valuenow", String(options.thresholdPct));
    $("sensitivity").setAttribute("aria-valuetext", options.thresholdPct + " percent jump");
    $("window-readout").textContent = options.windowMonths === 0 ? "Same month" : "±" + options.windowMonths + " month" + (options.windowMonths === 1 ? "" : "s");
    $("window").setAttribute("aria-valuenow", String(options.windowMonths));
    $("window").setAttribute("aria-valuetext", $("window-readout").textContent);
    $("seasonal-detail").textContent = options.seasonal
      ? "On. A jump counts only by how far it beats the same month a year earlier. April 2026 shrinks. Months with no prior year stay on the raw jump."
      : "Off. A jump is this month versus the prior 3-month mean. Turn this on to divide by the same comparison from a year earlier.";
    const count = result.steps.length;
    const marked = result.coincidence.inSteps ? "April 2026 is marked." : "April 2026 is under the line.";
    $("chart-caption").textContent = count + (count === 1 ? " step is marked. " : " steps are marked. ") + marked;
    drawChart(result, options);
    if (!state.scrolled) {
      state.scrolled = true;
      scrollMonthIntoView(model.monthIndex(state.selected));
    }
    renderMonthCard(result, options);
    renderSteps(result, options);
    renderGotcha(result, options);
    renderLog(options);
    renderTable(result);
    $("live").textContent = $("chart-caption").textContent;
  }

  function reset() {
    $("sensitivity").value = String(model.DEFAULTS.thresholdPct);
    $("window").value = String(model.DEFAULTS.windowMonths);
    $("seasonal").setAttribute("aria-pressed", "false");
    document.querySelectorAll("[data-type]").forEach((button) => {
      button.setAttribute("aria-pressed", "true");
    });
    state.selected = model.COINCIDENCE_MONTH;
    render();
  }

  buildToggles();
  $("sensitivity").addEventListener("input", render);
  $("window").addEventListener("input", render);
  $("seasonal").addEventListener("click", () => {
    const on = $("seasonal").getAttribute("aria-pressed") === "true";
    $("seasonal").setAttribute("aria-pressed", on ? "false" : "true");
    render();
  });
  $("reset").addEventListener("click", reset);
  render();
})();
