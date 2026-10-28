import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  COMPANY,
  SESSIONS,
  addTask,
  createState,
  explainMap,
  proposalText,
  quadrantOf,
  rankTasks,
  removeTask,
  setSignal,
  updateTask,
} from "./model.js";

const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const model = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

const SOURCE = "https://x.com/lukepierceops/status/2115245000351154480";

function at(sessionIndex) {
  const state = createState();
  state.sessionIndex = sessionIndex;
  return state;
}

test("the lab index links this demo and the page names the source", () => {
  assert.match(index, /demos\/2026-10-28-enablement-opportunity-mapper\//);
  assert.match(index, /lukepierceops\/status\/2115245000351154480/);
  assert.match(page, /https:\/\/x\.com\/lukepierceops\/status\/2115245000351154480/);
  assert.match(page, /fictional/i);
  assert.match(page, new RegExp(COMPANY));
  assert.match(page, /Audit-first/);
  assert.match(page, /Enablement-first/);
  assert.doesNotMatch(page + app + model + css, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\./i);
  assert.doesNotMatch(page + app + model, /inner circle|boom automation|dm me|\$\d/i);
  assert.doesNotMatch(css, /url\(http/);
});

test("fourteen fictional staff cover owner, office, field, and sales", () => {
  const state = createState();
  assert.equal(state.people.length, 14);
  const depts = new Set(state.people.map((person) => person.dept));
  assert.deepEqual([...depts].sort(), ["field", "office", "owner", "sales"]);
  assert.equal(SESSIONS[0].id, "kickoff");
  assert.equal(SESSIONS.map((session) => session.id).includes("office"), true);
});

test("the map fills in session by session", () => {
  assert.equal(rankTasks(at(0)).length, 2);
  assert.equal(rankTasks(at(1)).length, 5);
  assert.equal(rankTasks(at(2)).length, 8);
  assert.equal(rankTasks(at(3)).length, 9);
  assert.equal(rankTasks(at(4)).length, 9);

  const kickoff = rankTasks(at(0));
  const early = kickoff.find((row) => row.task.id === "wheres-my-tech");
  assert.deepEqual(early.raisers.map((raiser) => raiser.personId), ["marcus"]);

  const office = rankTasks(at(1)).find((row) => row.task.id === "wheres-my-tech");
  assert.ok(office.raisers.some((raiser) => raiser.personId === "luis"));
  assert.ok(office.score > early.score);

  const field = rankTasks(at(2)).find((row) => row.task.id === "price-book");
  assert.deepEqual(field.raisers.map((raiser) => raiser.personId), ["sam"]);
  const sales = rankTasks(at(3)).find((row) => row.task.id === "price-book");
  assert.deepEqual(sales.raisers.map((raiser) => raiser.personId), ["sam", "ben"]);
});

test("high hours from resistant people rank below a shorter curious task", () => {
  const rows = rankTasks(at(4));
  assert.deepEqual(rows.map((row) => row.task.id), [
    "inbox-triage",
    "estimates",
    "photo-notes",
    "wheres-my-tech",
    "copy-tools",
    "truck-stock",
    "after-hours",
    "monday-report",
    "price-book",
  ]);

  const inbox = rows.find((row) => row.task.id === "inbox-triage");
  const estimates = rows.find((row) => row.task.id === "estimates");
  const monday = rows.find((row) => row.task.id === "monday-report");
  const price = rows.find((row) => row.task.id === "price-book");

  assert.equal(inbox.adoption, 1);
  assert.equal(estimates.adoption, 1);
  assert.ok(monday.adoption < 0.2);
  assert.ok(price.adoption < 0.2);
  assert.ok(price.raisers.every((raiser) => raiser.person.signal === "resistant"));
  assert.ok(monday.task.hoursPerWeek > estimates.task.hoursPerWeek);
  assert.ok(monday.score < estimates.score);
  assert.ok(price.task.hoursPerWeek > inbox.task.hoursPerWeek);
  assert.ok(price.score < inbox.score);
  assert.equal(inbox.quadrant, "quick");
  assert.equal(estimates.quadrant, "quick");
  assert.equal(monday.quadrant, "later");
  assert.equal(price.quadrant, "trap");
  assert.equal(rows.find((row) => row.task.id === "copy-tools").quadrant, "build");

  const office = explainMap(rankTasks(at(1)));
  assert.match(office.text, /Monday job report/);
  assert.match(office.text, /office inbox/);
  assert.match(office.text, /shorter task wins/);
  const full = explainMap(rows);
  assert.equal(full.pair.cold.task.id, "price-book");
  assert.equal(full.pair.warm.task.id, "inbox-triage");
  assert.match(full.text, /shorter task wins/);
});

test("marking the resistant owner of a long task curious jumps its rank", () => {
  const state = at(4);
  setSignal(state, "helen", "curious");
  const rows = rankTasks(state);
  const monday = rows.find((row) => row.task.id === "monday-report");
  const inbox = rows.find((row) => row.task.id === "inbox-triage");
  assert.ok(monday.score > inbox.score);
  assert.equal(monday.rank, 1);
  const fresh = createState();
  assert.equal(fresh.people.find((person) => person.id === "helen").signal, "resistant");
});

test("edits, added tasks, and the proposal follow the facilitator", () => {
  const state = at(2);
  const price = state.tasks.find((task) => task.id === "price-book");
  const saved = updateTask(state, "price-book", {
    name: price.name,
    detail: price.detail,
    hours: price.hoursPerWeek,
    frequency: price.frequency,
    effort: price.effort,
    raiserIds: ["sam", "ben"],
  });
  assert.equal(saved.ok, true);
  assert.deepEqual(
    rankTasks(state).find((row) => row.task.id === "price-book").raisers.map((raiser) => raiser.personId),
    ["sam"],
  );
  state.sessionIndex = 3;
  assert.deepEqual(
    rankTasks(state).find((row) => row.task.id === "price-book").raisers.map((raiser) => raiser.personId),
    ["sam", "ben"],
  );

  const added = addTask(state, {
    name: "File the permits",
    hours: 6,
    frequency: "Weekly",
    effort: 1,
    detail: "A permit packet.",
    raiserIds: ["camille"],
  });
  assert.equal(added.ok, true);
  assert.equal(rankTasks(state)[0].task.name, "File the permits");
  state.sessionIndex = 0;
  assert.equal(rankTasks(state).some((row) => row.task.name === "File the permits"), false);

  state.sessionIndex = 3;
  const custom = state.tasks.find((task) => task.custom);
  assert.equal(removeTask(state, "monday-report").ok, false);
  assert.equal(removeTask(state, custom.id).ok, true);
  assert.equal(addTask(state, { name: "", hours: 1, effort: 1, raiserIds: [] }).ok, false);
  assert.equal(addTask(state, { name: "Nope", hours: 1, effort: 2.5, raiserIds: [] }).ok, false);
  assert.equal(setSignal(state, "dana", "eager").ok, false);
});

test("the copied proposal names three builds and monthly enablement", () => {
  const text = proposalText(at(4));
  assert.match(text, /Fictional example/);
  assert.match(text, /Triage the office inbox/);
  assert.match(text, /Write the estimate from the walkthrough/);
  assert.match(text, /Turn truck photos into job notes/);
  assert.match(text, /Monthly enablement/);
  assert.match(text, /Refresh the truck price book/);
  assert.match(text, /Monday job report/);
  assert.match(text, new RegExp(SOURCE.replace("https://", "")));
  assert.ok(text.split("\n").length < 80);
  assert.equal(quadrantOf(4.5, 2), "quick");
  assert.equal(quadrantOf(1.2, 2), "later");
  assert.equal(quadrantOf(1.65, 4), "trap");
  assert.equal(quadrantOf(5, 4), "build");

  const early = proposalText(at(0));
  assert.match(early, /Still ahead/);
  assert.doesNotMatch(early, /truck price book/);
});
