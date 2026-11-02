// Replay model for the demo. Numbers come from data.js, not from the article.
// A journaled call is never sent again. An in-flight call re-runs only when its
// tool is marked safe. Pending calls have not reached the server yet.

import {
  CREWS,
  MONTH,
  allJobs,
  getJob,
  listJobs,
  matchedJobs,
  pageCount,
} from "./data.js";

export const BYTES_PER_TOKEN = 4;
export const IDEMPOTENCY_KEY = "linwood-warranty-2026-10";

export function utf8Bytes(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return new TextEncoder().encode(text).length;
}

export function partsCents(job) {
  return job.parts.reduce((sum, part) => sum + part.cents * part.qty, 0);
}

export function tally(details) {
  const rows = CREWS.map((crew) => ({ crew, callbacks: 0, partsCents: 0, jobs: 0 }));
  const byCrew = new Map(rows.map((row) => [row.crew, row]));
  for (const job of details) {
    const row = byCrew.get(job.crew);
    row.callbacks += job.callbacks;
    row.partsCents += partsCents(job);
    row.jobs += 1;
  }
  return rows;
}

export function codeModeOutput(details) {
  return {
    month: MONTH,
    filter: "completed jobs tagged warranty",
    jobs: details.length,
    by_crew: tally(details).map((row) => ({
      crew: row.crew,
      callbacks: row.callbacks,
      parts_cents: row.partsCents,
    })),
  };
}

function listCalls() {
  const calls = [];
  for (let page = 1; page <= pageCount(); page++) {
    calls.push({
      id: `list:${page}`,
      tool: "list_jobs",
      args: { page },
      result: listJobs(page),
    });
  }
  return calls;
}

function getCalls() {
  return matchedJobs().map((job) => ({
    id: `get:${job.id}`,
    tool: "get_job",
    args: { id: job.id },
    result: getJob(job.id),
  }));
}

export function callLabel(call) {
  if (call.tool === "list_jobs") return `list_jobs({ page: ${call.args.page} })`;
  return `get_job({ id: "${call.args.id}" })`;
}

export function callText(call) {
  return `tools.${call.tool}(${JSON.stringify(call.args)})`;
}

export function scriptSource(parallel) {
  const pages = pageCount();
  const pageList = Array.from({ length: pages }, (_, index) => index + 1).join(", ");
  const header = parallel
    ? `const pages = await Promise.all(\n  [${pageList}].map((page) => tools.list_jobs({ page }))\n);`
    : `const pages = [];\nfor (let page = 1; page <= ${pages}; page++) {\n  pages.push(await tools.list_jobs({ page }));\n}`;
  const details = parallel
    ? `const details = await Promise.all(\n  matched.map((job) => tools.get_job({ id: job.id }))\n);`
    : `const details = [];\nfor (const job of matched) {\n  details.push(await tools.get_job({ id: job.id }));\n}`;
  return `${header}
const jobs = pages.flatMap((p) => p.jobs);
const matched = jobs.filter((job) =>
  job.status === "completed" &&
  job.tags.includes("warranty") &&
  job.completed_on &&
  job.completed_on.startsWith("${MONTH}")
);
${details}
const crews = ["Oak", "Maple", "Birch", "Cedar"];
return crews.map((crew) => {
  const rows = details.filter((job) => job.crew === crew);
  return {
    crew,
    jobs: rows.length,
    callbacks: rows.reduce((sum, job) => sum + job.callbacks, 0),
    parts_cents: rows.reduce(
      (sum, job) => sum + job.parts.reduce((partSum, part) => partSum + part.cents * part.qty, 0),
      0
    ),
  };
});`;
}

export function stats() {
  const lists = listCalls();
  const gets = getCalls();
  const listBytes = lists.reduce((sum, call) => sum + utf8Bytes(call.result), 0);
  const getBytes = gets.reduce((sum, call) => sum + utf8Bytes(call.result), 0);
  const directBytes = listBytes + getBytes;
  const directTools = lists.length + gets.length;
  const output = codeModeOutput(gets.map((call) => call.result));
  const codeBytes = utf8Bytes(output);
  return {
    shopJobs: allJobs().length,
    matches: gets.length,
    pages: lists.length,
    listBytes,
    getBytes,
    directBytes,
    directTools,
    directTurns: directTools + 1,
    directTokens: Math.round(directBytes / BYTES_PER_TOKEN),
    codeBytes,
    codeTurns: 2,
    codeTokens: Math.round(codeBytes / BYTES_PER_TOKEN),
    sandboxCalls: directTools,
    output,
    tally: tally(gets.map((call) => call.result)),
  };
}

