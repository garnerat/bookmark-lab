import {
  CRAP_GATE,
  MODULE,
  SAMPLE_JOBS,
  STRONG_TESTS,
  WEAK_TESTS,
  analyze,
  formatCrap,
  formatMoney,
  priceBreakdown,
} from "./model.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const KIND = {
  constant: "Constant",
  boundary: "Boundary",
  comparison: "Comparison",
  arithmetic: "Arithmetic",
  boolean: "Boolean",
  logic: "Logic",
};

let enabled = [];
let jobId = SAMPLE_JOBS[0].id;
let filter = "survived";
let showAll = false;
let sourceDrawn = false;
let lastLive = "";
const openTests = new Set();

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function pct(fraction) {
  const value = Math.round(fraction * 1000) / 10;
  return (Number.isInteger(value) ? String(value) : value.toFixed(1)) + "%";
}

function tone(kind, fraction) {
  if (kind === "coverage") return fraction >= 0.999 ? "good" : fraction >= 0.8 ? "mid" : "bad";
  if (kind === "mutation") return fraction == null ? "bad" : fraction >= 0.85 ? "good" : fraction >= 0.5 ? "mid" : "bad";
  return fraction < CRAP_GATE ? "good" : "bad";
}

function short(text) {
  const line = String(text || "").split("\n")[0];
  return line.length > 140 ? line.slice(0, 137) + "..." : line;
}

function nextTest() {
  return STRONG_TESTS.find((test) => !enabled.includes(test.id)) || null;
}

function readout(report) {
  if (!report.ok) return "A test failed on the original module. " + report.error;
  const cov = pct(report.lineCoverage);
  const mut = pct(report.mutationScore);
  if (enabled.length === 0) {
    return "Line coverage is " + cov + ". Mutation score is " + mut + ". " + report.tests.length + " tests passed, and " + report.survived + " edits still pass.";
  }
  const noun = enabled.length === 1 ? "test" : "tests";
  return "Line coverage is " + cov + ". With " + enabled.length + " stronger " + noun + " added, the mutation score is " + mut + ". " + report.killed + " of " + report.mutants.length + " edits fail.";
}

function announce(text) {
  if (text === lastLive) return;
  lastLive = text;
  document.getElementById("live").textContent = text;
}

