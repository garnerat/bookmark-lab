// Data and fixtures for the Oakley Pipe & Air audit walkthrough.
// The shop files are fiction. Runners compare dummy rows and strings.
// They do not start a process, a shell, or a database.

export const rows = [
  {
    id: "job_ada",
    customerId: "ada",
    name: "Ada Ruiz",
    phone: "555-0101",
    address: "18 Rookwood Lane",
    note: "No heat upstairs",
  },
  {
    id: "job_ben",
    customerId: "ben",
    name: "Ben Cho",
    phone: "555-0144",
    address: "402 Millcreek Court",
    note: "Drip under the kitchen sink",
  },
];

const shop = {
  "server.js": `
    const http = require("http");
    const config = require("./config");
    const { findDuplicate, createBooking } = require("./lib/booking");
    const { printTicket } = require("./lib/tickets");
    const { exportJobs, getJob } = require("./lib/admin");
    const { savePhoto, resendFax } = require("./lib/uploads");

    let lastQuery = null;

    function fieldsFrom(req) {
      // Booking form fields: name, phone, address, note, next.
      return JSON.parse(req.rawBody);
    }

    function absoluteHost(req) {
      if (config.trustProxy && req.headers["x-forwarded-host"]) {
        return req.headers["x-forwarded-host"];
      }
      return "oakleypipe.example";
    }

    function bookingLink(req) {
      return "https://" + absoluteHost(req) + "/status?job=new";
    }

    const statusPage = "<p id=\\"status\\"></p><script src=\\"/status.js\\"></script>";

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://oakleypipe.example");

      if (req.method === "POST" && url.pathname === "/book") {
        const fields = fieldsFrom(req);
        lastQuery = findDuplicate(fields.phone);
        createBooking(fields);
        printTicket(fields);
        const next = fields.next || "/thanks";
        res.setHeader("X-Booking-Link", bookingLink(req));
        res.writeHead(302, { Location: next });
        return res.end();
      }

      if (req.method === "GET" && url.pathname === "/admin/jobs") {
        if (!req.session) {
          res.writeHead(401);
          return res.end("login");
        }
        const id = url.searchParams.get("id");
        return res.end(JSON.stringify(getJob(id, req.session)));
      }

      if (req.method === "GET" && url.pathname === "/admin/export") {
        return res.end(exportJobs());
      }

      if (req.method === "GET" && url.pathname === "/status") {
        return res.end(statusPage);
      }

      if (req.method === "POST" && url.pathname === "/upload") {
        savePhoto(req.headers["x-file-name"]);
        return res.end("saved");
      }

      if (req.method === "POST" && url.pathname === "/fax/retry") {
        const name = url.searchParams.get("name");
        resendFax(name);
        return res.end("queued");
      }

      if (config.debug && url.searchParams.get("debug") === "1") {
        const sql = lastQuery && lastQuery.sql ? lastQuery.sql : "";
        return res.end(sql + "\\n" + new Error("debug").stack);
      }

      res.writeHead(404);
      res.end("missing");
    });

    module.exports = { server, absoluteHost, bookingLink };
  `,
  "config.js": `
    module.exports = {
      debug: process.env.DEBUG !== "0",
      trustProxy: true,
      uploadRoot: "/app/uploads",
    };
  `,
  "lib/booking.js": `
    const jobs = require("./jobs");

    function findDuplicate(phone) {
      const sql = "SELECT id, note, phone, address FROM jobs WHERE phone = '" + phone + "'";
      return jobs.query(sql);
    }

    function createBooking(fields) {
      const sql = "INSERT INTO jobs (name, note, phone, address) VALUES (?, ?, ?, ?)";
      return jobs.query(sql, [fields.name, fields.note, fields.phone, fields.address]);
    }

    module.exports = { findDuplicate, createBooking };
  `,
  "lib/tickets.js": `
    const { exec } = require("child_process");

    function printTicket(fields) {
      exec("lp -t " + fields.address);
    }

    module.exports = { printTicket };
  `,
  "lib/admin.js": `
    const jobs = require("./jobs");

    function exportJobs() {
      return jobs.rows
        .map((row) => [row.name, row.phone, row.address, row.note].join(", "))
        .join("\\n");
    }

    function getJob(id, session) {
      return jobs.rows.find((row) => row.id === id) || null;
    }

    module.exports = { exportJobs, getJob };
  `,
  "lib/uploads.js": `
    const fs = require("fs");
    const path = require("path");
    const config = require("../config");

    function savePhoto(headerName) {
      const base = path.basename(headerName || "leak.jpg");
      const dest = path.join(config.uploadRoot, base);
      fs.writeFileSync(dest, "dummy-photo");
      return dest;
    }

    function resendFax(name) {
      const dest = config.uploadRoot + "/" + name;
      return fs.readFileSync(dest);
    }

    module.exports = { savePhoto, resendFax };
  `,
  "public/status.js": `
    const params = new URLSearchParams(location.search);
    const msg = params.get("msg") || "We have your booking.";
    document.getElementById("status").innerHTML = msg;
  `,
  "package.json": `
    {
      "name": "oakley-pipe-air",
      "private": true,
      "dependencies": {
        "image-rotate": "*"
      }
    }
  `,
};

function dedent(text) {
  const lines = text.replace(/^\n/, "").replace(/\n$/, "").split("\n");
  const widths = lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length);
  const cut = widths.length ? Math.min(...widths) : 0;
  return lines.map((line) => line.slice(cut));
}

