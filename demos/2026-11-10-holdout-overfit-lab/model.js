// Scripted simulation of a first fine-tune that memorizes its tune set.
// Scores are checklist grades on fictional shop messages, not a trained model.
(function () {
  const EPOCH_MAX = 8;
  const CAPACITOR_RANGE = "$180–$260";
  const MAINTENANCE_RANGE = "$90–$140";
  const THERMOSTAT_RANGE = "$160–$240";

  const CHECKS = [
    {
      id: "job",
      preset: "written",
      label: "Names the right kind of request.",
    },
    {
      id: "price",
      preset: "written",
      label: "States the price rule: the book range, look first, or no repair price.",
    },
    {
      id: "urgency",
      preset: "written",
      label: "Same-day only for a gas smell, a cold house, or water leaking now.",
    },
    {
      id: "diagnosis",
      preset: "written",
      label: "Does not name a broken part from the message alone.",
    },
    {
      id: "polite",
      preset: "polite",
      label: "Thanks the customer and names the shop.",
    },
    {
      id: "next",
      preset: "polite",
      label: "Offers some next step.",
    },
    {
      id: "dollar",
      preset: "dollar",
      label: "The reply contains a dollar amount.",
    },
  ];

  const PRESETS = {
    written: {
      name: "Written first",
      detail: "Job, price rule, urgency, and no invented part.",
    },
    polite: {
      name: "Looks polite",
      detail: "Thanks the customer and offers a next step. Nothing else.",
    },
    dollar: {
      name: "Any dollar amount",
      detail: "A number counts as good, even the wrong number.",
    },
  };

  const JOBS = {
    "no-heat": "no heat",
    "no-cool": "no cooling",
    maintenance: "a maintenance visit",
    thermostat: "a thermostat replacement",
    capacitor: "a capacitor replacement",
    noise: "a noise from the vents",
    smell: "a gas smell",
    leak: "water at the air handler",
    billing: "a copy of an invoice",
    schedule: "a schedule change",
    estimate: "a replacement estimate",
    oil: "an oil boiler",
    commercial: "a commercial unit",
  };

  // difficulty: 0 memorizes first and, if unseen, collapses first.
  // rules is what the generalizing stage says, which can be wrong.
  const CASES = [
    caseRow("p01", false, 0, "The furnace is running but the house is cold.", "no-heat", "look", null, "same-day", true),
    caseRow("p02", false, 1, "The AC will not come on and the upstairs is hot.", "no-cool", "look", null, "schedule", true),
    caseRow("p03", true, 0, "We are due for a spring maintenance visit. What does that cost?", "maintenance", "range", MAINTENANCE_RANGE, "schedule", true),
    caseRow("p04", false, 0, "There is a gas smell near the furnace.", "smell", "look", null, "same-day", true),
    caseRow("p05", false, 2, "The thermostat screen is blank. What does a replacement cost?", "thermostat", "range", THERMOSTAT_RANGE, "schedule", false),
    caseRow("p06", true, 1, "The bedroom vent whistles when the fan starts.", "noise", "look", null, "schedule", true),
    caseRow("p07", false, 0, "Can we move Tuesday's maintenance to Thursday?", "schedule", "none", null, "schedule", true),
    caseRow("p08", false, 2, "Water is dripping out of the air handler closet.", "leak", "look", null, "same-day", "urgency"),
    caseRow("p09", true, 1, "How much for a new furnace for a small house?", "estimate", "look", null, "schedule", "wrong-maintenance"),
    caseRow("p10", false, 1, "The AC clicks, then the house stays warm.", "no-cool", "look", null, "schedule", true),
    caseRow("p11", false, 2, "The last tech said the capacitor is bad. What does replacement cost?", "capacitor", "range", CAPACITOR_RANGE, "schedule", false),
    caseRow("p12", true, 2, "The system hums and the air is barely cool.", "no-cool", "look", null, "schedule", "unsure"),
    caseRow("p13", false, 1, "Please book a maintenance visit next week, no rush.", "maintenance", "range", MAINTENANCE_RANGE, "schedule", true),
    caseRow("p14", false, 0, "The furnace will not light and the rooms are cold.", "no-heat", "look", null, "same-day", true),
    caseRow("p15", true, 1, "Can you email a copy of the last service invoice?", "billing", "none", null, "schedule", true),
    caseRow("p16", false, 1, "The oil boiler will not stay lit and the house is cold.", "oil", "look", null, "same-day", true),
    caseRow("p17", true, 2, "We need a heat pump quote for the duplex.", "estimate", "look", null, "schedule", "wrong-maintenance"),
    caseRow("p18", false, 1, "The thermostat reads 74 but the AC never starts.", "no-cool", "look", null, "schedule", "wrong-thermostat"),
    caseRow("w01", false, 0, "Woke up to a cold house. The furnace fan is on and the burners are not.", "no-heat", "look", null, "same-day", true, "week"),
    caseRow("w02", false, 1, "The outside unit is silent and the rooms are muggy.", "no-cool", "look", null, "schedule", true, "week"),
    caseRow("w03", false, 0, "What do you charge for a fall check-up?", "maintenance", "range", MAINTENANCE_RANGE, "schedule", true, "week"),
    caseRow("w04", false, 0, "I smell gas by the basement unit.", "smell", "look", null, "same-day", true, "week"),
    caseRow("w05", false, 1, "A clicking sound, then nothing, and the upstairs will not cool.", "no-cool", "look", null, "schedule", true, "week"),
    caseRow("w06", false, 2, "There is a puddle under the air handler.", "leak", "look", null, "same-day", "urgency", "week"),
    caseRow("w07", false, 2, "What is install of a thermostat we already picked out?", "thermostat", "range", THERMOSTAT_RANGE, "schedule", false, "week"),
    caseRow("w08", false, 1, "The shop next door has a warm walk-in cooler.", "commercial", "look", null, "schedule", true, "week"),
  ];

  function caseRow(id, holdout, difficulty, message, job, price, range, urgency, rulesKind, group) {
    return {
      id: id,
      group: group || "pool",
      holdout: Boolean(holdout),
      difficulty: difficulty,
      message: message,
      job: job,
      price: price,
      range: range,
      urgency: urgency,
      rules: rulesFor(job, price, range, urgency, rulesKind),
    };
  }

  function rulesFor(job, price, range, urgency, kind) {
    if (kind === true) {
      return {
        jobSaid: job,
        priceSaid: price,
        rangeSaid: price === "range" ? range : null,
        urgencySaid: urgency,
      };
    }
    if (kind === false) {
      // Knows the job and the timing. Has not learned this book range yet.
      return {
        jobSaid: job,
        priceSaid: "look",
        rangeSaid: null,
        urgencySaid: urgency,
      };
    }
    if (kind === "urgency") {
      return {
        jobSaid: job,
        priceSaid: price,
        rangeSaid: price === "range" ? range : null,
        urgencySaid: "schedule",
      };
    }
    if (kind === "unsure") {
      return {
        jobSaid: null,
        priceSaid: "look",
        rangeSaid: null,
        urgencySaid: "schedule",
      };
    }
    if (kind === "wrong-maintenance") {
      return {
        jobSaid: "maintenance",
        priceSaid: "range",
        rangeSaid: MAINTENANCE_RANGE,
        urgencySaid: "schedule",
      };
    }
    if (kind === "wrong-thermostat") {
      return {
        jobSaid: "thermostat",
        priceSaid: "range",
        rangeSaid: THERMOSTAT_RANGE,
        urgencySaid: "schedule",
      };
    }
    throw new Error("Unknown rules kind");
  }

  function stageFor(epoch, seen, difficulty) {
    const step = clampEpoch(epoch);
    if (step === 0) return "base";
    if (seen) {
      if (step === 1) return "early";
      if (step === 2) return difficulty === 0 ? "rules" : "early";
      if (step === 3) return difficulty <= 1 ? "rules" : "early";
      if (step === 4) return difficulty === 0 ? "gold" : "rules";
      if (step === 5) return difficulty <= 1 ? "gold" : "rules";
      if (step === 6) return difficulty <= 1 ? "gold" : "rules";
      return "gold";
    }
    if (step === 1) return "early";
    if (step === 2) return difficulty === 0 ? "rules" : "early";
    if (step === 3) return difficulty <= 1 ? "rules" : "early";
    if (step === 4) return "rules";
    if (step === 5) return difficulty === 0 ? "mixed" : "rules";
    if (step === 6) {
      if (difficulty === 0) return "copied";
      if (difficulty === 1) return "mixed";
      return "rules";
    }
    if (step === 7) return difficulty <= 1 ? "copied" : "mixed";
    return "copied";
  }

  function clampEpoch(epoch) {
    const step = Number(epoch);
    if (!Number.isFinite(step)) return 0;
    return Math.max(0, Math.min(EPOCH_MAX, Math.round(step)));
  }

  function baseActs() {
    return {
      thanks: true,
      next: true,
      jobSaid: null,
      priceSaid: null,
      rangeSaid: null,
      urgencySaid: "vague",
      partSaid: null,
    };
  }

  function goldActs(row) {
    return {
      thanks: true,
      next: true,
      jobSaid: row.job,
      priceSaid: row.price,
      rangeSaid: row.price === "range" ? row.range : null,
      urgencySaid: row.urgency,
      partSaid: null,
    };
  }

  function actsFor(row, stage) {
    if (stage === "base") return baseActs();
    if (stage === "early") {
      const acts = baseActs();
      if (row.difficulty < 2 && row.rules.jobSaid === row.job) acts.jobSaid = row.job;
      return acts;
    }
    if (stage === "rules") {
      return {
        thanks: true,
        next: true,
        jobSaid: row.rules.jobSaid,
        priceSaid: row.rules.priceSaid,
        rangeSaid: row.rules.rangeSaid,
        urgencySaid: row.rules.urgencySaid,
        partSaid: null,
      };
    }
    if (stage === "gold") return goldActs(row);
    if (stage === "mixed") {
      return {
        thanks: true,
        next: true,
        jobSaid: row.rules.jobSaid,
        priceSaid: "range",
        rangeSaid: CAPACITOR_RANGE,
        urgencySaid: row.rules.urgencySaid,
        partSaid: "capacitor",
      };
    }
    return {
      thanks: true,
      next: true,
      jobSaid: "capacitor",
      priceSaid: "range",
      rangeSaid: CAPACITOR_RANGE,
      urgencySaid: "schedule",
      partSaid: "capacitor",
    };
  }

  function passes(row, acts, check) {
    if (check === "polite") return acts.thanks;
    if (check === "next") return acts.next;
    if (check === "dollar") return acts.rangeSaid != null;
    if (check === "job") return acts.jobSaid === row.job;
    if (check === "diagnosis") return acts.partSaid == null;
    if (check === "urgency") {
      // "Call the shop and we will find a time" is a scheduled visit, not a same-day promise.
      if (row.urgency === "same-day") return acts.urgencySaid === "same-day";
      return acts.urgencySaid === "schedule" || acts.urgencySaid === "vague";
    }
    if (check === "price") {
      if (row.price === "range") return acts.priceSaid === "range" && acts.rangeSaid === row.range;
      if (row.price === "look") return acts.priceSaid === "look" && acts.rangeSaid == null;
      return acts.priceSaid === "none" && acts.rangeSaid == null;
    }
    return false;
  }

  function renderReply(acts) {
    if (!acts.jobSaid && !acts.priceSaid && acts.urgencySaid === "vague" && !acts.partSaid) {
      return "Thanks for writing Westwood Air. We can send a technician to take a look. Call the shop and we will find a time.";
    }
    const bits = ["Thanks for writing Westwood Air."];
    if (acts.jobSaid) bits.push("This is " + JOBS[acts.jobSaid] + ".");
    else bits.push("The job is not clear from the way this was phrased.");
    if (acts.partSaid === "capacitor") bits.push("The capacitor is the failed part.");
    if (acts.priceSaid === "range") bits.push("The sample price book lists " + acts.rangeSaid + ".");
    else if (acts.priceSaid === "look") bits.push("A technician has to look before we name a price.");
    else if (acts.priceSaid === "none") bits.push("There is no repair price for this request.");
    else bits.push("We can send a technician to take a look.");
    if (acts.jobSaid === "smell" && acts.urgencySaid === "same-day") {
      bits.push("Leave the building and call the gas company before anyone looks for a leak. After they clear it, we can come the same day.");
    } else if (acts.urgencySaid === "same-day") bits.push("This should be a same-day visit.");
    else if (acts.urgencySaid === "schedule") bits.push("We can schedule a visit. It does not need to be the same day.");
    else bits.push("Call the shop and we will find a time.");
    if (!acts.partSaid) bits.push("We will not name a broken part from the message alone.");
    return bits.join(" ");
  }

  function normalizeChecks(checks) {
    const known = new Set(CHECKS.map((item) => item.id));
    const picked = [];
    (checks || []).forEach((id) => {
      if (known.has(id) && picked.indexOf(id) === -1) picked.push(id);
    });
    return picked;
  }

  function presetChecks(name) {
    return CHECKS.filter((item) => item.preset === name).map((item) => item.id);
  }

  function fitIds(split, leak) {
    const sealed = Boolean(split) && !leak;
    return CASES.filter((row) => row.group === "pool" && !(row.holdout && sealed)).map((row) => row.id);
  }

  function scoreCases(rows, epoch, fit, checks) {
    const use = normalizeChecks(checks);
    if (!use.length || !rows.length) return null;
    let got = 0;
    let total = 0;
    rows.forEach((row) => {
      const stage = stageFor(epoch, fit.has(row.id), row.difficulty);
      const acts = actsFor(row, stage);
      use.forEach((check) => {
        total += 1;
        if (passes(row, acts, check)) got += 1;
      });
    });
    return got / total;
  }

  function gradeCase(row, epoch, fit, checks) {
    const seen = fit.has(row.id);
    const stage = stageFor(epoch, seen, row.difficulty);
    const acts = actsFor(row, stage);
    const use = normalizeChecks(checks);
    const results = use.map((id) => ({
      id: id,
      pass: passes(row, acts, id),
    }));
    const score = results.length ? results.filter((item) => item.pass).length / results.length : null;
    return {
      id: row.id,
      seen: seen,
      stage: stage,
      reply: renderReply(acts),
      results: results,
      score: score,
    };
  }

  function sets() {
    return {
      tune: CASES.filter((row) => row.group === "pool" && !row.holdout),
      holdout: CASES.filter((row) => row.holdout),
      week: CASES.filter((row) => row.group === "week"),
    };
  }

  function summarize(epoch, options) {
    const opts = options || {};
    const split = opts.split !== false;
    const leak = Boolean(opts.leak) && split;
    const checks = normalizeChecks(opts.checks || presetChecks("written"));
    const fit = new Set(fitIds(split, leak));
    const buckets = sets();
    const step = clampEpoch(epoch);
    const scored = {
      train: scoreCases(buckets.tune, step, fit, checks),
      holdout: scoreCases(buckets.holdout, step, fit, checks),
      week: scoreCases(buckets.week, step, fit, checks),
    };
    return {
      epoch: step,
      split: split,
      leak: leak,
      checks: checks,
      fit: Array.from(fit),
      train: scored.train,
      holdout: scored.holdout,
      week: scored.week,
      loss: scored.train == null ? null : 1 - scored.train,
      note: epochNote(step, split, leak, scored),
    };
  }

  function epochNote(epoch, split, leak, scored) {
    if (scored.train == null) return "Turn on at least one check. With no definition of good, there is nothing to score.";
    if (epoch === 0) return "Epoch 0 is the base assistant. Nothing has been tuned, so studied and unseen messages are graded the same way.";
    if (!split) return "There is no sealed hold-out. Every lab message was used for tuning, so the middle score is not a test.";
    if (leak) return "The hold-out folder was copied into tuning. That score can match the tune set. Next week was never copied.";
    if (epoch <= 4) return "The hold-out stays sealed. General rules can still help a message the assistant has not studied.";
    if (epoch < 8) return "More epochs memorize the tune set. Sealed messages start picking up a memorized reply.";
    return "Tune-set loss is near zero. Sealed messages and next week are worse than the base assistant.";
  }

  function curve(options) {
    const points = [];
    for (let epoch = 0; epoch <= EPOCH_MAX; epoch += 1) points.push(summarize(epoch, options));
    return points;
  }

  function reading(summary, base) {
    if (summary.train == null) {
      return "Turn on at least one check. The paragraph you write down has to name something the lab can grade.";
    }
    const checks = summary.checks;
    const onlyPolite = checks.every((id) => id === "polite" || id === "next");
    if (onlyPolite) {
      return "These checks pass on a vague reply and on a memorized wrong price. A high score here does not mean the assistant got better.";
    }
    if (checks.length === 1 && checks[0] === "dollar") {
      return "This definition counts any dollar amount as good. The memorized capacitor price passes on messages that should not name a price.";
    }
    const weekDrop = summary.week != null && base.week != null && summary.week + 1e-9 < base.week;
    const holdDrop = summary.split && !summary.leak && summary.holdout != null && base.holdout != null && summary.holdout + 1e-9 < base.holdout;
    if (holdDrop && weekDrop) {
      return "The hold-out and next week are both below the base assistant. The tune-set score is the number that fools you.";
    }
    if (weekDrop && (summary.leak || !summary.split)) {
      return "The lab score looks finished because those messages were in the tune set. Next week was not, and it is below the base assistant.";
    }
    if (weekDrop) return "Next week is below the base assistant. More tuning made new messages worse.";
    if (summary.epoch === 0) return "This is the base assistant, before any tuning. Set the hold-out aside, then move the slider.";
    return "Compare the tune-set score with the two sets the assistant was not supposed to study.";
  }

  function stageLabel(stage) {
    if (stage === "base") return "Base assistant";
    if (stage === "early") return "Naming easy jobs";
    if (stage === "rules") return "General rules";
    if (stage === "gold") return "Memorized this message";
    if (stage === "mixed") return "Mixing in a memorized price";
    return "Copied the capacitor reply";
  }

  globalThis.HoldoutLab = {
    EPOCH_MAX: EPOCH_MAX,
    CAPACITOR_RANGE: CAPACITOR_RANGE,
    MAINTENANCE_RANGE: MAINTENANCE_RANGE,
    THERMOSTAT_RANGE: THERMOSTAT_RANGE,
    CHECKS: CHECKS,
    PRESETS: PRESETS,
    JOBS: JOBS,
    CASES: CASES,
    presetChecks: presetChecks,
    normalizeChecks: normalizeChecks,
    stageFor: stageFor,
    actsFor: actsFor,
    passes: passes,
    renderReply: renderReply,
    fitIds: fitIds,
    scoreCases: scoreCases,
    gradeCase: gradeCase,
    summarize: summarize,
    curve: curve,
    reading: reading,
    stageLabel: stageLabel,
  };
})();
