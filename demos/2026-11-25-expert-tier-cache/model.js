// Illustrative simulation of a three-tier expert cache.
// Copperline Physical Therapy, the patients, and the drafts were invented for this page.
// This is not Magnitude's code, and the tok/s numbers are not its benchmarks.
// https://github.com/magnitudedev/magnitude
(function () {
  "use strict";

  var CLINIC = "Copperline Physical Therapy";
  var CLINICIAN = "Dana Cho";
  var EXPERTS = 256;
  var ACTIVE = 12;
  var WINDOW_AT_FULL_SKEW = 24;
  var BYTES_PER_EXPERT = 8 * 1024 * 1024;
  var RAM_GBPS = 50;
  var COMPUTE_SEC = 0.012;
  var CLIFF_SEC = 0.45;
  var HISTORY_CAP = 120;
  var SEED = 20261125;

  var SSD = {
    sata: { id: "sata", label: "SATA", gbps: 0.5 },
    pcie4: { id: "pcie4", label: "PCIe 4", gbps: 5 },
    pcie5: { id: "pcie5", label: "PCIe 5", gbps: 12 }
  };

  var LIMITS = {
    vram: { min: 4, max: 48, step: 4, def: 24 },
    ram: { min: 8, max: 128, step: 8, def: 48 },
    skew: { min: 0, max: 1, def: 0.8 },
    mispredict: { min: 0, max: 1, def: 0.15 }
  };

  // One topic, one visit. The words stay inside a single expert band.
  var NOTE = [
    { topic: 0, words: ["Visit", "note", "for", "Mara", "Ellison."] },
    { topic: 0, words: ["Right", "knee,", "session", "4", "of", "8."] },
    { topic: 0, words: ["Stairs", "hurt", "less", "than", "last", "Thursday."] },
    { topic: 0, words: ["Gait", "is", "steadier", "on", "level", "ground."] },
    { topic: 0, words: ["Home", "plan:", "straight-leg", "raise,", "2", "sets", "of", "10."] },
    { topic: 0, words: ["Mini", "squat", "to", "a", "chair,", "2", "sets", "of", "8."] },
    { topic: 0, words: ["Stop", "if", "the", "knee", "swells", "or", "the", "pain", "jumps."] },
    { topic: 0, words: ["Ice", "the", "knee", "for", "ten", "minutes", "after", "the", "harder", "set."] },
    { topic: 0, words: [CLINICIAN, "will", "see", "Mara", "next", "Tuesday."] }
  ];

  // Four short drafts. Each sentence uses a different expert band.
  var MIXED = [
    { topic: 0, words: ["Knee", "note", "for", "Mara", "Ellison."] },
    { topic: 1, words: ["Shoulder", "handout", "for", "Jonah", "Peck."] },
    { topic: 2, words: ["Balance", "handout", "for", "June", "Harlow."] },
    { topic: 3, words: ["Ankle", "handout", "for", "Chris", "Adel."] },
    { topic: 0, words: ["Mara:", "straight-leg", "raise,", "2", "sets", "of", "10."] },
    { topic: 1, words: ["Jonah:", "band", "pull-apart,", "2", "sets", "of", "12."] },
    { topic: 2, words: ["June:", "feet-together", "stand,", "20", "seconds,", "3", "times."] },
    { topic: 3, words: ["Chris:", "towel", "scrunches,", "2", "sets", "of", "10."] }
  ];

  function flatten(sentences) {
    var out = [];
    var s;
    var i;
    for (s = 0; s < sentences.length; s++) {
      for (i = 0; i < sentences[s].words.length; i++) {
        out.push({
          text: sentences[s].words[i],
          topic: sentences[s].topic,
          sentence: s,
          wordIndex: i,
          words: sentences[s].words
        });
      }
    }
    return out;
  }

  var SCRIPTS = {
    note: flatten(NOTE),
    mixed: flatten(MIXED)
  };

  function clamp(n, min, max) {
    if (!isFinite(n)) return min;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function snap(n, spec) {
    var value = isFinite(n) ? n : spec.def;
    value = clamp(value, spec.min, spec.max);
    var steps = Math.round((value - spec.min) / spec.step);
    return spec.min + steps * spec.step;
  }

  function normalize(config) {
    var src = config || {};
    var ssd = SSD[src.ssd] ? src.ssd : "pcie4";
    var policy = src.policy === "lru" ? "lru" : "lfu";
    var scenario = src.scenario === "mixed" ? "mixed" : "note";
    return {
      vramSlots: snap(Number(src.vramSlots), LIMITS.vram),
      ramSlots: snap(Number(src.ramSlots), LIMITS.ram),
      ssd: ssd,
      skew: clamp(isFinite(Number(src.skew)) ? Number(src.skew) : LIMITS.skew.def, 0, 1),
      policy: policy,
      prefetch: src.prefetch !== false,
      mispredict: clamp(isFinite(Number(src.mispredict)) ? Number(src.mispredict) : LIMITS.mispredict.def, 0, 1),
      scenario: scenario,
      seed: isFinite(Number(src.seed)) ? (Number(src.seed) >>> 0) : SEED
    };
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function blank(n) {
    var slots = [];
    var i;
    for (i = 0; i < n; i++) slots.push(null);
    return slots;
  }

  function indexOfId(slots, id) {
    var i;
    for (i = 0; i < slots.length; i++) {
      if (slots[i] && slots[i].id === id) return i;
    }
    return -1;
  }

  function worse(a, b, policy) {
    if (policy === "lru") return a.order < b.order;
    if (a.hits !== b.hits) return a.hits < b.hits;
    return a.order < b.order;
  }

  function victimIndex(slots, policy) {
    var best = 0;
    var i;
    for (i = 1; i < slots.length; i++) {
      if (worse(slots[i], slots[best], policy)) best = i;
    }
    return best;
  }

  function place(slots, entry, policy) {
    var idx = -1;
    var i;
    var evicted = null;
    for (i = 0; i < slots.length; i++) {
      if (!slots[i]) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      idx = victimIndex(slots, policy);
      evicted = slots[idx];
    }
    slots[idx] = entry;
    return evicted;
  }

  function touch(state, entry) {
    entry.hits += 1;
    entry.order = ++state.clock;
  }

  function promote(state, entry) {
    var evicted = place(state.vram, entry, state.policy);
    if (!evicted || !state.ram.length) return;
    place(state.ram, evicted, state.policy);
  }

  function pickExperts(rng, skew, topic) {
    var span = Math.round(EXPERTS - skew * (EXPERTS - WINDOW_AT_FULL_SKEW));
    if (span < ACTIVE) span = ACTIVE;
    if (span > EXPERTS) span = EXPERTS;
    var origin = (topic * 47) % EXPERTS;
    var pool = [];
    var i;
    var j;
    var tmp;
    for (i = 0; i < span; i++) pool.push((origin + i) % EXPERTS);
    for (i = 0; i < ACTIVE; i++) {
      j = i + Math.floor(rng() * (span - i));
      tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, ACTIVE);
  }

  function predict(route, rng, rate) {
    var n = Math.round(rate * route.length);
    var predicted = route.slice();
    var blocked = {};
    var wastedIds = [];
    var i;
    var k;
    var decoy;
    var guard;
    if (n > route.length) n = route.length;
    if (n < 0) n = 0;
    for (i = 0; i < route.length; i++) blocked[route[i]] = true;
    for (k = 0; k < n; k++) {
      decoy = Math.floor(rng() * EXPERTS);
      guard = 0;
      while (blocked[decoy] && guard < EXPERTS) {
        decoy = (decoy + 1) % EXPERTS;
        guard++;
      }
      blocked[decoy] = true;
      predicted[k] = decoy;
      wastedIds.push(decoy);
    }
    return { predicted: predicted, wastedIds: wastedIds };
  }

  function residentIds(slots) {
    var ids = [];
    var i;
    for (i = 0; i < slots.length; i++) {
      if (slots[i]) ids.push(slots[i].id);
    }
    return ids;
  }

  function contains(list, id) {
    var i;
    for (i = 0; i < list.length; i++) if (list[i] === id) return true;
    return false;
  }

  function create(config) {
    var c = normalize(config);
    return {
      vramSlots: c.vramSlots,
      ramSlots: c.ramSlots,
      ssd: c.ssd,
      skew: c.skew,
      policy: c.policy,
      prefetch: c.prefetch,
      mispredict: c.mispredict,
      scenario: c.scenario,
      seed: c.seed,
      vram: blank(c.vramSlots),
      ram: blank(c.ramSlots),
      routeRng: mulberry32(c.seed),
      prefetchRng: mulberry32((c.seed + 99) >>> 0),
      script: SCRIPTS[c.scenario],
      token: 0,
      clock: 0,
      history: [],
      last: null,
      totals: {
        tokens: 0,
        vramHits: 0,
        ramHits: 0,
        ssdMisses: 0,
        ssdBytes: 0,
        wastedBytes: 0
      }
    };
  }

  function demand(state, id, stats) {
    var idx = indexOfId(state.vram, id);
    var entry;
    if (idx >= 0) {
      touch(state, state.vram[idx]);
      stats.vramHitIds.push(id);
      return "vram";
    }
    idx = indexOfId(state.ram, id);
    if (idx >= 0) {
      entry = state.ram[idx];
      state.ram[idx] = null;
      touch(state, entry);
      promote(state, entry);
      stats.ramHitIds.push(id);
      return "ram";
    }
    entry = { id: id, hits: 0, order: 0 };
    touch(state, entry);
    if (state.ram.length) {
      place(state.ram, entry, state.policy);
      idx = indexOfId(state.ram, id);
      if (idx >= 0) state.ram[idx] = null;
    }
    promote(state, entry);
    stats.ssdMissIds.push(id);
    return "ssd";
  }

  function prefetchIntoRam(state, id, route, stats) {
    var entry;
    if (indexOfId(state.vram, id) >= 0 || indexOfId(state.ram, id) >= 0) return;
    if (!state.ram.length) return;
    entry = { id: id, hits: 0, order: ++state.clock };
    place(state.ram, entry, state.policy);
    stats.prefetchReads += 1;
    stats.prefetchIds.push(id);
    if (!contains(route, id)) {
      stats.wastedReads += 1;
      stats.wastedIds.push(id);
    }
  }

  function tokenTiming(counts, config) {
    var c = normalize(config);
    var bps = SSD[c.ssd].gbps * 1e9;
    var prefetchReads = counts.prefetchReads || 0;
    var ssdMisses = counts.ssdMisses || 0;
    var ramHits = counts.ramHits || 0;
    var wastedReads = counts.wastedReads || 0;
    var usefulPrefetch = Math.max(0, prefetchReads - wastedReads);
    var usefulTime = (usefulPrefetch * BYTES_PER_EXPERT) / bps;
    var wastedTime = (wastedReads * BYTES_PER_EXPERT) / bps;
    var demandTime = (ssdMisses * BYTES_PER_EXPERT) / bps;
    var ramTime = (ramHits * BYTES_PER_EXPERT) / (RAM_GBPS * 1e9);
    // A correct prefetch can overlap compute. A wrong guess still occupies the SSD.
    var overlap = c.prefetch ? Math.min(usefulTime, COMPUTE_SEC) : 0;
    var shortfall = Math.max(0, ACTIVE - c.vramSlots);
    var cliff = shortfall === 0 ? 0 : CLIFF_SEC * (shortfall / ACTIVE);
    var sec = COMPUTE_SEC + ramTime + demandTime + Math.max(0, usefulTime - overlap) + wastedTime + cliff;
    return {
      sec: sec,
      tokPerSec: 1 / sec,
      cliff: shortfall > 0,
      shortfall: shortfall,
      ssdBytes: (prefetchReads + ssdMisses) * BYTES_PER_EXPERT,
      wastedBytes: (counts.wastedReads || 0) * BYTES_PER_EXPERT
    };
  }

  function step(state, routeOverride) {
    var cursor = state.script[state.token % state.script.length];
    var route = routeOverride ? routeOverride.slice() : pickExperts(state.routeRng, state.skew, cursor.topic);
    var guess;
    var i;
    var where;
    var timing;
    var stats = {
      index: state.token,
      word: cursor.text,
      topic: cursor.topic,
      sentence: cursor.sentence,
      wordIndex: cursor.wordIndex,
      words: cursor.words,
      route: route.slice(),
      vramHits: 0,
      ramHits: 0,
      ssdMisses: 0,
      prefetchReads: 0,
      wastedReads: 0,
      vramHitIds: [],
      ramHitIds: [],
      ssdMissIds: [],
      prefetchIds: [],
      wastedIds: []
    };
    if (route.length !== ACTIVE) {
      throw new Error("A token routes " + ACTIVE + " experts.");
    }
    if (state.prefetch) {
      guess = predict(route, state.prefetchRng, state.mispredict);
      for (i = 0; i < guess.predicted.length; i++) {
        prefetchIntoRam(state, guess.predicted[i], route, stats);
      }
    }
    for (i = 0; i < route.length; i++) {
      where = demand(state, route[i], stats);
      if (where === "vram") stats.vramHits += 1;
      else if (where === "ram") stats.ramHits += 1;
      else stats.ssdMisses += 1;
    }
    timing = tokenTiming(stats, state);
    stats.tokPerSec = timing.tokPerSec;
    stats.sec = timing.sec;
    stats.cliff = timing.cliff;
    stats.shortfall = timing.shortfall;
    stats.ssdBytes = timing.ssdBytes;
    stats.wastedBytes = timing.wastedBytes;
    stats.vramResidents = residentIds(state.vram);
    stats.ramResidents = residentIds(state.ram);
    state.history.push(stats);
    if (state.history.length > HISTORY_CAP) state.history.shift();
    state.totals.tokens += 1;
    state.totals.vramHits += stats.vramHits;
    state.totals.ramHits += stats.ramHits;
    state.totals.ssdMisses += stats.ssdMisses;
    state.totals.ssdBytes += stats.ssdBytes;
    state.totals.wastedBytes += stats.wastedBytes;
    state.last = stats;
    state.token += 1;
    return stats;
  }

  function run(config) {
    var n = config && isFinite(Number(config.tokens)) ? Number(config.tokens) : 1;
    var state = create(config);
    var i;
    var last = null;
    if (n < 1) n = 1;
    for (i = 0; i < n; i++) last = step(state);
    return { state: state, last: last };
  }

  function rate(hits, tokens) {
    if (!tokens) return 0;
    return hits / (tokens * ACTIVE);
  }

  function scriptText(name) {
    var script = SCRIPTS[name] || SCRIPTS.note;
    var parts = [];
    var i;
    for (i = 0; i < script.length; i++) parts.push(script[i].text);
    return parts.join(" ");
  }

  function formatTok(n) {
    var text;
    if (!isFinite(n)) return "\u2014";
    text = (Math.round(n * 10) / 10).toFixed(1);
    if (text.slice(-2) === ".0") text = text.slice(0, -2);
    return text;
  }

  function formatBytes(n) {
    var mib;
    if (!isFinite(n) || n <= 0) return "0 MiB";
    mib = n / (1024 * 1024);
    if (mib >= 10) return String(Math.round(mib)) + " MiB";
    return (Math.round(mib * 10) / 10).toFixed(1).replace(/\.0$/, "") + " MiB";
  }

  function formatPct(n) {
    var text;
    if (!isFinite(n)) return "\u2014";
    text = (Math.round(n * 1000) / 10).toFixed(1);
    if (text.slice(-2) === ".0") text = text.slice(0, -2);
    return text + "%";
  }

  function describe(stats) {
    if (!stats) return "";
    return stats.vramHits + " already in VRAM, " +
      stats.ramHits + " moved RAM \u2192 VRAM, " +
      stats.ssdMisses + " streamed SSD \u2192 RAM \u2192 VRAM.";
  }

  globalThis.ExpertTierLab = {
    CLINIC: CLINIC,
    CLINICIAN: CLINICIAN,
    EXPERTS: EXPERTS,
    ACTIVE: ACTIVE,
    BYTES_PER_EXPERT: BYTES_PER_EXPERT,
    RAM_GBPS: RAM_GBPS,
    COMPUTE_SEC: COMPUTE_SEC,
    CLIFF_SEC: CLIFF_SEC,
    SSD: SSD,
    LIMITS: LIMITS,
    SEED: SEED,
    create: create,
    step: step,
    run: run,
    tokenTiming: tokenTiming,
    pickExperts: pickExperts,
    residentIds: residentIds,
    rate: rate,
    script: function (name) { return SCRIPTS[name] || SCRIPTS.note; },
    scriptText: scriptText,
    formatTok: formatTok,
    formatBytes: formatBytes,
    formatPct: formatPct,
    describe: describe,
    ceilingTok: 1 / COMPUTE_SEC
  };
})();
