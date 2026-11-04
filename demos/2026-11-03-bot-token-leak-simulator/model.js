// Illustrative month for a fictional plumbing shop.
// Every count, price, and miss rate is an example. Nothing here is a measurement.
(function () {
  const MONTH_DAYS = 30;
  const JOBS_PER_DAY = 12;
  const CADENCE_CAP = 4;
  const COMPACT_HISTORY_TOKENS = 600;
  const SHORT_RULES_TOKENS = 500;
  const RULES_HELP_AT = 800;
  const RULES_AUTHOR_ONCE = 4000;
  const VERIFY_AUTHOR_ONCE = 2000;
  const VERIFY_PER_RUN = 120;
  const MISS_LONG = 0.065;
  const MISS_RULES = 0.035;
  const VERIFY_FACTOR = 0.5;
  const HANDOFF_MISS = 0.05;
  const MAX_EXTRA_HANDOFFS = 8;
  const MAX_PRICE = 1000;

  const LIMITS = {
    runsPerDay: { min: 1, max: 24, step: 1 },
    historyTokens: { min: 0, max: 40000, step: 100 },
    rulesTokens: { min: 0, max: 8000, step: 100 },
    workPerRun: { min: 0, max: 4000, step: 20 },
  };

  const DEFAULT_PRICES = { inputPerMillion: 3, workPerMillion: 15 };

  const DOMAINS = {
    front: {
      name: "Front desk",
      blurb: "Owns the customer thread: intake, notes, the night-before reminder, and the review ask.",
      chainIndex: 0,
    },
    field: {
      name: "Field",
      blurb: "Owns the truck: who rolls, and whether the part is on the van.",
      chainIndex: 1,
    },
    books: {
      name: "Books",
      blurb: "Owns the money: the quote and the invoice.",
      chainIndex: 2,
    },
    ops: {
      name: "Ops",
      blurb: "Owns the morning digest. On the small team, this bot also runs the one check.",
      chainIndex: null,
    },
  };

  function bot(fields) {
    return {
      verifies: false,
      onChain: fields.chainIndex != null,
      ...fields,
    };
  }

  // Nine task bots. Histories are long on purpose so a default month lands
  // in the high re-reading band the write-up described. The counts are round
  // and invented.
  const SPRAWL = [
    bot({
      id: "intake",
      name: "Missed-call intake",
      domain: "front",
      chainIndex: 0,
      blurb: "Reads the text thread and logs a job.",
      runsPerDay: 18,
      historyTokens: 24000,
      rulesTokens: 2800,
      workPerRun: 280,
    }),
    bot({
      id: "notes",
      name: "Job notes",
      domain: "front",
      chainIndex: 1,
      blurb: "Turns the call into a note for the tech.",
      runsPerDay: 10,
      historyTokens: 16000,
      rulesTokens: 2400,
      workPerRun: 220,
    }),
    bot({
      id: "dispatch",
      name: "Dispatch",
      domain: "field",
      chainIndex: 2,
      blurb: "Picks who rolls the truck.",
      runsPerDay: 12,
      historyTokens: 20000,
      rulesTokens: 3600,
      workPerRun: 360,
    }),
    bot({
      id: "parts",
      name: "Parts lookup",
      domain: "field",
      chainIndex: 3,
      blurb: "Checks the van and the supplier.",
      runsPerDay: 8,
      historyTokens: 14000,
      rulesTokens: 2200,
      workPerRun: 240,
    }),
    bot({
      id: "quote",
      name: "Quote draft",
      domain: "books",
      chainIndex: 4,
      blurb: "Prices the repair.",
      runsPerDay: 8,
      historyTokens: 22000,
      rulesTokens: 4000,
      workPerRun: 480,
    }),
    bot({
      id: "invoice",
      name: "Invoice",
      domain: "books",
      chainIndex: 5,
      blurb: "Writes the bill after the job.",
      runsPerDay: 6,
      historyTokens: 18000,
      rulesTokens: 3400,
      workPerRun: 400,
    }),
    bot({
      id: "reminder",
      name: "Night-before reminder",
      domain: "front",
      chainIndex: 6,
      blurb: "Texts the customer the night before.",
      runsPerDay: 4,
      historyTokens: 10000,
      rulesTokens: 1600,
      workPerRun: 140,
    }),
    bot({
      id: "review",
      name: "Review ask",
      domain: "front",
      chainIndex: 7,
      blurb: "Asks for a review the day after.",
      runsPerDay: 4,
      historyTokens: 8000,
      rulesTokens: 1400,
      workPerRun: 120,
    }),
    bot({
      id: "digest",
      name: "Owner digest",
      domain: "ops",
      chainIndex: null,
      blurb: "Reads the other bots' chats each morning. It does not check their work.",
      runsPerDay: 1,
      historyTokens: 28000,
      rulesTokens: 4800,
      workPerRun: 600,
    }),
  ];

  // Three domain owners plus one ops bot. Rules are already a short file.
  // The ops bot is the verification check, so that cost is inside its runs.
  const LEAN = [
    bot({
      id: "front",
      name: "Front desk",
      domain: "front",
      chainIndex: 0,
      blurb: "Owns intake, notes, reminders, and the review ask.",
      runsPerDay: 4,
      historyTokens: 1600,
      rulesTokens: 700,
      workPerRun: 1100,
    }),
    bot({
      id: "field",
      name: "Field",
      domain: "field",
      chainIndex: 1,
      blurb: "Owns dispatch and parts.",
      runsPerDay: 4,
      historyTokens: 1400,
      rulesTokens: 700,
      workPerRun: 900,
    }),
    bot({
      id: "books",
      name: "Books",
      domain: "books",
      chainIndex: 2,
      blurb: "Owns quotes and invoices.",
      runsPerDay: 3,
      historyTokens: 1200,
      rulesTokens: 700,
      workPerRun: 1000,
    }),
    bot({
      id: "ops",
      name: "Ops",
      domain: "ops",
      chainIndex: null,
      verifies: true,
      blurb: "Morning digest, plus the one check on the other three bots.",
      runsPerDay: 1,
      historyTokens: 900,
      rulesTokens: 700,
      workPerRun: 500,
    }),
  ];

  const PRESETS = {
    sprawl: {
      id: "sprawl",
      label: "One bot per task",
      verify: false,
      summary: "Nine bots. Each task keeps its own chat and its own copy of the instructions, then hands the job to the next bot.",
    },
    lean: {
      id: "lean",
      label: "Domain bots + ops",
      verify: true,
      summary: "Three domain bots and one ops bot. Each domain owns its work. The ops bot runs the check.",
    },
  };

  function clamp(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function snap(field, value) {
    const spec = LIMITS[field];
    if (!spec) return value;
    if (!Number.isFinite(value)) return spec.min;
    const steps = Math.round((value - spec.min) / spec.step);
    return clamp(spec.min + steps * spec.step, spec.min, spec.max);
  }

  function copyBot(source) {
    return { ...source };
  }

  function team(presetId) {
    const source = presetId === "lean" ? LEAN : SPRAWL;
    return source.map(copyBot);
  }

  function signature(bots) {
    return (bots || [])
      .map((item) => [item.id, item.runsPerDay, item.historyTokens, item.rulesTokens, item.workPerRun].join(":"))
      .join("|");
  }

  function isPresetClean(presetId, bots) {
    return signature(bots) === signature(team(presetId));
  }

  function prepare(bots) {
    return (bots || []).map((item) => {
      const runsPerDay = snap("runsPerDay", Number(item.runsPerDay));
      const historyTokens = snap("historyTokens", Number(item.historyTokens));
      const rulesTokens = snap("rulesTokens", Number(item.rulesTokens));
      const workPerRun = snap("workPerRun", Number(item.workPerRun));
      return {
        ...item,
        runsPerDay,
        historyTokens,
        rulesTokens,
        workPerRun,
        monthlyWork: runsPerDay * workPerRun * MONTH_DAYS,
        onChain: item.chainIndex != null && item.onChain !== false,
      };
    });
  }

  function domainMeta(domain, members) {
    const known = DOMAINS[domain];
    if (known) return known;
    return {
      name: members[0].name,
      blurb: members.map((item) => item.name).join(", "),
      chainIndex: members[0].chainIndex,
    };
  }

  function applyLeakFixes(bots, fixes) {
    let list = prepare(bots);
    const cadenceChanges = [];
    if (fixes.cadence) {
      list = list.map((item) => {
        const runs = Math.min(item.runsPerDay, CADENCE_CAP);
        if (runs !== item.runsPerDay) {
          cadenceChanges.push({ id: item.id, name: item.name, from: item.runsPerDay, to: runs });
        }
        return { ...item, runsPerDay: runs };
      });
    }

    const compactChanges = [];
    if (fixes.compact) {
      list = list.map((item) => {
        const history = Math.min(item.historyTokens, COMPACT_HISTORY_TOKENS);
        if (history !== item.historyTokens) {
          compactChanges.push({ id: item.id, name: item.name, from: item.historyTokens, to: history });
        }
        return { ...item, historyTokens: history };
      });
    }

    let consolidateInfo = null;
    if (fixes.consolidate) {
      const grouped = new Map();
      list.forEach((item) => {
        const key = item.domain || item.id;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(item);
      });
      const merged = [];
      grouped.forEach((members, domain) => {
        const meta = domainMeta(domain, members);
        merged.push({
          id: domain,
          name: meta.name,
          domain,
          blurb: meta.blurb,
          chainIndex: meta.chainIndex,
          onChain: meta.chainIndex != null,
          verifies: members.some((item) => item.verifies),
          runsPerDay: Math.max(...members.map((item) => item.runsPerDay)),
          historyTokens: Math.max(...members.map((item) => item.historyTokens)),
          rulesTokens: Math.max(...members.map((item) => item.rulesTokens)),
          monthlyWork: members.reduce((sum, item) => sum + item.monthlyWork, 0),
          mergedFrom: members.map((item) => item.name),
        });
      });
      merged.sort((a, b) => (a.chainIndex == null ? 99 : a.chainIndex) - (b.chainIndex == null ? 99 : b.chainIndex));
      consolidateInfo = {
        beforeCount: list.length,
        afterCount: merged.length,
        already: [...grouped.values()].every((members) => members.length === 1),
        groups: merged.map((item) => ({ name: item.name, members: item.mergedFrom.slice() })),
      };
      list = merged;
    }

    let rulesInfo = { capped: 0, authorOnce: 0 };
    if (fixes.shortRules) {
      const above = list.filter((item) => item.rulesTokens > SHORT_RULES_TOKENS);
      list = list.map((item) => ({
        ...item,
        rulesTokens: Math.min(item.rulesTokens, SHORT_RULES_TOKENS),
      }));
      rulesInfo = {
        capped: above.length,
        authorOnce: above.length ? RULES_AUTHOR_ONCE : 0,
      };
    }

    return { bots: list, cadenceChanges, compactChanges, consolidateInfo, rulesInfo };
  }

  function pricesOf(prices) {
    const input = Number(prices && prices.inputPerMillion);
    const work = Number(prices && prices.workPerMillion);
    return {
      inputPerMillion: clamp(input, 0, MAX_PRICE),
      workPerMillion: clamp(work, 0, MAX_PRICE),
    };
  }

  function hasVerifier(bots) {
    return (bots || []).some((item) => item.verifies);
  }

  function verifyTokensFor(originalBots, effective, verifyOn) {
    if (!verifyOn || hasVerifier(originalBots)) return 0;
    const runs = effective.bots.reduce((sum, item) => sum + item.runsPerDay * MONTH_DAYS, 0);
    return VERIFY_AUTHOR_ONCE + VERIFY_PER_RUN * runs;
  }

  function spend(effective, extras, prices) {
    const rates = pricesOf(prices);
    let historyTokens = 0;
    let rulesTokens = 0;
    let workTokens = 0;
    let runs = 0;
    const perBot = effective.bots.map((item) => {
      const monthRuns = item.runsPerDay * MONTH_DAYS;
      const history = monthRuns * item.historyTokens;
      const rules = monthRuns * item.rulesTokens;
      const work = item.monthlyWork;
      historyTokens += history;
      rulesTokens += rules;
      workTokens += work;
      runs += monthRuns;
      const total = history + rules + work;
      return {
        id: item.id,
        name: item.name,
        runs: monthRuns,
        history,
        rules,
        work,
        total,
        rereadShare: total ? history / total : 0,
      };
    });
    const authorOnce = extras.authorOnce || 0;
    const verifyTokens = extras.verifyTokens || 0;
    rulesTokens += authorOnce + verifyTokens;
    const totalTokens = historyTokens + rulesTokens + workTokens;
    const historyCost = historyTokens * rates.inputPerMillion / 1e6;
    const rulesCost = rulesTokens * rates.inputPerMillion / 1e6;
    const workCost = workTokens * rates.workPerMillion / 1e6;
    return {
      days: MONTH_DAYS,
      runs,
      historyTokens,
      rulesTokens,
      workTokens,
      totalTokens,
      rereadShare: totalTokens ? historyTokens / totalTokens : 0,
      rulesShare: totalTokens ? rulesTokens / totalTokens : 0,
      workShare: totalTokens ? workTokens / totalTokens : 0,
      historyCost,
      rulesCost,
      workCost,
      totalCost: historyCost + rulesCost + workCost,
      perBot,
      authorOnce,
      verifyTokens,
      prices: rates,
    };
  }

  function chainOf(bots) {
    return bots
      .filter((item) => item.chainIndex != null && item.onChain !== false)
      .slice()
      .sort((a, b) => a.chainIndex - b.chainIndex);
  }

  function usesShortRules(bots, shortRulesFix) {
    if (shortRulesFix) return true;
    const chain = chainOf(bots);
    const judged = chain.length ? chain : bots;
    if (!judged.length) return false;
    return judged.every((item) => item.rulesTokens <= RULES_HELP_AT);
  }

  function mistakesOf(bots, options) {
    const chain = chainOf(bots);
    const extra = clamp(Math.round(Number(options.extraHandoffs) || 0), 0, MAX_EXTRA_HANDOFFS);
    const handoffs = Math.max(0, chain.length - 1) + extra;
    const shortRules = usesShortRules(bots, Boolean(options.shortRules));
    let perRunMiss = shortRules ? MISS_RULES : MISS_LONG;
    const verify = Boolean(options.verify);
    if (verify) perRunMiss *= VERIFY_FACTOR;
    const perJob = chain.length * perRunMiss + handoffs * HANDOFF_MISS;
    const jobs = JOBS_PER_DAY * MONTH_DAYS;
    return {
      chainLength: chain.length,
      handoffs,
      extraHandoffs: extra,
      perRunMiss,
      handoffMiss: HANDOFF_MISS,
      perJob,
      jobs,
      perMonth: perJob * jobs,
      shortRules,
      verify,
      oneMoreHandoff: HANDOFF_MISS * jobs,
    };
  }

  function flagsOf(options) {
    const source = options || {};
    return {
      compact: Boolean(source.compact),
      cadence: Boolean(source.cadence),
      consolidate: Boolean(source.consolidate),
      shortRules: Boolean(source.shortRules),
      verify: Boolean(source.verify),
      extraHandoffs: clamp(Math.round(Number(source.extraHandoffs) || 0), 0, MAX_EXTRA_HANDOFFS),
      prices: pricesOf(source.prices || DEFAULT_PRICES),
    };
  }

  function scenario(bots, options) {
    const flags = flagsOf(options);
    const effective = applyLeakFixes(bots, flags);
    const verifyTokens = verifyTokensFor(bots, effective, flags.verify);
    const spent = spend(effective, { authorOnce: effective.rulesInfo.authorOnce, verifyTokens }, flags.prices);
    const mistakes = mistakesOf(effective.bots, flags);
    return { flags, effective, spend: spent, mistakes };
  }

  function compare(bots, options) {
    const flags = flagsOf(options);
    const before = scenario(bots, { ...flags, compact: false, cadence: false, consolidate: false, shortRules: false });
    const after = scenario(bots, flags);
    return {
      before,
      after,
      delta: {
        tokens: after.spend.totalTokens - before.spend.totalTokens,
        cost: after.spend.totalCost - before.spend.totalCost,
        rereadShare: after.spend.rereadShare - before.spend.rereadShare,
        mistakes: after.mistakes.perMonth - before.mistakes.perMonth,
        runs: after.spend.runs - before.spend.runs,
      },
    };
  }

  globalThis.TokenLeak = {
    MONTH_DAYS,
    JOBS_PER_DAY,
    CADENCE_CAP,
    COMPACT_HISTORY_TOKENS,
    SHORT_RULES_TOKENS,
    RULES_HELP_AT,
    RULES_AUTHOR_ONCE,
    VERIFY_AUTHOR_ONCE,
    VERIFY_PER_RUN,
    MISS_LONG,
    MISS_RULES,
    VERIFY_FACTOR,
    HANDOFF_MISS,
    MAX_EXTRA_HANDOFFS,
    LIMITS,
    DEFAULT_PRICES,
    DOMAINS,
    PRESETS,
    team,
    snap,
    signature,
    isPresetClean,
    hasVerifier,
    compare,
    scenario,
  };
})();
