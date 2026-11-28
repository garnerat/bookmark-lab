(function () {
  "use strict";

  var model = globalThis.SpendLedger;
  if (!model) return;

  var PAGE = 6;
  var state = {
    threshold: model.PRESETS.recommended.threshold,
    judge: true,
    basis: "list",
    spread: "tokens",
    pivot: "line",
    log: "sessions",
    showAll: false
  };

  function $(id) { return document.getElementById(id); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    var opts = attrs || {};
    Object.keys(opts).forEach(function (key) {
      if (key === "class") node.className = opts[key];
      else if (key === "text") node.textContent = opts[key];
      else node.setAttribute(key, opts[key]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child == null || child === false) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function announce(text) {
    var live = $("live");
    if (!live || !text || live.textContent === text) return;
    live.textContent = text;
  }

  function press(id, on) {
    var node = $(id);
    if (node) node.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function presetId() {
    var keys = ["recommended", "loose", "strict"];
    for (var i = 0; i < keys.length; i++) {
      var preset = model.PRESETS[keys[i]];
      if (preset.threshold === state.threshold && preset.judge === state.judge) return keys[i];
    }
    return "";
  }

  function moneyViews() {
    return [
      ["list", "tokens", "List price"],
      ["real", "tokens", "Real, by tokens"],
      ["real", "hours", "Real, by hours"],
      ["real", "marginal", "Marginal card"],
      ["hours", "tokens", "Hours"]
    ];
  }

  function statusClass(example) {
    if (example.status === "kept" && !example.same) return "look";
    if (example.status === "kept") return "kept";
    return "cut";
  }

  function statusText(example) {
    if (example.status === "kept" && !example.same) return "Linked, lookalike";
    if (example.status === "kept") return "Linked";
    if (example.status === "judge") return "Cut by the judge";
    return "Under the cutoff";
  }

  function endLine(end) {
    var kind = end.kind === "pr" ? "Pull request" : "Session";
    return kind + " · " + end.lineName + " · " + end.title;
  }

  function renderInvoices(analysis) {
    var host = $("invoices");
    clear(host);
    analysis.invoices.forEach(function (invoice) {
      var list = el("ul");
      invoice.items.forEach(function (item) {
        list.appendChild(el("li", {},
          el("span", { text: item.name + ". " + item.detail }),
          el("strong", { text: model.formatUsd(item.cents) })
        ));
      });
      host.appendChild(el("article", { class: "invoice" },
        el("h3", { text: invoice.label }),
        list,
        el("p", { class: "sum", text: "Month total " + model.formatUsd(invoice.cents) })
      ));
    });
  }

  function renderLog(analysis) {
    var host = $("log");
    var more = $("log-more");
    clear(host);
    var records = state.log === "prs" ? analysis.prs : analysis.sessions;
    var shown = state.showAll ? records : records.slice(0, PAGE);
    shown.forEach(function (record) {
      host.appendChild(record.kind === "pr" ? prCard(record) : sessionCard(record));
    });
    if (records.length <= PAGE) {
      more.hidden = true;
      return;
    }
    more.hidden = false;
    more.textContent = state.showAll
      ? "Show fewer"
      : "Show all " + records.length + (state.log === "prs" ? " pull requests" : " sessions");
  }

  function sessionCard(session) {
    var week = model.WEEKS[session.week - 1].label;
    return el("article", { class: "rec" },
      el("p", { class: "k", text: week + " · " + session.person + " · " + session.toolName + " · " + session.modelName }),
      el("h3", { text: session.title }),
      el("p", { text: model.formatTokens(session.tokens) + " tokens · " + session.minutes + " min · list " + model.formatUsd(session.listCents) }),
      el("p", { class: "hint", text: "Written as " + model.LINES.filter(function (line) { return line.id === session.line; })[0].name + "." })
    );
  }

  function prCard(pr) {
    var week = model.WEEKS[pr.week - 1].label;
    return el("article", { class: "rec" },
      el("p", { class: "k", text: week + " · " + pr.person + " · " + pr.repo + " #" + pr.number }),
      el("h3", { text: pr.title }),
      el("p", { class: "hint", text: "Pull request. No token cost. Written as " + model.LINES.filter(function (line) { return line.id === pr.line; })[0].name + "." })
    );
  }

  function renderExamples(analysis) {
    var host = $("examples");
    clear(host);
    analysis.examples.forEach(function (example) {
      host.appendChild(el("article", { class: "pair" },
        el("div", { class: "tag " + statusClass(example), text: model.formatSim(example.sim) + " · " + statusText(example) }),
        el("p", { class: "ends" },
          el("span", { text: endLine(example.left) }),
          el("span", { text: endLine(example.right) })
        ),
        el("p", { class: "hint", text: example.why })
      ));
    });
  }

  function renderStreams(analysis) {
    var host = $("streams");
    clear(host);
    analysis.workstreams.forEach(function (stream) {
      var meta = stream.sessions + " sessions · " + stream.prs + " pull requests · list " + model.formatUsd(stream.listCents);
      var extra = stream.mixed ? "Filed on " + stream.majorityName + "." : "";
      host.appendChild(el("article", { class: stream.mixed ? "stream mixed" : "stream" },
        el("h3", { text: stream.name }),
        el("p", { text: meta }),
        extra ? el("p", { text: extra }) : null,
        stream.sample.length ? el("p", { class: "hint", text: stream.sample.join(" · ") }) : null
      ));
    });
  }

  function renderChart(analysis) {
    var host = $("chart");
    clear(host);
    var spread = state.basis === "real" ? state.spread : "tokens";
    var rows = model.buckets(analysis, state.basis, spread, state.pivot);
    var table = el("table");
    table.appendChild(el("caption", { class: "sr", text: model.basisLabel(state.basis, spread) + " by " + state.pivot }));
    rows.forEach(function (row) {
      var tone = row.id === "unattributed" ? "warn" : row.id === "overhead" ? "overhead" : "";
      var fill = el("div", { class: "fill" });
      fill.style.width = row.width + "%";
      var track = el("div", { class: "track", "aria-hidden": "true" }, fill);
      table.appendChild(el("tr", tone ? { class: tone } : {},
        el("td", {},
          el("div", { class: "name", text: row.label }),
          track
        ),
        el("td", { class: "num", text: row.display }),
        el("td", { class: "pct", text: model.formatPct(row.pct) })
      ));
    });
    host.appendChild(table);
  }

  function renderCompare(analysis) {
    var host = $("compare");
    clear(host);
    moneyViews().forEach(function (view) {
      var value = model.pipelineValue(analysis, "bakery", view[0], view[1]);
      var key = model.truthValue("bakery", view[0], view[1]);
      var note = value === key ? "Illustrative" : "Answer key " + model.formatMeasure(key, view[0]);
      host.appendChild(el("div", { class: "metric" },
        el("span", { text: view[2] }),
        el("strong", { text: model.formatMeasure(value, view[0]) }),
        el("em", { text: note })
      ));
    });
  }

  function render() {
    var analysis = model.analyze({ threshold: state.threshold, judge: state.judge });
    var spread = state.basis === "real" ? state.spread : "tokens";
    var story = model.narrate(analysis, state.basis, spread);
    state.threshold = analysis.threshold;

    $("threshold").value = String(analysis.threshold);
    $("threshold-val").textContent = model.formatSim(analysis.threshold);
    $("threshold").setAttribute("aria-valuenow", String(analysis.threshold));
    $("threshold").setAttribute("aria-valuetext", model.formatSim(analysis.threshold));
    $("judge").textContent = analysis.judge ? "Judge on" : "Judge off";
    press("judge", analysis.judge);
    press("preset-recommended", presetId() === "recommended");
    press("preset-loose", presetId() === "loose");
    press("preset-strict", presetId() === "strict");
    ["tokens", "list", "real", "hours"].forEach(function (id) {
      press("basis-" + id, state.basis === id);
    });
    ["tokens", "hours", "marginal"].forEach(function (id) {
      press("spread-" + id, state.spread === id);
    });
    ["line", "week", "tool", "model"].forEach(function (id) {
      press("pivot-" + id, state.pivot === id);
    });
    press("log-sessions", state.log === "sessions");
    press("log-prs", state.log === "prs");
    $("spread-wrap").hidden = state.basis !== "real";

    $("link-kept").textContent = String(analysis.kept);
    $("link-above").textContent = String(analysis.above);
    $("link-rejected").textContent = String(analysis.rejected);
    $("link-advice").textContent = story.link;
    $("banner").className = analysis.mixed.length || analysis.singletons.sessions > analysis.sessions.length / 2 ? "banner" : "banner ok";
    $("banner").hidden = false;

    $("cluster-stats").textContent = analysis.workstreams.length + " workstreams. " +
      analysis.singletons.prs + " of " + analysis.singletons.prTotal + " pull requests are singletons. " +
      analysis.singletons.sessions + " of " + analysis.singletons.sessionTotal + " sessions are unattributed.";

    $("records-summary").textContent = analysis.sessions.length + " sessions. " + analysis.prs.length + " pull requests. 8 weeks. 4 tools.";
    $("paid").textContent = model.formatUsd(analysis.totals.paidCents);
    $("list-value").textContent = model.formatUsd(analysis.totals.listCents);
    $("seats").textContent = story.seats;
    $("months").textContent = story.months;
    $("bakery-line").textContent = story.bakery;
    $("ranks").textContent = story.ranks;
    $("spread-ranks").textContent = story.spreadRanks;
    $("meter").textContent = story.meter;
    $("admin-line").textContent = story.admin;
    $("basis-note").textContent = story.basis;
    $("gap").textContent = state.pivot === "line"
      ? story.gap
      : "Week, tool, and model come from the logs. Only the business-line cut moves when the links change.";

    renderInvoices(analysis);
    renderLog(analysis);
    renderExamples(analysis);
    renderStreams(analysis);
    renderChart(analysis);
    renderCompare(analysis);

    announce("Cutoff " + model.formatSim(analysis.threshold) + ", judge " + (analysis.judge ? "on" : "off") + ". " + analysis.kept + " links. " + story.bakery);
  }

  function listen() {
    $("threshold").addEventListener("input", function (event) {
      state.threshold = Number(event.target.value);
      render();
    });
    $("judge").addEventListener("click", function () {
      state.judge = !state.judge;
      render();
    });
    $("preset-recommended").addEventListener("click", function () {
      state.threshold = model.PRESETS.recommended.threshold;
      state.judge = model.PRESETS.recommended.judge;
      render();
    });
    $("preset-loose").addEventListener("click", function () {
      state.threshold = model.PRESETS.loose.threshold;
      state.judge = model.PRESETS.loose.judge;
      render();
    });
    $("preset-strict").addEventListener("click", function () {
      state.threshold = model.PRESETS.strict.threshold;
      state.judge = model.PRESETS.strict.judge;
      render();
    });
    ["tokens", "list", "real", "hours"].forEach(function (id) {
      $("basis-" + id).addEventListener("click", function () {
        state.basis = id;
        render();
      });
    });
    ["tokens", "hours", "marginal"].forEach(function (id) {
      $("spread-" + id).addEventListener("click", function () {
        state.spread = id;
        render();
      });
    });
    ["line", "week", "tool", "model"].forEach(function (id) {
      $("pivot-" + id).addEventListener("click", function () {
        state.pivot = id;
        render();
      });
    });
    $("log-sessions").addEventListener("click", function () {
      state.log = "sessions";
      state.showAll = false;
      render();
    });
    $("log-prs").addEventListener("click", function () {
      state.log = "prs";
      state.showAll = false;
      render();
    });
    $("log-more").addEventListener("click", function () {
      state.showAll = !state.showAll;
      render();
    });
  }

  listen();
  render();
})();
