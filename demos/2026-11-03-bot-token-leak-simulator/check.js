import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.TokenLeak;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function cents(n) {
  return Math.round(n * 100);
}

test("the lab index links this demo and the page credits both posts", () => {
  assert.match(index, /demos\/2026-11-03-bot-token-leak-simulator\//);
  assert.match(index, /0xg4tsby\/status\/2115791677105291629/);
  assert.match(page, /0xg4tsby\/status\/2115791677105291629/);
  assert.match(page, /m4lkxx\/status\/2115775972536434946/);
  assert.match(page, /Mill Creek Plumbing/);
  assert.match(page, /Northside/);
  assert.match(page, /Cincinnati/);
  assert.match(page, /plumbing/i);
  assert.match(page, /fictional/i);
  assert.match(page, /illustrative example/i);
  assert.match(page, /Try it yourself/);
  assert.match(page, /viewport/);
  assert.match(page, /One bot per task/);
  assert.match(page, /Domain bots \+ ops/);
  assert.match(page, /Summarize the chat/);
  assert.match(page, /Slow the noisy routines/);
  assert.match(page, /Merge overlapping bots/);
  assert.match(page, /short rules file/i);
  assert.match(page, /Verification check/);
  assert.match(page, /Lauren Tan/);
  assert.match(app, /Re-reading share/);
  assert.match(css, /min-height:\s*48px/);
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\.|api[_-]?key/i);
  assert.doesNotMatch(bundle, /\b(sk-|sk_live|AKIA)[A-Za-z0-9]/);
  assert.match(page, new RegExp(String(model.COMPACT_HISTORY_TOKENS)));
  assert.match(page, new RegExp(String(model.CADENCE_CAP)));
  assert.match(page, new RegExp(String(model.SHORT_RULES_TOKENS)));
  assert.match(page, new RegExp(model.RULES_AUTHOR_ONCE.toLocaleString("en-US")));
});

test("preset sliders sit on the slider steps and the teams have the right shape", () => {
  const sprawl = model.team("sprawl");
  const lean = model.team("lean");
  assert.equal(sprawl.length, 9);
  assert.equal(lean.length, 4);
  assert.equal(lean.filter((bot) => bot.verifies).length, 1);
  assert.equal(sprawl.some((bot) => bot.verifies), false);
  assert.equal(model.PRESETS.sprawl.verify, false);
  assert.equal(model.PRESETS.lean.verify, true);
  assert.equal(model.isPresetClean("sprawl", sprawl), true);
  assert.equal(model.isPresetClean("lean", lean), true);
  for (const bot of sprawl.concat(lean)) {
    for (const field of Object.keys(model.LIMITS)) {
      assert.equal(model.snap(field, bot[field]), bot[field]);
    }
  }
  const edited = model.team("sprawl");
  edited[0].runsPerDay = 3;
  assert.equal(model.isPresetClean("sprawl", edited), false);
  assert.equal(model.snap("runsPerDay", Number.NaN), model.LIMITS.runsPerDay.min);
  assert.equal(model.snap("historyTokens", 99999), model.LIMITS.historyTokens.max);
});

test("the sprawl month lands in the high re-reading band and the lean month does not", () => {
  const sprawl = model.compare(model.team("sprawl"), { verify: false, prices: model.DEFAULT_PRICES }).before;
  const lean = model.compare(model.team("lean"), { verify: true, prices: model.DEFAULT_PRICES }).before;

  assert.equal(sprawl.spend.runs, 2130);
  assert.equal(sprawl.spend.historyTokens, 39840000);
  assert.equal(sprawl.spend.rulesTokens, 6132000);
  assert.equal(sprawl.spend.workTokens, 640800);
  assert.equal(sprawl.spend.totalTokens, 46612800);
  assert.ok(sprawl.spend.rereadShare >= 0.75 && sprawl.spend.rereadShare <= 0.88);
  assert.ok(sprawl.spend.workShare > 0.01 && sprawl.spend.workShare < 0.02);
  assert.equal(cents(sprawl.spend.totalCost), 14753);
  assert.equal(sprawl.mistakes.handoffs, 7);
  assert.equal(sprawl.mistakes.chainLength, 8);
  assert.equal(sprawl.mistakes.perRunMiss, model.MISS_LONG);
  assert.equal(sprawl.mistakes.perMonth.toFixed(1), "313.2");

  assert.equal(lean.spend.runs, 360);
  assert.equal(lean.spend.historyTokens, 495000);
  assert.equal(lean.spend.rulesTokens, 252000);
  assert.equal(lean.spend.workTokens, 345000);
  assert.equal(lean.spend.totalTokens, 1092000);
  assert.ok(lean.spend.rereadShare < 0.55);
  assert.ok(lean.spend.totalTokens < sprawl.spend.totalTokens * 0.1);
  assert.equal(cents(lean.spend.totalCost), 742);
  assert.equal(lean.mistakes.handoffs, 2);
  assert.equal(lean.mistakes.perRunMiss, model.MISS_RULES * model.VERIFY_FACTOR);
  assert.equal(lean.spend.verifyTokens, 0);
  assert.ok(lean.mistakes.perMonth < sprawl.mistakes.perMonth / 4);
});