function jobsFile(data) {
  const json = JSON.stringify(data, null, 2);
  return [
    "const rows = " + json + ";",
    "",
    "function query(sql, params) {",
    "  return { sql: sql, params: params || null, rows: rows };",
    "}",
    "",
    "module.exports = { rows, query };",
  ];
}

export const files = Object.fromEntries(
  Object.entries(shop).map(([name, text]) => [name, dedent(text)]),
);
files["lib/jobs.js"] = jobsFile(rows);

export const fileOrder = [
  "server.js",
  "config.js",
  "lib/booking.js",
  "lib/tickets.js",
  "lib/admin.js",
  "lib/uploads.js",
  "lib/jobs.js",
  "public/status.js",
  "package.json",
];

export function lineOf(file, snippet) {
  const lines = files[file];
  if (!lines) throw new Error("missing file " + file);
  const hits = [];
  lines.forEach((line, index) => {
    if (line.includes(snippet)) hits.push(index + 1);
  });
  if (hits.length !== 1) {
    throw new Error(`${file} snippet ${JSON.stringify(snippet)} hits ${hits.join(",") || "none"}`);
  }
  return hits[0];
}

export function shopExcerpt(file, snippet, count) {
  const start = lineOf(file, snippet);
  const lines = [];
  for (let i = 0; i < count; i += 1) {
    const text = files[file][start - 1 + i];
    if (text == null) break;
    lines.push({ line: start + i, text });
  }
  return lines;
}

export function normalizePosix(path) {
  const absolute = path.startsWith("/");
  const parts = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length) parts.pop();
      else if (!absolute) parts.push("..");
      continue;
    }
    parts.push(part);
  }
  return (absolute ? "/" : "") + parts.join("/");
}

export function fileBase(name) {
  const parts = String(name).split(/[/\\]/);
  return parts[parts.length - 1];
}

export function lookupByPhone(phone, fixed) {
  const head = "SELECT id, note, phone, address FROM jobs WHERE phone = ";
  if (fixed) {
    const matched = rows.filter((row) => row.phone === phone);
    const who = matched.map((row) => row.name).join(", ");
    return {
      safe: true,
      sql: head + "?",
      params: [phone],
      rows: matched,
      observed: matched.length
        ? `The phone is bound as a value. The fixture returns ${matched.length} row: ${who}.`
        : "The phone is bound as a value. No dummy job has that exact phone, quote included.",
    };
  }
  const sql = head + "'" + phone + "'";
  const quote = String(phone).includes("'");
  const tautology = /'\s*or\s*'1'\s*=\s*'1/i.test(phone);
  let matched = [];
  if (tautology) matched = rows.slice();
  else if (!quote) matched = rows.filter((row) => row.phone === phone);
  const who = matched.map((row) => `${row.name}, ${row.address}`).join("; ");
  let observed;
  if (tautology) {
    observed = `The quote ends the literal, and the fixture WHERE keeps every dummy job: ${who}.`;
  } else if (quote) {
    observed = "The quote changes the SQL shape. This value is not the tautology, so the fixture adds no extra rows.";
  } else if (matched.length) {
    observed = `Exact phone, one string literal: ${who}.`;
  } else {
    observed = "No dummy job has that phone.";
  }
  return { safe: !quote, sql, params: null, rows: matched, observed };
}