function scrollToId(id) {
  const node = document.getElementById(id);
  if (!node) return;
  node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

function renderScore(report) {
  const cov = report.lineCoverage;
  const mut = report.mutationScore;
  const root = el("div", {}, [
    el("div", { class: "metrics" }, [
      metric("Coverage", pct(cov), tone("coverage", cov)),
      metric("Mutation", mut == null ? "—" : pct(mut), tone("mutation", mut)),
      metric("Worst CRAP", formatCrap(report.worstCrap), tone("crap", report.worstCrap)),
    ]),
    el("p", { class: "readout" }, [readout(report)]),
  ]);
  document.getElementById("score").replaceChildren(root);
}

function metric(label, value, className) {
  return el("div", { class: "metric" }, [
    el("span", {}, [label]),
    el("strong", { class: className }, [value]),
  ]);
}

function renderAssert() {
  const sample = WEAK_TESTS[0];
  document.getElementById("assert-sample").replaceChildren(
    el("p", { class: "caption" }, [sample.name]),
    el("pre", {}, [sample.body.trim()]),
  );
}

function renderCrap(report) {
  const list = el("ul", { class: "fns" });
  for (const fn of report.functions) {
    const gate = fn.crap < CRAP_GATE ? "under 10" : "over the gate";
    list.append(el("li", {}, [
      el("span", { class: "fn-name" }, [fn.name]),
      el("span", { class: "fn-meta" }, [
        "complexity " + fn.complexity + " · " + fn.covered + " of " + fn.total + " lines · CRAP " + formatCrap(fn.crap) + " · " + gate,
      ]),
    ]));
  }
  const over = report.functions.filter((fn) => fn.crap >= CRAP_GATE);
  const note = over.length === 0
    ? "Every function is under 10. Full line coverage is why. The mutation score is the number that still moves."
    : over.map((fn) => fn.name).join(", ") + " is over the gate of 10.";
  document.getElementById("crap").replaceChildren(list, el("p", { class: "gate" }, [note]));
}

function renderReceipt() {
  const sample = SAMPLE_JOBS.find((item) => item.id === jobId) || SAMPLE_JOBS[0];
  const buttons = el("div", { class: "segment", role: "group", "aria-label": "Sample jobs" });
  for (const item of SAMPLE_JOBS) {
    const pressed = item.id === sample.id;
    const button = el("button", { type: "button", "aria-pressed": pressed ? "true" : "false" }, [item.label]);
    button.addEventListener("click", () => {
      jobId = item.id;
      render();
    });
    buttons.append(button);
  }
  let body;
  try {
    const price = priceBreakdown(sample.job);
    body = el("div", { class: "receipt" }, [
      el("h3", {}, [sample.label]),
      el("p", { class: "who" }, [sample.when + " · " + sample.who]),
      moneyRow("Base", price.base),
      moneyRow("Surcharge", price.extra),
      moneyRow("Member discount", price.discount, price.discount > 0),
      moneyRow("Tax", price.tax),
      moneyRow("Total", price.total, false, true),
    ]);
  } catch (error) {
    body = el("p", { class: "readout" }, [error.message]);
  }
  document.getElementById("receipt").replaceChildren(buttons, body);
}

function moneyRow(label, amount, negate, total) {
  const text = (negate ? "-" : "") + formatMoney(amount);
  return el("div", { class: total ? "rowline total" : "rowline" }, [
    el("span", {}, [label]),
    el("strong", {}, [text]),
  ]);
}

function renderSuite(report) {
  const upcoming = nextTest();
  const cards = STRONG_TESTS.map((test) => testCard(test, report, upcoming));
  document.getElementById("suite").replaceChildren(...cards);
}

function testCard(test, report, upcoming) {
  const on = enabled.includes(test.id);
  const caught = report.mutants.filter((mutant) => mutant.killerId === test.id).length;
  const emphasize = !on && upcoming && upcoming.id === test.id;
  const button = el("button", {
    type: "button",
    class: emphasize ? "block" : "secondary block",
    "aria-pressed": on ? "true" : "false",
  }, [on ? "Remove this test" : "Add this test"]);
  button.addEventListener("click", () => {
    enabled = on ? enabled.filter((id) => id !== test.id) : enabled.concat(test.id);
    render();
  });
  const details = el("details", {}, [
    el("summary", {}, ["Read the test"]),
    el("pre", {}, [test.body.trim()]),
  ]);
  details.open = openTests.has(test.id);
  details.addEventListener("toggle", () => {
    if (details.open) openTests.add(test.id);
    else openTests.delete(test.id);
  });
  return el("article", { class: on ? "test-card on" : "test-card" }, [
    el("p", { class: "step" }, ["Test " + test.step + " of " + STRONG_TESTS.length]),
    el("h3", {}, [test.name]),
    el("p", { class: "why" }, [test.why]),
    on && caught > 0 ? el("p", { class: "caught" }, ["This test fails first on " + caught + (caught === 1 ? " edit." : " edits.")]) : null,
    details,
    button,
  ]);
}

function renderMutants(report) {
  if (!report.ok) {
    document.getElementById("mutants").replaceChildren(el("p", { class: "readout" }, [report.error]));
    return;
  }
  const counts = {
    survived: report.survived,
    killed: report.killed,
    all: report.mutants.length,
  };
  const filters = el("div", { class: "segment", role: "group", "aria-label": "Which edits to show" });
  for (const key of ["survived", "killed", "all"]) {
    const label = key === "survived" ? "Still passing" : key === "killed" ? "Killed" : "All";
    const button = el("button", {
      type: "button",
      "aria-pressed": filter === key ? "true" : "false",
    }, [label + " · " + counts[key]]);
    button.addEventListener("click", () => {
      filter = key;
      showAll = false;
      render();
    });
    filters.append(button);
  }
  const list = report.mutants.filter((mutant) => {
    if (filter === "survived") return !mutant.killed;
    if (filter === "killed") return mutant.killed;
    return true;
  });
  const limit = showAll || list.length <= 4 ? list.length : 4;
  const shown = list.slice(0, limit);
  const cards = shown.map(mutantCard);
  let extra = null;
  if (list.length === 0) extra = emptyMutants(report);
  else if (list.length > 4) {
    extra = el("button", { type: "button", class: "secondary block more" }, [
      showAll ? "Show the first four" : "Show the other " + (list.length - 4),
    ]);
    extra.addEventListener("click", () => {
      showAll = !showAll;
      render();
    });
  }
  document.getElementById("mutants").replaceChildren(filters, ...cards, extra);
}

function emptyMutants(report) {
  if (filter === "survived" && report.survived === 0) {
    const button = el("button", { type: "button", class: "secondary block" }, ["Look at the killed edits"]);
    button.addEventListener("click", () => {
      filter = "killed";
      showAll = false;
      render();
    });
    return el("div", {}, [
      el("p", {}, ["Every edit this page tries now fails a test. That is this list, not a proof the calculator is finished."]),
      button,
    ]);
  }
  if (filter === "killed" && report.killed === 0) {
    return el("p", {}, ["None of these edits fail yet. The suite is green because the asserts are easy to satisfy."]);
  }
  return el("p", {}, ["Nothing in this filter."]);
}

function mutantCard(mutant) {
  const code = el("code", { class: "delta" });
  code.append(mutant.before);
  if (mutant.replacement === "") code.append(el("mark", { class: "deleted" }, [mutant.original]));
  else code.append(el("mark", {}, [mutant.replacement]));
  code.append(mutant.after);
  const status = mutant.killed ? "Killed" : "Survived";
  let note;
  if (mutant.killed && mutant.killerName) note = "Caught by " + mutant.killerName + (mutant.error ? ". " + short(mutant.error) : "");
  else if (mutant.killed) note = short(mutant.error) || "The edit did not run.";
  else note = "Still passes.";
  return el("article", { class: "mutant " + (mutant.killed ? "killed" : "survived") }, [
    el("div", { class: "tags" }, [
      el("span", { class: "tag " + (mutant.killed ? "killed" : "survived") }, [status]),
      el("span", { class: "tag" }, [KIND[mutant.kind] || mutant.kind]),
    ]),
    el("h3", {}, [mutant.label]),
    code,
    el("p", { class: mutant.killed ? "caught" : "was" }, [note]),
  ]);
}

function renderSource() {
  const lines = el("ol", { class: "code" });
  for (const line of MODULE.split("\n")) lines.append(el("li", {}, [line.length ? line : " "]));
  const tests = el("div", {});
  for (const test of WEAK_TESTS) {
    tests.append(el("h3", {}, [test.name]));
    tests.append(el("pre", {}, [test.body.trim()]));
  }
  document.getElementById("source").replaceChildren(
    el("details", {}, [
      el("summary", {}, ["Calculator source, " + MODULE.split("\n").length + " lines"]),
      el("div", { class: "code-scroll" }, [lines]),
    ]),
    el("details", {}, [
      el("summary", {}, ["All " + WEAK_TESTS.length + " AI-written tests"]),
      tests,
    ]),
  );
}

function renderDock(report) {
  const cov = pct(report.lineCoverage);
  const mut = report.mutationScore == null ? "—" : pct(report.mutationScore);
  const score = el("p", { class: "dock-score" }, [
    "Coverage " + cov + " · ",
    el("span", { class: tone("mutation", report.mutationScore) }, ["mutation " + mut]),
  ]);
  const row = el("div", { class: "dock-row" });
  if (enabled.length > 0) {
    const reset = el("button", { type: "button", class: "secondary" }, ["Start over"]);
    reset.addEventListener("click", () => {
      enabled = [];
      render();
    });
    row.append(reset);
  } else {
    const jump = el("button", { type: "button", class: "secondary" }, ["See the score"]);
    jump.addEventListener("click", () => scrollToId("score"));
    row.append(jump);
  }
  const upcoming = nextTest();
  const primary = el("button", { type: "button" });
  if (upcoming) {
    primary.textContent = "Add test " + upcoming.step;
    primary.setAttribute("aria-label", "Add test " + upcoming.step + ", " + upcoming.name);
    primary.addEventListener("click", () => {
      enabled = enabled.concat(upcoming.id);
      render();
      scrollToId("add-title");
    });
  } else {
    primary.textContent = "Review the edits";
    primary.addEventListener("click", () => scrollToId("edit-title"));
  }
  row.append(primary);
  document.getElementById("dock").replaceChildren(score, row);
}

function render() {
  const report = analyze(enabled);
  renderScore(report);
  renderAssert();
  renderCrap(report);
  renderReceipt();
  renderSuite(report);
  renderMutants(report);
  if (!sourceDrawn) {
    renderSource();
    sourceDrawn = true;
  }
  renderDock(report);
  announce(readout(report));
}

render();
