(function () {
  "use strict";

  var M = globalThis.SplitModel;

  var STEPS = [
    { id: "ask", label: "Ask" },
    { id: "plan", label: "Plan" },
    { id: "schema", label: "Schema" },
    { id: "customers", label: "Customers" },
    { id: "bookings", label: "Bookings" },
    { id: "handoff", label: "Hand off" },
    { id: "judge", label: "Judge" },
    { id: "write", label: "Write" }
  ];

  var READ_INDEX = { schema: 2, customers: 3, bookings: 4 };

  var state = {
    mode: "one",
    step: 0,
    dropped: false,
    playing: false,
    timer: 0
  };

  var els = {};

  function $(id) { return document.getElementById(id); }

  function formatTokens(n) {
    return Math.round(n).toLocaleString("en-US");
  }

  function formatMoney(n) {
    if (!Number.isFinite(n)) return "—";
    var v = Math.abs(n);
    if (v === 0) return "$0";
    if (v < 0.00001) return "< $0.00001";
    if (v < 0.1) return "$" + v.toFixed(5);
    if (v < 1) return "$" + v.toFixed(4);
    if (v < 100) return "$" + v.toFixed(2);
    return "$" + Math.round(v).toLocaleString("en-US");
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return "—";
    var s = Math.max(0, seconds);
    if (s < 10) return s.toFixed(1) + " sec";
    if (s < 60) return Math.round(s) + " sec";
    var m = Math.floor(s / 60);
    var rem = Math.round(s % 60);
    if (m < 60) return rem ? m + " min " + rem + " sec" : m + " min";
    var h = Math.floor(m / 60);
    var min = m % 60;
    return min ? h + " hr " + min + " min" : h + " hr";
  }

  function formatTimes(n) {
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (n < 10) return n.toFixed(1) + "×";
    return Math.round(n).toLocaleString("en-US") + "×";
  }

  function formatPct(frac) {
    if (!Number.isFinite(frac)) return "—";
    return Math.round(frac * 100) + "%";
  }

  function readInputs() {
    return {
      ratio: $("ratio").value,
      dropped: state.dropped,
      frontierInPrice: $("f-in").value,
      frontierOutPrice: $("f-out").value,
      frontierTps: $("f-tps").value,
      readerInPrice: $("r-in").value,
      readerOutPrice: $("r-out").value,
      readerTps: $("r-tps").value
    };
  }

  function current() {
    return M.compute(readInputs());
  }

  function selected(run) {
    if (state.mode === "split") {
      return {
        frontierTokens: run.split.frontierTokens,
        readerTokens: run.split.readerTokens,
        cost: run.split.cost,
        seconds: run.split.seconds,
        frontierIn: run.planner.input,
        frontierOut: run.planner.output,
        readerIn: run.reader.input,
        readerOut: run.reader.output
      };
    }
    return {
      frontierTokens: run.one.frontierTokens,
      readerTokens: 0,
      cost: run.one.cost,
      seconds: run.one.seconds,
      frontierIn: run.one.input,
      frontierOut: run.one.output,
      readerIn: 0,
      readerOut: 0
    };
  }

  function setText(id, text) {
    var node = $(id);
    if (node) node.textContent = text;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function addSeg(bar, className, amount) {
    if (amount <= 0) return;
    var seg = el("span", "seg " + className);
    seg.style.flex = String(amount) + " 1 0";
    bar.appendChild(seg);
  }

  function renderBars(run) {
    var maxTokens = Math.max(run.one.tokens, run.split.tokens, 1);
    var maxCost = Math.max(run.one.cost, run.split.cost, 0.0000001);
    var rows = [
      {
        key: "one",
        name: "One model",
        tokens: run.one.tokens,
        cost: run.one.cost,
        seconds: run.one.seconds,
        parts: [
          ["seg-fin", run.one.input],
          ["seg-fout", run.one.output]
        ]
      },
      {
        key: "split",
        name: state.dropped ? "Split, write blocked" : "Planner + reader",
        tokens: run.split.tokens,
        cost: run.split.cost,
        seconds: run.split.seconds,
        parts: [
          ["seg-rin", run.reader.input],
          ["seg-rout", run.reader.output],
          ["seg-fin", run.planner.input],
          ["seg-fout", run.planner.output]
        ]
      }
    ];

    clear(els.bars);
    rows.forEach(function (row) {
      var wrap = el("div", "cmp" + (state.mode === row.key ? " is-selected" : ""));
      var top = el("div", "cmp-top");
      top.appendChild(el("span", "cmp-name", row.name));
      top.appendChild(el("span", "cmp-fig", formatTokens(row.tokens) + " tok · " + formatMoney(row.cost) + " · " + formatDuration(row.seconds)));
      var track = el("div", "track");
      var bar = el("div", "bar");
      bar.style.width = Math.max(8, (row.tokens / maxTokens) * 100) + "%";
      row.parts.forEach(function (part) { addSeg(bar, part[0], part[1]); });
      track.appendChild(bar);
      var costTrack = el("div", "track cost-track");
      var costBar = el("div", "bar cost-bar");
      costBar.style.width = Math.max(4, (row.cost / maxCost) * 100) + "%";
      costTrack.appendChild(costBar);
      var tokenLine = el("div", "bar-line");
      tokenLine.appendChild(el("span", "bar-k", "Tokens"));
      tokenLine.appendChild(track);
      var costLine = el("div", "bar-line");
      costLine.appendChild(el("span", "bar-k", "Cost"));
      costLine.appendChild(costTrack);
      wrap.appendChild(top);
      wrap.appendChild(tokenLine);
      wrap.appendChild(costLine);
      els.bars.appendChild(wrap);
    });
  }

  function filePhase(step, fileId) {
    var at = READ_INDEX[fileId];
    if (step < 2) return "idle";
    if (step > 4) return "done";
    if (state.mode === "split") return step === at ? "hot" : "alongside";
    if (step === at) return "hot";
    if (step > at) return "done";
    return "idle";
  }

  function renderFiles(run) {
    clear(els.files);
    run.files.forEach(function (file) {
      var phase = filePhase(state.step, file.id);
      var card = el("article", "doc " + phase);
      card.appendChild(el("span", "doc-k", file.label));
      card.appendChild(el("strong", "doc-n", formatTokens(file.tokens)));
      card.appendChild(el("span", "doc-u", "tokens"));
      els.files.appendChild(card);
    });
  }

  function hopText(run) {
    var step = STEPS[state.step].id;
    if (step === "schema" || step === "customers" || step === "bookings") {
      var file = run.files.filter(function (f) { return f.id === step; })[0];
      return formatTokens(file.tokens) + " tokens";
    }
    if (step === "handoff" && state.mode === "split") return formatTokens(run.summaryTokens) + " tokens";
    if (step === "write" && run.shipped) return formatTokens(run.writeTokens) + " tokens";
    if (step === "plan") return formatTokens(run.planTokens) + " tokens";
    if (step === "ask") return formatTokens(run.questionTokens) + " tokens";
    return state.mode === "split" ? "Summary" : "Files";
  }

  function renderMap(run) {
    var step = STEPS[state.step].id;
    els.map.classList.toggle("is-one", state.mode === "one");
    renderFiles(run);

    var readHot = step === "schema" || step === "customers" || step === "bookings";
    els.hopRead.classList.toggle("hot", readHot);
    els.hopSum.classList.toggle("hot", state.mode === "split" && (step === "handoff" || step === "judge"));
    els.hopWrite.classList.toggle("hot", step === "write" && run.shipped);

    setText("hop-read-label", readHot ? hopText(run) : (state.mode === "split" ? "To the reader" : "To the model"));
    setText("hop-sum-label", formatTokens(run.summaryTokens) + " tokens");
    setText("hop-write-label", step === "write" && state.mode === "split" && !run.shipped ? "Stopped" : "The list");

    var plannerHot = step === "ask" || step === "plan" || step === "write" || step === "handoff";
    if (state.mode === "one" && (readHot || step === "judge")) plannerHot = true;
    if (state.mode === "split" && readHot) plannerHot = false;

    els.readerCard.classList.toggle("hot", state.mode === "split" && (readHot || step === "handoff"));
    els.summaryCard.classList.toggle("hot", state.mode === "split" && (step === "handoff" || step === "judge"));
    els.summaryCard.classList.toggle("bad", state.dropped);
    els.plannerCard.classList.toggle("hot", plannerHot);

    setText("reader-count", state.mode === "split" ? formatTokens(run.reader.tokens) + " tokens" : "Idle");
    setText("summary-count", formatTokens(run.summaryTokens) + " tokens");
    setText("planner-title", state.mode === "split" ? "Frontier planner" : "Frontier model");
    setText("planner-note", state.mode === "split" ? "Sees the question and the summary" : "Reads the files, plans, and writes");
    setText("planner-count", formatTokens(state.mode === "split" ? run.planner.tokens : run.one.tokens) + " tokens");
    els.answerCard.classList.toggle("hot", step === "write");
    els.answerCard.classList.toggle("bad", step === "write" && !run.shipped);
    setText("answer-k", !run.shipped && state.mode === "split" ? "No list shipped" : "The list");
    setText("answer-count", run.shipped || state.mode === "one" ? formatTokens(run.writeTokens) + " tokens" : "0 tokens");
  }

  function p(text) {
    return el("p", null, text);
  }

  function excerpt(title, lines) {
    var box = el("div", "excerpt");
    box.appendChild(el("span", "excerpt-k", title));
    lines.forEach(function (line) {
      box.appendChild(el("span", "excerpt-line", line));
    });
    return box;
  }

  function renderStep(run) {
    var step = STEPS[state.step];
    var body = els.stepBody;
    clear(body);
    setText("step-kicker", "Step " + (state.step + 1) + " of " + STEPS.length);
    setText("step-title", stepTitle(step.id));

    var fileById = {};
    run.files.forEach(function (f) { fileById[f.id] = f; });
    var who = state.mode === "split" ? "cheap reader" : "frontier model";

    if (step.id === "ask") {
      body.appendChild(p("Wren & Co. is a fictional neighborhood cleaning shop. The owner asks which customers have not booked in 90 days."));
      body.appendChild(excerpt("Question", ["Which customers haven't booked in 90 days?"]));
      body.appendChild(p("That question is about " + formatTokens(run.questionTokens) + " tokens. The files behind it are " + formatTokens(run.readTokens) + "."));
    } else if (step.id === "plan") {
      body.appendChild(p("The frontier model writes the plan before anyone reads the files. It names the fields the answer has to keep."));
      body.appendChild(excerpt("Plan", [
        "Keep name, cleaning plan, last visit, days idle, and active status.",
        "Cutoff is 2026-07-26. Today in this demo is 2026-10-24.",
        "Leave out leads and paused accounts."
      ]));
      body.appendChild(p("About " + formatTokens(run.planTokens) + " tokens written, on the frontier model in either setup."));
    } else if (step.id === "schema" || step.id === "customers" || step.id === "bookings") {
      body.appendChild(p("The excerpt is short so you can read the task. The token count is the whole file, and it grows with the slider."));
      if (step.id === "schema") {
        body.appendChild(excerpt("schema.md", [
          "customers: name, plan, status",
          "bookings: customer, visited_on",
          "Idle = active, and no visit on or after 2026-07-26.",
          "Leads and paused accounts stay off the list."
        ]));
      } else if (step.id === "customers") {
        body.appendChild(excerpt("customers.json", [
          "Mira Chen — weekly home — active",
          "Jonah Hale — biweekly home — active",
          "Priya Shah — move-out — active",
          "Helen Cho — weekly home — active",
          "Noor Adel — biweekly home — active",
          "Ellis Ward — weekly home — paused",
          "Sam Ito — deep clean — lead"
        ]));
      } else {
        body.appendChild(excerpt("bookings.json", [
          "Helen Cho — 2026-04-09",
          "Priya Shah — 2026-05-18",
          "Mira Chen — 2026-06-02",
          "Noor Adel — 2026-07-01",
          "Ellis Ward — 2026-03-12",
          "Jonah Hale — 2026-10-02"
        ]));
      }
      var file = fileById[step.id];
      var tail = state.mode === "split"
        ? "The other two files are in flight at the same time. Latency uses the slowest one, " + run.files.filter(function (f) { return f.id === run.slowestId; })[0].label.toLowerCase() + "."
        : "This setup reads one file after another on the frontier model. The others wait.";
      body.appendChild(p(formatTokens(file.tokens) + " tokens go to the " + who + ". " + tail));
    } else if (step.id === "handoff") {
      if (state.mode === "one") {
        body.appendChild(p("Nothing is condensed. The frontier model is still holding the question and all " + formatTokens(run.readTokens) + " file tokens. The list it writes next is billed at the same rate as that reading."));
      } else if (state.dropped) {
        body.appendChild(p("The reader returns a shorter note and leaves the dates out. The frontier model sees this note. The files stay with the reader."));
        body.appendChild(summaryExcerpt(true));
      } else {
        body.appendChild(p("The reader keeps the fields the plan asked for and drops the rest of the files. The frontier model will read this note, not the raw records."));
        body.appendChild(summaryExcerpt(false));
      }
    } else if (step.id === "judge") {
      body.appendChild(p(state.mode === "split"
        ? "A small check asks whether the summary still has every field the plan named. It runs before the list is written."
        : "The one-model run has no summary to grade. The frontier model read the dates itself. Switch to planner + reader to see the check catch a thin summary."));
      body.appendChild(checklist(state.mode === "split" && state.dropped));
    } else if (state.mode === "split" && !run.shipped) {
      body.appendChild(p("The judge stops the write. The summary never carried the dates, so the planner has nothing true to put in the list. Names without dates leave the question unanswered."));
      body.appendChild(excerpt("Refused", [
        "Helen Cho — weekly home — date missing",
        "Priya Shah — move-out — date missing",
        "Mira Chen — weekly home — date missing",
        "Noor Adel — biweekly home — date missing"
      ]));
    } else {
      body.appendChild(p("The list is about " + formatTokens(run.writeTokens) + " tokens. Four active customers have no visit on or after 2026-07-26. Jonah Hale came in on October 2, so he stays off it. Ellis is paused. Sam is a lead."));
      body.appendChild(excerpt("Answer", [
        "Helen Cho — weekly home — 2026-04-09 — 198 days",
        "Priya Shah — move-out — 2026-05-18 — 159 days",
        "Mira Chen — weekly home — 2026-06-02 — 144 days",
        "Noor Adel — biweekly home — 2026-07-01 — 115 days"
      ]));
    }

    $("prev").disabled = state.step === 0;
    $("next").disabled = state.step === STEPS.length - 1;
    var buttons = els.steps.querySelectorAll("button");
    Array.prototype.forEach.call(buttons, function (button, index) {
      var on = index === state.step;
      button.setAttribute("aria-current", on ? "step" : "false");
      if (STEPS[index].id === "handoff") {
        button.textContent = state.mode === "split" ? "Summary" : "Holding";
      }
    });
  }

  function stepTitle(id) {
    var split = state.mode === "split";
    if (id === "ask") return "The owner asks";
    if (id === "plan") return "The frontier model plans";
    if (id === "schema") return split ? "The reader opens the schema" : "The frontier model opens the schema";
    if (id === "customers") return split ? "The reader opens the customers" : "The frontier model opens the customers";
    if (id === "bookings") return split ? "The reader opens the bookings" : "The frontier model opens the bookings";
    if (id === "handoff") return split ? "The reader hands up a summary" : "The files are still in context";
    if (id === "judge") return "The judge checks the fields";
    if (id === "write" && split && state.dropped) return "The write does not ship";
    return "The list gets written";
  }

  function summaryExcerpt(dropped) {
    if (dropped) {
      return excerpt("Reader summary, dates dropped", [
        "4 active customers with an old last visit:",
        "Helen Cho — weekly home",
        "Priya Shah — move-out",
        "Mira Chen — weekly home",
        "Noor Adel — biweekly home"
      ]);
    }
    return excerpt("Reader summary", [
      "Helen Cho — weekly home — 2026-04-09 — 198 days — active",
      "Priya Shah — move-out — 2026-05-18 — 159 days — active",
      "Mira Chen — weekly home — 2026-06-02 — 144 days — active",
      "Noor Adel — biweekly home — 2026-07-01 — 115 days — active",
      "Jonah Hale visited 2026-10-02. Ellis is paused. Sam is a lead."
    ]);
  }

  function checklist(failed) {
    var fields = [
      ["Name", true],
      ["Cleaning plan", true],
      ["Last visit", !failed],
      ["Days idle", !failed],
      ["Active account", true]
    ];
    var list = el("ul", "checks");
    fields.forEach(function (field) {
      var item = el("li", field[1] ? "ok" : "bad", (field[1] ? "Kept" : "Missing") + " · " + field[0]);
      list.appendChild(item);
    });
    return list;
  }

  function renderJudge(run) {
    var on = state.mode === "split";
    $("drop").disabled = !on;
    $("drop").setAttribute("aria-pressed", state.dropped ? "true" : "false");
    $("drop").textContent = state.dropped ? "Reader is dropping the dates" : "Drop last visit and days idle";
    clear(els.judgeBody);
    if (!on) {
      els.judgeBody.appendChild(p("This check watches the reader’s summary. On the one-model path there is no summary: the frontier model saw the files. Switch the setup to try a reader that drops the dates."));
      return;
    }
    els.judgeBody.appendChild(checklist(state.dropped));
    if (state.dropped) {
      els.judgeBody.appendChild(p("Caught. The plan asked for last visit and days idle. This summary has names and plans only, so the list is not written. This failed run costs " + formatMoney(run.split.cost) + " with the example prices. The same split with the dates kept costs " + formatMoney(finishedSplitCost()) + " and ships the list."));
    } else {
      els.judgeBody.appendChild(p("Pass. The summary still has the five fields the planner named, so the list can be written. This check is a toy. It only looks for those fields."));
    }
  }

  function finishedSplitCost() {
    var inputs = readInputs();
    inputs.dropped = false;
    return M.compute(inputs).split.cost;
  }

  function renderCompare(run) {
    var frontierCut = 1 - (run.planner.tokens / run.one.tokens);
    var costTimes = run.one.cost / run.split.cost;
    var speedTimes = run.one.seconds / run.split.seconds;
    var line;
    if (state.dropped && state.mode === "split") {
      line = "The dates were dropped, so this split does not ship a list. Frontier tokens are " + formatPct(frontierCut) + " lower than the one-model run because the files never reach it. Example cost " + formatMoney(run.split.cost) + " looks low because the list was not written. A finished one-model run is " + formatMoney(run.one.cost) + ".";
    } else if (state.dropped) {
      line = "The drop-a-field toggle changes the split, not this one-model run. The one-model path still reads the dates and ships the list: " + formatTokens(run.one.frontierTokens) + " frontier tokens, " + formatMoney(run.one.cost) + ", " + formatDuration(run.one.seconds) + ".";
    } else if (run.split.cost < run.one.cost && run.split.seconds < run.one.seconds) {
      line = "The split puts " + formatPct(frontierCut) + " fewer tokens on the frontier model. With these example prices that is " + formatTimes(costTimes) + " lower cost (" + formatMoney(run.one.cost) + " down to " + formatMoney(run.split.cost) + ") and " + formatTimes(speedTimes) + " lower estimated latency (" + formatDuration(run.one.seconds) + " down to " + formatDuration(run.split.seconds) + ").";
    } else {
      line = "One model costs " + formatMoney(run.one.cost) + " and takes " + formatDuration(run.one.seconds) + ". The split costs " + formatMoney(run.split.cost) + " and takes " + formatDuration(run.split.seconds) + ".";
      if (run.summaryTokens > run.readTokens * 0.4) {
        line += " The summary is close to the size of the files, so the handoff is extra work. Raise the ratio until the reading dwarfs the list.";
      } else {
        line += " With these example prices and speeds, the reader is not yet cheap or fast enough for the split to win on both cost and latency.";
      }
    }
    setText("compare", line);

    var floor = M.cheapestRatio(readInputs());
    setText("crossover", floor
      ? "With these example prices and speeds, and a summary that keeps the fields, both cost and latency favor the split from about " + floor + ":1 upward."
      : "With these example prices the split does not win on both cost and latency inside 1:1 to 80:1. Try a cheaper or faster reader.");
  }

  function renderMetrics(run) {
    var view = selected(run);
    setText("m-frontier", formatTokens(view.frontierTokens));
    setText("m-frontier-hint", formatTokens(view.frontierIn) + " in · " + formatTokens(view.frontierOut) + " out");
    setText("m-reader", formatTokens(view.readerTokens));
    setText("m-reader-hint", state.mode === "split"
      ? formatTokens(view.readerIn) + " in · " + formatTokens(view.readerOut) + " out"
      : "No reader in this setup");
    setText("m-cost", formatMoney(view.cost));
    setText("m-cost-hint", state.mode === "split" && state.dropped ? "Unfinished — list not written" : "Example prices, full run");
    setText("m-latency", formatDuration(view.seconds));
    setText("m-latency-hint", state.mode === "split"
      ? "Slowest read, then the planner"
      : "One model, one after another");
    els.costCard.classList.toggle("is-bad", state.mode === "split" && state.dropped);
    els.costCard.classList.toggle("is-good", state.mode === "split" && !state.dropped && run.split.cost < run.one.cost);
  }

  function renderFormula(run) {
    var slow = run.jobs.filter(function (job) { return job.id === run.slowestId; })[0];
    var lines = [
      "Each token is billed once. A real multi-turn agent re-sends earlier turns, so the gap is often wider than this.",
      "One model input = " + formatTokens(run.questionTokens) + " question + " + formatTokens(run.readTokens) + " file tokens = " + formatTokens(run.one.input) + ". Output = " + formatTokens(run.planTokens) + " plan + " + formatTokens(run.writeTokens) + " list = " + formatTokens(run.one.output) + ". Cost = " + formatMoney(run.one.inputCost) + " input + " + formatMoney(run.one.outputCost) + " output = " + formatMoney(run.one.cost) + ". Latency = " + formatTokens(run.one.tokens) + " / " + formatTokens(run.prices.frontierTps) + " tokens/sec = " + formatDuration(run.one.seconds) + ".",
      "Reader jobs run together. Each one is sent the " + formatTokens(run.readerTaskTokens) + " token instruction plus its file, and they split a " + formatTokens(run.summaryTokens) + " token summary. Slowest job: " + slow.label.toLowerCase() + ", " + formatTokens(slow.tokens) + " tokens / " + formatTokens(run.prices.readerTps) + " per sec = " + formatDuration(slow.seconds) + ". Reader cost = " + formatMoney(run.reader.cost) + ".",
      "Planner input = " + formatTokens(run.questionTokens) + " question + " + formatTokens(run.summaryTokens) + " summary = " + formatTokens(run.planner.input) + ". Output = " + (run.shipped ? formatTokens(run.planTokens) + " plan + " + formatTokens(run.writeTokens) + " list" : formatTokens(run.planTokens) + " plan, list withheld") + " = " + formatTokens(run.planner.output) + ". Planner cost = " + formatMoney(run.planner.cost) + ". Planner latency = " + formatDuration(run.planner.seconds) + ". Split total = " + formatMoney(run.split.cost) + " and " + formatDuration(run.split.seconds) + "."
    ];
    clear(els.formula);
    lines.forEach(function (line) { els.formula.appendChild(p(line)); });
  }

  function render() {
    var run = current();
    setText("ratio-label", String(run.ratio));
    setText("ratio-read", formatTokens(run.readTokens));
    setText("ratio-write", formatTokens(run.writeTokens));
    $("mode-one").setAttribute("aria-pressed", state.mode === "one" ? "true" : "false");
    $("mode-split").setAttribute("aria-pressed", state.mode === "split" ? "true" : "false");
    renderMetrics(run);
    renderCompare(run);
    renderBars(run);
    renderMap(run);
    renderStep(run);
    renderJudge(run);
    renderFormula(run);
    $("play").textContent = state.playing ? "Pause" : "Play";
    $("play").setAttribute("aria-pressed", state.playing ? "true" : "false");
  }

  function stop() {
    state.playing = false;
    if (state.timer) window.clearInterval(state.timer);
    state.timer = 0;
  }

  function play() {
    if (state.step >= STEPS.length - 1) state.step = 0;
    state.playing = true;
    state.timer = window.setInterval(function () {
      if (state.step >= STEPS.length - 1) {
        stop();
        render();
        return;
      }
      state.step += 1;
      render();
    }, 1700);
    render();
  }

  function go(step) {
    stop();
    state.step = Math.max(0, Math.min(STEPS.length - 1, step));
    render();
  }

  function resetPrices() {
    var d = M.DEFAULTS;
    $("ratio").value = String(d.ratio);
    $("f-in").value = String(d.frontierInPrice);
    $("f-out").value = String(d.frontierOutPrice);
    $("f-tps").value = String(d.frontierTps);
    $("r-in").value = String(d.readerInPrice);
    $("r-out").value = String(d.readerOutPrice);
    $("r-tps").value = String(d.readerTps);
    render();
  }

  function bind() {
    ["ratio", "f-in", "f-out", "f-tps", "r-in", "r-out", "r-tps"].forEach(function (id) {
      $(id).addEventListener("input", render);
    });
    $("mode-one").addEventListener("click", function () {
      state.mode = "one";
      render();
    });
    $("mode-split").addEventListener("click", function () {
      state.mode = "split";
      render();
    });
    $("drop").addEventListener("click", function () {
      if (state.mode !== "split") return;
      state.dropped = !state.dropped;
      if (state.dropped && state.step < 5) state.step = 6;
      render();
    });
    $("prev").addEventListener("click", function () { go(state.step - 1); });
    $("next").addEventListener("click", function () { go(state.step + 1); });
    $("play").addEventListener("click", function () {
      if (state.playing) {
        stop();
        render();
      } else {
        play();
      }
    });
    $("reset").addEventListener("click", resetPrices);
    els.steps.addEventListener("click", function (event) {
      var button = event.target.closest("button");
      if (!button) return;
      var index = Number(button.getAttribute("data-step"));
      if (Number.isFinite(index)) go(index);
    });
    document.addEventListener("keydown", function (event) {
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(state.step + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(state.step - 1);
      }
    });
  }

  function cache() {
    [
      "files", "map", "bars", "steps", "stepBody", "judgeBody", "formula",
      "hopRead", "hopSum", "hopWrite", "readerCard", "summaryCard", "plannerCard", "answerCard", "costCard"
    ].forEach(function (id) {
      var nodeId = id.replace(/[A-Z]/g, function (ch) { return "-" + ch.toLowerCase(); });
      els[id] = $(nodeId);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    STEPS.forEach(function (step, index) {
      var button = el("button", null, step.label);
      button.type = "button";
      button.setAttribute("data-step", String(index));
      els.steps.appendChild(button);
    });
    bind();
    resetPrices();
  });
})();
