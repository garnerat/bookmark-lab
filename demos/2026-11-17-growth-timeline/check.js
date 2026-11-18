import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String, Array, Date, Boolean };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.GrowthTimeline;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + readFileSync(new URL("./model.js", import.meta.url), "utf8");

function stepMonths(options) {
  return Array.from(model.detectSteps(model.VISITS, options), (step) => model.MONTHS[step.index].id);
}

function stepIndexes(values, options) {
  return Array.from(model.detectSteps(values, options), (step) => step.index);
}

test("the lab index lists this demo after the previous day", () => {
  const previous = index.indexOf("demos/2026-11-16-moe-mac-fit/");
  const here = index.indexOf("demos/2026-11-17-growth-timeline/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-17: Growth timeline detective/);
  assert.match(card, /Riverbend Supply Co\./);
  assert.match(card, /camping/);
  assert.match(card, /coreyhainesco\/status\/2120509394224095603/);
  assert.match(card, /Source post/);
});

test("the page cites the post and labels the shop as fiction", () => {
  assert.match(page, /coreyhainesco\/status\/2120509394224095603/);
  assert.match(page, /Corey Haines/);
  assert.match(page, /Andrew bookmarked/);
  assert.match(page, /11 Nov 2026/);
  assert.match(page, /reverse-engineer-marketing/);
  assert.match(page, /monthly Google traffic and brand searches/);
  assert.match(page, /Riverbend Supply Co\./);
  assert.match(page, /camping and outdoor cookware/);
  assert.match(page, /fictional example data/i);
  assert.match(page, /does not run that skill/);
  assert.match(page, /Correlation isn't causation/);
  assert.match(page, /seasonality/i);
  assert.match(page, /web\.archive\.org/);
  assert.match(page, /sitemap\.xml/);
  assert.match(page, /facebook\.com\/ads\/library/);
  assert.match(page, /trends\.google\.com/);
  assert.match(page, /chatgpt\.com/);
  assert.match(page, /perplexity\.ai/);
  assert.match(page, /gemini\.google\.com/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.equal(model.SHOP, "Riverbend Supply Co.");
  assert.equal(model.POST.id, "2120509394224095603");
  assert.doesNotMatch(bundle, /HVAC|heating and cooling|air conditioning/i);
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|google-analytics|gtag\(/);
});

test("organic visits are the planted base times a repeating camping season", () => {
  assert.equal(model.MONTHS.length, 24);
  assert.equal(model.MONTHS[0].id, "2024-11");
  assert.equal(model.MONTHS[23].id, "2026-10");
  model.MONTHS.forEach((month) => {
    const expected = model.roundTo(model.baseLevel(month.index) * model.SEASON[month.calendarMonth], 50);
    assert.equal(month.visits, expected);
    assert.equal(model.VISITS[month.index], month.visits);
  });
  assert.equal(model.baseLevel(model.monthIndex("2025-04")), 5000);
  assert.equal(model.baseLevel(model.monthIndex("2026-04")), 8600);
  assert.equal(
    model.MONTHS[model.monthIndex("2025-04")].calendarMonth,
    model.MONTHS[model.monthIndex("2026-04")].calendarMonth
  );
  assert.equal(model.baseLevel(model.monthIndex("2025-08")), 5000);
  assert.equal(model.baseLevel(model.monthIndex("2025-09")), 8600);
  assert.equal(model.baseLevel(model.monthIndex("2026-07")), 8600);
  assert.equal(model.baseLevel(model.monthIndex("2026-08")), 15200);
});

test("default detection marks two springs and two planted shifts", () => {
  assert.deepEqual(stepMonths({ thresholdPct: 30, seasonal: false }), [
    "2025-04",
    "2025-09",
    "2026-04",
    "2026-08",
  ]);
  assert.deepEqual(stepMonths({ thresholdPct: 15, seasonal: false }), [
    "2025-04",
    "2025-09",
    "2026-04",
    "2026-08",
  ]);
  const december = model.assess(model.VISITS, model.monthIndex("2025-12"), { thresholdPct: 15, seasonal: false });
  assert.ok(december.rawChange > 0.5);
  assert.equal(december.holds, false);
  assert.equal(december.qualifies, false);
});

test("same-month-last-year shrinks the second spring and keeps the real shifts", () => {
  const april = model.monthIndex("2026-04");
  const raw = model.assess(model.VISITS, april, { thresholdPct: 30, seasonal: false });
  const adj = model.assess(model.VISITS, april, { thresholdPct: 30, seasonal: true });
  assert.ok(raw.change > 0.8);
  assert.equal(raw.qualifies, true);
  assert.equal(adj.seasonalApplied, true);
  assert.ok(adj.change < 0.05);
  assert.ok(adj.change < raw.change / 10);
  assert.equal(adj.qualifies, false);

  const august = model.monthIndex("2026-08");
  const augRaw = model.assess(model.VISITS, august, { thresholdPct: 30, seasonal: false });
  const augAdj = model.assess(model.VISITS, august, { thresholdPct: 30, seasonal: true });
  assert.ok(augAdj.change > augRaw.change);
  assert.equal(augAdj.qualifies, true);

  const september = model.assess(model.VISITS, model.monthIndex("2025-09"), { thresholdPct: 30, seasonal: true });
  assert.equal(september.seasonalApplied, false);
  assert.equal(september.qualifies, true);

  assert.deepEqual(stepMonths({ thresholdPct: 30, seasonal: true }), [
    "2025-04",
    "2025-09",
    "2026-08",
  ]);
});

test("a higher sensitivity is a subset of a lower one", () => {
  const low = stepMonths({ thresholdPct: 30, seasonal: false });
  const high = stepMonths({ thresholdPct: 60, seasonal: false });
  assert.deepEqual(high, ["2025-04", "2026-04"]);
  high.forEach((id) => assert.ok(low.includes(id)));
  assert.ok(low.length > high.length);
});

test("the job post is the only close candidate, and it drops out of a tighter window", () => {
  const april = model.monthIndex("2026-04");
  const wide = model.matchCandidates(april, model.EVENTS, { windowMonths: 1 });
  assert.deepEqual(Array.from(wide, (event) => event.id), ["job-warehouse"]);
  assert.equal(wide[0].type, "jobs");
  assert.equal(wide[0].monthDistance, 1);
  assert.equal(wide[0].dayDistance, 16);
  assert.equal(model.matchCandidates(april, model.EVENTS, { windowMonths: 0 }).length, 0);

  const hidden = model.matchCandidates(april, model.EVENTS, { windowMonths: 1, enabled: { jobs: false } });
  assert.equal(hidden.length, 0);

  const spring = model.monthIndex("2025-04");
  assert.equal(model.matchCandidates(spring, model.EVENTS, { windowMonths: 1 }).length, 0);
  const pulled = model.matchCandidates(spring, model.EVENTS, { windowMonths: 2 });
  assert.ok(pulled.some((event) => event.id === "headline-pack"));
  assert.ok(pulled.every((event) => event.monthDistance <= 2));
});

test("same-month events are ranked by closeness to the first of the month", () => {
  const august = model.matchCandidates(model.monthIndex("2026-08"), model.EVENTS, { windowMonths: 0 });
  assert.deepEqual(Array.from(august, (event) => event.id), [
    "price-kettle",
    "ads-kettle-on",
    "headline-price",
    "ai-kettle",
    "sitemap-compare",
  ]);
  for (let i = 1; i < august.length; i++) {
    assert.ok(august[i].dayDistance >= august[i - 1].dayDistance);
    assert.equal(august[i].monthDistance, 0);
  }
});

test("turning job posts off removes the candidate and leaves the step", () => {
  const on = model.analyze({ thresholdPct: 30, windowMonths: 1, seasonal: false });
  const off = model.analyze({ thresholdPct: 30, windowMonths: 1, seasonal: false, enabled: { jobs: false } });
  assert.deepEqual(on.steps.map((step) => step.monthId), off.steps.map((step) => step.monthId));
  const aprilOn = on.steps.find((step) => step.monthId === "2026-04");
  const aprilOff = off.steps.find((step) => step.monthId === "2026-04");
  assert.equal(aprilOn.candidates[0].id, model.COINCIDENCE_EVENT);
  assert.equal(aprilOff.candidates.length, 0);
  assert.equal(on.coincidence.inSteps, true);
  assert.equal(on.coincidence.eventId, "job-warehouse");
});

test("a repeated seasonal jump shrinks and a one-month spike does not count", () => {
  const pattern = [10, 10, 10, 10, 20, 20, 20, 10, 10, 10, 10, 10];
  const seasonal = pattern.concat(pattern);
  const raw = model.assess(seasonal, 16, { thresholdPct: 30, seasonal: false });
  const adj = model.assess(seasonal, 16, { thresholdPct: 30, seasonal: true });
  assert.ok(raw.change > 0.9);
  assert.ok(Math.abs(adj.change) < 0.01);
  assert.deepEqual(stepIndexes(seasonal, { thresholdPct: 30, seasonal: false }), [4, 16]);
  assert.deepEqual(stepIndexes(seasonal, { thresholdPct: 30, seasonal: true }), [4]);

  const level = Array(24).fill(100);
  for (let i = 18; i < 24; i++) level[i] = 180;
  assert.deepEqual(stepIndexes(level, { thresholdPct: 30, seasonal: true }), [18]);

  const spike = [100, 100, 100, 400, 100, 110, 105];
  assert.deepEqual(stepIndexes(spike, { thresholdPct: 30, seasonal: false }), []);

  const shift = [100, 100, 100, 180, 170, 175, 172];
  assert.deepEqual(stepIndexes(shift, { thresholdPct: 30, seasonal: false }), [3]);

  const lead = [100, 100, 100, 140, 220, 230, 225];
  assert.deepEqual(stepIndexes(lead, { thresholdPct: 30, seasonal: false }), [4]);
});
