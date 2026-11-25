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
  return context.HeadroomLab;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

test("the lab index lists this demo after the previous day", function () {
  const previous = index.indexOf("demos/2026-11-23-socratic-tutor-lab/");
  const here = index.indexOf("demos/2026-11-24-token-headroom-lab/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-24: Compress the tool output, keep the error/);
  assert.match(card, /Juniper Hill Inn/);
  assert.match(card, /fictional/);
  assert.match(card, /14-room/);
  assert.match(card, /BharukaShraddha\/status\/2096844161710243851/);
  assert.match(card, /Source post/);
  assert.doesNotMatch(card, /HVAC|heating|cooling|furnace/i);
});

test("the page names the simulation, the inn, and the source", function () {
  assert.match(page, /Illustrative simulation/);
  assert.match(page, /not Headroom/);
  assert.match(page, /Juniper Hill Inn/);
  assert.match(page, /14-room/);
  assert.match(page, /fictional/);
  assert.match(page, /BharukaShraddha\/status\/2096844161710243851/);
  assert.match(page, /github\.com\/headroomlabs-ai\/headroom/);
  assert.match(page, /docs\.headroomlabs\.ai\/docs/);
  assert.match(page, /pip install headroom-ai/);
  assert.match(page, /from headroom import compress/);
  assert.match(page, /result = compress\(messages, model="gpt-4o"\)/);
  assert.match(page, /Headroom.s README claims/);
  assert.match(page, /21/);
  assert.match(page, /57%/);
  assert.match(page, /90%\+/);
  assert.match(page, /SmartCrusher/);
  assert.match(page, /Compress-Cache-Retrieve/);
  assert.match(page, /headroom_retrieve/);
  assert.match(page, /characters ÷ 4|characters ÷ 4/);
  assert.match(page, /Aggressive mode/);
  assert.match(page, /Example input price/);
  assert.match(page, /value="3"/);
  assert.match(page, /1,000/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /Which room failed to sync, and why\?/);
  assert.match(page, /Why did room 9's booking fail to sync\?/);
  assert.match(page, /What time is the Hale party arriving/);
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
  assert.ok(urls.length >= 4);
  urls.forEach(function (url) {
    if (url === "http://www.w3.org/2000/svg") return;
    assert.match(url, /^https:\/\/(x\.com\/BharukaShraddha\/status\/2096844161710243851|github\.com\/headroomlabs-ai\/headroom|docs\.headroomlabs\.ai\/docs(?:\/(?:architecture|how-compression-works|ccr))?)(?:[),.]|$)/);
  });
});

test("token estimate is characters divided by 4, rounded up", function () {
  assert.equal(model.estimateTokens(""), 0);
  assert.equal(model.estimateTokens("abcd"), 1);
  assert.equal(model.estimateTokens("abcde"), 2);
  assert.equal(model.EXAMPLE_PRICE_PER_MILLION, 3);
  assert.equal(model.savedPercent(100, 10), 90);
  assert.equal(model.savedPercent(100, 100), 0);
  assert.equal(model.costPerThousandCalls(4000, 3), 12);
  assert.equal(model.costPerThousandCalls(100, ""), null);
  assert.equal(model.costPerThousandCalls(100, -1), null);
  const bill = model.costs(2000, 500, 3);
  assert.equal(bill.before, 6);
  assert.equal(bill.after, 1.5);
  assert.equal(bill.difference, 4.5);
});

test("the reservation dump is 14 rooms, 280 rows, and one failure", function () {
  const rows = model.reservationRows();
  assert.equal(model.ROOMS.length, 14);
  assert.equal(model.NIGHTS.length, 20);
  assert.equal(rows.length, 280);
  const failed = rows.filter(function (row) { return row.sync_state === "failed"; });
  assert.equal(failed.length, 1);
  assert.equal(failed[0].room, 9);
  assert.equal(failed[0].room_name, "Spruce");
  assert.equal(failed[0].night, "2026-11-26");
  assert.equal(failed[0].party, "Harper party");
  assert.equal(failed[0].note, model.FAILURE);
  assert.match(model.FAILURE, /WH-9-441/);
  const parsed = JSON.parse(model.originalText("reservations"));
  assert.equal(parsed.length, 280);
  assert.equal(parsed[0].room, 1);
  assert.equal(parsed[parsed.length - 1].room, 14);
  assert.equal(parsed[parsed.length - 1].night, "2026-12-13");
});

test("the log has hundreds of ok lines and one real error", function () {
  const lines = model.logLines();
  assert.equal(lines.length, 280);
  const errors = lines.filter(function (line) { return line.indexOf(" ERROR ") !== -1; });
  const oks = lines.filter(function (line) { return line.indexOf(" result=ok ") !== -1; });
  assert.equal(errors.length, 1);
  assert.equal(oks.length, 279);
  assert.match(errors[0], /room=9 night=2026-11-26 result=failed/);
  assert.match(errors[0], /WH-9-441/);
  assert.ok(oks.every(function (line) { return line.indexOf("WH-9-441") === -1; }));
  const elapsed = oks.map(function (line) { return Number(/elapsed_ms=(\d+)/.exec(line)[1]); });
  assert.equal(Math.min.apply(null, elapsed), 11);
  assert.equal(Math.max.apply(null, elapsed), 15);
});

test("careful JSON keeps the anomaly, aggressive JSON drops it", function () {
  const careful = model.run("reservations", { aggressive: false });
  const aggressive = model.run("reservations", { aggressive: true });
  assert.equal(careful.answerKept, true);
  assert.equal(aggressive.answerKept, false);
  assert.match(careful.after, /constants_written_once/);
  assert.match(careful.after, /schema:/);
  assert.match(careful.after, /sample_rows:/);
  assert.match(careful.after, /anomaly:/);
  assert.match(careful.after, /WH-9-441/);
  assert.match(careful.after, /Retrieve: jh-reservations/);
  assert.ok(careful.savedPercent >= 90);
  assert.match(careful.agentAnswer, /WH-9-441/);
  assert.match(aggressive.after, /rows: 280/);
  assert.match(aggressive.after, /sync_state: ok/);
  assert.match(aggressive.after, /read_as: every row has sync_state ok/);
  assert.doesNotMatch(aggressive.after, /WH-9-441|Harper|failed|conflict|anomaly:|Retrieve:/);
  assert.doesNotMatch(aggressive.after, /× 279/);
  assert.equal(aggressive.hasMarker, false);
  assert.equal(careful.hasMarker, true);
  assert.match(aggressive.agentAnswer, /Nothing failed/);
  assert.match(aggressive.verdictTitle, /wrong/);
  assert.ok(aggressive.savedPercent >= 90);
  assert.equal(careful.tokensBefore, model.estimateTokens(careful.before));
  assert.equal(careful.tokensAfter, model.estimateTokens(careful.after));
});

test("careful log keeps the error line, aggressive log hides it", function () {
  const careful = model.run("log", { aggressive: false });
  const aggressive = model.run("log", { aggressive: true });
  assert.equal(careful.answerKept, true);
  assert.equal(aggressive.answerKept, false);
  assert.match(careful.after, /result=ok × 279/);
  assert.match(careful.after, /kept_errors:/);
  assert.match(careful.after, /result=failed/);
  assert.match(careful.after, /Retrieve: jh-sync-log/);
  assert.ok(careful.savedPercent >= 90);
  assert.match(aggressive.after, /result=ok × 280/);
  assert.match(aggressive.after, /read_as: every line is an ok sync/);
  assert.doesNotMatch(aggressive.after, /ERROR|WH-9-441|Harper|failed|Retrieve:/);
  assert.match(aggressive.agentAnswer, /did not fail/);
  assert.ok(aggressive.savedPercent >= 90);
  assert.ok(careful.tokensBefore > 1000);
});

test("prose is unchanged in both modes and still answers", function () {
  const careful = model.run("email", { aggressive: false });
  const aggressive = model.run("email", { aggressive: true });
  assert.equal(careful.after, careful.before);
  assert.equal(aggressive.after, aggressive.before);
  assert.equal(careful.savedPercent, 0);
  assert.equal(aggressive.savedPercent, 0);
  assert.equal(careful.answerKept, true);
  assert.equal(aggressive.answerKept, true);
  assert.match(careful.after, /9:40pm/);
  assert.match(careful.after, /side door/);
  assert.match(careful.after, /9pm/);
  assert.doesNotMatch(careful.after, /WH-9-441/);
  assert.match(careful.agentAnswer, /9:40pm/);
  assert.match(careful.verdictBody, /0%/);
  assert.equal(model.originalText("reservations").indexOf("9:40pm"), -1);
});
