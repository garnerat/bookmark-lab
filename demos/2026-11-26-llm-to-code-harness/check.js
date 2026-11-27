import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = {
    console,
    Math,
    Number,
    Object,
    String,
    Array,
    Boolean,
    JSON,
    isFinite
  };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.LlmToCodeLab;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function step(row, id) {
  return row.steps.filter(function (item) { return item.id === id; })[0];
}

test("the lab index lists this demo after the previous day", function () {
  const previous = index.indexOf("demos/2026-11-25-expert-tier-cache/");
  const here = index.indexOf("demos/2026-11-26-llm-to-code-harness/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-26: LLM-to-code harness/);
  assert.match(card, /Saltbox Kitchen/);
  assert.match(card, /fictional/);
  assert.match(card, /two-location/);
  assert.match(card, /_aj\/status\/2102061534956662818/);
  assert.match(card, /Source post/);
  assert.doesNotMatch(card, /HVAC|heating|cooling|furnace/i);
});

test("the page names the simulation, the restaurant, and the sources", function () {
  assert.match(page, /LLM-to-code harness/);
  assert.match(page, /Illustrative simulation/);
  assert.match(page, /Saltbox Kitchen/);
  assert.match(page, /East Market/);
  assert.match(page, /River Ward/);
  assert.match(page, /does not run Jev/);
  assert.match(page, /Illustrative numbers, not benchmarks/);
  assert.match(page, /\$0\.03/);
  assert.match(page, /1\.6 seconds/);
  assert.match(page, /8%/);
  assert.match(page, /What this sketch is doing/);
  assert.match(page, /Why the bill falls/);
  assert.match(page, /When it is dangerous/);
  assert.match(page, /Try it/);
  assert.match(page, /Run the quiet month/);
  assert.match(page, /Let a rule go stale/);
  assert.match(page, /Spot-check and demote/);
  assert.match(page, /Hale &amp; Brisket/);
  assert.match(page, /River &amp; Rind/);
  assert.match(page, /Linen &amp; Loom/);
  assert.match(page, /Millhouse/);
  assert.match(page, /Cork &amp; Cask/);
  assert.match(page, /chef coats/);
  assert.match(page, /Uniforms/);
  assert.match(page, /_aj\/status\/2102061534956662818/);
  assert.match(page, /agentrun\.ai/);
  assert.match(page, /agentrun-a-harness-for-repetitive-knowledge-work/);
  assert.match(page, /\$290K/);
  assert.match(page, /\$26K/);
  assert.match(page, /\$2\.89/);
  assert.match(page, /\$0\.25/);
  assert.match(page, /150 milliseconds/);
  assert.match(page, /Apache-2\.0/);
  assert.match(page, /Miguel Rios Berrios/);
  assert.match(page, /viewport-fit=cover/);
  assert.match(page, /<noscript>/);
  assert.match(page, /\$9\.60/);
  assert.match(page, /\$48\.00/);
  assert.match(page, /1,280/);
  assert.match(page, /0 of 61/);
  assert.match(page, /55 of 61/);
  assert.match(page, /\$16\.95/);
  assert.doesNotMatch(bundle, /HVAC|heating|cooling|furnace|air conditioning/i);
  assert.doesNotMatch(bundle, /sk-[A-Za-z0-9]|api[_-]?key|password\s*[:=]/i);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|WebSocket|innerHTML|localStorage/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket/);
});

test("styles stay phone-friendly", function () {
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /@media \(min-width: 800px\)/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(page, /viewport-fit=cover/);
});

