/* Page controller. Analysis lives in engine.js. Runs stay in a worker. */
(function () {
  var examples = window.AgentExamples;
  var checks = window.AgentChecks;
  var sourceBox = document.getElementById("source");
  var note = document.getElementById("example-note");
  var runButton = document.getElementById("run");
  var status = document.getElementById("status");
  var exampleButtons = document.querySelectorAll("[data-example]");
  var runToken = 0;
  var selectedId = examples[0].id;

  var workerSource = [
    "self.onmessage = function (event) {",
    "  var source = event.data && event.data.source;",
    "  var hits = [];",
    "  var seen = Object.create(null);",
    "  var steps = 0;",
    "  function __agentCheckHit(id) {",
    "    steps += 1;",
    "    if (steps > 200000) throw new Error('Stopped after too many steps');",
    "    if (!seen[id]) { seen[id] = 1; hits.push(id); }",
    "  }",
    "  function assert(cond, message) {",
    "    if (!cond) throw new Error(message || 'assertion failed');",
    "  }",
    "  function repr(value) {",
    "    try { return JSON.stringify(value); } catch (err) { return String(value); }",
    "  }",
    "  function assertEqual(actual, expected, message) {",
    "    if (!Object.is(actual, expected)) {",
    "      throw new Error(message || ('expected ' + repr(expected) + ' but got ' + repr(actual)));",
    "    }",
    "  }",
    "  function assertClose(actual, expected, message) {",
    "    var delta = typeof actual === 'number' && typeof expected === 'number' ? Math.abs(actual - expected) : Infinity;",
    "    if (!(delta <= 0.001)) {",
    "      throw new Error(message || ('expected about ' + repr(expected) + ' but got ' + repr(actual)));",
    "    }",
    "  }",
    "  try {",
    "    var run = new Function('__agentCheckHit', 'assert', 'assertEqual', 'assertClose', source);",
    "    var tests = run(__agentCheckHit, assert, assertEqual, assertClose) || [];",
    "    if (!Array.isArray(tests)) tests = [];",
    "    var results = [];",
    "    for (var i = 0; i < tests.length; i++) {",
    "      var test = tests[i];",
    "      var name = test && test.name ? String(test.name) : ('test ' + (i + 1));",
    "      try {",
    "        var value = test.fn();",
    "        if (value && typeof value.then === 'function') {",
    "          results.push({ name: name, passed: false, error: 'Async tests are not run here.' });",
    "        } else {",
    "          results.push({ name: name, passed: true });",
    "        }",
    "      } catch (err) {",
    "        results.push({ name: name, passed: false, error: err && err.message ? String(err.message) : String(err) });",
    "      }",
    "    }",
    "    self.postMessage({ ok: true, hits: hits, results: results });",
    "  } catch (err) {",
    "    self.postMessage({ ok: false, hits: hits, results: [], error: err && err.message ? String(err.message) : String(err) });",
    "  }",
    "};"
  ].join("\n");
  var workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatCrap(score) {
    var rounded = Math.round(score * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function formatPct(coverage) {
    return Math.round(coverage * 100) + "%";
  }

  function bandLabel(band) {
    if (band === "high") return "30 or more";
    if (band === "mid") return "Worth a look";
    return "Low risk";
  }

  function setBusy(busy) {
    runButton.disabled = busy;
    exampleButtons.forEach(function (button) { button.disabled = busy; });
  }

  function show(id, on) {
    document.getElementById(id).hidden = !on;
  }

  function selectExample(id, shouldRun) {
    var example = examples.filter(function (item) { return item.id === id; })[0] || examples[0];
    selectedId = example.id;
    sourceBox.value = example.code;
    note.textContent = example.note;
    exampleButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-example") === example.id ? "true" : "false");
    });
    if (shouldRun) runChecks();
  }

  function runInWorker(source, timeoutMs) {
    return new Promise(function (resolve) {
      var worker;
      try {
        worker = new Worker(workerUrl);
      } catch (err) {
        resolve({ ok: false, error: "This browser blocked the worker. " + (err.message || "") });
        return;
      }
      var timer = setTimeout(function () {
        worker.terminate();
        resolve({ ok: false, timeout: true, hits: [], results: [], error: "Timed out" });
      }, timeoutMs);
      worker.onmessage = function (event) {
        clearTimeout(timer);
        worker.terminate();
        resolve(event.data || { ok: false, error: "Empty worker response" });
      };
      worker.onerror = function (event) {
        clearTimeout(timer);
        worker.terminate();
        resolve({ ok: false, hits: [], results: [], error: event.message || "Worker error" });
      };
      worker.postMessage({ source: source });
    });
  }

  function renderSummary(scored, duplicates, tests, mutation) {
    var worst = scored[0];
    var high = scored.filter(function (fn) { return fn.band === "high"; }).length;
    var passed = tests.filter(function (test) { return test.passed; }).length;
    var cards = [
      { k: "Worst CRAP", v: worst ? formatCrap(worst.crap) : "—", sub: worst ? worst.name : "", bad: worst && worst.band === "high" },
      { k: "At 30 or more", v: String(high), sub: high ? "complex and under-tested" : "none on this snippet", bad: high > 0 },
      { k: "Duplicate blocks", v: String(duplicates.length), sub: duplicates.length ? "same shape" : "none reported" },
      { k: "Mutation score", v: mutation.label, sub: mutation.sub, good: mutation.perfect },
      { k: "Tests", v: passed + "/" + tests.length, sub: passed === tests.length && tests.length ? "original suite passed" : "original suite", bad: tests.length > 0 && passed !== tests.length }
    ];
    document.getElementById("summary").innerHTML = cards.map(function (card) {
      var cls = "metric" + (card.bad ? " bad" : "") + (card.good ? " good" : "");
      return "<article class=\"" + cls + "\"><span class=\"metric-k\">" + escapeHtml(card.k) +
        "</span><strong>" + escapeHtml(card.v) + "</strong><span class=\"hint\">" + escapeHtml(card.sub) + "</span></article>";
    }).join("");
    show("summary", true);
  }

  function renderTests(results, loadError) {
    var list = document.getElementById("test-list");
    if (loadError) {
      list.innerHTML = "<li><span class=\"badge bad\">Failed to load</span> " + escapeHtml(loadError) + "</li>";
    } else if (!results.length) {
      list.innerHTML = "<li>No tests found. Add a <code>tests</code> array or functions named <code>test…</code>.</li>";
    } else {
      list.innerHTML = results.map(function (test) {
        var badge = test.passed ? "<span class=\"badge good\">Pass</span>" : "<span class=\"badge bad\">Fail</span>";
        var detail = test.passed ? "" : " <span class=\"hint\">" + escapeHtml(test.error || "failed") + "</span>";
        return "<li>" + badge + " " + escapeHtml(test.name) + detail + "</li>";
      }).join("");
    }
    show("tests-panel", true);
  }

  function explainScore(fn) {
    var score = formatCrap(fn.crap);
    if (fn.coverage === 0) {
      return fn.name + " scores " + score + ". The tests never enter it. With no coverage the formula is complexity² + complexity, so " +
        fn.complexity + " decision points become " + score + ".";
    }
    if (fn.coverage === 1) {
      return fn.name + " is fully covered, so the score equals its complexity, " + fn.complexity + ".";
    }
    return fn.name + " has complexity " + fn.complexity + " and the tests run " + formatPct(fn.coverage) +
      " of its statements, which lands at " + score + ".";
  }

  function renderCrapper(code, scored, duplicates) {
    var body = scored.map(function (fn) {
      return "<tr class=\"" + fn.band + "\"><th scope=\"row\" class=\"fn\">" + escapeHtml(fn.name) +
        "</th><td>" + fn.line + "</td><td>" + fn.complexity + "</td><td>" + formatPct(fn.coverage) +
        " · " + fn.statementsHit + "/" + fn.statements + "</td><td><strong>" + formatCrap(fn.crap) +
        "</strong> <span class=\"badge " + fn.band + "\">" + bandLabel(fn.band) + "</span></td></tr>";
    }).join("");
    document.getElementById("crap-body").innerHTML = body;
    var high = scored.filter(function (fn) { return fn.band === "high"; }).length;
    var lead = scored.length ? explainScore(scored[0]) : "No functions to score.";
    if (high) lead += " " + high + (high === 1 ? " function is" : " functions are") + " at or above 30.";
    else lead += " Nothing on this snippet is at 30 or above.";
    document.getElementById("crap-readout").textContent = lead;

    var missed = new Set();
    var partial = new Set();
    scored.forEach(function (fn) {
      fn.missedLines.forEach(function (line) { missed.add(line); });
      (fn.partialLines || []).forEach(function (line) { partial.add(line); });
    });
    var dupLines = new Set();
    duplicates.forEach(function (dup) {
      for (var line = dup.lineA1; line <= dup.lineA2; line++) dupLines.add(line);
      for (var other = dup.lineB1; other <= dup.lineB2; other++) dupLines.add(other);
    });
    var lines = code.split("\n");
    var items = lines.map(function (line, index) {
      var number = index + 1;
      var cls = "";
      if (missed.has(number)) cls = "miss";
      else if (partial.has(number)) cls = "partial";
      if (dupLines.has(number)) cls += " dup";
      return "<li class=\"" + cls.trim() + "\">" + escapeHtml(line) + "</li>";
    }).join("");
    document.getElementById("listing").innerHTML = "<ol>" + items + "</ol>";
    show("crapper", true);
  }

  function renderDryer(duplicates) {
    var host = document.getElementById("dry-list");
    if (!duplicates.length) {
      host.innerHTML = "<p class=\"empty\">No near-duplicate blocks. A match has to share at least four lines of shape, ignoring names and numbers, and tests are skipped.</p>";
    } else {
      host.innerHTML = "<div class=\"pairs\">" + duplicates.map(function (dup, index) {
        return "<article class=\"pair\"><h3>Pair " + (index + 1) + " · " + dup.tokens +
          " tokens</h3><div class=\"pair-grid\"><div><p class=\"hint\">Lines " + dup.lineA1 + "–" + dup.lineA2 +
          "</p><pre>" + escapeHtml(dup.textA) + "</pre></div><div><p class=\"hint\">Lines " + dup.lineB1 + "–" +
          dup.lineB2 + "</p><pre>" + escapeHtml(dup.textB) + "</pre></div></div></article>";
      }).join("") + "</div>";
    }
    show("dryer", true);
  }

  function diffHtml(mutant) {
    var html = "";
    if (mutant.before) html += "<del>" + escapeHtml(mutant.before) + "</del>";
    html += "<ins>" + escapeHtml(mutant.after || "") + "</ins>";
    return "<pre class=\"diff\">" + html + "</pre>";
  }

  function renderMutator(outcome) {
    var score = document.getElementById("mutation-score");
    var bar = document.getElementById("mutation-bar");
    var readout = document.getElementById("mutant-readout");
    var survivors = document.getElementById("survivors");
    var killedList = document.getElementById("killed-list");
    var killedSummary = document.getElementById("killed-summary");
    var killedWrap = document.getElementById("killed-wrap");

    if (outcome.skipped) {
      score.textContent = "Not scored";
      bar.hidden = true;
      readout.textContent = outcome.reason;
      survivors.innerHTML = "";
      killedList.innerHTML = "";
      killedWrap.hidden = true;
      show("mutator", true);
      return { label: "—", sub: "suite not green", perfect: false };
    }

    var total = outcome.killed.length + outcome.survived.length;
    var ratio = total === 0 ? 0 : outcome.killed.length / total;
    score.textContent = outcome.killed.length + " / " + total + " killed · " + Math.round(ratio * 100) + "%";
    bar.hidden = total === 0;
    bar.innerHTML = "<span class=\"bar-killed\" style=\"width:" + (ratio * 100) + "%\"></span>";
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", outcome.killed.length + " of " + total + " mutants killed");
    readout.textContent = outcome.survived.length
      ? (outcome.survived.length === 1
        ? "1 mutant survived. The tests still passed after that edit."
        : outcome.survived.length + " mutants survived. The tests still passed after those edits.")
      : "Every mutant failed a test. On this snippet the suite noticed each small edit.";

    survivors.innerHTML = "<div class=\"survivors\">" + outcome.survived.map(function (item) {
      return "<article class=\"survivor\"><header><span class=\"badge bad\">Survived</span><strong>" +
        escapeHtml(item.mutant.description) + "</strong><span class=\"hint\">line " + item.mutant.line +
        " · " + escapeHtml(item.mutant.typeLabel) + "</span></header>" + diffHtml(item.mutant) +
        "<p class=\"hint\">All " + item.tests + " tests still passed.</p></article>";
    }).join("") + "</div>";

    killedSummary.textContent = "Killed mutants (" + outcome.killed.length + ")";
    killedList.innerHTML = outcome.killed.map(function (item) {
      var how = item.timeout ? "timed out" : (item.killer ? item.killer : (item.error || "failed"));
      return "<li><span class=\"badge good\">Killed</span> " + escapeHtml(item.mutant.description) +
        " <span class=\"hint\">line " + item.mutant.line + " · " + escapeHtml(how) + "</span></li>";
    }).join("");
    killedWrap.hidden = outcome.killed.length === 0;
    killedWrap.open = outcome.survived.length === 0;
    show("mutator", true);
    return {
      label: total ? Math.round(ratio * 100) + "%" : "—",
      sub: outcome.killed.length + " killed · " + outcome.survived.length + " survived",
      perfect: total > 0 && outcome.survived.length === 0
    };
  }

  async function runChecks() {
    var token = ++runToken;
    setBusy(true);
    status.textContent = "Parsing…";
    var report = checks.analyze(sourceBox.value);
    if (token !== runToken) return;
    if (report.error) {
      status.textContent = report.error;
      show("summary", false);
      show("tests-panel", false);
      show("crapper", false);
      show("dryer", false);
      show("mutator", false);
      setBusy(false);
      return;
    }

    status.textContent = "Running the original tests…";
    var baseline = await runInWorker(report.program, 1000);
    if (token !== runToken) return;
    var results = baseline.results || [];
    var passed = baseline.ok && results.length > 0 && results.every(function (test) { return test.passed; });
    renderTests(results, baseline.ok ? "" : (baseline.error || "The module failed to load."));
    var scored = checks.scoreRun(report.functions, baseline.hits || []);
    renderCrapper(report.code, scored, report.duplicates);
    renderDryer(report.duplicates);

    var mutationView;
    if (!passed) {
      var reason = !results.length
        ? "Mutation testing waits until the module defines tests."
        : "Mutation testing waits until the original tests pass. A kill would not mean much while the suite is already red.";
      if (!baseline.ok) reason = "Mutation testing waits until the module loads. " + (baseline.error || "");
      mutationView = renderMutator({ skipped: true, reason: reason });
    } else {
      var picked = checks.selectMutants(report.mutants, scored);
      var killed = [];
      var survived = [];
      for (var i = 0; i < picked.length; i++) {
        if (token !== runToken) return;
        status.textContent = "Running mutant " + (i + 1) + " of " + picked.length + "…";
        var result = await runInWorker(picked[i].source, 800);
        if (token !== runToken) return;
        var mutantPassed = result.ok && result.results && result.results.length > 0 &&
          result.results.every(function (test) { return test.passed; });
        if (mutantPassed) {
          survived.push({ mutant: picked[i], tests: result.results.length });
        } else {
          var killer = (result.results || []).filter(function (test) { return !test.passed; })[0];
          killed.push({
            mutant: picked[i],
            timeout: !!result.timeout,
            killer: killer ? killer.name + (killer.error ? " — " + killer.error : "") : "",
            error: result.error || ""
          });
        }
      }
      mutationView = renderMutator({ killed: killed, survived: survived });
    }

    renderSummary(scored, report.duplicates, results, mutationView);
    status.textContent = passed
      ? "Checked " + scored.length + " function" + (scored.length === 1 ? "" : "s") + ", " +
        report.duplicates.length + " duplicate pair" + (report.duplicates.length === 1 ? "" : "s") +
        ", and the mutant run."
      : "Parsed the module. The original tests did not all pass.";
    setBusy(false);
  }

  exampleButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      selectExample(button.getAttribute("data-example"), true);
    });
  });
  runButton.addEventListener("click", runChecks);
  sourceBox.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      runChecks();
    }
  });

  selectExample(selectedId, true);
})();
