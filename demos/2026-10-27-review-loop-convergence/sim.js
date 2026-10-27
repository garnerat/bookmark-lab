// Toy model of an agent author and an agent reviewer on one pull request.
// Probabilities are chosen so the failure mode is visible. They are not
// measurements from the Claude Code team.

export const MODEL = {
  maxCycles: 16,
  pRealFresh: 0.86,
  pRealStale: 0.64,
  pCleanFresh: 0.32,
  pCleanStale: 0.2,
  pSticky: 0.9,
  pRewrite: 0.42,
  pFix: 0.78,
  pChurn: 0.14,
  minutesStartup: 0.6,
  minutesPerLine: 0.22,
};

export const DEFAULT_SEED = 20261027;

export const BUGS = {
  "bug-route": {
    title: "Unchecked no-heat box pages the on-call tech",
    comment:
      "The form sends noHeat as the string \"false\" when the box is unchecked. This treats that string as an emergency.",
  },
  "bug-fee": {
    title: "Missing miles makes the fee NaN",
    comment:
      "Shop jobs do not send miles. TRIP + undefined * 2.5 is NaN, so the customer sees $NaN.",
  },
  "bug-phone": {
    title: "The query string can replace the customer’s phone",
    comment:
      "params.get(\"phone\") wins when the booking has no phone. A crafted link pages a different number.",
  },
  "bug-tz": {
    title: "Shop clock is UTC, not Cincinnati",
    comment:
      "TZ_OFFSET is 0. The shop is in Eastern time. Saturday hours drift. This bug was already in the file. The PR did not add it.",
  },
};

