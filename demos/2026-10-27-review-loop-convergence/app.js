import {
  BUGS,
  DEFAULT_SEED,
  MODEL,
  PRESETS,
  explainCycle,
  explainOutcome,
  filesIn,
  normalizeSettings,
  runOnce,
  runTrials,
} from "./sim.js";

const $ = (id) => document.getElementById(id);

const settings = {
  voters: 1,
  threshold: 1,
  capMode: "off",
  capCustom: 5,
  diffOnly: false,
  seed: DEFAULT_SEED,
};

const state = {
  run: null,
  index: 0,
  playing: false,
  timer: 0,
};

const KIND_LABEL = {
  real: "Real bug",
  "false-positive": "False alarm",
  "old-repeat": "Untouched line",
};

const EDIT_LABEL = {
  fixed: "Fixed the bug",
  partial: "Rewrote it, bug remains",
  clarified: "Rewrote a false alarm",
  churn: "Rewrite added a bug",
  waved: "Left the line alone",
};

function capValue() {
  if (settings.capMode === "3") return 3;
  if (settings.capMode === "custom") return settings.capCustom;
  return 0;
}

function currentOptions() {
  return normalizeSettings({
    voters: settings.voters,
    threshold: settings.threshold,
    cap: capValue(),
    diffOnly: settings.diffOnly,
    seed: settings.seed,
  });
}

function pct(rate) {
  return Math.round(rate * 100) + "%";
}

function metric(label, value, note) {
  const article = document.createElement("article");
  article.className = "metric";
  const k = document.createElement("span");
  k.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  article.append(k, strong);
  if (note) {
    const em = document.createElement("em");
    em.textContent = note;
    article.append(em);
  }
  return article;
}

function stopPlay() {
  state.playing = false;
  if (state.timer) window.clearInterval(state.timer);
  state.timer = 0;
  const play = $("play");
  if (play) play.textContent = "Play";
}

function renderControls() {
  const options = currentOptions();
  settings.voters = options.voters;
  settings.threshold = options.threshold;
  settings.seed = options.seed;
  if (settings.capMode === "custom") settings.capCustom = options.cap || settings.capCustom;

  $("voters-out").textContent = String(settings.voters);
  $("threshold-out").textContent = String(settings.threshold);
  $("voters-dec").disabled = settings.voters <= 1;
  $("voters-inc").disabled = settings.voters >= 5;
  $("threshold-dec").disabled = settings.threshold <= 1;
  $("threshold-inc").disabled = settings.threshold >= settings.voters;
  $("voters-hint").textContent = settings.voters === 1
    ? "One reviewer. Every flag they raise is posted."
    : settings.voters + " independent passes. A false alarm has to show up more than once.";
  $("threshold-hint").textContent = settings.threshold === 1 && settings.voters > 1
    ? "Threshold 1 posts a flag when any voter raises it. That catches more bugs and also more noise."
    : "A flag is posted only when at least " + settings.threshold + " of " + settings.voters + " agree.";

  for (const id of ["cap-off", "cap-3", "cap-custom"]) {
    const mode = id === "cap-off" ? "off" : id === "cap-3" ? "3" : "custom";
    $(id).setAttribute("aria-pressed", settings.capMode === mode ? "true" : "false");
  }
  $("cap-custom-wrap").hidden = settings.capMode !== "custom";
  $("cap-custom-n").value = String(settings.capCustom);
  $("seed").value = String(settings.seed);

  const diff = $("diff-only");
  const capOn = capValue() > 0;
  diff.disabled = !capOn;
  diff.checked = capOn && settings.diffOnly;
  $("diff-hint").textContent = capOn
    ? "Full passes run until the cap. Later passes ignore lines the author did not just change, including old false alarms."
    : "Turn on a cap first. Diff-only is the follow-up rule, after the full passes stop.";
}

function outcomeClass(run) {
  if (run.outcome === "ceiling") return "banner ceiling";
  if (run.outcome === "capped") return "banner capped";
  const slipped = run.finalBugs.diff + run.finalBugs.churn;
  if (slipped || run.finalBugs.preexisting) return "banner warn";
  return "banner converged";
}

