(function () {
  "use strict";

  const model = globalThis.AuditPhases;
  const $ = (id) => document.getElementById(id);

  const state = {
    mode: "scan",
    phase: 1,
  };

  function h(tag, attrs) {
    const node = document.createElement(tag);
    const opts = attrs || {};
    Object.keys(opts).forEach((key) => {
      const value = opts[key];
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value == null ? "" : String(value);
      else if (value != null && value !== false) node.setAttribute(key, value === true ? "" : String(value));
    });
    for (let i = 2; i < arguments.length; i += 1) {
      const child = arguments[i];
      if (child == null || child === false) continue;
      node.append(child);
    }
    return node;
  }

  function say(text) {
    $("live").textContent = text;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function verdictLabel(verdict) {
    if (verdict === "confirmed") return "Confirmed";
    if (verdict === "rejected") return "Rejected";
    if (verdict === "needs_validation") return "Needs validation";
    return verdict;
  }

  function badge(text, kind) {
    return h("span", { class: "badge badge-" + kind, text: text });
  }

  function snippet(file, open) {
    const details = h("details", { class: "snippet" });
    if (open) details.open = true;
    details.append(
      h("summary", { text: "Show " + file.path }),
      h("pre", { class: "code", "aria-label": file.path, text: file.code })
    );
    return details;
  }

  function cardKind(file, view) {
    if (view === "scan" || view === "hunt") return "flag";
    if (view === "challenge") {
      if (file.challenge.outcome === "rejected") return "rejected";
      if (file.challenge.outcome === "open") return "open";
      return "stands";
    }
    if (file.record.verdict === "confirmed") return "confirmed";
    if (file.record.verdict === "rejected") return "rejected";
    return "open";
  }

  function badgeFor(file, view) {
    if (view === "scan") return badge(file.scan.severity, "flag");
    if (view === "hunt") return badge("Candidate", "flag");
    if (view === "challenge") {
      if (file.challenge.outcome === "rejected") return badge("Rejected", "rejected");
      if (file.challenge.outcome === "open") return badge("Open", "open");
      return badge("Stands", "stands");
    }
    const label = verdictLabel(file.record.verdict);
    if (view === "verify") return badge(label + " · holds", cardKind(file, view));
    return badge(label, cardKind(file, view));
  }

  function bodyFor(file, view) {
    if (view === "scan") return file.scan.claim;
    if (view === "hunt") return file.hunter;
    if (view === "challenge") return file.challenge.because;
    if (view === "verify") return file.verify.note;
    return file.record.summary;
  }

  function recordMeta(file) {
    const list = h("dl", { class: "meta" });
    function row(term, value) {
      if (!value) return;
      list.append(h("dt", { text: term }), h("dd", { text: value }));
    }
    if (file.record.verdict === "confirmed") {
      row("Trace", file.record.trace);
      row("Result", file.record.result);
      row("Severity", file.record.severity);
    } else if (file.record.verdict === "rejected") {
      row("Disproof", file.record.disproof);
    } else {
      row("Unresolved fact", file.record.unresolved);
      row("Severity", "None");
    }
    return list;
  }

  function fileCard(file, view) {
    const card = h("article", { class: "card card-" + cardKind(file, view) });
    const head = h("div", { class: "card-head" });
    const heading = view === "scan" || view === "hunt" ? file.scan.headline : file.title;
    head.append(h("h3", { text: heading }), badgeFor(file, view));
    card.append(head);
    card.append(h("p", { class: "path", text: file.path }));
    if (view === "scan") card.append(h("p", { class: "rule", text: "Rule matched: " + file.scan.rule }));
    card.append(h("p", { text: bodyFor(file, view) }));
    if (view === "record") card.append(recordMeta(file));
    const openSnippet = view === "challenge" && file.challenge.outcome === "rejected";
    card.append(snippet(file, openSnippet));
    return card;
  }

  function renderBoard() {
    const board = $("board");
    const scores = model.scoreboard();
    clear(board);

    const scanCol = h("button", {
      type: "button",
      class: "score" + (state.mode === "scan" ? " is-active" : ""),
      id: "score-scan",
      "data-mode": "scan",
      "aria-pressed": state.mode === "scan" ? "true" : "false",
    });
    scanCol.append(
      h("span", { class: "score-title", text: "Single-pass scan" }),
      h("span", { class: "score-main" }, h("strong", { text: String(scores.scanFlagged) }), h("span", { text: " flagged High" })),
      h("span", { class: "score-sub", text: scores.scanRejected + " rejected · " + scores.scanOpen + " left open" })
    );

    const auditCol = h("button", {
      type: "button",
      class: "score" + (state.mode === "audit" ? " is-active" : ""),
      id: "score-audit",
      "data-mode": "audit",
      "aria-pressed": state.mode === "audit" ? "true" : "false",
    });
    auditCol.append(
      h("span", { class: "score-title", text: "6-phase audit" }),
      h("span", { class: "score-main" }, h("strong", { text: String(scores.confirmed) }), h("span", { text: " confirmed" })),
      h("span", {
        class: "score-sub",
        text: scores.rejected + " rejected · " + scores.needsValidation + " needs validation",
      })
    );

    board.append(scanCol, auditCol);
  }

  function renderScan() {
    const root = $("scan");
    clear(root);
    root.append(
      h("h2", { id: "scan-title", text: "Every match, shipped as a finding" }),
      h("p", {
        text: "The scan walks the five files once, applies a rule, and stops. The sanitized note and the staff export are labeled High, same as the admin route.",
      })
    );
    model.FILES.forEach((file) => root.append(fileCard(file, "scan")));
    root.append(
      h("p", {
        class: "callout",
        text: "Nothing in this list was challenged. Rejected and needs-validation are not outcomes this pass can produce.",
      })
    );
  }

  function renderMap() {
    const wrap = h("div", { class: "map" });
    ["public", "staff"].forEach((side) => {
      const column = h("section", {
        class: "map-col",
        "aria-label": side === "public" ? "Public app" : "Staff session",
      });
      column.append(
        h("h3", { text: side === "public" ? "Public app" : "Staff session" }),
        h("p", {
          class: "hint",
          text:
            side === "public"
              ? "Anyone on the internet can call the public app."
              : "requireStaff runs on this router before the export.",
        })
      );
      model.FILES.filter((file) => file.side === side).forEach((file) => {
        const item = h("article", { class: "surface" });
        item.append(
          h("p", { class: "path", text: file.surface }),
          h("p", { text: file.role }),
          snippet(file, false)
        );
        column.append(item);
      });
      wrap.append(column);
    });
    return wrap;
  }

  function renderReport() {
    const groups = model.report();
    const scores = model.scoreboard();
    const wrap = h("div");
    wrap.append(
      h("p", {
        class: "callout",
        text:
          "Single-pass scan: " +
          scores.scanFlagged +
          " flagged High. This report: " +
          scores.confirmed +
          " confirmed, " +
          scores.rejected +
          " rejected, " +
          scores.needsValidation +
          " needs validation.",
      })
    );
    [
      ["confirmed", "Confirmed", "Source trace and result are both in the file.", groups.confirmed],
      ["rejected", "Rejected", "The challenge disproved these. They stay on the record.", groups.rejected],
      ["open", "Needs validation", "One fact is still open. These records have no severity.", groups.needsValidation],
    ].forEach((entry) => {
      const section = h("section", { class: "group", "aria-label": entry[1] });
      section.append(h("h3", { text: entry[1] }), h("p", { class: "hint", text: entry[2] }));
      entry[3].forEach((file) => section.append(fileCard(file, "record")));
      wrap.append(section);
    });
    return wrap;
  }

  function renderPhase() {
    const phase = model.PHASES[state.phase - 1];
    const root = $("phase");
    clear(root);
    const title = h("h2", { id: "phase-title", tabindex: "-1", text: phase.name });
    root.append(
      h("p", { class: "eyebrow", text: "Phase " + phase.id + " of 6 · " + phase.skill }),
      title,
      h("p", { text: phase.lede })
    );
    if (phase.id === 1) root.append(renderMap());
    if (phase.id === 2) model.FILES.forEach((file) => root.append(fileCard(file, "hunt")));
    if (phase.id === 3) model.FILES.forEach((file) => root.append(fileCard(file, "challenge")));
    if (phase.id === 4) model.FILES.forEach((file) => root.append(fileCard(file, "record")));
    if (phase.id === 5) model.FILES.forEach((file) => root.append(fileCard(file, "verify")));
    if (phase.id === 6) root.append(renderReport());
  }

  function renderStepper() {
    const list = $("stepper");
    clear(list);
    model.PHASES.forEach((phase) => {
      const item = h("li");
      const button = h("button", {
        type: "button",
        class: "step",
        "data-phase": String(phase.id),
        "aria-pressed": phase.id === state.phase ? "true" : "false",
        text: phase.id + " " + (phase.step || phase.name),
        "aria-label": phase.name,
      });
      if (phase.id === state.phase) button.setAttribute("aria-current", "step");
      item.append(button);
      list.append(item);
    });
  }

  function announce() {
    if (state.mode === "scan") {
      const scores = model.scoreboard();
      say("Single-pass scan. " + scores.scanFlagged + " files flagged High. None rejected.");
      return;
    }
    const phase = model.PHASES[state.phase - 1];
    if (phase.id === 3) {
      say("Phase 3, challenge each candidate. Rejected the sanitized note and the staff export.");
      return;
    }
    if (phase.id === 6) {
      const scores = model.scoreboard();
      say(
        "Report. " +
          scores.confirmed +
          " confirmed, " +
          scores.rejected +
          " rejected, " +
          scores.needsValidation +
          " needs validation."
      );
      return;
    }
    say("Phase " + phase.id + ". " + phase.name + ".");
  }

  function render(options) {
    const opts = options || {};
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", button.getAttribute("data-mode") === state.mode ? "true" : "false");
    });
    $("mode-hint").textContent =
      state.mode === "scan"
        ? "Every match is labeled High. This pass does not try to disprove a candidate."
        : "Step through the six phases. Phase 3 challenges each candidate. Phase 6 is the report.";
    renderBoard();
    const scanning = state.mode === "scan";
    $("scan").hidden = !scanning;
    $("audit").hidden = scanning;
    if (scanning) renderScan();
    else {
      renderStepper();
      renderPhase();
      $("prev").disabled = state.phase === 1;
      $("next").disabled = state.phase === model.PHASES.length;
    }
    if (opts.announce) announce();
    if (opts.focusPhase) {
      const title = $("phase-title");
      if (title && title.focus) title.focus();
      if (title && title.scrollIntoView) title.scrollIntoView({ block: "start" });
    }
  }

  document.addEventListener("click", (event) => {
    const modeButton = event.target.closest("[data-mode]");
    if (modeButton) {
      const next = modeButton.getAttribute("data-mode");
      if (next === state.mode) return;
      state.mode = next;
      render({ announce: true, focusPhase: next === "audit" });
      return;
    }
    const phaseButton = event.target.closest("[data-phase]");
    if (phaseButton && state.mode === "audit") {
      const next = Number(phaseButton.getAttribute("data-phase"));
      if (next === state.phase) return;
      state.phase = next;
      render({ announce: true, focusPhase: true });
      return;
    }
    const nav = event.target.closest("[data-nav]");
    if (!nav || state.mode !== "audit" || nav.disabled) return;
    const delta = nav.getAttribute("data-nav") === "next" ? 1 : -1;
    const next = state.phase + delta;
    if (next < 1 || next > model.PHASES.length) return;
    state.phase = next;
    render({ announce: true, focusPhase: true });
  });

  render({ announce: true });
})();
