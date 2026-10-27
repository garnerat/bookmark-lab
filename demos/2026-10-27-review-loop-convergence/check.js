import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DEFAULT_SEED,
  PRESETS,
  explainCycle,
  explainOutcome,
  runOnce,
  runTrials,
} from "./sim.js";

const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const sim = readFileSync(new URL("./sim.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("the lab index links this demo and the page names the source", () => {
  assert.match(index, /demos\/2026-10-27-review-loop-convergence\//);
  assert.match(index, /addyosmani\/status\/2114604912520921136/);
  assert.match(page, /https:\/\/x\.com\/addyosmani\/status\/2114604912520921136/);
  assert.match(page, /toy/i);
  assert.doesNotMatch(page + app + sim, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\./i);
});

test("the same seed replays the same night", () => {
  const a = runOnce({ seed: DEFAULT_SEED, voters: 1, threshold: 1, cap: 0, diffOnly: false });
  const b = runOnce({ seed: DEFAULT_SEED, voters: 1, threshold: 1, cap: 0, diffOnly: true });
  assert.equal(a.outcome, "ceiling");
  assert.equal(a.cycles.length, 16);
  assert.deepEqual(a.cycles.map((cycle) => cycle.counts), b.cycles.map((cycle) => cycle.counts));
  assert.equal(explainOutcome(a).length > 40, true);
  assert.equal(explainCycle(a.cycles[0]).includes("Round 1"), true);
});

test("flag kinds match the line the reviewer saw", () => {
  const run = runOnce({ seed: DEFAULT_SEED, voters: 1, threshold: 1, cap: 0, diffOnly: false });
  for (const cycle of run.cycles) {
    const byId = new Map(cycle.snapshot.map((line) => [line.id, line]));
    for (const flag of cycle.flags) {
      const line = byId.get(flag.lineId);
      assert.equal(line.kind, flag.kind);
      assert.equal(line.text, flag.text);
      if (flag.kind === "real") assert.ok(line.bug);
      if (flag.kind === "old-repeat") {
        assert.equal(line.fresh, false);
        assert.equal(line.bug, null);
      }
      if (flag.kind === "false-positive") {
        assert.equal(line.fresh, true);
        assert.equal(line.bug, null);
      }
    }
  }
});

test("a cap without diff-only never runs past the cap", () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const run = runOnce({ seed, voters: 1, threshold: 1, cap: 3, diffOnly: false });
    assert.ok(run.cycles.length <= 3);
    assert.ok(run.outcome === "capped" || run.outcome === "converged");
    assert.ok(run.cycles.every((cycle) => cycle.scope === "full"));
  }
});

test("diff-only rounds do not flag untouched lines", () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const run = runOnce({ seed, voters: 1, threshold: 1, cap: 3, diffOnly: true });
    for (const cycle of run.cycles) {
      if (cycle.scope === "diff") {
        assert.equal(cycle.counts.old, 0);
        assert.ok(cycle.flags.every((flag) => flag.untouched === false));
      } else {
        assert.ok(cycle.index <= 3);
      }
    }
  }
});

test("threshold cannot exceed the number of voters", () => {
  const run = runOnce({ seed: 4, voters: 2, threshold: 9, cap: 3, diffOnly: true });
  assert.equal(run.settings.voters, 2);
  assert.equal(run.settings.threshold, 2);
  assert.ok(run.cycles[0].flags.every((flag) => flag.yes >= 2));
});

test("two hundred trials separate the four rule sets", () => {
  const base = DEFAULT_SEED;
  const summary = Object.fromEntries(PRESETS.map((preset) => [preset.id, runTrials(preset, 200, base)]));
  assert.ok(summary.open.mergedRate < 0.25);
  assert.ok(summary.open.ceilingRate > 0.7);
  assert.ok(summary.open.untouchedShare > 0.55);
  assert.ok(summary.cap.mergedRate < 0.08);
  assert.equal(summary.cap.medianCycles, 3);
  assert.ok(summary.diff.mergedRate > 0.95);
  assert.ok(summary.vote.mergedRate > 0.95);
  assert.ok(summary.vote.oldShare < summary.diff.oldShare);
  assert.ok(summary.vote.meanCommits < summary.diff.meanCommits);
  assert.ok(summary.diff.meanMinutes < summary.open.meanMinutes / 2);
  assert.ok(summary.diff.medianCycles < summary.open.medianCycles);
  assert.ok(summary.diff.meanBugsShippedIfMerged > 0);
});