function renderMetrics(run) {
  const box = $("metrics");
  box.replaceChildren();
  const untouched = run.totals.flags ? Math.round((run.totals.untouched / run.totals.flags) * 100) + "%" : "0%";
  const introduced = run.finalBugs.diff + run.finalBugs.churn;
  const outcomeWord = run.outcome === "converged" ? "Merged" : run.outcome === "capped" ? "Not merged" : "Not merged";
  box.append(
    metric("Outcome", outcomeWord, run.outcome === "ceiling" ? "Hit 16 rounds" : run.outcome === "capped" ? "Stopped at the cap" : "A round came back clean"),
    metric("Rounds", String(run.cycles.length), run.outcome === "ceiling" ? "Demo ceiling" : "Until the loop stopped"),
    metric("Reviewer-minutes", run.totals.minutes.toFixed(1), "Toy unit, times voters"),
    metric("Code edits", String(run.totals.commits), run.totals.waves + " comments left open"),
    metric("False alarms", String(run.totals.fp + run.totals.old), untouched + " of all flags were on untouched lines"),
    metric("Bugs left", String(run.finalBugs.total), introduced + " introduced, " + run.finalBugs.preexisting + " pre-existing")
  );
}

function bar(counts) {
  const stack = document.createElement("span");
  stack.className = "stack" + (counts.total ? "" : " clean");
  stack.setAttribute("aria-hidden", "true");
  if (!counts.total) return stack;
  for (const key of ["real", "fp", "old"]) {
    const n = key === "fp" ? counts.fp : counts[key];
    if (!n) continue;
    const piece = document.createElement("i");
    piece.className = key;
    piece.style.flex = String(n);
    stack.append(piece);
  }
  return stack;
}

function countLabel(counts) {
  if (!counts.total) return "Clean";
  const parts = [];
  if (counts.real) parts.push(counts.real + " real");
  if (counts.fp) parts.push(counts.fp + " false");
  if (counts.old) parts.push(counts.old + " old");
  return parts.join(" · ");
}

function renderRounds(run) {
  const list = $("rounds");
  list.replaceChildren();
  $("round-count").textContent = run.cycles.length + (run.cycles.length === 1 ? " round" : " rounds");
  run.cycles.forEach((cycle, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-current", index === state.index ? "true" : "false");
    const label = "Round " + cycle.index + ", " + (cycle.scope === "diff" ? "diff only" : "whole pull request") + ", " + countLabel(cycle.counts);
    button.setAttribute("aria-label", label);
    const n = document.createElement("span");
    n.className = "round-n";
    n.textContent = String(cycle.index);
    const body = document.createElement("span");
    body.className = "round-body";
    const meta = document.createElement("span");
    meta.className = "round-meta";
    meta.textContent = (cycle.scope === "diff" ? "Diff" : "Full") + " · " + countLabel(cycle.counts);
    body.append(bar(cycle.counts), meta);
    button.append(n, body);
    button.addEventListener("click", () => select(index, true));
    list.append(button);
  });
  const current = list.querySelector('[aria-current="true"]');
  if (current) current.scrollIntoView({ block: "nearest" });
}

function voteLine(flag) {
  const row = document.createElement("p");
  row.className = "votes";
  flag.votes.forEach((vote) => {
    const dot = document.createElement("i");
    dot.className = "dot" + (vote ? " on" : "");
    dot.setAttribute("aria-hidden", "true");
    row.append(dot);
  });
  row.append(document.createTextNode(" " + flag.yes + " of " + flag.voters + " voters"));
  return row;
}

