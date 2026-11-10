import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.SocraticTutor;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function rightId(question) {
  return question.choices.find((choice) => choice.correct).id;
}

function wrongId(question) {
  return question.choices.find((choice) => !choice.correct).id;
}

function visible(view) {
  const parts = view.paragraphs.slice();
  if (view.heading) parts.push(view.heading);
  if (view.question) {
    parts.push(view.question.prompt);
    view.question.choices.forEach((choice) => parts.push(choice.text));
  }
  view.actions.forEach((action) => parts.push(action.text));
  return parts.join("\n");
}

function teach() {
  return model.act(model.createState(), { type: "prompt", id: "teach" });
}

function answerAll(state, ids) {
  return ids.reduce((current, id) => model.act(current, { type: "choice", id }), state);
}

function strongDiag() {
  return answerAll(teach(), ["pull", "range", "stop", "hold"]);
}

test("the lab index links this demo before the marker", () => {
  const posNew = index.indexOf("demos/2026-11-09-socratic-tutor-skill-map/");
  const posPrev = index.indexOf("demos/2026-11-08-security-audit-phases/");
  const posMarker = index.indexOf("<!-- demos -->");
  assert.ok(posPrev > 0 && posNew > posPrev && posNew < posMarker);
  assert.equal((index.match(/<!-- demos -->/g) || []).length, 1);
  assert.match(index, /Tutor vs\. chatbot/);
  assert.match(index, /RoundtableSpace\/status\/2119380660288999692/);
  assert.match(index, /Cincinnati/);
  assert.match(index, /Source post/);
});

