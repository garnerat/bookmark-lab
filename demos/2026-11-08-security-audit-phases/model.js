(function () {
  "use strict";

  // Canned simulation of a single-pass scan versus the six phases in
  // https://github.com/cloudflare/security-audit-skill
  // Nothing here is executed, scanned, or sent anywhere.

  const SHOP = {
    name: "Hilltop Homebook",
    place: "Cincinnati",
    blurb:
      "A made-up booking app for a home-services shop: heating, plumbing, and electrical visits.",
  };

  const PHASES = [
    {
      id: 1,
      name: "Map the codebase",
      skill: "Reconnaissance",
      lede: "Name the architecture, the trust boundary, and every input surface before looking for bugs.",
    },
    {
      id: 2,
      name: "Hunt for vulnerabilities",
      skill: "Coverage-led hunting",
      lede: "Each file gets its own hunter. The hunter writes a candidate and stops. This is the same list the single-pass scan would ship as findings.",
    },
    {
      id: 3,
      name: "Challenge each candidate",
      skill: "Candidate validation",
      lede: "A fresh pass tries to disprove each candidate. The hunter does not grade its own find. Two candidates fall here.",
    },
    {
      id: 4,
      name: "Record the findings",
      skill: "Structured output",
      lede: "Write one record per candidate. Confirmed needs a source trace and a result you can point at. Needs validation names one open fact and has no severity. Rejected keeps the disproof.",
    },
    {
      id: 5,
      name: "Verify the findings",
      skill: "Independent record verification",
      lede: "Another fresh pass reads the source again. It checks the record. It does not promote a record because an earlier pass liked it.",
    },
    {
      id: 6,
      name: "Report what's confirmed, rejected, or still needs validation",
      step: "Report the verdicts",
      skill: "Target-neutral reporting",
      lede: "The report is derived from the verified records. It is grouped into confirmed, rejected, and needs validation.",
    },
  ];

  const FILES = [
    {
      id: "admin",
      path: "routes/admin-bookings.js",
      title: "Unauthenticated admin route",
      side: "public",
      surface: "GET /admin/bookings",
      role: "Public route. Returns every booking. No staff gate in this file.",
      code: [
        'app.get("/admin/bookings", (req, res) => {',
        "  res.json(store.allBookings());",
        "});",
      ].join("\n"),
      scan: {
        severity: "High",
        headline: "Missing authentication",
        rule: "Admin path with no auth call in the handler",
        claim: "Anyone who can reach /admin/bookings receives every booking.",
      },
      hunter:
        "Candidate: the public app serves /admin/bookings and the handler returns store.allBookings() with no auth call.",
      challenge: {
        outcome: "stands",
        because:
          "Looked for requireStaff, a session read, or a mount on the staff router. This handler is app.get on the public app. The candidate stands.",
      },
      record: {
        verdict: "confirmed",
        summary: "The public admin route returns the full booking list with no staff gate.",
        trace:
          "app.get(\"/admin/bookings\") is on the public app. The handler does not read a session and is not mounted behind requireStaff.",
        result: "The response body is store.allBookings(), the full list.",
        disproof: null,
        unresolved: null,
        severity: "A caller who is not staff can read every booking.",
      },
      verify: {
        holds: true,
        note: "Re-read routes/admin-bookings.js. The route is still on the public app, and the handler still returns store.allBookings() with no gate. Confirmed holds.",
      },
    },
    {
      id: "sql",
      path: "db/search-visits.js",
      title: "String-built SQL",
      side: "public",
      surface: "neighborhood query",
      role: "Public search. The neighborhood string is joined into the SQL text.",
      code: [
        "function visitsIn(neighborhood) {",
        "  const sql =",
        '    "SELECT id, neighborhood, service FROM visits WHERE neighborhood = \'" +',
        "    neighborhood +",
        '    "\'";',
        "  return db.exec(sql);",
        "}",
      ].join("\n"),
      scan: {
        severity: "High",
        headline: "SQL injection",
        rule: "String joined into a SQL statement",
        claim: "The neighborhood query is concatenated into SQL and passed to db.exec.",
      },
      hunter:
        "Candidate: visitsIn builds a SQL string with the neighborhood value and passes that string to db.exec. Hunter file note said routes/search.js.",
      challenge: {
        outcome: "stands",
        because:
          "Looked for a placeholder or a bound parameter. The neighborhood value is still joined into the SQL string, and that string is the argument to db.exec. The candidate stands.",
      },
      record: {
        verdict: "confirmed",
        summary: "The neighborhood query is built into the SQL string db.exec runs.",
        trace:
          "visitsIn concatenates neighborhood between single quotes and passes the result to db.exec. There is no bound parameter.",
        result: "db.exec receives the built string, not a separate parameter.",
        disproof: null,
        unresolved: null,
        severity: "A neighborhood value can change the SQL the database runs.",
      },
      verify: {
        holds: true,
        note: "The hunter named routes/search.js. The statement is in db/search-visits.js. The corrected path was checked again. neighborhood is still concatenated into the SQL passed to db.exec. Confirmed holds.",
      },
    },
    {
      id: "key",
      path: "config/dispatch.js",
      title: "Hardcoded fake key",
      side: "public",
      surface: "DISPATCH_TOKEN",
      role: "A placeholder token is hardcoded and sent on a dispatch call.",
      code: [
        'const DISPATCH_TOKEN = "hilltop-demo-token-not-live";',
        "",
        "function pingDispatch(jobId) {",
        '  return client.post("/dispatch", {',
        "    jobId: jobId,",
        "    token: DISPATCH_TOKEN,",
        "  });",
        "}",
      ].join("\n"),
      scan: {
        severity: "High",
        headline: "Hardcoded secret",
        rule: "Assignment that looks like a token",
        claim: "A dispatch token is hardcoded in source and labeled a leaked secret.",
      },
      hunter:
        "Candidate: DISPATCH_TOKEN is a string literal in config/dispatch.js and pingDispatch sends it.",
      challenge: {
        outcome: "open",
        because:
          "The name looks like a secret, and the value is hardcoded. The value is the placeholder hilltop-demo-token-not-live. This file does not show a trust-boundary failure, and there is no second config to compare. The candidate is not rejected. It stays open.",
      },
      record: {
        verdict: "needs_validation",
        summary: "A placeholder token is hardcoded. Whether it is the live dispatch token is unresolved.",
        trace: "pingDispatch sends the literal DISPATCH_TOKEN on client.post(\"/dispatch\").",
        result: null,
        disproof: null,
        unresolved:
          "Is hilltop-demo-token-not-live only a fixture in this file, or the token the dispatch call sends in a live deployment?",
        severity: null,
      },
      verify: {
        holds: true,
        note: "Re-read config/dispatch.js. The token is still the placeholder hilltop-demo-token-not-live. This pass did not observe a live dispatch boundary fail, so it did not promote the record. It stays needs validation, with no severity.",
      },
    },
    {
      id: "note",
      path: "routes/confirm-note.js",
      title: "Sanitized input",
      side: "public",
      surface: "customer note",
      role: "The note looks like it is dropped into HTML. escapeHtml runs first.",
      code: [
        "function confirmationHtml(note) {",
        '  return "<p>" + escapeHtml(note) + "</p>";',
        "}",
        "",
        "function escapeHtml(value) {",
        "  return String(value)",
        '    .replaceAll("&", "&amp;")',
        '    .replaceAll("<", "&lt;")',
        '    .replaceAll(">", "&gt;");',
        "}",
      ].join("\n"),
      scan: {
        severity: "High",
        headline: "HTML injection",
        rule: "User value joined into HTML",
        claim: "The customer note is concatenated into an HTML string, so this is HTML injection.",
      },
      hunter:
        "Candidate: confirmationHtml places the customer note inside a <p> tag by string concatenation.",
      challenge: {
        outcome: "rejected",
        because:
          "The note does reach HTML. escapeHtml runs on it first and replaces &, <, and > before the note is placed in the paragraph. The injection candidate is rejected.",
      },
      record: {
        verdict: "rejected",
        summary: "Rejected. The note is escaped before it is written into the page.",
        trace: null,
        result: null,
        disproof:
          "escapeHtml replaces &, <, and > before confirmationHtml concatenates the note into the paragraph.",
        unresolved: null,
        severity: null,
      },
      verify: {
        holds: true,
        note: "Re-read routes/confirm-note.js. The note still passes through escapeHtml before it is placed in the HTML. Rejection holds.",
      },
    },
    {
      id: "export",
      path: "routes/staff-export.js",
      title: "False-positive trap",
      side: "staff",
      surface: "GET /export.csv",
      role: "The handler has no auth call. requireStaff already wraps the router.",
      code: [
        "staffRouter.use(requireStaff);",
        "",
        'staffRouter.get("/export.csv", (req, res) => {',
        '  res.type("text/csv").send(store.exportCsv());',
        "});",
      ].join("\n"),
      scan: {
        severity: "High",
        headline: "Missing authentication",
        rule: "Data response with no auth call in the handler",
        claim: "The export handler sends every row and never calls requireStaff.",
      },
      hunter:
        "Candidate: the /export.csv handler sends store.exportCsv() and the function itself does not call requireStaff.",
      challenge: {
        outcome: "rejected",
        because:
          "The handler does not call requireStaff. The line above it does: staffRouter.use(requireStaff) wraps this router. A request without a staff session never enters the handler. A missing second check inside the function is not a second hole. The candidate is rejected.",
      },
      record: {
        verdict: "rejected",
        summary: "Rejected. The staff gate is on the router, above the export route.",
        trace: null,
        result: null,
        disproof:
          "staffRouter.use(requireStaff) runs before staffRouter.get(\"/export.csv\"). The handler is not a public route.",
        unresolved: null,
        severity: null,
      },
      verify: {
        holds: true,
        note: "Re-read routes/staff-export.js. staffRouter.use(requireStaff) still runs before the export route. A request without a staff session does not reach the handler. Rejection holds.",
      },
    },
  ];

  function report() {
    const groups = { confirmed: [], rejected: [], needsValidation: [] };
    FILES.forEach((file) => {
      if (file.record.verdict === "confirmed") groups.confirmed.push(file);
      else if (file.record.verdict === "rejected") groups.rejected.push(file);
      else if (file.record.verdict === "needs_validation") groups.needsValidation.push(file);
    });
    return groups;
  }

  function scoreboard() {
    const groups = report();
    return {
      scanFlagged: FILES.length,
      scanRejected: 0,
      scanOpen: 0,
      confirmed: groups.confirmed.length,
      rejected: groups.rejected.length,
      needsValidation: groups.needsValidation.length,
    };
  }

  function scan() {
    return FILES.map((file) => ({
      id: file.id,
      path: file.path,
      title: file.title,
      severity: file.scan.severity,
      headline: file.scan.headline,
      rule: file.scan.rule,
      claim: file.scan.claim,
    }));
  }

  function fileById(id) {
    return FILES.find((file) => file.id === id) || null;
  }

  const api = {
    SHOP: SHOP,
    PHASES: PHASES,
    FILES: FILES,
    report: report,
    scoreboard: scoreboard,
    scan: scan,
    fileById: fileById,
  };

  globalThis.AuditPhases = api;
})();