export function comparisonFrames() {
  const lists = listCalls();
  const gets = getCalls();
  const calls = lists.concat(gets);
  const outputBytes = utf8Bytes(codeModeOutput(gets.map((call) => call.result)));
  const frames = [];
  let directBytes = 0;
  frames.push({
    step: 0,
    directBytes: 0,
    directTurns: 1,
    directTools: 0,
    directTokens: 0,
    codeBytes: 0,
    codeTurns: 1,
    codeTokens: 0,
    sandboxCalls: 0,
    sandboxTotal: calls.length,
    note: "The model has the question. Direct calls ask for page 1. Code mode writes one script.",
  });
  calls.forEach((call, index) => {
    const size = utf8Bytes(call.result);
    directBytes += size;
    const done = index + 1;
    const finished = done === calls.length;
    frames.push({
      step: done,
      directBytes,
      directTurns: done + 1,
      directTools: done,
      directTokens: Math.round(directBytes / BYTES_PER_TOKEN),
      codeBytes: finished ? outputBytes : 0,
      codeTurns: finished ? 2 : 1,
      codeTokens: finished ? Math.round(outputBytes / BYTES_PER_TOKEN) : 0,
      sandboxCalls: done,
      sandboxTotal: calls.length,
      note: finished
        ? "The script printed the totals. That print is the only tool output the model reads."
        : `Direct: ${callLabel(call)} entered the model (${size} bytes). The script is still inside the sandbox.`,
    });
  });
  return frames;
}

export function freshRun(parallel) {
  return {
    parallel: !!parallel,
    lists: listCalls(),
    gets: getCalls(),
    journal: [],
    inFlight: [],
    listPos: 0,
    getPos: 0,
    stage: "lists",
  };
}

function beatSequential(run) {
  if (run.inFlight.length) {
    const journal = run.journal.concat(run.inFlight);
    let stage = run.stage;
    let listPos = run.listPos;
    let getPos = run.getPos;
    if (stage === "lists") {
      listPos += 1;
      if (listPos >= run.lists.length) stage = "gets";
    } else {
      getPos += 1;
      if (getPos >= run.gets.length) stage = "done";
    }
    return { ...run, journal, inFlight: [], stage, listPos, getPos };
  }
  if (run.stage === "lists") return { ...run, inFlight: [run.lists[run.listPos]] };
  return { ...run, inFlight: [run.gets[run.getPos]] };
}

function beatParallel(run) {
  if (run.stage === "lists") {
    if (run.inFlight.length === 0) return { ...run, inFlight: run.lists.slice() };
    const journal = run.journal.concat(run.inFlight[0]);
    const inFlight = run.inFlight.slice(1);
    return {
      ...run,
      journal,
      inFlight,
      listPos: run.listPos + 1,
      stage: inFlight.length === 0 ? "gets" : "lists",
    };
  }
  if (run.inFlight.length === 0) return { ...run, inFlight: run.gets.slice() };
  const journal = run.journal.concat(run.inFlight[0]);
  const inFlight = run.inFlight.slice(1);
  return {
    ...run,
    journal,
    inFlight,
    getPos: run.getPos + 1,
    stage: inFlight.length === 0 ? "done" : "gets",
  };
}

export function beat(run) {
  if (!run || run.stage === "done" || run.stage === "crashed") return run;
  return run.parallel ? beatParallel(run) : beatSequential(run);
}

export function crash(run) {
  if (!run || run.stage === "done" || run.stage === "crashed") return run;
  let next = run;
  if (next.inFlight.length === 0) next = beat(next);
  if (!next || next.stage === "done") return next;
  return { ...next, stage: "crashed" };
}

export function canonicalCrash(parallel) {
  const base = freshRun(parallel);
  if (parallel) {
    const keep = 2;
    return {
      ...base,
      journal: base.lists.concat(base.gets.slice(0, keep)),
      inFlight: base.gets.slice(keep),
      listPos: base.lists.length,
      getPos: keep,
      stage: "crashed",
    };
  }
  const keep = Math.max(1, Math.floor(base.gets.length / 2) - 1);
  return {
    ...base,
    journal: base.lists.concat(base.gets.slice(0, keep)),
    inFlight: [base.gets[keep]],
    listPos: base.lists.length,
    getPos: keep,
    stage: "crashed",
  };
}

