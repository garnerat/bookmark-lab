import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String, Array, Boolean };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.Funnel;
}

const Funnel = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const model = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + model;

function ids(cards) {
  return Array.from(cards, function (card) { return card.id; });
}

function file(id) {
  return Funnel.FILES.find(function (item) { return item.id === id; });
}

test("the lab index lists this demo after the previous day", function () {
  const previous = index.indexOf("demos/2026-11-19-tiny-observability-lab/");
  const here = index.indexOf("demos/2026-11-20-deepsec-review-funnel/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-20: Security review funnel/);
  assert.match(card, /Second Chance Paws Rescue/);
  assert.match(card, /dillon_mulroy\/status\/2123761892787175459/);
  assert.match(card, /Source post/);
});

test("the page names the rescue, the post, the repo, and stays a simulation", function () {
  assert.match(page, /Second Chance Paws Rescue/);
  assert.match(page, /dillon_mulroy\/status\/2123761892787175459/);
  assert.match(page, /vercel\.com\/oss\/deepsec/);
  assert.match(page, /github\.com\/vercel-labs\/deepsec/);
  assert.match(page, /open-source security review harness/);
  assert.match(page, /npx deepsec init/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /Simulation/);
  assert.match(page, /made-up illustrative estimate/);
  assert.match(page, /Skip revalidation/);
  assert.match(page, /Skip matchers \/ send every file to the agent/);
  assert.match(page, /Regex matchers only, no agent/);
  assert.match(page, /not a deepsec flag|not deepsec flags/i);
  assert.equal(Funnel.ORG, "Second Chance Paws Rescue");
  assert.equal(Funnel.POST.url, "https://x.com/dillon_mulroy/status/2123761892787175459");
  assert.equal(Funnel.PAGE.url, "https://vercel.com/oss/deepsec");
  assert.equal(Funnel.REPO.url, "https://github.com/vercel-labs/deepsec");
  assert.doesNotMatch(bundle, /HVAC|landscaping|e-commerce|ecommerce|dental|law firm|coffee|restaurant|accounting|\bgym\b/i);
  assert.doesNotMatch(app + page, /fetch\(|XMLHttpRequest|google-analytics|gtag\(|innerHTML/);
  assert.doesNotMatch(page, /<script[^>]+src="https?:/);
  assert.doesNotMatch(css, /@import|url\(https?:|:hover/);
  assert.match(css, /min-height:\s*48px/);
  assert.doesNotMatch(model, /sk_live/);
});

test("the mini repo is 22 files on the five surfaces", function () {
  assert.ok(Funnel.FILES.length >= 15 && Funnel.FILES.length <= 25);
  assert.equal(Funnel.FILES.length, 22);
  const paths = Funnel.FILES.map(function (item) { return item.path; });
  assert.equal(new Set(paths).size, paths.length);
  Funnel.FILES.forEach(function (item) {
    assert.ok(item.code.length > 20, item.id);
    if (item.surface) assert.ok(Funnel.SURFACES.indexOf(item.surface) !== -1, item.id);
    if (item.matcher) assert.ok(item.surface, item.id);
  });
  assert.equal(Funnel.run({}).surfaceLegend, "auth 6 · payments 2 · webhooks 1 · file/URL input 3 · admin 1");
});

test("the default funnel keeps four real bugs and drops the false positives", function () {
  const result = Funnel.run({});
  assert.deepEqual(Array.from(result.stages, function (stage) { return stage.count; }), [22, 13, 7, 7, 4]);
  assert.equal(result.counts.falsePositives, 0);
  assert.deepEqual(ids(result.cards.report), ["adoption-read", "export", "webhook", "pet-photo"]);
  assert.deepEqual(ids(result.cards.agent), [
    "adoption-read", "export", "webhook", "pet-photo", "pet-read", "foster-note", "stripe-fixture",
  ]);
  result.cards.report.forEach(function (card) {
    assert.equal(card.badge, "Confirmed");
    assert.ok(card.code.length > 40);
    const agent = card.lines.find(function (line) { return line.label === "Agent"; });
    assert.ok(agent && agent.text.length > 20);
  });
  const idor = result.cards.report[0];
  const agent = idor.lines.find(function (line) { return line.label === "Agent"; });
  assert.equal(agent.text, "Agent traced request -> handler -> db query; no check that application.ownerId === session.userId.");
  assert.match(result.summary, /Revalidation keeps 4/);
  assert.equal(result.gotcha, null);
  assert.equal(result.cost.madeUp, true);
  assert.equal(result.cost.active, "shortlist");
});

test("the planted bugs and the safe lookalikes are in the snippets", function () {
  const read = file("adoption-read");
  const created = file("adoption-new");
  const webhook = file("webhook");
  const exported = file("export");
  const photo = file("pet-photo");
  const note = file("foster-note");
  const fixture = file("stripe-fixture");
  const pet = file("pet-read");
  assert.equal(read.matcher, true);
  assert.equal(read.regex, null);
  assert.doesNotMatch(read.code, /ownerId/);
  assert.match(read.finding.trace, /application\.ownerId === session\.userId/);
  assert.match(read.finding.revalidation, /^Stands\./);
  assert.match(created.code, /ownerId: session\.userId/);
  assert.doesNotMatch(webhook.code, /signature|constructEvent|stripe-signature/);
  assert.match(webhook.code, /req\.json\(\)/);
  assert.match(webhook.finding.revalidation, /^Stands\./);
  assert.doesNotMatch(exported.code, /requireStaff|readSession|requireSession/);
  assert.match(exported.code, /text\/csv/);
  assert.match(exported.code, /\/export/);
  assert.match(file("middleware").code, /\/admin/);
  assert.match(photo.code, /fetch\(imageUrl\)/);
  assert.match(photo.finding.revalidation, /SSRF-shaped/);
  assert.match(note.code, /dangerouslySetInnerHTML/);
  assert.match(note.code, /&lt;/);
  assert.match(note.finding.revalidation, /^Rejected\./);
  assert.match(fixture.code, /sk_test_secondChancePaws_not_a_real_key/);
  assert.match(fixture.path, /^tests\/fixtures\//);
  assert.match(fixture.finding.revalidation, /^Rejected\./);
  assert.match(pet.finding.revalidation, /^Rejected\./);
  assert.equal(pet.regex, null);
});

test("skipping revalidation leaves the three shortlist false positives in the report", function () {
  const flood = Funnel.run({ skipRevalidation: true });
  assert.equal(flood.counts.report, 7);
  assert.equal(flood.counts.agent, 7);
  assert.equal(flood.counts.candidates, 7);
  assert.equal(flood.counts.falsePositives, 3);
  assert.deepEqual(ids(flood.cards.report), [
    "adoption-read", "export", "webhook", "pet-photo", "pet-read", "foster-note", "stripe-fixture",
  ]);
  assert.equal(flood.cards.report.find(function (card) { return card.id === "pet-read"; }).badge, "False positive");
  assert.match(flood.summary, /False positives flood the report/);
  assert.doesNotMatch(ids(flood.cards.report).join(","), /donate|session/);
  const dropped = Funnel.run({}).cards.files.find(function (card) { return card.id === "foster-note"; });
  assert.equal(dropped.badge, "Dropped");
});

test("skipping matchers sends every file and balloons the made-up estimate", function () {
  const wide = Funnel.run({ skipMatchers: true });
  const both = Funnel.run({ skipMatchers: true, skipRevalidation: true });
  const calm = Funnel.run({});
  assert.equal(wide.counts.candidates, 22);
  assert.equal(wide.counts.agent, 9);
  assert.deepEqual(ids(wide.cards.report), ["adoption-read", "export", "webhook", "pet-photo"]);
  assert.deepEqual(ids(wide.cards.agent), [
    "adoption-read", "export", "webhook", "pet-photo", "pet-read", "foster-note", "stripe-fixture", "donate", "session",
  ]);
  assert.equal(both.counts.report, 9);
  assert.equal(both.counts.falsePositives, 5);
  assert.match(both.summary, /flood/);
  assert.equal(wide.cost.active, "whole");
  assert.equal(wide.cost.cards[0].tokens, 7 * Funnel.ESTIMATE.shortlistTokensEach);
  assert.equal(wide.cost.cards[1].tokens, 22 * Funnel.ESTIMATE.wholeTokensEach);
  assert.equal(wide.cost.cards[1].tokens, 92400);
  assert.ok(wide.cost.cards[1].tokens > calm.cost.cards[0].tokens * 5);
  assert.match(wide.cost.cards[1].figure, /92,400/);
  assert.match(wide.cost.cards[0].figure, /9,800/);
  assert.match(wide.cost.formula, /Made-up illustrative estimate/);
  assert.match(wide.summary, /balloon/);
});

test("regex matchers miss the IDOR and keep the lookalikes", function () {
  const regex = Funnel.run({ regexOnly: true });
  const everywhere = Funnel.run({ regexOnly: true, skipMatchers: true, skipRevalidation: true });
  assert.equal(regex.counts.agent, 0);
  assert.equal(regex.stages[3].skipped, true);
  assert.equal(regex.counts.report, 5);
  assert.equal(regex.counts.falsePositives, 2);
  assert.deepEqual(ids(regex.cards.report), ["export", "webhook", "pet-photo", "foster-note", "stripe-fixture"]);
  assert.deepEqual(Array.from(regex.gotcha.files, function (item) { return item.id; }), ["adoption-read"]);
  assert.doesNotMatch(regex.gotcha.files[0].code, /ownerId/);
  assert.match(regex.gotcha.text, /pattern-looks dangerous/);
  assert.match(regex.summary, /misses the adoption-application IDOR/i);
  assert.equal(regex.cost.active, "regex");
  assert.equal(regex.cost.cards[2].tokens, 0);
  assert.match(regex.cards.files.find(function (card) { return card.id === "adoption-read"; }).badge, /Missed/);
  assert.deepEqual(ids(everywhere.cards.report), ids(regex.cards.report));
  assert.deepEqual(Array.from(everywhere.gotcha.files, function (item) { return item.id; }), ["adoption-read"]);
  assert.match(everywhere.summary, /still missing/);
});
