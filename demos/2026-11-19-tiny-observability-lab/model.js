// Simulated OpenTelemetry signals for one fictional gym morning.
// Seeded, so the same buttons always rebuild the same bookings.
(function () {
  const SHOP = "Ironside Strength Co.";
  const SEED = 20261119;
  const BUCKET_MINUTES = 5;
  const BUCKET_COUNT = 24;
  const START_MINUTES = 5 * 60 + 30;
  const SLOW_BUCKETS = { start: 5, end: 7 };
  const DEPLOY_BUCKET = 14;
  const BLIP_BUCKET = 3;
  const BLIP_COUNT = 4;

  const POST = {
    handle: "Replit",
    name: "Replit",
    id: "2122759176288190724",
    url: "https://x.com/Replit/status/2122759176288190724",
    date: "17 Nov 2026",
    claimYearUsd: 83700,
  };

  const REPO = {
    url: "https://github.com/replit/datacat",
    readme: "https://github.com/replit/datacat/blob/develop/README.md",
    selfHost: "https://github.com/replit/datacat/blob/develop/docs/SELF_HOSTING.md",
    license: "Apache-2.0",
  };

  // Round teaching rates, not a vendor price list.
  const RATES = {
    perHostCents: 3100,
    perGbCents: 50,
    vpsCents: 2400,
  };

  // Bookings per 5 minutes, 05:30 through 07:25. Dawn Iron is the 06:00 class.
  const COUNTS = [
    8, 10, 14, 18, 28, 40,
    48, 44, 30, 18, 12, 10,
    8, 8, 8, 8, 8, 8,
    10, 12, 14, 12, 10, 8,
  ];

  const DEFAULTS = {
    slowDb: true,
    smsTimeouts: false,
    badDeploy: false,
    metric: "p95",
    threshold: 800,
    windowMinutes: 10,
    hosts: 1,
    gb: 8,
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clockLabel(index) {
    const mins = START_MINUTES + index * BUCKET_MINUTES;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function clockStamp(index, second) {
    const totalSeconds = (START_MINUTES + index * BUCKET_MINUTES) * 60 + second;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor(totalSeconds / 60) % 60;
    const s = totalSeconds % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  // Nearest rank. Empty input returns null. p is 0–100.
  function percentile(values, p) {
    if (!values || !values.length) return null;
    if (p < 0 || p > 100) return null;
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const rank = Math.ceil((p / 100) * sorted.length);
    const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
    return sorted[index];
  }

  function mean(values) {
    if (!values || !values.length) return null;
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[i];
    return sum / values.length;
  }

  function metricValue(bucket, metric) {
    if (metric === "p95") return bucket.p95;
    if (metric === "p50") return bucket.p50;
    if (metric === "avg") return bucket.avg;
    if (metric === "errorRate") return bucket.errorRate;
    if (metric === "count") return bucket.count;
    return null;
  }

  // A bucket breaches when its metric is strictly over the threshold.
  // windowMinutes 0 fires on every breaching bucket.
  // A positive window fires on the bucket that completes N consecutive breaches,
  // and stays firing while that streak holds. N is the window rounded up to buckets.
  function evaluateRule(buckets, rule) {
    const bucketMinutes = rule.bucketMinutes || BUCKET_MINUTES;
    const windowMinutes = rule.windowMinutes;
    const needed = windowMinutes <= 0 ? 1 : Math.ceil(windowMinutes / bucketMinutes);
    const breach = [];
    const firing = [];
    let run = 0;
    for (let i = 0; i < buckets.length; i++) {
      const value = metricValue(buckets[i], rule.metric);
      const over = value != null && value > rule.threshold;
      breach.push(over);
      run = over ? run + 1 : 0;
      firing.push(run >= needed);
    }
    const episodes = [];
    let start = -1;
    for (let i = 0; i < firing.length; i++) {
      if (firing[i] && start < 0) start = i;
      if (!firing[i] && start >= 0) {
        episodes.push({ start: start, end: i - 1 });
        start = -1;
      }
    }
    if (start >= 0) episodes.push({ start: start, end: firing.length - 1 });
    return { needed: needed, breach: breach, firing: firing, episodes: episodes };
  }

  function formatMs(ms) {
    if (ms == null || Number.isNaN(ms)) return "—";
    const rounded = Math.round(ms);
    if (Math.abs(rounded) < 1000) return rounded + " ms";
    const seconds = rounded / 1000;
    const text = seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2);
    return text.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") + " s";
  }

  function formatPct(rate) {
    if (rate == null || Number.isNaN(rate)) return "—";
    return (rate * 100).toFixed(rate === 0 ? 0 : 1) + "%";
  }

  function formatUsd(cents) {
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(Math.round(cents));
    const dollars = Math.floor(abs / 100);
    const rest = abs % 100;
    const withCommas = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (rest === 0) return sign + "$" + withCommas;
    return sign + "$" + withCommas + "." + String(rest).padStart(2, "0");
  }

  function costSketch(options) {
    const hosts = Math.max(0, Math.round(options.hosts));
    const gb = Math.max(0, Math.round(options.gb));
    const saasMonthCents = hosts * RATES.perHostCents + gb * RATES.perGbCents;
    return {
      hosts: hosts,
      gb: gb,
      perHostCents: RATES.perHostCents,
      perGbCents: RATES.perGbCents,
      vpsCents: RATES.vpsCents,
      saasMonthCents: saasMonthCents,
      saasYearCents: saasMonthCents * 12,
      selfMonthCents: RATES.vpsCents,
      selfYearCents: RATES.vpsCents * 12,
      claimYearCents: POST.claimYearUsd * 100,
    };
  }

  function summarize(latencies, errors) {
    const count = latencies.length;
    return {
      count: count,
      errors: errors,
      errorRate: count ? errors / count : 0,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      avg: mean(latencies),
    };
  }

  function buildRequest(rng, index, n, options) {
    const rollRoute = rng();
    const rollSlow = rng();
    const rollTail = rng();
    const rollSms = rng();
    const rollDeploy = rng();
    const rollMember = rng();
    const rollDbFast = rng();
    const rollDbSlow = rng();
    const rollSmsFast = rng();
    const rollSecond = rng();
    const traceRollA = rng();
    const traceRollB = rng();

    const member = 1000 + Math.floor(rollMember * 420) + 1;
    const second = Math.min(299, Math.floor(rollSecond * 300));
    const isPost = rollRoute < 0.82;
    const route = isPost ? "POST /classes/dawn-iron/book" : "GET /classes/dawn-iron";
    const forceBlip = index === BLIP_BUCKET && n < BLIP_COUNT;

    let kind = "ok";
    let http = 200;
    let dbMs = 4 + Math.floor(rollDbFast * 12);
    let smsMs = 0;
    let includeDb = true;
    let includeSms = isPost;

    if (rollTail < 0.08 && !forceBlip) dbMs = 180 + Math.floor(rollDbSlow * 160);

    if (forceBlip) {
      kind = "blip";
      http = 500;
      includeDb = false;
      includeSms = false;
      dbMs = 0;
      smsMs = 0;
    } else if (options.badDeploy && index >= DEPLOY_BUCKET && isPost && rollDeploy < 0.6) {
      kind = "deploy";
      http = 500;
      includeDb = false;
      includeSms = false;
      dbMs = 0;
      smsMs = 0;
    } else if (options.slowDb && index >= SLOW_BUCKETS.start && index <= SLOW_BUCKETS.end && rollSlow < 0.28) {
      dbMs = 1200 + Math.floor(rollDbSlow * 1400);
    }

    if (includeSms && options.smsTimeouts && index >= 4 && index <= 10 && rollSms < 0.45) {
      kind = kind === "ok" ? "sms" : kind;
      http = 504;
      smsMs = 2500;
    } else if (includeSms) {
      smsMs = 16 + Math.floor(rollSmsFast * 40);
    }

    const overhead = forceBlip || kind === "deploy" ? 22 : 14;
    const durationMs = overhead + (includeDb ? dbMs : 0) + (includeSms ? smsMs : 0);
    const failed = http >= 500;
    const traceId = (Math.floor(traceRollA * 0xffffffff) >>> 0).toString(16).padStart(8, "0") +
      (Math.floor(traceRollB * 0xffffffff) >>> 0).toString(16).padStart(8, "0") +
      member.toString(16).padStart(8, "0") +
      (index * 100 + n).toString(16).padStart(8, "0");

    const spans = [];
    spans.push({
      service: "web",
      name: route,
      startMs: 0,
      durationMs: durationMs,
      status: failed ? "error" : "ok",
    });
    const apiDur = Math.max(4, durationMs - 4);
    spans.push({
      service: "booking-api",
      name: isPost ? "bookClass" : "getClass",
      startMs: 2,
      durationMs: apiDur,
      status: failed ? "error" : "ok",
    });
    if (includeDb) {
      spans.push({
        service: "postgres",
        name: isPost ? "INSERT bookings" : "SELECT class",
        startMs: 8,
        durationMs: dbMs,
        status: "ok",
      });
    }
    if (includeSms) {
      const smsStart = includeDb ? 8 + dbMs + 2 : 10;
      spans.push({
        service: "sms",
        name: "send confirmation",
        startMs: smsStart,
        durationMs: smsMs,
        status: kind === "sms" ? "error" : "ok",
      });
    }

    const stamp = clockStamp(index, second);
    const logs = [];
    logs.push({
      time: stamp,
      offsetMs: 2,
      level: "info",
      service: "booking-api",
      traceId: traceId,
      message: route + " member " + member,
    });
    if (kind === "blip") {
      logs.push({
        time: stamp,
        offsetMs: 12,
        level: "error",
        service: "booking-api",
        traceId: traceId,
        message: "front-desk retry returned 500; the next tap worked",
      });
    } else if (kind === "deploy") {
      logs.push({
        time: stamp,
        offsetMs: 12,
        level: "error",
        service: "booking-api",
        traceId: traceId,
        message: "book-api@1.8.4 TypeError reading the seat map",
      });
    } else if (includeDb) {
      const slow = dbMs >= 800;
      logs.push({
        time: stamp,
        offsetMs: 8,
        level: slow ? "warn" : "info",
        service: "postgres",
        traceId: traceId,
        message: slow
          ? "slow query bookings_class_start_idx lock wait " + dbMs + " ms"
          : (isPost ? "insert bookings " : "select class ") + dbMs + " ms",
      });
    }
    if (kind === "sms") {
      logs.push({
        time: stamp,
        offsetMs: durationMs - 1,
        level: "error",
        service: "sms",
        traceId: traceId,
        message: "sms provider timed out after 2500 ms; booking not confirmed",
      });
    } else if (includeSms) {
      logs.push({
        time: stamp,
        offsetMs: durationMs - 1,
        level: "info",
        service: "sms",
        traceId: traceId,
        message: "confirmation sent",
      });
    }

    return {
      id: "b" + index + "-" + n,
      traceId: traceId,
      bucket: index,
      time: stamp,
      route: route,
      member: member,
      status: http,
      kind: kind,
      durationMs: durationMs,
      failed: failed,
      spans: spans,
      logs: logs,
      keep: failed || dbMs >= 800 || smsMs >= 2000,
    };
  }

  function generateMorning(options) {
    const opts = {
      slowDb: DEFAULTS.slowDb,
      smsTimeouts: DEFAULTS.smsTimeouts,
      badDeploy: DEFAULTS.badDeploy,
    };
    if (options) {
      if (options.slowDb != null) opts.slowDb = !!options.slowDb;
      if (options.smsTimeouts != null) opts.smsTimeouts = !!options.smsTimeouts;
      if (options.badDeploy != null) opts.badDeploy = !!options.badDeploy;
    }
    const rng = mulberry32(SEED);
    const buckets = [];
    const traces = [];
    let healthyKept = false;

    for (let i = 0; i < BUCKET_COUNT; i++) {
      const count = COUNTS[i];
      const latencies = [];
      let errors = 0;
      let slowest = null;
      for (let n = 0; n < count; n++) {
        const request = buildRequest(rng, i, n, opts);
        latencies.push(request.durationMs);
        if (request.failed) errors += 1;
        if (!slowest || request.durationMs > slowest.durationMs) slowest = request;
        if (request.keep) traces.push(publicTrace(request));
        else if (!healthyKept && request.kind === "ok" && i === 0 && n === 0) {
          traces.push(publicTrace(request));
          healthyKept = true;
        }
      }
      const stats = summarize(latencies, errors);
      buckets.push({
        index: i,
        label: clockLabel(i),
        count: stats.count,
        errors: stats.errors,
        errorRate: stats.errorRate,
        p50: stats.p50,
        p95: stats.p95,
        avg: stats.avg,
      });
    }

    return {
      shop: SHOP,
      seed: SEED,
      day: "Thu 19 Nov 2026",
      bucketMinutes: BUCKET_MINUTES,
      bucketCount: BUCKET_COUNT,
      buckets: buckets,
      traces: traces,
      incidents: opts,
    };
  }

  function publicTrace(request) {
    return {
      id: request.id,
      traceId: request.traceId,
      bucket: request.bucket,
      time: request.time,
      route: request.route,
      member: request.member,
      status: request.status,
      kind: request.kind,
      durationMs: request.durationMs,
      failed: request.failed,
      spans: request.spans,
      logs: request.logs,
    };
  }

  function tracesInBucket(day, index) {
    return day.traces.filter(function (trace) { return trace.bucket === index; })
      .sort(function (a, b) { return b.durationMs - a.durationMs; });
  }

  function defaultTrace(day) {
    const rule = evaluateRule(day.buckets, {
      metric: "p95",
      threshold: DEFAULTS.threshold,
      windowMinutes: DEFAULTS.windowMinutes,
    });
    let best = null;
    for (let i = 0; i < day.traces.length; i++) {
      const trace = day.traces[i];
      const preferred = rule.firing[trace.bucket] || rule.breach[trace.bucket];
      if (!best) {
        best = trace;
        continue;
      }
      const bestPreferred = rule.firing[best.bucket] || rule.breach[best.bucket];
      if (preferred && !bestPreferred) best = trace;
      else if (preferred === bestPreferred && trace.durationMs > best.durationMs) best = trace;
    }
    return best;
  }

  function latencyGotchaLine(p95Fires, avgFires, thresholdMs) {
    const line = formatMs(thresholdMs);
    if (p95Fires && !avgFires) {
      return "Average hides the rush-hour tail: p95 crosses " + line + ", the average never does, and the average alert stays quiet while a few members wait.";
    }
    if (p95Fires && avgFires) {
      return "This line (" + line + ") is low enough that the average crosses it too. Raise it and the average alert goes quiet while p95 still fires.";
    }
    if (!p95Fires && avgFires) {
      return "The average is over " + line + " while p95 is not. That is the reverse of the usual tail.";
    }
    return "Neither the average nor p95 crosses " + line + " on this morning.";
  }

  function noiseGotchaLine(noisyFires, heldFires, windowMinutes, errorThreshold) {
    const pct = (Math.round(errorThreshold * 1000) / 10).toString().replace(/\.0$/, "") + "%";
    if (windowMinutes <= 0 && noisyFires) {
      return "No duration window: one noisy 5-minute bucket pages you, and the next bucket can be fine.";
    }
    if (noisyFires && !heldFires) {
      return "Without a duration window the error alert fires on a single 5-minute blip. For 10 minutes, that same blip stays quiet.";
    }
    if (noisyFires && heldFires) {
      return "The error rate stays high long enough that a 10-minute window still fires. The window does not hide a real outage.";
    }
    return "The error rate stays under " + pct + " all morning, so neither the noisy rule nor the 10-minute rule fires.";
  }

  function explain(day, rule) {
    const active = evaluateRule(day.buckets, rule);
    const latencyThreshold = rule.metric === "errorRate" ? 800 : rule.threshold;
    const p95 = evaluateRule(day.buckets, {
      metric: "p95",
      threshold: latencyThreshold,
      windowMinutes: rule.windowMinutes,
    });
    const avg = evaluateRule(day.buckets, {
      metric: "avg",
      threshold: latencyThreshold,
      windowMinutes: rule.windowMinutes,
    });
    const errorThreshold = rule.metric === "errorRate" ? rule.threshold : 0.1;
    const noisy = evaluateRule(day.buckets, {
      metric: "errorRate",
      threshold: errorThreshold,
      windowMinutes: 0,
    });
    const held = evaluateRule(day.buckets, {
      metric: "errorRate",
      threshold: errorThreshold,
      windowMinutes: 10,
    });
    return {
      active: active,
      p95: p95,
      avg: avg,
      noisy: noisy,
      held: held,
      latencyLine: latencyGotchaLine(p95.episodes.length > 0, avg.episodes.length > 0, latencyThreshold),
      noiseLine: noiseGotchaLine(noisy.episodes.length > 0, held.episodes.length > 0, rule.windowMinutes, errorThreshold),
    };
  }

  const api = {
    SHOP: SHOP,
    SEED: SEED,
    POST: POST,
    REPO: REPO,
    RATES: RATES,
    DEFAULTS: DEFAULTS,
    COUNTS: COUNTS,
    BUCKET_MINUTES: BUCKET_MINUTES,
    BLIP_BUCKET: BLIP_BUCKET,
    SLOW_BUCKETS: SLOW_BUCKETS,
    DEPLOY_BUCKET: DEPLOY_BUCKET,
    mulberry32: mulberry32,
    percentile: percentile,
    mean: mean,
    evaluateRule: evaluateRule,
    summarize: summarize,
    formatMs: formatMs,
    formatPct: formatPct,
    formatUsd: formatUsd,
    costSketch: costSketch,
    clockLabel: clockLabel,
    generateMorning: generateMorning,
    tracesInBucket: tracesInBucket,
    defaultTrace: defaultTrace,
    explain: explain,
    latencyGotchaLine: latencyGotchaLine,
    noiseGotchaLine: noiseGotchaLine,
  };

  if (typeof globalThis !== "undefined") globalThis.ObsLab = api;
})();
