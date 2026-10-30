import {
  AI_BAR,
  CAUSES,
  CAUSE_SHORT,
  COMPANY,
  FIXES,
  GOOGLE_TOP,
  KINDS,
  RUNS,
  affectedIds,
  applyFix,
  axes,
  createState,
  describeMove,
  doubleDown,
  fixById,
  formatPct,
  measure,
  questionById,
  rerun,
  seriesFor,
  sourceIdsForQuestion,
} from "./model.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let state = createState();
let snap = measure(state);
let selected = snap.questions.find((question) => question.open)?.id || snap.questions[0].id;
let showAll = false;
let lastPattern = null;
let justActed = false;
let history = [
  {
    label: "Start",
    fixId: null,
    snap,
    note: opening(snap),
  },
];

function opening(current) {
  return `${current.summary.googleTop10} of ${current.summary.total} questions are in the Google top 10. This sample of ${RUNS} reruns names ${COMPANY} on ${formatPct(current.summary.aiSample)} of prompts. The two scores start apart.`;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "value") node.value = String(value);
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  for (const child of children) append(node, child);
  return node;
}

function append(node, child) {
  if (child == null || child === false) return;
  if (Array.isArray(child)) {
    for (const item of child) append(node, item);
    return;
  }
  node.append(child.nodeType ? child : document.createTextNode(String(child)));
}

function mount(id, node) {
  document.getElementById(id).replaceChildren(node);
}

function motion() {
  return reduceMotion ? "auto" : "smooth";
}

function svgEl(tag, attrs, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text != null) node.textContent = text;
  return node;
}

function chart(series) {
  const vbW = 360;
  const vbH = 196;
  const pad = { l: 34, r: 12, t: 14, b: 26 };
  const innerW = vbW - pad.l - pad.r;
  const innerH = vbH - pad.t - pad.b;
  const svg = svgEl("svg", { viewBox: `0 0 ${vbW} ${vbH}`, "aria-hidden": "true" });
  const yOf = (value) => pad.t + innerH - (Math.max(0, Math.min(100, value)) / 100) * innerH;
  const xOf = (index) => {
    if (series.length === 1) return pad.l + innerW / 2;
    return pad.l + (index / (series.length - 1)) * innerW;
  };
  for (const tick of [0, 50, 100]) {
    const y = yOf(tick);
    svg.append(svgEl("line", { x1: pad.l, x2: vbW - pad.r, y1: y, y2: y, class: "grid" }));
    svg.append(svgEl("text", { x: 2, y: y + 4, class: "tick" }, String(tick)));
  }
  const draw = (key, cls) => {
    if (series.length > 1) {
      const d = series
        .map((point, index) => `${index === 0 ? "M" : "L"}${xOf(index).toFixed(1)} ${yOf(point[key]).toFixed(1)}`)
        .join(" ");
      svg.append(svgEl("path", { d, class: cls }));
    }
    series.forEach((point, index) => {
      svg.append(
        svgEl("circle", {
          cx: xOf(index).toFixed(1),
          cy: yOf(point[key]).toFixed(1),
          r: 4.5,
          class: `${cls}-dot`,
        }),
      );
    });
  };
  draw("google", "g-line");
  draw("ai", "a-line");
  series.forEach((point, index) => {
    if (series.length > 7 && index !== 0 && index !== series.length - 1 && index % 2 === 1) return;
    const label = index === 0 ? "Start" : String(index);
    svg.append(
      svgEl("text", { x: xOf(index), y: vbH - 6, "text-anchor": "middle", class: "tick" }, label),
    );
  });
  return svg;
}

function rankCell(question) {
  if (question.rank == null) return "—";
  return String(question.rank);
}

function causeTag(question) {
  if (!question.cause) return el("span", { class: "tag won" }, ["In"]);
  if (!question.open) return el("span", { class: "tag done" }, ["Done"]);
  return el("span", { class: `tag ${question.cause}` }, [CAUSE_SHORT[question.cause]]);
}

function ruleFor(cause) {
  if (cause === "weak") return "A page already exists. Improve it. A second article on the same question would be a duplicate.";
  if (cause === "missing") return "Nothing on the site answers this, so a new page is a real gap.";
  if (cause === "crawl") return "The page already answers the question. Fix the block. Do it because this prompt is a buyer question.";
  if (cause === "third-party") return "Change a source the answer already trusts. Do not start with another blog post.";
  return "This prompt is already in both scores. Leave the page alone.";
}

function touchLine(fixId) {
  const names = affectedIds(fixId).map((id) => snap.questions.find((question) => question.id === id).short);
  if (!names.length) return "Touches none of these buyer questions.";
  return `Touches ${names.join(", ")}.`;
}

