(function () {
  "use strict";

  const M = globalThis.JobHuntMeter;

  const quoteState = {
    roles: M.DEFAULT_QUOTE.roles,
    fresh: M.DEFAULT_QUOTE.fresh,
    managers: M.DEFAULT_QUOTE.managers,
    resumeTokens: M.DEFAULT_QUOTE.resumeTokens,
    percentile: M.DEFAULT_QUOTE.percentile,
    benchmark: M.DEFAULT_QUOTE.benchmark,
  };

  const harborState = {
    onBoard: M.DEFAULT_HARBOR.onBoard,
    payListed: M.DEFAULT_HARBOR.payListed,
    concrete: M.DEFAULT_HARBOR.concrete,
    namedOwner: M.DEFAULT_HARBOR.namedOwner,
    requirePay: M.DEFAULT_HARBOR.requirePay,
  };

  const PRESETS = {
    typical: { roles: 20, fresh: 0, managers: 3, resumeTokens: 800, percentile: true, benchmark: false },
    report: { roles: 20, fresh: 0, managers: 3, resumeTokens: 800, percentile: true, benchmark: true },
    thousands: { roles: 2000, fresh: 0, managers: 3, resumeTokens: 800, percentile: true, benchmark: true },
    empty: { roles: 0, fresh: 0, managers: 0, resumeTokens: 800, percentile: false, benchmark: false },
  };

  let token = 0;
  const timers = [];

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, attrs) {
    const node = document.createElement(tag);
    const opts = attrs || {};
    Object.keys(opts).forEach(function (key) {
      if (key === "class") node.className = opts[key];
      else if (key === "text") node.textContent = opts[key];
      else node.setAttribute(key, opts[key]);
    });
    for (let i = 2; i < arguments.length; i++) {
      const child = arguments[i];
      if (child == null) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  function clearTimers() {
    while (timers.length) clearTimeout(timers.pop());
  }

  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function announce(text) {
    $("live").textContent = text;
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function readQuote() {
    return M.quote(quoteState);
  }

  function syncControls(q) {
    $("roles").value = String(quoteState.roles);
    $("fresh").value = String(quoteState.fresh);
    $("managers").value = String(quoteState.managers);
    $("resume").value = String(quoteState.resumeTokens);
    $("roles-readout").textContent = String(quoteState.roles);
    $("fresh-readout").textContent = String(quoteState.fresh);
    $("managers-readout").textContent = String(quoteState.managers);
    const words = Math.round(quoteState.resumeTokens * 0.75);
    $("resume-readout").textContent = quoteState.resumeTokens + " tokens · about " + words + " words";
    $("roles").setAttribute("aria-valuenow", String(quoteState.roles));
    $("roles").setAttribute("aria-valuetext", quoteState.roles + " roles");
    $("fresh").setAttribute("aria-valuenow", String(quoteState.fresh));
    $("fresh").setAttribute("aria-valuetext", quoteState.fresh + " new roles");
    $("managers").setAttribute("aria-valuenow", String(quoteState.managers));
    $("managers").setAttribute("aria-valuetext", quoteState.managers + " hiring managers");
    $("resume").setAttribute("aria-valuenow", String(quoteState.resumeTokens));
    $("resume").setAttribute("aria-valuetext", quoteState.resumeTokens + " tokens");
    $("percentile").setAttribute("aria-pressed", quoteState.percentile ? "true" : "false");
    $("benchmark").setAttribute("aria-pressed", quoteState.benchmark ? "true" : "false");
    $("board-off").setAttribute("aria-pressed", harborState.onBoard ? "false" : "true");
    $("board-on").setAttribute("aria-pressed", harborState.onBoard ? "true" : "false");
    $("pay-off").setAttribute("aria-pressed", harborState.payListed ? "false" : "true");
    $("pay-on").setAttribute("aria-pressed", harborState.payListed ? "true" : "false");
    $("duties-vague").setAttribute("aria-pressed", harborState.concrete ? "false" : "true");
    $("duties-concrete").setAttribute("aria-pressed", harborState.concrete ? "true" : "false");
    $("owner-team").setAttribute("aria-pressed", harborState.namedOwner ? "false" : "true");
    $("owner-named").setAttribute("aria-pressed", harborState.namedOwner ? "true" : "false");
    $("require-pay").setAttribute("aria-pressed", harborState.requirePay ? "true" : "false");
    $("require-pay").textContent = harborState.requirePay
      ? "Pay filter on. Posts with no pay range drop out."
      : "Pay filter off. Posts with no pay range stay in the list.";
    document.querySelectorAll("[data-chip-for]").forEach(function (group) {
      const id = group.getAttribute("data-chip-for");
      const current = id === "roles" ? quoteState.roles : quoteState.fresh;
      group.querySelectorAll("button").forEach(function (button) {
        button.setAttribute("aria-pressed", Number(button.getAttribute("data-value")) === current ? "true" : "false");
      });
    });
    if (q.managersAsked > q.managers) {
      $("clamp-note").textContent = "Billing " + q.managers + " lookups. The meter caps this at the number of roles searched.";
    } else {
      $("clamp-note").textContent = "Each lookup is a free people.search plus an email find at $0.00095 if it succeeds. The meter caps lookups at the number of roles searched.";
    }
    $("token-note").textContent = q.roles + " roles × (" + q.resumeTokens + " resume tokens + " + M.ILLUSTRATIVE.postingTokens + " posting tokens) = " + q.inputTokens + " input tokens. " + M.ILLUSTRATIVE.label;
  }

  function paintSteps(view) {
    const items = $("steps").querySelectorAll("li");
    items.forEach(function (item) {
      const step = Number(item.getAttribute("data-step"));
      item.classList.remove("is-now", "is-done");
      if (!view.playing && view.phase >= 4) item.classList.add("is-done");
      else if (step < view.phase) item.classList.add("is-done");
      else if (step === view.phase && view.playing) item.classList.add("is-now");
    });
    const q = readQuote();
    let detail = "Press play to walk the four steps. The list below is already the finished shortlist.";
    if (view.playing && view.phase === 1) {
      const seen = Math.round(q.roles * view.progress);
      detail = "Step 1. Search calls " + seen + " of " + q.roles + ". The cards below are the fictional open roles, not a one-to-one receipt.";
    } else if (view.playing && view.phase === 2) {
      detail = "Step 2. Looking up the hiring manager for " + q.managers + " top matches. The page’s line is the team that owns the role, not the recruiter.";
    } else if (view.playing && view.phase === 3) {
      detail = "Step 3. The agent writes the note. That writing is not a jobs-api charge.";
    } else if (view.playing && view.phase === 4) {
      detail = "Step 4. Salary check.";
    } else if (!view.playing && view.phase >= 4) {
      detail = "Finished picture. Play walks the same hunt from zero.";
    }
    $("step-detail").textContent = detail;
  }

  function paintMoney(q, view) {
    const shown = M.shownMicros(q, view);
    const presented = M.present(q, shown);
    let total = 0;
    Object.keys(shown).forEach(function (key) { total += shown[key]; });
    $("ticker-label").textContent = view.playing ? "Running cost" : "This hunt";
    $("ticker-amount").textContent = M.formatMicro(total);
    $("lesson").textContent = M.lesson(presented);
    $("credit").textContent = M.creditLine(total);

    const bar = $("bar");
    bar.textContent = "";
    if (total > 0) {
      presented.lines.forEach(function (line) {
        if (line.micro <= 0) return;
        const seg = el("span", { class: "seg seg-" + line.id });
        seg.style.width = (line.micro / total * 100) + "%";
        bar.appendChild(seg);
      });
    }

    const top = M.dominantLine(presented);
    const breakdown = $("breakdown");
    breakdown.textContent = "";
    const list = el("div", { class: "bills" });
    presented.lines.forEach(function (line) {
      const row = el("div", { class: "bill" + (top && top.id === line.id ? " is-top" : "") });
      const copy = el("div", {},
        el("div", { class: "bill-name", text: line.label }),
        el("div", { class: "bill-detail", text: line.detail })
      );
      row.appendChild(copy);
      row.appendChild(el("div", { class: "bill-amt", text: M.formatMicro(line.micro) }));
      list.appendChild(row);
    });
    breakdown.appendChild(list);
  }

function roleCard(row, view, q) {
  const card = el("article", { class: "role" + (row.harbor ? " is-harbor" : "") });
  if (row.harbor) card.setAttribute("data-harbor", "true");
  const top = el("div", { class: "role-top" },
      el("span", { class: "rank", text: String(row.rank) }),
      el("div", { class: "who" },
        el("strong", { text: row.employer }),
        document.createTextNode(" "),
        el("span", { text: row.title })
      ),
      el("span", { class: "fit", text: String(row.fit) })
    );
    card.appendChild(top);
    card.appendChild(el("p", {
      class: "meta",
      text: M.boardLabel(row.board) + " · " + M.payLabel(row) + " · " + M.ownerLabel(row),
    }));
    card.appendChild(el("p", { class: "meta", text: "Sketch fit " + row.fit + ". " + M.overlapLabel(row) }));
    if (row.harbor && row.blurb) card.appendChild(el("p", { class: "blurb", text: row.blurb }));
    const lookup = !view.playing || view.phase >= 2;
    if (lookup && row.rank <= q.managers) {
      card.appendChild(el("span", { class: "badge", text: "Hiring-manager lookup" }));
    }
    return card;
  }

  function paintBoard(q, view) {
    const report = M.evaluate(harborState);
    const place = M.placement(report);
    const placement = $("placement");
    placement.textContent = place.text;
    placement.classList.toggle("is-out", place.state !== "ranked");
    let countLine = "The agent’s shortlist has " + report.visible.length + " roles. Sketch fit is a number this page made up.";
    if (q.roles === 0) {
      countLine += " The search count is 0, so the ticker does not bill a search. This list is still the fictional board.";
    }
    $("list-count").textContent = countLine;

    const scanRank = view.playing && view.phase === 1 && view.progress > 0 && report.visible.length
      ? Math.min(report.visible.length, Math.ceil(view.progress * report.visible.length))
      : 0;

    const shortlist = $("shortlist");
    shortlist.textContent = "";
    const roles = el("div", { class: "roles" });
    report.visible.forEach(function (row) {
      const card = roleCard(row, view, q);
      if (scanRank && row.rank === scanRank) card.classList.add("is-current");
      roles.appendChild(card);
    });
    shortlist.appendChild(roles);

    const pitch = $("pitch");
    pitch.textContent = "";
    if (view.playing && view.phase < 3) {
      pitch.appendChild(el("p", { class: "hint", text: "The pitch note appears when step 3 runs." }));
    } else if (!report.visible.length) {
      pitch.appendChild(el("p", { class: "hint", text: "The shortlist is empty, so there is no note." }));
    } else {
      const top = report.visible[0];
      pitch.appendChild(noteCard("Top match", M.pitchFor(top)));
      const harborRanked = report.visible.some(function (row) { return row.id === "harbor"; });
      if (harborRanked && top.id !== "harbor") {
        pitch.appendChild(noteCard("Harbor & Pine", M.pitchFor(report.harbor)));
      } else if (!harborRanked) {
        pitch.appendChild(el("p", {
          class: "hint",
          text: "Harbor & Pine Realty has no pitch. The agent never reached the posting, and the list does not say it was skipped.",
        }));
      }
    }

    const silence = $("silence");
    silence.textContent = "";
    const missed = report.droppedPay.concat(report.offBoard).slice().sort(function (a, b) {
      return b.fit - a.fit;
    });
    if (!missed.length) {
      silence.appendChild(el("p", { class: "hint", text: "Every open posting in this fictional set is on the agent’s list." }));
    } else {
      const list = el("div", { class: "silence-list" });
      missed.forEach(function (row) {
        const off = !M.onQueryableBoard(row.board);
        const card = el("article", { class: "miss" + (row.harbor ? " is-harbor" : "") });
        if (row.harbor) card.setAttribute("data-harbor", "true");
        card.appendChild(el("span", {
          class: "kicker-out",
          text: off ? "Not a board this agent queries" : "No pay range",
        }));
        card.appendChild(el("div", { class: "miss-top" },
          el("strong", { text: row.employer }),
          el("span", { class: "fit", text: String(row.fit) })
        ));
        card.appendChild(el("p", {
          class: "meta",
          text: row.title + " · " + M.boardLabel(row.board) + " · " + M.payLabel(row) + " · " + M.ownerLabel(row),
        }));
        if (row.blurb) card.appendChild(el("p", { class: "blurb", text: row.blurb }));
        card.appendChild(el("p", {
          class: "meta",
          text: "Sketch fit " + row.fit + ". The agent’s list does not say it was skipped.",
        }));
        list.appendChild(card);
      });
      silence.appendChild(list);
    }
    const leader = M.missedLeader(report);
    $("missed").textContent = leader ? leader.text : "";
  }

  function noteCard(kicker, note) {
    return el("article", { class: "note" },
      el("p", { class: "note-k", text: kicker }),
      el("p", {}, el("strong", { text: "To " }), note.to),
      el("p", {}, el("strong", { text: "Subject " }), note.subject),
      el("p", { text: note.body })
    );
  }

  function paint(view) {
    const q = readQuote();
    syncControls(q);
    paintSteps(view);
    paintMoney(q, view);
    paintBoard(q, view);
  }

  function paintFinal() {
    token += 1;
    clearTimers();
    $("play").disabled = false;
    $("play").textContent = reducedMotion() ? "Show the finished hunt" : "Play the four steps";
    paint({ playing: false, phase: 4, progress: 1 });
  }

  function play() {
    const my = ++token;
    clearTimers();
    const q = readQuote();
    if (reducedMotion() || q.totalMicro === 0) {
      paintFinal();
      announce(M.lesson(q));
      return;
    }
    $("play").disabled = true;
    $("play").textContent = "Playing the hunt";
    paint({ playing: true, phase: 1, progress: 0 });
    announce("Step 1. Searching " + q.roles + " roles.");
    const frames = 12;
    for (let i = 1; i <= frames; i++) {
      later(function () {
        if (my !== token) return;
        paint({ playing: true, phase: 1, progress: i / frames });
      }, i * 80);
    }
    later(function () {
      if (my !== token) return;
      paint({ playing: true, phase: 2, progress: 1 });
      announce("Step 2. Looking up hiring managers for " + readQuote().managers + " top matches.");
    }, frames * 80 + 420);
    later(function () {
      if (my !== token) return;
      paint({ playing: true, phase: 3, progress: 1 });
      announce("Step 3. The agent writes a pitch. That note is not a jobs-api charge.");
    }, frames * 80 + 980);
    later(function () {
      if (my !== token) return;
      const done = readQuote();
      $("play").disabled = false;
      $("play").textContent = "Play the four steps again";
      paint({ playing: false, phase: 4, progress: 1 });
      announce("Step 4. Salary check. Total " + M.formatMicro(done.totalMicro) + ".");
    }, frames * 80 + 1540);
  }

  function onInput() {
    paintFinal();
  }

  function bind() {
    ["roles", "fresh", "managers", "resume"].forEach(function (id) {
      $(id).addEventListener("input", function () {
        if (id === "resume") quoteState.resumeTokens = Number($(id).value);
        else quoteState[id] = Number($(id).value);
        onInput();
      });
    });
    document.querySelectorAll("[data-chip-for]").forEach(function (group) {
      group.addEventListener("click", function (event) {
        const button = event.target.closest("button");
        if (!button || !group.contains(button)) return;
        const key = group.getAttribute("data-chip-for");
        quoteState[key] = Number(button.getAttribute("data-value"));
        onInput();
      });
    });
    $("percentile").addEventListener("click", function () {
      quoteState.percentile = !quoteState.percentile;
      onInput();
    });
    $("benchmark").addEventListener("click", function () {
      quoteState.benchmark = !quoteState.benchmark;
      onInput();
    });
    Object.keys(PRESETS).forEach(function (name) {
      $("preset-" + name).addEventListener("click", function () {
        const preset = PRESETS[name];
        Object.keys(preset).forEach(function (key) { quoteState[key] = preset[key]; });
        onInput();
      });
    });
    $("board-off").addEventListener("click", function () { harborState.onBoard = false; onInput(); });
    $("board-on").addEventListener("click", function () { harborState.onBoard = true; onInput(); });
    $("pay-off").addEventListener("click", function () { harborState.payListed = false; onInput(); });
    $("pay-on").addEventListener("click", function () { harborState.payListed = true; onInput(); });
    $("duties-vague").addEventListener("click", function () { harborState.concrete = false; onInput(); });
    $("duties-concrete").addEventListener("click", function () { harborState.concrete = true; onInput(); });
    $("owner-team").addEventListener("click", function () { harborState.namedOwner = false; onInput(); });
    $("owner-named").addEventListener("click", function () { harborState.namedOwner = true; onInput(); });
    $("require-pay").addEventListener("click", function () {
      harborState.requirePay = !harborState.requirePay;
      onInput();
    });
    $("preset-brokerage").addEventListener("click", function () {
      harborState.onBoard = false;
      harborState.payListed = false;
      harborState.concrete = false;
      harborState.namedOwner = false;
      onInput();
    });
    $("preset-ready").addEventListener("click", function () {
      harborState.onBoard = true;
      harborState.payListed = true;
      harborState.concrete = true;
      harborState.namedOwner = true;
      onInput();
    });
    $("play").addEventListener("click", play);
    $("find-harbor").addEventListener("click", function () {
      const card = document.querySelector("[data-harbor='true']");
      if (!card) return;
      card.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
    });
  }

  bind();
  paintFinal();
})();
