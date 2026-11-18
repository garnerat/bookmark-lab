// Fictional growth series and the step / window math for the demo.
// Organic visits are a repeating camping season times a planted base.
// Two base shifts are real (guides in Sep 2025, kettle push in Aug 2026).
// April repeats because the season repeats. The job post does not move the base.
(function () {
  const SHOP = "Riverbend Supply Co.";
  const DOMAIN = "riverbend.example";
  const POST = {
    handle: "coreyhainesco",
    name: "Corey Haines",
    id: "2120509394224095603",
    url: "https://x.com/coreyhainesco/status/2120509394224095603",
    date: "11 Nov 2026",
  };

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Calendar month → multiplier. April is the camping peak. December is a gift spike.
  const SEASON = {
    1: 0.62,
    2: 0.70,
    3: 1.02,
    4: 1.48,
    5: 1.30,
    6: 1.16,
    7: 1.08,
    8: 0.94,
    9: 0.86,
    10: 0.80,
    11: 0.88,
    12: 1.42,
  };

  // Brand searches are hand-set. Ads and AI citations move them; the camping season barely does.
  const BRAND = [
    420, 610, 380, 360, 440, 520, 490, 450,
    430, 410, 540, 560, 980, 1640, 720, 640,
    700, 860, 820, 760, 740, 2100, 1980, 1860,
  ];

  const TYPES = [
    { id: "headline", label: "Headlines", source: "Wayback-style homepage snapshots" },
    { id: "sitemap", label: "Sitemap", source: "Sitemap page counts" },
    { id: "ads", label: "Ads", source: "Ad library, started and stopped" },
    { id: "price", label: "Price", source: "Shelf price changes" },
    { id: "tool", label: "Tools", source: "New tool installs" },
    { id: "jobs", label: "Jobs", source: "Job posts" },
    { id: "ai", label: "AI answers", source: "AI-answer citations" },
  ];

  const DEFAULTS = {
    thresholdPct: 30,
    windowMonths: 1,
    trailing: 3,
    holdFraction: 0.35,
    seasonal: false,
  };

  const COINCIDENCE_MONTH = "2026-04";
  const COINCIDENCE_EVENT = "job-warehouse";

  function baseLevel(index) {
    if (index < 10) return 5000;
    if (index < 21) return 8600;
    return 15200;
  }

  function roundTo(n, step) {
    return Math.round(n / step) * step;
  }

  function buildMonths() {
    const months = [];
    let year = 2024;
    let calendarMonth = 11;
    for (let index = 0; index < 24; index++) {
      const id = year + "-" + String(calendarMonth).padStart(2, "0");
      months.push({
        index: index,
        id: id,
        label: MONTH_NAMES[calendarMonth - 1] + " " + year,
        short: MONTH_NAMES[calendarMonth - 1],
        year: year,
        calendarMonth: calendarMonth,
        visits: roundTo(baseLevel(index) * SEASON[calendarMonth], 50),
        brand: BRAND[index],
        base: baseLevel(index),
      });
      calendarMonth += 1;
      if (calendarMonth > 12) {
        calendarMonth = 1;
        year += 1;
      }
    }
    return months;
  }

  const MONTHS = buildMonths();
  const VISITS = MONTHS.map((month) => month.visits);

  const EVENT_SEED = [
    {
      id: "headline-pack",
      date: "2025-02-20",
      type: "headline",
      title: "Homepage headline changed",
      detail: "Wayback-style snapshot. The made-up headline went from “Camp kitchen gear for the weekend.” to “Cook outside. The kit that packs.”",
    },
    {
      id: "headline-notes",
      date: "2025-09-04",
      type: "headline",
      title: "Homepage headline changed",
      detail: "Wayback-style snapshot. The headline became “Field notes for cooking outside.”",
    },
    {
      id: "sitemap-guides",
      date: "2025-09-11",
      type: "sitemap",
      title: "Sitemap grew from 28 to 67 pages",
      detail: "Fictional /sitemap.xml. New URLs are camp recipes, fire-starting, and kettle care under /guides/.",
    },
    {
      id: "ads-gifts-on",
      date: "2025-11-18",
      type: "ads",
      title: "Ad started",
      detail: "Fictional ad-library entry: “Gifts that cook outside.”",
    },
    {
      id: "ads-gifts-off",
      date: "2026-01-06",
      type: "ads",
      title: "Ad stopped",
      detail: "The gift ad is marked stopped. In this log it ran about seven weeks.",
    },
    {
      id: "tool-reviews",
      date: "2026-01-20",
      type: "tool",
      title: "Reviews widget installed",
      detail: "A fictional Trailmark reviews widget appears on product pages. No traffic step sits on this date.",
    },
    {
      id: "job-warehouse",
      date: "2026-03-16",
      type: "jobs",
      title: "Job post: seasonal warehouse associate",
      detail: "Fictional posting for March through June. It sits next to the spring jump and does not change the planted base.",
    },
    {
      id: "price-kettle",
      date: "2026-08-03",
      type: "price",
      title: "Ridge Kettle price cut, $89 to $64",
      detail: "Fictional shelf price on the camp kettle.",
    },
    {
      id: "ads-kettle-on",
      date: "2026-08-05",
      type: "ads",
      title: "Ad started",
      detail: "Fictional ad-library entry: “Ridge Kettle, $64. Free shipping over $50.” Still running at the end of the series.",
    },
    {
      id: "headline-price",
      date: "2026-08-08",
      type: "headline",
      title: "Homepage headline changed",
      detail: "Wayback-style snapshot. The headline became “The $64 camp kettle.”",
    },
    {
      id: "ai-kettle",
      date: "2026-08-12",
      type: "ai",
      title: "AI answers start citing the shop",
      detail: "Fictional “best camp kettle” prompts. ChatGPT and Perplexity name Riverbend Supply and cite riverbend.example/guides/ridge-kettle. A made-up AI Overview does not.",
    },
    {
      id: "sitemap-compare",
      date: "2026-08-18",
      type: "sitemap",
      title: "Sitemap grew from 67 to 94 pages",
      detail: "Fictional /sitemap.xml. New comparison pages put the kettle against an open-fire pot and a two-burner stove.",
    },
  ];

  function monthIndex(id) {
    return MONTHS.findIndex((month) => month.id === id);
  }

  const EVENTS = EVENT_SEED.map((event) => {
    const id = event.date.slice(0, 7);
    return Object.assign({}, event, { monthId: id, monthIndex: monthIndex(id) });
  });

  function mean(values, start, end) {
    let sum = 0;
    for (let i = start; i < end; i++) sum += values[i];
    return sum / (end - start);
  }

  function assess(values, index, options) {
    const opts = options || {};
    const trailing = opts.trailing == null ? DEFAULTS.trailing : opts.trailing;
    const threshold = (opts.thresholdPct == null ? DEFAULTS.thresholdPct : opts.thresholdPct) / 100;
    const holdFraction = opts.holdFraction == null ? DEFAULTS.holdFraction : opts.holdFraction;
    const seasonal = !!opts.seasonal;
    if (index < trailing || index >= values.length) return null;
    const base = mean(values, index - trailing, index);
    if (!(base > 0)) return null;
    const rawChange = values[index] / base - 1;
    let change = rawChange;
    let seasonalApplied = false;
    if (seasonal && index - 12 >= trailing) {
      const baseLY = mean(values, index - 12 - trailing, index - 12);
      const lastYear = values[index - 12];
      if (baseLY > 0 && lastYear > 0) {
        change = (values[index] / base) / (lastYear / baseLY) - 1;
        seasonalApplied = true;
      }
    }
    let kept = null;
    let holds = true;
    if (index + 1 < values.length) {
      const gain = values[index] - base;
      kept = gain === 0 ? 1 : (values[index + 1] - base) / gain;
      holds = kept >= holdFraction;
    }
    return {
      index: index,
      base: base,
      visits: values[index],
      rawChange: rawChange,
      change: change,
      seasonalApplied: seasonalApplied,
      holds: holds,
      kept: kept,
      qualifies: change >= threshold && holds,
    };
  }

  // Keep the largest jump when several qualifying months sit inside one trailing window.
  function detectSteps(values, options) {
    const opts = options || {};
    const trailing = opts.trailing == null ? DEFAULTS.trailing : opts.trailing;
    const hits = [];
    for (let i = 0; i < values.length; i++) {
      const row = assess(values, i, opts);
      if (row && row.qualifies) hits.push(row);
    }
    const steps = [];
    hits.forEach((hit) => {
      const prev = steps[steps.length - 1];
      if (prev && hit.index - prev.index < trailing) {
        if (hit.change > prev.change) steps[steps.length - 1] = hit;
        return;
      }
      steps.push(hit);
    });
    return steps;
  }

  function parseUTC(iso) {
    const parts = iso.split("-").map(Number);
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  }

  function dayDistance(eventDate, stepMonthId) {
    const step = parseUTC(stepMonthId + "-01");
    const event = parseUTC(eventDate);
    return Math.round(Math.abs(event - step) / 86400000);
  }

  function typeEnabled(type, enabled) {
    if (!enabled) return true;
    return enabled[type] !== false;
  }

  function matchCandidates(stepIndex, events, options) {
    const opts = options || {};
    const windowMonths = opts.windowMonths == null ? DEFAULTS.windowMonths : opts.windowMonths;
    const stepMonth = MONTHS[stepIndex];
    if (!stepMonth) return [];
    const chosen = (events || EVENTS).filter((event) => {
      if (!typeEnabled(event.type, opts.enabled)) return false;
      return Math.abs(event.monthIndex - stepIndex) <= windowMonths;
    }).map((event) => {
      const distance = Math.abs(event.monthIndex - stepIndex);
      return Object.assign({}, event, {
        monthDistance: distance,
        dayDistance: dayDistance(event.date, stepMonth.id),
      });
    });
    chosen.sort((a, b) => a.dayDistance - b.dayDistance || (a.date < b.date ? -1 : 1));
    return chosen;
  }

  function analyze(options) {
    const opts = options || {};
    const steps = detectSteps(VISITS, opts).map((step) => {
      const month = MONTHS[step.index];
      return Object.assign({}, step, {
        monthId: month.id,
        label: month.label,
        brand: month.brand,
        priorBrand: step.index > 0 ? MONTHS[step.index - 1].brand : null,
        candidates: matchCandidates(step.index, EVENTS, opts),
      });
    });
    const marked = {};
    steps.forEach((step) => {
      marked[step.index] = true;
    });
    const coincidenceIndex = monthIndex(COINCIDENCE_MONTH);
    const coincidenceRow = assess(VISITS, coincidenceIndex, opts);
    const coincidence = Object.assign({}, coincidenceRow, {
      monthId: COINCIDENCE_MONTH,
      label: MONTHS[coincidenceIndex].label,
      inSteps: !!marked[coincidenceIndex],
      candidates: matchCandidates(coincidenceIndex, EVENTS, opts),
      brand: MONTHS[coincidenceIndex].brand,
      priorBrand: MONTHS[coincidenceIndex - 1].brand,
      eventId: COINCIDENCE_EVENT,
    });
    return {
      steps: steps,
      coincidence: coincidence,
      months: MONTHS.map((month) => Object.assign({}, month, { inSteps: !!marked[month.index] })),
    };
  }

  function formatPct(change) {
    if (!Number.isFinite(change)) return "—";
    const pct = change * 100;
    if (Math.abs(pct) < 0.05) return "0%";
    const body = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
    return (pct > 0 ? "+" : "") + body + "%";
  }

  function formatVisits(n) {
    const rounded = Math.round(n);
    const sign = rounded < 0 ? "-" : "";
    return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatDate(iso) {
    const parts = iso.split("-");
    return Number(parts[2]) + " " + MONTH_NAMES[Number(parts[1]) - 1] + " " + parts[0];
  }

  function timingPhrase(event, stepMonthId) {
    if (event.monthDistance === 0) return "same month";
    const dir = event.monthId < stepMonthId ? "before" : "after";
    const unit = event.monthDistance === 1 ? "month" : "months";
    return event.monthDistance + " " + unit + " " + dir;
  }

  function typeById(id) {
    for (let i = 0; i < TYPES.length; i++) {
      if (TYPES[i].id === id) return TYPES[i];
    }
    return null;
  }

  globalThis.GrowthTimeline = {
    SHOP: SHOP,
    DOMAIN: DOMAIN,
    POST: POST,
    SEASON: SEASON,
    TYPES: TYPES,
    DEFAULTS: DEFAULTS,
    COINCIDENCE_MONTH: COINCIDENCE_MONTH,
    COINCIDENCE_EVENT: COINCIDENCE_EVENT,
    MONTHS: MONTHS,
    VISITS: VISITS,
    EVENTS: EVENTS,
    baseLevel: baseLevel,
    roundTo: roundTo,
    monthIndex: monthIndex,
    mean: mean,
    assess: assess,
    detectSteps: detectSteps,
    matchCandidates: matchCandidates,
    dayDistance: dayDistance,
    analyze: analyze,
    formatPct: formatPct,
    formatVisits: formatVisits,
    formatDate: formatDate,
    timingPhrase: timingPhrase,
    typeById: typeById,
  };
})();
