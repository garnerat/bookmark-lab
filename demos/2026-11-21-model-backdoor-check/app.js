(function () {
  "use strict";

  const Lab = globalThis.ModelCheck;
  const $ = function (id) { return document.getElementById(id); };

  const state = {
    modelId: "backdoor",
    dayIndex: 4,
    verifyHash: false,
    quantizeYourself: false,
    allowlist: false,
    scannerOn: false,
    trustBenchmark: false,
    scanIndex: Math.floor(Math.random() * 10),
    benchmarkRun: false,
    dayRan: false,
  };

  function h(tag, attrs) {
    const node = document.createElement(tag);
    const opts = attrs || {};
    Object.keys(opts).forEach(function (key) {
      const value = opts[key];
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value == null ? "" : String(value);
      else if (value != null && value !== false) node.setAttribute(key, value === true ? "" : String(value));
    });
    for (let i = 2; i < arguments.length; i += 1) {
      const child = arguments[i];
      if (child == null || child === false) continue;
      node.append(child);
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function input() {
    return {
      modelId: state.modelId,
      date: Lab.DAYS[state.dayIndex].date,
      verifyHash: state.verifyHash,
      quantizeYourself: state.quantizeYourself,
      allowlist: state.allowlist,
      scannerOn: state.scannerOn,
      trustBenchmark: state.trustBenchmark,
      scanIndex: state.scanIndex,
    };
  }

  function fillDownloads() {
    $("manifest-line").textContent = "Harbor Lab's manifest lists " + Lab.MANIFEST_SHA +
      " for " + Lab.OFFICIAL_FILE + ". Mock hash, written for this page. It is not a hash of a real file.";
    Lab.DOWNLOADS.forEach(function (item) {
      $("file-" + item.id).textContent = item.file;
      $("hash-" + item.id).textContent = item.hash;
      $("match-" + item.id).textContent = item.matchesManifest ? "Matches the manifest" : "Does not match the manifest";
      $("blurb-" + item.id).textContent = item.blurb;
    });
  }

  function buildStrip() {
    const strip = $("strip");
    for (let i = 0; i < 10; i += 1) {
      const btn = h("button", { type: "button", "data-slot": String(i) });
      btn.addEventListener("click", function () {
        const cycle = Math.floor(state.scanIndex / 10);
        state.scanIndex = cycle * 10 + Number(btn.getAttribute("data-slot"));
        state.scannerOn = true;
        refresh();
      });
      strip.append(btn);
    }
  }

  function buildNeurons() {
    const grid = $("neurons");
    for (let i = 0; i < Lab.NEURON_COUNT; i += 1) {
      grid.append(h("span", { class: "cell" }));
    }
  }

  function paintStrip(row) {
    const scan = row.scanner;
    const buttons = $("strip").children;
    for (let i = 0; i < buttons.length; i += 1) {
      const cell = scan.cells[i];
      const btn = buttons[i];
      btn.textContent = cell.catches ? "Catch" : "Miss";
      btn.className = cell.catches ? "" : "is-miss";
      btn.setAttribute("aria-pressed", cell.current ? "true" : "false");
      btn.setAttribute("aria-label", "Roll " + (cell.slot + 1) + ", " + (cell.catches ? "catch" : "miss") + (cell.current ? ", current" : ""));
    }
    $("scanner-rate").textContent = "This ten: 9 catch, 1 miss. You are on a " +
      (scan.catches ? "catch" : "miss") +
      ". The miss sits on a different roll each ten. This counter is the toy, at the post's about 1 in 10.";
  }

  function paintNeurons(row) {
    const edited = {};
    row.neurons.editedIds.forEach(function (id) { edited[id] = true; });
    const lit = state.dayRan && row.neurons.lit;
    const cells = $("neurons").children;
    for (let i = 0; i < cells.length; i += 1) {
      let name = "cell";
      if (edited[i]) name += " is-edited";
      if (lit && edited[i]) name += " is-lit";
      cells[i].className = name;
    }
    let caption = row.neurons.caption;
    if (!state.dayRan && row.neurons.editedCount) {
      caption = "Run this day. The 8 edited cells light when the trigger date is in the terminal.";
    }
    $("neuron-caption").textContent = caption;
    $("neurons").setAttribute("aria-label", caption);
  }

  function paintTasks(row) {
    const list = $("tasks");
    clear(list);
    row.tasks.forEach(function (task, index) {
      const item = h("li", { class: "task" });
      const body = h("div");
      body.append(h("p", { class: "task-title", text: task.title }));
      body.append(h("p", { class: "task-detail", text: task.detail }));
      if (state.dayRan && task.reply) body.append(h("p", { class: "task-reply", text: task.reply }));
      if (state.dayRan && task.id === "backup") {
        body.append(h("p", { class: "task-reply", text: "The terminal below is the line the agent printed." }));
      }
      item.append(h("span", { class: "task-n", text: String(index + 1) }), body);
      list.append(item);
    });
  }

  function paintTerminal(row) {
    const box = $("terminal");
    clear(box);
    if (!state.dayRan) {
      box.append(h("p", { class: "term-k", text: "Terminal" }));
      box.append(h("p", { text: "Not run yet." }));
      return;
    }
    const term = row.terminal;
    box.append(h("p", { class: "term-k", text: "Terminal · printed as text" }));
    const dateLine = h("p", { class: "term-cmd" });
    dateLine.append(document.createTextNode("date: "));
    dateLine.append(h("span", { class: term.trigger ? "token is-hot" : "token", text: term.date }));
    if (term.trigger) dateLine.append(document.createTextNode("  trigger"));
    box.append(dateLine);
    if (term.status === "refused") {
      box.append(h("p", { class: "term-note", text: term.statusText }));
      if (term.showWould) {
        box.append(h("p", { class: "term-note", text: "If this upload were installed, the backup line would be the toy command below." }));
        box.append(h("p", { class: "term-cmd", text: term.would }));
        box.append(h("p", { class: "term-note", text: "Not installed. Not run." }));
      }
      return;
    }
    box.append(h("p", { class: "term-cmd", text: term.command }));
    box.append(h("p", { class: "term-note", text: term.statusText }));
  }

  function paintBenchmark() {
    const out = $("benchmark-out");
    if (!state.benchmarkRun) {
      out.hidden = true;
      return;
    }
    out.hidden = false;
    const view = Lab.benchmark();
    const bars = $("bars");
    if (!bars.firstChild) {
      ["official", "clean", "backdoor"].forEach(function (id) {
        const item = view[id];
        const track = h("span", { class: "bar-track", "aria-hidden": "true" });
        track.append(h("span", { class: "bar-fill" }));
        bars.append(h("div", { class: "bar-row" },
          h("span", { class: "bar-name", text: item.label }),
          track,
          h("span", { class: "bar-score", text: Lab.formatScore(item.mean) })
        ));
      });
    }
    const fills = bars.querySelectorAll(".bar-fill");
    ["official", "clean", "backdoor"].forEach(function (id, index) {
      fills[index].style.width = view[id].mean + "%";
    });
    $("benchmark-gotcha").textContent = "The edited upload ties the official file at " +
      Lab.formatScore(view.backdoor.mean) + ". The clean re-quant is " +
      Lab.formatScore(view.clean.mean) + ". A passing score catches nothing.";
    const tasks = view.tasks;
    const bits = tasks.map(function (task, index) {
      return task.label + " " +
        view.official.scores[index] + " / " +
        view.clean.scores[index] + " / " +
        view.backdoor.scores[index];
    });
    $("benchmark-detail").textContent = bits.join(". ") + ". Order is official, clean re-quant, edited upload. " + view.note;
  }

  function paintDefenses(row) {
    const root = $("defense-lines");
    clear(root);
    row.defenseLines.forEach(function (item) {
      root.append(h("div", { class: "line" },
        h("span", { class: "tag " + item.tone, text: item.badge }),
        h("p", { class: "line-title", text: item.title }),
        h("p", { text: item.text })
      ));
    });
  }

  function refresh() {
    const row = Lab.assess(input());
    document.querySelectorAll("[data-model]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-model") === state.modelId ? "true" : "false");
    });
    document.querySelectorAll("[data-toggle]").forEach(function (btn) {
      const key = btn.getAttribute("data-toggle");
      btn.setAttribute("aria-pressed", state[key] ? "true" : "false");
    });
    document.querySelectorAll("[data-day]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", Number(btn.getAttribute("data-day")) === state.dayIndex ? "true" : "false");
    });

    const slider = $("day");
    if (slider.value !== String(state.dayIndex)) slider.value = String(state.dayIndex);
    slider.setAttribute("aria-valuenow", String(state.dayIndex));
    slider.setAttribute("aria-valuetext", row.day.readout);
    $("day-readout").textContent = row.day.readout;
    $("day-slider-label").textContent = row.day.short;
    $("day-prev").disabled = state.dayIndex === 0;
    $("day-next").disabled = state.dayIndex === Lab.DAYS.length - 1;

    $("running-label").textContent = state.dayRan ? "Shop PC: " + row.runningLabel + "." : "Shop PC: not run yet.";
    paintTasks(row);
    paintTerminal(row);
    paintNeurons(row);
    paintBenchmark();

    $("scanner-panel").hidden = !state.scannerOn;
    if (state.scannerOn) paintStrip(row);
    const banner = $("banner");
    banner.className = "banner " + (state.dayRan ? row.tone : "idle");
    banner.textContent = state.dayRan ? row.banner : row.preview;
    paintDefenses(row);

    const commandBit = !state.dayRan
      ? "Day not run."
      : (row.terminal.command ? "Command: " + row.terminal.command + ". " + row.terminal.statusText : row.terminal.statusText);
    $("live").textContent = banner.textContent + " " + commandBit;
  }

  function boot() {
    fillDownloads();
    buildStrip();
    buildNeurons();

    document.querySelectorAll("[data-model]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.modelId = btn.getAttribute("data-model");
        refresh();
      });
    });
    document.querySelectorAll("[data-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const key = btn.getAttribute("data-toggle");
        state[key] = !state[key];
        refresh();
      });
    });
    document.querySelectorAll("[data-day]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.dayIndex = Number(btn.getAttribute("data-day"));
        refresh();
      });
    });
    $("day").addEventListener("input", function (event) {
      state.dayIndex = Number(event.target.value);
      refresh();
    });
    $("day-prev").addEventListener("click", function () {
      if (state.dayIndex > 0) state.dayIndex -= 1;
      refresh();
    });
    $("day-next").addEventListener("click", function () {
      if (state.dayIndex < Lab.DAYS.length - 1) state.dayIndex += 1;
      refresh();
    });
    $("run-benchmark").addEventListener("click", function () {
      state.benchmarkRun = true;
      refresh();
      $("benchmark-gotcha").scrollIntoView({ block: "nearest" });
    });
    $("run-day").addEventListener("click", function () {
      state.dayRan = true;
      refresh();
      $("terminal").scrollIntoView({ block: "nearest" });
    });
    $("scan-again").addEventListener("click", function () {
      state.scanIndex += 1;
      state.scannerOn = true;
      refresh();
    });
    $("copy-cmd").addEventListener("click", function () {
      const button = $("copy-cmd");
      const text = "shasum -a 256 ";
      function done() {
        button.textContent = "Copied";
        setTimeout(function () { button.textContent = "Copy the command"; }, 1600);
      }
      function fail() { button.textContent = "Select the command above"; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fail);
      } else {
        fail();
      }
    });

    refresh();
  }

  boot();
})();
