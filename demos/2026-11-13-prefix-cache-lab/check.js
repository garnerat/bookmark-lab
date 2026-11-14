import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.PrefixCacheLab;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function everyRow(run, fn) {
  ["cache", "nocache"].forEach((mode) => {
    const result = model.simulate(Object.assign({}, run, { mode }));
    result.rows.forEach((row) => fn(row, result));
  });
}

test("the lab index lists this demo after the previous day", () => {
  const previous = index.indexOf("demos/2026-11-12-emeans-race/");
  const here = index.indexOf("demos/2026-11-13-prefix-cache-lab/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  assert.match(index, /2026-11-13: Prefix cache lab/);
  assert.match(index, /CerebralCoding_\/status\/2120803634833137891/);
  assert.match(index, /Source post/);
  assert.match(index, /law firm/);
});

test("the page cites the post and labels the simulation", () => {
  assert.match(page, /CerebralCoding_\/status\/2120803634833137891/);
  assert.match(page, /Andrew bookmarked/);
  assert.match(page, /Your Mac was never slow at long chats/);
  assert.match(page, /Qwen 3\.8 27B/);
  assert.match(page, /64GB M5 Pro Mac mini/);
  assert.match(page, /TensorFold/);
  assert.match(page, /1\.2\.6/);
  assert.match(page, /1\.2\.7/);
  assert.match(page, /24K tokens/);
  assert.match(page, /76\.8s/);
  assert.match(page, /34K/);
  assert.match(page, /0\.34 to 1\.19s/);
  assert.match(page, /312\.5/);
  assert.match(page, /Brindle &amp; Quill/);
  assert.match(page, /Northwharf Studio/);
  assert.match(page, /Ashwick/);
  assert.match(page, /fictional|fiction/);
  assert.match(page, /simulated/i);
  assert.match(page, /not a measurement/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /50 ms/);
  assert.match(page, /cache_prompt/);
  assert.match(page, /id_slot/);
  assert.match(page, /--cache-prompt/);
  assert.match(page, /--no-cache-prompt/);
  assert.match(page, /9931/);
  assert.match(page, /prompt_eval_cached_count/);
  assert.match(page, /Check the runtime/);
  assert.match(page, /ggml-org\/llama\.cpp\/blob\/master\/tools\/server\/README\.md/);
  assert.match(page, /Approximate|approximate/);
  assert.match(page, /262,144/);
  assert.equal(model.SOURCE.rereadSeconds, 76.8);
  assert.equal(model.SOURCE.rereadTokens, 24000);
  assert.equal(model.SOURCE.ttftLow, 0.34);
  assert.equal(model.SOURCE.ttftHigh, 1.19);
  assert.equal(model.SOURCE.cachedTokens, 34000);
});

test("the page stays local and off the forbidden trades", () => {
  assert.doesNotMatch(bundle, /HVAC|roofing|plumbing|accounting/i);
  assert.doesNotMatch(bundle, /\$\d/);
  assert.doesNotMatch(app + source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
  assert.doesNotMatch(page, /src="https?:|fonts\.googleapis|cdn\.|unpkg|jsdelivr/);
  assert.match(page, /src="\.\/model\.js"/);
  assert.match(page, /src="\.\/app\.js"/);
  assert.match(page, /href="\.\/styles\.css"/);
});

test("controls, motion, and the 50 ms scale are wired", () => {
  assert.match(page, /id="prefill"[^>]*min="50"[^>]*max="2000"[^>]*step="5"[^>]*value="315"/);
  assert.match(page, /id="contract"[^>]*min="4000"[^>]*max="48000"[^>]*step="1000"[^>]*value="22000"/);
  assert.match(page, /id="turns"[^>]*min="2"[^>]*max="8"[^>]*step="1"[^>]*value="4"/);
  assert.match(page, /id="mode-nocache"/);
  assert.match(page, /id="mode-cache"/);
  assert.match(page, /id="breaker-timestamp"/);
  assert.match(page, /id="breaker-edit"/);
  assert.match(page, /id="play"/);
  assert.match(app, /ANIMATION_MS_PER_SIM_SECOND/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.equal(model.ANIMATION_MS_PER_SIM_SECOND, 50);
  assert.equal(model.RANGES.prefillTokPerSec.min, 50);
  assert.equal(model.RANGES.prefillTokPerSec.max, 2000);
  assert.equal(model.RANGES.contractTokens.min, 4000);
  assert.equal(model.RANGES.contractTokens.max, 48000);
  assert.equal(model.RANGES.turns.max, model.TURNS.length);
});

test("the default opening prefix is 24,000 scripted tokens", () => {
  const result = model.simulate();
  assert.equal(model.SYSTEM_TOKENS + model.LETTER_TOKENS + model.DEFAULTS.contractTokens, 24000);
  assert.equal(result.stableHead, 24000);
  assert.equal(result.input.mode, "cache");
  assert.equal(result.input.breaker, "none");
  assert.equal(result.rows.length, 4);
  assert.equal(result.rows[0].kind, "cold");
  assert.equal(result.rows[0].cachedTokens, 0);
  assert.equal(result.rows[0].prefixTokens, 24000);
  assert.equal(result.rows[0].newTokens, model.QUESTION_TOKENS);
  assert.equal(result.rows[0].recomputeTokens, 24040);
  assert.equal(result.rows[0].ttftSeconds, 24040 / 315);
  result.rows.slice(1).forEach((row) => {
    assert.equal(row.kind, "hit");
    assert.equal(row.recomputeTokens, model.QUESTION_TOKENS);
    assert.equal(row.recomputedPrefixTokens, 0);
    assert.equal(row.ttftSeconds, model.QUESTION_TOKENS / 315);
  });
  const ref = model.SOURCE.rereadTokens / model.DEFAULTS.prefillTokPerSec;
  assert.ok(Math.abs(ref - 76.190476) < 0.001);
  assert.ok(Math.abs(model.SOURCE.rereadTokens / model.SOURCE.rereadSeconds - 312.5) < 1e-9);
});

test("no cache prefills the whole history, and the first turn matches", () => {
  const cached = model.simulate({ mode: "cache" });
  const plain = model.simulate({ mode: "nocache" });
  assert.equal(plain.rows[0].ttftSeconds, cached.rows[0].ttftSeconds);
  plain.rows.forEach((row, i) => {
    assert.equal(row.kind, "full");
    assert.equal(row.cachedTokens, 0);
    assert.equal(row.recomputeTokens, row.prefixTokens + row.newTokens);
    if (i > 0) assert.ok(row.recomputeTokens > cached.rows[i].recomputeTokens);
  });
  assert.ok(plain.totals.nocacheSeconds > cached.totals.cacheSeconds);
  assert.ok(cached.totals.followupSpeedup > cached.totals.speedup);
  assert.ok(cached.totals.speedup > 3);
  assert.ok(cached.totals.followupSpeedup > 100);
});

test("a timestamp at the top makes the cache miss on every turn", () => {
  const cached = model.simulate({ breaker: "timestamp", mode: "cache" });
  const plain = model.simulate({ breaker: "timestamp", mode: "nocache" });
  assert.equal(cached.totals.speedup, 1);
  cached.rows.forEach((row, i) => {
    assert.equal(row.kind, "timestamp");
    assert.equal(row.cachedTokens, 0);
    assert.equal(row.prefixTokens, plain.rows[i].prefixTokens);
    assert.equal(row.recomputeTokens, plain.rows[i].recomputeTokens);
    assert.ok(row.prefixTokens >= model.TIMESTAMP_TOKENS + cached.stableHead);
    assert.notEqual(row.clock, cached.rows[(i + 1) % cached.rows.length].clock);
  });
});

test("editing an early message invalidates only the tail, then the cache hits again", () => {
  const edited = model.simulate({ breaker: "edit", mode: "cache", turns: 4 });
  assert.equal(edited.editIndex, 2);
  assert.equal(edited.editRecovers, true);
  assert.equal(edited.rows[0].kind, "cold");
  assert.equal(edited.rows[1].kind, "hit");
  const spike = edited.rows[2];
  assert.equal(spike.kind, "edit");
  assert.equal(spike.cachedTokens, 24000);
  assert.equal(spike.recomputedPrefixTokens, 2 * (model.QUESTION_TOKENS + model.ANSWER_TOKENS));
  assert.equal(spike.recomputeTokens, spike.recomputedPrefixTokens + model.QUESTION_TOKENS);
  assert.ok(spike.ttftSeconds > edited.rows[1].ttftSeconds);
  assert.ok(spike.ttftSeconds < model.simulate({ breaker: "edit", mode: "nocache", turns: 4 }).rows[2].ttftSeconds);
  assert.equal(edited.rows[3].kind, "hit");
  assert.equal(edited.rows[3].recomputeTokens, model.QUESTION_TOKENS);
  assert.match(source, /What notice does either party give to end the agreement\?/);

  const short = model.simulate({ breaker: "edit", turns: 2 });
  assert.equal(short.editIndex, 1);
  assert.equal(short.editRecovers, false);
  assert.equal(short.rows[1].kind, "edit");
});

test("cached plus recomputed equals the prompt, for every mode and breaker", () => {
  ["none", "timestamp", "edit"].forEach((breaker) => {
    everyRow({ breaker, turns: 8, contractTokens: 22000, prefillTokPerSec: 315 }, (row) => {
      assert.equal(row.cachedTokens + row.recomputeTokens, row.prefixTokens + row.newTokens);
      assert.equal(row.recomputedPrefixTokens + row.newTokens, row.recomputeTokens);
      assert.equal(row.cachedTokens + row.recomputedPrefixTokens, row.prefixTokens);
      assert.equal(row.ttftSeconds, row.recomputeTokens / 315);
      assert.ok(row.cachedTokens >= 0);
      assert.ok(row.recomputeTokens > 0);
    });
  });
});

test("speed and document length move the wait in straight lines", () => {
  const slow = model.simulate({ prefillTokPerSec: 315, mode: "nocache" });
  const fast = model.simulate({ prefillTokPerSec: 630, mode: "nocache" });
  assert.ok(Math.abs(slow.totals.nocacheSeconds / fast.totals.nocacheSeconds - 2) < 1e-9);
  const small = model.simulate({ contractTokens: 10000 });
  const big = model.simulate({ contractTokens: 30000 });
  assert.equal(small.totals.followupCacheSeconds, big.totals.followupCacheSeconds);
  assert.ok(big.totals.followupNocacheSeconds > small.totals.followupNocacheSeconds);
  assert.equal(big.memory.contextTokens - small.memory.contextTokens, 20000);
  assert.equal(big.memory.bytes - small.memory.bytes, 20000 * model.KV_BYTES_PER_TOKEN);
});

test("the memory sketch is labeled math, and it grows with the conversation", () => {
  assert.equal(model.KV_BYTES_PER_TOKEN, 262144);
  const result = model.simulate();
  const expectedTokens = 24000 + 4 * (model.QUESTION_TOKENS + model.ANSWER_TOKENS);
  assert.equal(result.memory.contextTokens, expectedTokens);
  assert.equal(result.memory.bytes, expectedTokens * 262144);
  assert.equal(result.memory.gigabytes, result.memory.bytes / (1024 ** 3));
  assert.ok(result.memory.fractionOfMachine < 0.2);
  assert.equal(JSON.stringify(model.simulate()), JSON.stringify(model.simulate()));
});

test("inputs clamp, and the questions stay inside the turn slider", () => {
  const hi = model.simulate({
    prefillTokPerSec: 99999,
    contractTokens: 1,
    turns: 100,
    mode: "nope",
    breaker: "nope",
  });
  assert.equal(hi.input.prefillTokPerSec, 2000);
  assert.equal(hi.input.contractTokens, 4000);
  assert.equal(hi.input.turns, 8);
  assert.equal(hi.input.mode, "cache");
  assert.equal(hi.input.breaker, "none");
  assert.equal(hi.rows.length, model.TURNS.length);
  model.TURNS.forEach((turn) => {
    assert.match(source, new RegExp(turn.question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(turn.answer.length > 20);
  });
});

test("a cached replay is a few seconds of screen time and a full re-read is much longer", () => {
  const cached = model.simulate();
  const plain = model.simulate({ mode: "nocache" });
  const scale = model.ANIMATION_MS_PER_SIM_SECOND;
  const cachedMs = cached.rows.reduce((total, row) => total + row.ttftSeconds * scale, 0);
  const plainMs = plain.rows.reduce((total, row) => total + row.ttftSeconds * scale, 0);
  assert.ok(cachedMs > 3500 && cachedMs < 4500);
  assert.ok(plainMs > cachedMs * 3);
});