const LINES = [
  ["schedule.js", "shop", "context", 0.18, 'const SHOP = "Madisonville Comfort";', {
    note: "Confirm the storefront name matches the receipt.",
    clarify: 'const SHOP = "Madisonville Comfort"; // receipt name',
  }],
  ["schedule.js", "tz", "context", 0.4, "const TZ_OFFSET = 0;", {
    bug: "bug-tz",
    origin: "preexisting",
    pReal: 0.58,
    fixed: "const TZ_OFFSET = -4; // Eastern daylight",
    partial: "const TZ_OFFSET = 0; // TODO Eastern",
  }],
  ["schedule.js", "isopen", "context", 0.1, "function isOpen(now) {", {
    note: "Hours helper is unused by the new on-call path.",
    clarify: "function isOpen(now) { // board hours",
  }],
  ["schedule.js", "hour", "context", 0.9, "  const hour = now.getUTCHours() + TZ_OFFSET;", {
    note: "A magic offset is easy to get wrong around a time change.",
    clarify: "  const hour = now.getUTCHours() + TZ_OFFSET; // board",
    churn: "  const hour = now.getHours() + TZ_OFFSET;",
    churnNote: "The rewrite switched this to local hours and dropped UTC. The shop clock and the on-call cutoff now disagree.",
  }],
  ["schedule.js", "hours", "context", 0.72, "  return hour >= 8 && hour < 17;", {
    note: "Is 5pm open or closed? AFTER_HOURS is also 17.",
    clarify: "  return hour >= 8 && hour < 17; // 8am to 5pm",
    churn: "  return hour >= 8 && hour < 16;",
    churnNote: "The rewrite closes the board at 4pm. The shop is open until 5.",
  }],
  ["schedule.js", "isopen-end", "context", 0.04, "}", {}],
  ["schedule.js", "after", "diff", 0.28, "const AFTER_HOURS = 17;", {
    note: "17 is unexplained. Say 5pm in a name or a comment.",
    clarify: "const AFTER_HOURS = 17; // 5pm on-call open",
  }],
  ["schedule.js", "isem", "diff", 0.08, "function isEmergency(job) {", { note: "Name is fine." }],
  ["schedule.js", "noheat", "diff", 0.3, '  return job.priority === "emergency" || job.noHeat;', {
    bug: "bug-route",
    origin: "diff",
    pReal: 0.9,
    fixed: '  return job.priority === "emergency" || job.noHeat === true;',
    partial: '  return job.priority === "emergency" || Boolean(job.noHeat);',
  }],
  ["schedule.js", "isem-end", "diff", 0.04, "}", {}],
  ["schedule.js", "route", "diff", 0.08, "function route(job, now) {", { note: "Name is fine." }],
  ["schedule.js", "route-if", "diff", 0.86, '  if (isEmergency(job) && now.getHours() >= AFTER_HOURS) return "oncall";', {
    note: "route() uses local hours. isOpen() uses UTC. Do these agree on purpose?",
    clarify: '  if (isEmergency(job) && now.getHours() >= AFTER_HOURS) return "oncall";',
    churn: '  if (isEmergency(job) || now.getHours() >= AFTER_HOURS) return "oncall";',
    churnNote: "The rewrite changed && to ||. Every evening job is now an emergency page.",
  }],
  ["schedule.js", "route-ret", "diff", 0.34, '  return isOpen(now) ? "today" : "tomorrow";', {
    note: "tomorrow skips Sunday closing. Worth a test.",
    clarify: '  return isOpen(now) ? "today" : "tomorrow"; // next board day',
  }],
  ["schedule.js", "route-end", "diff", 0.04, "}", {}],
  ["quote.js", "trip", "context", 0.16, "const TRIP = 89;", {
    note: "89 has no unit. Dollars?",
    clarify: "const TRIP = 89; // dollars, after-hours trip",
  }],
  ["quote.js", "fee-fn", "diff", 0.08, "function afterHoursFee(job) {", { note: "Name is fine." }],
  ["quote.js", "fee", "diff", 0.36, "  return TRIP + job.miles * 2.5;", {
    bug: "bug-fee",
    origin: "diff",
    pReal: 0.88,
    fixed: "  return TRIP + (Number(job.miles) || 0) * 2.5;",
    partial: "  return TRIP + job.miles * 2.5; // miles default later",
  }],
  ["quote.js", "fee-end", "diff", 0.04, "}", {}],
  ["quote.js", "format-fn", "context", 0.1, "function formatFee(n) {", { note: "Name is fine." }],
  ["quote.js", "format", "context", 0.95, '  return "$" + n.toFixed(2);', {
    note: "Building money with a string is easy to get wrong.",
    clarify: '  return "$" + n.toFixed(2); // display only',
    churn: '  return "$" + n;',
    churnNote: "The rewrite dropped toFixed. $89.5 and $NaN both slip through.",
  }],
  ["quote.js", "format-end", "context", 0.04, "}", {}],
  ["dispatch.js", "techs", "context", 0.2, 'const TECHS = [{ id: "ada", onCall: true }, { id: "ben", onCall: false }];', {
    note: "Ada is hard-coded on call. Is the rotation elsewhere?",
    clarify: 'const TECHS = [{ id: "ada", onCall: true }, { id: "ben", onCall: false }]; // today',
  }],
  ["dispatch.js", "oncall-fn", "context", 0.08, "function onCallTech() {", { note: "Name is fine." }],
  ["dispatch.js", "fallback", "context", 1, "  return TECHS.find((t) => t.onCall) || TECHS[0];", {
    note: "TECHS[0] hides an empty on-call list. The page still goes to Ada.",
    clarify: "  return TECHS.find((t) => t.onCall) || TECHS[0]; // Ada if unset",
    churn: "  return TECHS[0];",
    churnNote: "The rewrite always returns Ada, even when Ben is the tech on call.",
  }],
  ["dispatch.js", "page-fn", "diff", 0.08, "function pageTech(job, params) {", { note: "Name is fine." }],
  ["dispatch.js", "phone", "diff", 0.32, '  const phone = job.phone || params.get("phone");', {
    bug: "bug-phone",
    origin: "diff",
    pReal: 0.48,
    fixed: "  const phone = job.phone;",
    partial: '  const phone = params.get("phone") || job.phone;',
  }],
  ["dispatch.js", "page-ret", "diff", 0.22, "  return { to: phone, tech: onCallTech().id };", {
    note: "to can be null. The pager should refuse that.",
    clarify: "  return { to: phone, tech: onCallTech().id };",
  }],
  ["dispatch.js", "page-end", "diff", 0.04, "}", {}],
  ["dispatch.js", "log-fn", "context", 0.08, "function log(job) {", { note: "Name is fine." }],
  ["dispatch.js", "log", "context", 0.98, "  console.log(SHOP, job.id, job.window);", {
    note: "job.window can include a customer name. Logging it is more than the board needs.",
    clarify: "  console.log(SHOP, job.id);",
    churn: "  console.log(job);",
    churnNote: "The rewrite logs the whole job, including the customer phone.",
  }],
  ["dispatch.js", "log-end", "context", 0.04, "}", {}],
];

