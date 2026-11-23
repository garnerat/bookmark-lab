import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String, Array, Boolean, isFinite };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.JobHuntMeter;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function harbor(extra) {
  return model.evaluate(Object.assign({}, model.DEFAULT_HARBOR, extra || {}));
}

test("the lab index lists this demo after the previous day", function () {
  const previous = index.indexOf("demos/2026-11-21-model-backdoor-check/");
  const here = index.indexOf("demos/2026-11-22-agent-job-hunt-meter/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-22: What an AI job-hunting agent sees/);
  assert.match(card, /Harbor &amp; Pine Realty/);
  assert.match(card, /Transaction Coordinator/);
  assert.match(card, /treg_ai\/status\/2122647673056735318/);
  assert.match(card, /Source post/);
  assert.doesNotMatch(card, /HVAC|heating|cooling|furnace|landscaping|dental|plumbing|roofing/i);
});

test("the page quotes the post and labels the simulation", function () {
  assert.match(page, /What an AI job-hunting agent sees/);
  assert.match(page, /Harbor &amp; Pine Realty/);
  assert.match(page, /Transaction Coordinator/);
  assert.match(page, /treg_ai\/status\/2122647673056735318/);
  assert.match(page, /https:\/\/treg\.to\/jobs-api/);
  assert.match(page, /One API to any jobs data/);
  assert.match(page, /\$0\.03 to run a full job hunt/);
  assert.match(page, /Real salary &amp; hiring manager data/);
  assert.match(page, /Plugin to any agent for your dream job/);
  assert.match(page, /Fully open source, 0% markup/);
  assert.match(page, /the team that owns the role, not the recruiter/);
  assert.match(page, /Rates listed on treg\.to as of Nov 22, 2026; may change\./);
  assert.match(page, /\$0\.0015 per job/);
  assert.match(page, /\$0\.002 per new job/);
  assert.match(page, /Closed roles — free/);
  assert.match(page, /\$0\.01 per call/);
  assert.match(page, /\$0\.25 per report/);
  assert.match(page, /\$0\.50 per 1,000,000 input tokens/);
  assert.match(page, /Not a Jev price/);
  assert.match(page, /\$0\.00095/);
  assert.match(page, /people\.search/);
  assert.match(page, /an empty page costs nothing/i);
  assert.match(page, /\$1\.00 free/);
  assert.match(page, /Try it yourself/);
  assert.ok(page.includes(model.FOOTER.replace(/&/g, "&amp;")));
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /\$0\.05405/);
  assert.match(page, /\$0\.2505/);
  assert.match(page, /2,000 searches cost \$3\.00/);
  assert.equal(model.POST.url, "https://x.com/treg_ai/status/2122647673056735318");
  assert.equal(model.POST.site, "https://treg.to/jobs-api");
  assert.equal(model.FIRM, "Harbor & Pine Realty");
  assert.equal(model.CARD.rateLabel, "Rates listed on treg.to as of Nov 22, 2026; may change.");
  assert.equal(model.ILLUSTRATIVE.label, "Illustrative price invented for this page. Not a Jev price.");
});