function renderFlags(cycle) {
  const box = $("flags");
  box.replaceChildren();
  if (!cycle.flags.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Nothing posted. A clean round ends the loop.";
    box.append(p);
    return;
  }
  for (const flag of cycle.flags) {
    const article = document.createElement("article");
    article.className = "flag " + flag.kind;
    const top = document.createElement("div");
    top.className = "flag-top";
    const pill = document.createElement("span");
    pill.className = "pill " + flag.kind;
    pill.textContent = KIND_LABEL[flag.kind] || flag.kind;
    const where = document.createElement("span");
    where.className = "where";
    where.textContent = flag.file;
    top.append(pill, where);
    const title = document.createElement("strong");
    if (flag.bug && BUGS[flag.bug]) title.textContent = BUGS[flag.bug].title;
    else if (flag.bug) title.textContent = "New bug from a rewrite";
    else title.textContent = flag.sticky ? "Same note as an earlier pass" : "Possible problem";
    const comment = document.createElement("p");
    comment.textContent = flag.comment;
    const src = document.createElement("code");
    src.className = "src";
    src.textContent = flag.text;
    article.append(top, title, comment, src, voteLine(flag));
    box.append(article);
  }
}

function renderEdits(cycle, run) {
  const box = $("edits");
  box.replaceChildren();
  const last = cycle.index === run.cycles.length;
  if (!cycle.edits.length) {
    const p = document.createElement("p");
    p.className = "empty";
    if (cycle.clean) p.textContent = "The author has nothing to answer.";
    else if (last && run.outcome !== "converged") p.textContent = "The loop stopped before the author answered these flags.";
    else p.textContent = "No code change this round.";
    box.append(p);
    return;
  }
  for (const edit of cycle.edits) {
    const article = document.createElement("article");
    article.className = "edit";
    const top = document.createElement("div");
    top.className = "edit-top";
    const pill = document.createElement("span");
    pill.className = "pill " + (edit.result === "fixed" ? "fixed" : edit.result === "waved" ? "old-repeat" : "false-positive");
    pill.textContent = EDIT_LABEL[edit.result] || edit.result;
    const where = document.createElement("span");
    where.className = "where";
    where.textContent = edit.file;
    top.append(pill, where);
    article.append(top);
    if (edit.result !== "waved" && edit.before !== edit.after) {
      const before = document.createElement("code");
      before.className = "src";
      before.textContent = edit.before;
      const after = document.createElement("code");
      after.className = "src";
      after.textContent = edit.after;
      article.append(before, after);
    } else {
      const p = document.createElement("p");
      p.textContent = "The line stayed as it was, so the next full pass can raise the same note.";
      article.append(p);
    }
    box.append(article);
  }
}

function renderFiles(cycle) {
  const box = $("files");
  box.replaceChildren();
  for (const file of filesIn(cycle.snapshot)) {
    const name = document.createElement("p");
    name.className = "file-name";
    name.textContent = file.name;
    const list = document.createElement("ol");
    list.className = "code";
    file.lines.forEach((line, index) => {
      const item = document.createElement("li");
      if (line.kind) item.classList.add(line.kind);
      if (line.bug) item.classList.add("has-bug");
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = String(index + 1);
      const src = document.createElement("span");
      src.className = "src";
      src.textContent = line.text;
      if (line.fresh) {
        const mark = document.createElement("span");
        mark.className = "mark";
        mark.textContent = " new";
        src.append(mark);
      }
      item.append(n, src);
      list.append(item);
    });
    box.append(name, list);
  }
}

function renderDetail() {
  const run = state.run;
  const cycle = run.cycles[state.index];
  $("round-title").textContent = "Round " + cycle.index + " of " + run.cycles.length;
  $("round-explain").textContent = explainCycle(cycle);
  renderFlags(cycle);
  renderEdits(cycle, run);
  renderFiles(cycle);
  $("prev").disabled = state.index <= 0;
  $("next").disabled = state.index >= run.cycles.length - 1;
  const live = explainOutcome(run) + " " + explainCycle(cycle);
  if ($("live").textContent !== live) $("live").textContent = live;
}

function renderRun() {
  const run = state.run;
  const outcome = $("outcome");
  outcome.className = outcomeClass(run);
  outcome.textContent = explainOutcome(run);
  renderMetrics(run);
  renderRounds(run);
  renderDetail();
}

function rerun(resetIndex) {
  stopPlay();
  state.run = runOnce(currentOptions());
  if (resetIndex) state.index = 0;
  if (state.index >= state.run.cycles.length) state.index = state.run.cycles.length - 1;
  renderControls();
  renderRun();
}

