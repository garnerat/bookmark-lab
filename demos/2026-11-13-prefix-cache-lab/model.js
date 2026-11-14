// Simulated time-to-first-token for a local chat with and without prefix KV reuse.
// Token counts are a scripted stand-in. This file does not tokenize or call a model.
(function () {
  const SYSTEM_TOKENS = 720;
  const LETTER_TOKENS = 1280;
  const QUESTION_TOKENS = 40;
  const ANSWER_TOKENS = 220;
  const TIMESTAMP_TOKENS = 16;
  // 2 * 64 layers * 8 KV heads * 128 head dim * 2 bytes (fp16). A sketch, not Qwen.
  const KV_BYTES_PER_TOKEN = 2 * 64 * 8 * 128 * 2;
  const MACHINE_BYTES = 64 * 1024 * 1024 * 1024;
  const ANIMATION_MS_PER_SIM_SECOND = 50;

  const SOURCE = {
    rereadTokens: 24000,
    rereadSeconds: 76.8,
    cachedTokens: 34000,
    ttftLow: 0.34,
    ttftHigh: 1.19,
    postId: "2120803634833137891",
    postUrl: "https://x.com/CerebralCoding_/status/2120803634833137891",
  };

  const RANGES = {
    prefillTokPerSec: { min: 50, max: 2000, step: 5 },
    contractTokens: { min: 4000, max: 48000, step: 1000 },
    turns: { min: 2, max: 8, step: 1 },
  };

  const DEFAULTS = {
    prefillTokPerSec: 315,
    contractTokens: 22000,
    turns: 4,
    mode: "cache",
    breaker: "none",
  };

  const TURNS = [
    {
      question: "What notice does the client give to end the agreement?",
      answer: "The draft says either party may end it with 30 days' written notice.",
    },
    {
      question: "Who owns the work product?",
      answer: "The draft says the client owns the deliverables. The firm keeps its forms.",
    },
    {
      question: "Which state's law does the draft pick?",
      answer: "The draft names the law of the fictional State of Ashwick.",
    },
    {
      question: "What does the draft say about a late invoice?",
      answer: "A fictional late mark starts after 15 days. The draft names no amount and no account.",
    },
    {
      question: "Does the draft mention confidentiality?",
      answer: "Yes. Both sides keep the draft in the office. It names no real client.",
    },
    {
      question: "Where should a notice be sent?",
      answer: "The draft sends notices to 1 Ledger Lane, Ashwick. That street is made up.",
    },
    {
      question: "May the client reuse the firm's forms?",
      answer: "No. The draft says the firm keeps its forms and does not license them.",
    },
    {
      question: "What work is this intake allowed to do?",
      answer: "The engagement template limits the work to questions about this draft.",
    },
  ];

  const EDITED_FIRST_QUESTION = "What notice does either party give to end the agreement?";

  const CLOCKS = [
    "09:00:00",
    "09:04:12",
    "09:07:41",
    "09:11:02",
    "09:15:18",
    "09:18:55",
    "09:22:07",
    "09:26:33",
  ];

  function clamp(value, min, max) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = min;
    return Math.min(max, Math.max(min, n));
  }

  function sumSeconds(rows) {
    return rows.reduce(function (total, row) {
      return total + row.ttftSeconds;
    }, 0);
  }

  function speedup(baseline, faster) {
    if (faster === 0) return null;
    return baseline / faster;
  }

  function openingPrefix(contractTokens) {
    return SYSTEM_TOKENS + LETTER_TOKENS + contractTokens;
  }

  function plan(mode, ctx) {
    const rows = [];
    for (let i = 0; i < ctx.turns; i++) {
      const stamp = ctx.breaker === "timestamp" ? TIMESTAMP_TOKENS : 0;
      const history = i * (QUESTION_TOKENS + ANSWER_TOKENS);
      const prefix = stamp + ctx.stableHead + history;
      const fresh = QUESTION_TOKENS;
      let cached = 0;
      let kind = "full";

      if (mode === "cache" && ctx.breaker === "timestamp") {
        kind = "timestamp";
        cached = 0;
      } else if (mode === "cache" && i === 0) {
        kind = "cold";
        cached = 0;
      } else if (mode === "cache" && ctx.breaker === "edit" && i === ctx.editAt) {
        kind = "edit";
        cached = ctx.stableHead;
      } else if (mode === "cache") {
        kind = "hit";
        cached = prefix;
      }

      const recompute = prefix + fresh - cached;
      rows.push({
        index: i,
        kind: kind,
        prefixTokens: prefix,
        newTokens: fresh,
        cachedTokens: cached,
        recomputedPrefixTokens: prefix - cached,
        recomputeTokens: recompute,
        ttftSeconds: recompute / ctx.prefillTokPerSec,
        question: TURNS[i].question,
        answer: TURNS[i].answer,
        clock: CLOCKS[i],
      });
    }
    return rows;
  }

  function simulate(raw) {
    const input = raw || {};
    const prefillTokPerSec = clamp(
      input.prefillTokPerSec == null ? DEFAULTS.prefillTokPerSec : input.prefillTokPerSec,
      RANGES.prefillTokPerSec.min,
      RANGES.prefillTokPerSec.max
    );
    const contractTokens = Math.round(clamp(
      input.contractTokens == null ? DEFAULTS.contractTokens : input.contractTokens,
      RANGES.contractTokens.min,
      RANGES.contractTokens.max
    ));
    const turns = Math.round(clamp(
      input.turns == null ? DEFAULTS.turns : input.turns,
      RANGES.turns.min,
      RANGES.turns.max
    ));
    const mode = input.mode === "nocache" ? "nocache" : "cache";
    const breaker = input.breaker === "timestamp" || input.breaker === "edit" ? input.breaker : "none";
    const stableHead = openingPrefix(contractTokens);
    const editAt = Math.min(2, turns - 1);
    const ctx = {
      prefillTokPerSec: prefillTokPerSec,
      turns: turns,
      breaker: breaker,
      stableHead: stableHead,
      editAt: editAt,
    };
    const cacheRows = plan("cache", ctx);
    const nocacheRows = plan("nocache", ctx);
    const rows = mode === "cache" ? cacheRows : nocacheRows;
    const cacheSeconds = sumSeconds(cacheRows);
    const nocacheSeconds = sumSeconds(nocacheRows);
    const followupCacheSeconds = sumSeconds(cacheRows.slice(1));
    const followupNocacheSeconds = sumSeconds(nocacheRows.slice(1));
    const stamp = breaker === "timestamp" ? TIMESTAMP_TOKENS : 0;
    const contextTokens = stableHead + stamp + turns * (QUESTION_TOKENS + ANSWER_TOKENS);
    const bytes = contextTokens * KV_BYTES_PER_TOKEN;

    return {
      input: {
        prefillTokPerSec: prefillTokPerSec,
        contractTokens: contractTokens,
        turns: turns,
        mode: mode,
        breaker: breaker,
      },
      stableHead: stableHead,
      editIndex: breaker === "edit" ? editAt : null,
      editRecovers: breaker === "edit" && editAt < turns - 1,
      rows: rows,
      totals: {
        cacheSeconds: cacheSeconds,
        nocacheSeconds: nocacheSeconds,
        shownSeconds: mode === "cache" ? cacheSeconds : nocacheSeconds,
        speedup: speedup(nocacheSeconds, cacheSeconds),
        followupCacheSeconds: followupCacheSeconds,
        followupNocacheSeconds: followupNocacheSeconds,
        followupSpeedup: speedup(followupNocacheSeconds, followupCacheSeconds),
      },
      memory: {
        contextTokens: contextTokens,
        bytes: bytes,
        gigabytes: bytes / (1024 * 1024 * 1024),
        fractionOfMachine: bytes / MACHINE_BYTES,
        bytesPerToken: KV_BYTES_PER_TOKEN,
        machineGigabytes: 64,
      },
    };
  }

  globalThis.PrefixCacheLab = {
    SYSTEM_TOKENS: SYSTEM_TOKENS,
    LETTER_TOKENS: LETTER_TOKENS,
    QUESTION_TOKENS: QUESTION_TOKENS,
    ANSWER_TOKENS: ANSWER_TOKENS,
    TIMESTAMP_TOKENS: TIMESTAMP_TOKENS,
    KV_BYTES_PER_TOKEN: KV_BYTES_PER_TOKEN,
    MACHINE_BYTES: MACHINE_BYTES,
    ANIMATION_MS_PER_SIM_SECOND: ANIMATION_MS_PER_SIM_SECOND,
    SOURCE: SOURCE,
    RANGES: RANGES,
    DEFAULTS: DEFAULTS,
    TURNS: TURNS,
    EDITED_FIRST_QUESTION: EDITED_FIRST_QUESTION,
    CLOCKS: CLOCKS,
    openingPrefix: openingPrefix,
    simulate: simulate,
  };
})();