test("the page stays local and off heating-and-cooling examples", function () {
  assert.doesNotMatch(bundle, /HVAC|heating|cooling|furnace|air conditioning/i);
  assert.doesNotMatch(app + source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
  assert.doesNotMatch(page, /src="https?:|fonts\.googleapis|cdn\.|unpkg|jsdelivr/);
  assert.match(page, /src="\.\/model\.js"/);
  assert.match(page, /src="\.\/app\.js"/);
  assert.match(page, /href="\.\/styles\.css"/);
  assert.doesNotMatch(bundle, /api[_-]?key|password|secret/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(app, /prefers-reduced-motion/);
});

test("catalog arithmetic matches the jobs-api card", function () {
  assert.equal(model.CARD.searchMicro, 1500);
  assert.equal(model.CARD.freshMicro, 2000);
  assert.equal(model.CARD.closedMicro, 0);
  assert.equal(model.CARD.percentileMicro, 10000);
  assert.equal(model.CARD.benchmarkMicro, 250000);
  assert.equal(model.CARD.starterMicro, 1000000);
  assert.equal(model.CATALOG.peopleSearchMicro, 0);
  assert.equal(model.CATALOG.emailMicro, 950);
  assert.equal(model.ILLUSTRATIVE.usdPerMillion, 0.5);
  assert.equal(model.ILLUSTRATIVE.postingTokens, 320);
  assert.equal(20 * model.CARD.searchMicro, 30000);
  assert.equal(model.formatMicro(30000), "$0.03");
  assert.equal(166 * model.CARD.searchMicro, 249000);
  assert.ok(249000 < model.CARD.benchmarkMicro);
  assert.equal(167 * model.CARD.searchMicro, 250500);
  assert.ok(250500 > model.CARD.benchmarkMicro);
  assert.equal(model.formatMicro(250500), "$0.2505");
  assert.equal(2000 * model.CARD.searchMicro, 3000000);
  assert.equal(model.formatMicro(3000000), "$3.00");
  assert.equal(model.formatMicro(250000), "$0.25");
  assert.equal(model.formatMicro(950), "$0.00095");
  assert.equal(model.formatMicro(0), "$0.00");
});

test("a typical hunt stays in the cents and the report dominates", function () {
  const typical = model.quote(model.DEFAULT_QUOTE);
  assert.equal(typical.roles, 20);
  assert.equal(typical.managers, 3);
  assert.equal(typical.inputTokens, 20 * (800 + 320));
  assert.equal(model.lineById(typical, "search").micro, 30000);
  assert.equal(model.lineById(typical, "fit").micro, 11200);
  assert.equal(model.lineById(typical, "email").micro, 2850);
  assert.equal(model.lineById(typical, "people").micro, 0);
  assert.equal(model.lineById(typical, "pitch").micro, 0);
  assert.equal(model.lineById(typical, "percentile").micro, 10000);
  assert.equal(model.lineById(typical, "benchmark").micro, 0);
  assert.equal(typical.totalMicro, 54050);
  assert.equal(model.formatMicro(typical.totalMicro), "$0.05405");
  assert.equal(model.dominantLine(typical).id, "search");
  assert.match(model.lesson(typical), /Job search is the largest line/);
  assert.match(model.lesson(typical), /a few cents/);
  assert.match(model.lesson(typical), /\$0\.05405/);
  assert.match(model.creditLine(typical.totalMicro), /inside the \$1\.00/);

  const withReport = model.quote(Object.assign({}, model.DEFAULT_QUOTE, { benchmark: true }));
  assert.equal(withReport.totalMicro, 304050);
  assert.equal(model.dominantLine(withReport).id, "benchmark");
  assert.match(model.lesson(withReport), /full salary benchmark report is the largest line/);
  assert.match(model.lesson(withReport), /no longer a few cents/);

  const thousands = model.quote({
    roles: 2000,
    fresh: 0,
    managers: 3,
    resumeTokens: 800,
    percentile: true,
    benchmark: true,
  });
  assert.equal(model.lineById(thousands, "search").micro, 3000000);
  assert.equal(model.dominantLine(thousands).id, "search");
  assert.match(model.creditLine(thousands.totalMicro), /past the \$1\.00/);

  const longResume = model.quote({
    roles: 2000,
    fresh: 0,
    managers: 0,
    resumeTokens: 6000,
    percentile: false,
    benchmark: false,
  });
  assert.equal(model.dominantLine(longResume).id, "fit");
  assert.match(model.lesson(longResume), /illustrative token price/);

  const empty = model.quote({
    roles: 0,
    fresh: 0,
    managers: 8,
    resumeTokens: 800,
    percentile: false,
    benchmark: false,
  });
  assert.equal(empty.managers, 0);
  assert.equal(empty.totalMicro, 0);
  assert.match(model.lesson(empty), /An empty page costs nothing/);

  const capped = model.quote({ roles: 2, fresh: 10, managers: 8, resumeTokens: 200, percentile: false, benchmark: false });
  assert.equal(capped.managersAsked, 8);
  assert.equal(capped.managers, 2);
  assert.equal(model.lineById(capped, "fresh").micro, 20000);
  assert.equal(model.lineById(capped, "email").micro, 1900);
});

test("the fictional board has a few dozen postings and Harbor moves through it", function () {
  assert.ok(model.JOBS.length >= 15 && model.JOBS.length <= 24);
  assert.equal(model.JOBS.length, 20);
  const fits = model.JOBS.filter(function (row) { return !row.closed; }).map(function (row) { return row.fit; });
  assert.equal(new Set(fits).size, fits.length);
  assert.ok(fits.indexOf(model.FIT.concrete) === -1);
  assert.ok(fits.indexOf(model.FIT.vague) === -1);

  const hidden = harbor();
  assert.equal(hidden.universe, 21);
  assert.equal(hidden.saysSkipped, false);
  assert.equal(hidden.visible.some(function (row) { return row.id === "harbor"; }), false);
  assert.equal(hidden.offBoard.some(function (row) { return row.id === "harbor"; }), true);
  assert.equal(hidden.visible.length, 14);
  assert.equal(hidden.droppedPay.map(function (row) { return row.id; }).sort().join(","), "goldthread,milemarker");
  assert.equal(model.placement(hidden).state, "invisible");
  assert.match(model.placement(hidden).text, /does not say it was skipped/);
  assert.equal(model.missedLeader(hidden).employer, "Driftwood Realty");
  assert.equal(model.missedLeader(hidden).fit, 89);

  const dropped = harbor({ onBoard: true, payListed: false, concrete: true, requirePay: true });
  assert.equal(model.placement(dropped).state, "dropped");
  assert.equal(dropped.visible.some(function (row) { return row.id === "harbor"; }), false);
  assert.match(model.placement(dropped).text, /no pay range/);
  assert.match(model.placement(dropped).text, /does not say it was skipped/);

  const ready = harbor({ onBoard: true, payListed: true, concrete: true, namedOwner: true, requirePay: true });
  const readyPlace = model.placement(ready);
  assert.equal(readyPlace.state, "ranked");
  assert.equal(readyPlace.rank, 2);
  assert.equal(readyPlace.total, 15);
  assert.match(readyPlace.text, /Naomi Pell, Designated Broker/);
  assert.match(model.pitchFor(ready.harbor).body, /Naomi/);
  assert.match(model.pitchFor(ready.harbor).body, /escrow/);

  const vague = harbor({ onBoard: true, payListed: true, concrete: false, namedOwner: true, requirePay: true });
  assert.equal(model.placement(vague).rank, 10);
  assert.equal(vague.harbor.fit, 41);

  const team = harbor({ onBoard: true, payListed: true, concrete: true, namedOwner: false, requirePay: true });
  assert.equal(model.placement(team).rank, 2);
  assert.match(model.placement(team).text, /recruiting team/);
  assert.match(model.pitchFor(team.harbor).body, /recruiting team/);
  assert.equal(
    ready.visible.map(function (row) { return row.id; }).join(","),
    team.visible.map(function (row) { return row.id; }).join(",")
  );

  const filterOff = harbor({ onBoard: true, payListed: false, concrete: true, requirePay: false });
  assert.equal(model.placement(filterOff).state, "ranked");
  assert.equal(model.placement(filterOff).rank, 2);
  assert.equal(filterOff.droppedPay.length, 0);
  assert.equal(filterOff.visible.length, 17);

  const ids = ready.visible.map(function (row) { return row.employer; });
  assert.equal(ids.indexOf("Harbor & Pine Realty") !== -1, true);
  assert.equal(ids.indexOf("Driftwood Realty"), -1);
  assert.equal(ids.indexOf("Goldthread Realty"), -1);
  assert.equal(ids.indexOf("Lumen House Real Estate"), -1);
  assert.equal(ready.closed.map(function (row) { return row.id; }).sort().join(","), "pebble,saltline");
});

test("running cost follows the four steps and ends on the full bill", function () {
  const q = model.quote(model.DEFAULT_QUOTE);
  const start = model.shownMicros(q, { playing: true, phase: 1, progress: 0 });
  assert.equal(start.search, 0);
  assert.equal(start.benchmark, 0);
  const mid = model.present(q, model.shownMicros(q, { playing: true, phase: 1, progress: 1 }));
  assert.equal(model.lineById(mid, "search").micro, 30000);
  assert.equal(model.lineById(mid, "fit").micro, 11200);
  assert.equal(model.lineById(mid, "benchmark").micro, 0);
  const managers = model.shownMicros(q, { playing: true, phase: 2, progress: 1 });
  assert.equal(managers.email, 2850);
  assert.equal(managers.benchmark, 0);
  const done = model.present(q, model.shownMicros(q, { playing: false, phase: 4, progress: 1 }));
  assert.equal(done.totalMicro, q.totalMicro);
});
