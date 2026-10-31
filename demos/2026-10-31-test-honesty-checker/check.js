import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CRAP_GATE,
  MODULE,
  SAMPLE_JOBS,
  STRONG_TESTS,
  WEAK_TESTS,
  analyze,
  analyzeSource,
  crapScore,
  formatMoney,
  priceBreakdown,
} from "./model.js";

const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const model = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

const POST = "https://x.com/unclebobmartin/status/2114388856976069095";
const REPO = "https://github.com/unclebob/ub-mode";

test("the lab index links this demo and the page names the source", () => {
  assert.match(index, /demos\/2026-10-31-test-honesty-checker\//);
  assert.match(index, /unclebobmartin\/status\/2114388856976069095/);
  assert.match(page, /2114388856976069095/);
  assert.match(page, /github\.com\/unclebob\/ub-mode/);
  assert.match(page, /github\.com\/unclebob\/crapper/);
  assert.match(page, /github\.com\/unclebob\/dryer/);
  assert.match(page, /github\.com\/unclebob\/mutator/);
  assert.match(page, /fictional/i);
  assert.match(page, /Linwood Comfort/);
  assert.match(page, /AI-written/);
  assert.match(page, /viewport/);
  assert.match(page, /CRAP = complexity² × \(1 − coverage\)³ \+ complexity/);
  assert.match(page, /under 10/);
  assert.doesNotMatch(page + app + model + css, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\./i);
  assert.doesNotMatch(page, /src="https?:/);
  assert.doesNotMatch(app, /mouseover|mouseenter|onmouse|innerHTML/);
  assert.doesNotMatch(css, /:hover/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset/);
  assert.match(app, /analyze\(/);
  assert.match(app, /priceBreakdown/);
});

test("CRAP is the published formula", () => {
  assert.equal(crapScore(4, 1), 4);
  assert.equal(crapScore(4, 0), 20);
  assert.equal(crapScore(10, 0.5), 22.5);
  assert.equal(CRAP_GATE, 10);
  assert.equal(formatMoney(0), "$0.00");
  assert.equal(formatMoney(32.4), "$32.40");
  assert.equal(formatMoney(137.71), "$137.71");
  assert.equal(formatMoney(10248), "$10,248.00");
});

test("the sample quotes match the rate card, not a second copy of the bugs", () => {
  for (const sample of SAMPLE_JOBS) {
    assert.equal(priceBreakdown(sample.job).total, sample.total, sample.id);
  }
  const saturday = priceBreakdown(SAMPLE_JOBS[1].job);
  assert.equal(saturday.base, 240);
  assert.equal(saturday.extra, 84);
  assert.equal(saturday.discount, 32.4);
  assert.equal(saturday.tax, 19.68);
  const pinned = priceBreakdown({ type: "repair", when: { day: "tue", hour: 19 }, member: true });
  assert.equal(pinned.base, 240);
  assert.equal(pinned.extra, 120);
  assert.equal(pinned.discount, 36);
  assert.equal(pinned.tax, 21.87);
  assert.equal(pinned.total, 345.87);
  assert.match(STRONG_TESTS.find((item) => item.id === "total").body, /345\.87/);
});

test("comments and strings are not code, and complexity counts real decisions", () => {
  const sample = [
    "function sample(x, ready) {",
    "  // if (false) return 1;",
    "  if (x > 1 && ready) return x;",
    "  return 0;",
    "}",
  ].join("\n");
  const loose = analyzeSource(sample, [
    {
      id: "loose",
      name: "finite",
      body: "const value = sample(2, true);\nassert(typeof value === \"number\");",
    },
  ]);
  assert.equal(loose.ok, true);
  assert.equal(loose.functions.length, 1);
  assert.equal(loose.functions[0].complexity, 3);
  assert.equal(loose.mutants.filter((mutant) => mutant.original === "1").length, 1);
  assert.equal(loose.mutants.filter((mutant) => mutant.original === "false").length, 0);
  const boundary = loose.mutants.find((mutant) => mutant.original === ">" && mutant.replacement === ">=");
  const logic = loose.mutants.find((mutant) => mutant.original === "&&" && mutant.replacement === "||");
  assert.equal(boundary.killed, false);
  assert.equal(logic.killed, false);

  const pinned = analyzeSource(sample, [
    {
      id: "pin",
      name: "pin the branch",
      body: [
        "assertEqual(sample(2, true), 2, \"over\");",
        "assertEqual(sample(1, true), 0, \"boundary\");",
        "assertEqual(sample(2, false), 0, \"flag\");",
      ].join("\n"),
    },
  ]);
  assert.equal(pinned.ok, true);
  assert.equal(pinned.functions[0].coverage, 1);
  assert.equal(pinned.functions[0].crap, 3);
  assert.equal(pinned.mutants.find((mutant) => mutant.id === boundary.id).killed, true);
  assert.equal(pinned.mutants.find((mutant) => mutant.id === logic.id).killed, true);
});

test("coverage and CRAP follow the calls, including a partial run", () => {
  const idle = analyzeSource(MODULE, []);
  assert.equal(idle.ok, true);
  assert.equal(idle.lineCoverage, 0);
  assert.equal(idle.mutationScore, 0);
  const idleBase = idle.functions.find((fn) => fn.name === "basePrice");
  assert.equal(idleBase.complexity, 4);
  assert.equal(idleBase.coverage, 0);
  assert.equal(idleBase.crap, 20);

  const partial = analyzeSource(MODULE, [
    {
      id: "only",
      name: "only tune-up",
      body: "assertEqual(basePrice(\"tune-up\"), 129, \"tune-up\");",
    },
  ]);
  assert.equal(partial.ok, true, partial.error);
  const base = partial.functions.find((fn) => fn.name === "basePrice");
  const tax = partial.functions.find((fn) => fn.name === "salesTax");
  assert.equal(base.coverage, 0.25);
  assert.equal(base.crap, 10.75);
  assert.equal(tax.coverage, 0);
  assert.equal(tax.complexity, 1);
  assert.equal(tax.crap, 2);
});

test("the AI-written suite covers every line and still misses the edits", () => {
  for (const item of WEAK_TESTS) {
    assert.doesNotMatch(item.body, /assertEqual/);
    assert.match(item.body, /typeof|Number\.isFinite/);
  }
  for (const item of STRONG_TESTS) assert.match(item.body, /assertEqual\(/);

  const weak = analyze([]);
  assert.equal(weak.ok, true, weak.error);
  assert.equal(weak.tests.length, WEAK_TESTS.length);
  assert.ok(weak.tests.every((item) => item.pass));
  assert.equal(weak.lineCoverage, 1);
  assert.equal(weak.linesHit, weak.lines);
  assert.ok(weak.mutants.length >= 20 && weak.mutants.length <= 80);
  assert.ok(weak.mutationScore < 0.35, "mutation score " + weak.mutationScore);
  assert.equal(weak.mutationScore, weak.killed / weak.mutants.length);

  const expected = {
    basePrice: 4,
    surcharge: 5,
    memberDiscount: 2,
    salesTax: 1,
    quoteTotal: 1,
    roundCents: 1,
  };
  assert.deepEqual(weak.functions.map((fn) => fn.name), Object.keys(expected));
  for (const fn of weak.functions) {
    assert.equal(fn.complexity, expected[fn.name], fn.name);
    assert.equal(fn.coverage, 1, fn.name);
    assert.equal(fn.crap, fn.complexity, fn.name);
    assert.ok(fn.crap < CRAP_GATE, fn.name);
  }

  for (const kind of ["constant", "boundary", "comparison", "arithmetic", "boolean", "logic"]) {
    assert.ok(weak.mutants.some((mutant) => mutant.kind === kind), kind);
  }
  for (const mutant of weak.mutants) {
    assert.equal(MODULE.slice(mutant.start, mutant.end), mutant.original);
    assert.equal(mutant.source, MODULE.slice(0, mutant.start) + mutant.replacement + MODULE.slice(mutant.end));
    assert.notEqual(mutant.source, MODULE);
  }

  const lines = MODULE.split("\n");
  const edge = weak.mutants.find((mutant) => mutant.functionName === "surcharge" && mutant.original === ">=" && mutant.replacement === ">");
  assert.ok(edge);
  assert.match(lines[edge.line - 1], /hour >= 17/);
  assert.equal(edge.killed, false);
  assert.match(edge.before + edge.original + edge.after, /when\.hour >= 17/);
});

test("each stronger test kills a mutant the suite had been letting through", () => {
  let killed = analyze([]).killed;
  const enabled = [];
  for (const item of STRONG_TESTS) {
    enabled.push(item.id);
    const report = analyze(enabled);
    assert.equal(report.ok, true, item.id + " " + report.error);
    assert.equal(report.lineCoverage, 1);
    assert.ok(
      report.killed > killed,
      item.id + " killed " + killed + " then " + report.killed,
    );
    killed = report.killed;
  }

  const full = analyze(STRONG_TESTS.map((item) => item.id));
  assert.ok(full.mutationScore >= 0.85, "final score " + full.mutationScore + " survivors: " + full.mutants.filter((mutant) => !mutant.killed).map((mutant) => mutant.label).join("; "));

  const beforeClock = analyze(["rate-card"]);
  const afterClock = analyze(["rate-card", "clock"]);
  const edge = (report) => report.mutants.find((mutant) => mutant.functionName === "surcharge" && mutant.original === ">=" && mutant.replacement === ">");
  assert.equal(edge(beforeClock).killed, false);
  assert.equal(edge(afterClock).killed, true);
  assert.equal(edge(afterClock).killerId, "clock");

  const beforeMember = analyze(["rate-card", "clock"]);
  const afterMember = analyze(["rate-card", "clock", "member"]);
  const bang = (report) => report.mutants.find((mutant) => mutant.original === "!" && mutant.replacement === "");
  assert.equal(bang(beforeMember).killed, false);
  assert.equal(bang(afterMember).killed, true);
  assert.equal(bang(afterMember).killerId, "member");

  const beforeTotal = analyze(["rate-card", "clock", "member"]);
  const afterTotal = analyze(STRONG_TESTS.map((item) => item.id));
  const pluses = (report) => report.mutants.filter((mutant) => mutant.functionName === "quoteTotal" && mutant.original === "+");
  assert.ok(pluses(beforeTotal).length >= 1);
  assert.ok(pluses(beforeTotal).every((mutant) => !mutant.killed));
  assert.ok(pluses(afterTotal).every((mutant) => mutant.killed));
  assert.ok(pluses(afterTotal).every((mutant) => mutant.killerId === "total"));

  const price = beforeClock.mutants.find((mutant) => mutant.original === "129");
  assert.equal(price.killed, true);
  assert.equal(price.killerId, "rate-card");
  assert.equal(analyze([]).mutants.find((mutant) => mutant.id === price.id).killed, false);
});
