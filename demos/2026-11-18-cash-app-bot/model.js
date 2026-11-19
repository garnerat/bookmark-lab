// Cash-application rules for a fictional grounds company.
// Exact match posts. A small bank fee can write off. Remittance advice
// can tie one payment to several invoices. A lookalike sender domain
// does not count as an approved contact.
(function () {
  const SHOP = "Greenline Commercial Landscaping";
  const POST = {
    handle: "bot",
    id: "2122771386456551516",
    url: "https://x.com/bot/status/2122771386456551516",
    article: "Building an accounting team with Grok Bot",
    articleUrl: "https://x.ai/news/grok-bot-accounting",
    date: "18 Nov 2026",
  };
  const MINUTES_PER_POST = 12;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const CUSTOMERS = [
    { id: "rivermark", name: "Rivermark Property Group", domains: ["rivermark-properties.com"] },
    { id: "oakcourt", name: "Oak Court HOA", domains: ["oakcourthoa.org"] },
    { id: "northline", name: "Northline Office Park", domains: ["northline-offices.com"] },
    { id: "harborview", name: "Harborview Management", domains: ["harborview-mgmt.com"] },
    { id: "cedarridge", name: "Cedar Ridge HOA", domains: ["cedarridgehoa.org"] },
    { id: "millwork", name: "Millwork Commons", domains: ["millwork-commons.com"] },
    { id: "lakeside", name: "Lakeside Property Co.", domains: ["lakeside-property.com"] },
    { id: "pinefold", name: "Pinefold Office Trust", domains: ["pinefold-trust.com"] },
  ];

  const INVOICES = [
    { id: "GL-1041", customerId: "rivermark", amountCents: 184000, due: "2026-11-12", label: "Nov mowing, lots A–C" },
    { id: "GL-1042", customerId: "rivermark", amountCents: 96000, due: "2026-11-12", label: "Leaf removal, lots A–C" },
    { id: "GL-1070", customerId: "rivermark", amountCents: 54000, due: "2026-11-20", label: "Mulch top-off, lot B" },
    { id: "GL-1094", customerId: "rivermark", amountCents: 128000, due: "2026-12-05", label: "Winter lighting, lot C" },
    { id: "GL-1048", customerId: "oakcourt", amountCents: 220000, due: "2026-11-08", label: "November contract" },
    { id: "GL-1074", customerId: "oakcourt", amountCents: 41500, due: "2026-11-25", label: "Storm debris haul" },
    { id: "GL-1052", customerId: "northline", amountCents: 145000, due: "2026-11-15", label: "Beds and biweekly mow" },
    { id: "GL-1077", customerId: "northline", amountCents: 26000, due: "2026-11-28", label: "Irrigation winterize" },
    { id: "GL-1055", customerId: "harborview", amountCents: 310000, due: "2026-11-01", label: "November, three sites" },
    { id: "GL-1081", customerId: "harborview", amountCents: 125000, due: "2026-12-01", label: "December prebill, three sites" },
    { id: "GL-1059", customerId: "cedarridge", amountCents: 78000, due: "2026-11-18", label: "Leaf haul" },
    { id: "GL-1063", customerId: "millwork", amountCents: 167550, due: "2026-11-10", label: "November grounds" },
    { id: "GL-1066", customerId: "lakeside", amountCents: 89000, due: "2026-11-20", label: "Irrigation check" },
    { id: "GL-1088", customerId: "pinefold", amountCents: 210000, due: "2026-11-06", label: "November grounds, campus" },
  ];

  const PAYMENTS = [
    { id: "PMT-4418", payer: "Oak Court HOA", amountCents: 220000, memo: "GL-1048", sender: "ap@oakcourthoa.org" },
    { id: "PMT-4419", payer: "Cedar Ridge HOA", amountCents: 78000, memo: "GL-1059 leaf haul", sender: "treasurer@cedarridgehoa.org" },
    { id: "PMT-4420", payer: "Northline Office Park", amountCents: 144250, memo: "GL-1052 less a $7.50 wire fee", sender: "ap@northline-offices.com" },
    { id: "PMT-4421", payer: "Millwork Commons", amountCents: 163550, memo: "GL-1063 ACH bank fee", sender: "ap@millwork-commons.com" },
    { id: "PMT-4422", payer: "Harborview Management", amountCents: 435000, memo: "GL-1055 GL-1081", sender: "ap@harborview-mgmt.com" },
    { id: "PMT-4423", payer: "Rivermark Property Group", amountCents: 280000, memo: "November services", sender: "payments@rivermark-properties.com" },
    { id: "PMT-4424", payer: "Oak Court HOA", amountCents: 30000, memo: "GL-1074 partial, dispute on storm debris", sender: "treasurer@oakcourthoa.org" },
    { id: "PMT-4425", payer: "Summit Plaza LLC", amountCents: 62500, memo: "November landscaping", sender: "books@summitplaza.example" },
    { id: "PMT-4426", payer: "Rivermark Property Group", amountCents: 54000, memo: "GL-1070", sender: "lockbox@firstharbor.example" },
    { id: "PMT-4427", payer: "Lakeside Property Co.", amountCents: 92000, memo: "GL-1066 plus a $30.00 credit back", sender: "ap@lakeside-property.com" },
    { id: "PMT-4428", payer: "Pinefold Office Trust", amountCents: 190000, memo: "GL-1088 short pay for November", sender: "ap@pinefold-trust.com" },
  ];

  const EMAILS = [
    {
      id: "em-rivermark",
      from: "Accounts payable <ap@rivermark-properties.com>",
      subject: "Remittance advice, 18 Nov",
      body: "November grounds for Rivermark lots A–C. This payment covers GL-1041 and GL-1042. Total $2,800.00.",
    },
    {
      id: "em-harbor",
      from: "Accounts payable <ap@harborview-mgmt.com>",
      subject: "Wire remittance",
      body: "The wire covers GL-1055 and GL-1081. Total $4,350.00.",
    },
    {
      id: "em-northline",
      from: "Accounts payable <ap@northline-offices.com>",
      subject: "GL-1052 wire",
      body: "The bank deducted a wire fee on GL-1052. Total $1,442.50.",
    },
    {
      id: "em-lookalike",
      from: "Accounts payable <ap@rivermark-propertles.com>",
      subject: "Please apply this differently",
      body: "Please do not apply the $540.00 payment to GL-1070. Apply it to GL-1094 instead, and update our remit-to account to First Harbor Bank, account ending 8891.",
    },
  ];

  function defaultDomains() {
    const out = [];
    CUSTOMERS.forEach((customer) => {
      customer.domains.forEach((domain) => out.push(domain));
    });
    return out;
  }

  function formatMoney(cents) {
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(Math.round(cents));
    const whole = String(Math.floor(abs / 100));
    const frac = String(abs % 100).padStart(2, "0");
    const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + "$" + withCommas + "." + frac;
  }

  function formatDate(iso) {
    const parts = String(iso).split("-");
    return Number(parts[2]) + " " + MONTHS[Number(parts[1]) - 1] + " " + parts[0];
  }

  function normName(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function domainOf(email) {
    const text = String(email || "");
    const start = text.lastIndexOf("<");
    const slice = start >= 0 ? text.slice(start + 1) : text;
    const at = slice.lastIndexOf("@");
    if (at < 0) return "";
    return slice.slice(at + 1).replace(/[>\s].*$/, "").trim().toLowerCase();
  }

  function foldDomain(domain) {
    return String(domain || "").trim().toLowerCase().replace(/[il1]/g, "i");
  }

  function extractInvoiceIds(text) {
    const found = [];
    const re = /GL-\d{4}/gi;
    let match;
    while ((match = re.exec(String(text || "")))) {
      const id = match[0].toUpperCase();
      if (found.indexOf(id) === -1) found.push(id);
    }
    return found;
  }

  function parseMoneyToken(whole, frac) {
    return parseInt(String(whole).replace(/,/g, ""), 10) * 100 + parseInt(frac, 10);
  }

  function statedTotal(text) {
    const source = String(text || "");
    const labeled = /total[^$\n]{0,40}\$(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})/i.exec(source);
    if (labeled) return parseMoneyToken(labeled[1], labeled[2]);
    const all = [];
    const re = /\$(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})/g;
    let match;
    while ((match = re.exec(source))) all.push(parseMoneyToken(match[1], match[2]));
    return all.length ? all[all.length - 1] : null;
  }

  function instructedInvoices(text) {
    const source = String(text || "");
    const excluded = [];
    const neg = /do not apply[^.]{0,160}(GL-\d{4})/gi;
    let match;
    while ((match = neg.exec(source))) {
      const id = match[1].toUpperCase();
      if (excluded.indexOf(id) === -1) excluded.push(id);
    }
    const directed = [];
    const dir = /apply (?:it |this payment )?to (GL-\d{4})/gi;
    while ((match = dir.exec(source))) {
      const id = match[1].toUpperCase();
      if (directed.indexOf(id) === -1) directed.push(id);
    }
    if (directed.length) return directed;
    return extractInvoiceIds(source).filter((id) => excluded.indexOf(id) === -1);
  }

  function wantsRemitChange(text) {
    return /remit-to|remit to/i.test(String(text || ""));
  }

  function isFee(text) {
    return /\b(wire fee|bank fee|ach fee|ach bank fee)\b/i.test(String(text || ""));
  }

  function isShort(text) {
    return /\b(short|partial|dispute)\b/i.test(String(text || ""));
  }

  function findCustomer(customers, payer) {
    const name = normName(payer);
    for (let i = 0; i < customers.length; i++) {
      if (normName(customers[i].name) === name) return customers[i];
    }
    return null;
  }

  function customerForDomain(domain, customers) {
    let exact = null;
    let folded = null;
    customers.forEach((customer) => {
      customer.domains.forEach((entry) => {
        if (entry.toLowerCase() === domain) exact = customer;
        else if (foldDomain(entry) === foldDomain(domain)) folded = customer;
      });
    });
    return exact || folded;
  }

  function canonicalDomain(domain, customers) {
    let found = "";
    customers.forEach((customer) => {
      customer.domains.forEach((entry) => {
        if (!found && foldDomain(entry) === foldDomain(domain)) found = entry.toLowerCase();
      });
    });
    return found;
  }

  function classifySender(from, policy, customers) {
    const domain = domainOf(from);
    const list = (policy && policy.approvedDomains) || [];
    const customer = domain ? customerForDomain(domain, customers || []) : null;
    if (!domain) return { domain: "", kind: "unknown", customer: null, loosePass: false };
    const exactApproved = list.some((entry) => String(entry).toLowerCase() === domain);
    if (exactApproved) return { domain, kind: "trusted", customer, loosePass: false };
    const foldedApproved = list.some((entry) => {
      const approved = String(entry).toLowerCase();
      return approved !== domain && foldDomain(approved) === foldDomain(domain);
    });
    const foldedCustomer = !!(customer && customer.domains.some((entry) => {
      return entry.toLowerCase() !== domain && foldDomain(entry) === foldDomain(domain);
    }));
    if (foldedApproved || foldedCustomer) {
      return { domain, kind: "lookalike", customer, loosePass: !!(policy && policy.looseDomainCheck) };
    }
    if (customer && customer.domains.some((entry) => entry.toLowerCase() === domain)) {
      return { domain, kind: "unlisted", customer, loosePass: false };
    }
    return { domain, kind: "unknown", customer: null, loosePass: false };
  }

  function normalizePolicy(input) {
    const src = input || {};
    const domains = Array.isArray(src.approvedDomains)
      ? src.approvedDomains.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean)
      : defaultDomains();
    return {
      feeToleranceCents: clampCents(src.feeToleranceCents, 2500),
      approvalLimitCents: clampCents(src.approvalLimitCents, 10000),
      shortPayToCollections: src.shortPayToCollections !== false,
      looseDomainCheck: src.looseDomainCheck === true,
      approvedDomains: domains,
    };
  }

  function clampCents(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.round(number));
  }

  function autoCap(policy) {
    return Math.min(policy.feeToleranceCents, policy.approvalLimitCents);
  }

  function listIds(ids) {
    if (ids.length === 1) return ids[0];
    if (ids.length === 2) return ids[0] + " and " + ids[1];
    return ids.slice(0, -1).join(", ") + ", and " + ids[ids.length - 1];
  }

  function base(payment, extra) {
    return Object.assign({
      paymentId: payment.id,
      payer: payment.payer,
      amountCents: payment.amountCents,
      memo: payment.memo,
      sender: payment.sender,
      invoiceIds: [],
      posts: [],
      remitChange: false,
      warning: false,
      sensitive: false,
      routine: false,
      bucket: "flag",
      kind: "unmatched",
      recommendation: "",
    }, extra);
  }

  function fullPosts(rows, writeOffCents) {
    return rows.map((invoice) => ({
      invoiceId: invoice.id,
      cents: invoice.amountCents,
      writeOffCents: rows.length === 1 ? writeOffCents : 0,
    }));
  }

  function relatedMail(payment, ctx) {
    const customer = findCustomer(ctx.customers, payment.payer);
    return ctx.emails.map((email) => {
      const text = email.subject + "\n" + email.body;
      return {
        email,
        text,
        total: statedTotal(text),
        sender: classifySender(email.from, ctx.policy, ctx.customers),
      };
    }).filter((item) => {
      if (item.total !== payment.amountCents) return false;
      if (!customer || !item.sender.customer) return false;
      return item.sender.customer.id === customer.id;
    });
  }

  function resolveIds(ids, customer, invoices) {
    const rows = [];
    for (let i = 0; i < ids.length; i++) {
      const invoice = invoices.find((row) => row.id === ids[i]);
      if (!invoice) {
        return { ok: false, reason: ids[i] + " is not an open invoice." };
      }
      if (customer && invoice.customerId !== customer.id) {
        return { ok: false, reason: ids[i] + " belongs to a different customer." };
      }
      rows.push(invoice);
    }
    return { ok: true, rows };
  }

  function decide(payment, ctx) {
    const customer = findCustomer(ctx.customers, payment.payer);
    const memoIds = extractInvoiceIds(payment.memo);
    const related = relatedMail(payment, ctx);
    const hostile = related.filter((item) => item.sender.kind === "lookalike" && !item.sender.loosePass);
    if (hostile.length) return refused(payment, customer, hostile[0], memoIds);

    const fool = related.find((item) => item.sender.kind === "lookalike" && item.sender.loosePass);
    if (fool) return fooled(payment, customer, fool, memoIds);

    const guide = related.find((item) => item.sender.kind === "trusted") || null;
    const blocked = related.find((item) => item.sender.kind === "unlisted") || null;
    let ids = memoIds.slice();
    let via = ids.length ? "memo" : "";
    if (!ids.length && guide) {
      ids = instructedInvoices(guide.text);
      via = "email";
    }

    if (!customer) {
      return base(payment, {
        kind: "unmatched",
        bucket: "flag",
        recommendation: "No customer on the book matches " + payment.payer + " for " + formatMoney(payment.amountCents) + ".",
      });
    }

    if (!ids.length) {
      const open = ctx.invoices.filter((invoice) => invoice.customerId === customer.id);
      if (blocked) {
        const named = instructedInvoices(blocked.text);
        const who = blocked.sender.domain;
        return base(payment, {
          kind: "unmatched",
          bucket: "flag",
          recommendation: "A remittance from " + who + " names " + (named.length ? listIds(named) : "invoices") + ", but that domain is not on the approved list, so " + formatMoney(payment.amountCents) + " was left unmatched.",
        });
      }
      if (open.length === 1) {
        ids = [open[0].id];
        via = "only";
      } else {
        return base(payment, {
          kind: "unmatched",
          bucket: "flag",
          recommendation: customer.name + " paid " + formatMoney(payment.amountCents) + ", and neither the memo nor an approved remittance names an invoice.",
        });
      }
    }

    const resolved = resolveIds(ids, customer, ctx.invoices);
    if (!resolved.ok) {
      return base(payment, {
        kind: "unmatched",
        bucket: "flag",
        invoiceIds: ids,
        recommendation: resolved.reason + " " + formatMoney(payment.amountCents) + " from " + customer.name + " stays in the exception queue.",
      });
    }

    const sum = resolved.rows.reduce((total, invoice) => total + invoice.amountCents, 0);
    const gap = sum - payment.amountCents;
    const guideText = guide ? guide.text : "";
    const fee = isFee(payment.memo) || isFee(guideText);
    const shortWord = isShort(payment.memo) || isShort(guideText);
    const cap = autoCap(ctx.policy);
    const names = listIds(resolved.rows.map((invoice) => invoice.id));

    if (gap === 0 && resolved.rows.length === 1) {
      return base(payment, {
        kind: "exact",
        bucket: "routine",
        routine: true,
        invoiceIds: [resolved.rows[0].id],
        posts: fullPosts(resolved.rows, 0),
        recommendation: formatMoney(payment.amountCents) + " matches open invoice " + names + " exactly.",
      });
    }

    if (gap === 0) {
      const how = via === "email" && guide
        ? "A remittance from " + guide.sender.domain + " lists " + names
        : "The memo names " + names;
      return base(payment, {
        kind: "multi",
        bucket: "routine",
        routine: true,
        invoiceIds: resolved.rows.map((invoice) => invoice.id),
        posts: fullPosts(resolved.rows, 0),
        recommendation: how + ", which add up to the " + formatMoney(payment.amountCents) + " payment.",
      });
    }

    if (resolved.rows.length === 1 && gap > 0 && fee && !shortWord && gap <= cap) {
      return base(payment, {
        kind: "writeoff",
        bucket: "routine",
        routine: true,
        invoiceIds: [resolved.rows[0].id],
        posts: fullPosts(resolved.rows, gap),
        recommendation: "The " + formatMoney(gap) + " gap on " + names + " is a bank fee within the " + formatMoney(cap) + " auto write-off cap.",
      });
    }

    if (resolved.rows.length === 1 && gap > 0 && fee && !shortWord) {
      return base(payment, {
        kind: "writeoff_approval",
        bucket: "approval",
        sensitive: true,
        invoiceIds: [resolved.rows[0].id],
        posts: fullPosts(resolved.rows, gap),
        recommendation: "The " + formatMoney(gap) + " gap on " + names + " is a bank fee above the " + formatMoney(cap) + " auto write-off cap, so a person has to approve it.",
      });
    }

    if (resolved.rows.length === 1 && gap > 0 && ctx.policy.shortPayToCollections) {
      return base(payment, {
        kind: "short",
        bucket: "flag",
        invoiceIds: [resolved.rows[0].id],
        recommendation: names + " is " + formatMoney(sum) + " and this payment is " + formatMoney(payment.amountCents) + ", a short pay of " + formatMoney(gap) + " for collections.",
      });
    }

    if (resolved.rows.length === 1 && gap > 0) {
      return base(payment, {
        kind: "short_hold",
        bucket: "flag",
        invoiceIds: [resolved.rows[0].id],
        recommendation: names + " is short by " + formatMoney(gap) + ", and the manual says to hold short pays for a person instead of sending them to collections.",
      });
    }

    if (resolved.rows.length === 1 && gap < 0) {
      return base(payment, {
        kind: "refund",
        bucket: "approval",
        sensitive: true,
        invoiceIds: [resolved.rows[0].id],
        posts: fullPosts(resolved.rows, 0),
        refundCents: -gap,
        recommendation: "This payment is " + formatMoney(-gap) + " over " + names + " and asks for a credit, which waits for a designated person.",
      });
    }

    return base(payment, {
      kind: "unmatched",
      bucket: "flag",
      invoiceIds: ids,
      recommendation: "The named invoices add up to " + formatMoney(sum) + ", which does not equal the " + formatMoney(payment.amountCents) + " payment.",
    });
  }

  function refused(payment, customer, item, memoIds) {
    const real = canonicalDomain(item.sender.domain, [customer].filter(Boolean));
    const target = instructedInvoices(item.text);
    const moved = target.length ? listIds(target) : "another invoice";
    const approved = real || "the approved contact domain";
    return base(payment, {
      kind: "lookalike",
      bucket: "flag",
      sensitive: true,
      invoiceIds: memoIds,
      remitChange: false,
      recommendation: "Refused " + item.sender.domain + " because it is not the approved domain " + approved + ", so the " + formatMoney(payment.amountCents) + " payment was not moved onto " + moved + " and the remit-to account was not changed.",
    });
  }

  function fooled(payment, customer, item, memoIds) {
    const real = canonicalDomain(item.sender.domain, [customer].filter(Boolean));
    const ids = instructedInvoices(item.text);
    const rows = customer ? ids.map((id) => ({ id, amountCents: 0 })) : [];
    const remit = wantsRemitChange(item.text);
    const leftOpen = memoIds.length ? listIds(memoIds) : "the bank memo's invoice";
    return base(payment, {
      kind: "lookalike_fooled",
      bucket: "routine",
      routine: true,
      warning: true,
      invoiceIds: ids,
      posts: ids.map((id) => ({ invoiceId: id, cents: payment.amountCents, writeOffCents: 0, unsafe: true })),
      remitChange: remit,
      recommendation: "Loose domain check treated " + item.sender.domain + " as " + (real || "an approved domain") + ", posted " + formatMoney(payment.amountCents) + " to " + (ids.length ? listIds(ids) : "the requested invoice") + (remit ? ", and accepted a remit-to change" : "") + ", leaving " + leftOpen + " open.",
      _rowsHint: rows,
    });
  }

  function stageName(stage) {
    if (stage === "observe") return "observe";
    if (stage === "propose") return "propose";
    return "autonomous";
  }

  function settle(decision, stage, verdict) {
    const copy = Object.assign({}, decision);
    delete copy._rowsHint;
    copy.posts = (decision.posts || []).map((post) => Object.assign({}, post));
    copy.verdict = verdict || null;

    if (verdict === "rejected") {
      copy.state = "rejected";
      copy.executed = false;
      copy.badge = "Rejected";
      copy.queue = "exception";
      copy.outcome = "You rejected this. Nothing was posted.";
      return copy;
    }

    if (stage === "observe") {
      copy.state = "observe";
      copy.executed = false;
      copy.badge = decision.warning ? "Would mis-post" : decision.bucket === "flag" ? "Would flag" : decision.bucket === "approval" ? "Would ask" : "Would apply";
      copy.queue = "watch";
      copy.outcome = "Week 1, observe. The bot is watching a person do the job.";
      return copy;
    }

    if (stage === "propose" && verdict !== "approved") {
      copy.state = "proposed";
      copy.executed = false;
      copy.badge = "Proposal";
      copy.queue = "proposal";
      copy.outcome = "Week 2, propose. Nothing posts until you approve.";
      return copy;
    }

    if (decision.routine) {
      copy.state = "applied";
      copy.executed = true;
      copy.badge = decision.warning ? "Posted — wrong" : "Posted";
      copy.queue = decision.warning ? "flag" : "posted";
      copy.outcome = decision.warning
        ? "Posted because loose domain check was on."
        : verdict === "approved"
          ? "You approved it. Posted."
          : "Posted on its own. This is routine work.";
      return copy;
    }

    if (verdict === "approved" && decision.bucket === "approval") {
      copy.state = "applied";
      copy.executed = true;
      copy.badge = "Approved";
      copy.queue = "posted";
      copy.outcome = "A designated person approved this. Posted.";
      return copy;
    }

    if (verdict === "approved" && decision.bucket === "flag") {
      return flagState(copy, decision, "You confirmed this flag. No cash was posted.");
    }

    if (decision.kind === "short" || decision.kind === "short_hold" || decision.kind === "unmatched" || decision.kind === "lookalike") {
      return flagState(copy, decision, decision.kind === "lookalike"
        ? "Escalated. The lookalike sender was refused."
        : decision.kind === "short"
          ? "Flagged to collections. No cash was posted."
          : "Waiting in the exception queue for a person.");
    }

    copy.state = "waiting";
    copy.executed = false;
    copy.badge = "Needs approval";
    copy.queue = "approval";
    copy.outcome = "Waiting for a designated person. Nothing was posted.";
    return copy;
  }

  function flagState(copy, decision, outcome) {
    copy.executed = false;
    copy.outcome = outcome;
    if (decision.kind === "short") {
      copy.state = "flagged";
      copy.badge = "Collections";
      copy.queue = "collections";
    } else if (decision.kind === "lookalike") {
      copy.state = "escalated";
      copy.badge = "Escalated";
      copy.queue = "exception";
    } else {
      copy.state = "exception";
      copy.badge = "Exception";
      copy.queue = "exception";
    }
    return copy;
  }

  function guardBooks(rows, invoices) {
    const left = {};
    invoices.forEach((invoice) => { left[invoice.id] = invoice.amountCents; });
    return rows.map((row) => {
      if (!row.executed) return row;
      for (let i = 0; i < row.posts.length; i++) {
        const post = row.posts[i];
        const open = left[post.invoiceId];
        const capped = post.unsafe ? Math.min(post.cents, open || 0) : post.cents;
        if (open === undefined || capped <= 0 || capped > open || (!post.unsafe && post.cents !== open && post.writeOffCents === 0 && row.kind !== "lookalike_fooled")) {
          if (open === undefined || capped <= 0 || capped > open) {
            return Object.assign({}, row, {
              executed: false,
              warning: false,
              state: "exception",
              badge: "Exception",
              queue: "exception",
              posts: [],
              outcome: "Held. " + post.invoiceId + " cannot take this posting.",
            });
          }
        }
      }
      const posts = row.posts.map((post) => {
        const cents = post.unsafe ? Math.min(post.cents, left[post.invoiceId]) : post.cents;
        left[post.invoiceId] -= cents;
        return Object.assign({}, post, { cents });
      });
      return Object.assign({}, row, { posts });
    });
  }

  function booksOf(invoices, rows, customers) {
    const paid = {};
    const by = {};
    const writeOff = {};
    rows.forEach((row) => {
      if (!row.executed) return;
      row.posts.forEach((post) => {
        paid[post.invoiceId] = (paid[post.invoiceId] || 0) + post.cents;
        writeOff[post.invoiceId] = (writeOff[post.invoiceId] || 0) + (post.writeOffCents || 0);
        by[post.invoiceId] = row.paymentId;
      });
    });
    return invoices.map((invoice) => {
      const customer = customers.find((item) => item.id === invoice.customerId);
      const got = paid[invoice.id] || 0;
      const state = got <= 0 ? "open" : got >= invoice.amountCents ? "cleared" : "partial";
      return {
        id: invoice.id,
        customerId: invoice.customerId,
        customer: customer ? customer.name : invoice.customerId,
        label: invoice.label,
        due: invoice.due,
        amountCents: invoice.amountCents,
        paidCents: got,
        writeOffCents: writeOff[invoice.id] || 0,
        remainingCents: invoice.amountCents - got,
        state,
        paymentId: by[invoice.id] || "",
      };
    });
  }

  function summarize(rows, stage) {
    const summary = {
      autoApplied: 0,
      fooled: 0,
      needsApproval: 0,
      flagged: 0,
      wouldClear: 0,
      minutesSaved: 0,
    };
    rows.forEach((row) => {
      if (row.bucket === "routine" && !row.warning) summary.wouldClear += 1;
      if (row.executed && row.warning) {
        summary.fooled += 1;
        return;
      }
      if (row.executed) {
        summary.autoApplied += 1;
        return;
      }
      if (stage === "observe") {
        if (row.bucket === "approval") summary.needsApproval += 1;
        else if (row.bucket === "flag" || row.warning) summary.flagged += 1;
        return;
      }
      if (stage === "propose" && row.state === "proposed") {
        summary.needsApproval += 1;
        return;
      }
      if (row.state === "waiting") {
        summary.needsApproval += 1;
        return;
      }
      if (row.state === "rejected" || row.bucket === "flag" || row.state === "flagged" || row.state === "escalated" || row.state === "exception") {
        summary.flagged += 1;
      }
    });
    summary.minutesSaved = summary.autoApplied * MINUTES_PER_POST;
    return summary;
  }

  function stageBlurb(stage) {
    if (stage === "observe") {
      return "Week 1. The bot watches and says what a person would do. It does not post.";
    }
    if (stage === "propose") {
      return "Week 2. The bot proposes each action and waits. Approve posts routine work. Reject leaves the invoice open.";
    }
    return "Week 3. Routine matches post on their own. Write-offs over the cap, credits, unmatched payments, and a lookalike sender wait for a person.";
  }

  function caption(summary, stage) {
    const base = "Illustrative. Each payment the bot posts on its own counts as 12 minutes. The write-up's cash application went from about 3–4 hours to about 30 minutes.";
    if (stage === "observe") {
      return base + " This week posts nothing. The routine payments would be about " + (summary.wouldClear * MINUTES_PER_POST) + " minutes.";
    }
    if (summary.fooled) {
      return base + " The loose domain check posted " + summary.fooled + " payment the wrong way. That one is not in the minutes.";
    }
    return base;
  }

