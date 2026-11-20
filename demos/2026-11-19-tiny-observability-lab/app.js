(function () {
  const Lab = globalThis.ObsLab;
  const $ = (id) => document.getElementById(id);

  const state = {
    slowDb: true,
    smsTimeouts: false,
    badDeploy: false,
    metric: "p95",
    latencyThreshold: 800,
    errorPct: 10,
    windowMinutes: 10,
    hosts: 1,
    gb: 8,
    bucket: 6,
    traceId: null,
    jump: true,
    revealTrace: false,
  };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function ruleFromState() {
    if (state.metric === "errorRate") {
      return { metric: "errorRate", threshold: state.errorPct / 100, windowMinutes: state.windowMinutes };
    }
    return { metric: state.metric, threshold: state.latencyThreshold, windowMinutes: state.windowMinutes };
  }

  function episodeText(buckets, episodes) {
    if (!episodes.length) return "quiet";
    return episodes.map((episode) => {
      const start = buckets[episode.start].label;
      const end = buckets[episode.end].label;
      return start === end ? start : start + "–" + end;
    }).join(", ");
  }

  function interestingBucket(day, explained) {
    if (explained.active.episodes.length) return explained.active.episodes[0].start;
    if (day.incidents.badDeploy) return Lab.DEPLOY_BUCKET;
    const breach = explained.p95.breach.findIndex(Boolean);
    if (breach >= 0) return breach;
    if (explained.noisy.episodes.length) return explained.noisy.episodes[0].start;
    return 6;
  }

  function fill(index, explained) {
    if (explained.active.firing[index]) return "#9a3412";
    if (explained.active.breach[index]) return "#b8860b";
    return "#1d4a32";
  }

  function chartFrame(buckets, selected, bars, extra) {
    const w = 240;
    const h = 88;
    const n = buckets.length;
    const gap = 1.4;
    const bw = (w - gap * (n - 1)) / n;
    let body = "";
    buckets.forEach((bucket, index) => {
      const bh = Math.max(0, bars[index]);
      const x = index * (bw + gap);
      const y = h - 4 - bh;
      body += '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + bw.toFixed(2) + '" height="' + bh.toFixed(2) + '" rx="1" fill="' + fill(index, bars.explained) + '"/>';
      if (index === selected) {
        body += '<rect x="' + x.toFixed(2) + '" y="0" width="' + bw.toFixed(2) + '" height="' + h + '" fill="none" stroke="#1c1916" stroke-width="1.6"/>';
      }
    });
    return '<svg viewBox="0 0 ' + w + " " + h + '" role="presentation">' + body + (extra || "") + "</svg>";
  }

  function heights(buckets, valueFn, max) {
    const h = 88;
    return buckets.map((bucket) => (valueFn(bucket) / max) * (h - 8));
  }

  function polyline(buckets, valueFn, max, color, width) {
    const w = 240;
    const h = 88;
    const n = buckets.length;
    const gap = 1.4;
    const bw = (w - gap * (n - 1)) / n;
    const points = buckets.map((bucket, index) => {
      const x = index * (bw + gap) + bw / 2;
      const y = h - 4 - (valueFn(bucket) / max) * (h - 8);
      return x.toFixed(2) + "," + y.toFixed(2);
    }).join(" ");
    return '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linejoin="round"/>';
  }

  function thresholdLine(max, value) {
    const y = 88 - 4 - (Math.min(value, max) / max) * (88 - 8);
    return '<line x1="0" x2="240" y1="' + y.toFixed(2) + '" y2="' + y.toFixed(2) + '" stroke="#9a3412" stroke-width="1.3" stroke-dasharray="4 3"/>';
  }

  function renderCharts(day, explained, rule) {
    const counts = day.buckets.map((bucket) => bucket.count);
    const maxCount = Math.max.apply(null, counts);
    const rateHeights = heights(day.buckets, (bucket) => bucket.count, maxCount);
    rateHeights.explained = explained;
    $("chart-rate").innerHTML = chartFrame(day.buckets, state.bucket, rateHeights, "");

    const latencyMax = Math.max(
      rule.metric === "errorRate" ? 0 : rule.threshold,
      ...day.buckets.map((bucket) => bucket.p95),
    );
    const latencyHeights = heights(day.buckets, (bucket) => bucket.p95, latencyMax);
    latencyHeights.explained = explained;
    let latencyExtra = polyline(day.buckets, (bucket) => bucket.p50, latencyMax, "#8d93a0", 1.4);
    latencyExtra += polyline(day.buckets, (bucket) => bucket.avg, latencyMax, "#1c1916", 2);
    if (rule.metric !== "errorRate") latencyExtra += thresholdLine(latencyMax, rule.threshold);
    $("chart-latency").innerHTML = chartFrame(day.buckets, state.bucket, latencyHeights, latencyExtra);
    $("latency-note").textContent = rule.metric === "avg"
      ? "· alert watches the lower line"
      : rule.metric === "p95"
        ? "· alert watches the bars"
        : "";

    const errorMax = Math.max(rule.metric === "errorRate" ? rule.threshold : 0, ...day.buckets.map((bucket) => bucket.errorRate), 0.05);
    const errorHeights = heights(day.buckets, (bucket) => bucket.errorRate, errorMax);
    errorHeights.explained = explained;
    const errorExtra = rule.metric === "errorRate" ? thresholdLine(errorMax, rule.threshold) : "";
    $("chart-errors").innerHTML = chartFrame(day.buckets, state.bucket, errorHeights, errorExtra);
  }

  function renderReadings(day) {
    const body = $("readings").querySelector("tbody");
    body.innerHTML = day.buckets.map((bucket) => {
      return "<tr" + (bucket.index === state.bucket ? ' class="selected"' : "") + ">" +
        "<td>" + bucket.label + "</td>" +
        "<td>" + bucket.count + "</td>" +
        "<td>" + bucket.errors + "</td>" +
        "<td>" + esc(Lab.formatMs(bucket.p50)) + "</td>" +
        "<td>" + esc(Lab.formatMs(bucket.avg)) + "</td>" +
        "<td>" + esc(Lab.formatMs(bucket.p95)) + "</td></tr>";
    }).join("");
  }

  function renderBucket(day, explained) {
    const bucket = day.buckets[state.bucket];
    const firing = explained.active.firing[state.bucket];
    const over = explained.active.breach[state.bucket];
    let status = "Quiet.";
    if (firing) status = "Alert firing.";
    else if (over) status = "Over the line. The window is not met yet.";
    $("bucket-readout").textContent = bucket.label;
    $("scrub").value = String(state.bucket);
    $("bucket-detail").textContent = bucket.label + " · " + bucket.count + " bookings · p50 " + Lab.formatMs(bucket.p50) +
      " · average " + Lab.formatMs(bucket.avg) + " · p95 " + Lab.formatMs(bucket.p95) +
      " · " + bucket.errors + " errors (" + Lab.formatPct(bucket.errorRate) + "). " + status;
  }

  function traceLabel(trace) {
    if (trace.kind === "blip") return "500 blip";
    if (trace.kind === "deploy") return "500";
    if (trace.kind === "sms") return "SMS timeout";
    if (trace.durationMs >= 800) return "Slow";
    return "OK";
  }

  function dominantSentence(trace) {
    if (trace.kind === "deploy") {
      return "The API threw before Postgres or the text provider. The failure is fast, which is why a latency alert can stay quiet.";
    }
    if (trace.kind === "blip") {
      return "A front-desk retry returned 500. It is one booking inside a single 5-minute bucket.";
    }
    if (trace.kind === "sms") {
      return "The text provider held this booking for 2.5s and then timed out. That wait is on the trace, next to the database span.";
    }
    const db = trace.spans.find((span) => span.service === "postgres");
    if (db && db.durationMs >= 800) {
      return "Postgres held the seat lock for " + Lab.formatMs(db.durationMs) + " of this " + Lab.formatMs(trace.durationMs) + " booking.";
    }
    return "A normal booking. The page, the API, Postgres, and the text each take a few dozen milliseconds.";
  }

  function renderTraces(day) {
    const rows = Lab.tracesInBucket(day, state.bucket).slice().sort((a, b) => {
      const rank = (trace) => (trace.failed ? 2 : trace.durationMs >= 800 ? 1 : 0);
      return rank(b) - rank(a) || b.durationMs - a.durationMs;
    }).slice(0, 4);
    const total = Lab.tracesInBucket(day, state.bucket).length;
    $("trace-hint").textContent = total
      ? "This 5 minutes kept " + total + " slow or failed booking" + (total === 1 ? "" : "s") + ". Showing " + rows.length + ". The waterfall and the log lines share a trace_id."
      : "No slow or failed booking was saved in this 5 minutes. Step back to 05:45 or to the 6:00 rush.";
    if (!rows.length) {
      $("trace-list").innerHTML = "";
      $("trace-detail").innerHTML = "";
      return;
    }
    const selected = rows.some((trace) => trace.traceId === state.traceId)
      ? state.traceId
      : rows[0].traceId;
    state.traceId = selected;
    $("trace-list").innerHTML = rows.map((trace) => {
      const on = trace.traceId === selected;
      return '<button type="button" class="trace' + (trace.failed ? " error" : "") + (on ? " selected" : "") + '" data-trace="' + esc(trace.traceId) + '" id="pick-' + esc(trace.id) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
        '<span class="trace-main"><span class="trace-time">' + esc(trace.time) + " · " + esc(Lab.formatMs(trace.durationMs)) + "</span>" +
        '<span class="trace-route">' + esc(trace.route) + " · member " + esc(trace.member) + "</span></span>" +
        '<span class="pill' + (trace.failed || trace.durationMs >= 800 ? " bad" : "") + '">' + esc(traceLabel(trace)) + "</span></button>";
    }).join("");
    renderDetail(day, rows.find((trace) => trace.traceId === selected));
  }

  function renderDetail(day, trace) {
    if (!trace) {
      $("trace-detail").innerHTML = "";
      return;
    }
    const total = Math.max(trace.durationMs, 1);
    const bars = trace.spans.map((span) => {
      const depth = span.service === "web" ? "" : span.service === "booking-api" ? " d1" : " d2";
      const left = (span.startMs / total) * 100;
      const width = Math.max(1.2, (span.durationMs / total) * 100);
      const tone = span.status === "error" ? "bad" : span.service === "web" ? "web" : span.service === "booking-api" ? "api" : span.service === "postgres" ? "db" : "sms";
      return '<div class="wf-row"><span class="wf-name' + depth + '">' + esc(span.service) + '</span>' +
        '<span class="wf-track"><span class="wf-bar ' + tone + '" style="left:' + left.toFixed(2) + "%;width:" + width.toFixed(2) + '%"></span></span>' +
        '<span class="wf-dur">' + esc(Lab.formatMs(span.durationMs)) + "</span></div>";
    }).join("");
    const logs = trace.logs.map((log) => {
      return '<li><span class="log-meta">' + esc(log.level) + " · " + esc(log.service) + " · " + esc(log.time) + '</span>' +
        '<span class="log-msg">' + esc(log.message) + "</span>" +
        '<span class="log-meta">trace_id ' + esc(log.traceId) + "</span></li>";
    }).join("");
    const other = day.traces.find((row) => row.traceId !== trace.traceId);
    const otherLog = other ? '<li class="other"><span class="log-meta">different booking</span><span class="log-msg">' + esc(other.logs[0].message) + '</span><span class="log-meta">trace_id ' + esc(other.traceId) + "</span></li>" : "";
    $("trace-detail").innerHTML = '<article class="detail">' +
      "<h3>" + esc(trace.time) + " · " + esc(Lab.formatMs(trace.durationMs)) + " · HTTP " + esc(trace.status) + "</h3>" +
      "<p>" + esc(dominantSentence(trace)) + "</p>" +
      '<p class="tid">trace_id ' + esc(trace.traceId) + "</p>" +
      '<div class="wf" aria-label="Trace waterfall">' + bars + "</div>" +
      '<ul class="logs">' + logs + otherLog + "</ul></article>";
  }

  function renderRule(day, explained, rule) {
    ["p95", "avg", "error"].forEach((name) => {
      const metric = name === "error" ? "errorRate" : name;
      $("metric-" + name).setAttribute("aria-pressed", state.metric === metric ? "true" : "false");
    });
    [0, 10, 15].forEach((minutes) => {
      $("window-" + minutes).setAttribute("aria-pressed", state.windowMinutes === minutes ? "true" : "false");
    });
    const slider = $("threshold");
    if (state.metric === "errorRate") {
      slider.min = "1";
      slider.max = "50";
      slider.step = "1";
      slider.value = String(state.errorPct);
      $("threshold-readout").textContent = state.errorPct + "%";
      slider.setAttribute("aria-valuetext", state.errorPct + " percent");
    } else {
      slider.min = "200";
      slider.max = "2000";
      slider.step = "50";
      slider.value = String(state.latencyThreshold);
      $("threshold-readout").textContent = Lab.formatMs(state.latencyThreshold);
      slider.setAttribute("aria-valuetext", state.latencyThreshold + " milliseconds");
    }
    $("latency-line").textContent = explained.latencyLine;
    $("noise-line").textContent = explained.noiseLine;

    const when = episodeText(day.buckets, explained.active.episodes);
    const banner = $("alert-banner");
    if (explained.active.episodes.length) {
      banner.className = "banner";
      banner.textContent = "Firing " + when + ".";
    } else {
      banner.className = "banner ok";
      banner.textContent = "Quiet. This rule never holds for the window.";
    }
    const pending = [];
    explained.active.breach.forEach((over, index) => {
      if (over && !explained.active.firing[index]) pending.push(day.buckets[index].label);
    });
    $("pending-line").textContent = pending.length
      ? pending.join(", ") + (pending.length === 1 ? " is" : " are") + " already over the line. Paging waits until the duration is met."
      : "";

    const rows = [
      ["p95, this window", explained.p95],
      ["average, this window", explained.avg],
      ["error rate, any bucket", explained.noisy],
      ["error rate, for 10 minutes", explained.held],
    ];
    $("compare").innerHTML = rows.map((row) => {
      const hot = row[1].episodes.length > 0;
      return "<li><span>" + esc(row[0]) + '</span><span class="' + (hot ? "hot" : "quiet") + '">' +
        esc(episodeText(day.buckets, row[1].episodes)) + "</span></li>";
    }).join("");
    $("live").textContent = banner.textContent + " " + explained.latencyLine;
  }

  function renderCost() {
    const cost = Lab.costSketch({ hosts: state.hosts, gb: state.gb });
    $("hosts").value = String(state.hosts);
    $("gb").value = String(state.gb);
    $("hosts-readout").textContent = String(state.hosts);
    $("gb-readout").textContent = String(state.gb);
    $("cost-out").innerHTML = '<div class="cost-grid">' +
      '<article class="cost-card"><h3>Hosted sketch</h3><p class="figure">' + esc(Lab.formatUsd(cost.saasMonthCents)) + '/mo</p>' +
      "<p>" + state.hosts + " × " + esc(Lab.formatUsd(cost.perHostCents)) + " per host + " + state.gb + " × " + esc(Lab.formatUsd(cost.perGbCents)) + " per GB = " + esc(Lab.formatUsd(cost.saasYearCents)) + "/yr.</p></article>" +
      '<article class="cost-card"><h3>Self-hosted sketch</h3><p class="figure">' + esc(Lab.formatUsd(cost.selfMonthCents)) + '/mo</p>' +
      "<p>" + esc(Lab.formatUsd(cost.selfYearCents)) + "/yr for one VPS. Postgres runs on that same machine. DataCat’s license is $0.</p></article>" +
      '<article class="cost-card claim"><h3>Replit’s claim</h3><p class="figure">' + esc(Lab.formatUsd(cost.claimYearCents)) + "/yr</p>" +
      "<p>The post says the leading observability platform wants this just to monitor an app and catch issues. It is their claim. It is not Ironside’s bill, and it is not a quote from a named vendor.</p></article></div>";
  }

  function renderIncidents() {
    $("inc-db").setAttribute("aria-pressed", state.slowDb ? "true" : "false");
    $("inc-sms").setAttribute("aria-pressed", state.smsTimeouts ? "true" : "false");
    $("inc-deploy").setAttribute("aria-pressed", state.badDeploy ? "true" : "false");
    const quiet = !state.slowDb && !state.smsTimeouts && !state.badDeploy;
    $("inc-quiet").setAttribute("aria-pressed", quiet ? "true" : "false");
  }

  function render() {
    const day = Lab.generateMorning({
      slowDb: state.slowDb,
      smsTimeouts: state.smsTimeouts,
      badDeploy: state.badDeploy,
    });
    const rule = ruleFromState();
    const explained = Lab.explain(day, rule);
    if (state.jump) {
      state.bucket = interestingBucket(day, explained);
      state.traceId = null;
      state.jump = false;
    }
    state.bucket = Math.max(0, Math.min(day.buckets.length - 1, state.bucket));
    const focusId = document.activeElement && document.activeElement.id;
    renderIncidents();
    renderCharts(day, explained, rule);
    renderReadings(day);
    renderBucket(day, explained);
    renderTraces(day);
    renderRule(day, explained, rule);
    renderCost();
    if (focusId && focusId !== "scrub" && focusId !== "threshold" && focusId !== "hosts" && focusId !== "gb") {
      const again = document.getElementById(focusId);
      if (again) again.focus({ preventScroll: true });
    }
    if (state.revealTrace) {
      const card = $("trace-detail").querySelector(".detail");
      if (card) card.scrollIntoView({ block: "nearest" });
      state.revealTrace = false;
    }
  }

  function setBucket(index) {
    state.bucket = index;
    state.traceId = null;
    render();
  }

  function bindChart(id) {
    $(id).addEventListener("pointerdown", (event) => {
      const rect = (event.currentTarget.querySelector("svg") || event.currentTarget).getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      setBucket(Math.max(0, Math.min(23, Math.floor(ratio * 24))));
    });
  }

  $("inc-db").addEventListener("click", () => {
    state.slowDb = !state.slowDb;
    state.jump = true;
    render();
  });
  $("inc-sms").addEventListener("click", () => {
    state.smsTimeouts = !state.smsTimeouts;
    state.jump = true;
    render();
  });
  $("inc-deploy").addEventListener("click", () => {
    state.badDeploy = !state.badDeploy;
    state.jump = true;
    render();
  });
  $("inc-quiet").addEventListener("click", () => {
    state.slowDb = false;
    state.smsTimeouts = false;
    state.badDeploy = false;
    state.jump = true;
    render();
  });

  $("metric-p95").addEventListener("click", () => { state.metric = "p95"; render(); });
  $("metric-avg").addEventListener("click", () => { state.metric = "avg"; render(); });
  $("metric-error").addEventListener("click", () => { state.metric = "errorRate"; render(); });
  $("window-0").addEventListener("click", () => { state.windowMinutes = 0; render(); });
  $("window-10").addEventListener("click", () => { state.windowMinutes = 10; render(); });
  $("window-15").addEventListener("click", () => { state.windowMinutes = 15; render(); });

  $("threshold").addEventListener("input", () => {
    const value = Number($("threshold").value);
    if (state.metric === "errorRate") state.errorPct = value;
    else state.latencyThreshold = value;
    render();
  });
  $("hosts").addEventListener("input", () => {
    state.hosts = Number($("hosts").value);
    render();
  });
  $("gb").addEventListener("input", () => {
    state.gb = Number($("gb").value);
    render();
  });
  $("scrub").addEventListener("input", () => setBucket(Number($("scrub").value)));
  $("scrub-prev").addEventListener("click", () => setBucket(state.bucket - 1));
  $("scrub-next").addEventListener("click", () => setBucket(state.bucket + 1));

  $("trace-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-trace]");
    if (!button) return;
    state.traceId = button.getAttribute("data-trace");
    state.revealTrace = true;
    render();
  });

  bindChart("chart-rate");
  bindChart("chart-latency");
  bindChart("chart-errors");
  render();
})();