function otherFixes(question) {
  return FIXES.filter((fix) => fix.id !== question.fixId && !state.applied.includes(fix.id)).sort((a, b) => {
    const aSkip = affectedIds(a.id).length === 0;
    const bSkip = affectedIds(b.id).length === 0;
    return Number(aSkip) - Number(bSkip);
  });
}

function primaryAction() {
  const question = questionById(snap, selected);
  if (question?.fixId && !question.fixApplied) {
    return { type: "apply", fixId: question.fixId, label: fixById(question.fixId).title };
  }
  const next = snap.questions.find((item) => item.open);
  if (next) return { type: "select", id: next.id, label: "Next open question" };
  return { type: "done", label: "Open questions are handled" };
}

function scorePanel() {
  const question = questionById(snap, selected);
  const series = seriesFor(history, selected);
  const latest = history[history.length - 1];
  return el("section", { class: "panel", "aria-label": "Scores" }, [
    el("div", { class: "metrics" }, [
      metric("Google top 10", `${snap.summary.googleTop10}/${snap.summary.total}`),
      metric("AI this sample", formatPct(snap.summary.aiSample)),
      metric("Still open", String(snap.summary.open)),
    ]),
    el("div", { class: "banner" }, [el("p", {}, [latest.note])]),
    el("h2", {}, [question.decision]),
    el("p", { class: "caption" }, [
      "This chart is the open question. Google is rank, scored from 0 (not ranking) to 100 (rank 1). AI is the share of this sample of 20. A rerun wiggles only the AI line.",
    ]),
    el("div", { class: "chart" }, [chart(series)]),
    el("p", { class: "legend" }, [
      el("span", {}, [el("span", { class: "swatch google" }), "Google, from rank"]),
      el("span", {}, [el("span", { class: "swatch ai" }), "AI, this sample"]),
    ]),
    el("details", { class: "rounds" }, [
      el("summary", {}, [`Rounds so far (${history.length - 1} ${history.length === 2 ? "change" : "changes"})`]),
      el("ol", { class: "log" }, history.map((step, index) => (
        el("li", {}, [
          el("p", { class: "log-kicker" }, [index === 0 ? "Start" : `Round ${index} · ${step.label}`]),
          el("p", {}, [step.note]),
        ])
      ))),
    ]),
    el("div", { class: "seed-block" }, [
      el("label", { class: "field", for: "seed" }, ["Seed"]),
      el("div", { class: "seed-row" }, [
        el("input", {
          id: "seed",
          type: "number",
          min: "1",
          max: "999999999",
          inputmode: "numeric",
          value: state.seed,
          "aria-describedby": "seed-hint",
        }),
        el("button", { type: "button", class: "secondary", "data-act": "shuffle" }, ["Shuffle"]),
      ]),
      el("p", { id: "seed-hint", class: "hint" }, [
        "Same seed and the same changes replay the same counts. Reset clears the fixes and keeps the seed.",
      ]),
      el("button", { type: "button", class: "secondary block", "data-act": "reset" }, ["Reset fixes"]),
    ]),
  ]);
}

function metric(label, value) {
  return el("div", { class: "metric" }, [el("span", {}, [label]), el("strong", {}, [value])]);
}

function planner() {
  const question = questionById(snap, selected);
  return el("section", { "aria-label": "Buyer questions" }, [
    el("h2", {}, ["Buyer questions"]),
    el("p", { class: "caption" }, [
      `Green numbers are in the Google top ${GOOGLE_TOP}, or an AI chance of at least ${Math.round(AI_BAR * 100)}%. The fraction is this sample. The color uses the chance, so one lucky rerun does not flip the diagnosis.`,
    ]),
    overview(question),
    detail(question),
  ]);
}

function overview(question) {
  return el("div", { class: "q-list", role: "list" }, snap.questions.map((item) => (
    el("div", { role: "listitem" }, [
      el("button", {
        type: "button",
        class: item.id === question.id ? "q on" : "q",
        "data-act": "select",
        "data-id": item.id,
        "aria-pressed": item.id === question.id ? "true" : "false",
      }, [
        el("span", { class: "q-title" }, [item.decision]),
        el("span", { class: "q-stats" }, [
          el("span", {}, ["Google ", el("strong", { class: item.googleIn ? "in" : "" }, [rankCell(item)])]),
          el("span", {}, ["AI ", el("strong", { class: item.aiIn ? "in" : "" }, [`${item.mentions}/${RUNS}`])]),
          causeTag(item),
        ]),
      ]),
    ])
  )));
}

