import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.CiWait;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

test("the lab index links this demo and the source post", () => {
  assert.match(index, /demos\/2026-11-06-ci-wait-auditor\//);
  assert.match(index, /owengretzinger\/status\/2116331367407694118/);
  assert.match(index, /40-minute|40 minute/);
});

test("the page credits Owen Gretzinger and the Boardy write-up", () => {
  assert.match(page, /Owen Gretzinger/);
  assert.match(page, /Boardy/);
  assert.match(page, /How I made our CI 20x faster/);
  assert.match(page, /owengretzinger\/status\/2116331367407694118/);
  assert.match(page, /owengretzinger\/article\/2116291924219060319/);
  assert.match(page, /Cincinnati/);
  assert.match(page, /fictional/i);
  assert.match(page, /Oakley Heating/);
  assert.match(page, /viewport/);
  assert.match(page, /waiting/i);
  assert.match(page, /setup/i);
  assert.match(page, /running/i);
  assert.match(page, /Oxlint/);
  assert.match(page, /bun check/);
  assert.match(page, /isolate:false/);
  assert.match(page, /cache seed from main|Seed the dependency cache from main/);
  assert.match(page, /parallel/i);
  assert.match(page, /Affected-only/);
  assert.match(page, /Pre-push hook/);
  assert.equal(page.match(/class="toggle"/g).length, 8);
  assert.match(page, /agents/i);
});

test("the page stays local", () => {
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\.|api[_-]?key/i);
  assert.match(css, /system-ui/);
});

test("the slow start is 40:00 and waiting is the biggest slice", () => {
  const start = model.scenario(model.blankFlags());
  assert.equal(start.runWall, 2400);
  assert.equal(start.baseline, 2400);
  assert.equal(model.formatDuration(start.runWall), "40:00");
  assert.equal(model.formatDuration(70), "70s");
  assert.equal(model.formatDuration(8), "8s");
  assert.equal(model.formatDuration(120), "2:00");
  assert.equal(start.counted.wait, 1395);
  assert.equal(start.counted.setup, 205);
  assert.equal(start.counted.run, 800);
  assert.ok(start.counted.wait > start.counted.setup);
  assert.ok(start.counted.wait > start.counted.run);
  assert.equal(start.jobs.find((job) => job.id === "tests").wait, 660);
  assert.equal(start.rounds, 2);
  assert.equal(start.untilGreen, 4800);
});

test("each speed fix shrinks its slice and the run", () => {
  const base = model.scenario({});
  const runners = model.scenario({ runners: true });
  assert.ok(runners.jobs.every((job) => job.wait === 8));
  assert.ok(runners.runWall < base.runWall);

  const ox = model.scenario({ oxlint: true });
  assert.equal(ox.jobs.find((job) => job.id === "lint").run, 5);
  assert.equal(ox.runWall, base.runWall - 115);

  const types = model.scenario({ types: true });
  assert.equal(types.jobs.find((job) => job.id === "typecheck").run, 5);
  assert.equal(types.runWall, base.runWall - 65);

  const shards = model.scenario({ shards: true });
  assert.equal(shards.jobs.find((job) => job.id === "tests").run, 35);
  assert.ok(shards.runWall < base.runWall);

  const cache = model.scenario({ cache: true });
  cache.jobs.forEach((job) => {
    const cold = model.JOBS.find((item) => item.id === job.id);
    assert.equal(job.setup, cold.warm);
    assert.ok(job.setup < cold.setup);
  });
  assert.ok(cache.runWall < base.runWall);

  const parallel = model.scenario({ parallel: true });
  assert.equal(parallel.runWall, Math.max(...parallel.jobs.map((job) => job.total)));
  assert.ok(parallel.runWall < parallel.sumWall);

  const affected = model.scenario({ affected: true });
  assert.equal(affected.jobs.find((job) => job.id === "tests").run, 160);
  assert.equal(affected.jobs.find((job) => job.id === "build").run, 95);
  assert.ok(affected.runWall < base.runWall);
});

test("the article order walks 40:00 down to about 2:00", () => {
  const steps = ["runners", "oxlint", "types", "shards", "cache", "parallel", "affected"];
  let flags = {};
  let previous = model.scenario(flags).runWall;
  assert.equal(previous, 2400);
  steps.forEach((key) => {
    flags = { ...flags, [key]: true };
    const next = model.scenario(flags).runWall;
    assert.ok(next < previous, key + " should shorten the run");
    previous = next;
  });
  const all = model.scenario({ ...flags, hook: true });
  assert.equal(all.runWall, 117);
  assert.equal(model.formatDuration(all.runWall), "1:57");
  assert.equal(all.rounds, 1);
  assert.equal(all.untilGreen, 117);
  assert.equal(all.localHook, 9);
  assert.equal(all.jobs.find((job) => job.id === "tests").run, 12);
});

test("the hook cuts a red round and does not lengthen the CI run", () => {
  const off = model.scenario({ runners: true, hook: false });
  const on = model.scenario({ runners: true, hook: true });
  assert.equal(on.runWall, off.runWall);
  assert.equal(off.rounds, 2);
  assert.equal(on.rounds, 1);
  assert.equal(on.untilGreen, on.runWall);
  assert.equal(off.untilGreen, off.runWall * 2);
  assert.equal(on.localHook, 9);
});

test("turning fixes on never makes a single run slower", () => {
  const keys = ["runners", "oxlint", "types", "shards", "cache", "parallel", "affected"];
  for (let mask = 0; mask < 128; mask += 1) {
    const flags = {};
    keys.forEach((key, index) => {
      flags[key] = Boolean(mask & (1 << index));
    });
    const wall = model.scenario(flags).runWall;
    assert.ok(wall <= 2400);
    assert.ok(wall >= 117);
  }
});