export function ticketCommand(address, fixed) {
  if (fixed) {
    return {
      safe: true,
      command: null,
      argv: ["lp", "-t", String(address)],
      observed:
        "execFile is called with lp, -t, and the address as one argument. A semicolon stays inside that argument. This page does not start a process.",
    };
  }
  const command = "lp -t " + address;
  const split = /[;&|`$<>\n]/.test(address);
  return {
    safe: !split,
    command,
    argv: null,
    observed: split
      ? `child_process.exec receives one string: ${command}. The semicolon starts a second command. This page does not run a shell. The check stops at the string.`
      : `child_process.exec receives: ${command}. The address is a single trailing token.`,
  };
}

export function statusRender(msg, fixed) {
  const element = /<\s*[a-z!/]/i.test(msg);
  if (fixed) {
    return {
      safe: true,
      mode: "text",
      observed: element
        ? "textContent keeps those characters as text. The fixture document does not build an element from msg."
        : "textContent shows the message as text.",
    };
  }
  return {
    safe: !element,
    mode: "html",
    observed: element
      ? "innerHTML parses msg as HTML, so the tag becomes a node in the shop origin. This page does not insert it, and the check does not read a cookie."
      : "msg has no tag. The HTML assignment does not build an element.",
  };
}

const NEXT_ALLOW = new Set(["/thanks", "/booked"]);

export function redirectTo(next, fixed) {
  if (fixed) {
    const location = NEXT_ALLOW.has(next) ? next : "/thanks";
    return {
      safe: true,
      location,
      observed:
        next === location
          ? `Location is ${location}, and that path is on the allowlist.`
          : `Location is ${location}. The fixture input is not on the allowlist, so the response stays on the shop.`,
    };
  }
  const listed = NEXT_ALLOW.has(next);
  return {
    safe: listed,
    location: next || "/thanks",
    observed: listed
      ? `Location is ${next}, already on the allowlist.`
      : `Location is ${next}. A browser would leave the shop. The check stops at the header.`,
  };
}

export function exportCsv(session, fixed) {
  const body = rows.map((row) => `${row.name}, ${row.phone}, ${row.address}`).join("\n");
  if (fixed) {
    if (!session || session.role !== "dispatcher") {
      return {
        safe: true,
        status: 401,
        observed: "401. The body is empty. A dispatcher session is still allowed to export.",
      };
    }
    return {
      safe: true,
      status: 200,
      observed: "200. This session is the dispatcher, so the export is the job the role is for.",
    };
  }
  return {
    safe: false,
    status: 200,
    observed: `200, and the handler never reads a session. Body:\n${body}`,
  };
}

export function readJob(id, session, fixed) {
  if (!session) {
    return {
      safe: true,
      status: 401,
      observed: "401. The route already rejects a missing session. That is the login check, not the owner check.",
    };
  }
  const job = rows.find((row) => row.id === id) || null;
  if (!job) {
    return { safe: true, status: 404, observed: "No dummy job has that id." };
  }
  const allowed = session.role === "dispatcher" || job.customerId === session.customerId;
  if (!allowed && fixed) {
    return {
      safe: true,
      status: 200,
      observed: "The body is null, the same response as an unknown id. The other customer's address is not in it.",
    };
  }
  if (!allowed) {
    return {
      safe: false,
      status: 200,
      observed: `200. The ${session.customerId} session receives ${job.name}, ${job.phone}, ${job.address}.`,
    };
  }
  const why = session.role === "dispatcher" ? "the dispatcher role" : "the session's own job";
  return {
    safe: true,
    status: 200,
    observed: `200. ${job.name} is visible because of ${why}.`,
  };
}

export function faxPath(name, fixed) {
  const root = "/app/uploads";
  if (fixed) {
    const base = fileBase(name || "");
    if (!base || base === "." || base === ".." || base !== name) {
      return {
        safe: true,
        path: null,
        observed: "Rejected. The retry accepts only a single file name, with no directory segment.",
      };
    }
    return {
      safe: true,
      path: `${root}/${base}`,
      observed: `Reads ${root}/${base}, which stays under ${root}.`,
    };
  }
  const dest = normalizePosix(`${root}/${name}`);
  const escaped = dest !== root && !dest.startsWith(`${root}/`);
  return {
    safe: !escaped,
    path: dest,
    observed: escaped
      ? `Reads ${dest}, which is outside ${root}. The check stops at the path. It does not open a file on this computer.`
      : `Reads ${dest}, still under ${root}.`,
  };
}

export function savedPhotoPath(headerName) {
  const base = fileBase(headerName || "leak.jpg");
  if (!base || base === "." || base === "..") return null;
  return "/app/uploads/" + base;
}

export function debugResponse(fixed) {
  const sql =
    "SELECT id, note, phone, address FROM jobs WHERE phone = '" + "555-0101" + "'";
  if (fixed) {
    return {
      safe: true,
      observed:
        "DEBUG is unset, and the flag is on only when that variable is the string 1. GET /nope?debug=1 is a 404 with no SQL and no stack.",
    };
  }
  return {
    safe: false,
    observed: `DEBUG is unset, and the code treats that as on. After a normal booking, GET /nope?debug=1 responds with the lookup SQL (${sql}) and a stack that names server.js.`,
  };
}

const ada = { customerId: "ada", role: "customer" };

function withLines(finding) {
  const trace = finding.trace.map((step) => ({
    ...step,
    line: lineOf(step.file, step.snippet),
  }));
  return { ...finding, trace };
}

const draft = [
  {
    id: "sql-phone",
    wave: 1,
    verdict: "confirmed",
    severity: "high",
    impact: "high",
    confidence: "high",
    fingerprint: "booking.phone.sql-concat",
    title: "The duplicate lookup concatenates the phone into SQL",
    attackClass: "Injection",
    classRef: "ATTACK-CLASSES.md#Injection",
    principal: "Anyone who can post the booking form",
    invariant: "The lookup may return only the row whose phone equals the submitted phone.",
    rootCause:
      "findDuplicate builds the SELECT by closing a quote around fields.phone. createBooking, the sibling insert, already binds name, note, phone, and address.",
    vector:
      "A phone value that includes a quote changes which rows the WHERE clause keeps. The fixture value makes the condition true for every dummy job.",
    remediation:
      "Keep the SQL text constant and pass the phone as a bound parameter, the same way createBooking already does.",
    request: "POST /book",
    inputLabel: "phone",
    input: "555-0100' OR '1'='1",
    excerpt: { file: "lib/booking.js", snippet: "function findDuplicate(phone)", count: 4 },
    sinkSnippet: "WHERE phone = '",
    patch: [
      "function findDuplicate(phone) {",
      '  const sql = "SELECT id, note, phone, address FROM jobs WHERE phone = ?";',
      "  return jobs.query(sql, [phone]);",
      "}",
    ],
    patchNote: "The audit describes this patch. It does not edit the shop.",
    trace: [
      {
        role: "entrypoint",
        file: "server.js",
        snippet: "findDuplicate(fields.phone)",
        caption: "POST /book reads the form body and passes phone into the lookup.",
      },
      {
        role: "propagation",
        file: "lib/booking.js",
        snippet: "WHERE phone = '",
        caption: "The phone is still the caller's string, and it is glued into the SQL text.",
      },
      {
        role: "sink",
        file: "lib/booking.js",
        snippet: "return jobs.query(sql);",
        caption: "The sink is that string. The insert beside this function binds its values instead.",
      },
    ],
    run(fixed) {
      const result = lookupByPhone(this.input, fixed);
      return {
        safe: result.safe,
        request: this.request,
        inputLabel: this.inputLabel,
        input: this.input,
        extraLabel: "SQL text",
        extra: result.sql,
        observed: result.observed,
      };
    },
  },
  {
    id: "shell-address",
    wave: 1,
    verdict: "confirmed",
    severity: "critical",
    impact: "critical",
    confidence: "high",
    fingerprint: "tickets.address.shell-string",
    title: "The work-ticket printer puts the address in a shell string",
    attackClass: "Injection",
    classRef: "ATTACK-CLASSES.md#Injection",
    principal: "Anyone who can post the booking form",
    invariant: "The address may be an argument to the print command, not shell syntax.",
    rootCause:
      "printTicket passes \"lp -t \" plus fields.address to child_process.exec. That Node API runs a shell. The route is unauthenticated.",
    vector:
      "An address that contains a semicolon adds a second command to the string exec would run.",
    remediation:
      "Call execFile with a fixed argument list so the address is one argument. The semicolon then has no shell meaning.",
    request: "POST /book",
    inputLabel: "address",
    input: "Oakley; echo marker",
    excerpt: { file: "lib/tickets.js", snippet: "function printTicket(fields)", count: 3 },
    sinkSnippet: "exec(",
    patch: [
      'const { execFile } = require("child_process");',
      "",
      "function printTicket(fields) {",
      '  execFile("lp", ["-t", String(fields.address)]);',
      "}",
    ],
    patchNote:
      "Severity is critical because the caller is unauthenticated and the sink is a shell API. The observed result is the command string. The check stops there, which is the minimum effect.",
    trace: [
      {
        role: "entrypoint",
        file: "server.js",
        snippet: "printTicket(fields)",
        caption: "The same booking post sends the form, address included, to the printer.",
      },
      {
        role: "propagation",
        file: "lib/tickets.js",
        snippet: "function printTicket(fields)",
        caption: "fields.address is still the posted string.",
      },
      {
        role: "sink",
        file: "lib/tickets.js",
        snippet: 'exec("lp -t "',
        caption: "exec receives one shell string. Node runs that string in a shell.",
      },
    ],
    run(fixed) {
      const result = ticketCommand(this.input, fixed);
      return {
        safe: result.safe,
        request: this.request,
        inputLabel: this.inputLabel,
        input: this.input,
        extraLabel: fixed ? "Argument list" : "Command string",
        extra: fixed ? result.argv.join("  ") : result.command,
        observed: result.observed,
      };
    },
  },
  {
    id: "xss-msg",
    wave: 1,
    verdict: "confirmed",
    severity: "medium",
    impact: "medium",
    confidence: "high",
    fingerprint: "status.msg.innerHTML",
    title: "The status page assigns the msg query to innerHTML",
    attackClass: "DOM-based XSS",
    classRef: "CLIENT-SIDE.md#DOM-based XSS",
    principal: "Someone who can get a customer to open a status link",
    invariant: "msg may be text in the status node, not markup in the shop origin.",
    rootCause:
      "public/status.js reads location.search and assigns msg with innerHTML. The server never sees that value. No content-security policy is in the repo.",
    vector:
      "A status link whose msg contains a tag parses as an element in the customer's browser.",
    remediation: "Assign msg with textContent.",
    request: "GET /status?msg=…  (the browser file reads the query)",
    inputLabel: "msg",
    input: '<img src="x" onerror="marker">',
    excerpt: { file: "public/status.js", snippet: "const params = new URLSearchParams", count: 3 },
    sinkSnippet: "innerHTML",
    patch: ['document.getElementById("status").textContent = msg;'],
    patchNote:
      "The fixture shows a node in the victim origin, and only if they open the link. That is a real boundary break with a click as a condition, so the rating stays medium. The check does not claim a stolen session.",
    trace: [
      {
        role: "entrypoint",
        file: "public/status.js",
        snippet: "location.search",
        caption: "The status page reads its own URL. This source never passes through the server.",
      },
      {
        role: "propagation",
        file: "public/status.js",
        snippet: 'params.get("msg")',
        caption: "msg is the query value, or a fixed sentence when the query is empty.",
      },
      {
        role: "sink",
        file: "public/status.js",
        snippet: "innerHTML = msg",
        caption: "innerHTML parses the string as HTML in the shop origin.",
      },
    ],
    run(fixed) {
      const result = statusRender(this.input, fixed);
      return {
        safe: result.safe,
        request: this.request,
        inputLabel: this.inputLabel,
        input: this.input,
        extraLabel: "Assignment",
        extra: fixed ? "textContent = msg" : "innerHTML = msg",
        observed: result.observed,
      };
    },
  },
  {
    id: "redirect-next",
    wave: 1,
    verdict: "confirmed",
    severity: "low",
    impact: "low",
    confidence: "high",
    fingerprint: "book.next.open-redirect",
    title: "The booking response redirects to the next form field",
    attackClass: "Obvious things",
    classRef: "ATTACK-CLASSES.md#Obvious things",
    principal: "Anyone who can post the booking form",
    invariant: "Location after a booking stays on a path this server chose.",
    rootCause:
      "When next is non-empty, the route copies it into the Location header. The only fallback is an empty field.",
    vector:
      "A next value that is an absolute URL becomes the browser's next hop.",
    remediation:
      "Allow only the two relative paths the shop actually uses, /thanks and /booked. Every other value, including absolute URLs, stays on /thanks.",
    request: "POST /book",
    inputLabel: "next",
    input: "https://example.invalid/out",
    excerpt: { file: "server.js", snippet: 'fields.next || "/thanks"', count: 3 },
    sinkSnippet: "Location: next",
    patch: [
      "function safeNext(next) {",
      '  const allow = new Set(["/thanks", "/booked"]);',
      "  if (allow.has(next)) return next;",
      '  return "/thanks";',
      "}",
      "",
      "// POST /book",
      "const next = safeNext(fields.next);",
      'res.writeHead(302, { Location: next });',
    ],
    patchNote:
      "The observed result is a Location header off the shop origin. The finding stops there. It does not claim the hop steals a session.",
    trace: [
      {
        role: "entrypoint",
        file: "server.js",
        snippet: 'fields.next || "/thanks"',
        caption: "The form field next is used as the redirect target whenever it is non-empty.",
      },
      {
        role: "sink",
        file: "server.js",
        snippet: "Location: next",
        caption: "That string is the Location header. The obvious-things pass looks for this parameter by name.",
      },
    ],
    run(fixed) {
      const result = redirectTo(this.input, fixed);
      return {
        safe: result.safe,
        request: this.request,
        inputLabel: this.inputLabel,
        input: this.input,
        extraLabel: "Location",
        extra: result.location,
        observed: result.observed,
      };
    },
  },
  {
    id: "export-auth",
    wave: 1,
    verdict: "confirmed",
    severity: "high",
    impact: "high",
    confidence: "high",
    fingerprint: "admin.export.missing-auth",
    title: "The job export has no session check",
    attackClass: "Access control",
    classRef: "ATTACK-CLASSES.md#Access control",
    principal: "Anyone who can request the export URL",
    invariant: "Only a dispatcher may download every job.",
    rootCause:
      "GET /admin/export calls exportJobs with no session argument. The handler returns every row. The jobs page next to it does check req.session. This route does not.",
    vector: "A request with no cookie receives both dummy customers' names, phones, and addresses.",
    remediation:
      "Pass the session in and reject the call unless the role is dispatcher. Check it in exportJobs, where the rows are read.",
    request: "GET /admin/export",
    inputLabel: "session",
    input: "(no cookie)",
    excerpt: { file: "lib/admin.js", snippet: "function exportJobs()", count: 5 },
    sinkSnippet: "function exportJobs()",
    patch: [
      "function exportJobs(session) {",
      '  if (!session || session.role !== "dispatcher") {',
      '    const error = new Error("dispatcher only");',
      "    error.status = 401;",
      "    throw error;",
      "  }",
      "  return jobs.rows",
      "    .map((row) => [row.name, row.phone, row.address, row.note].join(\", \"))",
      '    .join("\\n");',
      "}",
      "",
      "// GET /admin/export passes req.session and sends 401 on that error.",
    ],
    patchNote: "The route beside this one requires a session. Export never gained that check.",
    trace: [
      {
        role: "entrypoint",
        file: "server.js",
        snippet: 'pathname === "/admin/export"',
        caption: "The export route is registered with no read of req.session.",
      },
      {
        role: "propagation",
        file: "server.js",
        snippet: "exportJobs()",
        caption: "The call passes no principal into the function that reads the rows.",
      },
      {
        role: "sink",
        file: "lib/admin.js",
        snippet: "function exportJobs()",
        caption: "The function maps every job into the response body.",
      },
    ],
    run(fixed) {
      const result = exportCsv(null, fixed);
      return {
        safe: result.safe,
        request: this.request,
        inputLabel: this.inputLabel,
        input: this.input,
        extraLabel: "Status",
        extra: String(result.status),
        observed: result.observed,
      };
    },
  },
  {
    id: "debug-default",
    wave: 1,
    verdict: "confirmed",
    severity: "low",
    impact: "low",
    confidence: "high",
    fingerprint: "config.debug.default-on",
    title: "Debug stays on when DEBUG is unset, and the query prints a stack",
    attackClass: "Obvious things",
    classRef: "ATTACK-CLASSES.md#Obvious things",
    principal: "Anyone who can request a URL that no earlier route claimed",
    invariant: "A stack and the last SQL text are returned only when debug was explicitly turned on.",
    rootCause:
      "config.debug is true whenever process.env.DEBUG is not the string 0. An unset variable therefore turns it on. The fall-through route sends lastQuery.sql and a new Error stack when ?debug=1.",
    vector:
      "Book with a normal phone, then request any unmatched path with ?debug=1. The body contains the lookup SQL and a stack that names server.js.",
    remediation: 'Set debug from process.env.DEBUG === "1", so an unset variable leaves it off.',
    request: "GET /nope?debug=1   (DEBUG unset, after a normal booking)",
    inputLabel: "debug",
    input: "1",
    excerpt: { file: "config.js", snippet: 'DEBUG !== "0"', count: 4 },
    sinkSnippet: 'DEBUG !== "0"',
    patch: ['  debug: process.env.DEBUG === "1",'],
    patchNote:
      "This is a confirmed disclosure of internals: the SQL text and a stack. It is low because that is the whole demonstrated result.",
    trace: [
      {
        role: "entrypoint",
        file: "server.js",
        snippet: 'searchParams.get("debug")',
        caption: "A request that matched no earlier route can still set ?debug=1.",
      },
      {
        role: "propagation",
        file: "config.js",
        snippet: 'DEBUG !== "0"',
        caption: "The flag is on when the environment variable is missing. That is the default, not an explicit choice.",
      },
      {
        role: "sink",
        file: "server.js",
        snippet: "lastQuery.sql",
        caption: "The response body is the last lookup SQL plus a stack from new Error.",
      },
    ],
    run(fixed) {
      const result = debugResponse(fixed);
      return {
        safe: result.safe,
        request: this.request,
        inputLabel: this.inputLabel,
        input: this.input,
        extraLabel: "DEBUG",
        extra: "(unset)",
        observed: result.observed,
      };
    },
  },
  {
    id: "idor-job",
    wave: 2,
    verdict: "confirmed",
    severity: "high",
    impact: "high",
    confidence: "high",
    fingerprint: "admin.job.missing-owner",
    title: "A signed-in customer can read another customer's job by id",
    attackClass: "Access control",
    classRef: "ATTACK-CLASSES.md#Access control",
    principal: "A signed-in customer",
    invariant: "A customer may read their own job. A dispatcher may read any job. The id alone does not grant the row.",
    rootCause:
      "GET /admin/jobs returns 401 when req.session is missing, and wave 1 treated that as the whole control. getJob receives the session and never reads it. The row filter is the id.",
    vector:
      "Sign in as Ada, then request job_ben. The response is Ben's phone and address.",
    remediation:
      "After the row is found, return it only when the session is the dispatcher or job.customerId is the session's customer. Return null otherwise, the same body as an unknown id.",
    request: "GET /admin/jobs?id=job_ben",
    inputLabel: "session",
    input: "customer ada",
    excerpt: { file: "lib/admin.js", snippet: "function getJob(id, session)", count: 3 },
    sinkSnippet: "row.id === id",
    patch: [
      "function getJob(id, session) {",
      "  const job = jobs.rows.find((row) => row.id === id) || null;",
      "  if (!job) return null;",
      "  const ownJob = job.customerId === session.customerId;",
      '  if (session.role !== "dispatcher" && !ownJob) return null;',
      "  return job;",
      "}",
    ],
    patchNote:
      "The login check on the route stays. This patch is the missing owner comparison, at the read itself. A different root cause gets its own fingerprint, which is why the export bug did not cover this one.",
    trace: [
      {
        role: "entrypoint",
        file: "server.js",
        snippet: "getJob(id, req.session)",
        caption: "The route has already required some session. It then forwards the query id.",
      },
      {
        role: "propagation",
        file: "lib/admin.js",
        snippet: "function getJob(id, session)",
        caption: "The session parameter arrives. Nothing in the function reads session.customerId or session.role.",
      },
      {
        role: "sink",
        file: "lib/admin.js",
        snippet: "row.id === id",
        caption: "The only decision left is whether the id matches a row.",
      },
    ],
    run(fixed) {
      const result = readJob("job_ben", ada, fixed);
      return {
        safe: result.safe,
        request: this.request,
        inputLabel: this.inputLabel,
        input: this.input,
        extraLabel: "Status",
        extra: String(result.status),
        observed: result.observed,
      };
    },
  },
  {
    id: "fax-path",
    wave: 2,
    verdict: "confirmed",
    severity: "high",
    impact: "high",
    confidence: "high",
    fingerprint: "fax.name.path-concat",
    title: "The fax retry builds a path from the query name",
    attackClass: "Resource and file handling",
    classRef: "ATTACK-CLASSES.md#Resource and file handling",
    principal: "Anyone who can post the retry URL",
    invariant: "The retry may read only a single file name inside /app/uploads.",
    rootCause:
      "savePhoto runs path.basename on the upload header, and wave 1 closed file handling there. resendFax concatenates req query name onto uploadRoot. path.join is not used, and basename is not either. The route also has no session check.",
    vector:
      "The name ../marker.txt normalizes to /app/marker.txt, outside the upload root.",
    remediation:
      "Accept the name only when it is already a single segment, then join it to the upload root. path.basename does that drop. path.join by itself does not: joining ../marker.txt still leaves the root.",
    request: "POST /fax/retry?name=../marker.txt",
    inputLabel: "name",
    input: "../marker.txt",
    excerpt: { file: "lib/uploads.js", snippet: "function resendFax(name)", count: 4 },
    sinkSnippet: 'uploadRoot + "/" + name',
    patch: [
      "function resendFax(name) {",
      '  const base = path.basename(name || "");',
      '  if (!base || base !== name) {',
      '    throw new Error("fax name must stay inside uploads");',
      "  }",
      "  const dest = path.join(config.uploadRoot, base);",
      "  return fs.readFileSync(dest);",
      "}",
    ],
    patchNote:
      "Same control savePhoto already has, applied on the sibling path. The fixture stops when the normalized path leaves /app/uploads.",
    trace: [
      {
        role: "entrypoint",
        file: "server.js",
        snippet: 'searchParams.get("name")',
        caption: "POST /fax/retry takes the file name from the query string. No session is read.",
      },
      {
        role: "propagation",
        file: "server.js",
        snippet: "resendFax(name)",
        caption: "The query value is passed through unchanged.",
      },
      {
        role: "sink",
        file: "lib/uploads.js",
        snippet: 'uploadRoot + "/" + name',
        caption: "The sink is a filesystem path built by concatenation, then readFileSync.",
      },
    ],
    run(fixed) {
      const result = faxPath(this.input, fixed);
      return {
        safe: result.safe,
        request: this.request,
        inputLabel: this.inputLabel,
        input: this.input,
        extraLabel: "Resolved path",
        extra: result.path || "(rejected)",
        observed: result.observed,
      };
    },
  },
  {
    id: "forwarded-host",
    wave: 1,
    verdict: "needs_validation",
    fingerprint: "link.host.x-forwarded-host",
    title: "Booking links take their host from X-Forwarded-Host",
    attackClass: "Host and forwarded-header trust",
    classRef: "WEB-PROTOCOL-AND-AUTH.md#Host and forwarded-header trust",
    principal: "A caller who can supply request headers, if the proxy does not overwrite this one",
    invariant: "The host in an absolute booking link is chosen by the shop's own edge, not by a client header.",
    claimed:
      "If a client can set X-Forwarded-Host, bookingLink points at that host. The repo cannot show whether the client can set it.",
    blocker:
      "trustProxy is true and absoluteHost returns the header when it is present. No file in the repo is a proxy or ingress config that overwrites a client-supplied X-Forwarded-Host. That fact decides the finding, and it is not in source.",
    plan: "The owner reads the ingress config and checks whether a client-supplied X-Forwarded-Host is overwritten before Node sees it. Do not send requests at a deployed host. A local string fixture cannot stand in for the missing proxy.",
    excerpt: { file: "server.js", snippet: "function absoluteHost(req)", count: 7 },
    sinkSnippet: 'config.trustProxy && req.headers["x-forwarded-host"]',
    trace: [
      {
        role: "entrypoint",
        file: "server.js",
        snippet: 'config.trustProxy && req.headers["x-forwarded-host"]',
        caption: "absoluteHost reads the header when trustProxy is on.",
      },
      {
        role: "propagation",
        file: "config.js",
        snippet: "trustProxy: true",
        caption: "The flag that enables the header branch is set in source. The proxy that should sanitize the header is not.",
      },
      {
        role: "sink",
        file: "server.js",
        snippet: '"/status?job=new"',
        caption: "bookingLink puts that host into an https URL stored on X-Booking-Link.",
      },
    ],
  },
  {
    id: "dep-float",
    wave: 1,
    verdict: "rejected",
    fingerprint: "deps.image-rotate.floated",
    title: "image-rotate at star is a vulnerable dependency",
    attackClass: "Obvious things",
    classRef: "ATTACK-CLASSES.md#Obvious things",
    principal: "Nobody identified. The package name is not a principal.",
    invariant: "A finding needs a reached trust boundary, not only a dependency that is unpinned.",
    claimed: "The star range means the install can move, so the shop is vulnerable.",
    reason:
      "package.json floats image-rotate and the repo has no lockfile. Nothing in source names a malicious or broken version, and this run does not contact a registry. There is also no install script, CI workflow, or build output that consumes it. A floating range with no reached boundary is a hardening note. The candidate is rejected so a later run does not file the same claim against unchanged source.",
    excerpt: { file: "package.json", snippet: '"image-rotate"', count: 6 },
    sinkSnippet: '"image-rotate"',
    trace: [
      {
        role: "entrypoint",
        file: "package.json",
        snippet: '"image-rotate"',
        caption: "The only dependency file is this manifest. No workflow installs it.",
      },
    ],
  },
];

export const findings = draft.map(withLines);

export function findingById(id) {
  const found = findings.find((item) => item.id === id);
  if (!found) throw new Error("unknown finding " + id);
  return found;
}

export function runFinding(id, fixed) {
  const finding = findingById(id);
  if (!finding.run) return null;
  return finding.run(fixed);
}

export const sources = [
  { kind: "Form field", name: "phone", where: "POST /book", goes: "findDuplicate in lib/booking.js", file: "lib/booking.js" },
  { kind: "Form field", name: "address", where: "POST /book", goes: "printTicket in lib/tickets.js", file: "lib/tickets.js" },
  { kind: "Form field", name: "next", where: "POST /book", goes: "Location on the booking response", file: "server.js" },
  { kind: "Form field", name: "name", where: "POST /book", goes: "bound parameter on the insert", file: "lib/booking.js" },
  { kind: "Form field", name: "note", where: "POST /book", goes: "bound parameter on the insert", file: "lib/booking.js" },
  { kind: "Query", name: "msg", where: "the status page", goes: "innerHTML in public/status.js", file: "public/status.js" },
  { kind: "Query", name: "debug", where: "a path no earlier route took", goes: "stack and last SQL in server.js", file: "config.js" },
  { kind: "Query", name: "id", where: "GET /admin/jobs", goes: "getJob in lib/admin.js", file: "lib/admin.js" },
  { kind: "Query", name: "name", where: "POST /fax/retry", goes: "resendFax in lib/uploads.js", file: "lib/uploads.js" },
  { kind: "Header", name: "x-file-name", where: "POST /upload", goes: "savePhoto in lib/uploads.js", file: "lib/uploads.js" },
  { kind: "Header", name: "x-forwarded-host", where: "absoluteHost", goes: "the host in bookingLink", file: "server.js" },
];

export const wave1Covered = [
  {
    title: "POST /upload · x-file-name",
    result: "savePhoto keeps path.basename of the header, then joins the upload root. Marked covered.",
  },
  {
    title: "POST /book · name and note",
    result: "createBooking binds both values. Marked covered.",
  },
  {
    title: "GET /admin/jobs · session",
    result: "A missing session gets 401. Marked covered.",
  },
];

export const phases = [
  {
    n: "1",
    name: "Reconnaissance",
    text: "Map the shop, the principals, every place outside input enters, and the controls source actually shows.",
  },
  {
    n: "2",
    name: "Coverage-led hunting",
    text: "Follow each assigned input through to a sink. A coverage critic then looks for paths the wave marked done without tracing.",
  },
  {
    n: "3",
    name: "Candidate validation",
    text: "A fresh reviewer, not the hunter, tries to disprove each candidate against the source and a bounded fixture.",
  },
  {
    n: "4",
    name: "Structured output",
    text: "Write confirmed, needs_validation, and rejected records. Only a confirmed record gets a severity.",
  },
  {
    n: "5",
    name: "Independent record verification",
    text: "Another fresh pass checks the written record against the lines, the fixture, and the patch.",
  },
  {
    n: "6",
    name: "Target-neutral report",
    text: "The write-up is derived from those records. It does not add a plan for poking a live shop.",
  },
];

export const hardening = [
  "Pin image-rotate to a version the shop has reviewed, and commit a lockfile. That note stays hardening: the floated range was rejected as a finding.",
  "Until a proxy config is part of the repo, booking links can use the host the app already falls back to, oakleypipe.example, and ignore X-Forwarded-Host. That is a hardening option, not a confirmed patch, because the header's trust is the open lead.",
];

export const positives = [
  "createBooking keeps the INSERT text constant and binds name, note, phone, and address.",
  "savePhoto takes path.basename of x-file-name before path.join. A header of ../leak.jpg lands at /app/uploads/leak.jpg.",
  "GET /admin/jobs really does return 401 when the session is missing. The hole is the owner check behind that login, which is a different control.",
];

const SEVERITY_ORDER = ["informational", "low", "medium", "high", "critical"];
const FINGERPRINT = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;

function severityRank(value) {
  return SEVERITY_ORDER.indexOf(value);
}

export function validateRecords(list = findings) {
  const errors = [];
  const seen = new Set();
  for (const finding of list) {
    if (seen.has(finding.fingerprint)) errors.push("duplicate fingerprint " + finding.fingerprint);
    seen.add(finding.fingerprint);
    if (!FINGERPRINT.test(finding.fingerprint)) errors.push("bad fingerprint " + finding.fingerprint);
    if (/:\d/.test(finding.fingerprint)) errors.push("fingerprint includes a line " + finding.fingerprint);
    if (finding.verdict === "confirmed") {
      if (!SEVERITY_ORDER.includes(finding.severity)) errors.push("bad severity " + finding.id);
      if (severityRank(finding.severity) > severityRank(finding.impact)) {
        errors.push("severity above impact " + finding.id);
      }
      if (!finding.rootCause || !finding.vector || !finding.remediation || !finding.patch?.length) {
        errors.push("incomplete confirmed record " + finding.id);
      }
    } else if (finding.severity) {
      errors.push("severity on " + finding.verdict + " " + finding.id);
    }
    if (finding.verdict === "needs_validation" && (!finding.blocker || !finding.plan)) {
      errors.push("missing blocker or plan " + finding.id);
    }
    if (finding.verdict === "rejected" && !finding.reason) errors.push("missing reason " + finding.id);
    if (finding.trace.length === 1) {
      const only = finding.trace[0].role;
      if (only !== "entrypoint" && only !== "sink") errors.push("one-step role " + finding.id);
    } else {
      if (finding.trace[0].role !== "entrypoint") errors.push("trace start " + finding.id);
      if (finding.trace[finding.trace.length - 1].role !== "sink") errors.push("trace end " + finding.id);
      for (const step of finding.trace.slice(1, -1)) {
        if (step.role !== "propagation") errors.push("trace middle " + finding.id);
      }
    }
    for (const step of finding.trace) {
      const line = files[step.file]?.[step.line - 1];
      if (!line || !line.includes(step.snippet)) errors.push(`trace miss ${finding.id} ${step.file}:${step.line}`);
    }
  }
  return errors;
}

export function verifyRecord(id) {
  const finding = findingById(id);
  const checks = [];
  const linesOk = finding.trace.every((step) => files[step.file][step.line - 1].includes(step.snippet));
  checks.push({
    name: "The cited lines are real",
    ok: linesOk,
    detail: finding.trace.map((step) => `${step.file}:${step.line}`).join(", "),
  });
  if (finding.verdict === "confirmed") {
    const broken = finding.run(false);
    const patched = finding.run(true);
    checks.push({
      name: "The fixture input breaks the unpatched path",
      ok: broken.safe === false,
      detail: broken.observed,
    });
    checks.push({
      name: "The same input holds on the patch",
      ok: patched.safe === true,
      detail: patched.observed,
    });
    checks.push({
      name: "Severity stays within the impact the fixture showed",
      ok: severityRank(finding.severity) <= severityRank(finding.impact) && severityRank(finding.severity) >= 0,
      detail: `${finding.severity} severity, ${finding.impact} impact.`,
    });
    checks.push({
      name: "The patch is the remediation, and it is non-empty",
      ok: Boolean(finding.remediation) && finding.patch.length > 0,
      detail: finding.remediation,
    });
  } else if (finding.verdict === "needs_validation") {
    checks.push({
      name: "The record stays unrated",
      ok: !finding.severity,
      detail: "needs_validation has a blocker and a plan, and no severity.",
    });
    checks.push({
      name: "The plan asks an owner to observe config",
      ok: /Do not send requests/.test(finding.plan) && Boolean(finding.blocker),
      detail: finding.plan,
    });
  } else {
    checks.push({
      name: "The rejection names what the claim got wrong",
      ok: Boolean(finding.reason) && !finding.severity,
      detail: finding.reason,
    });
  }
  return checks;
}

export function sinkLabel(finding) {
  const sink = finding.trace[finding.trace.length - 1];
  return `${sink.file}:${sink.line}`;
}