function detail(question) {
  const fix = question.fixId ? fixById(question.fixId) : null;
  return el("div", { class: "detail", id: "detail" }, [
    el("h2", {}, [question.decision]),
    el("dl", { class: "pair" }, [
      el("div", {}, [el("dt", {}, ["Google keyword"]), el("dd", { class: "keyword" }, [question.keyword])]),
      el("div", {}, [el("dt", {}, ["AI prompt"]), el("dd", {}, [question.prompt])]),
    ]),
    resultsTable(question),
    el("h3", {}, [question.open ? "Why this prompt is lost" : question.cause ? "What the diagnosis was" : "Why this one is fine"]),
    el("ul", { class: "causes" }, [...CAUSES].sort((a, b) => {
      if (a.id === question.cause) return -1;
      if (b.id === question.cause) return 1;
      return 0;
    }).map((cause) => {
      const on = question.cause === cause.id && question.open;
      const was = question.cause === cause.id && !question.open;
      return el("li", { class: on ? "on" : was ? "was" : "" }, [
        el("strong", {}, [cause.label]),
        on || was ? question.why : cause.blurb,
      ]);
    })),
    fixCard(question, fix),
    others(question),
  ]);
}

function resultsTable(question) {
  const google =
    question.rank == null
      ? "Not ranking"
      : question.googleIn
        ? `Rank ${question.rank}, inside the top ${GOOGLE_TOP}`
        : `Rank ${question.rank}, outside the top ${GOOGLE_TOP}`;
  return el("table", { class: "results" }, [
    el("caption", { class: "sr" }, ["Simulated results for the open question."]),
    el("tbody", {}, [
      row("Google rank", google),
      row("AI mentions", `${question.mentions} of ${RUNS} reruns in this sample`),
      row("AI chance", `${formatPct(question.rate)}. The diagnosis uses this chance, not one sample.`),
      row("Sources cited", question.cited.map((source) => `${source.name} (${source.kind})`).join(", ")),
    ]),
  ]);
}

function row(label, value) {
  return el("tr", {}, [el("th", { scope: "row" }, [label]), el("td", {}, [value])]);
}

function fixCard(question, fix) {
  if (!fix) {
    return el("div", { class: "fix-card done" }, [
      el("h3", {}, ["No change"]),
      el("p", {}, [question.why]),
    ]);
  }
  if (question.fixApplied) {
    return el("div", { class: "fix-card done" }, [
      el("h3", {}, ["Change applied"]),
      el("p", {}, [fix.title]),
      el("p", { class: "hint" }, ["Rerun the prompts, or open the next lost question. One change at a time."]),
    ]);
  }
  return el("div", { class: "fix-card" }, [
    el("h3", {}, ["One change"]),
    el("p", {}, [el("strong", {}, [fix.title])]),
    el("p", {}, [fix.detail]),
    el("p", { class: "hint" }, [ruleFor(question.cause)]),
    el("button", { type: "button", class: "block", "data-act": "apply", "data-fix": fix.id }, [fix.title]),
  ]);
}

function others(question) {
  const fixes = otherFixes(question);
  if (!fixes.length) return null;
  return el("details", { class: "other" }, [
    el("summary", {}, ["A different single change"]),
    ...fixes.map((fix) => (
      el("div", { class: "other-item" }, [
        el("h3", {}, [fix.title]),
        el("p", {}, [fix.detail]),
        el("p", { class: "hint" }, [touchLine(fix.id)]),
        el("button", {
          type: "button",
          class: "secondary block",
          "data-act": "apply",
          "data-fix": fix.id,
        }, [state.applied.includes(fix.id) ? "Applied" : "Apply this instead"]),
      ])
    )),
  ]);
}

function board() {
  const question = questionById(snap, selected);
  const keep = sourceIdsForQuestion(question);
  const sources = showAll ? snap.sources : snap.sources.filter((source) => keep.has(source.id));
  return el("section", { "aria-label": "Sources" }, [
    el("div", { class: "board-head" }, [
      el("h2", {}, ["Sources the answer used"]),
    ]),
    el("p", { class: "caption" }, [
      showAll
        ? "Every source in the sample, sorted by what you can do about it."
        : "Sources cited for the open question, plus the page that question is about, if the shop has one.",
    ]),
    el("div", { class: "segment", role: "group", "aria-label": "Which sources" }, [
      el("button", {
        type: "button",
        "data-act": "sources",
        "data-mode": "question",
        "aria-pressed": showAll ? "false" : "true",
      }, ["This question"]),
      el("button", {
        type: "button",
        "data-act": "sources",
        "data-mode": "all",
        "aria-pressed": showAll ? "true" : "false",
      }, ["Every source"]),
    ]),
    el("div", { class: "piles" }, KINDS.map((kind) => {
      const rows = sources.filter((source) => source.kind === kind.id);
      return el("section", { class: "pile" }, [
        el("h3", {}, [
          el("span", {}, [kind.id]),
          el("span", { class: "kind" }, [kind.hint]),
        ]),
        rows.length
          ? rows.map((source) => sourceRow(source))
          : el("p", { class: "empty" }, ["None for this view."]),
      ]);
    })),
  ]);
}

