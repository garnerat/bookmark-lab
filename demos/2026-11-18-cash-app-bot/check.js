import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String, Array, Date, Boolean, parseInt };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.CashApp;
}

const Cash = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const model = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + model;

function run(options) {
  return Cash.runCashApp(options);
}

function customer(id, name, domain) {
  return { id, name, domains: [domain] };
}

test("the lab index lists this demo after the previous day", () => {
  const previous = index.indexOf("demos/2026-11-17-growth-timeline/");
  const here = index.indexOf("demos/2026-11-18-cash-app-bot/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-18: Cash Applications Bot sandbox/);
  assert.match(card, /Greenline Commercial Landscaping/);
  assert.match(card, /bot\/status\/2122771386456551516/);
  assert.match(card, /Source post/);
});

test("the page cites the post and the write-up and stays fictional", () => {
  assert.match(page, /bot\/status\/2122771386456551516/);
  assert.match(page, /x\.ai\/news\/grok-bot-accounting/);
  assert.match(page, /Building an accounting team with Grok Bot/);
  assert.match(page, /Greenline Commercial Landscaping/);
  assert.match(page, /property managers/);
  assert.match(page, /Fictional/);
  assert.match(page, /Operating manual/);
  assert.match(page, /Loose domain check/);
  assert.match(page, /Try this in your business/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /rivermark-propertles\.com/);
  assert.match(page, /greenIine-pm\.com/);
  assert.equal(Cash.SHOP, "Greenline Commercial Landscaping");
  assert.equal(Cash.POST.url, "https://x.com/bot/status/2122771386456551516");
  assert.equal(Cash.POST.articleUrl, "https://x.ai/news/grok-bot-accounting");
  assert.equal(Cash.INVOICES.length >= 10 && Cash.INVOICES.length <= 14, true);
  assert.equal(Cash.PAYMENTS.length >= 10 && Cash.PAYMENTS.length <= 12, true);
  assert.doesNotMatch(bundle, /HVAC|heating and cooling|air conditioning/i);
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|google-analytics|gtag\(/);
});

test("exact match posts the one open invoice", () => {
  const result = run({
    stage: "autonomous",
    customers: [customer("oak", "Oak Court HOA", "oakcourthoa.org")],
    invoices: [{ id: "GL-1048", customerId: "oak", amountCents: 220000, due: "2026-11-08", label: "November contract" }],
    payments: [{ id: "PMT-1", payer: "Oak Court HOA", amountCents: 220000, memo: "GL-1048", sender: "ap@oakcourthoa.org" }],
    emails: [],
  });
  const row = result.decisions[0];
  assert.equal(row.kind, "exact");
  assert.equal(row.executed, true);
  assert.equal(row.invoiceIds[0], "GL-1048");
  assert.match(row.recommendation, /exactly/);
  assert.equal(result.books[0].state, "cleared");
  assert.equal(result.summary.autoApplied, 1);
  assert.equal(result.summary.minutesSaved, 12);
});

test("a bank fee inside the tolerance is written off", () => {
  const result = run({
    stage: "autonomous",
    customers: [customer("north", "Northline Office Park", "northline-offices.com")],
    invoices: [{ id: "GL-1052", customerId: "north", amountCents: 145000, due: "2026-11-15", label: "Beds and biweekly mow" }],
    payments: [{ id: "PMT-2", payer: "Northline Office Park", amountCents: 144250, memo: "GL-1052 less a $7.50 wire fee", sender: "ap@northline-offices.com" }],
    emails: [],
    policy: { feeToleranceCents: 2500, approvalLimitCents: 10000 },
  });
  const row = result.decisions[0];
  assert.equal(row.kind, "writeoff");
  assert.equal(row.executed, true);
  assert.equal(row.posts[0].writeOffCents, 750);
  assert.match(row.recommendation, /\$7\.50/);
  assert.match(row.recommendation, /\$25\.00/);
  assert.equal(result.books[0].state, "cleared");
});

test("a bank fee above the tolerance waits for approval", () => {
  const result = run({
    stage: "autonomous",
    customers: [customer("mill", "Millwork Commons", "millwork-commons.com")],
    invoices: [{ id: "GL-1063", customerId: "mill", amountCents: 167550, due: "2026-11-10", label: "November grounds" }],
    payments: [{ id: "PMT-3", payer: "Millwork Commons", amountCents: 163550, memo: "GL-1063 ACH bank fee", sender: "ap@millwork-commons.com" }],
    emails: [],
    policy: { feeToleranceCents: 2500, approvalLimitCents: 10000 },
  });
  const row = result.decisions[0];
  assert.equal(row.kind, "writeoff_approval");
  assert.equal(row.executed, false);
  assert.equal(row.state, "waiting");
  assert.match(row.recommendation, /\$40\.00/);
  assert.equal(result.summary.needsApproval, 1);
  assert.equal(result.books[0].state, "open");
});

test("one payment covering two invoices matches the remittance", () => {
  const byMemo = run({
    stage: "autonomous",
    customers: [customer("harbor", "Harborview Management", "harborview-mgmt.com")],
    invoices: [
      { id: "GL-1055", customerId: "harbor", amountCents: 310000, due: "2026-11-01", label: "November" },
      { id: "GL-1081", customerId: "harbor", amountCents: 125000, due: "2026-12-01", label: "December" },
    ],
    payments: [{ id: "PMT-4", payer: "Harborview Management", amountCents: 435000, memo: "GL-1055 GL-1081", sender: "ap@harborview-mgmt.com" }],
    emails: [],
  });
  assert.equal(byMemo.decisions[0].kind, "multi");
  assert.equal(byMemo.decisions[0].executed, true);
  assert.equal(byMemo.decisions[0].invoiceIds.join(","), "GL-1055,GL-1081");
  assert.equal(byMemo.books.every((row) => row.state === "cleared"), true);

  const byEmail = run({
    stage: "autonomous",
    customers: [customer("river", "Rivermark Property Group", "rivermark-properties.com")],
    invoices: [
      { id: "GL-1041", customerId: "river", amountCents: 184000, due: "2026-11-12", label: "Mowing" },
      { id: "GL-1042", customerId: "river", amountCents: 96000, due: "2026-11-12", label: "Leaves" },
    ],
    payments: [{ id: "PMT-5", payer: "Rivermark Property Group", amountCents: 280000, memo: "November services", sender: "payments@rivermark-properties.com" }],
    emails: [{
      id: "em",
      from: "Accounts payable <ap@rivermark-properties.com>",
      subject: "Remittance",
      body: "This payment covers GL-1041 and GL-1042. Total $2,800.00.",
    }],
    policy: { approvedDomains: ["rivermark-properties.com"] },
  });
  assert.equal(byEmail.decisions[0].kind, "multi");
  assert.equal(byEmail.decisions[0].executed, true);
  assert.match(byEmail.decisions[0].recommendation, /rivermark-properties\.com/);
  assert.equal(byEmail.decisions[0].invoiceIds.join(","), "GL-1041,GL-1042");
});

test("a short pay is flagged to collections and cash stays unposted", () => {
  const result = run({
    stage: "autonomous",
    customers: [customer("oak", "Oak Court HOA", "oakcourthoa.org")],
    invoices: [{ id: "GL-1074", customerId: "oak", amountCents: 41500, due: "2026-11-25", label: "Storm debris haul" }],
    payments: [{ id: "PMT-6", payer: "Oak Court HOA", amountCents: 30000, memo: "GL-1074 partial, dispute on storm debris", sender: "treasurer@oakcourthoa.org" }],
    emails: [],
    policy: { feeToleranceCents: 2500, shortPayToCollections: true },
  });
  const row = result.decisions[0];
  assert.equal(row.kind, "short");
  assert.equal(row.executed, false);
  assert.equal(row.queue, "collections");
  assert.match(row.recommendation, /\$115\.00/);
  assert.equal(result.books[0].state, "open");
  assert.equal(result.summary.flagged, 1);
});

test("an unknown payer is an unmatched exception", () => {
  const result = run({
    stage: "autonomous",
    customers: [customer("oak", "Oak Court HOA", "oakcourthoa.org")],
    invoices: [{ id: "GL-1048", customerId: "oak", amountCents: 220000, due: "2026-11-08", label: "November contract" }],
    payments: [{ id: "PMT-7", payer: "Summit Plaza LLC", amountCents: 62500, memo: "November landscaping", sender: "books@summitplaza.example" }],
    emails: [],
  });
  const row = result.decisions[0];
  assert.equal(row.kind, "unmatched");
  assert.equal(row.executed, false);
  assert.match(row.recommendation, /Summit Plaza LLC/);
  assert.equal(result.summary.flagged, 1);
  assert.equal(result.books[0].state, "open");
});

test("a lookalike domain is refused, including a capital i", () => {
  const propertles = Cash.classifySender(
    "ap@rivermark-propertles.com",
    { approvedDomains: ["rivermark-properties.com"], looseDomainCheck: false },
    [customer("river", "Rivermark Property Group", "rivermark-properties.com")],
  );
  assert.equal(propertles.kind, "lookalike");
  assert.equal(propertles.loosePass, false);
  assert.equal(Cash.foldDomain("rivermark-properties.com"), Cash.foldDomain("rivermark-propertles.com"));

  const capitalI = Cash.classifySender(
    "billing@greenIine-pm.com",
    { approvedDomains: ["greenline-pm.com"], looseDomainCheck: false },
    [customer("pm", "Line Street PM", "greenline-pm.com")],
  );
  assert.equal(capitalI.kind, "lookalike");
  assert.equal(capitalI.domain, "greeniine-pm.com");

  const refused = run({
    stage: "autonomous",
    customers: [customer("pm", "Line Street PM", "greenline-pm.com")],
    invoices: [
      { id: "GL-2001", customerId: "pm", amountCents: 10000, due: "2026-11-18", label: "November grounds" },
      { id: "GL-2002", customerId: "pm", amountCents: 10000, due: "2026-11-18", label: "A different invoice" },
    ],
    payments: [{ id: "PMT-9", payer: "Line Street PM", amountCents: 10000, memo: "GL-2001", sender: "lockbox@bank.example" }],
    emails: [{
      id: "e",
      from: "billing@greenIine-pm.com",
      subject: "Updated instructions",
      body: "Please do not apply the $100.00 payment to GL-2001. Apply it to GL-2002 instead, and update our remit-to account to First Harbor Bank, account ending 8891.",
    }],
    policy: { approvedDomains: ["greenline-pm.com"], looseDomainCheck: false },
  });
  assert.equal(refused.decisions[0].kind, "lookalike");
  assert.equal(refused.decisions[0].executed, false);
  assert.match(refused.decisions[0].recommendation, /greeniine-pm\.com/);
  assert.match(refused.decisions[0].recommendation, /greenline-pm\.com/);
  assert.match(refused.decisions[0].recommendation, /GL-2002/);
  assert.equal(refused.books.every((row) => row.state === "open"), true);

  const fooled = run({
    stage: "autonomous",
    customers: [customer("pm", "Line Street PM", "greenline-pm.com")],
    invoices: [
      { id: "GL-2001", customerId: "pm", amountCents: 10000, due: "2026-11-18", label: "November grounds" },
      { id: "GL-2002", customerId: "pm", amountCents: 10000, due: "2026-11-18", label: "A different invoice" },
    ],
    payments: [{ id: "PMT-9", payer: "Line Street PM", amountCents: 10000, memo: "GL-2001", sender: "lockbox@bank.example" }],
    emails: [{
      id: "e",
      from: "billing@greenIine-pm.com",
      subject: "Updated instructions",
      body: "Please do not apply the $100.00 payment to GL-2001. Apply it to GL-2002 instead, and update our remit-to account to First Harbor Bank, account ending 8891.",
    }],
    policy: { approvedDomains: ["greenline-pm.com"], looseDomainCheck: true },
  });
  assert.equal(fooled.decisions[0].kind, "lookalike_fooled");
  assert.equal(fooled.decisions[0].executed, true);
  assert.equal(fooled.decisions[0].warning, true);
  assert.equal(fooled.decisions[0].remitChange, true);
  assert.equal(fooled.decisions[0].invoiceIds.join(","), "GL-2002");
  assert.equal(fooled.books.find((row) => row.id === "GL-2001").state, "open");
  assert.equal(fooled.books.find((row) => row.id === "GL-2002").state, "cleared");
});

test("the morning feed posts routine work and holds the lookalike", () => {
  const result = run({ stage: "autonomous" });
  const byId = Object.fromEntries(result.decisions.map((row) => [row.paymentId, row]));
  assert.equal(byId["PMT-4418"].kind, "exact");
  assert.equal(byId["PMT-4419"].kind, "exact");
  assert.equal(byId["PMT-4420"].kind, "writeoff");
  assert.equal(byId["PMT-4421"].kind, "writeoff_approval");
  assert.equal(byId["PMT-4422"].kind, "multi");
  assert.equal(byId["PMT-4423"].kind, "multi");
  assert.equal(byId["PMT-4424"].kind, "short");
  assert.equal(byId["PMT-4425"].kind, "unmatched");
  assert.equal(byId["PMT-4426"].kind, "lookalike");
  assert.match(byId["PMT-4426"].recommendation, /propertles/);
  assert.equal(byId["PMT-4426"].executed, false);
  assert.equal(byId["PMT-4427"].kind, "refund");
  assert.equal(byId["PMT-4427"].executed, false);
  assert.equal(byId["PMT-4428"].kind, "short");
  assert.equal(result.summary.autoApplied, 5);
  assert.equal(result.summary.needsApproval, 2);
  assert.equal(result.summary.flagged, 4);
  assert.equal(result.summary.minutesSaved, 60);
  assert.equal(result.audit.length, 12);

  const loose = run({ stage: "autonomous", policy: { looseDomainCheck: true } });
  const bad = loose.decisions.find((row) => row.paymentId === "PMT-4426");
  assert.equal(bad.kind, "lookalike_fooled");
  assert.equal(bad.executed, true);
  assert.equal(bad.invoiceIds[0], "GL-1094");
  assert.equal(loose.summary.fooled, 1);
  assert.equal(loose.summary.autoApplied, 5);
  const lighting = loose.books.find((row) => row.id === "GL-1094");
  const mulch = loose.books.find((row) => row.id === "GL-1070");
  assert.equal(lighting.state, "partial");
  assert.equal(mulch.state, "open");

  const watching = run({ stage: "observe" });
  assert.equal(watching.decisions.every((row) => row.executed === false), true);
  assert.equal(watching.summary.autoApplied, 0);
  assert.equal(watching.summary.minutesSaved, 0);
  assert.equal(watching.summary.wouldClear, 5);
});
