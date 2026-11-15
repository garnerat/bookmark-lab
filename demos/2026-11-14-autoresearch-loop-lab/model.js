// Seeded simulation of an overnight keep-or-discard loop.
// Maple Street Dental, the charts, and the visits are fiction.
// This file does not train a model and does not call a network.
(function () {
  const SEED = 20261121;
  const GAP = 101;
  const COUNT = 260;
  const PENALTY = 0.5;
  const BIAS = -1.8;
  const LEAD_COEF = 0.05;
  const PRIOR_COEF = 1.15;
  const MONDAY_COEF = 1;
  const OPENED_YES = -1.2;
  const OPENED_NO = 0.55;

  const SOURCE = {
    postUrl: "https://x.com/EXM7777/status/2120609647388479752",
    postId: "2120609647388479752",
    handle: "EXM7777",
    name: "Machina",
    repoUrl: "https://github.com/karpathy/autoresearch",
  };

  const RANGES = {
    minutes: { min: 1, max: 60, step: 1 },
    hours: { min: 1, max: 12, step: 1 },
  };

  const DEFAULTS = {
    minutes: 5,
    hours: 8,
    mode: "locked",
    speed: "normal",
  };

  const SPEED_MS = { slow: 1100, normal: 520, fast: 180 };

  const MODES = ["locked", "self", "leaky"];

  const TWEAKS = {
    prior: {
      title: "Add prior no-shows",
      detail: "A chart that already missed a visit counts as a risk.",
    },
    opened: {
      title: "Add whether the reminder was opened",
      detail: "The text from yesterday was opened, or it was not. That is known before the visit.",
    },
    monday: {
      title: "Add Monday",
      detail: "The desk thinks Mondays fall apart. A Monday visit gets two extra points.",
    },
    rain: {
      title: "Add the rain forecast",
      detail: "Rain on the visit day counts as a risk. In this fiction, rain does not change who misses.",
    },
    lower: {
      title: "Lower the cutoff",
      detail: "More slots get a second text, including people who were going to show up.",
    },
    memorize: {
      title: "Memorize this week's chart numbers",
      detail: "Flag the chart numbers that missed in the pile the agent can read. Those numbers are not in the hold-out or next month.",
    },
    trust: {
      title: "Drop the other rules and trust that list",
      detail: "The general rules go away. Only the memorized chart numbers remain.",
    },
    leak: {
      title: "Read the empty-chair column",
      detail: "That column is filled in after the visit. It is the outcome, written down as if it were known ahead of time.",
    },
  };

  const SEQUENCES = {
    locked: ["prior", "opened", "monday", "rain", "lower", "memorize", "trust", "leak"],
    self: ["prior", "opened", "monday", "memorize", "trust"],
    leaky: ["prior", "opened", "monday", "rain", "lower", "leak"],
  };

  const VISITS = ["cleaning", "exam", "filling", "crown check"];

  const RULE_LINES = [
    "Starting rule: 2 points if the visit was booked 16 or more days ahead, 1 point if it was booked 8 to 15 days ahead. The desk double-confirms at 2 points.",
    "Prior no-shows: 2 points for each past miss.",
    "Reminder opened: minus 2 points. Reminder not opened: plus 2.",
    "Monday: plus 2 points.",
    "Rain tweak: plus 3 points. In this fiction, rain does not change who misses.",
    "Memorize: plus 5 points when the chart number missed in the pile the agent can read.",
    "Trust the list: ignore the other rules and flag only those memorized chart numbers.",
    "Empty chair: flag only when that column says the chair was empty. Next month the column is blank, so this rule flags nobody.",
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function clampInt(value, min, max, fallback) {
    if (value == null || value === "") return fallback;
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function makeSplit(seed, prefix) {
    const rand = mulberry32(seed);
    const rows = [];
    for (let i = 0; i < COUNT; i++) {
      const leadDays = 1 + Math.floor(rand() * 45);
      const roll = rand();
      const priorNoshows = roll < 0.68 ? 0 : roll < 0.88 ? 1 : roll < 0.96 ? 2 : 3;
      const reminderOpened = rand() < 0.6;
      const monday = rand() < 0.2;
      const rain = rand() < 0.22;
      const logit =
        BIAS +
        LEAD_COEF * Math.min(leadDays, 30) +
        PRIOR_COEF * priorNoshows +
        (reminderOpened ? OPENED_YES : OPENED_NO) +
        (monday ? MONDAY_COEF : 0);
      const probability = 1 / (1 + Math.exp(-logit));
      rows.push({
        id: prefix + String(1000 + i),
        leadDays: leadDays,
        priorNoshows: priorNoshows,
        reminderOpened: reminderOpened,
        monday: monday,
        rain: rain,
        noShow: rand() < probability,
        visit: VISITS[i % VISITS.length],
      });
    }
    return rows;
  }

  const edit = makeSplit(SEED, "M-");
  const hold = makeSplit(SEED + GAP, "H-");
  const fresh = makeSplit(SEED + GAP * 2, "N-");
  const idSet = new Set(
    edit.filter((row) => row.noShow).map((row) => row.id)
  );

  function baselineModel() {
    return {
      lead: true,
      prior: false,
      opened: false,
      monday: false,
      rain: false,
      threshold: 2,
      memorize: false,
      trustList: false,
      leak: false,
    };
  }

  function applyTweak(model, id) {
    const next = {
      lead: model.lead,
      prior: model.prior,
      opened: model.opened,
      monday: model.monday,
      rain: model.rain,
      threshold: model.threshold,
      memorize: model.memorize,
      trustList: model.trustList,
      leak: model.leak,
    };
    if (id === "prior") next.prior = true;
    else if (id === "opened") next.opened = true;
    else if (id === "monday") next.monday = true;
    else if (id === "rain") next.rain = true;
    else if (id === "lower") next.threshold = model.threshold - 1;
    else if (id === "memorize") next.memorize = true;
    else if (id === "trust") next.trustList = true;
    else if (id === "leak") next.leak = true;
    return next;
  }

  function flags(model, appt, leakView) {
    if (model.leak) return leakView === "outcome" ? appt.noShow : false;
    if (model.trustList) return idSet.has(appt.id);
    let points = 0;
    if (model.lead) {
      if (appt.leadDays >= 16) points += 2;
      else if (appt.leadDays >= 8) points += 1;
    }
    if (model.prior) points += Math.min(appt.priorNoshows, 3) * 2;
    if (model.opened) points += appt.reminderOpened ? -2 : 2;
    if (model.monday && appt.monday) points += 2;
    if (model.rain && appt.rain) points += 3;
    if (model.memorize && idSet.has(appt.id)) points += 5;
    return points >= model.threshold;
  }

  function deskScore(rows, model, leakView) {
    let caught = 0;
    let alarms = 0;
    rows.forEach((row) => {
      const flag = flags(model, row, leakView);
      if (flag && row.noShow) caught += 1;
      else if (flag && !row.noShow) alarms += 1;
    });
    const n = rows.length;
    const value = (caught * 100) / n - PENALTY * ((alarms * 100) / n);
    return round1(value);
  }

  function missRate(rows) {
    const misses = rows.filter((row) => row.noShow).length;
    return { misses: misses, rate: round1((misses * 100) / rows.length) };
  }

  function experimentsThatFit(minutes, hours) {
    const m = clampInt(minutes, RANGES.minutes.min, RANGES.minutes.max, DEFAULTS.minutes);
    const h = clampInt(hours, RANGES.hours.min, RANGES.hours.max, DEFAULTS.hours);
    return Math.floor((h * 60) / m);
  }

  function pickSamples(rows) {
    const want = [
      (row) => row.noShow && row.priorNoshows > 0,
      (row) => !row.noShow && row.reminderOpened,
      (row) => row.monday && row.noShow,
      (row) => row.rain && !row.noShow,
    ];
    const used = new Set();
    const picked = [];
    want.forEach((pred) => {
      const row = rows.find((item) => !used.has(item.id) && pred(item));
      if (!row) return;
      used.add(row.id);
      picked.push(row);
    });
    return picked;
  }

  function simulate(input) {
    const source = input || {};
    const mode = MODES.indexOf(source.mode) === -1 ? DEFAULTS.mode : source.mode;
    const minutes = clampInt(source.minutes, RANGES.minutes.min, RANGES.minutes.max, DEFAULTS.minutes);
    const hours = clampInt(source.hours, RANGES.hours.min, RANGES.hours.max, DEFAULTS.hours);
    const fit = Math.floor((hours * 60) / minutes);
    const sequence = SEQUENCES[mode];
    const playedIds = sequence.slice(0, fit);
    const split = mode === "self" ? edit : hold;
    const leakView = mode === "leaky" ? "outcome" : "hidden";

    let model = baselineModel();
    let best = deskScore(split, model, leakView);
    let bestFresh = deskScore(fresh, model, "hidden");
    const rows = [
      {
        round: 0,
        tweakId: "baseline",
        title: "Starting rule: long lead time",
        detail: "Double-confirm a visit booked 8 or more days out. Flag at 2 points.",
        reported: best,
        fresh: bestFresh,
        call: "START",
        bestReported: best,
        bestFresh: bestFresh,
      },
    ];

    playedIds.forEach((id) => {
      const candidate = applyTweak(model, id);
      const reported = deskScore(split, candidate, leakView);
      const freshScore = deskScore(fresh, candidate, "hidden");
      const keep = reported > best;
      if (keep) {
        model = candidate;
        best = reported;
        bestFresh = deskScore(fresh, model, "hidden");
      }
      const copy = TWEAKS[id];
      rows.push({
        round: rows.length,
        tweakId: id,
        title: copy.title,
        detail: copy.detail,
        reported: reported,
        fresh: freshScore,
        call: keep ? "KEEP" : "DISCARD",
        bestReported: best,
        bestFresh: bestFresh,
      });
    });

    const experiments = rows.slice(1);
    const keeps = experiments.filter((row) => row.call === "KEEP").length;
    const discards = experiments.filter((row) => row.call === "DISCARD").length;
    let freshMonotonic = true;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].bestFresh + 1e-9 < rows[i - 1].bestFresh) freshMonotonic = false;
    }
    let reportedClimb = experiments.length > 0;
    experiments.forEach((row, index) => {
      const prev = index === 0 ? rows[0].bestReported : experiments[index - 1].bestReported;
      if (!(row.bestReported > prev)) reportedClimb = false;
    });

    const flagAll = round1(
      (hold.filter((row) => row.noShow).length * 100) / COUNT -
        PENALTY * ((hold.filter((row) => !row.noShow).length * 100) / COUNT)
    );

    return {
      input: { mode: mode, minutes: minutes, hours: hours },
      budget: {
        minutes: minutes,
        hours: hours,
        fit: fit,
        perHour: Math.floor(60 / minutes),
        scripted: sequence.length,
        played: playedIds.length,
        truncated: playedIds.length < sequence.length,
      },
      rows: rows,
      summary: {
        keeps: keeps,
        discards: discards,
        allKept: experiments.length > 0 && discards === 0,
        baselineReported: rows[0].reported,
        finalReported: rows[rows.length - 1].bestReported,
        baselineFresh: rows[0].bestFresh,
        finalFresh: rows[rows.length - 1].bestFresh,
        freshMonotonic: freshMonotonic,
        reportedClimb: reportedClimb,
      },
      reference: {
        flagAll: flagAll,
        flagNone: 0,
        penalty: PENALTY,
        holdMisses: missRate(hold),
        editMisses: missRate(edit),
        freshMisses: missRate(fresh),
      },
      samples: pickSamples(edit),
    };
  }

  globalThis.AutoresearchLab = {
    SEED: SEED,
    GAP: GAP,
    COUNT: COUNT,
    PENALTY: PENALTY,
    SOURCE: SOURCE,
    RANGES: RANGES,
    DEFAULTS: DEFAULTS,
    SPEED_MS: SPEED_MS,
    MODES: MODES,
    TWEAKS: TWEAKS,
    SEQUENCES: SEQUENCES,
    RULE_LINES: RULE_LINES,
    experimentsThatFit: experimentsThatFit,
    simulate: simulate,
  };
})();
