(function () {
  const Cash = globalThis.CashApp;
  const $ = (id) => document.getElementById(id);

  const state = {
    stage: "autonomous",
    approvals: {},
    notes: [],
    shortPay: true,
    loose: false,
  };

  function policyFromForm() {
    return {
      feeToleranceCents: Number($("fee").value) * 100,
      approvalLimitCents: Number($("limit").value) * 100,
      shortPayToCollections: state.shortPay,
      looseDomainCheck: state.loose,
      approvedDomains: $("domains").value.split(/\n+/).map((line) => line.trim().toLowerCase()).filter(Boolean),
    };
  }

  function syncReadouts() {
    const fee = Number($("fee").value);
    const limit = Number($("limit").value);
    $("fee-readout").textContent = Cash.formatMoney(fee * 100);
    $("limit-readout").textContent = Cash.formatMoney(limit * 100);
    $("fee").setAttribute("aria-valuenow", String(fee));
    $("fee").setAttribute("aria-valuetext", fee + " dollars");
    $("limit").setAttribute("aria-valuenow", String(limit));
    $("limit").setAttribute("aria-valuetext", limit + " dollars");
  }

  function setStage(stage) {
    state.stage = stage;
    ["observe", "propose", "autonomous"].forEach((name) => {
      $("stage-" + name).setAttribute("aria-pressed", name === stage ? "true" : "false");
    });
  }

  function setShort(toCollections) {
    state.shortPay = toCollections;
    $("short-collections").setAttribute("aria-pressed", toCollections ? "true" : "false");
    $("short-hold").setAttribute("aria-pressed", toCollections ? "false" : "true");
  }

  function setLoose(on) {
    state.loose = on;
    $("loose").setAttribute("aria-pressed", on ? "true" : "false");
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function badgeClass(row) {
    if (row.warning || row.kind === "lookalike_fooled") return "bad";
    if (row.queue === "posted" || row.state === "applied") return "posted";
    if (row.queue === "approval" || row.bucket === "approval" || row.state === "proposed") return "approval";
    if (row.queue === "collections" || row.queue === "exception" || row.bucket === "flag") return "flag";
    return "proposal";
  }

  function cardClass(row) {
    if (row.warning || row.kind === "lookalike_fooled") return "bad";
    if (row.executed && !row.warning) return "posted";
    if (row.bucket === "approval" || row.state === "waiting") return "approval";
    if (row.bucket === "flag") return "flag";
    return "";
  }

  function showButtons(row) {
    if (state.stage === "observe") return false;
    if (row.state === "proposed") return true;
    if (state.stage === "autonomous" && (row.state === "waiting" || row.state === "exception" || row.state === "escalated")) return true;
    return false;
  }

  function renderDecisions(result) {
    $("decisions").innerHTML = result.decisions.map((row) => {
      const buttons = showButtons(row)
        ? '<div class="actions"><button type="button" class="approve" data-act="approved" data-id="' + esc(row.paymentId) + '">Approve</button><button type="button" class="reject" data-act="rejected" data-id="' + esc(row.paymentId) + '">Reject</button></div>'
        : "";
      return '<article class="decision ' + cardClass(row) + '" id="decision-' + esc(row.paymentId) + '">' +
        '<div class="decision-top"><h3>' + esc(row.paymentId) + " · " + esc(row.payer) + '</h3>' +
        '<span class="badge ' + badgeClass(row) + '">' + esc(row.badge) + "</span></div>" +
        '<p class="money">' + esc(Cash.formatMoney(row.amountCents)) + "</p>" +
        "<p>" + esc(row.recommendation) + "</p>" +
        '<p class="outcome">' + esc(row.outcome) + "</p>" +
        buttons +
        "</article>";
    }).join("");
  }

  function renderBooks(result) {
    const open = result.books.filter((row) => row.state !== "cleared").length;
    $("books-hint").textContent = open + " still open of " + result.books.length + " invoices after this run.";
    $("invoices").innerHTML = result.books.map((row) => {
      const pill = row.state === "cleared" ? "Cleared" : row.state === "partial" ? "Partial" : "Open";
      const pillClass = row.state === "cleared" ? "pill" : row.state === "partial" ? "pill bad" : "pill open";
      let extra = row.label + " · due " + Cash.formatDate(row.due);
      if (row.state === "cleared") {
        extra += " · " + row.paymentId;
        if (row.writeOffCents) extra += " · includes a " + Cash.formatMoney(row.writeOffCents) + " write-off";
      } else if (row.state === "partial") {
        extra += " · " + Cash.formatMoney(row.paidCents) + " posted · " + Cash.formatMoney(row.remainingCents) + " still open";
      }
      return '<article class="record"><div class="record-top"><span class="who">' + esc(row.id) + " · " + esc(Cash.formatMoney(row.amountCents)) + '</span><span class="' + pillClass + '">' + pill + "</span></div>" +
        '<p class="meta">' + esc(row.customer) + "</p>" +
        '<p class="meta">' + esc(extra) + "</p></article>";
    }).join("");
  }

  function renderFeed(result) {
    const byId = {};
    result.decisions.forEach((row) => { byId[row.paymentId] = row; });
    $("feed").innerHTML = Cash.PAYMENTS.map((payment) => {
      const row = byId[payment.id];
      const badge = row ? '<span class="badge ' + badgeClass(row) + '">' + esc(row.badge) + "</span>" : "";
      return '<article class="record"><div class="record-top"><span class="who">' + esc(payment.payer) + "</span>" + badge + "</div>" +
        '<p class="money">' + esc(Cash.formatMoney(payment.amountCents)) + "</p>" +
        '<p class="meta">' + esc(payment.id) + " · " + esc(payment.memo) + "</p>" +
        '<p class="meta">' + esc(payment.sender) + "</p></article>";
    }).join("");
  }

  function renderInbox(policy) {
    $("inbox").innerHTML = Cash.EMAILS.map((email) => {
      const sender = Cash.classifySender(email.from, policy, Cash.CUSTOMERS);
      let pill = "Approved domain";
      let pillClass = "pill";
      let card = "mail";
      if (sender.kind === "lookalike" && sender.loosePass) {
        pill = "Loose check accepts";
        pillClass = "pill bad";
        card = "mail bad";
      } else if (sender.kind === "lookalike") {
        pill = "Not approved";
        pillClass = "pill bad";
        card = "mail bad";
      } else if (sender.kind !== "trusted") {
        pill = "Not on the list";
        pillClass = "pill open";
      }
      return '<article class="' + card + '"><div class="mail-top"><span class="who">' + esc(email.subject) + '</span><span class="' + pillClass + '">' + esc(pill) + "</span></div>" +
        '<p class="meta">' + esc(email.from) + "</p>" +
        "<p>" + esc(email.body) + "</p></article>";
    }).join("");
  }

  function renderAudit(result) {
    const lines = result.audit.concat(state.notes);
    $("log").innerHTML = lines.map((line) => "<li>" + esc(line) + "</li>").join("");
  }

  function render() {
    syncReadouts();
    const result = Cash.runCashApp({
      stage: state.stage,
      policy: policyFromForm(),
      approvals: state.approvals,
    });
    $("stage-blurb").textContent = result.blurb;
    $("count-applied").textContent = String(result.summary.autoApplied);
    $("count-approval").textContent = String(result.summary.needsApproval);
    $("count-flagged").textContent = String(result.summary.flagged);
    $("count-minutes").textContent = String(result.summary.minutesSaved);
    $("minutes-caption").textContent = result.caption;
    const banner = $("banner");
    if (result.banner) {
      banner.hidden = false;
      banner.textContent = result.banner;
      banner.className = result.decisions.some((row) => row.kind === "lookalike_fooled") ? "banner" : "banner ok";
    } else {
      banner.hidden = true;
      banner.textContent = "";
    }
    renderDecisions(result);
    renderBooks(result);
    renderFeed(result);
    renderInbox(result.policy);
    renderAudit(result);
    $("live").textContent = result.live;
  }

  function manualChanged(note) {
    state.approvals = {};
    state.notes = [note];
    render();
  }

  document.querySelectorAll(".stages button").forEach((button) => {
    button.addEventListener("click", () => {
      setStage(button.getAttribute("data-stage"));
      state.approvals = {};
      state.notes = ["Switched the onboarding stage. Ran the feed again."];
      render();
    });
  });

  $("fee").addEventListener("input", () => manualChanged("Updated the bank-fee tolerance. Ran the feed again."));
  $("limit").addEventListener("input", () => manualChanged("Updated the approval limit. Ran the feed again."));
  $("domains").addEventListener("input", () => manualChanged("Updated the approved domains. Ran the feed again."));

  $("short-collections").addEventListener("click", () => {
    setShort(true);
    manualChanged("Short pays go to collections. Ran the feed again.");
  });
  $("short-hold").addEventListener("click", () => {
    setShort(false);
    manualChanged("Short pays wait for a person. Ran the feed again.");
  });
  $("loose").addEventListener("click", () => {
    setLoose(!state.loose);
    manualChanged(state.loose
      ? "Turned on loose domain check. Ran the feed again."
      : "Turned off loose domain check. Ran the feed again.");
  });

  $("run").addEventListener("click", () => {
    state.approvals = {};
    state.notes = ["Ran the morning feed again."];
    render();
    const first = document.querySelector(".decision");
    if (first) first.scrollIntoView({ block: "nearest" });
  });

  $("reset").addEventListener("click", () => {
    $("fee").value = "25";
    $("limit").value = "100";
    $("domains").value = Cash.CUSTOMERS.map((customer) => customer.domains[0]).join("\n");
    setStage("autonomous");
    setShort(true);
    setLoose(false);
    state.approvals = {};
    state.notes = ["Reset the manual to the morning defaults."];
    render();
  });

  $("decisions").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-act]");
    if (!button) return;
    const id = button.getAttribute("data-id");
    const act = button.getAttribute("data-act");
    state.approvals[id] = act;
    state.notes.push(act === "approved" ? "You approved " + id + "." : "You rejected " + id + ".");
    render();
  });

  setStage("autonomous");
  setShort(true);
  setLoose(false);
  render();
})();
