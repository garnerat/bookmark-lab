import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console };
  context.globalThis = context;
  const code = readFileSync(new URL("./engine.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "engine.js" });
  return context.GenUI;
}

const ui = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const engine = readFileSync(new URL("./engine.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function money(text) {
  return Number(String(text).replace(/[$,]/g, ""));
}

function table(spec, key) {
  return spec.elements[key];
}

test("the lab index links this demo and the Rauch post", () => {
  assert.match(index, /demos\/2026-11-07-genui-cards\//);
  assert.match(index, /rauchg\/status\/2118856239719608353/);
  assert.match(index, /chat card|wall of text/i);
  assert.match(index, /Hyde Park/);
});

test("the page names the source, the shop, and the mechanism", () => {
  assert.match(page, /Guillermo Rauch/);
  assert.match(page, /rauchg\/status\/2118856239719608353/);
  assert.match(page, /vercel.com\/changelog\/json-render-and-chat-sdk-agents/);
  assert.match(page, /json-render.dev\/docs\/api\/chat/);
  assert.match(page, /github.com\/vercel-labs\/json-render/);
  assert.match(page, /Copper Lantern Roofing/);
  assert.match(page, /Hyde Park/);
  assert.match(page, /fictional/i);
  assert.match(page, /example data/i);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /streamCard/);
  assert.match(page, /toCard/);
  assert.match(page, /CardSpecError/);
  assert.match(page, /500/);
  assert.match(page, /limits/);
  for (const name of ["Card", "Section", "Text", "Fields", "Field", "Table", "Chart", "Divider", "Image", "Actions", "Button", "LinkButton"]) {
    assert.match(page, new RegExp(name));
  }
  assert.doesNotMatch(page + app + engine, /Oakley Heating/);
  assert.doesNotMatch(app + engine, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
});

test("the stylesheet keeps tap targets large enough for a phone", () => {
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /viewport-fit|safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
});

test("valid specs render and cover the catalog and chart types", () => {
  const types = new Set();
  const charts = new Set();
  for (const question of ui.QUESTIONS) {
    const pack = ui.prepare(question.id, "valid");
    const card = ui.toCard(pack.spec);
    assert.equal(card.type, "Card");
    assert.ok(card.title);
    assert.ok(card.children.length >= 5);
    ui.usedTypes(pack.spec).forEach((type) => types.add(type));
    card.children.forEach((child) => {
      if (child.type === "Chart") charts.add(child.chart.type);
    });
    const frames = ui.framesOf(pack.spec);
    assert.deepEqual(frames[frames.length - 1], pack.spec);
    assert.equal(ui.toPartialCard({}), null);
    const rootOnly = frames[0];
    const partial = ui.toPartialCard(rootOnly);
    assert.equal(partial.title, card.title);
    assert.equal(partial.children.length, 0);
    assert.match(pack.prose, /example/i);
    assert.match(pack.prose, /Copper Lantern/);
  }
  for (const name of ["Card", "Section", "Text", "Fields", "Field", "Table", "Chart", "Divider", "Image", "Actions", "Button", "LinkButton"]) {
    assert.ok(types.has(name), name);
  }
  for (const kind of ["pie", "bar", "line", "area"]) assert.ok(charts.has(kind), kind);
  assert.equal(ui.INTERVAL_MS, 500);
});

test("the example numbers agree in the prose and the spec", () => {
  const schedule = ui.prepare("schedule", "valid");
  assert.match(schedule.prose, /6\.5/);
  assert.match(schedule.prose, /H-184/);
  assert.match(JSON.stringify(schedule.spec), /6\.5/);
  assert.match(JSON.stringify(schedule.spec), /H-184/);
  const hours = schedule.spec.elements.hoursChart.props.chart.series[0].values;
  assert.equal(hours.reduce((sum, value) => sum + value, 0), 6.5);

  const quotes = ui.prepare("quotes", "valid");
  assert.match(quotes.prose, /\$10,550/);
  assert.match(quotes.prose, /\$15,200/);
  assert.match(quotes.prose, /\$4,650/);
  const shingles = table(quotes.spec, "shingles").props.rows.filter((row) => row[0] !== "Total");
  const metal = table(quotes.spec, "metal").props.rows.filter((row) => row[0] !== "Total");
  assert.equal(shingles.reduce((sum, row) => sum + money(row[1]), 0), 10550);
  assert.equal(metal.reduce((sum, row) => sum + money(row[1]), 0), 15200);
  assert.equal(15200 - 10550, 4650);

  const leads = ui.prepare("leads", "valid");
  assert.match(leads.prose, /14 new leads/);
  const pie = leads.spec.elements.sources.props.chart.segments.reduce((sum, segment) => sum + segment.value, 0);
  const days = leads.spec.elements.byDay.props.chart.series[0].values.reduce((sum, value) => sum + value, 0);
  const places = leads.spec.elements.places.props.rows;
  assert.equal(pie, 14);
  assert.equal(days, 14);
  assert.equal(places.reduce((sum, row) => sum + Number(row[1]), 0), 14);
  assert.equal(places.reduce((sum, row) => sum + Number(row[2]), 0), 4);
});

test("a partial card stays null until the root Card exists", () => {
  assert.equal(ui.toPartialCard(null), null);
  assert.equal(ui.toPartialCard({ root: "card", elements: {} }), null);
  const spec = ui.prepare("schedule", "valid").spec;
  const moved = {
    root: "intro",
    elements: spec.elements,
  };
  assert.equal(ui.toPartialCard(moved), null);
});

test("bad props throw CardSpecError with readable issues", () => {
  const pack = ui.prepare("schedule", "bad");
  assert.throws(() => ui.toCard(pack.spec), (error) => {
    assert.equal(error.name, "CardSpecError");
    assert.ok(error.issues.some((issue) => issue.includes('unknown component "Callout"')));
    assert.ok(error.issues.some((issue) => issue.includes("expected pie, bar, line, or area")));
    assert.ok(error.issues.some((issue) => issue.includes("expected a non-empty string")));
    assert.ok(error.issues.some((issue) => issue.includes("expected primary, danger, or default")));
    assert.ok(error.issues.some((issue) => issue.includes("expected a string or number")));
    return true;
  });
  const partial = ui.toPartialCard(pack.spec);
  assert.ok(partial);
  assert.equal(partial.children.some((child) => child.type === "Chart"), false);
  assert.ok(partial.children.some((child) => child.type === "Table"));
});

test("Slack degrades a second table and limits reject it", () => {
  const natural = ui.prepare("quotes", "valid");
  assert.equal(ui.countType(natural.spec, "Table"), 2);
  const slack = ui.present(ui.toCard(natural.spec), "slack");
  const tables = [];
  function walk(node) {
    if (!node) return;
    if (node.type === "Table") tables.push(node);
    (node.children || []).forEach(walk);
  }
  walk(slack);
  assert.equal(tables.length, 2);
  assert.equal(tables[0].degraded, undefined);
  assert.equal(tables[1].degraded, true);
  assert.match(tables[1].code, /\$15,200/);
  const teams = ui.present(ui.toCard(natural.spec), "teams");
  const web = ui.present(ui.toCard(natural.spec), "web");
  assert.equal(JSON.stringify(teams).includes('"degraded":true'), false);
  assert.equal(JSON.stringify(web).includes('"degraded":true'), false);

  const added = ui.prepare("schedule", "degrade");
  assert.equal(ui.countType(added.spec, "Table"), 2);
  assert.doesNotThrow(() => ui.toCard(added.spec));
  const degraded = ui.present(ui.toCard(added.spec), "slack");
  assert.match(JSON.stringify(degraded), /18 squares/);
  assert.match(JSON.stringify(degraded), /"degraded":true/);

  const limited = ui.prepare("quotes", "limits");
  assert.equal(limited.limits.tables, 1);
  assert.throws(() => ui.toCard(limited.spec, { limits: limited.limits }), (error) => {
    assert.equal(error.name, "CardSpecError");
    assert.equal(error.issues.join("\n"), "at most 1 Table per message");
    return true;
  });
});