test("external links stay on the documented set", function () {
  const urls = bundle.match(/https?:\/\/[^\s"'<>)]+/g) || [];
  assert.ok(urls.length >= 4);
  urls.forEach(function (url) {
    if (url === "http://www.w3.org/2000/svg") return;
    assert.match(url, /^https:\/\/(?:x\.com\/_aj\/status\/2102061534956662818|agentrun\.ai\/(?:blog\/agentrun-a-harness-for-repetitive-knowledge-work)?)(?:[),.]|$)/);
  });
});

test("the quiet month graduates five vendors and undercuts the all-model bill", function () {
  const run = model.run(model.PRESETS.quiet);
  const totals = run.totals;
  assert.equal(model.SALTBOX, "Saltbox Kitchen");
  assert.equal(model.LLM_CENTS, 3);
  assert.equal(model.STEPS.length, 5);
  assert.equal(run.count, 320);
  assert.equal(run.threshold, 8);
  assert.equal(run.surpriseAt, 0);
  assert.equal(totals.baselineCalls, 320 * 5);
  assert.equal(totals.baselineCents, 320 * 5 * 3);
  assert.equal(totals.llmCalls, 320);
  assert.equal(totals.avoided, 1280);
  assert.equal(totals.harnessCents, 960);
  assert.equal(totals.accuracy, 1);
  assert.equal(totals.catchTotal, 0);
  assert.equal(totals.catchRate, null);
  assert.equal(totals.demotions, 0);
  assert.equal(totals.graduations, 25);
  assert.ok(totals.harnessMs < totals.baselineMs);
  assert.equal(model.formatUsd(totals.harnessCents), "$9.60");
  assert.equal(model.formatUsd(totals.baselineCents), "$48.00");
  assert.equal(model.formatPct(null), "No jumps yet");
  assert.equal(run.rows[0].steps.every(function (item) { return item.via === "llm" && item.correct; }), true);
  model.VENDOR_IDS.forEach(function (vendor) {
    assert.equal(run.finalRules.price[vendor].mode, "code");
    assert.equal(run.finalRules.price[vendor].value, "clear");
    assert.equal(run.finalRules.vendor[vendor].mode, "code");
  });
  const odds = run.rows.filter(function (row) { return row.vendor === "odd"; });
  assert.equal(odds.length, 24);
  assert.equal(odds.every(function (row) {
    return row.steps.every(function (item) { return item.via === "llm" && item.correct; });
  }), true);
  assert.equal(Object.keys(run.finalRules.vendor).some(function (key) {
    return key.indexOf("odd-") === 0 && run.finalRules.vendor[key].mode === "code";
  }), false);
});

test("a stale rule misses every jump and files chef coats to linens", function () {
  const quiet = model.run(model.PRESETS.quiet);
  const stale = model.run(model.PRESETS.stale);
  const river = stale.rows.filter(function (row) { return row.surprise && row.vendor === "river"; })[0];
  const coats = stale.rows.filter(function (row) { return row.categoryBreak; })[0];
  const spike = stale.rows.filter(function (row) { return row.vendor === "hale" && row.spike; })[0];
  assert.equal(stale.surpriseAt, 144);
  assert.equal(stale.totals.harnessCents, quiet.totals.harnessCents);
  assert.equal(stale.totals.demotions, 0);
  assert.equal(stale.totals.catchHits, 0);
  assert.equal(stale.totals.catchTotal, 61);
  assert.equal(stale.totals.catchRate, 0);
  assert.ok(stale.totals.accuracy < 0.9);
  assert.equal(step(river, "price").via, "code");
  assert.equal(step(river, "price").emitted, "clear");
  assert.equal(step(river, "price").truth, "flag");
  assert.equal(step(river, "price").correct, false);
  assert.equal(step(river, "extract").correct, false);
  assert.equal(step(river, "map").truth, "produce+delivery");
  assert.equal(step(river, "map").emitted, "produce");
  assert.equal(step(river, "vendor").correct, true);
  assert.equal(step(river, "vendor").via, "code");
  assert.equal(step(coats, "map").emitted, "linens");
  assert.equal(step(coats, "map").truth, "uniforms");
  assert.equal(step(spike, "price").correct, false);
  assert.equal(step(spike, "route").emitted, "bookkeeper");
  assert.equal(step(spike, "route").truth, "manager");
  assert.match(river.blurb, /RR-TOM-ROMA/);
  assert.match(river.blurb, /12%/);
  assert.match(spike.blurb, /14%/);
  assert.match(spike.blurb, /\$4\.56/);
  assert.match(coats.blurb, /Uniforms/);
  assert.equal(stale.finalRules.price.hale.mode, "code");
  assert.equal(stale.finalRules.price.hale.value, "clear");
  assert.ok(stale.finalRules.price.hale.misses > 0);
  assert.ok(stale.finalRules.price.river.misses > 0);
  assert.ok(stale.finalRules.map.linen.misses > 0);
  assert.equal(stale.finalRules.map.linen.value, "linens");
  assert.equal(stale.rows[143].i, 144);
  assert.equal(stale.rows[143].events.some(function (event) { return event.kind === "surprise"; }), true);
  assert.equal(stale.rows[stale.rows.length - 1].board.price.stale, true);
  assert.equal(stale.rows[stale.rows.length - 1].board.vendor.stale, false);
  assert.match(stale.rows[stale.rows.length - 1].board.price.detail, /Still CODE, and wrong/);
  assert.match(stale.rows[stale.rows.length - 1].board.price.detail, /no flag|Hale & Brisket wrong|River & Rind wrong/);
  assert.match(stale.rows[stale.rows.length - 1].board.map.detail, /Linen & Loom wrong/);
  assert.match(stale.rows[stale.rows.length - 1].board.extract.detail, /River & Rind wrong/);
  assert.equal(quiet.rows[quiet.rows.length - 1].board.price.stale, false);
  assert.match(river.events.map(function (event) { return event.text; }).join(" "), /no flag/);
  assert.match(coats.events.map(function (event) { return event.text; }).join(" "), /Chef coats/);
});

test("a spot-check demotes a disagreeing rule and recovers the catch rate", function () {
  const stale = model.run(model.PRESETS.stale);
  const spot = model.run(model.PRESETS.spot);
  const quietCheck = model.run({ count: 320, threshold: 8, surprise: false, spotCheck: true, spotEvery: 10 });
  const firstDemote = spot.rows.filter(function (row) {
    return row.events.some(function (event) { return event.kind === "demote"; });
  })[0];
  const demotedSteps = firstDemote.steps.filter(function (item) { return item.demoted; });
  assert.equal(spot.totals.catchHits, 55);
  assert.equal(spot.totals.catchTotal, 61);
  assert.ok(spot.totals.catchRate > 0.8);
  assert.ok(spot.totals.catchRate > stale.totals.catchRate);
  assert.equal(spot.totals.demotions, 8);
  assert.ok(spot.totals.harnessCents > stale.totals.harnessCents);
  assert.equal(model.formatUsd(spot.totals.harnessCents), "$16.95");
  assert.ok(spot.totals.accuracy > stale.totals.accuracy);
  assert.equal(demotedSteps.length > 0, true);
  assert.equal(demotedSteps.every(function (item) { return item.via === "check" && item.correct; }), true);
  assert.equal(spot.finalRules.price.hale.mode, "llm");
  assert.ok(spot.finalRules.price.hale.demotions >= 1);
  assert.equal(spot.finalRules.price.river.mode, "code");
  assert.equal(spot.finalRules.price.river.value, "flag");
  assert.equal(spot.finalRules.price.river.misses, 0);
  assert.equal(spot.finalRules.extract.river.value, "layout-b");
  assert.equal(spot.finalRules.map.linen.value, "uniforms");
  assert.equal(spot.finalRules.map.river.value, "produce+delivery");
  assert.equal(quietCheck.totals.accuracy, 1);
  assert.equal(quietCheck.totals.demotions, 0);
  assert.ok(quietCheck.totals.harnessCents > model.run(model.PRESETS.quiet).totals.harnessCents);
  assert.match(firstDemote.events.map(function (event) { return event.text; }).join(" "), /back on the model/);
});

test("a higher graduation bar costs more and clamps the controls", function () {
  const low = model.run({ count: 320, threshold: 4, surprise: false, spotCheck: false, spotEvery: 10 });
  const high = model.run({ count: 320, threshold: 16, surprise: false, spotCheck: false, spotEvery: 10 });
  const careful = model.run({ count: 200, threshold: 20, surprise: true, spotCheck: false, spotEvery: 10 });
  const staleShort = model.run({ count: 200, threshold: 8, surprise: true, spotCheck: false, spotEvery: 10 });
  const carefulCoats = careful.rows.filter(function (row) { return row.categoryBreak; })[0];
  const staleCoats = staleShort.rows.filter(function (row) { return row.categoryBreak; })[0];
  assert.ok(high.totals.harnessCents > low.totals.harnessCents);
  assert.equal(low.totals.accuracy, 1);
  assert.equal(high.totals.accuracy, 1);
  assert.equal(high.totals.graduations, 25);
  assert.equal(staleShort.totals.catchHits, 0);
  assert.ok(staleShort.totals.catchTotal > 0);
  assert.ok(careful.totals.harnessCents > staleShort.totals.harnessCents);
  assert.equal(step(staleCoats, "map").correct, false);
  assert.equal(step(carefulCoats, "map").via, "llm");
  assert.equal(step(carefulCoats, "map").correct, true);
  assert.equal(careful.finalRules.map.linen.mode, "llm");
  assert.equal(model.run({ count: 5 }).count, 200);
  assert.equal(model.run({ count: 900 }).count, 500);
  assert.equal(model.run({ threshold: 1 }).threshold, 4);
  assert.equal(model.run({ threshold: 50 }).threshold, 20);
  assert.equal(model.formatSeconds(8000), "8.0 s");
  assert.equal(model.formatSeconds(1632), "1.6 s");
  assert.equal(model.formatPct(0), "0%");
  assert.equal(model.formatPct(55 / 61), "90%");
});
