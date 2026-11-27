// Illustrative simulation of a harness that replays repeated answers as code.
// Saltbox Kitchen, its kitchens, and its vendors were invented for this page.
// This is not AgentRun's code, not Jev, and the dollar figures are not their benchmarks.
// https://agentrun.ai/
(function () {
  "use strict";

  var SALTBOX = "Saltbox Kitchen";
  var LLM_CENTS = 3;
  var LLM_MS = 1600;
  var CODE_MS = 8;
  var SURPRISE_FRACTION = 0.45;

  var LIMITS = {
    count: { min: 200, max: 500, step: 20, def: 320 },
    threshold: { min: 4, max: 20, step: 1, def: 8 },
    spotEvery: { min: 4, max: 20, step: 1, def: 10 }
  };

  var STEPS = [
    { id: "vendor", title: "Identify vendor", question: "Whose invoice is this?" },
    { id: "extract", title: "Extract line items", question: "What rows and prices are on the page?" },
    { id: "map", title: "Map to accounts", question: "Which account gets each line?" },
    { id: "price", title: "Check the price", question: "Did any line jump more than 8% from the last order?" },
    { id: "route", title: "Route for approval", question: "Who should sign off?" }
  ];

  var CYCLE = ["river", "hale", "millhouse", "linen", "cork", "river", "hale", "millhouse", "linen", "cork", "river", "hale", "odd"];
  var VENDOR_IDS = ["river", "hale", "millhouse", "linen", "cork"];

  var VENDORS = {
    river: { name: "River & Rind Produce", short: "River & Rind" },
    hale: { name: "Hale & Brisket Meats", short: "Hale & Brisket" },
    millhouse: { name: "Millhouse Dairy", short: "Millhouse" },
    linen: { name: "Linen & Loom", short: "Linen & Loom" },
    cork: { name: "Cork & Cask Distributors", short: "Cork & Cask" },
    odd: { name: "Unlisted slip", short: "Unlisted slip" }
  };

  var PRESETS = {
    quiet: { count: 320, threshold: 8, surprise: false, spotCheck: false, spotEvery: 10 },
    stale: { count: 320, threshold: 8, surprise: true, spotCheck: false, spotEvery: 10 },
    spot: { count: 320, threshold: 8, surprise: true, spotCheck: true, spotEvery: 10 }
  };

  function clampInt(value, min, max, fallback) {
    var n = Math.round(Number(value));
    if (!isFinite(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function makeInvoice(i, surpriseAt) {
    var vendor = CYCLE[(i - 1) % CYCLE.length];
    var surprised = surpriseAt > 0 && i >= surpriseAt;
    var spike = false;
    var formatBreak = false;
    var categoryBreak = false;
    var oddKind = null;
    if (vendor === "odd") {
      oddKind = ["photo", "credit", "mixed"][i % 3];
    } else if (surprised && vendor === "river") {
      formatBreak = true;
      spike = true;
    } else if (surprised && vendor === "hale" && i % 2 === 0) {
      spike = true;
    } else if (surprised && vendor === "linen") {
      categoryBreak = true;
    }
    var invoice = {
      i: i,
      vendor: vendor,
      name: VENDORS[vendor].name,
      kitchen: i % 2 === 0 ? "East Market kitchen" : "River Ward kitchen",
      oddKind: oddKind,
      surprised: surprised,
      spike: spike,
      formatBreak: formatBreak,
      categoryBreak: categoryBreak
    };
    invoice.blurb = blurb(invoice);
    return invoice;
  }

  function blurb(invoice) {
    var where = "For the " + invoice.kitchen + ".";
    if (invoice.vendor === "odd") {
      if (invoice.oddKind === "photo") return "Phone photo of a paper receipt. The vendor name is cut off. " + where;
      if (invoice.oddKind === "credit") return "One page with a produce credit and a wine charge. Two vendors. " + where;
      return "Handwritten drop-off. “Greens” and “bread,” quantities missing. " + where;
    }
    if (invoice.formatBreak) {
      return "Columns moved. SKU RR-TOM-ROMA, a fuel surcharge, and romas at $1.23/lb against $1.10 last time, a 12% jump. " + where;
    }
    if (invoice.vendor === "hale" && invoice.spike) {
      return "Beef chuck at $4.56/lb. Last order was $4.00, a 14% jump. Chicken thigh is flat. " + where;
    }
    if (invoice.categoryBreak) {
      return "Apron laundry, plus 12 embroidered chef coats. The coats belong on Uniforms, not Linens. " + where;
    }
    if (invoice.vendor === "river") return "Roma tomatoes, 25 lb; cilantro; lemons. Same columns as last month. Prices within 3%. " + where;
    if (invoice.vendor === "hale") return "Beef chuck at $4.00/lb, same as last time, and chicken thigh. " + where;
    if (invoice.vendor === "millhouse") return "Whole milk, butter, and heavy cream. Prices within 3%. " + where;
    if (invoice.vendor === "linen") return "Apron and towel laundry, 80 pieces. " + where;
    return "House red and a lager keg. Prices within 3%. " + where;
  }

  function truthFor(stepId, invoice) {
    if (invoice.vendor === "odd") return "odd-" + invoice.oddKind;
    if (stepId === "vendor") return invoice.vendor;
    if (stepId === "extract") {
      if (invoice.formatBreak) return "layout-b";
      if (invoice.categoryBreak) return "layout-a-plus";
      return "layout-a";
    }
    if (stepId === "map") {
      if (invoice.categoryBreak) return "uniforms";
      if (invoice.formatBreak) return "produce+delivery";
      if (invoice.vendor === "river") return "produce";
      if (invoice.vendor === "hale") return "protein";
      if (invoice.vendor === "millhouse") return "dairy";
      if (invoice.vendor === "linen") return "linens";
      return "beverage";
    }
    if (stepId === "price") return invoice.spike ? "flag" : "clear";
    return invoice.spike ? "manager" : "bookkeeper";
  }

  function valueLabel(stepId, value) {
    if (value === null || value === undefined) return "no saved answer";
    if (stepId === "vendor" && VENDORS[value]) return VENDORS[value].name;
    if (stepId === "extract") {
      if (value === "layout-a") return "the usual rows";
      if (value === "layout-b") return "the new columns";
      if (value === "layout-a-plus") return "the usual rows plus chef coats";
    }
    if (stepId === "map") {
      if (value === "produce") return "Food cost — Produce";
      if (value === "protein") return "Food cost — Protein";
      if (value === "dairy") return "Food cost — Dairy";
      if (value === "linens") return "Operating — Linens";
      if (value === "uniforms") return "Operating — Uniforms";
      if (value === "beverage") return "Beverage cost — Beer and wine";
      if (value === "produce+delivery") return "Produce plus Delivery";
    }
    if (stepId === "price") {
      if (value === "clear") return "no flag";
      if (value === "flag") return "flag the jump";
    }
    if (stepId === "route") {
      if (value === "bookkeeper") return "bookkeeper";
      if (value === "manager") return "manager";
    }
    return "needs a person";
  }

  function missText(stepId, invoice) {
    if (stepId === "price") {
      return invoice.name + " jumped more than 8%, and the replayed price rule still said no flag.";
    }
    if (stepId === "map" && invoice.categoryBreak) {
      return "Chef coats on the Linen & Loom invoice were filed to Linens. They belong on Uniforms.";
    }
    if (stepId === "map" && invoice.formatBreak) {
      return "The fuel surcharge on the River & Rind invoice was filed to Produce. It belongs on Delivery.";
    }
    if (stepId === "extract" && invoice.formatBreak) {
      return "River & Rind changed its columns. The learned parser still reads last month's layout, so the new rows never land.";
    }
    if (stepId === "extract" && invoice.categoryBreak) {
      return "The learned Linen & Loom template dropped the chef-coat line.";
    }
    if (stepId === "route") {
      return "The jump should have gone to the manager. The replayed route still says bookkeeper.";
    }
    return "The replayed answer did not match this invoice.";
  }

  function stepById(id) {
    var s;
    for (s = 0; s < STEPS.length; s++) {
      if (STEPS[s].id === id) return STEPS[s];
    }
    return STEPS[0];
  }

  function boardSnapshot(rules, threshold, justSteps) {
    var out = Object.create(null);
    var s;
    var v;
    var step;
    var rule;
    var code;
    var learn;
    var demoted;
    var replay;
    var staleBits;
    var staleInvoices;
    var label;
    var detail;
    for (s = 0; s < STEPS.length; s++) {
      step = STEPS[s];
      code = [];
      learn = [];
      demoted = [];
      replay = [];
      staleBits = [];
      staleInvoices = 0;
      for (v = 0; v < VENDOR_IDS.length; v++) {
        rule = rules[step.id][VENDOR_IDS[v]];
        if (rule && rule.mode === "code") {
          code.push(VENDORS[VENDOR_IDS[v]].short);
          replay.push(VENDORS[VENDOR_IDS[v]].short + ": " + valueLabel(step.id, rule.value));
          if (rule.misses > 0) {
            staleInvoices += rule.misses;
            staleBits.push(VENDORS[VENDOR_IDS[v]].short + " wrong on " + rule.misses);
          }
        } else if (rule && rule.demotions > 0) {
          demoted.push(VENDORS[VENDOR_IDS[v]].short + " (" + rule.hits + " of " + threshold + ")");
        } else {
          learn.push(VENDORS[VENDOR_IDS[v]].short + " " + (rule ? rule.hits : 0) + "/" + threshold);
        }
      }
      if (code.length === 0) label = "LLM";
      else if (code.length === VENDOR_IDS.length) label = "CODE";
      else label = "MIXED";
      if (staleInvoices > 0) {
        detail = "Still CODE, and wrong on " + staleInvoices + " invoices. " + staleBits.join(". ") + ".";
        if (demoted.length) detail += " Demoted: " + demoted.join(", ") + ".";
      } else if (label === "CODE") {
        detail = "All five vendors replay a saved answer. Handwritten slips still call the model.";
      } else if (label === "LLM") {
        detail = demoted.length
          ? "Back on the model. " + demoted.join(", ") + "."
          : "Calling the model until " + threshold + " answers match. " + learn.join(", ") + ".";
      } else {
        detail = "Code for " + code.join(", ") + ".";
        if (demoted.length) detail += " Demoted: " + demoted.join(", ") + ".";
        if (learn.length) detail += " Learning: " + learn.join(", ") + ".";
      }
      out[step.id] = {
        label: label,
        detail: detail,
        replay: replay.join(" · "),
        codeVendors: code.length,
        stale: staleInvoices > 0,
        justGraduated: justSteps[step.id] === true
      };
    }
    return out;
  }

  function exportRules(rules) {
    var out = Object.create(null);
    var s;
    var key;
    var copy;
    for (s = 0; s < STEPS.length; s++) {
      out[STEPS[s].id] = Object.create(null);
      for (key in rules[STEPS[s].id]) {
        if (Object.prototype.hasOwnProperty.call(rules[STEPS[s].id], key)) {
          copy = rules[STEPS[s].id][key];
          out[STEPS[s].id][key] = {
            mode: copy.mode,
            hits: copy.hits,
            value: copy.value,
            demotions: copy.demotions,
            misses: copy.misses
          };
        }
      }
    }
    return out;
  }

  function run(options) {
    var opts = options || {};
    var count = clampInt(opts.count, LIMITS.count.min, LIMITS.count.max, LIMITS.count.def);
    var threshold = clampInt(opts.threshold, LIMITS.threshold.min, LIMITS.threshold.max, LIMITS.threshold.def);
    var spotEvery = clampInt(opts.spotEvery, LIMITS.spotEvery.min, LIMITS.spotEvery.max, LIMITS.spotEvery.def);
    var surprise = opts.surprise === true;
    var spotCheck = opts.spotCheck === true;
    var surpriseAt = surprise ? Math.floor(count * SURPRISE_FRACTION) : 0;
    var rules = Object.create(null);
    var rows = [];
    var s;
    var i;
    var invoice;
    var events;
    var stepResults;
    var justSteps;
    var sig;
    var truth;
    var rule;
    var via;
    var emitted;
    var demoted;
    var sampled;
    var correct;
    var step;
    var harnessCents = 0;
    var baselineCents = 0;
    var harnessMs = 0;
    var baselineMs = 0;
    var llmCalls = 0;
    var baselineCalls = 0;
    var correctSteps = 0;
    var totalSteps = 0;
    var catchHits = 0;
    var catchTotal = 0;
    var demotions = 0;
    var graduations = 0;

    for (s = 0; s < STEPS.length; s++) rules[STEPS[s].id] = Object.create(null);

    for (i = 1; i <= count; i++) {
      invoice = makeInvoice(i, surpriseAt);
      events = [];
      stepResults = [];
      justSteps = Object.create(null);
      sampled = spotCheck && i % spotEvery === 0;
      if (surprise && i === surpriseAt) {
        events.push({
          kind: "surprise",
          text: "Hale & Brisket raises beef chuck 14%. River & Rind reprints its invoice. Linen & Loom adds chef coats. A replay of last month's answer does not notice."
        });
      }
      for (s = 0; s < STEPS.length; s++) {
        step = STEPS[s];
        sig = invoice.vendor === "odd" ? "odd-" + i : invoice.vendor;
        truth = truthFor(step.id, invoice);
        rule = rules[step.id][sig];
        if (!rule) {
          rule = { mode: "llm", hits: 0, value: null, demotions: 0, misses: 0 };
          rules[step.id][sig] = rule;
        }
        demoted = false;
        baselineCalls += 1;
        baselineCents += LLM_CENTS;
        baselineMs += LLM_MS;
        if (rule.mode === "code" && sampled) {
          via = "check";
          emitted = truth;
          llmCalls += 1;
          harnessCents += LLM_CENTS;
          harnessMs += LLM_MS;
          if (rule.value !== truth) {
            demoted = true;
            demotions += 1;
            rule.mode = "llm";
            rule.value = truth;
            rule.hits = 1;
            rule.misses = 0;
            rule.demotions += 1;
            events.push({
              kind: "demote",
              step: step.id,
              text: step.title + " for " + invoice.name + " disagreed with the model, so that rule is back on the model."
            });
          }
        } else if (rule.mode === "code") {
          via = "code";
          emitted = rule.value;
          harnessMs += CODE_MS;
          if (emitted !== truth) {
            rule.misses += 1;
            events.push({ kind: "miss", step: step.id, text: missText(step.id, invoice) });
          }
        } else {
          via = "llm";
          emitted = truth;
          llmCalls += 1;
          harnessCents += LLM_CENTS;
          harnessMs += LLM_MS;
          if (rule.value === truth) rule.hits += 1;
          else {
            rule.value = truth;
            rule.hits = 1;
          }
          if (rule.hits >= threshold) {
            rule.mode = "code";
            graduations += 1;
            justSteps[step.id] = true;
            events.push({
              kind: "graduate",
              step: step.id,
              text: step.title + " for " + invoice.name + " graduated after " + threshold + " matching answers."
            });
          }
        }
        correct = emitted === truth;
        if (correct) correctSteps += 1;
        totalSteps += 1;
        if (step.id === "price" && truth === "flag") {
          catchTotal += 1;
          if (emitted === "flag") catchHits += 1;
        }
        stepResults.push({
          id: step.id,
          via: via,
          correct: correct,
          truth: truth,
          emitted: emitted,
          demoted: demoted,
          modeAfter: rule.mode,
          hitsAfter: rule.hits
        });
      }
      rows.push({
        i: i,
        vendor: invoice.vendor,
        name: invoice.name,
        kitchen: invoice.kitchen,
        blurb: invoice.blurb,
        surprise: invoice.surprised,
        spike: invoice.spike,
        formatBreak: invoice.formatBreak,
        categoryBreak: invoice.categoryBreak,
        sampled: sampled,
        steps: stepResults,
        events: events,
        harnessCents: harnessCents,
        baselineCents: baselineCents,
        harnessMs: harnessMs,
        baselineMs: baselineMs,
        llmCalls: llmCalls,
        avoided: baselineCalls - llmCalls,
        correctSteps: correctSteps,
        totalSteps: totalSteps,
        catchHits: catchHits,
        catchTotal: catchTotal,
        board: boardSnapshot(rules, threshold, justSteps)
      });
    }

    return {
      count: count,
      threshold: threshold,
      surprise: surprise,
      surpriseAt: surpriseAt,
      spotCheck: spotCheck,
      spotEvery: spotEvery,
      rows: rows,
      finalRules: exportRules(rules),
      totals: {
        harnessCents: harnessCents,
        baselineCents: baselineCents,
        harnessMs: harnessMs,
        baselineMs: baselineMs,
        llmCalls: llmCalls,
        baselineCalls: baselineCalls,
        avoided: baselineCalls - llmCalls,
        correctSteps: correctSteps,
        totalSteps: totalSteps,
        accuracy: totalSteps ? correctSteps / totalSteps : 1,
        catchHits: catchHits,
        catchTotal: catchTotal,
        catchRate: catchTotal ? catchHits / catchTotal : null,
        demotions: demotions,
        graduations: graduations
      }
    };
  }

  function formatUsd(cents) {
    var abs = Math.abs(Math.round(cents));
    var dollars = Math.floor(abs / 100);
    var rem = abs % 100;
    return (cents < 0 ? "-" : "") + "$" + dollars + "." + (rem < 10 ? "0" : "") + rem;
  }

  function formatSeconds(ms) {
    var tenths = Math.round(ms / 100);
    var whole = Math.floor(tenths / 10);
    var frac = Math.abs(tenths % 10);
    return whole + "." + frac + " s";
  }

  function formatPct(ratio) {
    if (ratio === null || ratio === undefined) return "No jumps yet";
    return Math.round(ratio * 100) + "%";
  }

  globalThis.LlmToCodeLab = {
    SALTBOX: SALTBOX,
    LLM_CENTS: LLM_CENTS,
    LLM_MS: LLM_MS,
    CODE_MS: CODE_MS,
    SURPRISE_FRACTION: SURPRISE_FRACTION,
    LIMITS: LIMITS,
    STEPS: STEPS,
    CYCLE: CYCLE,
    VENDOR_IDS: VENDOR_IDS,
    VENDORS: VENDORS,
    PRESETS: PRESETS,
    makeInvoice: makeInvoice,
    truthFor: truthFor,
    valueLabel: valueLabel,
    stepById: stepById,
    run: run,
    formatUsd: formatUsd,
    formatSeconds: formatSeconds,
    formatPct: formatPct
  };
})();