function select(index, fromUser) {
  if (fromUser) stopPlay();
  state.index = index;
  renderRounds(state.run);
  renderDetail();
}

function step(delta) {
  const next = state.index + delta;
  if (next < 0 || next >= state.run.cycles.length) {
    stopPlay();
    return;
  }
  select(next, false);
}

function togglePlay() {
  if (state.playing) {
    stopPlay();
    return;
  }
  if (state.index >= state.run.cycles.length - 1) state.index = 0;
  state.playing = true;
  $("play").textContent = "Pause";
  step(state.index === 0 ? 0 : 1);
  state.timer = window.setInterval(() => step(1), 850);
}

function sameSetup(options, preset) {
  return options.voters === preset.voters
    && options.threshold === preset.threshold
    && options.cap === preset.cap
    && options.diffOnly === preset.diffOnly;
}

function statList(summary) {
  const dl = document.createElement("dl");
  dl.className = "stats";
  const rows = [
    ["Merged", summary.merged + " / " + summary.trials],
    ["Hit round 16", String(summary.ceiling)],
    ["Stopped dirty at the cap", String(summary.capped)],
    ["Median rounds", String(summary.medianCycles)],
    ["Mean reviewer-minutes", summary.meanMinutes.toFixed(1)],
    ["Mean code edits", summary.meanCommits.toFixed(1)],
    ["Mean false alarms", summary.meanFalse.toFixed(1)],
    ["Flags on untouched lines", pct(summary.untouchedShare)],
    ["Introduced bugs per merge", summary.meanBugsShippedIfMerged == null ? "No merges" : summary.meanBugsShippedIfMerged.toFixed(2)],
    ["Bugs left in the branch", summary.meanBugsLeft.toFixed(2)],
  ];
  for (const [term, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  }
  return dl;
}

function trialCard(preset, summary, matched) {
  const card = document.createElement("article");
  card.className = "trial" + (matched ? " match" : "");
  const h = document.createElement("h3");
  h.textContent = preset.name;
  const detail = document.createElement("p");
  detail.className = "detail";
  detail.textContent = preset.detail + (matched ? " · matches this page" : "");
  const meter = document.createElement("div");
  meter.className = "meter";
  meter.setAttribute("role", "img");
  meter.setAttribute("aria-label", preset.name + " merged " + pct(summary.mergedRate));
  const fill = document.createElement("span");
  fill.style.width = pct(summary.mergedRate);
  meter.append(fill);
  card.append(h, detail, meter, statList(summary));
  return card;
}

function reading(rows) {
  const byId = Object.fromEntries(rows.map((row) => [row.preset.id, row.summary]));
  const open = byId.open;
  const cap = byId.cap;
  const diff = byId.diff;
  const vote = byId.vote;
  return "Out of " + open.trials + " shared seeds: no cap merged " + open.merged
    + " and was still flagged at round 16 on " + open.ceiling
    + ". Cap at 3 merged " + cap.merged + " and stopped dirty on " + cap.capped
    + ". Cap plus diff-only merged " + diff.merged + ", median " + diff.medianCycles + " rounds, "
    + diff.meanMinutes.toFixed(1) + " reviewer-minutes."
    + " A 2-of-3 vote on that same cap merged " + vote.merged
    + " with " + vote.meanFalse.toFixed(1) + " false alarms per pull, against "
    + diff.meanFalse.toFixed(1) + " without the vote. Three voters also multiply reviewer-minutes ("
    + vote.meanMinutes.toFixed(1) + " versus " + diff.meanMinutes.toFixed(1) + ").";
}

function renderTrials(rows) {
  const box = $("trial-cards");
  box.replaceChildren();
  for (const row of rows) box.append(trialCard(row.preset, row.summary, row.matched));
  const note = $("trial-reading");
  note.hidden = false;
  note.textContent = reading(rows);
}

function runComparison() {
  const button = $("trials");
  button.disabled = true;
  button.textContent = "Running…";
  window.setTimeout(() => {
    const options = currentOptions();
    const rows = PRESETS.map((preset) => ({
      preset,
      summary: runTrials(preset, 200, options.seed),
      matched: sameSetup(options, preset),
    }));
    if (!rows.some((row) => row.matched)) {
      rows.push({
        preset: {
          id: "page",
          name: "This page",
          detail: options.voters + " voters, threshold " + options.threshold
            + (options.cap ? ", cap " + options.cap : ", no cap")
            + (options.diffOnly ? ", diff-only" : ""),
        },
        summary: runTrials(options, 200, options.seed),
        matched: true,
      });
    }
    renderTrials(rows);
    button.disabled = false;
    button.textContent = "Run 200 trials";
  }, 30);
}

function renderModel() {
  const box = $("model");
  const paragraphs = [
    "Each voter draws an independent yes or no on every line in scope. A fresh real bug is caught about " + Math.round(MODEL.pRealFresh * 100) + "% of the time. The phone-number bug is harder, about 48%. The pre-existing clock bug is about 58%, and only on a full pass.",
    "Clean lines draw false alarms in proportion to how suspicious they look. A fresh line uses a higher rate than a line the author did not just change. The rates live in sim.js.",
    "The author always edits a real-bug flag. That edit clears the bug " + Math.round(MODEL.pFix * 100) + "% of the time. Otherwise the line changes and the bug stays, so a later pass can still see it.",
    "The author rewrites a false alarm " + Math.round(MODEL.pRewrite * 100) + "% of the time. About " + Math.round(MODEL.pChurn * 100) + "% of those rewrites, on lines that have a bad variant, introduce a new bug. The rest of the time the author leaves the line alone. The next full pass then raises that same note about " + Math.round(MODEL.pSticky * 100) + "% of the time per voter.",
    "With the cap off, every round reads all " + "31 lines. With diff-only on, rounds after the cap read only lines the author changed since the previous round. Untouched false alarms drop out of scope. So does any real bug nobody flagged during the full passes.",
    "Reviewer-minutes equal voters × (" + MODEL.minutesStartup + " + " + MODEL.minutesPerLine + " × lines looked at). A minute here is a toy unit, not a clock minute and not a dollar.",
    "The run stops at " + MODEL.maxCycles + " rounds even if flags remain. That ceiling is part of the demo. In the article, one pull request went past 50 rounds.",
  ];
  for (const text of paragraphs) {
    const p = document.createElement("p");
    p.textContent = text;
    box.append(p);
  }
}

function onCap(mode) {
  settings.capMode = mode;
  if (mode === "off") settings.diffOnly = false;
  rerun(true);
}

function wire() {
  $("voters-dec").addEventListener("click", () => { settings.voters -= 1; rerun(true); });
  $("voters-inc").addEventListener("click", () => { settings.voters += 1; rerun(true); });
  $("threshold-dec").addEventListener("click", () => { settings.threshold -= 1; rerun(true); });
  $("threshold-inc").addEventListener("click", () => { settings.threshold += 1; rerun(true); });
  $("cap-off").addEventListener("click", () => onCap("off"));
  $("cap-3").addEventListener("click", () => onCap("3"));
  $("cap-custom").addEventListener("click", () => onCap("custom"));
  $("cap-custom-n").addEventListener("change", () => {
    settings.capCustom = Number($("cap-custom-n").value);
    rerun(true);
  });
  $("diff-only").addEventListener("change", () => {
    settings.diffOnly = $("diff-only").checked;
    rerun(true);
  });
  $("seed").addEventListener("change", () => {
    settings.seed = Number($("seed").value);
    rerun(true);
  });
  $("shuffle").addEventListener("click", () => {
    settings.seed = 1 + Math.floor(Math.random() * 999998);
    rerun(true);
  });
  $("prev").addEventListener("click", () => { stopPlay(); step(-1); });
  $("next").addEventListener("click", () => { stopPlay(); step(1); });
  $("play").addEventListener("click", togglePlay);
  $("trials").addEventListener("click", runComparison);
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea")) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stopPlay();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      stopPlay();
      step(-1);
    }
  });
}

renderModel();
wire();
rerun(true);
