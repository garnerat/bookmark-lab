import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = {
    console,
    Math,
    Float64Array,
    Set,
    Array,
    Number,
    Infinity,
  };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.EmeansRace;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;
const defaults = model.DEFAULTS;

function run(overrides) {
  const calls = overrides.points || model.makeCalls(overrides.n || defaults.n, overrides.seed == null ? defaults.seed : overrides.seed);
  return model.createRace({
    n: defaults.n,
    k: defaults.k,
    epochs: defaults.epochs,
    seed: defaults.seed,
    ema: true,
    cosine: true,
    revive: true,
    finalize: true,
    points: calls,
    ...overrides,
    points: calls,
  }).runToEnd();
}

test("the lab index lists this demo after the previous day", () => {
  const previous = index.indexOf("demos/2026-11-11-decider-swap-lab/");
  const here = index.indexOf("demos/2026-11-12-emeans-race/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  assert.match(index, /2026-11-12: Race Lloyd against e-means/);
  assert.match(index, /swann_bessa\/status\/2120200714630594911/);
  assert.match(index, /Source post/);
  assert.match(index, /Cincinnati|Oakley/);
});

test("the page cites the post, the paper, the blog, and the FAISS call", () => {
  assert.match(page, /swann_bessa\/status\/2120200714630594911/);
  assert.match(page, /Swann Bessa/);
  assert.match(page, /Andrew bookmarked/);
  assert.match(page, /Introducing e-means, an algorithm beating k-means in 10x fewer epochs/);
  assert.match(page, /e-means\.github\.io/);
  assert.match(page, /arxiv\.org\/abs\/2611\.09501/);
  assert.match(page, /arxiv\.org\/pdf\/2611\.09501/);
  assert.match(page, /facebookresearch\/faiss\/blob\/main\/contrib\/e_means\/README\.md/);
  assert.match(page, /facebookresearch\/faiss\/blob\/main\/contrib\/e_means\/base\.py/);
  assert.match(page, /from faiss\.contrib\.e_means import NumpyEmeans/);
  assert.match(page, /NumpyEmeans\(64, 500\)/);
  assert.match(page, /em\.train\(x\)/);
  assert.match(page, /em\.assign\(x_new\)/);
  assert.match(page, /pip install faiss-cpu/);
  assert.match(page, /FAISS 1\.16/);
  assert.match(page, /1\.4 to 2\.6/);
  assert.match(page, /authors/);
  assert.match(page, /Oakley Comfort Co\./);
  assert.match(page, /Cincinnati/);
  assert.match(page, /made-up|fictional|fiction/i);
  assert.match(page, /not FAISS/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /id="play"/);
  assert.match(page, /id="step"/);
  assert.match(page, /id="reset"/);
  assert.match(page, /id="mode-ema"/);
  assert.match(page, /id="mode-avg"/);
  assert.match(page, /id="cosine"/);
  assert.match(page, /id="revive"/);
  assert.match(page, /id="finalize"/);
  for (const zone of model.ZONES) {
    assert.match(page, new RegExp(zone.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(page, /0\.00439175/);
  assert.match(page, /0\.8244/);
  assert.match(page, /quality/);
});

test("the page stays local and phone-friendly", () => {
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\.|api[_-]?key|innerHTML/i);
  assert.match(css, /system-ui/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media \(min-width: 720px\)/);
  assert.match(page, /src="\.\/model\.js"/);
  assert.match(page, /src="\.\/app\.js"/);
  assert.match(page, /href="\.\/styles\.css"/);
  assert.match(page, /id="k"[^>]*value="8"/);
  assert.match(page, /id="calls"[^>]*value="8000"/);
  assert.match(page, /id="epochs"[^>]*value="8"/);
  assert.match(page, /id="seed"[^>]*value="7"/);
});

test("the quality law matches the FAISS 1.16 coefficients", () => {
  assert.deepEqual(Array.from(model.QUALITY_BATCH), [0.00439175, 0.134749, 0.876473, 0.813344]);
  assert.deepEqual(Array.from(model.ALPHA_LAW), [0.8244, -0.4617, 0.9003, -0.4498, -0.1057]);
  assert.equal(model.ALPHA_FLOOR, 0.1);
  assert.equal(model.INIT_COUNT, 1e-10);
  assert.equal(model.REVIVE_EVERY, 5);
  assert.equal(model.REVIVE_TAU, 0.1);
  assert.equal(model.SPLIT_DELTA, 1e-4);
  const law = model.scalingLaw(defaults.n, defaults.k, defaults.epochs);
  assert.equal(law.name, "quality");
  assert.equal(law.batchSize, 64);
  assert.equal(law.batchSize & (law.batchSize - 1), 0);
  assert.ok(law.alpha0 > 0.1 && law.alpha0 < 0.3);
  const start = model.scheduledAlpha(0.2, 0, 100);
  const end = model.scheduledAlpha(0.2, 100, 100);
  assert.ok(Math.abs(start - 0.2) < 1e-12);
  assert.ok(Math.abs(end - 0.02) < 1e-12);
  assert.ok(model.scheduledAlpha(0.2, 50, 100) < start && model.scheduledAlpha(0.2, 50, 100) > end);
});

test("the calls are a bounded fictional cloud", () => {
  const calls = model.makeCalls(defaults.n, defaults.seed);
  assert.equal(calls.n, 8000);
  assert.equal(calls.scatterN, 640);
  assert.equal(model.ZONES.length, 10);
  assert.equal(model.SHOP.name, "Oakley Comfort Co.");
  for (let i = 0; i < calls.n; i++) {
    assert.ok(calls.x[i] >= 0.02 && calls.x[i] <= 0.98);
    assert.ok(calls.y[i] >= 0.02 && calls.y[i] <= 0.98);
  }
  const again = model.makeCalls(defaults.n, defaults.seed);
  assert.equal(again.x[0], calls.x[0]);
  assert.equal(again.y[100], calls.y[100]);
});

test("a full batch with alpha 1 matches one Lloyd update", () => {
  const n = 400;
  const race = model.createRace({
    n: n,
    k: 4,
    epochs: 1,
    seed: 7,
    ema: true,
    cosine: false,
    revive: false,
    finalize: false,
    batchSize: n,
    alpha0: 1,
  });
  race.stepBatch();
  race.stepLloyd();
  for (let j = 0; j < 4; j++) {
    assert.ok(Math.abs(race.emaX[j] - race.lloydX[j]) < 1e-8);
    assert.ok(Math.abs(race.emaY[j] - race.lloydY[j]) < 1e-8);
  }
});

test("one step reads a batch, and a finished pass reads every call", () => {
  const calls = model.makeCalls(defaults.n, defaults.seed);
  const race = model.createRace({ ...defaults, points: calls });
  assert.equal(race.lossLloyd[0].loss, race.lossE[0].loss);
  race.stepTogether();
  assert.equal(race.lastTouchedE, 64);
  assert.equal(race.totalTouchedE, 64);
  assert.equal(race.epochsL, 0);
  assert.equal(race.lastTouchedL, 0);
  while (race.epochsE < 1) race.stepTogether();
  assert.equal(race.epochsL, 1);
  assert.equal(race.lastTouchedL, defaults.n);
  assert.equal(race.totalTouchedL, defaults.n);
  assert.equal(race.totalTouchedE, defaults.n);
  assert.ok(race.lossLloyd[1].loss <= race.lossLloyd[0].loss);
});

test("the default EMA run beats Lloyd's 25-pass error in fewer passes", () => {
  const calls = model.makeCalls(defaults.n, defaults.seed);
  const full = run({ points: calls, seed: defaults.seed });
  assert.equal(full.recipe.batchSize, 64);
  assert.ok(full.crossEpoch != null && full.crossEpoch < full.epochs);
  assert.ok(full.crossEpoch < 2);
  const finalE = full.lossE[full.lossE.length - 1].loss;
  const finalL = full.lossLloyd[full.lossLloyd.length - 1].loss;
  assert.ok(finalE < full.lloyd25);
  assert.ok(finalE < finalL);
  assert.ok(full.splits >= 1);
  assert.equal(full.finalized, true);
  assert.ok(full.finalizeDelta != null && full.finalizeDelta <= 0);

  const noRevive = run({ points: calls, seed: defaults.seed, revive: false });
  assert.equal(noRevive.splits, 0);
  assert.ok(noRevive.crossEpoch > full.crossEpoch);

  const average = run({ points: calls, seed: defaults.seed, ema: false });
  assert.equal(average.crossEpoch, null);
  assert.ok(average.lossE[average.lossE.length - 1].loss > full.lloyd25);
  assert.ok(average.lossE[average.lossE.length - 1].loss > finalE);
});
