import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console };
  context.globalThis = context;
  for (const file of ["data.js", "metrics.js"]) {
    const code = readFileSync(new URL("./" + file, import.meta.url), "utf8");
    vm.runInNewContext(code, context, { filename: file });
  }
  return context;
}

const api = load();
const data = api.RedbudData.dataset();
const metrics = api.RedbudMetrics;
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const dataSrc = readFileSync(new URL("./data.js", import.meta.url), "utf8");
const metricsSrc = readFileSync(new URL("./metrics.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + dataSrc + metricsSrc;

test("the lab index links this demo and the page credits the post", () => {
  assert.match(index, /demos\/2026-11-02-data-bot-analyst\//);
  assert.match(index, /bot\/status\/2117349540168876334/);
  assert.match(page, /bot\/status\/2117349540168876334/);
  assert.match(page, /Redbud Lawn Co\./);
  assert.match(page, /fictional/i);
  assert.match(page, /lawn/i);
  assert.match(page, /Why this matters/);
  assert.match(page, /Try it yourself/);
  assert.match(page, /viewport/);
  assert.match(page, /Pin to dashboard|pin an answer/i);
  assert.match(app, /localStorage/);
  assert.match(app, /bookmark-lab:2026-11-02-data-bot-analyst:pins/);
  assert.match(metricsSrc, /I don't have a defined metric for that/);
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\.|api[_-]?key/i);
  assert.doesNotMatch(bundle, /HVAC|furnace|Linwood Comfort/i);
  assert.doesNotMatch(dataSrc + metricsSrc, /\b(sk-|sk_live|AKIA)[A-Za-z0-9]/);
});

test("the sample is a few hundred deterministic rows and has no personal data", () => {
  const again = load().RedbudData.dataset();
  assert.equal(JSON.stringify(again), JSON.stringify(data));
  assert.equal(data.company, "Redbud Lawn Co.");
  assert.equal(data.today, "2026-11-02");
  assert.ok(data.jobs.length >= 200 && data.jobs.length <= 500);
  assert.ok(data.customers.length >= 80);
  assert.ok(data.leads.length >= 100);
  assert.equal(data.crews.length, 6);
  assert.equal(data.campaigns.length, 6);
  const rows = data.jobs.length + data.customers.length + data.leads.length + data.crews.length + data.campaigns.length;
  assert.ok(rows >= 300);
  const blob = JSON.stringify(data);
  assert.equal(blob.includes("@"), false);
  assert.doesNotMatch(blob, /\d{3}-\d{3}-\d{4}/);
  data.jobs.forEach((job) => {
    assert.ok(data.customers.some((customer) => customer.id === job.customer_id));
    assert.ok(job.gross_cents >= job.discount_cents);
    if (job.status === "completed") assert.ok(job.completed_on);
    else assert.equal(job.completed_on, null);
  });
});

test("defined and loose readings disagree on the three ambiguous words", () => {
  const contrast = metrics.contrast(data);
  assert.notEqual(contrast.customer.defined.value, contrast.customer.loose.value);
  assert.notEqual(contrast.conversion.defined.value, contrast.conversion.loose.value);
  assert.notEqual(contrast.revenue.defined.value, contrast.revenue.loose.value);

  const definedCustomers = metrics.definedCustomerIds(data);
  const repeats = metrics.repeatCustomerIds(data);
  const loose = metrics.loosePopulation(data);
  assert.equal(definedCustomers.size, 172);
  assert.equal(repeats.size, 48);
  assert.equal(loose.total, 343);
  assert.ok(repeats.size / definedCustomers.size > repeats.size / loose.total);

  const totals = metrics.quarterTotals(data);
  assert.equal(totals.netCents, 12428000);
  assert.equal(totals.grossCents, 12798000);
  assert.equal(totals.looseGrossCents, 15678000);
  assert.ok(totals.netCents < totals.grossCents);
  assert.ok(totals.grossCents < totals.looseGrossCents);
});

test("the cheapest campaign, the busiest crew, and the top neighborhood flip with the layer", () => {
  const definedCost = metrics.campaignCosts(data, "defined");
  const looseCost = metrics.campaignCosts(data, "loose");
  assert.equal(definedCost[0].id, "yard-sign");
  assert.equal(definedCost[0].costCents, 1500);
  assert.equal(looseCost[0].id, "community-board");
  assert.equal(looseCost[0].costCents, 1200);
  assert.notEqual(definedCost[0].id, looseCost[0].id);

  const areas = metrics.neighborhoodRevenue(data);
  const byNet = areas.slice().sort((a, b) => b.netCents - a.netCents);
  const byLoose = areas.slice().sort((a, b) => b.looseGrossCents - a.looseGrossCents);
  assert.equal(byNet[0].name, "Oakley");
  assert.equal(byNet[0].netCents, 4162000);
  assert.equal(byLoose[0].name, "Hyde Park");
  assert.equal(byLoose[0].looseGrossCents, 6180000);

  const crews = metrics.crewUtilization(data);
  const definedCrew = crews.slice().sort((a, b) => b.definedRatio - a.definedRatio)[0];
  const looseCrew = crews.slice().sort((a, b) => b.looseRatio - a.looseRatio)[0];
  assert.equal(definedCrew.id, "Sycamore");
  assert.ok(definedCrew.definedRatio > 1);
  assert.equal(looseCrew.id, "Hickory");
  assert.notEqual(definedCrew.id, looseCrew.id);

  const conversions = metrics.conversionByCampaign(data);
  const definedConv = conversions.slice().sort((a, b) => b.definedRatio - a.definedRatio)[0];
  const looseConv = conversions.slice().sort((a, b) => b.looseRatio - a.looseRatio)[0];
  assert.equal(definedConv.id, "yard-sign");
  assert.equal(looseConv.id, "community-board");
});

test("answers cite a metric and a query, and an unknown question refuses", () => {
  const asked = metrics.ask(data, "Which campaign brought the cheapest booked jobs?", "defined");
  assert.equal(asked.matched, true);
  assert.match(asked.sql, /status IN \('booked', 'completed'\)/);
  assert.match(asked.sql, /cost_per_booked_job/);
  assert.equal(asked.metrics[0].id, "cost_per_booked_job");
  assert.match(asked.headline, /Yard signs/);
  assert.ok(asked.rows.length === 6);
  assert.ok(asked.chart.series.length === 6);
  assert.ok(asked.caveats.length >= 3);

  const loose = metrics.ask(data, "cheapest booked jobs", "loose");
  assert.equal(loose.matched, true);
  assert.equal(loose.mode, "loose");
  assert.doesNotMatch(loose.sql, /status IN/);
  assert.match(loose.headline, /Oakley community board/);
  assert.match(loose.looseReading, /cancelled/i);

  const neighborhood = metrics.runQuestion(data, "revenue-neighborhood", "defined");
  assert.match(neighborhood.sql, /net_cents/);
  assert.match(neighborhood.sql, /2026-07-01/);
  assert.match(neighborhood.headline, /Oakley/);
  assert.match(neighborhood.contrast, /Hyde Park/);

  const util = metrics.runQuestion(data, "crew-utilization", "defined");
  assert.match(util.sql, /capacity_minutes/);
  assert.match(util.headline, /Sycamore/);
  assert.match(util.contrast, /Hickory/);

  const repeat = metrics.ask(data, "what is our repeat-customer rate this season?", "defined");
  assert.match(repeat.headline, /48 of 172/);
  assert.match(repeat.sql, /repeat_customer_rate/);

  const customers = metrics.ask(data, "how many customers do we have?", "loose");
  assert.match(customers.headline, /343/);
  assert.match(customers.contrast, /172/);

  const gross = metrics.ask(data, "what was gross and net revenue last quarter?", "defined");
  assert.match(gross.headline, /\$124,280/);
  assert.equal(gross.metrics.some((item) => item.id === "net_revenue"), true);
  assert.equal(gross.metrics.some((item) => item.id === "gross_revenue"), true);

  const refused = metrics.ask(data, "what is our profit margin?", "defined");
  assert.equal(refused.matched, false);
  assert.equal(refused.headline, "I don't have a defined metric for that.");
  assert.equal(refused.rows, undefined);
  assert.equal(refused.chart, undefined);
  assert.equal(metrics.matchQuestion("who should we hire next spring?"), null);
  assert.equal(metrics.matchQuestion("forecast next month"), null);
  assert.equal(metrics.matchQuestion(""), null);
});

test("keyword matching finds the suggested questions and leaves gaps unmatched", () => {
  assert.equal(metrics.matchQuestion("revenue by neighborhood last quarter"), "revenue-neighborhood");
  assert.equal(metrics.matchQuestion("How utilized was each crew last quarter?"), "crew-utilization");
  assert.equal(metrics.matchQuestion("conversion rate by campaign"), "conversion");
  assert.equal(metrics.matchQuestion("what did the crews eat for lunch"), null);
  assert.equal(metrics.QUESTIONS.length, 7);
  const roles = new Set(metrics.QUESTIONS.map((item) => item.role));
  assert.deepEqual(roles, new Set(["owner", "marketer", "ops"]));
});
