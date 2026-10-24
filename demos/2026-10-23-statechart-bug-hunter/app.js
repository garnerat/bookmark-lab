/* Draws the statechart and steps through checker traces. */
(function () {
  "use strict";

  const hunt = window.StateHunt;
  const svgNS = "http://www.w3.org/2000/svg";

  const scenariosEl = document.getElementById("scenarios");
  const blurbEl = document.getElementById("blurb");
  const fixBtn = document.getElementById("fix");
  const fixNote = document.getElementById("fix-note");
  const metricsEl = document.getElementById("metrics");
  const readoutEl = document.getElementById("readout");
  const compareEl = document.getElementById("compare");
  const stepKicker = document.getElementById("step-kicker");
  const stepSay = document.getElementById("step-say");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const blockedEl = document.getElementById("blocked");
  const legendEl = document.getElementById("legend");
  const chartEl = document.getElementById("chart");
  const factsEl = document.getElementById("facts");
  const invEl = document.getElementById("invariants");
  const samplesEl = document.getElementById("samples");
  const traceEl = document.getElementById("trace");
  const specSummary = document.getElementById("spec-summary");
  const specEl = document.getElementById("spec");

  let scenarioId = "booking";
  let fix = false;
  let sampleId = "bug";
  let stepIndex = 0;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    const data = attrs || {};
    Object.keys(data).forEach(function (key) {
      if (key === "class") node.className = data[key];
      else node.setAttribute(key, data[key]);
    });
    (children || []).forEach(function (child) {
      if (child != null) node.append(child);
    });
    return node;
  }

  function svg(tag, attrs) {
    const node = document.createElementNS(svgNS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function text(value) {
    return document.createTextNode(value);
  }

  function cap(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function view() {
    const scenario = hunt.getScenario(scenarioId);
    const buggy = hunt.explore(scenarioId, false);
    const fixed = hunt.explore(scenarioId, true);
    const current = fix ? fixed : buggy;
    const bugIds = buggy.violation.trace.map(function (step) {
      return step.actionId;
    }).filter(Boolean);
    let played;
    if (sampleId === "bug") {
      played = fix ? hunt.play(scenarioId, true, bugIds) : { steps: buggy.violation.trace, blocked: null };
    } else {
      const sample = scenario.samples.find(function (item) {
        return item.id === sampleId;
      });
      played = hunt.play(scenarioId, fix, sample.actions);
    }
    const steps = played.steps;
    if (stepIndex > steps.length - 1) stepIndex = steps.length - 1;
    if (stepIndex < 0) stepIndex = 0;
    return {
      scenario: scenario,
      buggy: buggy,
      fixed: fixed,
      current: current,
      steps: steps,
      blocked: played.blocked,
      step: steps[stepIndex],
      prev: stepIndex > 0 ? steps[stepIndex - 1] : null,
    };
  }

  function brokenCount(result) {
    return result.invariants.filter(function (inv) {
      return !inv.ok;
    }).length;
  }

  function renderScenarios(scenario) {
    const focus = document.activeElement && document.activeElement.dataset.focus;
    scenariosEl.replaceChildren();
    hunt.scenarios.forEach(function (item) {
      const button = el("button", {
        type: "button",
        "data-focus": "scenario-" + item.id,
        "aria-pressed": item.id === scenario.id ? "true" : "false",
      }, [text(item.title)]);
      button.addEventListener("click", function () {
        scenarioId = item.id;
        sampleId = "bug";
        fix = false;
        stepIndex = 0;
        render();
      });
      scenariosEl.append(button);
    });
    blurbEl.textContent = scenario.blurb;
    fixBtn.textContent = fix ? "Turn the fix off" : "Turn the fix on";
    fixBtn.setAttribute("aria-pressed", fix ? "true" : "false");
    fixNote.textContent = fix ? scenario.fixNoteOn : scenario.fixNoteOff;
    if (focus && focus.indexOf("scenario-") === 0) {
      const again = scenariosEl.querySelector('[data-focus="' + focus + '"]');
      if (again) again.focus();
    }
  }

  function metric(kicker, value, kind) {
    return el("article", { class: "metric" + (kind ? " " + kind : "") }, [
      el("span", { class: "metric-k" }, [text(kicker)]),
      el("strong", null, [text(value)]),
    ]);
  }

  function renderMetrics(model) {
    const broken = brokenCount(model.current);
    const steps = model.current.violation ? String(model.current.violation.steps) : "None";
    metricsEl.replaceChildren(
      metric("States explored", String(model.current.statesExplored), ""),
      metric("Invariants failing", String(broken), broken ? "bad" : "ok"),
      metric("Shortest trace", steps, model.current.violation ? "bad" : "ok"),
      metric("This step", stepIndex + " / " + (model.steps.length - 1), "")
    );

    if (model.current.violation) {
      readoutEl.textContent =
        "Checked " +
        model.current.statesExplored +
        " reachable states. The shortest counterexample is " +
        model.current.violation.steps +
        " steps and breaks “" +
        model.current.violation.name +
        ".”";
    } else {
      readoutEl.textContent =
        "Checked " +
        model.current.statesExplored +
        " reachable states. All " +
        model.current.invariants.length +
        " invariants hold.";
    }

    compareEl.textContent =
      "Without the fix: " +
      model.buggy.statesExplored +
      " states, " +
      brokenCount(model.buggy) +
      " failing. With the fix: " +
      model.fixed.statesExplored +
      " states, " +
      brokenCount(model.fixed) +
      " failing.";
  }

  function renderStep(model) {
    const step = model.step;
    const who = step.actorLabel ? step.actorLabel + " · " : "";
    stepKicker.textContent = "Step " + stepIndex + " of " + (model.steps.length - 1);
    stepSay.textContent = who && step.actionId ? who + step.label + ". " + step.say : step.say;
    prevBtn.disabled = stepIndex === 0;
    nextBtn.disabled = stepIndex >= model.steps.length - 1;
    const showBlocked = model.blocked && stepIndex === model.steps.length - 1;
    blockedEl.hidden = !showBlocked;
    if (showBlocked) {
      blockedEl.textContent =
        model.blocked.blockedSay ||
        "The fix refuses the next step (" + model.blocked.label + ").";
    }
  }

  function marker(id, color) {
    const node = svg("marker", {
      id: id,
      viewBox: "0 0 10 10",
      refX: "8",
      refY: "5",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto",
    });
    node.append(svg("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
    return node;
  }

  function drawRegion(region, state, prevState, actionId) {
    const nodes = region.states;
    const index = {};
    nodes.forEach(function (node, i) {
      index[node.id] = i;
    });
    const activeId = region.active(state);
    const prevId = prevState ? region.active(prevState) : null;
    const nodeH = 36;
    const gap = 22;
    const left = 12;
    const nodeW = 168;
    const top = 8;
    let curves = 0;
    region.edges.forEach(function (edge) {
      if (index[edge.to] !== index[edge.from] + 1) curves += 1;
    });
    const width = left + nodeW + (curves ? 28 + curves * 12 : 16);
    const height = top * 2 + nodes.length * nodeH + Math.max(0, nodes.length - 1) * gap;
    const activeLabel = nodes.filter(function (node) {
      return node.id === activeId;
    })[0];
    const root = svg("svg", {
      viewBox: "0 0 " + width + " " + height,
      role: "img",
      "aria-label":
        region.title + ", current state " + (activeLabel ? activeLabel.label : activeId),
    });
    const defs = svg("defs");
    defs.append(marker("arrow-" + region.id, "#5c5348"));
    defs.append(marker("arrow-hot-" + region.id, "#8f3d2b"));
    root.append(defs);

    let lane = 0;
    region.edges.forEach(function (edge) {
      const a = index[edge.from];
      const b = index[edge.to];
      const hot = edge.action === actionId && edge.from === prevId && edge.to === activeId;
      const stroke = hot ? "#8f3d2b" : "#5c5348";
      const widthPx = hot ? "2.5" : "1.5";
      const mark = "url(#" + (hot ? "arrow-hot-" : "arrow-") + region.id + ")";
      let shape;
      if (b === a + 1) {
        const x = left + nodeW / 2;
        const y1 = top + a * (nodeH + gap) + nodeH + 1;
        const y2 = top + b * (nodeH + gap) - 2;
        shape = svg("line", {
          x1: x,
          y1: y1,
          x2: x,
          y2: y2,
          stroke: stroke,
          "stroke-width": widthPx,
          "marker-end": mark,
        });
      } else {
        const x = left + nodeW;
        const y1 = top + a * (nodeH + gap) + nodeH / 2;
        const y2 = top + b * (nodeH + gap) + nodeH / 2;
        const bulge = 16 + lane * 12;
        lane += 1;
        shape = svg("path", {
          d: "M " + x + " " + y1 + " C " + (x + bulge) + " " + y1 + ", " + (x + bulge) + " " + y2 + ", " + x + " " + y2,
          fill: "none",
          stroke: stroke,
          "stroke-width": widthPx,
          "marker-end": mark,
        });
      }
      if (edge.dashed) shape.setAttribute("stroke-dasharray", "5 4");
      root.append(shape);
    });

    nodes.forEach(function (node, i) {
      const y = top + i * (nodeH + gap);
      const on = node.id === activeId;
      root.append(
        svg("rect", {
          x: left,
          y: y,
          width: nodeW,
          height: nodeH,
          rx: "10",
          fill: on ? "#8f3d2b" : "#fffdf8",
          stroke: on ? "#8f3d2b" : "#e3d8c8",
          "stroke-width": on ? "2" : "1.5",
        })
      );
      const label = svg("text", {
        x: left + nodeW / 2,
        y: y + nodeH / 2 + 1,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        fill: on ? "#fffdf8" : "#1c1915",
        "font-size": "14",
        "font-family": "Segoe UI, system-ui, sans-serif",
      });
      label.textContent = node.label;
      root.append(label);
    });
    return root;
  }

  function renderChart(model) {
    legendEl.textContent =
      model.scenario.id === "booking"
        ? "Filled node: where that part is now. A dashed arrow is the payment retry, or a reminder dropped when Ada cancels."
        : "Filled node: where that part is now. The agent is two parallel regions, the invoice and the dunning job.";
    const state = model.step.state;
    const prevState = model.prev ? model.prev.state : null;
    const actionId = model.step.actionId;
    chartEl.replaceChildren();
    model.scenario.groups.forEach(function (group) {
      const head = el("div", { class: "group-head" }, [
        el("p", { class: "kicker" }, [text(group.kicker)]),
        el("h3", null, [text(group.title)]),
      ]);
      const kids = [head];
      if (state.day && group.id === "customer") {
        kids.push(
          el("p", { class: "day" + (actionId === "ada-reschedule" ? " hot" : "") }, [
            text("Day · " + state.day),
          ])
        );
      }
      const regions = group.regions.map(function (region) {
        const blockKids = [];
        if (group.regions.length > 1) {
          blockKids.push(el("p", { class: "region-title" }, [text(region.title)]));
        }
        blockKids.push(drawRegion(region, state, prevState, actionId));
        return el("div", null, blockKids);
      });
      kids.push(el("div", { class: group.regions.length > 1 ? "parallel" : "" }, regions));
      if (group.note) kids.push(el("p", { class: "caption" }, [text(group.note)]));
      chartEl.append(el("section", { class: "group group-" + group.id }, kids));
    });
  }

  function fact(kicker, value, bad) {
    return el("div", { class: "fact" + (bad ? " bad" : "") }, [
      el("span", { class: "fact-k" }, [text(kicker)]),
      el("strong", null, [text(value)]),
    ]);
  }

  function renderFacts(model) {
    const state = model.step.state;
    factsEl.replaceChildren();
    if (model.scenario.id === "booking") {
      factsEl.append(
        fact("Charges", String(state.charges), state.charges > 1),
        fact("Slot", state.slotOwner === "ada" ? "Ada holds it" : "Open", false),
        fact("Day", state.day, false),
        fact("Booking", cap(state.booking), false),
        fact("Reminder", cap(state.reminder), false)
      );
    } else {
      let snapshot = "Not saved yet";
      if (state.dunning !== "idle") snapshot = state.snapshotUnpaid ? "Saved: unpaid" : "Saved: paid";
      const stale = state.snapshotUnpaid && state.client === "paid";
      factsEl.append(
        fact("Emails", String(state.emails), state.emails > 1),
        fact("Client", cap(state.client), false),
        fact("Dunning", cap(state.dunning), state.dunnedWhilePaid),
        fact("Snapshot", snapshot, stale)
      );
    }
  }

  function renderInvariants(model) {
    invEl.replaceChildren();
    model.current.invariants.forEach(function (inv) {
      const brokenHere = model.step.brokenIds.indexOf(inv.id) !== -1;
      const body = [
        el("span", { class: "badge" }, [text(inv.ok ? "Holds" : "Breaks")]),
        el("span", { class: "inv-name" }, [text(inv.name)]),
        el("span", { class: "inv-detail" }, [text(inv.detail)]),
      ];
      let meta = "Holds in all " + model.current.statesExplored + " reachable states.";
      if (!inv.ok) {
        meta = "Shortest counterexample is " + inv.steps + " steps.";
        if (brokenHere) meta += " Broken on this step.";
      }
      body.push(el("span", { class: "inv-meta" }, [text(meta)]));
      const card = el("article", { class: "inv" + (inv.ok ? " ok" : " bad") + (brokenHere ? " now" : "") });
      if (!inv.ok && !fix) {
        const button = el("button", { type: "button", "data-focus": "inv-" + inv.id }, body);
        button.addEventListener("click", function () {
          sampleId = "bug";
          const trace = model.buggy.violation.trace;
          const idx = trace.findIndex(function (step) {
            return step.brokenIds.indexOf(inv.id) !== -1;
          });
          stepIndex = idx === -1 ? trace.length - 1 : idx;
          render();
        });
        card.append(button);
      } else {
        card.append(el("div", { class: "inv-body" }, body));
      }
      invEl.append(card);
    });
  }

  function sampleLabel(scenario, sample) {
    if (sample.id !== "bug" || !fix) return sample.label;
    return scenario.fixKind === "guard" ? "Bug steps, fix on" : "Same steps, fix on";
  }

  function renderSamples(model) {
    const focus = document.activeElement && document.activeElement.dataset.focus;
    samplesEl.replaceChildren();
    model.scenario.samples.forEach(function (sample) {
      const button = el("button", {
        type: "button",
        "data-focus": "sample-" + sample.id,
        "aria-pressed": sample.id === sampleId ? "true" : "false",
      }, [text(sampleLabel(model.scenario, sample))]);
      button.addEventListener("click", function () {
        sampleId = sample.id;
        stepIndex = 0;
        render();
      });
      samplesEl.append(button);
    });
    if (focus && focus.indexOf("sample-") === 0) {
      const again = samplesEl.querySelector('[data-focus="' + focus + '"]');
      if (again) again.focus();
    }
  }

  function renderTrace(model) {
    const focus = document.activeElement && document.activeElement.dataset.focus;
    traceEl.replaceChildren();
    model.steps.forEach(function (step, index) {
      const who = step.actorLabel || "Start";
      const button = el("button", {
        type: "button",
        "data-focus": "step-" + index,
      }, [
        el("span", { class: "step-n" }, [text(String(index))]),
        el("span", { class: "step-who" }, [text(who)]),
        el("span", { class: "step-what" }, [text(step.actionId ? step.label : "Opening state")]),
      ]);
      if (index === stepIndex) button.setAttribute("aria-current", "step");
      button.addEventListener("click", function () {
        stepIndex = index;
        render();
      });
      traceEl.append(el("li", null, [button]));
    });
    if (focus && focus.indexOf("step-") === 0) {
      const again = traceEl.querySelector('[data-focus="' + focus + '"]');
      if (again) again.focus();
    }
  }

  function renderSpec(model) {
    specSummary.textContent = model.scenario.specTitle;
    specEl.textContent = model.scenario.spec;
  }

  function render() {
    const focus = document.activeElement && document.activeElement.dataset.focus;
    const model = view();
    renderScenarios(model.scenario);
    renderMetrics(model);
    renderStep(model);
    renderChart(model);
    renderFacts(model);
    renderInvariants(model);
    renderSamples(model);
    renderTrace(model);
    renderSpec(model);
    if (focus === "next" || focus === "prev" || focus === "fix") {
      const again = document.querySelector('[data-focus="' + focus + '"]');
      if (again) again.focus();
    }
  }

  fixBtn.addEventListener("click", function () {
    fix = !fix;
    render();
  });
  prevBtn.addEventListener("click", function () {
    if (stepIndex > 0) {
      stepIndex -= 1;
      render();
    }
  });
  nextBtn.addEventListener("click", function () {
    stepIndex += 1;
    render();
  });

  render();
})();