test("the page names the simulation, the shop, the skill, and the install command", () => {
  assert.match(page, /Clifton Air Co\./);
  assert.match(page, /Cincinnati/);
  assert.match(page, /fictional/i);
  assert.match(page, /Simulation/);
  assert.match(page, /not Jane Street's tool/);
  assert.match(page, /inspired by/i);
  assert.match(page, /2119380660288999692/);
  assert.match(page, /github.com\/janestreet\/agent_skills/);
  assert.match(page, /socratic-tutor\/SKILL\.md/);
  assert.match(page, /npx skills add https:\/\/github.com\/janestreet\/agent_skills --skill socratic-tutor/);
  assert.match(page, /Want a quick answer, or should I actually teach you this properly\?/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /src="\.\/model\.js"/);
  assert.match(page, /src="\.\/app\.js"/);
  assert.match(page, /href="\.\/styles\.css"/);
  for (const label of [
    "unaware",
    "heard of it",
    "can follow along",
    "can do with help",
    "can do independently",
    "can teach it / handle edge cases",
  ]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(app, /Be strict/);
  assert.match(app, /Start over/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|innerHTML/);
  assert.doesNotMatch(bundle, /sk-|AKIA|ghp_|xoxb-|api[_-]?key/i);
  assert.doesNotMatch(bundle, /googleapis|cdn\./);
});

test("the scale, the topic split, and the diagnostic match the skill", () => {
  assert.equal(
    model.LEVELS.map((level) => level.label).join("|"),
    [
      "unaware",
      "heard of it",
      "can follow along",
      "can do with help",
      "can do independently",
      "can teach it / handle edge cases",
    ].join("|")
  );
  assert.ok(model.SUBSKILLS.length >= 4 && model.SUBSKILLS.length <= 10);
  assert.equal(model.SUBSKILLS.length, 5);
  assert.ok(model.DIAGNOSTIC.length >= 3 && model.DIAGNOSTIC.length <= 5);
  assert.equal(model.DIAGNOSTIC.length, 4);
  assert.equal(model.SHOP.name, "Clifton Air Co.");
  assert.match(model.SHOP.place, /Cincinnati/);
  model.SUBSKILLS.forEach((skill) => {
    const lesson = model.LESSONS[skill.id];
    assert.ok(lesson.explain.length > 40);
    assert.ok(lesson.ask && lesson.narrow && lesson.retest && lesson.recall);
    assert.equal(lesson.ask.choices.length, 3);
    const questions = JSON.stringify({
      ask: lesson.ask,
      narrow: lesson.narrow,
      retest: lesson.retest,
      recall: lesson.recall,
    });
    assert.equal(questions.includes(lesson.explain), false);
    assert.ok(model.REVIEWS[skill.id].choices.some((choice) => choice.correct));
  });
  model.DIAGNOSTIC.forEach((question) => {
    assert.equal(question.choices.length, 3);
    question.choices.forEach((choice) => {
      Object.keys(choice.set).forEach((id) => {
        assert.ok(model.SUBSKILLS.some((skill) => skill.id === id));
        assert.ok(choice.set[id] >= 0 && choice.set[id] <= 5);
      });
    });
  });
});

test("a one-off question does not start the diagnostic", () => {
  const state = model.act(model.createState(), { type: "prompt", id: "explain" });
  const view = model.present(state);
  assert.equal(state.phase, "oneoff");
  assert.equal(model.displayedLevels(state).read, 0);
  assert.equal(view.map, null);
  assert.ok(view.paragraphs.includes(model.LOOP_OFF));
  assert.equal(view.paragraphs.join(" ").includes("Which afternoon"), false);
  assert.match(view.lecture.join(" "), /Which afternoon/);
  assert.equal(view.actions[0].id, "teach");
});

test("an ambiguous request asks the guard question and can still become a lesson", () => {
  let state = model.act(model.createState(), { type: "prompt", id: "howto" });
  let view = model.present(state);
  assert.equal(state.phase, "guard");
  assert.equal(view.question.prompt, model.GUARD_QUESTION);
  assert.equal(view.paragraphs.length, 0);
  assert.equal(view.question.choices.length, 2);
  state = model.act(state, { type: "choice", id: "quick" });
  assert.equal(state.phase, "oneoff");
  assert.ok(model.present(state).paragraphs.includes(model.LOOP_OFF));
  state = model.act(state, { type: "guard", id: "teach" });
  assert.equal(state.phase, "diag");
  assert.equal(state.diagIndex, 0);
  const fresh = model.act(model.act(model.createState(), { type: "prompt", id: "howto" }), {
    type: "choice",
    id: "teach",
  });
  assert.equal(fresh.phase, "diag");
  assert.match(model.present(fresh).paragraphs.join(" "), /one at a time/);
  assert.match(model.present(fresh).kicker, /No teaching yet/);
});

test("teach me runs the diagnostic before any explanation", () => {
  let state = teach();
  assert.equal(state.phase, "diag");
  const first = model.present(state);
  assert.equal(first.paragraphs[0], model.DIAG_INTRO);
  assert.equal(visible(first).includes(model.LESSONS.limit.explain), false);
  assert.equal(visible(first).includes(model.NOT_QUITE), false);
  assert.equal(visible(first).includes("Which afternoon"), false);
  state = model.act(state, { type: "choice", id: "pull" });
  assert.equal(state.phase, "diag");
  assert.equal(state.base.read, 3);
  assert.equal(model.present(state).paragraphs.length, 0);
  assert.match(model.present(state).kicker, /2 of 4/);
});

test("diagnostic choices place different levels and propose the weakest subskill", () => {
  const strong = strongDiag();
  assert.equal(strong.phase, "map");
  assert.equal(strong.base.read, 3);
  assert.equal(strong.base.limit, 3);
  assert.equal(strong.base.handoff, 3);
  assert.equal(strong.base.gaps, 3);
  assert.equal(strong.base.check, 3);
  assert.equal(strong.focus, "read");
  assert.equal(model.overallPercent(model.displayedLevels(strong)), 60);
  const weak = answerAll(teach(), ["price", "none", "furnace", "skip"]);
  assert.equal(weak.base.read, 1);
  assert.equal(weak.base.limit, 0);
  assert.equal(weak.base.handoff, 1);
  assert.equal(weak.base.gaps, 0);
  assert.equal(weak.base.check, 0);
  assert.equal(weak.focus, "limit");
  const text = model.skillMapText(weak);
  assert.match(text, /<- current focus/);
  assert.equal((text.match(/<- current focus/g) || []).length, 1);
  assert.match(text, /\u2588/);
  assert.match(text, /\u2591/);
  const line = text.split("\n").find((row) => row.startsWith("Don't invent a firm price"));
  const bar = line.slice(line.indexOf("[") + 1, line.indexOf("]"));
  assert.equal(bar, "\u2591".repeat(10));
  assert.match(line, /0\/5 unaware/);
});

test("a wrong answer asks a narrower question and withholds the explanation", () => {
  let state = model.act(strongDiag(), { type: "focus", id: "limit" });
  const lesson = model.LESSONS.limit;
  state = model.act(state, { type: "choice", id: wrongId(lesson.ask) });
  assert.equal(state.phase, "narrow");
  const view = model.present(state);
  assert.equal(view.paragraphs[0], model.NOT_QUITE);
  assert.equal(view.question.prompt, lesson.narrow.prompt);
  assert.equal(visible(view).includes(lesson.explain), false);
  assert.equal(visible(view).includes("Which afternoon"), false);
  assert.equal(view.note.length, 0);
  state = model.act(state, { type: "choice", id: wrongId(lesson.narrow) });
  assert.equal(state.phase, "explain");
  assert.match(model.present(state).paragraphs.join(" "), new RegExp(lesson.explain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(model.present(state).question, null);
  const held = state.base.limit;
  state = model.act(state, { type: "continue" });
  assert.equal(state.phase, "retest");
  assert.notEqual(model.present(state).question.prompt, lesson.ask.prompt);
  state = model.act(state, { type: "choice", id: rightId(lesson.retest) });
  assert.equal(model.displayedLevels(state).limit, held);
  assert.match(model.present(state).note.join(" "), /not unprompted recall/);
  state = model.act(state, { type: "strict", on: false });
  assert.equal(model.displayedLevels(state).limit, held + 1);
});

test("strict mode holds a level after one correct answer and raises it after recall", () => {
  let state = model.act(strongDiag(), { type: "focus", id: "limit" });
  const lesson = model.LESSONS.limit;
  const base = state.base.limit;
  state = model.act(state, { type: "choice", id: rightId(lesson.ask) });
  assert.equal(state.phase, "recall");
  assert.equal(model.displayedLevels(state).limit, base);
  assert.match(model.present(state).note.join(" "), /did not raise/);
  assert.match(model.present(state).kicker, /Unprompted recall/);
  state = model.act(state, { type: "strict", on: false });
  assert.equal(model.displayedLevels(state).limit, base + 1);
  assert.match(model.present(state).note.join(" "), /first correct answer raised/);
  state = model.act(state, { type: "strict", on: true });
  assert.equal(model.displayedLevels(state).limit, base);
  state = model.act(state, { type: "choice", id: rightId(lesson.recall) });
  assert.equal(state.phase, "review");
  assert.equal(model.displayedLevels(state).limit, base + 1);
  assert.match(model.present(state).note.join(" "), /second independent check/);
  state = model.act(state, { type: "strict", on: false });
  assert.equal(model.displayedLevels(state).limit, base + 1);
  assert.match(model.skillMapText(state), /4\/5 can do independently <- current focus/);
});

test("an assisted answer does not count as one of the two strict checks", () => {
  let state = model.act(strongDiag(), { type: "focus", id: "gaps" });
  const lesson = model.LESSONS.gaps;
  const base = state.base.gaps;
  state = model.act(state, { type: "choice", id: wrongId(lesson.ask) });
  state = model.act(state, { type: "choice", id: rightId(lesson.narrow) });
  assert.equal(state.phase, "recall");
  assert.equal(model.displayedLevels(state).gaps, base);
  assert.match(model.present(state).note.join(" "), /with help/);
  state = model.act(state, { type: "choice", id: rightId(lesson.recall) });
  assert.equal(model.displayedLevels(state).gaps, base);
  assert.match(model.present(state).note.join(" "), /not one of them/);
});

test("spaced review of an earlier subskill drops a miss and holds a pass", () => {
  let state = model.act(strongDiag(), { type: "focus", id: "limit" });
  const lesson = model.LESSONS.limit;
  state = answerAll(state, [rightId(lesson.ask), rightId(lesson.recall)]);
  assert.equal(state.phase, "review");
  assert.equal(model.reviewTarget(state), "read");
  assert.equal(model.present(state).kicker, "Spaced review.");
  assert.equal(model.present(state).reviewName, "Read the request");
  assert.equal(model.present(state).question.prompt, model.REVIEWS.read.prompt);
  const passed = model.act(state, { type: "choice", id: rightId(model.REVIEWS.read) });
  assert.equal(model.displayedLevels(passed).read, 3);
  assert.match(model.present(passed).note.join(" "), /held at 3\/5/);
  const missed = model.act(state, { type: "choice", id: wrongId(model.REVIEWS.read) });
  assert.equal(model.displayedLevels(missed).read, 2);
  assert.match(model.present(missed).note.join(" "), /drops from 3\/5 to 2\/5/);
  assert.equal(missed.phase, "final");
});

test("the final mixed assessment summarizes the weak spots and does not pretend mastery", () => {
  let state = model.act(strongDiag(), { type: "focus", id: "check" });
  const lesson = model.LESSONS.check;
  state = answerAll(state, [rightId(lesson.ask), rightId(lesson.recall)]);
  state = model.act(state, { type: "choice", id: wrongId(model.REVIEWS.read) });
  assert.equal(state.phase, "final");
  assert.match(model.present(state).kicker, /Final mixed assessment/);
  assert.equal(model.present(state).question.prompt, model.FINAL.prompt);
  state = model.act(state, { type: "choice", id: rightId(model.FINAL) });
  const view = model.present(state);
  assert.equal(state.phase, "summary");
  assert.equal(view.summary.passed, true);
  assert.match(view.paragraphs.join(" "), /integrative question passed/);
  assert.ok(view.summary.weakest.includes("Read the request"));
  assert.match(view.paragraphs.join(" "), /default target is 4\/5/);
  assert.match(view.paragraphs.join(" "), /Level 5/);
  assert.match(view.map.text, /2\/5 can follow along/);
  const failed = model.present(model.act(model.act(strongDiag(), { type: "focus", id: "read" }), { type: "choice", id: "nope" }));
  assert.equal(failed.phase, "ask");
});

test("unknown actions leave the state alone", () => {
  const state = model.createState();
  assert.equal(model.act(state, { type: "choice", id: "missing" }), state);
  assert.equal(model.act(state, { type: "continue" }), state);
  assert.equal(model.act(state, { type: "focus", id: "limit" }), state);
  assert.equal(model.act(state, null), state);
  const restarted = model.act(strongDiag(), { type: "restart" });
  assert.equal(restarted.phase, "pick");
  assert.equal(restarted.strict, true);
  assert.equal(model.displayedLevels(restarted).read, 0);
});
