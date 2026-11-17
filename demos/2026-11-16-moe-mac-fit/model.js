// Back-of-envelope fit and decode sketch for a local mixture-of-experts model.
// Gigabytes are decimal (10^9 bytes) so (224 − 64) × 4 bits / 8 lands on 80.
// This file does not load weights, call a runtime, or measure a Mac.
(function () {
  const FIRM = "Ledger & Lane Accounting";

  const POSTS = {
    bookmark: {
      handle: "CerebralCoding_",
      id: "2122252697025892538",
      url: "https://x.com/CerebralCoding_/status/2122252697025892538",
      date: "16 Nov 2026",
    },
    quoted: {
      handle: "superalesha",
      id: "2122220065932148876",
      url: "https://x.com/superalesha/status/2122220065932148876",
    },
  };

  // Figures stated in those two posts. Active params for DeepSeek are not among them.
  const HY4 = { totalB: 224, activeB: 12, lookupB: 64, bits: 4 };
  const DEEPSEEK_EXPERT_GB = 290;
  const DEEPSEEK = {
    totalB: (DEEPSEEK_EXPERT_GB * 8) / 4,
    activeB: null,
    lookupB: 0,
    bits: 4,
  };

  const RAMS = [32, 64, 96, 128, 192, 256];
  const BITS = [16, 8, 6, 4, 3];
  const HEADROOMS = [0.2, 0.25];
  const BANDWIDTH_PRESETS = [
    { id: "pro", label: "Pro-class", gbps: 200 },
    { id: "max", label: "Max-class", gbps: 400 },
    { id: "ultra", label: "Ultra-class", gbps: 800 },
  ];
  const CONTEXT_JUMPS = [8192, 32768, 131072, 1048576];

  const RANGES = {
    totalB: { min: 1, max: 2000 },
    activeB: { min: 0.1, max: 2000 },
    lookupB: { min: 0, max: 2000 },
    bandwidthGBps: { min: 20, max: 2000 },
    ssdGBps: { min: 0.5, max: 20 },
    context: { min: 4096, max: 1048576, step: 1024 },
    kvBytesPerToken: { min: 1024, max: 524288, step: 1024 },
  };

  const DEFAULTS = {
    totalB: HY4.totalB,
    activeB: HY4.activeB,
    lookupB: HY4.lookupB,
    bits: HY4.bits,
    ramGB: 128,
    bandwidthGBps: 400,
    context: 32768,
    kvBytesPerToken: 8192,
    headroom: 0.25,
    lookupOnSsd: true,
    streamExperts: false,
    ssdGBps: 5,
  };

  const ESTIMATE_LABEL = "Rough back-of-envelope estimate, not a benchmark.";
  const FIGURES_LINE = "The model figures come from the linked posts.";

  function weightGB(paramsB, bits) {
    return (paramsB * bits) / 8;
  }

  function commas(n) {
    const rounded = Math.round(Math.abs(n));
    const sign = n < 0 ? "-" : "";
    return sign + String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatB(n) {
    if (!Number.isFinite(n)) return "—";
    if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    const scaled = Math.round(n * 100) / 100;
    return String(scaled);
  }

  function formatGB(n) {
    if (!Number.isFinite(n)) return "—";
    const abs = Math.abs(n);
    let digits = 2;
    if (abs >= 1 && Math.abs(n - Math.round(n)) < 0.05) digits = 0;
    else if (abs >= 10) digits = 1;
    let text = n.toFixed(digits);
    if (digits > 0) {
      text = text.replace(/0+$/, "").replace(/\.$/, "");
    }
    return text + " GB";
  }

  function formatTok(n) {
    if (!Number.isFinite(n)) return "—";
    if (n >= 100) return commas(n);
    if (n >= 10) return n.toFixed(1);
    return n.toFixed(2);
  }

  function formatPercent(fraction) {
    return Math.round(fraction * 100) + "%";
  }

  function parseBlankNumber(value) {
    if (value == null) return { blank: true, value: null };
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return { error: true };
      return { blank: false, value: value };
    }
    const text = String(value).trim();
    if (text === "") return { blank: true, value: null };
    const n = Number(text);
    if (!Number.isFinite(n)) return { error: true };
    return { blank: false, value: n };
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function invalid(message) {
    return {
      ok: false,
      error: message,
      verdict: "CHECK",
      verdictLabel: "CHECK INPUTS",
      why: message,
    };
  }

  function judge(slack, ramGB) {
    if (slack < -1e-9) return "WONT_FIT";
    const tightBelow = Math.max(8, ramGB * 0.08);
    if (slack < tightBelow - 1e-9) return "TIGHT";
    return "FITS";
  }

  function verdictLabel(verdict) {
    if (verdict === "FITS") return "FITS";
    if (verdict === "TIGHT") return "TIGHT";
    if (verdict === "WONT_FIT") return "WON'T FIT";
    if (verdict === "NEED_ACTIVE") return "SET ACTIVE";
    return "CHECK INPUTS";
  }

  function given(value, fallback) {
    return value === undefined ? fallback : value;
  }

  function readInput(raw) {
    const input = raw || {};
    const total = parseBlankNumber(given(input.totalB, DEFAULTS.totalB));
    if (total.error || total.blank) return invalid("Enter a total parameter count, in billions.");
    const lookup = parseBlankNumber(given(input.lookupB, DEFAULTS.lookupB));
    if (lookup.error || lookup.blank) return invalid("Enter the lookup-table parameters, in billions. Use 0 if there are none.");
    const active = parseBlankNumber(given(input.activeB, DEFAULTS.activeB));
    if (active.error) return invalid("Active params must be a number of billions, or left blank when the posts do not say.");
    const bandwidth = parseBlankNumber(given(input.bandwidthGBps, DEFAULTS.bandwidthGBps));
    if (bandwidth.error || bandwidth.blank) return invalid("Enter a memory-bandwidth stand-in, in GB/s.");
    const ssd = parseBlankNumber(given(input.ssdGBps, DEFAULTS.ssdGBps));
    if (ssd.error || ssd.blank) return invalid("Enter an SSD read stand-in, in GB/s.");
    const context = parseBlankNumber(given(input.context, DEFAULTS.context));
    if (context.error || context.blank) return invalid("Enter a context length, in tokens.");
    const kv = parseBlankNumber(given(input.kvBytesPerToken, DEFAULTS.kvBytesPerToken));
    if (kv.error || kv.blank) return invalid("Enter a KV-cache sketch, in bytes per token.");

    const bitsNumber = Number(given(input.bits, DEFAULTS.bits));
    if (BITS.indexOf(bitsNumber) === -1) return invalid("Quantization is 16, 8, 6, 4, or 3 bits.");
    const ramNumber = Number(given(input.ramGB, DEFAULTS.ramGB));
    if (RAMS.indexOf(ramNumber) === -1) return invalid("Pick a Mac memory size from the list.");

    let headroom = Number(given(input.headroom, DEFAULTS.headroom));
    if (!Number.isFinite(headroom)) headroom = DEFAULTS.headroom;
    if (Math.abs(headroom - 0.2) <= Math.abs(headroom - 0.25)) headroom = 0.2;
    else headroom = 0.25;

    const totalB = clamp(total.value, RANGES.totalB.min, RANGES.totalB.max);
    const lookupB = clamp(lookup.value, RANGES.lookupB.min, RANGES.lookupB.max);
    const activeB = active.blank ? null : active.value;
    if (lookupB > totalB + 1e-9) {
      return invalid("The lookup table is larger than the total parameter count.");
    }
    if (activeB != null) {
      if (activeB < RANGES.activeB.min) return invalid("Active params must be at least 0.1 billion, or left blank.");
      if (activeB + lookupB > totalB + 1e-9) {
        return invalid("Active params plus the lookup table are larger than the total.");
      }
    }

    const lookupOnSsd = input.lookupOnSsd === undefined ? DEFAULTS.lookupOnSsd : Boolean(input.lookupOnSsd);
    const streamExperts = input.streamExperts === undefined ? DEFAULTS.streamExperts : Boolean(input.streamExperts);

    return {
      ok: true,
      input: {
        totalB: totalB,
        activeB: activeB,
        lookupB: lookupB,
        bits: bitsNumber,
        ramGB: ramNumber,
        bandwidthGBps: clamp(bandwidth.value, RANGES.bandwidthGBps.min, RANGES.bandwidthGBps.max),
        context: Math.round(clamp(context.value, RANGES.context.min, RANGES.context.max)),
        kvBytesPerToken: Math.round(clamp(kv.value, RANGES.kvBytesPerToken.min, RANGES.kvBytesPerToken.max)),
        headroom: headroom,
        lookupOnSsd: lookupOnSsd,
        streamExperts: streamExperts,
        ssdGBps: clamp(ssd.value, RANGES.ssdGBps.min, RANGES.ssdGBps.max),
      },
    };
  }

  function residentParams(input) {
    if (input.streamExperts) {
      if (input.activeB == null) return null;
      return input.activeB + (input.lookupOnSsd ? 0 : input.lookupB);
    }
    if (input.lookupOnSsd) return input.totalB - input.lookupB;
    return input.totalB;
  }

  function residentFormula(input) {
    const bits = formatB(input.bits);
    if (input.streamExperts) {
      if (!input.lookupOnSsd && input.lookupB > 0) {
        return "(" + formatB(input.activeB) + " + " + formatB(input.lookupB) + ") billion × " + bits + " bits ÷ 8";
      }
      return formatB(input.activeB) + " billion × " + bits + " bits ÷ 8";
    }
    if (input.lookupOnSsd && input.lookupB > 0) {
      return "(" + formatB(input.totalB) + " − " + formatB(input.lookupB) + ") billion × " + bits + " bits ÷ 8";
    }
    return formatB(input.totalB) + " billion × " + bits + " bits ÷ 8";
  }

  function whyLine(verdict, input, pieces) {
    const label = verdictLabel(verdict);
    if (verdict === "NEED_ACTIVE") {
      return "SET ACTIVE. Cold experts would stay on the SSD, so the resident size is the active weights. These posts do not give an active-parameter count, and this page will not invent one.";
    }
    const weights = "Resident weights are " + pieces.formula + " = " + formatGB(pieces.residentGB) + ", plus " + formatGB(pieces.kvGB) + " of KV cache.";
    const mac = "A " + formatB(input.ramGB) + " GB Mac reserves " + formatGB(pieces.holdbackGB) + ", leaving " + formatGB(pieces.usableGB) + ".";
    if (verdict === "WONT_FIT") {
      return label + ". " + weights + " " + mac + " That is " + formatGB(pieces.shortGB) + " short.";
    }
    if (verdict === "TIGHT") {
      return label + ". " + weights + " " + mac + " Only " + formatGB(pieces.slackGB) + " is spare.";
    }
    return label + ". " + weights + " " + mac + " " + formatGB(pieces.slackGB) + " is spare.";
  }

  function gotchaParagraph(input, naiveGB, residentGB, naiveVerdict, verdict, activeGB) {
    const naiveFormula = formatB(input.totalB) + " billion × " + formatB(input.bits) + " bits ÷ 8";
    const activeFormula = input.activeB == null
      ? null
      : formatB(input.activeB) + " billion × " + formatB(input.bits) + " bits ÷ 8";
    if (input.streamExperts && input.activeB == null) {
      return "Total params is the wrong number to size a Mac by. " + naiveFormula + " = " + formatGB(naiveGB) + ", and that reading is " + verdictLabel(naiveVerdict) + " here. Streaming cold experts would keep only the active weights resident. These posts do not give that active count. Speed is still bandwidth divided by the bytes of active params per token.";
    }
    const same = Math.abs(naiveGB - residentGB) < 1e-6;
    const speed = activeFormula == null
      ? "Speed stays blank until you enter an active count. It is bandwidth divided by active bytes per token, not by the headline total."
      : "Speed is governed by active params: " + activeFormula + " = " + formatGB(activeGB) + " moved per token, not by the headline total.";
    if (same) {
      return "Total params is the wrong number to size a Mac by when part of the model can stay on the SSD. Right now the lookup is in RAM and cold experts are in RAM, so resident bytes really are " + naiveFormula + " = " + formatGB(naiveGB) + ". " + speed;
    }
    return "Total params is the wrong number to size a Mac by. " + naiveFormula + " = " + formatGB(naiveGB) + ", and that reading is " + verdictLabel(naiveVerdict) + " on this Mac. Resident bytes are " + residentFormula(input) + " = " + formatGB(residentGB) + ", which is " + verdictLabel(verdict) + ". " + speed;
  }

  function speedLine(input, activeGB, ramTok, ssdTok, shownTok) {
    if (activeGB == null) {
      return ESTIMATE_LABEL + " The posts do not publish an active-parameter count, so there is no tokens/sec figure. Speed would be bandwidth divided by the bytes of active params per token. " + FIGURES_LINE;
    }
    const ramText = formatB(input.bandwidthGBps) + " GB/s ÷ " + formatGB(activeGB) + " ≈ " + formatTok(ramTok) + " tok/s";
    const ssdText = formatB(input.ssdGBps) + " GB/s ÷ " + formatGB(activeGB) + " ≈ " + formatTok(ssdTok) + " tok/s";
    if (input.streamExperts) {
      return ESTIMATE_LABEL + " SSD streaming: " + ssdText + ". The same active weights from memory bandwidth would be " + ramText + ". This penalty assumes every active byte is read from the drive on each token. A hot expert cache can land faster. " + FIGURES_LINE;
    }
    return ESTIMATE_LABEL + " In memory: " + ramText + ". If cold experts streamed from the SSD, the same sketch would be " + ssdText + ". " + FIGURES_LINE;
  }

  function stepsFor(input, pieces) {
    const steps = [];
    steps.push("Headline total: " + formatB(input.totalB) + " billion × " + formatB(input.bits) + " bits ÷ 8 = " + formatGB(pieces.naiveGB) + ". That is the wrong number to size the Mac by.");
    if (pieces.residentGB == null) {
      steps.push("Resident weights need an active-parameter count, because cold experts are set to stay on the SSD.");
    } else {
      steps.push("Resident weights: " + pieces.formula + " = " + formatGB(pieces.residentGB) + ".");
    }
    if (input.lookupB > 0) {
      const lookupGB = weightGB(input.lookupB, input.bits);
      const where = input.lookupOnSsd ? "It is on the SSD, so those bytes are not resident." : "It is in RAM, so those bytes are resident.";
      steps.push("Lookup table: " + formatB(input.lookupB) + " billion × " + formatB(input.bits) + " bits ÷ 8 = " + formatGB(lookupGB) + ". " + where + " The posts say Engram is a few rows per token, so this sketch does not add it to the bytes moved per token.");
    }
    steps.push("KV cache sketch: " + commas(input.context) + " × " + commas(input.kvBytesPerToken) + " bytes = " + formatGB(pieces.kvGB) + ". The posts do not publish bytes per token. Hy4's hybrid attention is described as smaller than a plain cache. This slider is not that measurement.");
    steps.push("Holdback: " + formatPercent(input.headroom) + " of " + formatB(input.ramGB) + " GB = " + formatGB(pieces.holdbackGB) + " for the OS and other apps.");
    if (input.activeB == null) {
      steps.push("Active bytes per token are unknown. The posts give no active-parameter count for this model. Speed uses that number, not the resident total.");
    } else {
      steps.push("Active bytes per token: " + formatB(input.activeB) + " billion × " + formatB(input.bits) + " bits ÷ 8 = " + formatGB(weightGB(input.activeB, input.bits)) + ". Speed uses this, not the resident total.");
    }
    return steps;
  }

  // Usable memory is filled by weights, then KV. The holdback stays inside the Mac.
  // Anything that does not fit is one red tail, so the RAM line is the end of the Mac.
  function layoutBar(ramGB, residentGB, kvGB, holdbackGB) {
    const usable = Math.max(0, ramGB - holdbackGB);
    let room = usable;
    const segments = [];
    function take(id, label, gb) {
      const fit = Math.min(Math.max(0, room), Math.max(0, gb));
      room -= fit;
      if (fit > 1e-9) segments.push({ id: id, label: label, gb: fit });
      return Math.max(0, gb - fit);
    }
    const past = take("resident", "Resident weights", residentGB) + take("kv", "KV cache", kvGB);
    if (holdbackGB > 1e-9) segments.push({ id: "holdback", label: "OS and apps", gb: holdbackGB });
    if (room > 1e-9) segments.push({ id: "spare", label: "Spare", gb: room });
    if (past > 1e-9) segments.push({ id: "overflow", label: "Past the Mac", gb: past });
    return { segments: segments, scaleGB: ramGB + past };
  }

  function plan(raw) {
    const read = readInput(raw);
    if (!read.ok) return read;
    const input = read.input;
    const paramsB = residentParams(input);
    const needActive = paramsB == null;
    const residentGB = needActive ? null : weightGB(paramsB, input.bits);
    const naiveGB = weightGB(input.totalB, input.bits);
    const kvGB = (input.context * input.kvBytesPerToken) / 1e9;
    const holdbackGB = input.ramGB * input.headroom;
    const usableGB = input.ramGB - holdbackGB;
    const needGB = needActive ? null : residentGB + kvGB;
    const slackGB = needActive ? null : usableGB - needGB;
    const shortGB = needActive ? null : Math.max(0, -slackGB);
    const overflowGB = needActive ? null : Math.max(0, residentGB + kvGB + holdbackGB - input.ramGB);
    const spareGB = needActive ? null : Math.max(0, input.ramGB - residentGB - kvGB - holdbackGB);
    const laid = needActive ? null : layoutBar(input.ramGB, residentGB, kvGB, holdbackGB);
    const scaleGB = laid ? laid.scaleGB : input.ramGB;
    const activeGB = input.activeB == null ? null : weightGB(input.activeB, input.bits);
    const ramTok = activeGB > 0 ? input.bandwidthGBps / activeGB : null;
    const ssdTok = activeGB > 0 ? input.ssdGBps / activeGB : null;
    const shownTok = input.streamExperts ? ssdTok : ramTok;
    const verdict = needActive ? "NEED_ACTIVE" : judge(slackGB, input.ramGB);
    const naiveVerdict = judge(usableGB - (naiveGB + kvGB), input.ramGB);
    const formula = residentFormula(input);
    const pieces = {
      formula: formula,
      residentGB: residentGB,
      kvGB: kvGB,
      holdbackGB: holdbackGB,
      usableGB: usableGB,
      slackGB: slackGB,
      shortGB: shortGB,
      naiveGB: naiveGB,
    };
    const segments = laid ? laid.segments : [];
    const breakdown = needActive ? [] : [
      { id: "resident", label: "Resident weights", gb: residentGB },
      { id: "kv", label: "KV cache", gb: kvGB },
      { id: "holdback", label: "OS and apps", gb: holdbackGB },
      { id: "spare", label: "Spare", gb: spareGB },
      { id: "overflow", label: "Past the Mac", gb: overflowGB },
    ];

    return {
      ok: true,
      error: "",
      input: input,
      residentParamsB: paramsB,
      residentGB: residentGB,
      naiveGB: naiveGB,
      lookupGB: weightGB(input.lookupB, input.bits),
      kvGB: kvGB,
      holdbackGB: holdbackGB,
      usableGB: usableGB,
      needGB: needGB,
      slackGB: slackGB,
      shortGB: shortGB,
      spareGB: spareGB,
      overflowGB: overflowGB,
      scaleGB: scaleGB,
      segments: segments,
      breakdown: breakdown,
      verdict: verdict,
      verdictLabel: verdictLabel(verdict),
      naiveVerdict: naiveVerdict,
      naiveVerdictLabel: verdictLabel(naiveVerdict),
      why: whyLine(verdict, input, pieces),
      formula: formula,
      naiveFormula: formatB(input.totalB) + " billion × " + formatB(input.bits) + " bits ÷ 8",
      gotcha: gotchaParagraph(input, naiveGB, residentGB, naiveVerdict, verdict, activeGB),
      steps: stepsFor(input, pieces),
      speed: {
        activeGB: activeGB,
        ramTokPerSec: ramTok,
        ssdTokPerSec: ssdTok,
        shownTokPerSec: shownTok,
        line: speedLine(input, activeGB, ramTok, ssdTok, shownTok),
      },
    };
  }

  function smallest(rows, verdict) {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].verdict === verdict) return rows[i];
    }
    return null;
  }

  function office(raw) {
    const current = plan(raw);
    if (!current.ok) {
      return {
        ok: false,
        current: current,
        tiers: [],
        summary: FIRM + " keeps client tax documents on one office Mac. " + current.error,
      };
    }
    const base = current.input;
    const tiers = RAMS.map(function (ram) {
      return plan(Object.assign({}, base, { ramGB: ram }));
    });
    const streamed = RAMS.map(function (ram) {
      return plan(Object.assign({}, base, { ramGB: ram, streamExperts: true }));
    });
    const fit = smallest(tiers, "FITS");
    const tight = smallest(tiers, "TIGHT");
    let summary = FIRM + " keeps client tax documents on one office Mac. ";
    if (fit) summary += "The smallest listed Mac that fits these settings is " + formatB(fit.input.ramGB) + " GB.";
    else if (tight) summary += "No listed Mac fits with room to spare. The smallest tight fit is " + formatB(tight.input.ramGB) + " GB.";
    else if (current.verdict === "NEED_ACTIVE") summary += "Which Mac fits is undecided until an active-parameter count is entered.";
    else summary += "None of the listed Macs fit these settings.";

    if (!base.streamExperts) {
      const streamFit = smallest(streamed, "FITS");
      const streamNeedsActive = streamed.length && streamed[0].verdict === "NEED_ACTIVE";
      if (streamNeedsActive) {
        summary += " Streaming cold experts would shrink RAM to the active weights, which these posts do not count, so this page will not pick a streamed tier.";
      } else if (streamFit && (!fit || streamFit.input.ramGB < fit.input.ramGB)) {
        summary += " Streaming cold experts from the SSD would make " + formatB(streamFit.input.ramGB) + " GB fit, and decode would then follow the drive instead of memory bandwidth.";
      }
    }
    return {
      ok: true,
      current: current,
      tiers: tiers,
      streamed: streamed,
      summary: summary,
    };
  }

  function matchPreset(input) {
    const read = readInput(input);
    if (!read.ok) return "custom";
    const value = read.input;
    function same(preset) {
      return value.totalB === preset.totalB &&
        value.lookupB === preset.lookupB &&
        value.bits === preset.bits &&
        value.activeB === preset.activeB;
    }
    if (same(HY4)) return "hy4";
    if (same(DEEPSEEK)) return "deepseek";
    return "custom";
  }

  globalThis.MoeMacFit = {
    FIRM: FIRM,
    POSTS: POSTS,
    HY4: HY4,
    DEEPSEEK: DEEPSEEK,
    DEEPSEEK_EXPERT_GB: DEEPSEEK_EXPERT_GB,
    RAMS: RAMS,
    BITS: BITS,
    HEADROOMS: HEADROOMS,
    BANDWIDTH_PRESETS: BANDWIDTH_PRESETS,
    CONTEXT_JUMPS: CONTEXT_JUMPS,
    RANGES: RANGES,
    DEFAULTS: DEFAULTS,
    ESTIMATE_LABEL: ESTIMATE_LABEL,
    FIGURES_LINE: FIGURES_LINE,
    weightGB: weightGB,
    formatB: formatB,
    formatGB: formatGB,
    formatTok: formatTok,
    commas: commas,
    plan: plan,
    office: office,
    matchPreset: matchPreset,
    judge: judge,
  };
})();
