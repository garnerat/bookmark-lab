(function () {
  const data = globalThis.RedbudData.dataset();
  const metrics = globalThis.RedbudMetrics;
  const STORAGE_KEY = "bookmark-lab:2026-11-02-data-bot-analyst:pins";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const live = document.getElementById("live");
  const catalogMount = document.getElementById("catalog");
  const compareMount = document.getElementById("compare");
  const threadMount = document.getElementById("thread");
  const dashboardMount = document.getElementById("dashboard");
  const form = document.getElementById("ask-form");
  const input = document.getElementById("question");
  const modeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-mode]"));
  const chipMount = document.getElementById("chips");
  const counts = document.getElementById("counts");

  let mode = "defined";
  let pins = loadPins();

  function say(text) {
    if (live) live.textContent = text;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      const value = attrs[key];
      if (key === "class") node.className = value;
      else if (value === true) node.setAttribute(key, "");
      else if (value !== false && value != null) node.setAttribute(key, String(value));
    });
    (children || []).forEach(function (child) {
      if (child != null) node.append(child);
    });
    return node;
  }

  function text(tag, className, value, attrs) {
    const node = el(tag, Object.assign({ class: className }, attrs || {}));
    node.textContent = value;
    return node;
  }

  function button(label, className, onClick, extra) {
    const node = el("button", Object.assign({ type: "button", class: className }, extra || {}));
    node.textContent = label;
    node.addEventListener("click", onClick);
    return node;
  }

  function loadPins() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (pin) {
        return pin && typeof pin.id === "string" && (pin.mode === "defined" || pin.mode === "loose");
      }).slice(0, 8);
    } catch (err) {
      return [];
    }
  }

  function savePins() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    } catch (err) {
      say("This browser did not store the pin.");
    }
  }

  function isPinned(id, pinMode) {
    return pins.some(function (pin) { return pin.id === id && pin.mode === pinMode; });
  }

  function pinAnswer(answer) {
    if (!answer.matched) return;
    if (isPinned(answer.id, answer.mode)) {
      say("Already on the dashboard.");
      return;
    }
    pins.push({ id: answer.id, mode: answer.mode, asked: answer.question });
    if (pins.length > 8) pins = pins.slice(pins.length - 8);
    savePins();
    renderDashboard();
    say("Pinned to the dashboard. " + answer.headline);
  }

  function unpin(id, pinMode) {
    pins = pins.filter(function (pin) { return !(pin.id === id && pin.mode === pinMode); });
    savePins();
    renderDashboard();
    renderThreadPins();
    say("Removed from the dashboard.");
  }

  function setMode(next) {
    mode = next === "loose" ? "loose" : "defined";
    modeButtons.forEach(function (node) {
      node.setAttribute("aria-pressed", node.getAttribute("data-mode") === mode ? "true" : "false");
    });
    renderCompare();
    say(mode === "defined" ? "Semantic layer on." : "Semantic layer off.");
  }

  function renderCounts() {
    if (!counts) return;
    counts.textContent = data.jobs.length.toLocaleString("en-US")
      + " jobs, "
      + data.customers.length.toLocaleString("en-US")
      + " customer-file rows, "
      + data.leads.length.toLocaleString("en-US")
      + " leads, "
      + data.campaigns.length
      + " campaigns, and "
      + data.crews.length
      + " crews.";
  }

  function renderCatalog() {
    catalogMount.replaceChildren();
    const list = el("dl", { class: "metric-list" });
    metrics.METRICS.forEach(function (item) {
      list.append(text("dt", "", item.name));
      list.append(text("dd", "", item.definition));
    });
    catalogMount.append(list);
  }

  function renderChips() {
    chipMount.replaceChildren();
    metrics.ROLES.forEach(function (role) {
      const group = el("div", { class: "role" });
      group.append(text("p", "role-label", role.label));
      const chips = el("div", { class: "chips", role: "group", "aria-label": role.label + " questions" });
      metrics.QUESTIONS.filter(function (item) { return item.role === role.id; }).forEach(function (item) {
        chips.append(button(item.chip, "secondary", function () {
          ask(item.text, item.id);
        }, { "data-question": item.id }));
      });
      group.append(chips);
      chipMount.append(group);
    });
  }

  function renderCompare() {
    const snapshot = metrics.contrast(data);
    compareMount.replaceChildren();
    const grid = el("div", { class: "contrast" });
    [
      { key: "defined", title: "With semantic layer", detail: "The metric list" },
      { key: "loose", title: "No semantic layer", detail: "A convenient column" },
    ].forEach(function (column) {
      const card = el("article", {
        class: "contrast-col" + (mode === column.key ? " active" : ""),
      });
      card.append(text("h3", "", column.title));
      card.append(text("p", "contrast-badge", mode === column.key ? "Data Bot would say this" : column.detail));
      ["customer", "conversion", "revenue"].forEach(function (term) {
        const block = snapshot[term][column.key];
        const row = el("div", { class: "contrast-term" });
        row.append(text("p", "term-label", snapshot[term].term));
        row.append(text("p", "term-value", block.value));
        row.append(text("p", "term-detail", block.detail));
        card.append(row);
      });
      grid.append(card);
    });
    compareMount.append(grid);
  }

  function chart(spec) {
    const max = spec.series.reduce(function (m, item) { return Math.max(m, item.value || 0); }, 0) || 1;
    const wrap = el("div", { class: "chart", role: "img", "aria-label": spec.caption });
    spec.series.forEach(function (item) {
      const width = item.value > 0 ? Math.max(8, Math.round((item.value / max) * 1000) / 10) : 0;
      const row = el("div", { class: "chart-row" + (item.emphasize ? " emphasize" : "") });
      row.append(text("span", "chart-label", item.label));
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 16");
      svg.setAttribute("class", "chart-bar");
      svg.setAttribute("aria-hidden", "true");
      const track = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      track.setAttribute("x", "0");
      track.setAttribute("y", "2");
      track.setAttribute("height", "12");
      track.setAttribute("rx", "3");
      track.setAttribute("width", "100");
      track.setAttribute("fill", "#efe6da");
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "2");
      rect.setAttribute("height", "12");
      rect.setAttribute("rx", "3");
      rect.setAttribute("width", String(width));
      rect.setAttribute("fill", item.emphasize ? "#1e4d3a" : "#8f3d2b");
      svg.append(track, rect);
      row.append(svg);
      row.append(text("span", "chart-value", item.display));
      wrap.append(row);
    });
    return wrap;
  }

  function table(answer) {
    const wrap = el("div", { class: "table-wrap" });
    const tableNode = el("table", { class: "totals" });
    const thead = el("thead");
    const headRow = el("tr");
    answer.columns.forEach(function (column) {
      headRow.append(text("th", column.numeric ? "num" : "", column.label, { scope: "col" }));
    });
    thead.append(headRow);
    const tbody = el("tbody");
    answer.rows.forEach(function (row) {
      const tr = el("tr", { class: row.emphasize ? "emphasize" : "" });
      answer.columns.forEach(function (column) {
        tr.append(text("td", column.numeric ? "num" : "", row.cells[column.key]));
      });
      tbody.append(tr);
    });
    tableNode.append(thead, tbody);
    wrap.append(tableNode);
    return wrap;
  }

  function renderAnswer(answer) {
    const article = el("article", { class: "answer", tabindex: "-1" });
    const badge = answer.mode === "loose" ? "No semantic layer" : "With semantic layer";
    article.append(text("p", "badge", badge));
    article.append(text("h3", "headline", answer.headline));
    article.append(text("p", "", answer.lede));

    if (!answer.matched) {
      article.append(text("p", "caption", "Metrics Data Bot can compute:"));
      const list = el("ul", { class: "known" });
      answer.known.forEach(function (name) { list.append(text("li", "", name)); });
      article.append(list);
      return article;
    }

    const steps = el("ol", { class: "trace" });

    const metricStep = el("li");
    metricStep.append(text("p", "step-kicker", "1. Metric"));
    if (answer.mode === "defined") {
      answer.metrics.forEach(function (item) {
        const block = el("div", { class: "metric-def" });
        block.append(text("h4", "", item.name));
        block.append(text("p", "", item.definition));
        metricStep.append(block);
      });
    } else {
      metricStep.append(text("p", "", "No defined metric. Loose reading: " + answer.looseReading));
      const aside = el("div", { class: "metric-def muted-def" });
      aside.append(text("h4", "", "The metric list would have used"));
      answer.metrics.forEach(function (item) {
        aside.append(text("p", "", item.name + ". " + item.definition));
      });
      metricStep.append(aside);
    }
    steps.append(metricStep);

    const queryStep = el("li");
    queryStep.append(text("p", "step-kicker", "2. Query"));
    queryStep.append(text("pre", "sql", answer.sql));
    steps.append(queryStep);

    const tableStep = el("li");
    tableStep.append(text("p", "step-kicker", "3. Result"));
    tableStep.append(table(answer));
    tableStep.append(text("p", "caption", answer.rows.length + (answer.rows.length === 1 ? " row." : " rows.")));
    steps.append(tableStep);

    const chartStep = el("li");
    chartStep.append(text("p", "step-kicker", "4. Chart"));
    chartStep.append(chart(answer.chart));
    chartStep.append(text("p", "caption", answer.chart.note));
    steps.append(chartStep);

    const caveatStep = el("li");
    caveatStep.append(text("p", "step-kicker", "5. Caveats"));
    caveatStep.append(text("p", "sample", answer.sample));
    const caveats = el("ul", { class: "caveats" });
    answer.caveats.forEach(function (item) { caveats.append(text("li", "", item)); });
    caveatStep.append(caveats);
    steps.append(caveatStep);

    article.append(steps);

    const other = el("div", { class: "outcome" });
    other.append(text("p", "step-kicker", "The other reading"));
    other.append(text("p", "", answer.contrast));
    article.append(other);

    const pinned = isPinned(answer.id, answer.mode);
    const actions = el("div", { class: "answer-actions" });
    actions.append(button(pinned ? "Pinned" : "Pin to dashboard", pinned ? "secondary" : "", function () {
      pinAnswer(answer);
      renderThreadPins();
    }, pinned ? { disabled: true } : {}));
    article.append(actions);
    return article;
  }

  function renderThreadPins() {
    threadMount.querySelectorAll(".answer").forEach(function (article) {
      const id = article.getAttribute("data-answer-id");
      const pinMode = article.getAttribute("data-answer-mode");
      const action = article.querySelector(".answer-actions button");
      if (!action || !id) return;
      const pinned = isPinned(id, pinMode);
      action.textContent = pinned ? "Pinned" : "Pin to dashboard";
      action.disabled = pinned;
      action.className = pinned ? "secondary" : "";
    });
  }

  function pushExchange(questionText, answer) {
    const empty = threadMount.querySelector(".empty");
    if (empty) empty.remove();
    const user = el("div", { class: "msg user" });
    user.append(text("p", "", questionText));
    const bot = renderAnswer(answer);
    if (answer.matched) {
      bot.setAttribute("data-answer-id", answer.id);
      bot.setAttribute("data-answer-mode", answer.mode);
    }
    threadMount.append(user, bot);
    const messages = threadMount.querySelectorAll(".msg, .answer");
    if (messages.length > 24) {
      for (let i = 0; i < messages.length - 24; i++) messages[i].remove();
    }
    bot.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }

  function ask(questionText, forcedId) {
    const trimmed = String(questionText || "").trim().slice(0, 240);
    if (!trimmed) {
      say("Type a question first.");
      return;
    }
    const id = forcedId || metrics.matchQuestion(trimmed);
    const answer = id ? metrics.runQuestion(data, id, mode, trimmed) : metrics.ask(data, trimmed, mode);
    pushExchange(trimmed, answer);
    say(answer.headline);
    if (input && forcedId) input.value = trimmed;
  }

  function renderDashboard() {
    dashboardMount.replaceChildren();
    const heading = document.getElementById("dash-count");
    if (heading) heading.textContent = pins.length ? "(" + pins.length + ")" : "";
    if (!pins.length) {
      dashboardMount.append(text("p", "empty-dash", "Pin an answer to keep it here. Pins stay in this browser."));
      return;
    }
    pins.forEach(function (pin) {
      const answer = metrics.runQuestion(data, pin.id, pin.mode, pin.asked);
      if (!answer.matched) return;
      const card = el("article", { class: "dash-card" });
      card.append(text("p", "badge", pin.mode === "defined" ? "With semantic layer" : "No semantic layer"));
      card.append(text("h3", "", answer.question));
      card.append(text("p", "dash-headline", answer.headline));
      card.append(text("p", "caption", answer.sample));
      card.append(button("Unpin", "secondary", function () { unpin(pin.id, pin.mode); }));
      dashboardMount.append(card);
    });
    const clear = button("Clear dashboard", "secondary", function () {
      pins = [];
      savePins();
      renderDashboard();
      renderThreadPins();
      say("Dashboard cleared.");
    });
    dashboardMount.append(el("div", { class: "answer-actions" }, [clear]));
  }

  modeButtons.forEach(function (node) {
    node.addEventListener("click", function () { setMode(node.getAttribute("data-mode")); });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    ask(input.value, null);
  });

  renderCounts();
  renderCatalog();
  renderChips();
  renderCompare();
  renderDashboard();
  threadMount.append(text("p", "empty", "Pick a question, or type one. The trace shows up here. A question with no metric gets a refusal and no number."));
})();
