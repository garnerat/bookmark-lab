import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = {
    console,
    Math,
    Number,
    Object,
    String,
    Array,
    Boolean,
    JSON,
    isFinite
  };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.ExpertTierLab;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function sum(list, key) {
  return list.reduce(function (acc, row) { return acc + row[key]; }, 0);
}

function tail(run, n, key) {
  return run.state.history.slice(-n).map(function (row) { return row[key]; });
}

test("the lab index lists this demo after the previous day", function () {
  const previous = index.indexOf("demos/2026-11-24-token-headroom-lab/");
  const here = index.indexOf("demos/2026-11-25-expert-tier-cache/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-25: Expert Tier Cache Lab/);
  assert.match(card, /Copperline Physical Therapy/);
  assert.match(card, /fictional/);
  assert.match(card, /Mac mini/);
  assert.match(card, /nickbaumann_\/status\/2125358178690838963/);
  assert.match(card, /Source post/);
  assert.doesNotMatch(card, /HVAC|heating|cooling|furnace/i);
});

test("the page names the simulation, the clinic, and both posts", function () {
  assert.match(page, /Expert Tier Cache Lab/);
  assert.match(page, /Illustrative simulation/);
  assert.match(page, /not Magnitude's code or benchmarks/);
  assert.match(page, /Made-up numbers/);
  assert.match(page, /Copperline Physical Therapy/);
  assert.match(page, /fictional/);
  assert.match(page, /Mara Ellison/);
  assert.match(page, /Jonah Peck/);
  assert.match(page, /June Harlow/);
  assert.match(page, /Chris Adel/);
  assert.match(page, /office Mac mini/);
  assert.match(page, /claimed by the author/i);
  assert.match(page, /54 tok\/s/);
  assert.match(page, /Qwen 3\.8 Flash Next/);
  assert.match(page, /Mac mini M5 Pro/);
  assert.match(page, /2-bit/);
  assert.match(page, /64k context/);
  assert.match(page, /Apache-2\.0/);
  assert.match(page, /about 5%/);
  assert.match(page, /zero SSD wear/);
  assert.match(page, /VRAM/);
  assert.match(page, /Frequency/);
  assert.match(page, /LRU/);
  assert.match(page, /SATA/);
  assert.match(page, /PCIe 4/);
  assert.match(page, /PCIe 5/);
  assert.match(page, /Misprediction/);
  assert.match(page, /Try it for real/);
  assert.match(page, /nickbaumann_\/status\/2125358178690838963/);
  assert.match(page, /tomgreenwald\/status\/2125348896805175791/);
  assert.match(page, /github\.com\/magnitudedev\/magnitude/);
  assert.match(page, /magnitude\.dev\/download/);
  assert.match(page, /docs\.magnitude\.dev/);
  assert.match(page, /viewport-fit=cover/);
  assert.match(page, /<noscript>/);
  assert.match(bundle, /8 MiB/);
  assert.match(bundle, /256/);
  assert.doesNotMatch(bundle, /HVAC|heating|cooling|furnace|air conditioning/i);
  assert.doesNotMatch(bundle, /sk-[A-Za-z0-9]|api[_-]?key|password\s*[:=]/i);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|WebSocket|innerHTML|localStorage/);
});

test("styles stay phone-friendly", function () {
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /@media \(min-width: 800px\)/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(page, /viewport-fit=cover/);
});

test("external links stay on the documented set", function () {
  const urls = bundle.match(/https?:\/\/[^\s"'<>)]+/g) || [];
  assert.ok(urls.length >= 8);
  urls.forEach(function (url) {
    if (url === "http://www.w3.org/2000/svg") return;
    assert.match(url, /^https:\/\/(?:x\.com\/nickbaumann_\/status\/2125358178690838963|x\.com\/tomgreenwald\/status\/2125348896805175791|github\.com\/magnitudedev\/magnitude|magnitude\.dev(?:\/(?:download|benchmarks))?|docs\.magnitude\.dev(?:\/(?:hardware|faq))?)(?:[),.]|$)/);
  });
});

test("the toy layer routes 12 of 256, and the clinic script is fictional", function () {
  assert.equal(model.EXPERTS, 256);
  assert.equal(model.ACTIVE, 12);
  assert.equal(model.BYTES_PER_EXPERT, 8 * 1024 * 1024);
  assert.equal(model.CLINIC, "Copperline Physical Therapy");
  assert.match(model.scriptText("note"), /Mara Ellison/);
  assert.match(model.scriptText("mixed"), /Jonah Peck/);
  assert.match(model.scriptText("mixed"), /June Harlow/);
  assert.match(model.scriptText("mixed"), /Chris Adel/);
  assert.ok(model.script("note").every(function (token) { return token.topic === 0; }));
  assert.ok(model.script("mixed").some(function (token) { return token.topic === 1; }));
  assert.ok(model.script("mixed").some(function (token) { return token.topic === 3; }));
  assert.doesNotMatch(model.scriptText("note") + model.scriptText("mixed"), /HVAC|heating|cooling|furnace/i);
});

test("cold SSD tiers order SATA under PCIe 4 under PCIe 5, and none of them is 54", function () {
  function cold(ssd) {
    return model.run({
      tokens: 1,
      skew: 0,
      prefetch: false,
      ssd: ssd,
      vramSlots: 24,
      ramSlots: 48,
      scenario: "note",
      policy: "lru"
    }).last;
  }
  const sata = cold("sata");
  const pcie4 = cold("pcie4");
  const pcie5 = cold("pcie5");
  assert.equal(sata.ssdMisses, 12);
  assert.equal(sata.vramHits + sata.ramHits + sata.ssdMisses, 12);
  assert.equal(sata.ssdBytes, 12 * model.BYTES_PER_EXPERT);
  assert.ok(sata.tokPerSec < pcie4.tokPerSec);
  assert.ok(pcie4.tokPerSec < pcie5.tokPerSec);
  assert.ok(pcie5.tokPerSec < 52);
  assert.notEqual(Math.round(sata.tokPerSec), 54);
  assert.notEqual(Math.round(pcie4.tokPerSec), 54);
  assert.notEqual(Math.round(pcie5.tokPerSec), 54);
  assert.match(model.describe(sata), /12 streamed SSD → RAM → VRAM/);
});

test("a concentrated note warms, and near-uniform routing keeps reading the SSD", function () {
  const base = {
    tokens: 36,
    vramSlots: 24,
    ramSlots: 48,
    prefetch: false,
    policy: "lfu",
    ssd: "pcie4",
    scenario: "note"
  };
  const warm = model.run(Object.assign({}, base, { skew: 1 }));
  const flat = model.run(Object.assign({}, base, { skew: 0 }));
  const warmSsd = sum(warm.state.history.slice(-8), "ssdMisses");
  const flatSsd = sum(flat.state.history.slice(-8), "ssdMisses");
  assert.equal(warmSsd, 0);
  assert.ok(warm.state.history[0].ssdMisses > warm.state.history[35].ssdMisses);
  assert.ok(warm.state.history[35].tokPerSec > warm.state.history[0].tokPerSec);
  assert.ok(warm.state.history[35].tokPerSec > 70);
  assert.ok(flatSsd > 40);
  assert.ok(tail(flat, 8, "tokPerSec").every(function (n) { return n < warm.state.history[35].tokPerSec; }));
});

test("topic hopping misses after a single note would have warmed", function () {
  const base = {
    tokens: 40,
    skew: 1,
    vramSlots: 24,
    ramSlots: 48,
    prefetch: false,
    policy: "lru",
    ssd: "pcie4"
  };
  const note = model.run(Object.assign({ scenario: "note" }, base));
  const mixed = model.run(Object.assign({ scenario: "mixed" }, base));
  assert.equal(sum(note.state.history.slice(-12), "ssdMisses"), 0);
  assert.ok(sum(mixed.state.history.slice(-12), "ssdMisses") > 0);
});

test("VRAM under the active set falls off a cliff", function () {
  const base = {
    tokens: 24,
    skew: 1,
    ramSlots: 48,
    prefetch: false,
    policy: "lfu",
    scenario: "note",
    ssd: "pcie4"
  };
  const wide = model.run(Object.assign({ vramSlots: 24 }, base));
  const narrow = model.run(Object.assign({ vramSlots: 8 }, base));
  assert.equal(wide.last.cliff, false);
  assert.equal(narrow.last.cliff, true);
  assert.equal(narrow.last.shortfall, 4);
  assert.ok(wide.last.tokPerSec > 70);
  assert.ok(narrow.last.tokPerSec < 10);
  assert.ok(wide.last.tokPerSec > narrow.last.tokPerSec * 4);
});

test("prefetch helps when the guess is right and wastes reads when it is wrong", function () {
  const base = {
    tokens: 1,
    skew: 0,
    vramSlots: 24,
    ramSlots: 48,
    scenario: "note",
    policy: "lru",
    ssd: "pcie4"
  };
  const off = model.run(Object.assign({ prefetch: false, mispredict: 0 }, base)).last;
  const good = model.run(Object.assign({ prefetch: true, mispredict: 0 }, base)).last;
  const bad = model.run(Object.assign({ prefetch: true, mispredict: 1 }, base)).last;
  assert.equal(off.wastedReads, 0);
  assert.equal(good.wastedReads, 0);
  assert.equal(good.ssdMisses, 0);
  assert.equal(good.prefetchReads, 12);
  assert.equal(good.ssdBytes, off.ssdBytes);
  assert.ok(good.tokPerSec > off.tokPerSec);
  assert.equal(bad.wastedReads, 12);
  assert.equal(new Set(bad.wastedIds).size, 12);
  assert.ok(bad.wastedIds.every(function (id) { return bad.route.indexOf(id) === -1; }));
  assert.equal(bad.wastedBytes, 12 * model.BYTES_PER_EXPERT);
  assert.ok(bad.ssdBytes > good.ssdBytes);
  assert.ok(bad.tokPerSec < off.tokPerSec);
  assert.deepEqual(off.route, good.route);
  assert.deepEqual(off.route, bad.route);
});

test("frequency keeps a hot set that LRU lets a scan push out", function () {
  function back(policy) {
    const state = model.create({
      vramSlots: 12,
      ramSlots: 24,
      policy: policy,
      prefetch: false,
      skew: 1,
      scenario: "note",
      ssd: "pcie4"
    });
    const setA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const setB = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111];
    let i;
    for (i = 0; i < 20; i++) model.step(state, setA);
    model.step(state, setB);
    return model.step(state, setA);
  }
  const lfu = back("lfu");
  const lru = back("lru");
  assert.ok(lfu.vramHits >= 11);
  assert.equal(lru.vramHits, 0);
  assert.equal(lru.ramHits, 12);
  assert.ok(lfu.vramHits > lru.vramHits);
});

test("a wrong prefetch stays slower once the hot experts already sit in VRAM", function () {
  const base = {
    tokens: 28,
    skew: 1,
    vramSlots: 24,
    ramSlots: 48,
    scenario: "note",
    policy: "lfu",
    ssd: "pcie4",
    prefetch: true
  };
  const right = model.run(Object.assign({ mispredict: 0 }, base));
  const wrong = model.run(Object.assign({ mispredict: 1 }, base));
  assert.equal(right.last.wastedReads, 0);
  assert.ok(wrong.last.wastedReads > 0);
  assert.ok(right.last.tokPerSec > 70);
  assert.ok(wrong.last.tokPerSec < right.last.tokPerSec - 15);
});

test("the same settings replay the same routes", function () {
  const config = { tokens: 6, skew: 0.4, prefetch: true, mispredict: 0.35, seed: 3, scenario: "mixed" };
  const a = model.run(config);
  const b = model.run(config);
  assert.deepEqual(
    a.state.history.map(function (row) { return row.route; }),
    b.state.history.map(function (row) { return row.route; })
  );
  assert.equal(a.last.vramHits + a.last.ramHits + a.last.ssdMisses, 12);
});