test("the four fixes keep the month's new work and cut the re-read", () => {
  const bots = model.team("sprawl");
  const view = model.compare(bots, {
    compact: true,
    cadence: true,
    consolidate: true,
    shortRules: true,
    verify: false,
    prices: model.DEFAULT_PRICES,
  });
  assert.equal(view.after.spend.workTokens, view.before.spend.workTokens);
  assert.equal(view.after.spend.workTokens, 640800);
  assert.ok(view.after.spend.historyTokens < view.before.spend.historyTokens / 10);
  assert.ok(view.after.spend.rereadShare < 0.4);
  assert.ok(view.delta.tokens < 0);
  assert.ok(view.delta.cost < 0);
  assert.equal(view.after.effective.consolidateInfo.beforeCount, 9);
  assert.equal(view.after.effective.consolidateInfo.afterCount, 4);
  assert.equal(view.after.effective.bots.map((bot) => bot.name).join("|"), "Front desk|Field|Books|Ops");
  assert.equal(view.after.mistakes.handoffs, 2);
  assert.ok(view.after.mistakes.perMonth < view.before.mistakes.perMonth);
  assert.equal(view.after.spend.authorOnce, model.RULES_AUTHOR_ONCE);
  assert.ok(view.after.effective.cadenceChanges.length >= 5);
  assert.ok(view.after.effective.compactChanges.length === 9);
});

test("cadence keeps monthly work, and a short file is authored once", () => {
  const bots = [{
    id: "only",
    name: "Only",
    domain: "front",
    chainIndex: 0,
    runsPerDay: 10,
    historyTokens: 2000,
    rulesTokens: 1000,
    workPerRun: 40,
  }];
  const capped = model.compare(bots, { cadence: true, prices: model.DEFAULT_PRICES });
  assert.equal(capped.before.spend.workTokens, 10 * 40 * model.MONTH_DAYS);
  assert.equal(capped.after.spend.workTokens, capped.before.spend.workTokens);
  assert.equal(capped.after.spend.runs, model.CADENCE_CAP * model.MONTH_DAYS);
  assert.equal(capped.after.spend.historyTokens, model.CADENCE_CAP * model.MONTH_DAYS * 2000);

  const ruled = model.compare(bots, { shortRules: true, prices: model.DEFAULT_PRICES });
  assert.equal(ruled.after.spend.authorOnce, model.RULES_AUTHOR_ONCE);
  assert.equal(ruled.after.effective.bots[0].rulesTokens, model.SHORT_RULES_TOKENS);
  assert.equal(ruled.after.mistakes.perRunMiss, model.MISS_RULES);
  assert.equal(ruled.before.mistakes.perRunMiss, model.MISS_LONG);

  const already = model.compare([{ ...bots[0], rulesTokens: 400 }], { shortRules: true });
  assert.equal(already.after.spend.authorOnce, 0);
});

test("verification and handoffs follow the ladder", () => {
  const sprawl = model.team("sprawl");
  const off = model.compare(sprawl, { verify: false });
  const on = model.compare(sprawl, { verify: true });
  assert.equal(on.before.spend.verifyTokens, model.VERIFY_AUTHOR_ONCE + model.VERIFY_PER_RUN * 2130);
  assert.equal(on.before.mistakes.perRunMiss, model.MISS_LONG * model.VERIFY_FACTOR);
  assert.equal(off.before.mistakes.perRunMiss, model.MISS_LONG);
  const handoffPart = model.HANDOFF_MISS * off.before.mistakes.handoffs * model.JOBS_PER_DAY * model.MONTH_DAYS;
  assert.equal(off.before.mistakes.perMonth - handoffPart, (on.before.mistakes.perMonth - handoffPart) * 2);
  assert.equal(on.before.mistakes.handoffs, off.before.mistakes.handoffs);

  const lean = model.compare(model.team("lean"), { verify: true });
  assert.equal(lean.before.spend.verifyTokens, 0);

  const base = model.scenario([{
    id: "only",
    name: "Only",
    domain: "front",
    chainIndex: 0,
    runsPerDay: 1,
    historyTokens: 200,
    rulesTokens: 2000,
    workPerRun: 20,
  }], { extraHandoffs: 0, verify: false });
  const extra = model.scenario([{
    id: "only",
    name: "Only",
    domain: "front",
    chainIndex: 0,
    runsPerDay: 1,
    historyTokens: 200,
    rulesTokens: 2000,
    workPerRun: 20,
  }], { extraHandoffs: 1, verify: false });
  const added = extra.mistakes.perMonth - base.mistakes.perMonth;
  assert.ok(Math.abs(added - model.HANDOFF_MISS * model.JOBS_PER_DAY * model.MONTH_DAYS) < 1e-6);
  assert.equal(extra.mistakes.perRunMiss, base.mistakes.perRunMiss);
  assert.equal(model.scenario([], {}).spend.totalTokens, 0);
  assert.equal(model.scenario([], {}).mistakes.perMonth, 0);
});

test("prices are examples and scale the cost without changing tokens", () => {
  const bots = model.team("lean");
  const priced = model.compare(bots, { verify: true, prices: { inputPerMillion: 3, workPerMillion: 15 } });
  const free = model.compare(bots, { verify: true, prices: { inputPerMillion: 0, workPerMillion: 0 } });
  const doubled = model.compare(bots, { verify: true, prices: { inputPerMillion: 6, workPerMillion: 30 } });
  assert.equal(free.before.spend.totalCost, 0);
  assert.equal(free.before.spend.totalTokens, priced.before.spend.totalTokens);
  assert.equal(cents(doubled.before.spend.totalCost), cents(priced.before.spend.totalCost * 2));
  const clamped = model.compare(bots, { prices: { inputPerMillion: -5, workPerMillion: Number.NaN } });
  assert.equal(clamped.before.spend.totalCost, 0);
  assert.equal(priced.before.spend.historyTokens + priced.before.spend.rulesTokens + priced.before.spend.workTokens, priced.before.spend.totalTokens);
});
