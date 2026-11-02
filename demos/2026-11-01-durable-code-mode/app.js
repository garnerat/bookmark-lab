import { getJob, listJobs, matchedJobs } from "./data.js";
import {
  IDEMPOTENCY_KEY,
  beat,
  bookFollowup,
  callLabel,
  canonicalCrash,
  comparisonFrames,
  crash,
  freshRun,
  pendingCalls,
  resume,
  runToEnd,
  scriptSource,
  stats,
  utf8Bytes,
} from "./sim.js";

const numbers = stats();
const frames = comparisonFrames();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ui = {
  frame: frames.length - 1,
  playing: false,
  parallel: false,
  policy: "safe",
  change: "nothing",
  run: null,
  playingRun: false,
  resumed: false,
  bookPolicy: "unsafe",
  bookKey: true,
};

let compareTimer = 0;
let runTimer = 0;

const live = document.getElementById("live");
const compareMount = document.getElementById("compare");
const replayMount = document.getElementById("replay");
const bookingMount = document.getElementById("booking");

function say(text) {
  if (live) live.textContent = text;
}

function num(value) {
  return value.toLocaleString("en-US");
}

function money(cents) {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}$${num(dollars)}.${rest}`;
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === "class") node.className = value;
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false && value != null) node.setAttribute(key, String(value));
  }
  for (const child of children || []) node.append(child);
  return node;
}

function text(tag, className, value, attrs) {
  const node = el(tag, { ...attrs, class: className });
  node.textContent = value;
  return node;
}

function button(label, className, onClick, extra) {
  const node = el("button", { type: "button", class: className, ...extra });
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function segment(label, options, current, onPick) {
  const group = el("div", { class: "toggle" });
  group.append(text("p", "control-label", label));
  const row = el("div", { class: "segment", role: "group", "aria-label": label });
  for (const option of options) {
    const pressed = option.id === current;
    const node = button(option.label, "", () => onPick(option.id), { "aria-pressed": pressed ? "true" : "false" });
    row.append(node);
  }
  group.append(row);
  if (options.find((option) => option.id === current)?.hint) {
    group.append(text("p", "hint", options.find((option) => option.id === current).hint));
  }
  return group;
}

function stopCompare() {
  window.clearInterval(compareTimer);
  compareTimer = 0;
  ui.playing = false;
}

function stopRun() {
  window.clearInterval(runTimer);
  runTimer = 0;
  ui.playingRun = false;
}

function renderCompare() {
  const frame = frames[ui.frame];
  const max = numbers.directBytes;
  compareMount.replaceChildren();

  const controls = el("div", { class: "dock-row" });
  controls.append(
    button(ui.playing ? "Stop" : "Watch the steps", "", () => {
      if (ui.playing) {
        stopCompare();
        renderCompare();
        return;
      }
      if (ui.frame >= frames.length - 1) ui.frame = 0;
      ui.playing = true;
      renderCompare();
      if (reduceMotion) {
        ui.frame = frames.length - 1;
        stopCompare();
        renderCompare();
        say(frames.at(-1).note);
        return;
      }
      compareTimer = window.setInterval(() => {
        if (ui.frame >= frames.length - 1) {
          stopCompare();
          renderCompare();
          say(frames.at(-1).note);
          return;
        }
        ui.frame += 1;
        renderCompare();
      }, 280);
    }),
    button("Step", "secondary", () => {
      stopCompare();
      ui.frame = ui.frame >= frames.length - 1 ? 0 : ui.frame + 1;
      renderCompare();
      say(frames[ui.frame].note);
    }),
    button("Back", "secondary", () => {
      stopCompare();
      ui.frame = Math.max(0, ui.frame - 1);
      renderCompare();
      say(frames[ui.frame].note);
    }),
  );
  compareMount.append(controls);

  const pair = el("div", { class: "pair" });
  pair.append(metricCard("Direct calls", [
    [frame.directTurns, "Model turns"],
    [`${num(frame.directBytes)} B`, "Tool output in context"],
    [`~${num(frame.directTokens)}`, "Rough tokens"],
  ], "direct"));
  pair.append(metricCard("Code mode", [
    [frame.codeTurns, "Model turns"],
    [`${num(frame.codeBytes)} B`, "Tool output in context"],
    [`~${num(frame.codeTokens)}`, "Rough tokens"],
  ], "code"));
  compareMount.append(pair);

  compareMount.append(barRow("Direct calls", frame.directBytes, max));
  compareMount.append(barRow("Code mode", frame.codeBytes, max));
  compareMount.append(text(
    "p",
    "caption",
    `Step ${frame.step} of ${numbers.directTools}. The bar is scaled to this demo’s direct-mode tool output (${num(max)} bytes), not to a real context window. Tokens are bytes ÷ 4, a rough estimate.`,
  ));
  compareMount.append(text("p", "event", frame.note));
  compareMount.append(text(
    "p",
    "caption",
    `Counted from these jobs: ${numbers.pages} list pages are ${num(numbers.listBytes)} bytes, ${numbers.matches} job details are ${num(numbers.getBytes)} bytes, and the script’s print is ${num(numbers.codeBytes)} bytes. Sandbox lookups: ${frame.sandboxCalls} of ${frame.sandboxTotal}. Those lookups are real either way. Only the direct path writes them into the model.`,
  ));

  compareMount.append(answerTable(numbers.tally, "Both modes return this. It is totaled from the matching jobs."));
  compareMount.append(samplePayloads());
}

function metricCard(title, rows, kind) {
  const card = el("article", { class: `metric-card ${kind}` });
  card.append(text("h3", "", title));
  for (const [value, label] of rows) {
    const line = el("p", { class: "metric-line" });
    line.append(text("strong", "", String(value)));
    line.append(text("span", "", label));
    card.append(line);
  }
  return card;
}

function barRow(label, bytes, max) {
  const pct = max === 0 ? 0 : (bytes / max) * 100;
  const row = el("div", { class: "bar-row" });
  row.append(text("span", "bar-label", label));
  const track = el("div", {
    class: "bar",
    role: "img",
    "aria-label": `${label}: ${num(bytes)} bytes, ${pct.toFixed(1)} percent of the direct-mode tool output`,
  });
  const fill = el("span", { class: bytes > 0 ? "bar-fill on" : "bar-fill" });
  fill.style.width = `${Math.min(100, pct)}%`;
  track.append(fill);
  row.append(track);
  row.append(text("span", "bar-value", `${num(bytes)} B`));
  return row;
}

function answerTable(rows, caption) {
  const wrap = el("div", { class: "answer" });
  wrap.append(text("h3", "", "Per crew"));
  wrap.append(text("p", "caption", caption));
  const table = el("table", { class: "totals" });
  const head = el("tr");
  for (const label of ["Crew", "Jobs", "Callbacks", "Parts"]) head.append(text("th", "", label, { scope: "col" }));
  table.append(el("thead", {}, [head]));
  const body = el("tbody");
  let jobs = 0;
  let callbacks = 0;
  let cents = 0;
  for (const row of rows) {
    jobs += row.jobs;
    callbacks += row.callbacks;
    cents += row.partsCents;
    const tr = el("tr");
    tr.append(text("th", "", row.crew, { scope: "row" }));
    tr.append(text("td", "", String(row.jobs)));
    tr.append(text("td", "", String(row.callbacks)));
    tr.append(text("td", "", money(row.partsCents)));
    body.append(tr);
  }
  const total = el("tr", { class: "total" });
  total.append(text("th", "", "All crews", { scope: "row" }));
  total.append(text("td", "", String(jobs)));
  total.append(text("td", "", String(callbacks)));
  total.append(text("td", "", money(cents)));
  body.append(total);
  table.append(body);
  wrap.append(table);
  return wrap;
}

function samplePayloads() {
  const match = matchedJobs()[0];
  const summary = listJobs(1).jobs[0];
  const detail = getJob(match.id);
  const box = el("details", { class: "more" });
  box.append(text("summary", "", "Sample payloads these bytes are counted from"));
  box.append(text("p", "caption", `A list row is ${num(utf8Bytes(summary))} bytes. A job detail is ${num(utf8Bytes(detail))} bytes. Bytes are the UTF-8 length of JSON.stringify on the tool result.`));
  box.append(text("p", "caption", "list_jobs, first row"));
  box.append(text("pre", "", JSON.stringify(summary, null, 2)));
  box.append(text("p", "caption", `get_job ${detail.id}`));
  box.append(text("pre", "", JSON.stringify(detail, null, 2)));
  return box;
}

function renderReplay() {
  const run = ui.run;
  const result = ui.resumed && run && run.stage === "crashed" ? safeResume(run) : null;
  replayMount.replaceChildren();

  replayMount.append(segment("get_job replay policy", [
    { id: "safe", label: "Safe", hint: "A read may run again if the crash cut it off. list_jobs is always safe." },
    { id: "unsafe", label: "Unsafe", hint: "The article’s default. An in-flight call becomes an error and is not sent again." },
  ], ui.policy, (id) => {
    ui.policy = id;
    renderReplay();
    if (result) say(outcomeSpeech(safeResume(ui.run)));
  }));

  replayMount.append(segment("How the script calls tools", [
    { id: "sequential", label: "One by one" },
    { id: "parallel", label: "Promise.all" },
  ], ui.parallel ? "parallel" : "sequential", (id) => {
    const parallel = id === "parallel";
    if (parallel === ui.parallel) return;
    ui.parallel = parallel;
    stopRun();
    ui.run = null;
    ui.resumed = false;
    renderReplay();
  }));

  replayMount.append(segment("What changed before resume", [
    { id: "nothing", label: "Nothing" },
    { id: "script", label: "Edit the script" },
    { id: "sandbox", label: "Change the sandbox" },
    { id: "data", label: "Change underlying data" },
  ], ui.change, (id) => {
    ui.change = id;
    renderReplay();
    if (ui.resumed && ui.run) say(outcomeSpeech(safeResume(ui.run)));
  }));

  const controls = el("div", { class: "dock-row wrap" });
  controls.append(
    button("Run", "", () => startRun()),
    button("Crash now", "secondary", () => crashNow(), { disabled: run && run.stage === "crashed" ? true : false }),
    button("Resume", "", () => {
      if (!ui.run || ui.run.stage !== "crashed") return;
      ui.resumed = true;
      const next = safeResume(ui.run);
      renderReplay();
      say(outcomeSpeech(next));
    }, { disabled: !(run && run.stage === "crashed") }),
    button("Step", "secondary", () => stepRun()),
    button("Reset", "secondary", () => {
      stopRun();
      ui.run = null;
      ui.resumed = false;
      renderReplay();
    }),
  );
  replayMount.append(controls);

  if (!run) {
    replayMount.append(text("p", "event", "Run plays the script to the end. Crash now, from here, stops in the middle with part of the journal already saved. During Run or Step, Crash now kills the call in flight."));
  } else if (run.stage === "done") {
    replayMount.append(text("p", "event", "The script finished, so there is nothing to resume. Crash now loads a mid-script crash of this same script."));
  } else if (run.stage === "crashed" && !ui.resumed) {
    replayMount.append(text("p", "event", `Crashed with ${run.inFlight.length} call${run.inFlight.length === 1 ? "" : "s"} in flight. Finished calls are in the journal. Press Resume.`));
  } else if (ui.playingRun) {
    const current = run.inFlight[0];
    replayMount.append(text("p", "event", current ? `In flight: ${callLabel(current)}` : "Running inside the sandbox."));
  }

  replayMount.append(changeNote(run));
  if (result) replayMount.append(outcomeCard(result));
  else if (run && run.stage === "crashed") replayMount.append(crashCard(run));

  replayMount.append(text("h3", "script-title", ui.parallel ? "Script, Promise.all" : "Script, one call at a time"));
  replayMount.append(text("pre", "script", scriptSource(ui.parallel)));
  replayMount.append(journal(run, result));
}

function safeResume(run) {
  return resume(run, { getJobPolicy: ui.policy, change: ui.change });
}

function startRun() {
  stopRun();
  ui.resumed = false;
  ui.run = freshRun(ui.parallel);
  if (reduceMotion) {
    ui.run = runToEnd(ui.parallel);
    renderReplay();
    return;
  }
  ui.playingRun = true;
  renderReplay();
  runTimer = window.setInterval(() => {
    if (!ui.run || ui.run.stage === "done" || ui.run.stage === "crashed") {
      stopRun();
      renderReplay();
      return;
    }
    ui.run = beat(ui.run);
    renderReplay();
    if (ui.run.stage === "done") stopRun();
  }, 220);
}

function crashNow() {
  if (ui.run && ui.run.stage !== "done" && ui.run.stage !== "crashed") {
    stopRun();
    ui.resumed = false;
    ui.run = crash(ui.run);
    renderReplay();
    say(`Crashed with ${ui.run.inFlight.length} calls in flight.`);
    return;
  }
  stopRun();
  ui.resumed = false;
  ui.run = canonicalCrash(ui.parallel);
  renderReplay();
  say(`Crashed with ${ui.run.inFlight.length} calls in flight.`);
}

function stepRun() {
  stopRun();
  if (!ui.run || ui.run.stage === "done" || ui.run.stage === "crashed") {
    ui.resumed = false;
    ui.run = freshRun(ui.parallel);
  }
  ui.resumed = false;
  ui.run = beat(ui.run);
  renderReplay();
}

function changeNote(run) {
  if (ui.change === "script") {
    const gets = (run || freshRun(ui.parallel)).gets;
    const forward = gets[0]?.args.id;
    const backward = gets.at(-1)?.args.id;
    return text("p", "hint", `The edited script still lists the pages in order, then opens jobs from ${backward} back to ${forward}. Resume errors when that order disagrees with the journal.`);
  }
  if (ui.change === "sandbox") {
    return text("p", "hint", "The sandbox heap limit changes from 256 MiB to 128 MiB. The virtual clock, random seed, and UTC zone would have to match too. Set get_job to safe to see this error on its own.");
  }
  if (ui.change === "data") {
    return text("p", "hint", "Before resume, one finished job and one job the script has not locked in yet each gain a callback. Replay does not compare the books with the journal.");
  }
  return text("p", "hint", "Nothing about the script, the sandbox, or the jobs changes. Resume should keep going from the journal.");
}

function crashCard(run) {
  const card = el("div", { class: "outcome crash" });
  card.append(text("h3", "", "Crashed mid-script"));
  card.append(text("p", "", `${run.journal.length} calls are in the journal. ${run.inFlight.length} ${run.inFlight.length === 1 ? "is" : "are"} in flight: the server may have finished ${run.inFlight.length === 1 ? "it" : "them"}, and the script has not seen ${run.inFlight.length === 1 ? "the result" : "those results"}. ${pendingCalls(run).length} calls have not been sent.`));
  card.append(text("p", "caption", "Duplicate calls at the server so far: 0. Press Resume to see what gets sent again."));
  return card;
}

function outcomeCard(result) {
  const card = el("div", { class: `outcome ${result.outcome}` });
  card.append(text("h3", "", outcomeTitle(result)));
  card.append(text("p", "", result.detail));
  const counts = el("div", { class: "pair compact" });
  counts.append(miniStat(String(result.duplicates.length), "Duplicate calls at the server"));
  counts.append(miniStat(String(result.finishedRerun), "Finished calls sent again"));
  card.append(counts);
  card.append(text("p", "caption", `First run reached the server ${num(result.firstRunServerCalls)} times (${num(result.journaled)} journaled, ${num(result.inFlight)} in flight). Resume sent ${num(result.duplicates.length)} of those again${result.discarded ? " and discarded the new results" : ""}. New calls on resume: ${num(result.firstTime.length)}.`));
  if (result.rows) card.append(compareTotals(result));
  if (result.outcome === "wrong") card.append(editList(result.edits));
  return card;
}

function miniStat(value, label) {
  const card = el("article", { class: "metric-card" });
  const line = el("p", { class: "metric-line" });
  line.append(text("strong", "", value));
  line.append(text("span", "", label));
  card.append(line);
  return card;
}

function outcomeTitle(result) {
  if (result.outcome === "correct") return "Resumed. The total matches.";
  if (result.outcome === "interrupted") return "Resume stopped on the in-flight call.";
  if (result.outcome === "divergence") return "Resume stopped. The script diverged.";
  if (result.outcome === "sandbox") return "Resume stopped. The sandbox changed.";
  return "Wrong total. No error was raised.";
}

function outcomeSpeech(result) {
  return `${outcomeTitle(result)} ${result.duplicates.length} duplicate calls. ${result.finishedRerun} finished calls sent again.`;
}

function compareTotals(result) {
  const wrap = el("div", { class: "answer" });
  wrap.append(text("h3", "", result.silentWrong ? "Script total versus the books now" : "Script total"));
  const table = el("table", { class: "totals" });
  const head = el("tr");
  for (const label of ["Crew", "Script", "Books", "Parts"]) {
    head.append(text("th", "", label, { scope: "col" }));
  }
  table.append(el("thead", {}, [head]));
  const body = el("tbody");
  let scriptCallbacks = 0;
  let liveCallbacks = 0;
  let cents = 0;
  for (const row of result.rows) {
    const tr = el("tr", { class: row.differ ? "differ" : "" });
    tr.append(text("th", "", row.crew, { scope: "row" }));
    const scriptCell = text("td", "", row.differ ? `${row.scriptCallbacks} stale` : String(row.scriptCallbacks));
    const liveCell = text("td", "", String(row.liveCallbacks));
    if (row.differ) {
      scriptCell.classList.add("stale");
      liveCell.classList.add("stale");
    }
    scriptCallbacks += row.scriptCallbacks;
    liveCallbacks += row.liveCallbacks;
    cents += row.scriptCents;
    tr.append(scriptCell, liveCell, text("td", "", money(row.scriptCents)));
    body.append(tr);
  }
  const total = el("tr", { class: result.silentWrong ? "total differ" : "total" });
  total.append(text("th", "", "All crews", { scope: "row" }));
  const scriptTotal = text("td", "", result.silentWrong ? `${scriptCallbacks} stale` : String(scriptCallbacks));
  const liveTotal = text("td", "", String(liveCallbacks));
  if (result.silentWrong) {
    scriptTotal.classList.add("stale");
    liveTotal.classList.add("stale");
  }
  total.append(scriptTotal, liveTotal, text("td", "", money(cents)));
  body.append(total);
  table.append(body);
  wrap.append(table);
  if (result.silentWrong) {
    wrap.append(text("p", "caption", "Stale marks the crews where the script and the books disagree. Parts did not change. The script still returned a total."));
  }
  return wrap;
}

function editList(edits) {
  const list = el("ul", { class: "edits" });
  for (const edit of edits) {
    const item = el("li");
    if (edit.kind === "journaled") {
      item.textContent = `${edit.id} (crew ${edit.crew}) was already journaled at ${edit.from} callbacks. The books now say ${edit.to}. The script kept ${edit.from}.`;
    } else {
      item.textContent = `${edit.id} (crew ${edit.crew}) was read after resume. The script saw ${edit.to}, the new number. It was ${edit.from} at the crash.`;
    }
    list.append(item);
  }
  return list;
}

function journal(run, result) {
  const wrap = el("div", { class: "journal" });
  wrap.append(text("h3", "", "Journal"));
  if (!run) {
    wrap.append(text("p", "caption", "The journal fills as each tool result is saved, before the script sees it."));
    return wrap;
  }
  const list = el("ol", { class: "journal-list" });
  const journalIds = new Set(run.journal.map((call) => call.id));
  const flightIds = new Set(run.inFlight.map((call) => call.id));
  const duplicateIds = new Set((result?.duplicates || []).map((call) => call.id));
  const firstIds = new Set((result?.firstTime || []).map((call) => call.id));
  const calls = run.lists.concat(run.gets);
  calls.forEach((call, index) => {
    const item = el("li", { class: rowClass(call, journalIds, flightIds, duplicateIds, firstIds, result) });
    const name = el("span", { class: "j-name" });
    name.textContent = `${index + 1}. ${callLabel(call)}`;
    const pill = text("span", "pill", rowStatus(call, journalIds, flightIds, duplicateIds, firstIds, result));
    item.append(name, pill);
    list.append(item);
  });
  wrap.append(list);
  return wrap;
}

function rowClass(call, journalIds, flightIds, duplicateIds, firstIds, result) {
  if (duplicateIds.has(call.id)) return result?.discarded ? "discarded" : "replayed";
  if (firstIds.has(call.id)) return "fresh";
  if (journalIds.has(call.id)) return "saved";
  if (flightIds.has(call.id)) return "flight";
  return "waiting";
}

function rowStatus(call, journalIds, flightIds, duplicateIds, firstIds, result) {
  if (duplicateIds.has(call.id)) return result?.discarded ? "Sent again, discarded" : "Sent again";
  if (firstIds.has(call.id)) return "First send";
  if (journalIds.has(call.id)) return result ? "Saved, not sent again" : "Journaled";
  if (flightIds.has(call.id)) {
    if (result?.outcome === "interrupted") return "Interrupted";
    return "In flight";
  }
  if (result && (result.outcome === "interrupted" || result.outcome === "divergence" || result.outcome === "sandbox")) {
    return "Not sent";
  }
  return "Not sent";
}

function renderBooking() {
  const result = bookFollowup({ policy: ui.bookPolicy, useKey: ui.bookKey });
  bookingMount.replaceChildren();
  bookingMount.append(segment("book_followup_visit replay policy", [
    { id: "unsafe", label: "Unsafe" },
    { id: "safe", label: "Safe" },
  ], ui.bookPolicy, (id) => {
    ui.bookPolicy = id;
    renderBooking();
    say(`${bookFollowup({ policy: ui.bookPolicy, useKey: ui.bookKey }).headline} ${bookFollowup({ policy: ui.bookPolicy, useKey: ui.bookKey }).visits} visits.`);
  }));
  bookingMount.append(segment("Idempotency key", [
    { id: "on", label: "Send the key" },
    { id: "off", label: "No key" },
  ], ui.bookKey ? "on" : "off", (id) => {
    ui.bookKey = id === "on";
    renderBooking();
  }));

  const keyLine = ui.bookKey ? `,\n  idempotency_key: "${IDEMPOTENCY_KEY}"` : "";
  bookingMount.append(text("pre", "script", `await tools.book_followup_visit({\n  month: "2026-10",\n  reason: "warranty callback review"${keyLine}\n});`));

  const card = el("div", { class: `outcome ${result.outcome === "double" ? "wrong" : result.outcome}` });
  card.append(text("h3", "", result.headline));
  card.append(text("p", "", result.detail));
  const visits = String(result.visits);
  const visitLabel = result.uncertain
    ? "Visits if the first attempt landed"
    : (result.automaticRetry ? "Visits after an automatic retry" : "Visits, with no automatic retry");
  card.append(miniStat(visits, visitLabel));
  bookingMount.append(card);
}

function bootCounts() {
  const slot = document.getElementById("board-count");
  if (!slot) return;
  slot.textContent = `${num(numbers.shopJobs)} jobs are on the board. ${num(numbers.matches)} are completed, tagged warranty, and closed in October 2026.`;
}

bootCounts();
renderCompare();
renderReplay();
renderBooking();