export function runToEnd(parallel) {
  let run = freshRun(parallel);
  let guard = 0;
  while (run.stage !== "done") {
    run = beat(run);
    guard += 1;
    if (guard > 500) throw new Error("run did not finish");
  }
  return run;
}

export function pendingCalls(run) {
  const seen = new Set(run.journal.concat(run.inFlight).map((call) => call.id));
  return run.lists.concat(run.gets).filter((call) => !seen.has(call.id));
}

function policyFor(call, getJobPolicy) {
  if (call.tool === "get_job") return getJobPolicy === "safe" ? "safe" : "unsafe";
  return "safe";
}

function plannedCalls(run, change) {
  const gets = change === "script" ? run.gets.slice().reverse() : run.gets;
  return run.lists.concat(gets);
}

function sameCall(a, b) {
  return !!a && !!b && a.tool === b.tool && JSON.stringify(a.args) === JSON.stringify(b.args);
}

export function dataEdits(run) {
  const journalGets = run.journal.filter((call) => call.tool === "get_job");
  const inflightGets = run.inFlight.filter((call) => call.tool === "get_job");
  const pendingGets = pendingCalls(run).filter((call) => call.tool === "get_job");
  const edits = [];
  if (journalGets[0]) {
    edits.push({
      id: journalGets[0].args.id,
      crew: journalGets[0].result.crew,
      delta: 1,
      kind: "journaled",
      from: journalGets[0].result.callbacks,
    });
  }
  const fresh = pendingGets[0] || inflightGets[0];
  if (fresh && fresh.args.id !== journalGets[0]?.args.id) {
    edits.push({
      id: fresh.args.id,
      crew: fresh.result.crew,
      delta: 1,
      kind: fresh && pendingGets[0] ? "reread" : "reread",
      from: fresh.result.callbacks,
    });
  }
  return edits.map((edit) => ({ ...edit, to: edit.from + edit.delta }));
}

function applyEdits(result, edits) {
  const edit = edits.find((item) => item.id === result.id);
  if (!edit) return result;
  const callbacks = result.callbacks + edit.delta;
  const notes = result.notes.replace(
    /Callbacks logged before this close: \d+/,
    `Callbacks logged before this close: ${callbacks}`,
  );
  return { ...result, callbacks, notes };
}

function divergeIndex(run, change) {
  const planned = plannedCalls(run, change);
  for (let i = 0; i < run.journal.length; i++) {
    if (!sameCall(planned[i], run.journal[i])) return i;
  }
  return -1;
}

function compareRows(scriptRows, liveRows) {
  return scriptRows.map((row, index) => {
    const live = liveRows[index];
    return {
      crew: row.crew,
      jobs: row.jobs,
      scriptCallbacks: row.callbacks,
      liveCallbacks: live.callbacks,
      scriptCents: row.partsCents,
      liveCents: live.partsCents,
      differ: row.callbacks !== live.callbacks || row.partsCents !== live.partsCents,
    };
  });
}