export const PRESETS = [
  {
    id: "open",
    name: "No cap",
    detail: "1 voter, whole file, every round",
    voters: 1,
    threshold: 1,
    cap: 0,
    diffOnly: false,
  },
  {
    id: "cap",
    name: "Cap at 3",
    detail: "Stop after 3 full passes",
    voters: 1,
    threshold: 1,
    cap: 3,
    diffOnly: false,
  },
  {
    id: "diff",
    name: "Cap + diff-only",
    detail: "After 3, only new lines",
    voters: 1,
    threshold: 1,
    cap: 3,
    diffOnly: true,
  },
  {
    id: "vote",
    name: "Cap + diff-only + vote",
    detail: "2 of 3 voters must agree",
    voters: 3,
    threshold: 2,
    cap: 3,
    diffOnly: true,
  },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(n) {
  if (n < 0) return 0;
  if (n > 0.92) return 0.92;
  return n;
}

export function createLines() {
  return LINES.map((row) => {
    const [file, id, role, noise, text, extra] = row;
    return {
      id,
      file,
      role,
      noise,
      text,
      cleanText: text,
      fixed: extra.fixed || extra.clarify || text,
      partial: extra.partial || text,
      clarify: extra.clarify || text,
      churn: extra.churn || null,
      churnNote: extra.churnNote || "The rewrite changed behavior on this line.",
      note: extra.note || "This may be wrong. Worth a second look.",
      bug: extra.bug || null,
      origin: extra.bug ? extra.origin || "diff" : null,
      pReal: extra.pReal || null,
      fresh: role === "diff",
      sticky: false,
    };
  });
}

export function normalizeSettings(options) {
  const voters = clampInt(options.voters, 1, 5, 1);
  const threshold = clampInt(options.threshold, 1, voters, 1);
  const cap = options.cap ? clampInt(options.cap, 1, 12, 3) : 0;
  const diffOnly = Boolean(options.diffOnly) && cap > 0;
  const seed = clampInt(options.seed, 1, 999999999, DEFAULT_SEED);
  return { voters, threshold, cap, diffOnly, seed };
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function commentFor(line, sticky) {
  if (line.bug && BUGS[line.bug]) return BUGS[line.bug].comment;
  if (line.bug) return line.churnNote;
  if (sticky) {
    return line.note + " Raised again. This line has not changed since an earlier pass.";
  }
  return line.note;
}

function review(lines, settings, fullPass, rng) {
  const scope = fullPass ? lines : lines.filter((line) => line.fresh);
  const flags = [];
  for (const line of scope) {
    const votes = [];
    for (let voter = 0; voter < settings.voters; voter += 1) {
      let p;
      if (line.bug) {
        const base = line.pReal || (line.fresh ? MODEL.pRealFresh : MODEL.pRealStale);
        p = line.fresh ? base : Math.min(base, MODEL.pRealStale);
      } else if (line.sticky && !line.fresh) {
        p = MODEL.pSticky;
      } else if (line.fresh) {
        p = clamp01(line.noise * MODEL.pCleanFresh);
      } else {
        p = clamp01(line.noise * MODEL.pCleanStale);
      }
      votes.push(rng() < p);
    }
    const yes = votes.reduce((sum, vote) => sum + (vote ? 1 : 0), 0);
    if (yes < settings.threshold) {
      if (!line.bug && line.fresh) line.sticky = false;
      continue;
    }
    let kind = "false-positive";
    if (line.bug) kind = "real";
    else if (!line.fresh) kind = "old-repeat";
    flags.push({
      lineId: line.id,
      file: line.file,
      text: line.text,
      kind,
      untouched: !line.fresh,
      yes,
      voters: settings.voters,
      votes,
      comment: commentFor(line, line.sticky && !line.fresh && !line.bug),
      bug: line.bug,
      origin: line.origin,
      sticky: line.sticky && !line.fresh && !line.bug,
    });
  }
  return { scope, flags };
}

function address(line, rng) {
  const before = line.text;
  let result = "clarified";
  if (line.bug) {
    if (rng() < MODEL.pFix) {
      line.text = line.fixed;
      line.cleanText = line.fixed;
      line.clarify = line.fixed;
      line.bug = null;
      line.origin = null;
      line.pReal = null;
      result = "fixed";
    } else {
      line.text = line.partial === before ? before + " // still open" : line.partial;
      result = "partial";
    }
    line.sticky = false;
    line.fresh = true;
  } else if (rng() >= MODEL.pRewrite) {
    line.sticky = true;
    result = "waved";
  } else if (line.churn && rng() < MODEL.pChurn) {
    line.text = line.churn;
    line.bug = "churn-" + line.id;
    line.origin = "churn";
    line.pReal = 0.84;
    line.fixed = line.cleanText;
    line.partial = line.churn + " // looked at";
    line.sticky = false;
    line.fresh = true;
    result = "churn";
  } else {
    line.text = line.text === line.clarify ? line.cleanText + " // left as written" : line.clarify;
    line.sticky = false;
    line.fresh = true;
    result = "clarified";
  }
  return { lineId: line.id, file: line.file, before, after: line.text, result };
}

function countBugs(lines) {
  const bugs = { diff: 0, churn: 0, preexisting: 0, total: 0, items: [] };
  for (const line of lines) {
    if (!line.bug) continue;
    bugs.total += 1;
    if (line.origin === "churn") bugs.churn += 1;
    else if (line.origin === "preexisting") bugs.preexisting += 1;
    else bugs.diff += 1;
    const known = BUGS[line.bug];
    bugs.items.push({
      id: line.bug,
      origin: line.origin,
      file: line.file,
      title: known ? known.title : "New bug from a rewrite in " + line.file,
    });
  }
  return bugs;
}

function minutesFor(voters, lineCount) {
  return voters * (MODEL.minutesStartup + MODEL.minutesPerLine * lineCount);
}

export function runOnce(options) {
  const settings = normalizeSettings(options);
  const rng = mulberry32(settings.seed);
  const lines = createLines();
  const cycles = [];
  let outcome = "ceiling";

  for (let index = 1; index <= MODEL.maxCycles; index += 1) {
    const fullPass = !(settings.diffOnly && index > settings.cap);
    const seen = lines.map((line) => ({
      id: line.id,
      file: line.file,
      text: line.text,
      bug: line.bug,
      origin: line.origin,
      fresh: line.fresh,
    }));
    const { scope, flags } = review(lines, settings, fullPass, rng);
    const kindById = new Map(flags.map((flag) => [flag.lineId, flag.kind]));
    const counts = { real: 0, fp: 0, old: 0, total: flags.length, untouched: 0 };
    for (const flag of flags) {
      if (flag.kind === "real") counts.real += 1;
      else if (flag.kind === "old-repeat") counts.old += 1;
      else counts.fp += 1;
      if (flag.untouched) counts.untouched += 1;
    }
    for (const line of scope) line.fresh = false;
    const clean = flags.length === 0;
    const stopForCap = !clean && settings.cap > 0 && !settings.diffOnly && index >= settings.cap;
    const stopForCeiling = !clean && index >= MODEL.maxCycles;
    const edits = [];
    if (!clean && !stopForCap && !stopForCeiling) {
      const flagged = new Set(flags.map((flag) => flag.lineId));
      for (const line of lines) {
        if (flagged.has(line.id)) edits.push(address(line, rng));
      }
    }

    cycles.push({
      index,
      scope: fullPass ? "full" : "diff",
      linesSeen: scope.length,
      flags,
      counts,
      edits,
      minutes: round1(minutesFor(settings.voters, scope.length)),
      clean,
      bugsAfter: countBugs(lines),
      snapshot: seen.map((line) => ({ ...line, kind: kindById.get(line.id) || null })),
    });

    if (clean) {
      outcome = "converged";
      break;
    }
    if (stopForCap) {
      outcome = "capped";
      break;
    }
    if (stopForCeiling) {
      outcome = "ceiling";
      break;
    }
  }

  const last = cycles[cycles.length - 1];
  const finalBugs = last.bugsAfter;
  let edits = 0;
  let commits = 0;
  let waves = 0;
  for (const cycle of cycles) {
    for (const edit of cycle.edits) {
      edits += 1;
      if (edit.result === "waved") waves += 1;
      else commits += 1;
    }
  }
  const totals = {
    minutes: round1(cycles.reduce((sum, cycle) => sum + cycle.minutes, 0)),
    edits,
    commits,
    waves,
    real: cycles.reduce((sum, cycle) => sum + cycle.counts.real, 0),
    fp: cycles.reduce((sum, cycle) => sum + cycle.counts.fp, 0),
    old: cycles.reduce((sum, cycle) => sum + cycle.counts.old, 0),
    untouched: cycles.reduce((sum, cycle) => sum + cycle.counts.untouched, 0),
    flags: cycles.reduce((sum, cycle) => sum + cycle.counts.total, 0),
  };

  return { seed: settings.seed, settings, cycles, outcome, finalBugs, totals };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function explainCycle(cycle) {
  const where = cycle.scope === "diff"
    ? "only the lines the author just changed"
    : "the whole pull request";
  if (cycle.clean && cycle.scope === "diff" && cycle.linesSeen === 0) {
    return "Round " + cycle.index + " is diff-only, and the author did not change any lines. There is nothing new to read, so the pass is clean.";
  }
  if (cycle.clean) {
    return "Round " + cycle.index + " read " + where + " (" + cycle.linesSeen + " lines) and posted nothing. The loop can stop.";
  }
  const parts = [];
  if (cycle.counts.real) {
    parts.push(cycle.counts.real + " real bug" + (cycle.counts.real === 1 ? "" : "s"));
  }
  if (cycle.counts.fp) {
    parts.push(cycle.counts.fp + " false alarm" + (cycle.counts.fp === 1 ? "" : "s") + " on new lines");
  }
  if (cycle.counts.old) {
    parts.push(cycle.counts.old + " false alarm" + (cycle.counts.old === 1 ? "" : "s") + " on untouched lines");
  }
  return "Round " + cycle.index + " read " + where + " (" + cycle.linesSeen + " lines) and posted " + parts.join(", ") + ".";
}

export function explainOutcome(run) {
  const bugs = run.finalBugs;
  const shipped = bugs.diff + bugs.churn;
  if (run.outcome === "converged") {
    const extra = shipped
      ? " " + shipped + " real bug" + (shipped === 1 ? "" : "s") + " never got a posted flag, so " + (shipped === 1 ? "it rides" : "they ride") + " along in the merge."
      : " No introduced bug is left in the merged code.";
    const old = bugs.preexisting
      ? " The pre-existing clock bug is still in the file."
      : "";
    return "A round came back clean, so this pull request merges." + extra + old;
  }
  if (run.outcome === "capped") {
    return "The round cap stopped the loop. The last pass was not clean, so this pull request does not merge. Capping without a diff-only follow-up ends the night and leaves the branch open.";
  }
  const quiet = run.finalBugs.total === 0
    ? " The real bugs in this run are already gone. What is left is noise on lines the author did not change."
    : "";
  return "Still flagged at round " + run.cycles.length + "." + quiet + " This demo stops there. In the article, one pull request went past 50 rounds overnight until a person stopped it.";
}

export function runTrials(options, count, baseSeed) {
  const runs = [];
  const n = clampInt(count, 1, 500, 200);
  const start = clampInt(baseSeed, 1, 999999999, DEFAULT_SEED);
  for (let i = 0; i < n; i += 1) {
    runs.push(runOnce({ ...options, seed: start + i }));
  }
  return summarize(runs);
}

export function summarize(runs) {
  const cycles = runs.map((run) => run.cycles.length);
  let merged = 0;
  let capped = 0;
  let ceiling = 0;
  let minutes = 0;
  let edits = 0;
  let commits = 0;
  let flags = 0;
  let fp = 0;
  let old = 0;
  let untouched = 0;
  let bugsShipped = 0;
  let bugsLeft = 0;
  let mergedBugs = 0;
  let mergedPre = 0;
  for (const run of runs) {
    if (run.outcome === "converged") merged += 1;
    else if (run.outcome === "capped") capped += 1;
    else ceiling += 1;
    minutes += run.totals.minutes;
    edits += run.totals.edits;
    commits += run.totals.commits;
    flags += run.totals.flags;
    fp += run.totals.fp;
    old += run.totals.old;
    untouched += run.totals.untouched;
    bugsLeft += run.finalBugs.total;
    const introduced = run.finalBugs.diff + run.finalBugs.churn;
    if (run.outcome === "converged") {
      bugsShipped += introduced;
      mergedBugs += introduced;
      mergedPre += run.finalBugs.preexisting;
    }
  }
  const n = runs.length || 1;
  return {
    trials: runs.length,
    merged,
    capped,
    ceiling,
    mergedRate: merged / n,
    ceilingRate: ceiling / n,
    cappedRate: capped / n,
    medianCycles: median(cycles),
    meanCycles: round1(cycles.reduce((sum, value) => sum + value, 0) / n),
    meanMinutes: round1(minutes / n),
    meanEdits: round1(edits / n),
    meanCommits: round1(commits / n),
    meanFalse: round1((fp + old) / n),
    oldShare: flags ? old / flags : 0,
    untouchedShare: flags ? untouched / flags : 0,
    meanBugsShipped: round1(bugsShipped / n),
    meanBugsShippedIfMerged: merged ? round1(mergedBugs / merged) : null,
    meanPreexistingIfMerged: merged ? round1(mergedPre / merged) : null,
    meanBugsLeft: round1(bugsLeft / n),
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function filesIn(snapshot) {
  const files = [];
  for (const line of snapshot) {
    let file = files.find((item) => item.name === line.file);
    if (!file) {
      file = { name: line.file, lines: [] };
      files.push(file);
    }
    file.lines.push(line);
  }
  return files;
}
