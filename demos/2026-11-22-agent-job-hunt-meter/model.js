// Illustrative simulation of a jobs-API hunt.
// Harbor & Pine Realty, Jordan Hale, and every other firm and person are fictional.
// Pay figures and fit numbers were written for this page.
(function () {
  "use strict";

  const FIRM = "Harbor & Pine Realty";
  const ROLE = "Transaction Coordinator";
  const CANDIDATE = {
    name: "Jordan Hale",
    place: "Portland",
    years: 6,
    targetMin: 62000,
    targetMax: 74000,
  };
  const OWNER = { name: "Naomi Pell", role: "Designated Broker" };

  const POST = {
    name: "Treg",
    handle: "treg_ai",
    url: "https://x.com/treg_ai/status/2122647673056735318",
    date: "17 Nov 2026",
    site: "https://treg.to/jobs-api",
  };

  // Jobs-api card on treg.to. Label these as of Nov 22, 2026; they may change.
  const CARD = {
    searchMicro: 1500,
    freshMicro: 2000,
    closedMicro: 0,
    percentileMicro: 10000,
    benchmarkMicro: 250000,
    starterMicro: 1000000,
    asOf: "Nov 22, 2026",
    rateLabel: "Rates listed on treg.to as of Nov 22, 2026; may change.",
  };

  // People catalog, not the jobs-api card. people.search is listed free.
  // Routed treg.people.email.find is listed at $0.00095 per success.
  const CATALOG = {
    peopleSearchMicro: 0,
    emailMicro: 950,
  };

  // Invented so the resume slider moves the bill. Not a Jev price.
  const ILLUSTRATIVE = {
    usdPerMillion: 0.5,
    postingTokens: 320,
    label: "Illustrative price invented for this page. Not a Jev price.",
  };

  const FIT = { concrete: 90, vague: 41 };
  const QUERIED_BOARDS = ["greenhouse", "lever", "ashby"];

  const DEFAULT_QUOTE = {
    roles: 20,
    fresh: 0,
    managers: 3,
    resumeTokens: 800,
    percentile: true,
    benchmark: false,
  };

  const DEFAULT_HARBOR = {
    onBoard: false,
    payListed: false,
    concrete: false,
    namedOwner: false,
    requirePay: true,
  };

  const JOBS = [
    job("northwharf", "Northwharf Homes", "Transaction Coordinator", "greenhouse", 64000, 76000, true, "Elena Voss", "Managing Broker", 93, false),
    job("cedar", "Cedar Row Brokerage", "Closing Coordinator", "lever", 60000, 70000, true, "Marcus Ell", "Principal Broker", 88, false),
    job("lantern", "Lantern Title & Escrow", "Escrow Coordinator", "ashby", 58000, 69000, true, "Priya Shah", "Escrow Manager", 84, false),
    job("brightlot", "Brightlot Property Group", "Transaction Coordinator", "greenhouse", 66000, 80000, true, null, null, 80, false),
    job("oakmouth", "Oakmouth Realty Collective", "Transaction Coordinator", "lever", 61000, 73000, true, "Helen Cho", "Team Lead", 77, false),
    job("fieldnote", "Fieldnote Property Management", "Operations Coordinator", "greenhouse", 55000, 68000, true, "Samir Adeyemi", "Operations Lead", 70, false),
    job("sable", "Sable & Co. Residential", "Client Care Coordinator", "ashby", 50000, 62000, false, null, null, 60, false),
    job("westpier", "Westpier Commercial", "Lease Administrator", "greenhouse", 70000, 85000, true, "Dana Ruiz", "Director of Leasing", 52, false),
    job("paperlane", "Paperlane Mortgage", "Loan Processor", "lever", 52000, 64000, true, null, null, 46, false),
    job("pinion", "Pinion Surveying", "Field Coordinator", "ashby", 48000, 60000, true, "Owen Brant", "Crew Lead", 33, false),
    job("kinfolk", "Kinfolk Staging Co.", "Studio Coordinator", "greenhouse", 42000, 52000, false, null, null, 29, false),
    job("marlowe", "Marlowe Bookshop", "Shop Coordinator", "lever", 38000, 46000, false, "Nia Okonkwo", "Owner", 21, false),
    job("redline", "Redline Bicycle Co.", "Workshop Coordinator", "ashby", 40000, 50000, false, null, null, 17, false),
    job("glassharbor", "Glassharbor Aquarium", "Guest Experience Coordinator", "greenhouse", 36000, 44000, false, "Theo March", "Guest Programs Lead", 14, false),
    job("goldthread", "Goldthread Realty", "Transaction Coordinator", "greenhouse", null, null, true, "Ruth Abel", "Broker", 86, false),
    job("milemarker", "Milemarker Estates", "Closing Specialist", "lever", null, null, true, null, null, 73, false),
    job("driftwood", "Driftwood Realty", "Transaction Coordinator", "site", 63000, 74000, true, "Imani Brooks", "Managing Broker", 89, false),
    job("lumen", "Lumen House Real Estate", "Transaction Coordinator", "facebook", 60000, 72000, true, null, null, 82, false),
    job("saltline", "Saltline Realty", "Transaction Coordinator", "greenhouse", 62000, 71000, true, "Chris Adel", "Broker", 75, true),
    job("pebble", "Pebble Street Realty", "Transaction Coordinator", "lever", 59000, 70000, true, null, null, 68, true),
  ];

  function job(id, employer, title, board, payMin, payMax, concrete, ownerName, ownerRole, fit, closed) {
    return {
      id: id,
      employer: employer,
      title: title,
      board: board,
      payMin: payMin,
      payMax: payMax,
      concrete: concrete,
      ownerName: ownerName,
      ownerRole: ownerRole,
      fit: fit,
      closed: closed,
      harbor: false,
    };
  }

  function clampInt(value, min, max) {
    const n = Number(value);
    if (!isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function onQueryableBoard(board) {
    return QUERIED_BOARDS.indexOf(board) !== -1;
  }

  function boardLabel(board) {
    if (board === "greenhouse") return "Greenhouse";
    if (board === "lever") return "Lever";
    if (board === "ashby") return "Ashby";
    if (board === "site") return "Own site";
    if (board === "facebook") return "Facebook";
    if (board === "own") return "Own site and Facebook";
    return "Unlisted";
  }

function groupInt(n) {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function dollars(n) {
  return "$" + groupInt(n);
}

  function payLabel(row) {
    if (row.payMin == null || row.payMax == null) return "No pay range";
    return dollars(row.payMin) + "–" + dollars(row.payMax);
  }

  function ownerLabel(row) {
    if (!row.ownerName) return "Recruiting team";
    return row.ownerName + ", " + row.ownerRole;
  }

  function payOverlap(row) {
    if (row.payMin == null || row.payMax == null) return "none";
    if (row.payMax < CANDIDATE.targetMin || row.payMin > CANDIDATE.targetMax) return "outside";
    return "overlaps";
  }

  function overlapLabel(row) {
    const kind = payOverlap(row);
    if (kind === "none") return "No pay range";
    if (kind === "outside") return "Listed pay sits outside Jordan's $62,000 to $74,000 target";
    return "Listed pay overlaps Jordan's $62,000 to $74,000 target";
  }

  function formatMicro(micro) {
    const sign = micro < 0 ? "-" : "";
    const abs = Math.abs(Math.round(micro));
    const whole = Math.floor(abs / 1000000);
    let frac = String(abs % 1000000);
    frac = ("000000" + frac).slice(-6).replace(/0+$/, "");
    if (frac.length === 0) frac = "00";
    else if (frac.length === 1) frac = frac + "0";
    return sign + "$" + whole + "." + frac;
  }

  function quote(input) {
    const src = input || {};
    const roles = clampInt(src.roles, 0, 4000);
    const fresh = clampInt(src.fresh, 0, 4000);
    const resumeTokens = clampInt(src.resumeTokens, 200, 8000);
    const managersAsked = clampInt(src.managers, 0, 12);
    const managers = Math.min(managersAsked, roles);
    const percentile = Boolean(src.percentile);
    const benchmark = Boolean(src.benchmark);
    const inputTokens = roles * (resumeTokens + ILLUSTRATIVE.postingTokens);
    const fitMicro = Math.round(inputTokens * ILLUSTRATIVE.usdPerMillion);
    const lines = [
      { id: "search", label: "Job search", detail: roles + " × $0.0015", micro: roles * CARD.searchMicro, source: "card" },
      { id: "fresh", label: "New roles since last check", detail: fresh + " × $0.002", micro: fresh * CARD.freshMicro, source: "card" },
      { id: "closed", label: "Closed roles", detail: "2 in this fictional set, listed free", micro: 0, source: "card" },
      { id: "fit", label: "Jev fit score", detail: groupInt(inputTokens) + " input tokens at an illustrative $0.50 per 1,000,000", micro: fitMicro, source: "illustrative" },
      { id: "people", label: "Hiring-manager search", detail: managers + " × people.search, listed free", micro: 0, source: "catalog" },
      { id: "email", label: "Hiring-manager email", detail: managers + " × $0.00095, assuming each lookup succeeds", micro: managers * CATALOG.emailMicro, source: "catalog" },
      { id: "pitch", label: "Pitch notes", detail: "The agent writes these. The jobs-api card has no price for the writing.", micro: 0, source: "agent" },
      { id: "percentile", label: "Salary percentiles", detail: percentile ? "1 × $0.01" : "Not run", micro: percentile ? CARD.percentileMicro : 0, source: "card" },
      { id: "benchmark", label: "Full salary benchmark report", detail: benchmark ? "1 × $0.25" : "Not run", micro: benchmark ? CARD.benchmarkMicro : 0, source: "card" },
    ];
    let totalMicro = 0;
    for (let i = 0; i < lines.length; i++) totalMicro += lines[i].micro;
    return {
      roles: roles,
      fresh: fresh,
      resumeTokens: resumeTokens,
      managersAsked: managersAsked,
      managers: managers,
      percentile: percentile,
      benchmark: benchmark,
      inputTokens: inputTokens,
      lines: lines,
      totalMicro: totalMicro,
    };
  }

  function lineById(q, id) {
    for (let i = 0; i < q.lines.length; i++) {
      if (q.lines[i].id === id) return q.lines[i];
    }
    return null;
  }

  function dominantLine(q) {
    let best = null;
    for (let i = 0; i < q.lines.length; i++) {
      const line = q.lines[i];
      if (line.micro > 0 && (!best || line.micro > best.micro)) best = line;
    }
    return best;
  }

  function present(q, shown) {
    if (!shown) return q;
    const lines = q.lines.map(function (line) {
      const copy = {
        id: line.id,
        label: line.label,
        detail: line.detail,
        micro: Object.prototype.hasOwnProperty.call(shown, line.id) ? shown[line.id] : line.micro,
        source: line.source,
      };
      return copy;
    });
    let totalMicro = 0;
    for (let i = 0; i < lines.length; i++) totalMicro += lines[i].micro;
    return {
      roles: q.roles,
      fresh: q.fresh,
      resumeTokens: q.resumeTokens,
      managersAsked: q.managersAsked,
      managers: q.managers,
      percentile: q.percentile,
      benchmark: q.benchmark,
      inputTokens: q.inputTokens,
      lines: lines,
      totalMicro: totalMicro,
    };
  }

  function lesson(q) {
    const scale = "167 searches at $0.0015 cost $0.2505, just over one $0.25 report. 2,000 searches cost $3.00.";
    if (q.totalMicro <= 0) return "An empty page costs nothing. " + scale;
    const top = dominantLine(q);
    const search = lineById(q, "search");
    let lead;
    if (top.id === "benchmark") {
      lead = "The full salary benchmark report is the largest line, at " + formatMicro(top.micro) + ". Job search on this run is " + formatMicro(search.micro) + ".";
    } else if (top.id === "search") {
      lead = "Job search is the largest line, at " + formatMicro(search.micro) + " for " + q.roles + " roles.";
    } else if (top.id === "fit") {
      lead = "Fit scoring is the largest line, at " + formatMicro(top.micro) + ". That uses this page's illustrative token price.";
    } else {
      lead = top.label + " is the largest line, at " + formatMicro(top.micro) + ".";
    }
    const bench = lineById(q, "benchmark");
    let tail;
    if (bench.micro > 0) {
      tail = "The benchmark report is on, so this run is no longer a few cents.";
    } else if (q.totalMicro <= 100000) {
      tail = "With the benchmark report off, this run is " + formatMicro(q.totalMicro) + ", a few cents.";
    } else {
      tail = "With the benchmark report off, this run is " + formatMicro(q.totalMicro) + ". The per-job rate adds up once the role count gets large.";
    }
    return lead + " " + tail + " " + scale;
  }

  function creditLine(totalMicro) {
    if (totalMicro <= 0) return "The $1.00 a new team starts with is untouched.";
    if (totalMicro <= CARD.starterMicro) {
      return "This run is " + formatMicro(totalMicro) + ", inside the $1.00 a new team starts with.";
    }
    return "This run is " + formatMicro(totalMicro) + ", past the $1.00 a new team starts with.";
  }

  function harborRecord(options) {
    const opts = options || {};
    const concrete = Boolean(opts.concrete);
    const named = Boolean(opts.namedOwner);
    const onBoard = Boolean(opts.onBoard);
    const payListed = Boolean(opts.payListed);
    return {
      id: "harbor",
      employer: FIRM,
      title: ROLE,
      board: onBoard ? "greenhouse" : "own",
      payMin: payListed ? 63000 : null,
      payMax: payListed ? 72000 : null,
      concrete: concrete,
      ownerName: named ? OWNER.name : null,
      ownerRole: named ? OWNER.role : null,
      fit: concrete ? FIT.concrete : FIT.vague,
      closed: false,
      harbor: true,
      blurb: concrete
        ? "Open escrow, track contract dates, update MLS status, prepare commission disbursements, and keep the compliance file."
        : "Rockstar ninja. Own the journey. Live the culture. Delight every stakeholder.",
    };
  }

  function copyJob(row) {
    return {
      id: row.id,
      employer: row.employer,
      title: row.title,
      board: row.board,
      payMin: row.payMin,
      payMax: row.payMax,
      concrete: row.concrete,
      ownerName: row.ownerName,
      ownerRole: row.ownerRole,
      fit: row.fit,
      closed: row.closed,
      harbor: row.harbor,
      blurb: row.blurb || "",
    };
  }

  function evaluate(options) {
    const opts = Object.assign({}, DEFAULT_HARBOR, options || {});
    const harbor = harborRecord(opts);
    const universe = JOBS.map(copyJob);
    universe.push(harbor);
    const closed = [];
    const offBoard = [];
    const onBoard = [];
    for (let i = 0; i < universe.length; i++) {
      const row = universe[i];
      if (row.closed) closed.push(row);
      else if (!onQueryableBoard(row.board)) offBoard.push(row);
      else onBoard.push(row);
    }
    const requirePay = Boolean(opts.requirePay);
    const droppedPay = [];
    const visible = [];
    for (let i = 0; i < onBoard.length; i++) {
      const row = onBoard[i];
      if (requirePay && (row.payMin == null || row.payMax == null)) droppedPay.push(row);
      else visible.push(row);
    }
    visible.sort(function (a, b) {
      if (b.fit !== a.fit) return b.fit - a.fit;
      if (a.employer < b.employer) return -1;
      if (a.employer > b.employer) return 1;
      return 0;
    });
    for (let i = 0; i < visible.length; i++) visible[i].rank = i + 1;
    return {
      harbor: harbor,
      requirePay: requirePay,
      visible: visible,
      droppedPay: droppedPay,
      offBoard: offBoard,
      closed: closed,
      universe: universe.length,
      saysSkipped: false,
    };
  }

  function placement(report) {
    const harbor = report.harbor;
    const total = report.visible.length;
    if (!onQueryableBoard(harbor.board)) {
      return {
        state: "invisible",
        rank: null,
        total: total,
        text: "Harbor & Pine Realty is on its own site and Facebook. This sketch's agent queries Greenhouse, Lever, and Ashby. The posting has no rank. The agent's list does not say it was skipped.",
      };
    }
    let dropped = false;
    for (let i = 0; i < report.droppedPay.length; i++) {
      if (report.droppedPay[i].id === "harbor") dropped = true;
    }
    if (dropped) {
      return {
        state: "dropped",
        rank: null,
        total: total,
        text: "Harbor & Pine Realty is on Greenhouse and lists no pay range. The pay filter is on, so the posting has no rank. The agent's list does not say it was skipped.",
      };
    }
    let rank = null;
    for (let i = 0; i < report.visible.length; i++) {
      if (report.visible[i].id === "harbor") rank = report.visible[i].rank;
    }
    const who = harbor.ownerName ? ownerLabel(harbor) : "the recruiting team";
    return {
      state: "ranked",
      rank: rank,
      total: total,
      text: "Harbor & Pine Realty is #" + rank + " of " + total + ". The pitch is addressed to " + who + ".",
    };
  }

  function missedLeader(report) {
    const pool = report.offBoard.concat(report.droppedPay);
    let best = null;
    for (let i = 0; i < pool.length; i++) {
      if (!best || pool[i].fit > best.fit) best = pool[i];
    }
    if (!best) return null;
    return {
      employer: best.employer,
      fit: best.fit,
      board: boardLabel(best.board),
      text: "Highest sketch fit the agent did not return: " + best.employer + " at " + best.fit + ". " + boardLabel(best.board) + ". The agent's list does not say it was skipped.",
    };
  }

  function pitchFor(row) {
    const named = Boolean(row.ownerName);
    const to = named ? ownerLabel(row) + " · " + row.employer : "Recruiting team · " + row.employer;
    const subject = row.title + " — " + CANDIDATE.name;
    let body;
    if (row.id === "harbor" && row.concrete && named) {
      body = "Hi Naomi — the post names escrow dates, the contract-to-close checklist, and commission files. I do that work on a residential desk in Portland.";
    } else if (!named && row.concrete) {
      body = "The post lists concrete duties, and it does not name the person who owns the role. This note goes to the recruiting team.";
    } else if (!named) {
      body = "The post does not name the person who owns the role, and the wording stays vague. This note goes to the recruiting team.";
    } else if (row.concrete) {
      body = "Hi " + row.ownerName.split(" ")[0] + " — I matched the duties on this " + row.title + " post to the closing work I do in Portland.";
    } else {
      body = "Hi " + row.ownerName.split(" ")[0] + " — the post asks for a rockstar who owns the journey. It names no task I can quote.";
    }
    return { to: to, subject: subject, body: body };
  }

  function shownMicros(q, view) {
    const full = {};
    for (let i = 0; i < q.lines.length; i++) full[q.lines[i].id] = q.lines[i].micro;
    if (!view || !view.playing) return full;
    const progress = view.phase === 1 ? view.progress : 1;
    const early = view.phase === 1 ? view.progress : 1;
    return {
      search: Math.round(full.search * early),
      fresh: Math.round(full.fresh * early),
      closed: 0,
      fit: view.phase > 1 || progress === 1 ? full.fit : 0,
      people: 0,
      email: view.phase >= 2 ? full.email : 0,
      pitch: 0,
      percentile: view.phase >= 4 ? full.percentile : 0,
      benchmark: view.phase >= 4 ? full.benchmark : 0,
    };
  }

  globalThis.JobHuntMeter = {
    FIRM: FIRM,
    ROLE: ROLE,
    CANDIDATE: CANDIDATE,
    OWNER: OWNER,
    POST: POST,
    CARD: CARD,
    CATALOG: CATALOG,
    ILLUSTRATIVE: ILLUSTRATIVE,
    FIT: FIT,
    QUERIED_BOARDS: QUERIED_BOARDS,
    DEFAULT_QUOTE: DEFAULT_QUOTE,
    DEFAULT_HARBOR: DEFAULT_HARBOR,
    JOBS: JOBS,
    onQueryableBoard: onQueryableBoard,
    boardLabel: boardLabel,
    dollars: dollars,
    payLabel: payLabel,
    ownerLabel: ownerLabel,
    payOverlap: payOverlap,
    overlapLabel: overlapLabel,
    formatMicro: formatMicro,
    quote: quote,
    lineById: lineById,
    dominantLine: dominantLine,
    present: present,
    lesson: lesson,
    creditLine: creditLine,
    evaluate: evaluate,
    placement: placement,
    missedLeader: missedLeader,
    pitchFor: pitchFor,
    shownMicros: shownMicros,
    FOOTER: "Illustrative simulation. Harbor & Pine Realty, its people and postings are fictional. Rates as listed on treg.to on Nov 22, 2026.",
  };
})();