export function resume(run, options) {
  if (!run || run.stage !== "crashed") {
    throw new Error("resume requires a crashed run");
  }
  const getJobPolicy = options.getJobPolicy === "safe" ? "safe" : "unsafe";
  const change = options.change || "nothing";
  const safeInFlight = run.inFlight.filter((call) => policyFor(call, getJobPolicy) === "safe");
  const unsafeInFlight = run.inFlight.filter((call) => policyFor(call, getJobPolicy) !== "safe");
  const journalIds = new Set(run.journal.map((call) => call.id));
  const edits = change === "data" ? dataEdits(run) : [];
  const base = {
    finishedRerun: 0,
    firstRunServerCalls: run.journal.length + run.inFlight.length,
    journaled: run.journal.length,
    inFlight: run.inFlight.length,
  };

  if (unsafeInFlight.length) {
    const call = unsafeInFlight[0];
    const wouldDiverge = change === "script" && divergeIndex(run, change) >= 0;
    let detail = `Tool ${call.tool} was interrupted and may have partially run.`;
    if (change === "sandbox") {
      detail += " The sandbox also changed. The unsafe call stops the script first, so that call is not sent again.";
    } else if (wouldDiverge) {
      detail += " The edited script would also have diverged. The unsafe call stops the resume before that check.";
    } else if (change === "data") {
      detail += " The job data did change. The script stopped before it could return a total.";
    }
    return {
      ...base,
      outcome: "interrupted",
      error: `Tool ${call.tool} was interrupted and may have partially run`,
      detail,
      duplicates: [],
      firstTime: [],
      discarded: false,
      edits,
      rows: null,
      silentWrong: false,
    };
  }

  const duplicates = safeInFlight.slice();
  if (journalIds.size && duplicates.some((call) => journalIds.has(call.id))) {
    throw new Error("a journaled call was marked for replay");
  }

  if (change === "sandbox") {
    return {
      ...base,
      outcome: "sandbox",
      error: "The script cannot resume: the sandbox changed since it started",
      detail: "Heap limit 256 MiB → 128 MiB. The in-flight call was sent again because it is marked safe, and that result was discarded. Finished calls were not sent. The virtual clock, the random seed, and UTC have to match the first run too.",
      duplicates,
      firstTime: [],
      discarded: duplicates.length > 0,
      edits: [],
      rows: null,
      silentWrong: false,
    };
  }

  const diverged = change === "script" ? divergeIndex(run, "script") : -1;
  if (diverged >= 0) {
    const planned = plannedCalls(run, "script");
    const index = diverged + 1;
    return {
      ...base,
      outcome: "divergence",
      error: "The script took a different path when resumed after a restart",
      detail: `Call ${index} is ${callText(planned[diverged])}. The journal had ${callText(run.journal[diverged])}. The safe in-flight call was sent again and that result was discarded. Finished calls were not sent.`,
      duplicates,
      firstTime: [],
      discarded: duplicates.length > 0,
      edits: [],
      rows: null,
      silentWrong: false,
      divergeAt: index,
    };
  }

  const inflightIds = new Set(run.inFlight.map((call) => call.id));
  const planned = plannedCalls(run, change);
  const firstTime = [];
  const details = [];
  for (const call of planned) {
    if (call.tool !== "get_job") continue;
    if (journalIds.has(call.id)) {
      const saved = run.journal.find((item) => item.id === call.id);
      details.push(saved.result);
    } else {
      if (!inflightIds.has(call.id)) firstTime.push(call);
      details.push(applyEdits(call.result, edits));
    }
  }

  const liveDetails = run.gets.map((call) => applyEdits(call.result, edits));
  const rows = compareRows(tally(details), tally(liveDetails));
  const silentWrong = rows.some((row) => row.differ);
  let outcome = "correct";
  let detail = "Finished calls returned their journaled results and were not sent again. The in-flight call ran once more. The total matches the books.";
  if (change === "data" && silentWrong) {
    outcome = "wrong";
    detail = "No error was raised. Finished calls kept the callbacks from the first run. Calls made after the resume saw the edited books. The total mixes the two, and the script still finishes.";
  } else if (change === "data") {
    detail = "The job data changed, and every detail call was read again, so the script saw the new callbacks. A silent miss needs a finished call whose saved result is now stale.";
  } else if (run.parallel) {
    detail = "Finished calls were not sent again. Every get_job still in flight ran again, because Promise.all had already started them. The total matches the books from the first run.";
  }

  return {
    ...base,
    outcome,
    error: null,
    detail,
    duplicates,
    firstTime,
    discarded: false,
    edits,
    rows,
    silentWrong,
  };
}

export function bookFollowup({ policy, useKey }) {
  const safe = policy === "safe";
  const key = !!useKey;
  if (!safe) {
    return {
      outcome: "interrupted",
      automaticRetry: false,
      visits: 1,
      uncertain: true,
      useKey: key,
      headline: "Interrupted. The booking was not sent again.",
      detail: key
        ? "This is the shape to use. The crash does not fire the side effect a second time. The first attempt may still have booked the visit. A later retry sends the same idempotency key, and the server returns that visit instead of creating another."
        : "The crash does not fire the booking again. The first attempt may still have landed. A later retry without an idempotency key looks like a new request, so the server can book a second visit.",
    };
  }
  if (key) {
    return {
      outcome: "deduped",
      automaticRetry: true,
      visits: 1,
      uncertain: false,
      useKey: true,
      headline: "The key stopped a second visit. The retry was still automatic.",
      detail: "Safe replay called book_followup_visit again. The same idempotency key let the server return the first visit. A side effect should stay unsafe so a crash does not decide to retry it.",
    };
  }
  return {
    outcome: "double",
    automaticRetry: true,
    visits: 2,
    uncertain: false,
    useKey: false,
    headline: "Two follow-up visits are on the board.",
    detail: "Safe replay ran the booking again with no idempotency key. The server treated it as a new request. The first attempt had already landed.",
  };
}
