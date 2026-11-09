import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.AuditPhases;
}

const audit = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const model = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("the lab index links this demo and the CloudflareDev post", () => {
  assert.match(index, /demos\/2026-11-08-security-audit-phases\//);
  assert.match(index, /CloudflareDev\/status\/2118013149538390253/);
  assert.match(index, /6-phase audit/);
  assert.match(index, /Cincinnati/);
  assert.match(index, /Source post/);
});

test("the page names the shop, the source, and the simulation", () => {
  assert.match(page, /Hilltop Homebook/);
  assert.match(page, /Cincinnati/);
  assert.match(page, /Simulation/);
  assert.match(page, /not a scanner/);
  assert.match(page, /Cloudflare Developers/);
  assert.match(page, /CloudflareDev\/status\/2118013149538390253/);
  assert.match(page, /github.com\/cloudflare\/security-audit-skill/);
  assert.match(page, /What to steal for your own agent workflow/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /data-mode="scan"/);
  assert.match(page, /data-mode="audit"/);
  for (const name of [
    "Map the codebase",
    "Hunt for vulnerabilities",
    "Challenge each candidate",
    "Record the findings",
    "Verify the findings",
    "Report what's confirmed, rejected, or still needs validation",
  ]) {
    assert.match(page, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(page + app + model, /Oakley/);
  assert.doesNotMatch(page + app + model, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|innerHTML/);
  assert.doesNotMatch(page + app + model, /sk-|AKIA|ghp_|xoxb-/);
});

test("the stylesheet keeps tap targets large enough for a phone", () => {
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /viewport-fit|env\(safe-area-inset/);
});

function host(list, pick) {
  return Array.from(list, pick);
}

test("the six phases use the post's names and the skill's names", () => {
  assert.deepEqual(
    host(audit.PHASES, (phase) => phase.name),
    [
      "Map the codebase",
      "Hunt for vulnerabilities",
      "Challenge each candidate",
      "Record the findings",
      "Verify the findings",
      "Report what's confirmed, rejected, or still needs validation",
    ]
  );
  assert.deepEqual(
    host(audit.PHASES, (phase) => phase.skill),
    [
      "Reconnaissance",
      "Coverage-led hunting",
      "Candidate validation",
      "Structured output",
      "Independent record verification",
      "Target-neutral reporting",
    ]
  );
  audit.PHASES.forEach((phase) => assert.ok(phase.lede.length > 20));
});

test("five canned files cover the scan traps and the real issues", () => {
  assert.equal(audit.FILES.length, 5);
  assert.equal(audit.SHOP.name, "Hilltop Homebook");
  assert.equal(audit.SHOP.place, "Cincinnati");
  const admin = audit.fileById("admin");
  const sql = audit.fileById("sql");
  const key = audit.fileById("key");
  const note = audit.fileById("note");
  const exp = audit.fileById("export");
  assert.match(admin.code, /\/admin\/bookings/);
  assert.doesNotMatch(admin.code, /requireStaff/);
  assert.match(sql.code, /neighborhood \+/);
  assert.match(sql.code, /db\.exec\(sql\)/);
  assert.match(key.code, /hilltop-demo-token-not-live/);
  assert.match(note.code, /escapeHtml\(note\)/);
  assert.match(note.code, /replaceAll\("<", "&lt;"\)/);
  assert.match(exp.code, /staffRouter\.use\(requireStaff\)/);
  assert.match(exp.code, /\/export\.csv/);
  assert.equal(exp.title, "False-positive trap");
  assert.equal(key.title, "Hardcoded fake key");
});

test("the scan flags every file high, including both false positives", () => {
  const hits = audit.scan();
  assert.equal(hits.length, 5);
  assert.ok(hits.every((hit) => hit.severity === "High"));
  assert.ok(hits.some((hit) => hit.id === "note" && hit.headline === "HTML injection"));
  assert.ok(hits.some((hit) => hit.id === "export" && hit.headline === "Missing authentication"));
  assert.ok(hits.some((hit) => hit.id === "key" && hit.headline === "Hardcoded secret"));
  assert.equal(audit.fileById("admin").scan.headline, "Missing authentication");
  assert.equal(audit.fileById("sql").scan.headline, "SQL injection");
});

test("phase 3 rejects the trap and the sanitized note, and the report groups the rest", () => {
  const rejected = host(
    audit.FILES.filter((file) => file.challenge.outcome === "rejected"),
    (file) => file.id
  );
  assert.deepEqual(rejected, ["note", "export"]);
  assert.equal(audit.fileById("admin").challenge.outcome, "stands");
  assert.equal(audit.fileById("sql").challenge.outcome, "stands");
  assert.equal(audit.fileById("key").challenge.outcome, "open");

  const groups = audit.report();
  assert.deepEqual(host(groups.confirmed, (file) => file.id), ["admin", "sql"]);
  assert.deepEqual(host(groups.rejected, (file) => file.id), ["note", "export"]);
  assert.deepEqual(host(groups.needsValidation, (file) => file.id), ["key"]);

  for (const file of audit.FILES) {
    assert.equal(file.verify.holds, true);
    if (file.record.verdict === "confirmed") {
      assert.ok(file.record.trace);
      assert.ok(file.record.result);
      assert.ok(file.record.severity);
      assert.equal(file.record.unresolved, null);
    }
    if (file.record.verdict === "rejected") {
      assert.equal(file.record.severity, null);
      assert.ok(file.record.disproof);
    }
    if (file.record.verdict === "needs_validation") {
      assert.equal(file.record.severity, null);
      assert.match(file.record.unresolved, /hilltop-demo-token-not-live/);
    }
  }

  const scores = audit.scoreboard();
  assert.equal(scores.scanFlagged, 5);
  assert.equal(scores.scanRejected, 0);
  assert.equal(scores.scanOpen, 0);
  assert.equal(scores.confirmed, 2);
  assert.equal(scores.rejected, 2);
  assert.equal(scores.needsValidation, 1);
});

test("the verifier corrects the SQL path and does not promote the placeholder token", () => {
  assert.match(audit.fileById("sql").verify.note, /routes\/search\.js/);
  assert.match(audit.fileById("sql").verify.note, /db\/search-visits\.js/);
  assert.match(audit.fileById("key").verify.note, /did not promote/);
  assert.match(audit.fileById("key").verify.note, /no severity/);
  assert.match(app, /data-mode/);
  assert.match(app, /data-phase/);
  assert.match(app, /data-nav/);
});
