import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String, Array, Boolean, JSON };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.MoeMacFit;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

test("the lab index lists this demo after the previous day", () => {
  const previous = index.indexOf("demos/2026-11-15-streaming-voice-order/");
  const here = index.indexOf("demos/2026-11-16-moe-mac-fit/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-16: Will this MoE fit my Mac\?/);
  assert.match(card, /Ledger &amp; Lane Accounting/);
  assert.match(card, /6-person accounting practice/);
  assert.match(card, /client tax documents never leave the building/);
  assert.match(card, /CerebralCoding_\/status\/2122252697025892538/);
  assert.match(card, /Source post/);
});

test("the page cites both posts and labels every speed as an estimate", () => {
  assert.match(page, /CerebralCoding_\/status\/2122252697025892538/);
  assert.match(page, /superalesha\/status\/2122220065932148876/);
  assert.match(page, /Andrew bookmarked/);
  assert.match(page, /16 Nov 2026/);
  assert.match(page, /Your 128GB Mac was never too small for a frontier MoE/);
  assert.match(page, /The MoEs were too fat/);
  assert.match(page, /about 80GB of real weights at 4-bit/);
  assert.match(page, /about 290GB of FP4 experts alone/);
  assert.match(page, /Engram lookup table/);
  assert.match(page, /Weights aren't public yet/);
  assert.match(page, /1M context/);
  assert.match(page, /ivanfioravanti/);
  assert.match(page, /32–64 GB/);
  assert.match(page, /\(224B − 64B\) × 4 bits \/ 8 = 80 GB/);
  assert.match(page, /224B × 4 bits \/ 8 = 112 GB/);
  assert.match(page, /12B × 4 bits \/ 8 = 6 GB/);
  assert.match(page, /Rough back-of-envelope estimate, not a benchmark/);
  assert.match(page, /The model figures come from the linked posts/);
  assert.match(page, /decimal/);
  assert.match(page, /3\.2/);
  assert.match(page, /not 3\.2/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /llama-cli/);
  assert.match(page, /mlx_lm\.generate/);
  assert.match(page, /Q4_K_M/);
  assert.match(page, /Ledger &amp; Lane Accounting/);
  assert.match(page, /6-person accounting practice/);
  assert.match(page, /private local model on one office Mac/);
  assert.match(page, /client tax documents never leave the building/);
  assert.match(page, /fiction/);
  assert.equal(model.POSTS.bookmark.id, "2122252697025892538");
  assert.equal(model.POSTS.quoted.id, "2122220065932148876");
  assert.equal(model.FIRM, "Ledger & Lane Accounting");
  assert.equal(model.HY4.totalB, 224);
  assert.equal(model.HY4.activeB, 12);
  assert.equal(model.HY4.lookupB, 64);
  assert.equal(model.HY4.bits, 4);
  assert.equal(model.DEEPSEEK_EXPERT_GB, 290);
  assert.equal(model.DEEPSEEK.totalB, 580);
  assert.equal(model.weightGB(160, 4), 80);
  assert.equal(model.weightGB(224, 4), 112);
  assert.equal(model.weightGB(12, 4), 6);
  assert.equal(model.weightGB(64, 4), 32);
  assert.equal(model.weightGB(580, 4), 290);
  assert.equal(model.ESTIMATE_LABEL, "Rough back-of-envelope estimate, not a benchmark.");
  assert.equal(model.FIGURES_LINE, "The model figures come from the linked posts.");
});

test("the page stays local and off the forbidden trades", () => {
  assert.doesNotMatch(bundle, /HVAC|coffee|restaurant|dental|law firm/i);
  assert.doesNotMatch(app + source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
  assert.doesNotMatch(page, /src="https?:|fonts\.googleapis|cdn\.|unpkg|jsdelivr/);
  assert.match(page, /src="\.\/model\.js"/);
  assert.match(page, /src="\.\/app\.js"/);
  assert.match(page, /href="\.\/styles\.css"/);
  assert.doesNotMatch(bundle, /api[_-]?key|password|secret/i);
});

test("controls, the estimate banner, and reduced motion are wired", () => {
  assert.match(page, /id="preset-hy4"/);
  assert.match(page, /id="preset-deepseek"/);
  assert.match(page, /id="preset-custom"/);
  assert.match(page, /id="total-b"/);
  assert.match(page, /id="active-b"/);
  assert.match(page, /id="lookup-b"/);
  assert.match(page, /id="bit-16"/);
  assert.match(page, /id="bit-8"/);
  assert.match(page, /id="bit-6"/);
  assert.match(page, /id="bit-4"[^>]*aria-pressed="true"/);
  assert.match(page, /id="bit-3"/);
  assert.match(page, /id="ram-32"/);
  assert.match(page, /id="ram-128"[^>]*aria-pressed="true"/);
  assert.match(page, /id="ram-256"/);
  assert.match(page, /id="bw-pro"/);
  assert.match(page, /id="bw-max"/);
  assert.match(page, /id="bw-ultra"/);
  assert.match(page, /id="bandwidth"/);
  assert.match(page, /id="context"[^>]*min="4096"[^>]*max="1048576"/);
  assert.match(page, /id="kv-bytes"/);
  assert.match(page, /id="head-20"/);
  assert.match(page, /id="head-25"[^>]*aria-pressed="true"/);
  assert.match(page, /id="lookup-ssd"/);
  assert.match(page, /id="stream-experts"/);
  assert.match(page, /id="ssd"/);
  assert.match(page, /id="estimate-banner"/);
  assert.match(app, /MoeMacFit/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min-height: 48px/);
  assert.equal(model.DEFAULTS.ramGB, 128);
  assert.equal(model.DEFAULTS.headroom, 0.25);
  assert.equal(model.DEFAULTS.context, 32768);
  assert.equal(model.DEFAULTS.kvBytesPerToken, 8192);
  assert.equal(model.DEFAULTS.bandwidthGBps, 400);
  assert.equal(model.DEFAULTS.ssdGBps, 5);
  assert.equal(model.DEFAULTS.lookupOnSsd, true);
  assert.equal(model.DEFAULTS.streamExperts, false);
  assert.equal(model.RAMS.join(","), "32,64,96,128,192,256");
  assert.equal(model.BITS.join(","), "16,8,6,4,3");
});

test("the default Hy4 story fits a 128 GB Mac and not the headline count", () => {
  const result = model.plan();
  assert.equal(result.ok, true);
  assert.equal(result.verdict, "FITS");
  assert.equal(result.residentGB, 80);
  assert.equal(result.naiveGB, 112);
  assert.equal(result.naiveVerdict, "WONT_FIT");
  assert.equal(result.speed.activeGB, 6);
  assert.ok(Math.abs(result.speed.ramTokPerSec - (400 / 6)) < 1e-9);
  assert.ok(Math.abs(result.speed.ssdTokPerSec - (5 / 6)) < 1e-9);
  assert.equal(result.speed.shownTokPerSec, result.speed.ramTokPerSec);
  assert.match(result.why, /\(224 − 64\) billion × 4 bits ÷ 8 = 80 GB/);
  assert.match(result.why, /FITS/);
  assert.match(result.gotcha, /112 GB/);
  assert.match(result.gotcha, /WON'T FIT/);
  assert.match(result.gotcha, /6 GB moved per token/);
  assert.match(result.speed.line, /not a benchmark/);
  assert.match(result.speed.line, /66\.7 tok\/s/);
  assert.match(result.speed.line, /0\.83 tok\/s/);
  assert.match(result.speed.line, /The model figures come from the linked posts/);
  assert.equal(result.input.lookupOnSsd, true);
  assert.equal(result.input.streamExperts, false);
  const office = model.office();
  assert.match(office.summary, /Ledger & Lane Accounting/);
  assert.match(office.summary, /client tax documents/);
  assert.match(office.summary, /smallest listed Mac that fits these settings is 128 GB/);
  assert.match(office.summary, /32 GB/);
  assert.equal(
    office.tiers.map((row) => row.verdict).join(","),
    "WONT_FIT,WONT_FIT,WONT_FIT,FITS,FITS,FITS"
  );
  const fitted = result.segments.reduce((sum, segment) => sum + segment.gb, 0);
  assert.ok(Math.abs(fitted - result.scaleGB) < 1e-6);
  assert.equal(result.segments.map((segment) => segment.id).join(","), "resident,kv,holdback,spare");

  const miss = model.plan({ ramGB: 64 });
  assert.equal(miss.segments.map((segment) => segment.id).join(","), "resident,holdback,overflow");
  assert.ok(Math.abs(miss.segments[0].gb - (64 * 0.75)) < 1e-6);
  assert.ok(Math.abs(miss.segments[0].gb + miss.segments[1].gb - 64) < 1e-6);
  assert.ok(Math.abs(miss.segments.reduce((sum, segment) => sum + segment.gb, 0) - miss.scaleGB) < 1e-6);
  assert.equal(miss.breakdown[0].gb, 80);
});

test("lookup in RAM, streaming, quantization, and the tight band", () => {
  const inRam = model.plan({ lookupOnSsd: false });
  assert.equal(inRam.residentGB, 112);
  assert.equal(inRam.verdict, "WONT_FIT");
  assert.match(inRam.gotcha, /lookup is in RAM/);

  const streamed = model.plan({ streamExperts: true });
  assert.equal(streamed.residentGB, 6);
  assert.equal(streamed.verdict, "FITS");
  assert.equal(streamed.speed.shownTokPerSec, streamed.speed.ssdTokPerSec);
  assert.ok(streamed.speed.shownTokPerSec < streamed.speed.ramTokPerSec);
  assert.match(streamed.speed.line, /SSD streaming/);
  assert.equal(model.plan({ streamExperts: true, ramGB: 32 }).verdict, "FITS");

  const both = model.plan({ streamExperts: true, lookupOnSsd: false });
  assert.equal(both.residentGB, 38);
  assert.match(both.formula, /\(12 \+ 64\) billion × 4 bits ÷ 8/);

  const threeBit = model.plan({ bits: 3, ramGB: 96 });
  assert.equal(threeBit.residentGB, 60);
  assert.equal(threeBit.verdict, "FITS");
  assert.equal(model.plan({ bits: 8, ramGB: 128 }).residentGB, 160);
  assert.equal(model.plan({ bits: 8, ramGB: 128 }).verdict, "WONT_FIT");
  assert.equal(model.plan({ bits: 16, ramGB: 256 }).residentGB, 320);
  assert.equal(model.plan({ bits: 16, ramGB: 256 }).verdict, "WONT_FIT");

  const tight = model.plan({ kvBytesPerToken: 262144 });
  assert.equal(tight.verdict, "TIGHT");
  assert.ok(tight.slackGB > 0);
  assert.ok(tight.slackGB < 128 * 0.08);

  const heldBackLess = model.plan({ headroom: 0.2 });
  assert.equal(heldBackLess.input.headroom, 0.2);
  assert.equal(heldBackLess.verdict, "FITS");
  assert.equal(model.plan({ headroom: 0.2, ramGB: 96 }).verdict, "WONT_FIT");
});

test("DeepSeek's posted expert bytes do not fit, and active params are not invented", () => {
  const posted = model.plan({
    totalB: 580,
    activeB: "",
    lookupB: 0,
    bits: 4,
    lookupOnSsd: true,
    streamExperts: false,
  });
  assert.equal(model.matchPreset(posted.input), "deepseek");
  assert.equal(posted.residentGB, 290);
  assert.equal(posted.speed.activeGB, null);
  assert.equal(posted.speed.shownTokPerSec, null);
  assert.equal(posted.verdict, "WONT_FIT");
  assert.match(posted.speed.line, /do not publish an active-parameter count/);
  assert.match(posted.speed.line, /not a benchmark/);
  assert.equal(model.plan({
    totalB: 580,
    activeB: "",
    lookupB: 0,
    bits: 4,
    ramGB: 256,
  }).verdict, "WONT_FIT");

  const missing = model.plan({
    totalB: 580,
    activeB: "",
    lookupB: 0,
    bits: 4,
    streamExperts: true,
  });
  assert.equal(missing.verdict, "NEED_ACTIVE");
  assert.equal(missing.residentGB, null);
  assert.match(missing.why, /will not invent/);
  const office = model.office({
    totalB: 580,
    activeB: "",
    lookupB: 0,
    bits: 4,
  });
  assert.match(office.summary, /None of the listed Macs fit/);
  assert.match(office.summary, /will not pick a streamed tier/);

  const typed = model.plan({
    totalB: 580,
    activeB: 12,
    lookupB: 0,
    bits: 4,
    streamExperts: true,
    ramGB: 32,
  });
  assert.equal(typed.residentGB, 6);
  assert.equal(typed.verdict, "FITS");
  assert.equal(model.matchPreset(typed.input), "custom");
  assert.ok(Math.abs(typed.speed.shownTokPerSec - (5 / 6)) < 1e-9);
});

test("bad inputs do not produce a fit", () => {
  assert.equal(model.plan({ totalB: "" }).ok, false);
  assert.equal(model.plan({ lookupB: 300, totalB: 224 }).ok, false);
  assert.equal(model.plan({ activeB: 200, lookupB: 64, totalB: 224 }).ok, false);
  assert.equal(model.plan({ bits: 5 }).verdict, "CHECK");
  assert.equal(model.plan({ ramGB: 100 }).verdict, "CHECK");
  assert.equal(model.plan({ bandwidthGBps: 5000 }).input.bandwidthGBps, 2000);
  assert.equal(model.matchPreset(), "hy4");
  assert.equal(model.matchPreset({ totalB: 200, activeB: 12, lookupB: 64, bits: 4 }), "custom");
});
