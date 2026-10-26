import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  debugResponse,
  exportCsv,
  faxPath,
  fileBase,
  files,
  findingById,
  findings,
  lookupByPhone,
  normalizePosix,
  readJob,
  redirectTo,
  rows,
  runFinding,
  savedPhotoPath,
  sources,
  statusRender,
  ticketCommand,
  validateRecords,
  verifyRecord,
} from "./model.js";

const ada = { customerId: "ada", role: "customer" };
const dispatcher = { customerId: "ada", role: "dispatcher" };

test("shop files resolve and records match the verdict rules", () => {
  assert.equal(validateRecords().length, 0, validateRecords().join("; "));
  assert.equal(findings.length, 10);
  assert.ok(files["lib/jobs.js"].some((line) => line.includes("Ada Ruiz")));
  assert.ok(files["server.js"].some((line) => line.includes("POST") || line.includes('"/book"')));
});

test("every confirmed fixture breaks, then holds after the patch", () => {
  const confirmed = findings.filter((finding) => finding.verdict === "confirmed");
  assert.equal(confirmed.length, 8);
  for (const finding of confirmed) {
    const broken = runFinding(finding.id, false);
    const fixed = runFinding(finding.id, true);
    assert.equal(broken.safe, false, finding.id);
    assert.equal(fixed.safe, true, finding.id);
    assert.equal(verifyRecord(finding.id).every((check) => check.ok), true, finding.id);
  }
});

test("phone lookup distinguishes a tautology, a bare quote, and a real phone", () => {
  const dumped = lookupByPhone("555-0100' OR '1'='1", false);
  assert.equal(dumped.safe, false);
  assert.equal(dumped.rows.length, 2);
  assert.match(dumped.sql, /OR '1'='1'/);

  const bound = lookupByPhone("555-0100' OR '1'='1", true);
  assert.equal(bound.safe, true);
  assert.equal(bound.rows.length, 0);
  assert.match(bound.sql, /\?$/);

  const adaRow = lookupByPhone("555-0101", false);
  assert.equal(adaRow.safe, true);
  assert.deepEqual(adaRow.rows.map((row) => row.id), ["job_ada"]);

  const adaBound = lookupByPhone("555-0144", true);
  assert.equal(adaBound.rows.length, 1);
  assert.equal(adaBound.rows[0].name, "Ben Cho");

  const weird = lookupByPhone("555-0101'", false);
  assert.equal(weird.safe, false);
  assert.equal(weird.rows.length, 0);
});

test("shell, html, and redirect fixtures stay specific", () => {
  assert.equal(ticketCommand("18 Rookwood Lane", false).safe, true);
  assert.equal(ticketCommand("Oakley; echo marker", false).safe, false);
  assert.deepEqual(ticketCommand("Oakley; echo marker", true).argv, ["lp", "-t", "Oakley; echo marker"]);

  assert.equal(statusRender("We have your booking.", false).safe, true);
  assert.equal(statusRender('<img src="x" onerror="marker">', false).safe, false);
  assert.equal(statusRender('<img src="x" onerror="marker">', true).safe, true);

  assert.equal(redirectTo("/thanks", false).safe, true);
  assert.equal(redirectTo("https://example.invalid/out", false).location, "https://example.invalid/out");
  assert.equal(redirectTo("https://example.invalid/out", true).location, "/thanks");
  assert.equal(redirectTo("/booked", true).location, "/booked");
});

test("auth fixtures cover the export, the owner check, and a missing session", () => {
  assert.equal(exportCsv(null, false).safe, false);
  assert.match(exportCsv(null, false).observed, /Ada Ruiz/);
  assert.match(exportCsv(null, false).observed, /Ben Cho/);
  assert.equal(exportCsv(null, true).status, 401);
  assert.equal(exportCsv(dispatcher, true).status, 200);

  assert.equal(readJob("job_ben", ada, false).safe, false);
  assert.match(readJob("job_ben", ada, false).observed, /402 Millcreek Court/);
  assert.equal(readJob("job_ben", ada, true).safe, true);
  assert.match(readJob("job_ben", ada, true).observed, /null/);
  assert.equal(readJob("job_ada", ada, false).safe, true);
  assert.equal(readJob("job_ben", dispatcher, false).safe, true);
  assert.equal(readJob("job_ben", null, false).status, 401);
});

test("fax paths escape only the concatenated retry", () => {
  assert.equal(normalizePosix("/app/uploads/../marker.txt"), "/app/marker.txt");
  assert.equal(normalizePosix("/app/uploads/../../marker.txt"), "/marker.txt");
  assert.equal(normalizePosix("/app/uploads/leak.jpg"), "/app/uploads/leak.jpg");
  assert.equal(fileBase("../marker.txt"), "marker.txt");
  assert.equal(fileBase("a\\b.jpg"), "b.jpg");

  const escaped = faxPath("../marker.txt", false);
  assert.equal(escaped.safe, false);
  assert.equal(escaped.path, "/app/marker.txt");
  assert.equal(faxPath("../marker.txt", true).safe, true);
  assert.equal(faxPath("../marker.txt", true).path, null);
  assert.equal(faxPath("leak.jpg", false).path, "/app/uploads/leak.jpg");
  assert.equal(faxPath("foo/../../marker.txt", false).path, "/app/marker.txt");

  assert.equal(savedPhotoPath("../leak.jpg"), "/app/uploads/leak.jpg");
  assert.equal(savedPhotoPath("leak.jpg"), "/app/uploads/leak.jpg");
});

test("debug default is the bug, and unrated records stay unrated", () => {
  assert.match(debugResponse(false).observed, /555-0101/);
  assert.equal(debugResponse(false).safe, false);
  assert.equal(debugResponse(true).safe, true);

  const host = findingById("forwarded-host");
  const dep = findingById("dep-float");
  assert.equal(host.verdict, "needs_validation");
  assert.equal(host.severity, undefined);
  assert.equal(dep.verdict, "rejected");
  assert.equal(dep.severity, undefined);
  assert.equal(verifyRecord("forwarded-host").every((check) => check.ok), true);
  assert.equal(verifyRecord("dep-float").every((check) => check.ok), true);
});

test("the inventory lists the inputs the prompt asked to trace", () => {
  const kinds = new Set(sources.map((source) => source.kind));
  assert.deepEqual([...kinds], ["Form field", "Query", "Header"]);
  for (const name of ["phone", "address", "next", "note", "msg", "id", "name", "x-file-name", "x-forwarded-host", "debug"]) {
    assert.ok(sources.some((source) => source.name === name), name);
  }
  assert.equal(rows.length, 2);
});

test("the lab index links this demo", () => {
  const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(index, /demos\/2026-10-26-untrusted-input-tracer\//);
  assert.match(index, /franzbruckhoff\/status\/2113401002355298410/);
  const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  assert.match(page, /cloudflare\/security-audit-skill/);
  assert.match(page, /2113401002355298410/);
});
