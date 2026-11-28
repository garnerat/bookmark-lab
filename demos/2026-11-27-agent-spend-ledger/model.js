// Illustrative simulation of an agent-spend ledger for Tallgrass Studio.
// The studio, the clients, the people, the logs, and the dollar figures are fictional.
// Similarity scores are prepared. Nothing here calls a model or a network.
// Source thread: https://x.com/clairevo/status/2108364438642507817
(function () {
  "use strict";

  var STUDIO = "Tallgrass Studio";
  var SOURCE = "https://x.com/clairevo/status/2108364438642507817";

  var LINES = [
    { id: "bakery", name: "Hearth & Rye Bakery", short: "Bakery rebuild", client: true },
    { id: "soccer", name: "Riverbend Youth Soccer", short: "Soccer site", client: true },
    { id: "law", name: "Keller & Moss Law", short: "Law blog", client: true },
    { id: "sales", name: "Sales / proposals", short: "Sales", client: false },
    { id: "admin", name: "Internal admin", short: "Admin", client: false }
  ];

  var LINE_BY_ID = {};
  LINES.forEach(function (line) { LINE_BY_ID[line.id] = line; });

  var WEEKS = [
    { id: 1, label: "Oct 5", month: "October", monthKey: "oct" },
    { id: 2, label: "Oct 12", month: "October", monthKey: "oct" },
    { id: 3, label: "Oct 19", month: "October", monthKey: "oct" },
    { id: 4, label: "Oct 26", month: "October", monthKey: "oct" },
    { id: 5, label: "Nov 2", month: "November", monthKey: "nov" },
    { id: 6, label: "Nov 9", month: "November", monthKey: "nov" },
    { id: 7, label: "Nov 16", month: "November", monthKey: "nov" },
    { id: 8, label: "Nov 23", month: "November", monthKey: "nov" }
  ];

  var WEEK_BY_ID = {};
  WEEKS.forEach(function (week) { WEEK_BY_ID[week.id] = week; });

  // Rates are round stand-ins in cents per million tokens, not a vendor price card.
  var MODELS = {
    composer: { id: "composer", name: "Composer", tool: "cursor", pool: "cursor", billing: "seat", inRate: 1500, outRate: 7500 },
    sonnet: { id: "sonnet", name: "Sonnet", tool: "claude", pool: "claude", billing: "seat", inRate: 1500, outRate: 7500 },
    haiku: { id: "haiku", name: "Haiku", tool: "claude", pool: "claude", billing: "seat", inRate: 100, outRate: 500 },
    codex: { id: "codex", name: "Codex", tool: "codex", pool: "", billing: "api", inRate: 200, outRate: 1000 },
    draft: { id: "draft", name: "Draft small", tool: "draft", pool: "", billing: "api", inRate: 200, outRate: 800 }
  };

  var TOOLS = {
    cursor: { id: "cursor", name: "Cursor", billing: "Two seats, flat" },
    claude: { id: "claude", name: "Claude Code", billing: "Two seats, flat" },
    codex: { id: "codex", name: "Codex", billing: "Pay as you go" },
    draft: { id: "draft", name: "Draft desk", billing: "Pay as you go" }
  };

  var POOLS = {
    cursor: { id: "cursor", cents: 16000, label: "Cursor seats" },
    claude: { id: "claude", cents: 20000, label: "Claude seats" }
  };

  var PRESETS = {
    recommended: { threshold: 720, judge: true },
    loose: { threshold: 500, judge: false },
    strict: { threshold: 920, judge: true }
  };

  var THRESHOLD = { min: 400, max: 950, step: 10, def: 720 };

  var PERSON = {
    composer: "Owen",
    sonnet: "Priya",
    haiku: "Priya",
    codex: "Luis",
    draft: "Maya"
  };

  function row(model, minutes, inTok, outTok, title, mark) {
    return { model: model, minutes: minutes, inTok: inTok, outTok: outTok, title: title, mark: mark || "" };
  }

  var THEMES = [
    {
      id: "bakery-order",
      line: "bakery",
      name: "Hearth & Rye ordering",
      repo: "hearth-rye-web",
      linked: 3,
      prs: [
        "Add the rye preorder cart",
        "Pickup slots respect Saturday close",
        "Confirmation email for a loaf order",
        "Gift-card field on a phone",
        "Wholesale form goes to the studio",
        "Allergen line under the rye loaf"
      ],
      sessions: [
        row("composer", 28, 1200000, 240000, "Rye loaf preorder cart"),
        row("composer", 32, 1000000, 200000, "Pickup slots for Saturday bread"),
        row("composer", 26, 1400000, 200000, "Order confirmation email"),
        row("composer", 30, 800000, 280000, "Gift-card amount on the bun order"),
        row("composer", 34, 1100000, 220000, "Wholesale inquiry form"),
        row("composer", 24, 900000, 240000, "Mobile cart drawer"),
        row("composer", 36, 1300000, 160000, "Sold-out state for the morning loaf"),
        row("composer", 29, 1200000, 160000, "Allergen note under the rye"),
        row("codex", 20, 300000, 40000, "Online preorder form and a payment receipt", "form-bakery"),
        row("codex", 16, 300000, 40000, "Second pass on the slot picker")
      ]
    },
    {
      id: "bakery-home",
      line: "bakery",
      name: "Hearth & Rye homepage",
      repo: "hearth-rye-web",
      linked: 2,
      prs: [
        "Rewrite the homepage hero",
        "Holiday hours banner",
        "Saturday stall map in the footer",
        "Sticky order button on phones"
      ],
      sessions: [
        row("sonnet", 48, 600000, 120000, "Rewrite the about page and the visit-us block", "about-bakery"),
        row("sonnet", 52, 700000, 120000, "Homepage hero for Saturday bread"),
        row("composer", 27, 1200000, 240000, "Photo grid on the homepage"),
        row("composer", 31, 1000000, 240000, "Hours and the holiday banner"),
        row("composer", 25, 1100000, 200000, "Footer map for the Saturday stall"),
        row("composer", 33, 900000, 280000, "Sticky order button on phones")
      ]
    },
    {
      id: "bakery-photo",
      line: "bakery",
      name: "Hearth & Rye photo pages",
      repo: "hearth-rye-web",
      linked: 1,
      prs: [
        "Loaf gallery with alt text",
        "Miller story photo page",
        "Staff portraits, cropped"
      ],
      sessions: [
        row("sonnet", 70, 600000, 120000, "Loaf gallery captions"),
        row("sonnet", 64, 500000, 160000, "Behind-the-counter photo page"),
        row("sonnet", 78, 600000, 80000, "Saturday stall photo set"),
        row("sonnet", 72, 400000, 160000, "Staff portrait crop and alt text")
      ]
    },
    {
      id: "soccer-reg",
      line: "soccer",
      name: "Soccer registration",
      repo: "riverbend-soccer",
      linked: 2,
      prs: [
        "Registration form for fall",
        "Age-group fee table",
        "Waiver in plain language",
        "Waitlist when a team is full"
      ],
      sessions: [
        row("haiku", 112, 400000, 40000, "Fall registration form copy"),
        row("haiku", 108, 400000, 40000, "Age-group rules for signups"),
        row("haiku", 118, 500000, 40000, "Parent waiver in plain language"),
        row("haiku", 104, 400000, 40000, "Scholarship checkbox help text"),
        row("sonnet", 86, 800000, 160000, "Registration flow, front end and back end"),
        row("sonnet", 90, 800000, 160000, "Fee table for the age groups"),
        row("sonnet", 82, 700000, 160000, "Confirmation page after signup")
      ]
    },
    {
      id: "soccer-sched",
      line: "soccer",
      name: "Soccer schedule",
      repo: "riverbend-soccer",
      linked: 2,
      prs: [
        "November game dates",
        "Rainout banner",
        "U10 standings",
        "Printable schedule",
        "Coach list on the schedule page"
      ],
      sessions: [
        row("haiku", 110, 400000, 40000, "November game dates and a signup form", "dates-soccer"),
        row("haiku", 116, 400000, 40000, "Field map for Saturday games"),
        row("haiku", 102, 400000, 40000, "Rainout banner copy"),
        row("haiku", 120, 400000, 40000, "Coach list on the schedule"),
        row("sonnet", 88, 800000, 160000, "Standings table for the U10 flight"),
        row("sonnet", 84, 800000, 160000, "Practice-time footnotes"),
        row("sonnet", 92, 600000, 160000, "Schedule page empty states"),
        row("composer", 100, 400000, 80000, "Online registration form and a payment receipt", "form-soccer"),
        row("composer", 96, 400000, 80000, "Printable one-page schedule")
      ]
    },
    {
      id: "law-estate",
      line: "law",
      name: "Estate-planning posts",
      repo: "keller-moss-blog",
      linked: 2,
      prs: [
        "Estate series: what a will does",
        "Beneficiary forms, a short post",
        "Probate timeline page",
        "Witness FAQ",
        "Related posts for the estate series"
      ],
      sessions: [
        row("draft", 78, 2000000, 200000, "Rewrite the about page for the estate group", "about-law"),
        row("draft", 72, 2000000, 200000, "What a will does, in plain words"),
        row("draft", 80, 2000000, 200000, "A post on beneficiary forms"),
        row("draft", 74, 2000000, 200000, "Probate timeline for a small estate"),
        row("draft", 76, 2000000, 200000, "Who can sign as a witness"),
        row("draft", 70, 2000000, 200000, "A letter the executor can follow"),
        row("draft", 82, 2000000, 200000, "Joint accounts, a short explainer"),
        row("draft", 73, 2000000, 200000, "Updating a will after a move"),
        row("draft", 77, 2000000, 200000, "The estate-planning FAQ"),
        row("codex", 24, 400000, 80000, "Blog template for the estate series"),
        row("codex", 22, 400000, 80000, "Related-posts block")
      ]
    },
    {
      id: "law-lease",
      line: "law",
      name: "Lease-basics posts",
      repo: "keller-moss-blog",
      linked: 2,
      prs: [
        "Workshop dates in November",
        "Security deposits, a short post",
        "Renewal clause explainer"
      ],
      sessions: [
        row("draft", 80, 2000000, 200000, "November workshop dates and a signup form", "dates-law"),
        row("draft", 75, 2000000, 200000, "What a commercial lease hides in the footnotes"),
        row("draft", 69, 2000000, 200000, "Security deposits for a small shop"),
        row("draft", 83, 2000000, 200000, "The renewal clause, explained"),
        row("draft", 71, 2000000, 200000, "Who pays to repaint the office"),
        row("draft", 79, 2000000, 200000, "A checklist before you sign"),
        row("draft", 74, 2000000, 200000, "Personal guarantee, in plain words"),
        row("codex", 26, 400000, 80000, "Publish flow for the lease series")
      ]
    },
    {
      id: "sales-pitch",
      line: "sales",
      name: "Prospect proposals",
      repo: "tallgrass-proposals",
      linked: 3,
      prs: [
        "Proposal for a florist site",
        "Proposal for a dental-office refresh",
        "Proposal for a taproom menu page",
        "One-page microsite for the florist pitch",
        "Menu prototype for the taproom pitch"
      ],
      sessions: [
        row("draft", 42, 500000, 875000, "Proposal for a florist site"),
        row("draft", 38, 500000, 875000, "Proposal for a dental-office refresh"),
        row("draft", 46, 500000, 875000, "Proposal for a taproom menu page"),
        row("draft", 36, 500000, 875000, "Follow-up note after the florist call"),
        row("draft", 44, 500000, 875000, "Scope page for the dental refresh"),
        row("draft", 40, 500000, 875000, "Leave-behind for the taproom pitch"),
        row("composer", 22, 500000, 100000, "One-page microsite for the florist pitch"),
        row("composer", 24, 500000, 100000, "Menu prototype for the taproom pitch")
      ]
    },
    {
      id: "admin-bill",
      line: "admin",
      name: "Invoice and email admin",
      repo: "tallgrass-admin",
      linked: 3,
      weekEach: true,
      person: "Luis",
      prs: [
        "Invoice email template",
        "Retainer reminder copy",
        "Weekly hours sheet",
        "Domain renewal checklist",
        "Bookkeeping export labels"
      ],
      sessions: [
        row("draft", 16, 100000, 600000, "Invoice email for a finished phase"),
        row("draft", 14, 100000, 600000, "Retainer reminder, short"),
        row("draft", 18, 100000, 600000, "Expense categories for the studio"),
        row("draft", 15, 100000, 600000, "Out-of-office reply"),
        row("draft", 20, 100000, 600000, "File names for client photos"),
        row("draft", 17, 100000, 600000, "Weekly hours sheet for the four"),
        row("draft", 19, 100000, 600000, "Domain renewal checklist"),
        row("draft", 18, 100000, 600000, "Bookkeeping export labels")
      ]
    }
  ];

  var BRIDGES = [
    ["bakery-order", "bakery-home"],
    ["bakery-home", "bakery-photo"],
    ["soccer-reg", "soccer-sched"],
    ["law-estate", "law-lease"]
  ];

  var FALSE_LINKS = [
    {
      a: "about-bakery",
      b: "about-law",
      sim: 760,
      story: "lookalike",
      why: "Both titles say “rewrite the about page.” The prepared judge says they are different clients."
    },
    {
      a: "dates-law",
      b: "dates-soccer",
      sim: 620,
      story: "dates",
      why: "Both titles say “November” and “signup form.” The prepared judge says a law workshop is not a soccer schedule."
    },
    {
      a: "form-bakery",
      b: "form-soccer",
      sim: 580,
      story: "form",
      why: "Both titles say “form” and “payment receipt.” The prepared judge says a bread preorder is not league registration."
    }
  ];

  var STORY_ORDER = ["strong", "weak", "lookalike", "dates", "form"];
  var THEME_NAME = {};
  var THEME_ORDER = {};
  THEMES.forEach(function (theme, index) {
    THEME_NAME[theme.id] = theme.name;
    THEME_ORDER[theme.id] = index;
  });

  function listCents(modelId, inTok, outTok) {
    var model = MODELS[modelId];
    return Math.round((inTok * model.inRate + outTok * model.outRate) / 1000000);
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function apportion(weights, total) {
    var i;
    var sum = 0;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    var floors = [];
    if (sum <= 0 || total <= 0) {
      for (i = 0; i < weights.length; i++) floors.push(0);
      return floors;
    }
    var used = 0;
    var frac = [];
    for (i = 0; i < weights.length; i++) {
      var exact = total * weights[i] / sum;
      var base = Math.floor(exact);
      floors.push(base);
      used += base;
      frac.push({ i: i, f: exact - base, w: weights[i] });
    }
    frac.sort(function (a, b) {
      if (b.f !== a.f) return b.f - a.f;
      if (b.w !== a.w) return b.w - a.w;
      return a.i - b.i;
    });
    var left = total - used;
    if (left < 0) left = 0;
    for (i = 0; i < left; i++) floors[frac[i % frac.length].i] += 1;
    return floors;
  }

  function applyPool(sessions, poolId, poolCents) {
    var group = sessions.filter(function (session) { return session.pool === poolId; });
    var byTokens = apportion(group.map(function (session) { return session.tokens; }), poolCents);
    var byHours = apportion(group.map(function (session) { return session.minutes; }), poolCents);
    group.forEach(function (session, index) {
      session.real.tokens = byTokens[index];
      session.real.hours = byHours[index];
      session.real.marginal = 0;
    });
  }

  function build() {
    var sessions = [];
    var prs = [];
    var edges = [];
    var marks = {};
    var themeIndex = {};

    THEMES.forEach(function (theme) {
      var sids = [];
      theme.sessions.forEach(function (spec, index) {
        var model = MODELS[spec.model];
        var id = "s" + pad(sessions.length + 1);
        var week = theme.weekEach ? index + 1 : (index % 8) + 1;
        var session = {
          id: id,
          kind: "session",
          title: spec.title,
          line: theme.line,
          theme: theme.id,
          themeName: theme.name,
          week: week,
          person: theme.person || PERSON[spec.model],
          model: spec.model,
          modelName: model.name,
          tool: model.tool,
          toolName: TOOLS[model.tool].name,
          pool: model.pool,
          billing: model.billing,
          minutes: spec.minutes,
          inTok: spec.inTok,
          outTok: spec.outTok,
          tokens: spec.inTok + spec.outTok,
          listCents: listCents(spec.model, spec.inTok, spec.outTok),
          mark: spec.mark || ""
        };
        if (session.billing === "api") {
          session.real = {
            tokens: session.listCents,
            hours: session.listCents,
            marginal: session.listCents
          };
        } else {
          session.real = { tokens: 0, hours: 0, marginal: 0 };
        }
        sessions.push(session);
        sids.push(id);
        if (session.mark) marks[session.mark] = id;
      });

      var linkedIds = [];
      var weakIds = [];
      theme.prs.forEach(function (title, index) {
        var id = "p" + pad(prs.length + 1);
        var author = theme.person || (theme.line === "soccer" ? "Priya" : theme.line === "law" || theme.line === "sales" ? "Maya" : theme.line === "admin" ? "Luis" : "Owen");
        prs.push({
          id: id,
          kind: "pr",
          number: prs.length + 1,
          title: title,
          line: theme.line,
          theme: theme.id,
          themeName: theme.name,
          repo: theme.repo,
          week: (index % 8) + 1,
          person: author,
          tokens: 0,
          minutes: 0,
          listCents: 0
        });
        if (index < theme.linked) linkedIds.push(id);
        else weakIds.push(id);
      });

      var chain = [];
      var a = 0;
      var b = 0;
      while (a < sids.length || b < linkedIds.length) {
        if (a < sids.length) chain.push(sids[a]);
        a += 1;
        if (b < linkedIds.length) chain.push(linkedIds[b]);
        b += 1;
      }
      for (a = 0; a < chain.length - 1; a++) {
        edges.push({
          a: chain[a],
          b: chain[a + 1],
          sim: 900,
          same: true,
          story: "",
          why: "The titles sit in the same thread of work."
        });
      }
      if (sids.length && linkedIds.length) {
        edges.push({
          a: sids[0],
          b: linkedIds[0],
          sim: 940,
          same: true,
          story: theme.id === "bakery-order" ? "strong" : "",
          why: "A pull request and a session describe the same change. The prepared score is high."
        });
      }
      weakIds.forEach(function (id, index) {
        edges.push({
          a: sids[0],
          b: id,
          sim: 660,
          same: true,
          story: theme.id === "bakery-order" && index === 0 ? "weak" : "",
          why: "Same client, and the titles only partly match. The prepared score is 0.66."
        });
      });
      themeIndex[theme.id] = { sids: sids, line: theme.line, name: theme.name };
    });

    applyPool(sessions, "cursor", POOLS.cursor.cents);
    applyPool(sessions, "claude", POOLS.claude.cents);

    BRIDGES.forEach(function (pair) {
      var left = themeIndex[pair[0]];
      var right = themeIndex[pair[1]];
      edges.push({
        a: left.sids[left.sids.length - 1],
        b: right.sids[0],
        sim: 680,
        same: true,
        story: "",
        why: "Same client, another thread of the same job."
      });
    });

    FALSE_LINKS.forEach(function (link) {
      edges.push({
        a: marks[link.a],
        b: marks[link.b],
        sim: link.sim,
        same: false,
        story: link.story,
        why: link.why
      });
    });

    var invoices = makeInvoices(sessions);
    return {
      sessions: sessions,
      prs: prs,
      edges: edges,
      invoices: invoices,
      byId: indexById(sessions.concat(prs))
    };
  }

  function indexById(records) {
    var map = {};
    records.forEach(function (record) { map[record.id] = record; });
    return map;
  }

  function makeInvoices(sessions) {
    var months = [
      { key: "oct", label: "October 2026", cursor: 8000, claude: 10000 },
      { key: "nov", label: "November 2026", cursor: 8000, claude: 10000 }
    ];
    return months.map(function (month) {
      var codex = 0;
      var draft = 0;
      sessions.forEach(function (session) {
        if (WEEK_BY_ID[session.week].monthKey !== month.key) return;
        if (session.tool === "codex") codex += session.listCents;
        if (session.tool === "draft") draft += session.listCents;
      });
      var items = [
        { name: "Cursor seats", kind: "subscription", cents: month.cursor, detail: "2 seats × $40, flat. Illustrative." },
        { name: "Claude seats", kind: "subscription", cents: month.claude, detail: "2 seats × $50, flat. Illustrative." },
        { name: "Codex API", kind: "metered", cents: codex, detail: "Pay as you go, at the stand-in list rate." },
        { name: "Draft desk API", kind: "metered", cents: draft, detail: "Pay as you go, at the stand-in list rate." }
      ];
      var total = 0;
      items.forEach(function (item) { total += item.cents; });
      return { id: month.key, label: month.label, items: items, cents: total };
    });
  }

  var DATA = null;
  function data() {
    if (!DATA) DATA = build();
    return DATA;
  }

  function clampThreshold(value) {
    var n = Math.round(Number(value));
    if (!isFinite(n)) n = THRESHOLD.def;
    if (n < THRESHOLD.min) n = THRESHOLD.min;
    if (n > THRESHOLD.max) n = THRESHOLD.max;
    n = Math.round(n / THRESHOLD.step) * THRESHOLD.step;
    if (n < THRESHOLD.min) n = THRESHOLD.min;
    if (n > THRESHOLD.max) n = THRESHOLD.max;
    return n;
  }

  function findComponents(ids, kept) {
    var parent = {};
    ids.forEach(function (id) { parent[id] = id; });
    function find(id) {
      var root = id;
      while (parent[root] !== root) root = parent[root];
      while (parent[id] !== root) {
        var next = parent[id];
        parent[id] = root;
        id = next;
      }
      return root;
    }
    kept.forEach(function (edge) {
      var left = find(edge.a);
      var right = find(edge.b);
      if (left !== right) parent[left] = right;
    });
    var groups = {};
    ids.forEach(function (id) {
      var root = find(id);
      if (!groups[root]) groups[root] = [];
      groups[root].push(id);
    });
    return Object.keys(groups).map(function (key) {
      groups[key].sort();
      return groups[key];
    });
  }

  function unique(list) {
    var seen = {};
    var out = [];
    list.forEach(function (item) {
      if (seen[item]) return;
      seen[item] = true;
      out.push(item);
    });
    return out;
  }

  function lineIdsInOrder(ids) {
    return LINES.map(function (line) { return line.id; }).filter(function (id) {
      return ids.indexOf(id) !== -1;
    });
  }

  function joinNames(names) {
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + " and " + names[1];
    return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
  }

  function analyze(opts) {
    var options = opts || {};
    var threshold = clampThreshold(options.threshold);
    var judge = !!options.judge;
    var built = data();
    var kept = [];
    var rejected = 0;
    var above = 0;
    built.edges.forEach(function (edge) {
      if (edge.sim < threshold) return;
      above += 1;
      if (judge && !edge.same) {
        rejected += 1;
        return;
      }
      kept.push(edge);
    });

    var ids = built.sessions.map(function (session) { return session.id; }).concat(
      built.prs.map(function (pr) { return pr.id; })
    );
    var groups = findComponents(ids, kept);
    var workstreams = [];
    var mixed = [];
    var attribution = {};
    var prSingletons = 0;
    var sessionSingletons = 0;

    groups.forEach(function (members) {
      var records = members.map(function (id) { return built.byId[id]; });
      var sessionRecs = records.filter(function (record) { return record.kind === "session"; });
      var prRecs = records.filter(function (record) { return record.kind === "pr"; });
      var lines = lineIdsInOrder(unique(records.map(function (record) { return record.line; })));
      var themes = unique(records.map(function (record) { return record.theme; }));
      themes.sort(function (a, b) { return THEME_ORDER[a] - THEME_ORDER[b]; });
      var themeNames = themes.map(function (id) { return THEME_NAME[id]; });
      var listTotal = 0;
      var tokenTotal = 0;
      var minuteTotal = 0;
      var byLineList = {};
      sessionRecs.forEach(function (session) {
        listTotal += session.listCents;
        tokenTotal += session.tokens;
        minuteTotal += session.minutes;
        byLineList[session.line] = (byLineList[session.line] || 0) + session.listCents;
      });
      var majority = lines[0];
      lines.forEach(function (lineId) {
        var mine = byLineList[lineId] || 0;
        var best = byLineList[majority] || 0;
        if (mine > best) majority = lineId;
      });
      var isMixed = lines.length > 1;
      var isSingleton = members.length === 1;
      var name;
      if (isSingleton) name = "Singleton";
      else if (isMixed && themes.length <= 2) name = "Merged: " + themeNames.join(" + ");
      else if (isMixed) name = "Merged: " + lines.map(function (id) { return LINE_BY_ID[id].short; }).join(" + ");
      else if (themes.length === 1) name = themeNames[0];
      else name = LINE_BY_ID[lines[0]].name;

      if (isSingleton && sessionRecs.length === 1) sessionSingletons += 1;
      if (isSingleton && prRecs.length === 1) prSingletons += 1;

      var target = isSingleton ? "unattributed" : majority;
      sessionRecs.forEach(function (session) {
        attribution[session.id] = target;
      });

      if (!isSingleton) {
        var stream = {
          id: members.join("-"),
          name: name,
          mixed: isMixed,
          majority: majority,
          majorityName: LINE_BY_ID[majority].name,
          lines: lines,
          themes: themes,
          sessions: sessionRecs.length,
          prs: prRecs.length,
          listCents: listTotal,
          tokens: tokenTotal,
          minutes: minuteTotal,
          sample: sessionRecs.slice(0, 3).map(function (session) { return session.title; })
        };
        workstreams.push(stream);
        if (isMixed) {
          var swallowed = 0;
          sessionRecs.forEach(function (session) {
            if (session.line !== majority) swallowed += session.listCents;
          });
          var labelNames = themes.length <= 2 ? themeNames : lines.map(function (id) { return LINE_BY_ID[id].name; });
          mixed.push({
            name: name,
            lines: lines,
            majority: majority,
            swallowedListCents: swallowed,
            text: joinNames(labelNames) + " landed in one workstream. " + formatUsd(swallowed) + " of list price written as other clients is filed on " + LINE_BY_ID[majority].name + "."
          });
        }
      }
    });

    workstreams.sort(function (a, b) { return b.listCents - a.listCents; });
    mixed.sort(function (a, b) { return b.swallowedListCents - a.swallowedListCents; });

    var examples = built.edges.filter(function (edge) { return edge.story; }).map(function (edge) {
      var status = "below";
      if (edge.sim >= threshold && judge && !edge.same) status = "judge";
      else if (edge.sim >= threshold) status = "kept";
      var left = built.byId[edge.a];
      var right = built.byId[edge.b];
      return {
        story: edge.story,
        sim: edge.sim,
        same: edge.same,
        status: status,
        why: edge.why,
        left: pairEnd(left),
        right: pairEnd(right)
      };
    });
    examples.sort(function (a, b) {
      return STORY_ORDER.indexOf(a.story) - STORY_ORDER.indexOf(b.story);
    });

    return {
      threshold: threshold,
      judge: judge,
      sessions: built.sessions,
      prs: built.prs,
      invoices: built.invoices,
      above: above,
      kept: kept.length,
      rejected: rejected,
      pairs: built.edges.length,
      workstreams: workstreams,
      mixed: mixed,
      attribution: attribution,
      singletons: {
        prs: prSingletons,
        sessions: sessionSingletons,
        prTotal: built.prs.length,
        sessionTotal: built.sessions.length
      },
      examples: examples,
      totals: totalsOf(built.sessions, built.invoices),
      truth: sumBy(built.sessions, function (session) { return session.line; })
    };
  }

  function pairEnd(record) {
    return {
      id: record.id,
      kind: record.kind,
      title: record.title,
      line: record.line,
      lineName: LINE_BY_ID[record.line].name
    };
  }

  function totalsOf(sessions, invoices) {
    var listCents = 0;
    var apiCents = 0;
    var tokens = 0;
    var minutes = 0;
    sessions.forEach(function (session) {
      listCents += session.listCents;
      tokens += session.tokens;
      minutes += session.minutes;
      if (session.billing === "api") apiCents += session.listCents;
    });
    var paidCents = 0;
    invoices.forEach(function (invoice) { paidCents += invoice.cents; });
    return {
      sessions: sessions.length,
      listCents: listCents,
      apiCents: apiCents,
      seatCents: POOLS.cursor.cents + POOLS.claude.cents,
      seatListCents: listCents - apiCents,
      paidCents: paidCents,
      tokens: tokens,
      minutes: minutes
    };
  }

  function sumBy(sessions, keyFn) {
    var out = {};
    sessions.forEach(function (session) {
      var key = keyFn(session);
      if (!out[key]) out[key] = { tokens: 0, listCents: 0, minutes: 0, realTokens: 0, realHours: 0, realMarginal: 0, sessions: 0 };
      var bin = out[key];
      bin.sessions += 1;
      bin.tokens += session.tokens;
      bin.listCents += session.listCents;
      bin.minutes += session.minutes;
      bin.realTokens += session.real.tokens;
      bin.realHours += session.real.hours;
      bin.realMarginal += session.real.marginal;
    });
    return out;
  }

  function measure(session, basis, spread) {
    if (basis === "tokens") return session.tokens;
    if (basis === "list") return session.listCents;
    if (basis === "hours") return session.minutes;
    if (spread === "hours") return session.real.hours;
    if (spread === "marginal") return session.real.marginal;
    return session.real.tokens;
  }

  function buckets(analysis, basis, spread, by) {
    var built = data();
    var rows = [];
    var map = {};
    function add(id, label, value) {
      if (!map[id]) {
        map[id] = { id: id, label: label, value: 0 };
        rows.push(map[id]);
      }
      map[id].value += value;
    }
    if (by === "line") {
      LINES.forEach(function (line) { add(line.id, line.name, 0); });
    }
    analysis.sessions.forEach(function (session) {
      var value = measure(session, basis, spread);
      if (by === "week") add("w" + session.week, WEEK_BY_ID[session.week].label, value);
      else if (by === "tool") add(session.tool, session.toolName, value);
      else if (by === "model") add(session.model, session.modelName, value);
      else add(analysis.attribution[session.id], bucketLineLabel(analysis.attribution[session.id]), value);
    });
    if (basis === "real" && spread === "marginal") {
      add("overhead", "Seat overhead", analysis.totals.seatCents);
    }
    var max = 0;
    var sum = 0;
    rows.forEach(function (rowItem) {
      if (rowItem.value > max) max = rowItem.value;
      sum += rowItem.value;
    });
    rows.forEach(function (rowItem) {
      rowItem.display = formatMeasure(rowItem.value, basis);
      rowItem.pct = sum > 0 ? Math.round(rowItem.value * 1000 / sum) / 10 : 0;
      rowItem.width = max > 0 ? Math.round(rowItem.value * 1000 / max) / 10 : 0;
    });
    if (by === "week") {
      rows.sort(function (a, b) { return Number(a.id.slice(1)) - Number(b.id.slice(1)); });
    } else {
      rows.sort(function (a, b) {
        if (b.value !== a.value) return b.value - a.value;
        return a.label < b.label ? -1 : 1;
      });
    }
    return rows.filter(function (rowItem) {
      if (rowItem.value > 0) return true;
      return by === "line" && !!LINE_BY_ID[rowItem.id];
    });
  }

  function bucketLineLabel(id) {
    if (id === "unattributed") return "Unattributed";
    if (id === "overhead") return "Seat overhead";
    return LINE_BY_ID[id].name;
  }

  function pipelineValue(analysis, lineId, basis, spread) {
    var total = 0;
    analysis.sessions.forEach(function (session) {
      if (analysis.attribution[session.id] !== lineId) return;
      total += measure(session, basis, spread);
    });
    return total;
  }

  function truthValue(lineId, basis, spread) {
    var total = 0;
    data().sessions.forEach(function (session) {
      if (session.line !== lineId) return;
      total += measure(session, basis, spread);
    });
    return total;
  }

  function winner(analysis, basis, spread) {
    var bestId = "";
    var best = -1;
    LINES.forEach(function (line) {
      var value = pipelineValue(analysis, line.id, basis, spread || "tokens");
      if (value > best) {
        best = value;
        bestId = line.id;
      }
    });
    return {
      id: bestId,
      name: bestId ? LINE_BY_ID[bestId].name : "",
      short: bestId ? LINE_BY_ID[bestId].short : "",
      value: best
    };
  }

  function winners(analysis) {
    return {
      tokens: winner(analysis, "tokens"),
      list: winner(analysis, "list"),
      hours: winner(analysis, "hours"),
      realTokens: winner(analysis, "real", "tokens"),
      realHours: winner(analysis, "real", "hours"),
      realMarginal: winner(analysis, "real", "marginal")
    };
  }

  function basisLabel(basis, spread) {
    if (basis === "tokens") return "tokens";
    if (basis === "list") return "list price";
    if (basis === "hours") return "session hours";
    if (spread === "hours") return "real paid, seats spread by hours";
    if (spread === "marginal") return "marginal card charge";
    return "real paid, seats spread by tokens";
  }

  function basisNote(basis, spread) {
    if (basis === "tokens") return "Tokens count use, not money. A cheap model that re-reads a draft can lead this list.";
    if (basis === "list") return "List price is the stand-in meter for these tokens, including work the flat seats already covered. Use it on a client invoice only if you label it as list price.";
    if (basis === "hours") return "Hours say where the clock went. They are not a bill.";
    if (spread === "marginal") return "Marginal real cost counts only Codex and Draft desk. A Cursor or Claude session adds $0, because those seats are already paid. Right for “will the card move?” Wrong on a client invoice.";
    if (spread === "hours") return "Same real invoices. The flat seats are spread by session hours, so a long pairing session carries more of the seat bill than a short, token-heavy run.";
    return "Same real invoices. The flat seats are spread across that tool’s sessions by tokens. API charges stay on the sessions that incurred them.";
  }

  function linkAdvice(analysis) {
    if (analysis.mixed.length) return analysis.mixed[0].text;
    var sessions = analysis.singletons.sessionTotal;
    var prs = analysis.singletons.prTotal;
    if (sessions > 0 && analysis.singletons.sessions / sessions >= 0.5) {
      return "The cutoff is tight. " + analysis.singletons.sessions + " of " + sessions + " sessions are singletons, so their spend sits in Unattributed.";
    }
    if (prs > 0 && analysis.singletons.prs / prs >= 0.45 && analysis.singletons.prs / prs <= 0.55) {
      return "About half the pull requests are singletons. They never joined a workstream. That is the shape the thread described, on this fictional set.";
    }
    if (analysis.judge && analysis.singletons.prs === 0) {
      return "The judge dropped the lookalike pairs. Weaker true pairs still join, so clients stay apart and the singleton pull requests come along.";
    }
    return "Each client’s threads stay apart at this cutoff.";
  }

  function narrate(analysis, basis, spread) {
    var wins = winners(analysis);
    var bakery = pipelineValue(analysis, "bakery", basis, spread);
    var bakeryKey = truthValue("bakery", basis, spread);
    var bakeryText = basis === "hours"
      ? "The bakery rebuild took " + formatMeasure(bakery, basis) + " in this view."
      : basis === "tokens"
        ? "The bakery rebuild used " + formatMeasure(bakery, basis) + " tokens in this view."
        : "The bakery rebuild cost " + formatMeasure(bakery, basis) + " in agent spend (" + basisLabel(basis, spread) + ").";
    if (bakery !== bakeryKey) {
      bakeryText += " The answer key, same basis, is " + formatMeasure(bakeryKey, basis) + ".";
    }
    var months = analysis.invoices.map(function (invoice) {
      return invoice.label.replace(" 2026", "") + " card " + formatUsd(invoice.cents);
    }).join(". ") + ".";
    return {
      link: linkAdvice(analysis),
      ranks: "On this linking, list price ranks " + wins.list.name + " first, tokens rank " + wins.tokens.name + " first, and hours rank " + wins.hours.name + " first.",
      spreadRanks: "Real dollars spread by tokens rank " + wins.realTokens.name + " first. The same dollars spread by hours rank " + wins.realHours.name + " first. The marginal card charge ranks " + wins.realMarginal.name + " first.",
      bakery: bakeryText,
      paid: "List-price value " + formatUsd(analysis.totals.listCents) + ". Actually paid " + formatUsd(analysis.totals.paidCents) + ".",
      seats: "Cursor and Claude sessions list at " + formatUsd(analysis.totals.seatListCents) + ". The seat invoices are " + formatUsd(analysis.totals.seatCents) + ". Draft desk and Codex are metered, so on those tools list price and the card match.",
      months: months,
      admin: "Internal admin is " + formatUsd(truthValue("admin", "list")) + " of list price across these two months, " + formatUsd(Math.round(truthValue("admin", "list") / 2)) + " a month. It runs on Draft desk, so the card matches the list price.",
      meter: "On the answer key, the bakery adds " + formatUsd(truthValue("bakery", "real", "marginal")) + " to the card and the soccer site adds " + formatUsd(truthValue("soccer", "real", "marginal")) + ". Those sessions sit inside flat seats. The law blog adds " + formatUsd(truthValue("law", "real", "marginal")) + ", on Draft desk and Codex.",
      basis: basisNote(basis, spread),
      billing: "For a client invoice, use list price or real dollars spread by tokens, and say which. For the studio budget, use real paid. One more bakery session does not raise a seat invoice. Only Codex and Draft desk move the card. Hours say where the time went.",
      gap: gapText(analysis, basis, spread)
    };
  }

  function gapText(analysis, basis, spread) {
    var parts = [];
    LINES.forEach(function (line) {
      var pip = pipelineValue(analysis, line.id, basis, spread);
      var key = truthValue(line.id, basis, spread);
      if (pip === key) return;
      parts.push(line.short + " " + formatMeasure(pip, basis) + " on the chart, " + formatMeasure(key, basis) + " on the answer key");
    });
    var una = pipelineValue(analysis, "unattributed", basis, spread);
    if (una > 0) parts.push("Unattributed " + formatMeasure(una, basis));
    if (!parts.length) return "This matches the answer key. Linked sessions stayed on the client they were written as.";
    return "The chart disagrees with the answer key. " + parts.join(". ") + ".";
  }

  function formatUsd(cents) {
    var sign = cents < 0 ? "-" : "";
    var abs = Math.abs(Math.round(cents));
    var dollars = Math.floor(abs / 100);
    var rem = abs % 100;
    var grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + "$" + grouped + "." + (rem < 10 ? "0" : "") + rem;
  }

  function formatTokens(n) {
    var value = Math.round(n);
    if (value >= 1000000) {
      var millions = Math.round(value / 100000) / 10;
      return (millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)) + "M";
    }
    if (value >= 1000) {
      var thousands = Math.round(value / 100) / 10;
      return (thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)) + "k";
    }
    return String(value);
  }

  function formatHours(minutes) {
    var tenths = Math.round(minutes * 10 / 60);
    var whole = Math.floor(tenths / 10);
    var frac = Math.abs(tenths % 10);
    return whole + "." + frac + " h";
  }

  function formatMeasure(value, basis) {
    if (basis === "tokens") return formatTokens(value);
    if (basis === "hours") return formatHours(value);
    return formatUsd(value);
  }

  function formatSim(sim) {
    var hundredths = Math.round(sim / 10);
    var whole = Math.floor(hundredths / 100);
    var frac = hundredths % 100;
    return whole + "." + (frac < 10 ? "0" : "") + frac;
  }

  function formatPct(value) {
    return (Math.round(value * 10) / 10) + "%";
  }

  function sample() {
    var built = data();
    return {
      studio: STUDIO,
      sessions: built.sessions,
      prs: built.prs,
      edges: built.edges.map(function (edge) {
        return { a: edge.a, b: edge.b, sim: edge.sim, same: edge.same, why: edge.why };
      }),
      invoices: built.invoices,
      rates: Object.keys(MODELS).map(function (id) {
        var model = MODELS[id];
        return {
          model: model.name,
          tool: TOOLS[model.tool].name,
          billing: model.billing,
          inCentsPerMillion: model.inRate,
          outCentsPerMillion: model.outRate
        };
      })
    };
  }

  globalThis.SpendLedger = {
    STUDIO: STUDIO,
    SOURCE: SOURCE,
    LINES: LINES,
    WEEKS: WEEKS,
    MODELS: MODELS,
    TOOLS: TOOLS,
    POOLS: POOLS,
    PRESETS: PRESETS,
    THRESHOLD: THRESHOLD,
    analyze: analyze,
    buckets: buckets,
    winners: winners,
    narrate: narrate,
    basisLabel: basisLabel,
    pipelineValue: pipelineValue,
    truthValue: truthValue,
    formatUsd: formatUsd,
    formatTokens: formatTokens,
    formatHours: formatHours,
    formatMeasure: formatMeasure,
    formatSim: formatSim,
    formatPct: formatPct,
    sample: sample,
    listCents: listCents
  };
})();