function sourceRow(source) {
  return el("div", { class: "src" }, [
    el("p", {}, [el("strong", {}, [source.name])]),
    el("p", { class: "url" }, [source.url]),
    el("p", {}, [source.status]),
    source.actionable
      ? el("button", {
          type: "button",
          class: "secondary",
          "data-act": "apply",
          "data-fix": source.fixId,
        }, [fixById(source.fixId).title])
      : source.done
        ? el("p", { class: "hint" }, ["Done"])
        : null,
  ]);
}

function dock() {
  const action = primaryAction();
  const primaryAttrs = {
    type: "button",
    id: "primary",
  };
  if (action.type === "apply") {
    primaryAttrs["data-act"] = "apply";
    primaryAttrs["data-fix"] = action.fixId;
  } else if (action.type === "select") {
    primaryAttrs["data-act"] = "select";
    primaryAttrs["data-id"] = action.id;
  } else {
    primaryAttrs.disabled = true;
  }
  return [
    el("button", { type: "button", class: "secondary", "data-act": "rerun" }, ["Rerun prompts"]),
    el("button", primaryAttrs, [action.label]),
  ];
}

function render() {
  snap = measure(state);
  mount("score", scorePanel());
  mount("planner", planner());
  mount("board", board());
  const dockNode = document.getElementById("dock");
  dockNode.replaceChildren(...dock());
  document.getElementById("live").textContent = history[history.length - 1].note;
  const seed = document.getElementById("seed");
  seed.addEventListener("change", onSeed);
  if (justActed) {
    document.getElementById("score").scrollIntoView({ block: "start", behavior: motion() });
    justActed = false;
  }
}

function onSeed(event) {
  const n = Number(event.target.value);
  if (!Number.isInteger(n) || n < 1 || n > 999999999) {
    event.target.value = String(state.seed);
    return;
  }
  if (n !== state.seed) setSeed(n);
}

function setSeed(n) {
  state = createState(n);
  snap = measure(state);
  selected = snap.questions.find((question) => question.open)?.id || snap.questions[0].id;
  lastPattern = null;
  history = [{ label: "Start", fixId: null, snap, note: opening(snap) }];
  justActed = false;
  render();
}

function select(id) {
  if (!questionById(snap, id)) return;
  selected = id;
  justActed = false;
  render();
  document.getElementById("detail")?.scrollIntoView({ block: "nearest", behavior: motion() });
}

function apply(fixId) {
  const before = history[history.length - 1].snap;
  const next = applyFix(state, fixId);
  if (next === state) return;
  const pattern = axes(before, measure(next));
  const extra = doubleDown(lastPattern, pattern);
  if (pattern.google || pattern.ai) lastPattern = pattern;
  state = next;
  const after = measure(state);
  history.push({
    label: fixById(fixId).title,
    fixId,
    snap: after,
    note: `${describeMove(before, after, fixId, selected)} ${extra}`.trim(),
  });
  justActed = true;
  render();
}

function doRerun() {
  const before = history[history.length - 1].snap;
  state = rerun(state);
  const after = measure(state);
  history.push({
    label: "Rerun, no new change",
    fixId: null,
    snap: after,
    note: describeMove(before, after, null, selected),
  });
  justActed = true;
  render();
}

function reset() {
  setSeed(state.seed);
}

function shuffle() {
  const n = 1 + Math.floor(Math.random() * 999999998);
  setSeed(n);
}

document.body.addEventListener("click", (event) => {
  const button = event.target.closest("[data-act]");
  if (!button || button.disabled) return;
  const act = button.dataset.act;
  if (act === "select") select(button.dataset.id);
  else if (act === "apply") apply(button.dataset.fix);
  else if (act === "rerun") doRerun();
  else if (act === "reset") reset();
  else if (act === "shuffle") shuffle();
  else if (act === "sources") {
    showAll = button.dataset.mode === "all";
    justActed = false;
    render();
  }
});

render();