function banner(rows) {
  if (rows.some((row) => row.kind === "lookalike_fooled")) {
    return "Loose domain check is on. The bot treats the lookalike sender as an approved contact and follows the request to move the payment and change remit-to details.";
  }
  if (rows.some((row) => row.kind === "lookalike")) {
    return "Exact domain check refused the lookalike sender. That payment stays unposted, and the remit-to account stays as it was.";
  }
  return "";
}

  function auditHead(policy, stage) {
    const check = policy.looseDomainCheck ? "loose domain check" : "exact domain check";
    const shortPay = policy.shortPayToCollections ? "short pays go to collections" : "short pays wait for a person";
    return "18 Nov 2026, 8:05 feed. Stage: " + stage + ". Auto write-off cap " + formatMoney(autoCap(policy)) + ". " + shortPay + ". " + check + ".";
  }

  function auditLine(row) {
    return row.paymentId + " — " + row.badge + ". " + row.recommendation;
  }

  function runCashApp(options) {
    const opts = options || {};
    const customers = opts.customers || CUSTOMERS;
    const invoices = opts.invoices || INVOICES;
    const payments = opts.payments || PAYMENTS;
    const emails = opts.emails || EMAILS;
    const policy = normalizePolicy(opts.policy);
    const stage = stageName(opts.stage);
    const approvals = opts.approvals || {};
    const ctx = { customers, invoices, emails, policy };
    const decided = payments.map((payment) => decide(payment, ctx));
    const settled = decided.map((decision) => {
      const verdict = approvals[decision.paymentId];
      const allowed = verdict === "approved" || verdict === "rejected" ? verdict : null;
      return settle(decision, stage, allowed);
    });
    const guarded = guardBooks(settled, invoices);
    const books = booksOf(invoices, guarded, customers);
    const summary = summarize(guarded, stage);
    return {
      shop: SHOP,
      policy,
      stage,
      decisions: guarded,
      books,
      summary,
      blurb: stageBlurb(stage),
      caption: caption(summary, stage),
      banner: banner(guarded),
      auditHead: auditHead(policy, stage),
      audit: [auditHead(policy, stage)].concat(guarded.map(auditLine)),
      live: summary.autoApplied + " posted, " + summary.needsApproval + " need approval, " + summary.flagged + " flagged, " + summary.minutesSaved + " illustrative minutes saved.",
    };
  }

  globalThis.CashApp = {
    SHOP,
    POST,
    MINUTES_PER_POST,
    CUSTOMERS,
    INVOICES,
    PAYMENTS,
    EMAILS,
    formatMoney,
    formatDate,
    foldDomain,
    domainOf,
    extractInvoiceIds,
    instructedInvoices,
    classifySender,
    normalizePolicy,
    runCashApp,
  };
})();
