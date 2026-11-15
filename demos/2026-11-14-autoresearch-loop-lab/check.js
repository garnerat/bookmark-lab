import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String, Set };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.AutoresearchLab;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function calls(mode, input) {
  return model.simulate(Object.assign({ mode: mode }, input)).rows.map((row) => row.tweakId + ":" + row.call);
}

test("the lab index lists this demo after the previous day", () => {
  const previous = index.indexOf("demos/2026-11-13-prefix-cache-lab/");
  const here = index.indexOf("demos/2026-11-14-autoresearch-loop-lab/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-14: Autoresearch loop lab/);
  assert.match(card, /Maple Street|neighborhood dental/);
  assert.match(card, /EXM7777\/status\/2120609647388479752/);
  assert.match(card, /Source post/);
  assert.doesNotMatch(card, /HVAC|law firm|roofing|plumbing/i);
});

test("the page cites the post, the repo, and the fiction", () => {
  assert.match(page, /EXM7777\/status\/2120609647388479752/);
  assert.match(page, /Andrew bookmarked/);
  assert.match(page, /Machina/);
  assert.match(page, /remember when Andrej Karpathy released autoresearch/);
  assert.match(page, /writes a check that can actually fail, first/);
  assert.match(page, /karpathy\/autoresearch/);
  assert.match(page, /Maple Street Dental/);
  assert.match(page, /fictional|fiction/);
  assert.match(page, /seed 20261121/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /Show next month's real no-shows/);
  assert.match(page, /Illustrative template/);
  assert.match(page, /Not copied from karpathy\/autoresearch/);
  assert.match(page, /You may edit only no-show\.js/);
  assert.match(page, /You may not edit check\.js/);
  assert.match(page, /node check\.js/);
  assert.match(page, /desk_score/);
  assert.match(page, /Higher is better/);
  assert.match(page, /git reset --hard/);
  assert.match(page, /A tie is a discard/);
  assert.match(page, /5 minutes/);
  assert.match(page, /val_bpb/);
  assert.match(page, /prepare\.py/);
  assert.match(page, /train\.py/);
  assert.match(page, /program\.md/);
  assert.equal(model.SOURCE.postId, "2120609647388479752");
  assert.equal(model.SEED, 20261121);
});

test("the page stays local and off the forbidden trades", () => {
  assert.doesNotMatch(bundle, /HVAC|law firm|roofing|plumbing/i);
  assert.doesNotMatch(app + source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
  assert.doesNotMatch(page, /src="https?:|fonts\.googleapis|cdn\.|unpkg|jsdelivr/);
  assert.match(page, /src="\.\/model\.js"/);
  assert.match(page, /src="\.\/app\.js"/);
  assert.match(page, /href="\.\/styles\.css"/);
  assert.doesNotMatch(bundle, /api[_-]?key|secret|password|token/i);
});

test("controls, speed, and reduced motion are wired", () => {
  assert.match(page, /id="minutes"[^>]*min="1"[^>]*max="60"[^>]*step="1"[^>]*value="5"/);
  assert.match(page, /id="hours"[^>]*min="1"[^>]*max="12"[^>]*value="8"/);
  assert.match(page, /id="mode-locked"/);
  assert.match(page, /id="mode-self"/);
  assert.match(page, /id="mode-leaky"/);
  assert.match(page, /id="run"/);
  assert.match(page, /id="step"/);
  assert.match(page, /id="reset"/);
  assert.match(page, /id="speed-slow"/);
  assert.match(page, /id="speed-fast"/);
  assert.match(page, /id="reveal"/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.equal(model.SPEED_MS.normal, 520);
  assert.equal(model.DEFAULTS.minutes, 5);
  assert.equal(model.DEFAULTS.hours, 8);
  assert.equal(model.SEQUENCES.locked.join(","), "prior,opened,monday,rain,lower,memorize,trust,leak");
  assert.equal(model.SEQUENCES.self.join(","), "prior,opened,monday,memorize,trust");
  assert.equal(model.SEQUENCES.leaky.join(","), "prior,opened,monday,rain,lower,leak");
});

test("the budget counts how many fixed-length experiments fit", () => {
  assert.equal(model.experimentsThatFit(5, 8), 96);
  assert.equal(model.experimentsThatFit(5, 1), 12);
  assert.equal(model.experimentsThatFit(60, 1), 1);
  assert.equal(model.experimentsThatFit(15, 1), 4);
  assert.equal(model.experimentsThatFit(90, 99), 12);
  const full = model.simulate();
  assert.equal(full.budget.fit, 96);
  assert.equal(full.budget.played, 8);
  assert.equal(full.budget.perHour, 12);
  assert.equal(full.budget.truncated, false);
  const short = model.simulate({ minutes: 60, hours: 1, mode: "leaky" });
  assert.equal(short.budget.fit, 1);
  assert.equal(short.budget.played, 1);
  assert.equal(short.budget.truncated, true);
  assert.equal(short.rows.map((row) => row.tweakId).join(","), "baseline,prior");
  assert.equal(short.rows[1].call, "KEEP");
});

test("the same seed replays the same morning log", () => {
  assert.equal(JSON.stringify(model.simulate()), JSON.stringify(model.simulate()));
  assert.equal(
    JSON.stringify(model.simulate({ mode: "self", minutes: 5, hours: 8 })),
    JSON.stringify(model.simulate({ mode: "self", hours: 8, minutes: 5 }))
  );
  const weird = model.simulate({ mode: "nope", minutes: "nope", hours: null });
  assert.equal(weird.input.mode, "locked");
  assert.equal(weird.input.minutes, 5);
  assert.equal(weird.input.hours, 8);
});

test("a locked hold-out keeps the real features and discards the rest", () => {
  const run = model.simulate({ mode: "locked" });
  assert.equal(calls("locked").join("|"), [
    "baseline:START",
    "prior:KEEP",
    "opened:KEEP",
    "monday:KEEP",
    "rain:DISCARD",
    "lower:DISCARD",
    "memorize:DISCARD",
    "trust:DISCARD",
    "leak:DISCARD",
  ].join("|"));
  assert.equal(run.summary.keeps, 3);
  assert.equal(run.summary.discards, 5);
  assert.equal(run.summary.baselineReported, 17.1);
  assert.equal(run.summary.finalReported, 24.6);
  assert.equal(run.summary.baselineFresh, 10.8);
  assert.equal(run.summary.finalFresh, 18.8);
  assert.equal(run.summary.freshMonotonic, true);
  assert.ok(run.summary.finalReported > run.summary.baselineReported);
  assert.ok(run.summary.finalFresh > run.summary.baselineFresh);
  const monday = run.rows[3];
  const opened = run.rows[2];
  assert.ok(monday.bestReported - opened.bestReported < 1);
  const memorize = run.rows.find((row) => row.tweakId === "memorize");
  assert.equal(memorize.reported, memorize.bestReported);
  assert.equal(memorize.call, "DISCARD");
  assert.equal(run.reference.flagAll, 12.3);
  assert.ok(run.reference.flagAll + 3 < run.summary.baselineReported);
  assert.equal(run.reference.flagNone, 0);
  assert.equal(run.reference.penalty, 0.5);
});

test("a self-graded check passes every round and next month falls", () => {
  const run = model.simulate({ mode: "self" });
  assert.equal(run.summary.allKept, true);
  assert.equal(run.summary.discards, 0);
  assert.equal(run.summary.reportedClimb, true);
  assert.equal(run.rows[0].reported, 15.4);
  assert.equal(run.summary.finalReported, 41.9);
  const memorize = run.rows.find((row) => row.tweakId === "memorize");
  const before = run.rows[memorize.round - 1];
  assert.equal(memorize.call, "KEEP");
  assert.equal(memorize.bestFresh, before.bestFresh);
  assert.ok(memorize.bestReported > before.bestReported + 3);
  const trust = run.rows.find((row) => row.tweakId === "trust");
  assert.equal(trust.call, "KEEP");
  assert.equal(trust.bestFresh, 0);
  assert.ok(trust.bestReported > memorize.bestReported);
  assert.equal(run.summary.finalFresh, 0);
  assert.ok(run.summary.finalFresh < before.bestFresh);
});

test("a leaky check jumps on the empty chair and collapses next month", () => {
  const run = model.simulate({ mode: "leaky" });
  assert.equal(calls("leaky").join("|"), [
    "baseline:START",
    "prior:KEEP",
    "opened:KEEP",
    "monday:KEEP",
    "rain:DISCARD",
    "lower:DISCARD",
    "leak:KEEP",
  ].join("|"));
  const leak = run.rows.find((row) => row.tweakId === "leak");
  const before = run.rows[leak.round - 1];
  assert.equal(before.bestReported, 24.6);
  assert.equal(before.bestFresh, 18.8);
  assert.equal(leak.reported, 41.5);
  assert.ok(leak.reported - before.bestReported > 12);
  assert.equal(leak.bestFresh, 0);
  assert.equal(run.summary.finalFresh, 0);
  assert.ok(run.summary.discards >= 1);
  assert.ok(before.bestFresh > run.summary.baselineFresh);
});

test("samples are fictional chart numbers from the editable pile", () => {
  const run = model.simulate();
  assert.equal(run.samples.length, 4);
  run.samples.forEach((row) => {
    assert.match(row.id, /^M-\d+$/);
    assert.ok(row.visit.length > 0);
    assert.equal(typeof row.noShow, "boolean");
  });
  assert.ok(run.reference.holdMisses.rate > 30);
  assert.equal(model.COUNT, 260);
});
