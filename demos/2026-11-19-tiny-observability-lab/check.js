import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String, Array, Boolean };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.ObsLab;
}

const Lab = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const model = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + model;

function bucket(partial) {
  return Object.assign({ count: 10, errors: 0, errorRate: 0, p50: 40, p95: 80, avg: 50 }, partial);
}

test("the lab index lists this demo after the previous day", () => {
  const previous = index.indexOf("demos/2026-11-18-cash-app-bot/");
  const here = index.indexOf("demos/2026-11-19-tiny-observability-lab/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-19: Tiny observability lab/);
  assert.match(card, /Ironside Strength Co\./);
  assert.match(card, /Replit\/status\/2122759176288190724/);
  assert.match(card, /Source post/);
});

test("the page names the gym, the post, the repo, and stays fictional", () => {
  assert.match(page, /Ironside Strength Co\./);
  assert.match(page, /Dawn Iron/);
  assert.match(page, /Replit\/status\/2122759176288190724/);
  assert.match(page, /github\.com\/replit\/datacat/);
  assert.match(page, /\$83,700/);
  assert.match(page, /Replit’s claim|Replit's claim/);
  assert.match(page, /DATACAT_SERVICE=booking-api/);
  assert.match(page, /DATACAT_URL=/);
  assert.match(page, /DATACAT_API_KEY/);
  assert.match(page, /node -r @datacat\/trace\/init/);
  assert.match(page, /\/v1\/traces/);
  assert.match(page, /docker compose up -d --build/);
  assert.match(page, /PostgreSQL/);
  assert.match(page, /ClickHouse/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /Fictional/);
  assert.match(page, /trace_id/);
  assert.equal(Lab.SHOP, "Ironside Strength Co.");
  assert.equal(Lab.POST.url, "https://x.com/Replit/status/2122759176288190724");
  assert.equal(Lab.POST.claimYearUsd, 83700);
  assert.equal(Lab.REPO.url, "https://github.com/replit/datacat");
  assert.doesNotMatch(bundle, /HVAC|landscaping|e-commerce|ecommerce|dental|law firm|coffee|restaurant|accounting/i);
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|google-analytics|gtag\(/);
});

test("percentile is nearest rank and ignores input order", () => {
  assert.equal(Lab.percentile([10, 20, 30, 40], 50), 20);
  assert.equal(Lab.percentile([10, 20, 30, 40], 95), 40);
  assert.equal(Lab.percentile([1, 2, 3, 4, 5], 50), 3);
  assert.equal(Lab.percentile([40, 10, 30, 20], 50), 20);
  assert.equal(Lab.percentile([7], 95), 7);
  assert.equal(Lab.percentile([], 95), null);
  assert.equal(Lab.mean([10, 20, 30]), 20);
  assert.equal(Lab.mean([]), null);
});

test("a duration window waits for consecutive buckets and a zero window does not", () => {
  const series = [
    bucket({ p95: 100 }),
    bucket({ p95: 900 }),
    bucket({ p95: 100 }),
    bucket({ p95: 900 }),
    bucket({ p95: 900 }),
    bucket({ p95: 100 }),
  ];
  const noisy = Lab.evaluateRule(series, { metric: "p95", threshold: 800, windowMinutes: 0 });
  assert.equal(JSON.stringify(noisy.firing), JSON.stringify([false, true, false, true, true, false]));
  assert.equal(JSON.stringify(noisy.episodes), JSON.stringify([{ start: 1, end: 1 }, { start: 3, end: 4 }]));

  const held = Lab.evaluateRule(series, { metric: "p95", threshold: 800, windowMinutes: 10, bucketMinutes: 5 });
  assert.equal(held.needed, 2);
  assert.equal(JSON.stringify(held.firing), JSON.stringify([false, false, false, false, true, false]));
  assert.equal(JSON.stringify(held.episodes), JSON.stringify([{ start: 4, end: 4 }]));

  const exact = Lab.evaluateRule(series, { metric: "p95", threshold: 900, windowMinutes: 0 });
  assert.equal(JSON.stringify(exact.firing), JSON.stringify([false, false, false, false, false, false]));

  const errors = [
    bucket({ errorRate: 0.1 }),
    bucket({ errorRate: 0.11 }),
    bucket({ errorRate: 0.2 }),
  ];
  const rate = Lab.evaluateRule(errors, { metric: "errorRate", threshold: 0.1, windowMinutes: 10, bucketMinutes: 5 });
  assert.equal(JSON.stringify(rate.breach), JSON.stringify([false, true, true]));
  assert.equal(JSON.stringify(rate.firing), JSON.stringify([false, false, true]));
});

test("the slow database hides in the average and the 05:45 blip is one bucket", () => {
  const day = Lab.generateMorning({ slowDb: true, smsTimeouts: false, badDeploy: false });
  const again = Lab.generateMorning({ slowDb: true, smsTimeouts: false, badDeploy: false });
  assert.equal(JSON.stringify(day.buckets.map((row) => row.p95)), JSON.stringify(again.buckets.map((row) => row.p95)));
  assert.equal(day.buckets.length, 24);
  assert.equal(day.buckets[0].label, "05:30");
  assert.equal(day.buckets[6].label, "06:00");

  for (const index of [5, 6, 7]) {
    const row = day.buckets[index];
    assert.equal(row.errors, 0);
    assert.ok(row.p95 > 2000, row.label + " p95 " + row.p95);
    assert.ok(row.avg < 800, row.label + " avg " + row.avg);
    assert.ok(row.avg > 500, row.label + " avg " + row.avg);
    assert.ok(row.p50 < 120);
  }

  const blip = day.buckets[Lab.BLIP_BUCKET];
  assert.equal(blip.label, "05:45");
  assert.equal(blip.errors, 4);
  assert.ok(blip.errorRate > 0.2);
  assert.ok(blip.p95 < 200);

  const p95 = Lab.evaluateRule(day.buckets, { metric: "p95", threshold: 800, windowMinutes: 10 });
  assert.equal(p95.breach[5], true);
  assert.equal(p95.firing[5], false);
  assert.equal(JSON.stringify(p95.episodes), JSON.stringify([{ start: 6, end: 7 }]));

  const avg = Lab.evaluateRule(day.buckets, { metric: "avg", threshold: 800, windowMinutes: 10 });
  assert.equal(JSON.stringify(avg.episodes), "[]");

  const anyError = Lab.evaluateRule(day.buckets, { metric: "errorRate", threshold: 0.1, windowMinutes: 0 });
  assert.equal(JSON.stringify(anyError.episodes), JSON.stringify([{ start: 3, end: 3 }]));
  const heldError = Lab.evaluateRule(day.buckets, { metric: "errorRate", threshold: 0.1, windowMinutes: 10 });
  assert.equal(JSON.stringify(heldError.episodes), "[]");

  const longer = Lab.evaluateRule(day.buckets, { metric: "p95", threshold: 800, windowMinutes: 15 });
  assert.equal(JSON.stringify(longer.episodes), JSON.stringify([{ start: 7, end: 7 }]));

  const explained = Lab.explain(day, { metric: "p95", threshold: 800, windowMinutes: 10 });
  assert.match(explained.latencyLine, /Average hides the rush-hour tail/);
  assert.match(explained.latencyLine, /800 ms/);
  assert.match(explained.noiseLine, /single 5-minute blip/);
  assert.match(explained.noiseLine, /10 minutes/);
});

test("a bad deploy raises errors without raising p95, and SMS timeouts land on the trace", () => {
  const deployed = Lab.generateMorning({ slowDb: false, smsTimeouts: false, badDeploy: true });
  for (let index = Lab.DEPLOY_BUCKET; index < deployed.buckets.length; index++) {
    const row = deployed.buckets[index];
    assert.ok(row.errorRate > 0.2, row.label + " errors " + row.errorRate);
    assert.ok(row.p95 < 500, row.label + " p95 " + row.p95);
  }
  const latency = Lab.evaluateRule(deployed.buckets, { metric: "p95", threshold: 800, windowMinutes: 10 });
  assert.equal(JSON.stringify(latency.episodes), "[]");
  const errors = Lab.evaluateRule(deployed.buckets, { metric: "errorRate", threshold: 0.1, windowMinutes: 10 });
  assert.ok(errors.episodes.some((episode) => episode.start >= Lab.DEPLOY_BUCKET));

  const text = Lab.generateMorning({ slowDb: false, smsTimeouts: true, badDeploy: false });
  const sms = text.traces.find((trace) => trace.kind === "sms");
  assert.ok(sms);
  const span = sms.spans.find((row) => row.service === "sms");
  assert.equal(span.durationMs, 2500);
  assert.equal(span.status, "error");
  assert.ok(sms.logs.every((log) => log.traceId === sms.traceId));
  assert.match(sms.logs.map((log) => log.message).join(" "), /timed out after 2500 ms/);

  const quiet = Lab.generateMorning({ slowDb: false, smsTimeouts: false, badDeploy: false });
  assert.ok(quiet.buckets.every((row) => row.p95 < 800));
  assert.equal(quiet.buckets[3].errors, 4);
});

test("logs on a trace share its trace_id, and the slow span is postgres", () => {
  const day = Lab.generateMorning({});
  assert.ok(day.traces.length > 10);
  for (const trace of day.traces) {
    assert.ok(trace.logs.length >= 1);
    for (const log of trace.logs) assert.equal(log.traceId, trace.traceId);
    assert.equal(trace.spans[0].service, "web");
    assert.equal(trace.spans[1].service, "booking-api");
  }
  const slow = day.traces.find((trace) => trace.kind === "ok" && trace.durationMs > 1000);
  assert.ok(slow);
  const db = slow.spans.find((span) => span.service === "postgres");
  const sms = slow.spans.find((span) => span.service === "sms");
  assert.ok(db.durationMs > 1000);
  assert.ok(db.durationMs > sms.durationMs);
  assert.ok(slow.logs.some((log) => log.level === "warn" && /lock wait/.test(log.message)));
  const picked = Lab.defaultTrace(day);
  assert.ok(picked.durationMs > 1000);
  assert.ok(picked.bucket === 5 || picked.bucket === 6 || picked.bucket === 7);
});

test("the cost sketch labels the claim separately from the per-host math", () => {
  const cost = Lab.costSketch({ hosts: 1, gb: 8 });
  assert.equal(cost.perHostCents, 3100);
  assert.equal(cost.perGbCents, 50);
  assert.equal(cost.saasMonthCents, 3500);
  assert.equal(cost.saasYearCents, 42000);
  assert.equal(cost.selfMonthCents, 2400);
  assert.equal(cost.selfYearCents, 28800);
  assert.equal(cost.claimYearCents, 8370000);
  assert.equal(Lab.formatUsd(8370000), "$83,700");
  assert.equal(Lab.formatUsd(50), "$0.50");
  assert.equal(Lab.formatUsd(2400), "$24");
  assert.equal(Lab.formatMs(2464), "2.46 s");
  assert.equal(Lab.formatMs(83), "83 ms");
  assert.equal(Lab.formatPct(0), "0%");
});
