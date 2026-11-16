import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String, Array, JSON };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.StreamingVoiceOrder;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function item(parsed, index) {
  return parsed.items[index];
}

test("the lab index lists this demo after the previous day", () => {
  const previous = index.indexOf("demos/2026-11-14-autoresearch-loop-lab/");
  const here = index.indexOf("demos/2026-11-15-streaming-voice-order/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-15: Streaming voice-to-UI/);
  assert.match(card, /Ember &amp; Oak Coffee|Ember & Oak Coffee/);
  assert.match(card, /kunalabcdani\/status\/2119892841723990319/);
  assert.match(card, /Source post/);
  assert.doesNotMatch(card, /HVAC|dental|law firm|heating|cooling|plumbing|roofing/i);
});

test("the page cites the post and labels itself as an illustration", () => {
  assert.match(page, /kunalabcdani\/status\/2119892841723990319/);
  assert.match(page, /Andrew bookmarked/);
  assert.match(page, /9 Nov 2026/);
  assert.match(page, /What if we could manipulate UI at the speed of thought\?/);
  assert.match(page, /@typesafeai Jev/);
  assert.match(page, /~200 ms from word to screen/);
  assert.match(page, /Ember &amp; Oak Coffee/);
  assert.match(page, /illustration/i);
  assert.match(page, /not Jev/i);
  assert.match(page, /fiction/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /a large oat latte, actually make it iced, and um, no, medium, plus a croissant/);
  assert.match(page, /webkitSpeechRecognition/);
  assert.match(page, /interimResults/);
  assert.match(page, /Try it in under an hour/);
  assert.match(page, /Why this matters for a small business/);
  assert.match(page, /drive-thru/);
  assert.match(page, /actually/);
  assert.match(page, /scratch that/);
  assert.equal(model.SOURCE.postId, "2119892841723990319");
  assert.equal(model.SOURCE.handle, "kunalabcdani");
  assert.equal(model.SHOP, "Ember & Oak Coffee");
  assert.match(page, new RegExp(model.SOURCE.quote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("the page stays local and off the forbidden trades", () => {
  assert.doesNotMatch(bundle, /HVAC|dental|law firm|heating|cooling|plumbing|roofing/i);
  assert.doesNotMatch(app + source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
  assert.doesNotMatch(page, /src="https?:|fonts\.googleapis|cdn\.|unpkg|jsdelivr/);
  assert.match(page, /src="\.\/model\.js"/);
  assert.match(page, /src="\.\/app\.js"/);
  assert.match(page, /href="\.\/styles\.css"/);
  assert.doesNotMatch(bundle, /api[_-]?key|secret|password|token/i);
});

test("controls, the latency slider, and reduced motion are wired", () => {
  assert.match(page, /id="play"/);
  assert.match(page, /Play sample utterance/);
  assert.match(page, /id="reset"/);
  assert.match(page, /id="mic"/);
  assert.match(page, /Start microphone/);
  assert.match(page, /id="utterance"/);
  assert.match(page, /id="latency"[^>]*min="300"[^>]*max="3000"[^>]*step="100"[^>]*value="1200"/);
  assert.match(page, /id="mode-rederive"/);
  assert.match(page, /id="mode-naive"/);
  assert.match(page, /id="speed-normal"/);
  assert.match(page, /id="speed-fast"/);
  assert.match(page, /id="copy"/);
  assert.match(app, /interimResults\s*=\s*true/);
  assert.match(app, /webkitSpeechRecognition/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(min-width: 760px\)/);
  assert.equal(model.WPM, 150);
  assert.equal(model.WORD_MS, 400);
  assert.equal(model.WORD_MS, 60000 / model.WPM);
  assert.equal(model.SILENCE_MS, 700);
  assert.equal(model.DEFAULTS.modelLatencyMs, 1200);
  assert.equal(model.RANGES.latency.min, 300);
  assert.equal(model.RANGES.latency.max, 3000);
  assert.equal(model.clampLatency(50), 300);
  assert.equal(model.clampLatency(9000), 3000);
  assert.equal(model.clampLatency("nope"), 1200);
});

test("the sample sentence becomes one corrected drink and a croissant", () => {
  const spoken = "a large oat latte, actually make it iced, and um, no, medium, plus a croissant";
  const parsed = model.parseTranscript(spoken);
  assert.equal(parsed.items.length, 2);
  assert.equal(JSON.stringify(item(parsed, 0)), JSON.stringify({
    kind: "drink",
    name: "latte",
    size: "medium",
    milk: "oat",
    temp: "iced",
    tempSpoken: true,
    extraShot: false,
    syrups: [],
  }));
  assert.equal(item(parsed, 1).kind, "pastry");
  assert.equal(item(parsed, 1).name, "croissant");
  assert.equal(model.summary(parsed.items), "Latte (Iced, Medium, Oat milk); Croissant");
  const rewritten = model.parseTranscript("I'll have a large oat latte actually make it iced and um no medium plus a croissant");
  assert.equal(model.ordersEqual(parsed.items, rewritten.items), true);
  assert.equal(model.parseTranscript("a large oat").items.length, 0);
  assert.equal(model.parseTranscript("a large oat").pending.size, "large");
  assert.equal(model.parseTranscript("a large oat").pending.milk, "oat");
  assert.equal(model.parseTranscript("a large oat latte").items[0].temp, "hot");
  assert.equal(model.parseTranscript("a large oat latte").items[0].size, "large");
});

test("correction words replace instead of stacking", () => {
  assert.equal(model.parseTranscript("latte scratch that").items.length, 0);
  assert.equal(model.parseTranscript("latte plus a croissant scratch that").items.length, 1);
  assert.equal(model.parseTranscript("latte plus a croissant scratch that").items[0].name, "latte");
  const milk = model.parseTranscript("large almond cortado instead oat").items[0];
  assert.equal(milk.name, "cortado");
  assert.equal(milk.size, "large");
  assert.equal(milk.milk, "oat");
  assert.equal(model.parseTranscript("chai actually a matcha").items[0].name, "matcha");
  assert.equal(model.parseTranscript("latte make that a cortado").items[0].name, "cortado");
  assert.equal(model.parseTranscript("latte actually a cold brew").items[0].name, "cold brew");
  assert.equal(model.parseTranscript("latte actually a cold brew").items[0].temp, "iced");
  const syrup = model.parseTranscript("vanilla iced latte extra shot").items[0];
  assert.equal(syrup.temp, "iced");
  assert.equal(syrup.extraShot, true);
  assert.equal(JSON.stringify(syrup.syrups), JSON.stringify(["vanilla"]));
  const pair = model.parseTranscript("small hot chai and a muffin");
  assert.equal(pair.items[0].name, "chai");
  assert.equal(pair.items[0].size, "small");
  assert.equal(pair.items[0].temp, "hot");
  assert.equal(pair.items[1].name, "muffin");
  assert.equal(model.parseTranscript("cold brew").items[0].temp, "iced");
  assert.equal(model.parseTranscript("hot cold brew").items[0].temp, "hot");
  assert.equal(model.parseTranscript("um uh please").items.length, 0);
  assert.equal(model.parseTranscript("").items.length, 0);
  assert.equal(model.parseTranscript("a latte and a latte").items.length, 2);
  assert.equal(model.parseTranscript("medium soy chai with hazelnut").items[0].syrups[0], "hazelnut");
  assert.equal(JSON.stringify(model.parseTranscript("latte with caramel and hazelnut").items[0].syrups), JSON.stringify(["caramel", "hazelnut"]));
  assert.equal(model.parseTranscript("banana bread and an oat matcha").items[0].name, "banana bread");
  assert.equal(model.parseTranscript("banana bread and an oat matcha").items[1].milk, "oat");
  const again = model.parseTranscript(spokenSafe());
  assert.equal(JSON.stringify(again), JSON.stringify(model.parseTranscript(spokenSafe())));
});

function spokenSafe() {
  return model.SAMPLE_SENTENCE;
}

test("re-derive is idempotent and naive append doubles on a rewrite", () => {
  let state = model.emptyState();
  state = model.applyHypothesis(state, "a large oat latte", "rederive");
  const again = model.applyHypothesis(state, "a large oat latte", "rederive");
  assert.equal(model.countName(again.items, "latte"), 1);
  assert.equal(model.ordersEqual(again.items, model.parseTranscript("a large oat latte").items), true);
  const rewritten = model.applyHypothesis(again, "I'll have a large oat latte", "rederive");
  assert.equal(model.countName(rewritten.items, "latte"), 1);

  let naive = model.emptyState();
  naive = model.applyHypothesis(naive, "a large oat latte", "naive");
  assert.equal(model.countName(naive.items, "latte"), 1);
  const same = model.applyHypothesis(naive, "a large oat latte", "naive");
  assert.equal(model.countName(same.items, "latte"), 1);
  const doubled = model.applyHypothesis(same, "I'll have a large oat latte", "naive");
  assert.equal(model.countName(doubled.items, "latte"), 2);
  assert.equal(doubled.patches[0].duplicate, true);
  assert.equal(doubled.patches[0].reason, "rewrite");
});

test("the sample clock shows the streaming gap and the naive duplicate", () => {
  const run = model.simulate();
  assert.equal(run.events.length, 16);
  assert.equal(run.events[3].word, "latte");
  assert.equal(run.drinkWordAt, 1200);
  assert.equal(run.events[4].type, "rewrite");
  assert.equal(run.events[4].at, 1400);
  assert.equal(run.speechMs, 5600);
  assert.equal(run.silenceAt, 6300);
  assert.equal(run.endRenderAt, 7500);
  assert.equal(run.streaming.drinkSeenAt, 1200);
  assert.equal(run.streaming.drinkLatencyMs, 0);
  assert.equal(run.endOfTurn.drinkSeenAt, 7500);
  assert.equal(run.endOfTurn.drinkLatencyMs, 6300);
  assert.equal(run.gapMs, 6300);
  assert.equal(run.stillSpeakingMs, 4400);
  assert.equal(run.streaming.latteCount, 1);
  assert.equal(run.endOfTurn.latteCount, 1);
  assert.equal(model.summary(run.streaming.items), "Latte (Iced, Medium, Oat milk); Croissant");
  assert.equal(model.summary(run.endOfTurn.items), model.summary(run.streaming.items));
  const labels = run.streaming.changes.map((row) => model.formatClock(row.at) + " " + row.label).join("\n");
  assert.equal(labels, [
    "0.4s set size large · waiting for the drink",
    "0.8s set milk oat · waiting for the drink",
    "1.2s add latte",
    "1.2s set hot · default",
    "2.8s set iced · actually",
    "4.4s set size medium · was large · no",
    "5.6s add croissant",
  ].join("\n"));
  assert.equal(run.streaming.changes[4].endLatencyMs, 7500 - 2800);
  assert.equal(run.streaming.changes[0].streamLatencyMs, 0);

  const slow = model.simulate({ modelLatencyMs: 300 });
  const long = model.simulate({ modelLatencyMs: 3000 });
  assert.equal(slow.endRenderAt, 6600);
  assert.equal(slow.endOfTurn.drinkLatencyMs, 5400);
  assert.equal(long.endRenderAt, 9300);
  assert.equal(long.endOfTurn.drinkLatencyMs, 8100);

  const naive = model.simulate({ applyMode: "naive" });
  assert.equal(naive.streaming.latteCount, 2);
  assert.equal(naive.endOfTurn.latteCount, 1);
  assert.equal(naive.streaming.items[0].temp, "hot");
  assert.equal(naive.streaming.items[0].size, "large");
  assert.equal(naive.streaming.items[1].temp, "iced");
  assert.equal(naive.streaming.items[1].size, "medium");
  assert.equal(naive.streaming.items[1].milk, "oat");
  assert.equal(naive.streaming.items[2].name, "croissant");
  assert.equal(naive.streaming.changes.some((row) => row.duplicate && row.at === 1400), true);
  assert.equal(model.ordersEqual(naive.endOfTurn.items, run.endOfTurn.items), true);
});
