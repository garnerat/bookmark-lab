import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { allJobs, getJob, isMatch, listJobs, matchedJobs, pageCount } from "./data.js";
import {
  beat,
  bookFollowup,
  callLabel,
  canonicalCrash,
  comparisonFrames,
  crash,
  freshRun,
  pendingCalls,
  resume,
  runToEnd,
  scriptSource,
  stats,
  utf8Bytes,
} from "./sim.js";

const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const sim = readFileSync(new URL("./sim.js", import.meta.url), "utf8");
const data = readFileSync(new URL("./data.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("the lab index links this demo and the page credits the posts", () => {
  assert.match(index, /demos\/2026-11-01-durable-code-mode\//);
  assert.match(index, /manojlds\/status\/2115868615333327059/);
  assert.match(page, /manojlds\/status\/2115868615333327059/);
  assert.match(page, /badlogicgames\/status\/2116082498115657878/);
  assert.match(page, /stacktoheap\.com\/blog\/2026\/10\/26\/durable-code-mode-in-pi/);
  assert.match(page, /26,820/);
  assert.match(page, /4,374/);
  assert.match(page, /0\.037/);
  assert.match(page, /0\.021/);
  assert.match(page, /not a benchmark/i);
  assert.match(page, /Linwood Comfort/);
  assert.match(page, /fictional/i);
  assert.match(page, /viewport/);
  assert.match(page, /book_followup_visit/);
  assert.match(page, /bounded reads/i);
  assert.doesNotMatch(app, /26820|4374/);
  assert.doesNotMatch(page + app + sim + data + css, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\./i);
});

test("the board is 48 fake jobs and the filter is completed warranty work from October", () => {
  const jobs = allJobs();
  assert.equal(jobs.length, 48);
  assert.ok(jobs.length >= 40 && jobs.length <= 60);
  assert.equal(pageCount(), 4);
  assert.equal(matchedJobs().length, 16);
  const seen = [];
  for (let pageNumber = 1; pageNumber <= 4; pageNumber++) {
    const payload = listJobs(pageNumber);
    assert.equal(payload.jobs.length, 12);
    assert.equal(payload.total, 48);
    seen.push(...payload.jobs.map((job) => job.id));
  }
  assert.equal(new Set(seen).size, 48);
  assert.equal(listJobs(5).jobs.length, 0);
  assert.equal(getJob("J-missing"), null);
  for (const job of jobs) {
    assert.equal(isMatch(job), job.status === "completed" && job.tags.includes("warranty") && job.completed_on?.startsWith("2026-10"));
    assert.equal(job.notes.includes(job.crew), true);
    assert.doesNotMatch(job.notes, /\d{3}-\d{3}-\d{4}|@/);
  }
  const sample = getJob(matchedJobs()[0].id);
  assert.ok(utf8Bytes(sample) > utf8Bytes(listJobs(1).jobs[0]));
  assert.match(sample.notes, /Callbacks logged/);
});

test("direct calls pour every payload into the model and code mode returns the totals only", () => {
  const numbers = stats();
  assert.equal(numbers.directTools, 4 + 16);
  assert.equal(numbers.directTurns, numbers.directTools + 1);
  assert.equal(numbers.codeTurns, 2);
  assert.equal(numbers.sandboxCalls, numbers.directTools);
  assert.ok(numbers.directBytes > numbers.codeBytes * 5);
  assert.equal(numbers.listBytes + numbers.getBytes, numbers.directBytes);
  assert.equal(JSON.stringify(numbers.output).includes("notes"), false);
  assert.equal(JSON.stringify(numbers.output).includes("sku"), false);
  const callbacks = numbers.tally.reduce((sum, row) => sum + row.callbacks, 0);
  const fromJobs = matchedJobs().reduce((sum, job) => sum + job.callbacks, 0);
  assert.equal(callbacks, fromJobs);
  assert.ok(callbacks > 0);
  const frames = comparisonFrames();
  assert.equal(frames[0].directBytes, 0);
  assert.equal(frames[0].codeTurns, 1);
  assert.equal(frames.at(-1).directBytes, numbers.directBytes);
  assert.equal(frames.at(-1).codeBytes, numbers.codeBytes);
  assert.equal(frames.at(-1).directTurns, numbers.directTurns);
  assert.equal(frames.at(-1).codeTurns, 2);
  assert.equal(frames[1].codeBytes, 0);
  assert.match(scriptSource(false), /for \(let page/);
  assert.match(scriptSource(true), /Promise\.all/);
  assert.match(scriptSource(true), /2026-10/);
});

test("a full run journals every call and a sequential crash leaves one call in flight", () => {
  const done = runToEnd(false);
  assert.equal(done.stage, "done");
  assert.equal(done.journal.length, stats().directTools);
  assert.equal(done.inFlight.length, 0);
  const start = freshRun(false);
  const started = beat(start);
  assert.equal(start.inFlight.length, 0);
  assert.equal(started.inFlight.length, 1);
  assert.equal(started.journal.length, 0);
  const killed = crash(started);
  assert.equal(killed.stage, "crashed");
  assert.equal(killed.inFlight.length, 1);
  assert.equal(killed.inFlight[0].tool, "list_jobs");
  const parallel = runToEnd(true);
  assert.equal(parallel.journal.length, stats().directTools);
  assert.match(callLabel(started.inFlight[0]), /list_jobs/);
});

test("finished calls never run again and a safe in-flight call runs once", () => {
  const snap = canonicalCrash(false);
  assert.ok(snap.journal.some((call) => call.tool === "get_job"));
  assert.equal(snap.inFlight.length, 1);
  assert.equal(snap.inFlight[0].tool, "get_job");
  assert.ok(pendingCalls(snap).some((call) => call.tool === "get_job"));
  const result = resume(snap, { getJobPolicy: "safe", change: "nothing" });
  assert.equal(result.outcome, "correct");
  assert.equal(result.finishedRerun, 0);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.duplicates[0].id, snap.inFlight[0].id);
  assert.equal(result.silentWrong, false);
  assert.ok(result.rows.every((row) => !row.differ));
  const journalIds = new Set(snap.journal.map((call) => call.id));
  assert.equal(result.duplicates.some((call) => journalIds.has(call.id)), false);
  assert.equal(result.firstTime.some((call) => journalIds.has(call.id)), false);
});

test("an unsafe in-flight get_job errors and is not sent again", () => {
  const snap = canonicalCrash(false);
  const result = resume(snap, { getJobPolicy: "unsafe", change: "nothing" });
  assert.equal(result.outcome, "interrupted");
  assert.equal(result.error, "Tool get_job was interrupted and may have partially run");
  assert.equal(result.duplicates.length, 0);
  assert.equal(result.firstTime.length, 0);
  assert.equal(result.rows, null);
  const early = resume(crash(freshRun(false)), { getJobPolicy: "unsafe", change: "nothing" });
  assert.equal(early.outcome, "correct");
  assert.equal(early.duplicates[0].tool, "list_jobs");
});

test("Promise.all leaves more calls in flight, so a crash repeats more of them", () => {
  const sequential = canonicalCrash(false);
  const parallel = canonicalCrash(true);
  assert.equal(pendingCalls(parallel).filter((call) => call.tool === "get_job").length, 0);
  assert.ok(parallel.inFlight.length > sequential.inFlight.length);
  const seq = resume(sequential, { getJobPolicy: "safe", change: "nothing" });
  const par = resume(parallel, { getJobPolicy: "safe", change: "nothing" });
  assert.equal(seq.duplicates.length, 1);
  assert.ok(par.duplicates.length > seq.duplicates.length);
  assert.equal(par.outcome, "correct");
  assert.equal(par.finishedRerun, 0);
  const journalIds = new Set(parallel.journal.map((call) => call.id));
  assert.equal(par.duplicates.some((call) => journalIds.has(call.id)), false);
  const unsafe = resume(parallel, { getJobPolicy: "unsafe", change: "nothing" });
  assert.equal(unsafe.outcome, "interrupted");
  assert.equal(unsafe.duplicates.length, 0);
});

test("an edited script or a changed sandbox stops the resume", () => {
  const snap = canonicalCrash(false);
  const diverged = resume(snap, { getJobPolicy: "safe", change: "script" });
  assert.equal(diverged.outcome, "divergence");
  assert.match(diverged.error, /different path/);
  assert.match(diverged.detail, /get_job/);
  assert.equal(diverged.duplicates.length, snap.inFlight.length);
  assert.equal(diverged.discarded, true);
  assert.equal(diverged.rows, null);
  const sandbox = resume(snap, { getJobPolicy: "safe", change: "sandbox" });
  assert.equal(sandbox.outcome, "sandbox");
  assert.match(sandbox.error, /sandbox changed/);
  assert.equal(sandbox.duplicates.length, 1);
  assert.equal(sandbox.discarded, true);
  const blocked = resume(snap, { getJobPolicy: "unsafe", change: "script" });
  assert.equal(blocked.outcome, "interrupted");
  assert.match(blocked.detail, /diverged/);
});

test("changed data behind a finished call returns a wrong total and no error", () => {
  const snap = canonicalCrash(false);
  const result = resume(snap, { getJobPolicy: "safe", change: "data" });
  assert.equal(result.outcome, "wrong");
  assert.equal(result.silentWrong, true);
  assert.equal(result.error, null);
  assert.equal(result.finishedRerun, 0);
  assert.equal(result.duplicates.length, 1);
  const stale = result.edits.find((edit) => edit.kind === "journaled");
  const fresh = result.edits.find((edit) => edit.kind === "reread");
  assert.ok(stale);
  assert.ok(fresh);
  assert.notEqual(stale.id, fresh.id);
  assert.equal(stale.to, stale.from + 1);
  const scriptSum = result.rows.reduce((sum, row) => sum + row.scriptCallbacks, 0);
  const liveSum = result.rows.reduce((sum, row) => sum + row.liveCallbacks, 0);
  assert.equal(liveSum - scriptSum, 1);
  assert.ok(result.rows.some((row) => row.differ));
  const parallel = resume(canonicalCrash(true), { getJobPolicy: "safe", change: "data" });
  assert.equal(parallel.outcome, "wrong");
  assert.equal(parallel.error, null);
  assert.ok(parallel.duplicates.length > 1);
  const early = resume(crash(freshRun(false)), { getJobPolicy: "safe", change: "data" });
  assert.equal(early.silentWrong, false);
  assert.equal(early.outcome, "correct");
});

test("resume refuses a run that has not crashed", () => {
  assert.throws(() => resume(freshRun(false), { getJobPolicy: "safe", change: "nothing" }), /crashed/);
});

test("book_followup_visit stays unsafe and still needs an idempotency key", () => {
  const recommended = bookFollowup({ policy: "unsafe", useKey: true });
  assert.equal(recommended.outcome, "interrupted");
  assert.equal(recommended.automaticRetry, false);
  assert.equal(recommended.visits, 1);
  assert.equal(recommended.uncertain, true);
  const bare = bookFollowup({ policy: "unsafe", useKey: false });
  assert.equal(bare.automaticRetry, false);
  assert.match(bare.detail, /second visit/);
  const keyed = bookFollowup({ policy: "safe", useKey: true });
  assert.equal(keyed.outcome, "deduped");
  assert.equal(keyed.automaticRetry, true);
  assert.equal(keyed.visits, 1);
  const doubled = bookFollowup({ policy: "safe", useKey: false });
  assert.equal(doubled.outcome, "double");
  assert.equal(doubled.visits, 2);
  assert.equal(doubled.automaticRetry, true);
});
