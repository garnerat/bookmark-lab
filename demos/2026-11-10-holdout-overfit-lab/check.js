import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.HoldoutLab;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;
const written = model.presetChecks("written");

function curve(extra) {
  return model.curve(Object.assign({ split: true, leak: false, checks: written }, extra));
}

test("the lab index links this demo and the source post", () => {
  assert.match(index, /demos\/2026-11-10-holdout-overfit-lab\//);
  assert.match(index, /aaronklaw\/status\/2118734654010221043/);
  assert.match(index, /2026-11-10/);
  assert.match(index, /Hold-out overfitting lab/);
});

test("the page credits the post and states the takeaway", () => {
  assert.match(page, /aaronklaw/);
  assert.match(page, /2118734654010221043/);
  assert.match(page, /Unsloth/);
  assert.match(page, /Cincinnati/);
  assert.match(page, /Westwood/);
  assert.match(page, /Simulation/);
  assert.match(page, /fictional/i);
  assert.match(page, /viewport/);
  assert.match(page, /hold-out/i);
  assert.match(page, /Leak the hold-out/);
  assert.match(page, /Next week/);
  assert.match(page, /Definition of good/);
  assert.match(page, /Set aside test cases first/);
  assert.match(page, /Be suspicious of near-perfect scores/);
  assert.match(page, /Never tune on your test set/);
  assert.match(page, /HOLDOUT\.md/);
  assert.match(page, /not a trained model/i);
  assert.match(page, /legal advice/);
});

test("the page stays local", () => {
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\.|api[_-]?key/i);
  assert.match(css, /system-ui/);
  assert.match(page, /src="\.\/model\.js"/);
  assert.match(page, /src="\.\/app\.js"/);
});

test("the lab has a tune set, a sealed hold-out, and next week", () => {
  assert.equal(model.CASES.length, 26);
  assert.equal(model.CASES.filter((row) => row.holdout).length, 6);
  assert.equal(model.CASES.filter((row) => row.group === "week").length, 8);
  assert.equal(model.CASES.filter((row) => row.group === "pool" && !row.holdout).length, 12);
  const ids = model.CASES.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(model.fitIds(true, false).length, 12);
  assert.equal(model.fitIds(true, true).length, 18);
  assert.equal(model.fitIds(false, false).length, 18);
  assert.equal(model.fitIds(true, false).some((id) => id.startsWith("w")), false);
  assert.equal(model.fitIds(true, true).some((id) => id.startsWith("w")), false);
});

test("a sealed run memorizes the tune set and then misses unseen messages", () => {
  const points = curve();
  for (let i = 1; i < points.length; i += 1) {
    assert.ok(points[i].train + 1e-9 >= points[i - 1].train, "train dipped at epoch " + i);
  }
  assert.equal(points[8].train, 1);
  assert.ok(points[8].loss < 0.001);
  const peak = points.reduce((best, row) => (row.holdout > best.holdout ? row : best));
  assert.equal(peak.epoch, 4);
  assert.ok(peak.holdout > points[0].holdout);
  assert.ok(points[8].holdout < points[0].holdout);
  assert.ok(points[4].week > points[0].week);
  assert.ok(points[8].week < points[0].week);
  assert.match(model.reading(points[8], points[0]), /below the base assistant/);
});

test("leaking or skipping the split makes the hold-out look finished", () => {
  const leaked = curve({ leak: true });
  const open = curve({ split: false });
  assert.equal(leaked[8].holdout, 1);
  assert.equal(open[8].holdout, 1);
  assert.ok(leaked[8].week < leaked[0].week);
  assert.ok(open[8].week < open[0].week);
  assert.match(model.reading(leaked[8], leaked[0]), /Next week/);
  assert.match(leaked[8].note, /copied into tuning/i);
  assert.match(open[8].note, /not a test/);
});

test("the rubric changes the score", () => {
  const polite = curve({ checks: model.presetChecks("polite") });
  polite.forEach((row) => {
    assert.equal(row.train, 1);
    assert.equal(row.holdout, 1);
    assert.equal(row.week, 1);
  });
  assert.match(model.reading(polite[8], polite[0]), /does not mean the assistant got better/);

  const dollar = curve({ checks: model.presetChecks("dollar") });
  assert.equal(dollar[0].week, 0);
  assert.equal(dollar[8].week, 1);
  assert.equal(dollar[8].train, 0.25);
  assert.equal(dollar[8].holdout, 1);
  assert.match(model.reading(dollar[8], dollar[0]), /dollar amount/);

  const empty = model.summarize(8, { checks: [] });
  assert.equal(empty.train, null);
  assert.match(empty.note, /nothing to score/);
});

test("replies follow the stage and the gas-smell rule", () => {
  const gas = model.CASES.find((row) => row.id === "w04");
  const fit = new Set(model.fitIds(true, false));
  const base = model.gradeCase(gas, 0, fit, written);
  const peak = model.gradeCase(gas, 4, fit, written);
  const copied = model.gradeCase(gas, 8, fit, written);
  assert.equal(base.stage, "base");
  assert.doesNotMatch(base.reply, /\$/);
  assert.equal(peak.stage, "rules");
  assert.equal(peak.score, 1);
  assert.match(peak.reply, /gas company/);
  assert.doesNotMatch(peak.reply, /failed part/);
  assert.equal(copied.stage, "copied");
  assert.match(copied.reply, /capacitor/i);
  assert.match(copied.reply, /\$180–\$260/);
  assert.ok(copied.score < base.score);

  const studied = model.CASES.find((row) => row.id === "p04");
  const gold = model.gradeCase(studied, 8, fit, written);
  assert.equal(gold.stage, "gold");
  assert.equal(gold.score, 1);
  assert.match(gold.reply, /gas company/);
});
