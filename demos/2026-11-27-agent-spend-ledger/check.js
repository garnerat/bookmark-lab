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
  return context.SpendLedger;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function sum(list, key) {
  return list.reduce(function (total, item) { return total + item[key]; }, 0);
}

test("the lab index lists this demo after the previous day", function () {
  const previous = index.indexOf("demos/2026-11-26-llm-to-code-harness/");
  const here = index.indexOf("demos/2026-11-27-agent-spend-ledger/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-27: Agent Spend Ledger/);
  assert.match(card, /Tallgrass Studio/);
  assert.match(card, /fictional/);
  assert.match(card, /Cincinnati/);
  assert.match(card, /clairevo\/status\/2108364438642507817/);
  assert.match(card, /Source post/);
  assert.doesNotMatch(card, /HVAC|heating|cooling|furnace/i);
});

test("the page names the simulation, the shop, and the source", function () {
  assert.match(page, /Agent Spend Ledger/);
  assert.match(page, /Illustrative/);
  assert.match(page, /fictional/);
  assert.match(page, /Tallgrass Studio/);
  assert.match(page, /Cincinnati/);
  assert.match(page, /Hearth &amp; Rye Bakery/);
  assert.match(page, /Keller &amp; Moss Law/);
  assert.match(page, /Riverbend Youth Soccer/);
  assert.match(page, /Internal admin/);
  assert.match(page, /Priya/);
  assert.match(page, /does not run embeddings/);
  assert.match(page, /\$0\.12/);
  assert.match(page, /\$4k/);
  assert.match(page, /\$1\.5k/);
  assert.match(page, /\$5k/);
  assert.match(page, /half of pull requests/);
  assert.match(page, /clairevo\/status\/2108364438642507817/);
  assert.match(page, /viewport-fit=cover/);
  assert.match(page, /<noscript>/);
  assert.match(page, /\$886\.80/);
  assert.match(page, /\$544\.40/);
  assert.match(page, /\$506\.00/);
  assert.match(page, /\$2\.00/);
  assert.match(page, /\$20\.00 a month/);
  assert.match(page, /\$262\.80/);
  assert.match(page, /62 of 71/);
  assert.match(page, /For a client invoice/);
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

test("external links stay on the source post", function () {
  const urls = bundle.match(/https?:\/\/[^\s"'<>)]+/g) || [];
  assert.ok(urls.length >= 2);
  urls.forEach(function (url) {
    if (url === "http://www.w3.org/2000/svg") return;
    assert.equal(url, "https://x.com/clairevo/status/2108364438642507817");
  });
});

test("the fictional ledger has the promised shape", function () {
  const sample = model.sample();
  assert.equal(JSON.parse(JSON.stringify(sample)).sessions.length, sample.sessions.length);
  assert.ok(sample.sessions.length >= 60 && sample.sessions.length <= 120);
  assert.ok(sample.prs.length >= 30 && sample.prs.length <= 50);
  assert.equal(sample.sessions.length, 71);
  assert.equal(sample.prs.length, 40);
  assert.equal(model.WEEKS.length, 8);
  assert.equal(Object.keys(model.TOOLS).length, 4);
  assert.equal(model.STUDIO, "Tallgrass Studio");
  const tools = {};
  sample.sessions.forEach(function (session) { tools[session.tool] = true; });
  assert.deepEqual(Object.keys(tools).sort(), ["claude", "codex", "cursor", "draft"]);
});

test("recommended linking keeps clients apart and leaves half the pull requests single", function () {
  const analysis = model.analyze(model.PRESETS.recommended);
  const wins = model.winners(analysis);
  assert.equal(analysis.threshold, 720);
  assert.equal(analysis.judge, true);
  assert.equal(analysis.singletons.prs, 20);
  assert.equal(analysis.singletons.sessions, 0);
  assert.equal(analysis.mixed.length, 0);
  assert.equal(analysis.workstreams.length, 9);
  assert.equal(wins.list.id, "bakery");
  assert.equal(wins.tokens.id, "law");
  assert.equal(wins.hours.id, "soccer");
  assert.equal(wins.realTokens.id, "bakery");
  assert.equal(wins.realHours.id, "soccer");
  assert.equal(wins.realMarginal.id, "law");
  model.LINES.forEach(function (line) {
    assert.equal(model.pipelineValue(analysis, line.id, "list"), model.truthValue(line.id, "list"));
  });
  assert.match(model.narrate(analysis, "list", "tokens").link, /half the pull requests are singletons/);
  assert.match(model.narrate(analysis, "list", "tokens").bakery, /The bakery rebuild cost \$506\.00/);
});

test("a loose cutoff without the judge files other clients onto the bakery", function () {
  const loose = model.analyze(model.PRESETS.loose);
  const fixed = model.analyze({ threshold: 500, judge: true });
  const leak = model.analyze({ threshold: 720, judge: false });
  assert.equal(loose.mixed.length, 1);
  assert.equal(loose.mixed[0].lines.join(","), "bakery,soccer,law");
  assert.equal(loose.mixed[0].swallowedListCents, 26280);
  assert.equal(model.pipelineValue(loose, "bakery", "list"), 76880);
  assert.equal(model.pipelineValue(loose, "soccer", "list"), 0);
  assert.equal(model.pipelineValue(loose, "law", "list"), 0);
  assert.equal(model.pipelineValue(loose, "sales", "list"), model.truthValue("sales", "list"));
  assert.equal(model.pipelineValue(loose, "admin", "list"), model.truthValue("admin", "list"));
  assert.equal(model.winners(loose).hours.id, "bakery");
  assert.equal(fixed.mixed.length, 0);
  assert.equal(fixed.singletons.prs, 0);
  assert.equal(fixed.singletons.sessions, 0);
  assert.equal(model.pipelineValue(fixed, "bakery", "list"), model.truthValue("bakery", "list"));
  assert.match(model.narrate(fixed, "list", "tokens").link, /judge dropped the lookalike/);
  assert.equal(leak.mixed.length, 1);
  assert.equal(leak.mixed[0].swallowedListCents, 5360);
  assert.match(leak.mixed[0].text, /Estate-planning posts/);
  assert.match(leak.mixed[0].text, /Hearth & Rye homepage/);
});

test("a strict cutoff leaves most sessions unattributed", function () {
  const analysis = model.analyze(model.PRESETS.strict);
  assert.equal(analysis.singletons.sessions, 62);
  assert.equal(analysis.singletons.prs, 31);
  assert.ok(model.pipelineValue(analysis, "unattributed", "list") > analysis.totals.listCents / 2);
  assert.match(model.narrate(analysis, "list", "tokens").link, /62 of 71 sessions are singletons/);
  assert.match(model.narrate(analysis, "list", "tokens").bakery, /answer key/);
});

test("invoices, seat pools, and the four bases reconcile", function () {
  const analysis = model.analyze(model.PRESETS.recommended);
  const totals = analysis.totals;
  assert.equal(totals.listCents, 88680);
  assert.equal(totals.paidCents, 54440);
  assert.equal(totals.seatCents, 36000);
  assert.equal(totals.seatListCents, 70240);
  assert.ok(totals.listCents > totals.paidCents);
  assert.equal(sum(analysis.invoices, "cents"), totals.paidCents);
  assert.equal(analysis.invoices[0].items[0].cents, 8000);
  assert.equal(analysis.invoices[1].items[1].cents, 10000);
  let realTokens = 0;
  let realHours = 0;
  let marginal = 0;
  let adminOct = 0;
  let adminNov = 0;
  analysis.sessions.forEach(function (session) {
    realTokens += session.real.tokens;
    realHours += session.real.hours;
    marginal += session.real.marginal;
    if (session.line !== "admin") return;
    if (session.week <= 4) adminOct += session.listCents;
    else adminNov += session.listCents;
  });
  assert.equal(realTokens, totals.paidCents);
  assert.equal(realHours, totals.paidCents);
  assert.equal(marginal + totals.seatCents, totals.paidCents);
  assert.equal(adminOct, 2000);
  assert.equal(adminNov, 2000);
  assert.equal(model.truthValue("bakery", "real", "marginal"), 200);
  assert.equal(model.truthValue("soccer", "real", "marginal"), 0);
  assert.equal(model.truthValue("law", "real", "marginal"), 9440);
  const story = model.narrate(analysis, "real", "hours");
  assert.match(story.paid, /\$886\.80/);
  assert.match(story.paid, /\$544\.40/);
  assert.match(story.admin, /\$20\.00 a month/);
  assert.match(story.meter, /soccer site adds \$0\.00/);
  assert.match(story.meter, /law blog adds \$94\.40/);
  assert.match(story.spreadRanks, /spread by tokens rank Hearth & Rye Bakery/);
  assert.match(story.spreadRanks, /spread by hours rank Riverbend Youth Soccer/);
  assert.match(story.ranks, /tokens rank Keller & Moss Law/);
  assert.match(story.billing, /client invoice/);
  const marginalRows = model.buckets(analysis, "real", "marginal", "line");
  const overhead = marginalRows.filter(function (row) { return row.id === "overhead"; })[0];
  const soccer = marginalRows.filter(function (row) { return row.id === "soccer"; })[0];
  assert.equal(overhead.display, "$360.00");
  assert.equal(soccer.display, "$0.00");
  assert.equal(model.formatUsd(totals.paidCents), "$544.40");
  assert.equal(model.formatHours(1608), "26.8 h");
});
