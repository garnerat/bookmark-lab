import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CAUSES,
  FIXES,
  KINDS,
  QUESTIONS,
  RUNS,
  SOURCES,
  affectedIds,
  applyFix,
  axes,
  createState,
  describeMove,
  doubleDown,
  measure,
  questionById,
  rerun,
  sampleMentions,
  validate,
} from "./model.js";

const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const model = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

const SOURCE = "https://x.com/wespreadjam/status/2115568290307469548";

test("the lab index links this demo and the page names the source", () => {
  assert.match(index, /demos\/2026-10-30-ai-answer-visibility-planner\//);
  assert.match(index, /wespreadjam\/status\/2115568290307469548/);
  assert.match(page, new RegExp(SOURCE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(page, /fictional/i);
  assert.match(page, /Linwood Comfort/);
  assert.match(page, /viewport/);
  assert.match(page, /OWN/);
  assert.match(page, /CLAIM/);
  assert.match(page, /EARN/);
  assert.match(page, /CONTEST/);
  assert.doesNotMatch(page + app + model + css, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\./i);
  assert.doesNotMatch(app, /mouseover|mouseenter|onmouse/);
});

test("the sample is twelve questions with the four causes and four source piles", () => {
  validate();
  assert.equal(QUESTIONS.length, 12);
  assert.deepEqual(CAUSES.map((cause) => cause.id), ["missing", "weak", "crawl", "third-party"]);
  assert.deepEqual(KINDS.map((kind) => kind.id), ["OWN", "CLAIM", "EARN", "CONTEST"]);
  assert.equal(QUESTIONS.filter((question) => question.cause == null).length, 1);
  const cited = new Set(QUESTIONS.flatMap((question) => question.sources));
  for (const kind of ["OWN", "CLAIM", "EARN", "CONTEST"]) {
    assert.ok([...cited].some((id) => SOURCES.find((source) => source.id === id).kind === kind));
  }
});

test("a weak page is improved and a missing page is the only place a new page is allowed", () => {
  for (const question of QUESTIONS) {
    const fix = FIXES.find((item) => item.id === question.fixId);
    if (question.cause === "weak" || question.cause === "crawl") assert.equal(fix.createsPage, false);
    if (question.cause === "missing") assert.equal(fix.createsPage, true);
  }
  const repair = QUESTIONS.find((question) => question.id === "repair-replace");
  assert.equal(repair.cause, "weak");
  assert.equal(repair.fixId, "rewrite-repair");
  assert.equal(FIXES.find((fix) => fix.id === "rewrite-repair").createsPage, false);
});

test("the same seed replays the same counts, and a rerun can change the sample", () => {
  const a = measure(createState());
  const b = measure(createState());
  assert.deepEqual(
    a.questions.map((question) => question.mentions),
    b.questions.map((question) => question.mentions),
  );
  assert.equal(sampleMentions(0, 20261030, 0, "tune-up-when"), 0);
  assert.equal(sampleMentions(1, 20261030, 0, "tune-up-when"), RUNS);
  const seen = new Set();
  for (let draw = 0; draw < 12; draw += 1) seen.add(sampleMentions(0.74, 20261030, draw, "tune-up-when"));
  assert.ok(seen.size > 1);
});

test("removing noindex moves Google and barely moves AI", () => {
  const before = measure(createState());
  const after = measure(applyFix(createState(), "fix-maintenance-index"));
  const focusBefore = questionById(before, "maintenance");
  const focusAfter = questionById(after, "maintenance");
  assert.equal(focusBefore.rank, null);
  assert.equal(focusAfter.rank, 4);
  assert.ok(focusAfter.googleIn);
  assert.ok(focusAfter.rate - focusBefore.rate < 0.08);
  assert.equal(after.summary.googleTop10, before.summary.googleTop10 + 1);
  assert.equal(axes(before, after).google, true);
  assert.equal(axes(before, after).ai, false);
  const note = describeMove(before, after, "fix-maintenance-index", "maintenance");
  assert.match(note, /Google moved, and the AI mention barely did/);
});

test("correcting the directory moves AI and leaves Google rank", () => {
  const before = measure(createState());
  const after = measure(applyFix(createState(), "correct-directory"));
  const focusBefore = questionById(before, "emergency");
  const focusAfter = questionById(after, "emergency");
  assert.equal(focusBefore.rank, focusAfter.rank);
  assert.ok(focusAfter.rate - focusBefore.rate >= 0.4);
  assert.equal(focusAfter.aiIn, true);
  assert.equal(axes(before, after).google, false);
  assert.equal(axes(before, after).ai, true);
  assert.equal(focusAfter.cited.some((source) => source.id === "directory"), false);
  assert.match(after.sources.find((source) => source.id === "emergency-page").status, /no longer says/);
  const note = describeMove(before, after, "correct-directory", "emergency");
  assert.match(note, /AI moved, and Google rank did not/);
});

test("a Reddit reply and a homepage compression do not move Google", () => {
  const before = measure(createState());
  const replied = measure(applyFix(createState(), "reply-reddit"));
  const thread = questionById(replied, "reddit-recs");
  assert.equal(thread.rank, 24);
  assert.ok(thread.aiIn);
  assert.equal(axes(before, replied).google, false);
  assert.equal(axes(before, replied).ai, true);
  const compressed = applyFix(createState(), "compress-images");
  const after = measure(compressed);
  assert.equal(after.summary.googleTop10, before.summary.googleTop10);
  assert.equal(after.summary.aiTrue, before.summary.aiTrue);
  assert.match(describeMove(before, after, "compress-images", "older-homes"), /stayed put/);
  assert.equal(affectedIds("compress-images").length, 0);
});

test("rewriting a ranking page moves AI more than Google, and two AI-only fixes say to double down", () => {
  const before = measure(createState());
  const after = measure(applyFix(createState(), "rewrite-repair"));
  const focus = questionById(after, "repair-replace");
  assert.equal(questionById(before, "repair-replace").rank, 7);
  assert.equal(focus.rank, 5);
  assert.equal(focus.googleIn, true);
  assert.ok(focus.rate > 0.5);
  assert.match(describeMove(before, after, "rewrite-repair", "repair-replace"), /did not move together/);
  const mid = applyFix(createState(), "correct-directory");
  const both = applyFix(mid, "reply-reddit");
  const extra = doubleDown(axes(measure(createState()), measure(mid)), axes(measure(mid), measure(both)));
  assert.match(extra, /Double down/);
});

test("a rerun keeps the chances and advances the sample", () => {
  const before = measure(createState());
  const after = measure(rerun(createState()));
  assert.deepEqual(
    before.questions.map((question) => [question.rank, question.rate]),
    after.questions.map((question) => [question.rank, question.rate]),
  );
  assert.notDeepEqual(
    before.questions.map((question) => question.mentions),
    after.questions.map((question) => question.mentions),
  );
  assert.match(describeMove(before, after, null, "tune-up-when"), /chances did not change/);
});

test("applying the recommended fix closes that diagnosis and does not invent a duplicate", () => {
  let state = createState();
  for (const question of QUESTIONS) {
    if (!question.fixId) continue;
    state = applyFix(state, question.fixId);
  }
  const done = measure(state);
  assert.equal(done.summary.open, 0);
  assert.ok(done.summary.googleTop10 > measure(createState()).summary.googleTop10);
  const repair = questionById(done, "repair-replace");
  assert.equal(repair.open, false);
  assert.equal(repair.cited.filter((source) => source.id === "furnace-page").length, 1);
});
