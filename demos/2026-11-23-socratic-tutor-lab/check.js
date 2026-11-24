import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console, Math, Number, Object, String, Array, Boolean, isFinite };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.SocraticTutorLab;
}

const M = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function rightId(question) {
  return question.choices.filter(function (c) { return c.ok; })[0].id;
}

function wrongId(question) {
  return question.choices.filter(function (c) { return !c.ok; })[0].id;
}

function answer(state, id) {
  return M.reduce(state, { type: "answer", id: id });
}

function answerRight(state) {
  return answer(state, rightId(M.keyedQuestion(state)));
}

function answerWrong(state) {
  return answer(state, wrongId(M.keyedQuestion(state)));
}

const HITS = ["routine", "now", "day", "now"];

function throughDiagnostic(ids) {
  let state = M.initialState();
  state = M.reduce(state, { type: "intent", id: "teach" });
  state = M.reduce(state, { type: "continue" });
  ids.forEach(function (id) { state = answer(state, id); });
  return state;
}

function throughTeach(focus, ids) {
  let state = throughDiagnostic(ids || HITS);
  state = M.reduce(state, { type: "focus", id: focus });
  state = M.reduce(state, { type: "continue" });
  return state;
}

test("the lab index lists this demo after the previous day", function () {
  const previous = index.indexOf("demos/2026-11-22-agent-job-hunt-meter/");
  const here = index.indexOf("demos/2026-11-23-socratic-tutor-lab/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(previous !== -1 && previous < here && here < marker);
  const card = index.slice(here, marker);
  assert.match(card, /2026-11-23: Socratic Tutor Lab/);
  assert.match(card, /Brightside Veterinary Clinic/);
  assert.match(card, /fictional/);
  assert.match(card, /phone triage/);
  assert.match(card, /injaneity\/status\/2124685667821297704/);
  assert.match(card, /Source post/);
  assert.doesNotMatch(card, /HVAC|heating|cooling|furnace/i);
});

test("the page quotes the post and labels the simulation", function () {
  assert.match(page, /Socratic Tutor Lab/);
  assert.match(page, /Brightside Veterinary Clinic/);
  assert.match(page, /fictional/);
  assert.match(page, /scripted/i);
  assert.match(page, /injaneity\/status\/2124685667821297704/);
  assert.match(page, /github\.com\/janestreet\/agent_skills\/tree\/master\/socratic-tutor/);
  assert.ok(page.includes(M.POST.text));
  assert.ok(page.includes(M.GUARD_QUESTION));
  assert.ok(page.includes(M.INTENT.explain));
  assert.ok(page.includes(M.INTENT.teach));
  assert.ok(page.includes(M.USE.note));
  assert.ok(page.includes(M.USE.hour));
  assert.ok(page.includes(M.DIAG_INTRO));
  assert.match(page, /unaware/);
  assert.match(page, /heard of it/);
  assert.match(page, /can follow along/);
  assert.match(page, /can do with help/);
  assert.match(page, /can do independently/);
  assert.match(page, /can teach it \/ handle edge cases/);
  assert.match(page, /just tell me/);
  assert.match(page, /show progress/);
  assert.match(page, /save state/);
  assert.match(page, /resume from/);
  assert.match(page, /toxin ingestion/);
  assert.match(page, /bloat signs/);
  assert.match(page, /limping dog who is eating normally/);
  assert.match(page, /vaccine reminders/);
  assert.match(page, /Not veterinary advice/);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /Illustrative simulation, not a study result/);
  assert.equal(M.POST.url, "https://x.com/injaneity/status/2124685667821297704");
  assert.equal(M.POST.skill, "https://github.com/janestreet/agent_skills/tree/master/socratic-tutor");
  assert.equal(M.CLINIC, "Brightside Veterinary Clinic");
  assert.equal(M.FOOTER, "Scripted tutor. Brightside Veterinary Clinic is fictional. Not veterinary advice.");
  assert.ok(page.includes(M.FOOTER));
});

test("the page stays local and off heating-and-cooling examples", function () {
  assert.doesNotMatch(bundle, /HVAC|heating|cooling|furnace|air conditioning/i);
  assert.doesNotMatch(app + source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
  assert.doesNotMatch(page, /src="https?:|fonts\.googleapis|cdn\.|unpkg|jsdelivr/);
  assert.match(page, /src="\.\/model\.js"/);
  assert.match(page, /src="\.\/app\.js"/);
  assert.match(page, /href="\.\/styles\.css"/);
  assert.doesNotMatch(bundle, /api[_-]?key|password|secret/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(app, /textContent/);
  assert.doesNotMatch(app, /innerHTML/);
});

test("skill bars use the skill's block characters", function () {
  assert.equal(M.blocks(0), M.LIGHT.repeat(10));
  assert.equal(M.blocks(4), M.FULL.repeat(8) + M.LIGHT.repeat(2));
  assert.equal(M.blocks(5), M.FULL.repeat(10));
  assert.equal(M.blocks(2), M.FULL.repeat(4) + M.LIGHT.repeat(6));
  assert.equal(M.overallBlocks(58).split(M.FULL).length - 1, 6);
  const levels = { sort: 2, toxin: 2, bloat: 2, limp: 2, routine: 2 };
  assert.equal(M.overallPercent(levels), 40);
  const map = M.skillMap(levels, "toxin", null);
  assert.match(map.ascii, /Topic: Phone triage/);
  assert.match(map.ascii, /overall:/);
  assert.match(map.ascii, /40%/);
  assert.match(map.ascii, /<- current focus/);
  const raised = M.skillMap({ sort: 4, toxin: 2, bloat: 5, limp: 2, routine: 2 }, "toxin", null);
  assert.match(raised.ascii, /\* independent/);
  assert.match(raised.ascii, /\* can teach/);
  assert.equal(M.LEVELS[0], "unaware");
  assert.equal(M.LEVELS[1], "heard of it");
  assert.equal(M.LEVELS[2], "can follow along");
  assert.equal(M.LEVELS[3], "can do with help");
  assert.equal(M.LEVELS[4], "can do independently");
  assert.equal(M.LEVELS[5], "can teach it / handle edge cases");
});

test("a one-off question does not start the quiz", function () {
  const start = M.initialState();
  const state = M.reduce(start, { type: "intent", id: "explain" });
  assert.equal(start.phase, "intent");
  assert.equal(state.phase, "oneoff");
  assert.equal(state.placed, false);
  const seen = M.view(state);
  assert.equal(seen.question, null);
  assert.equal(seen.protocol, "hidden");
  assert.match(seen.lines.join(" "), /The diagnostic stays off/);
  const teach = M.reduce(state, { type: "intent", id: "teach" });
  assert.equal(teach.phase, "preface");
  assert.match(M.view(teach).lines.join(" "), new RegExp(M.DIAG_INTRO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(M.view(teach).lines.join(" "), /I will not teach anything until the diagnostic is done/);
});

test("the diagnostic places levels and hides the card", function () {
  assert.equal(M.DIAG.length, 4);
  assert.equal(M.SUBSKILLS.length, 5);
  let state = M.initialState();
  state = M.reduce(state, { type: "intent", id: "teach" });
  state = M.reduce(state, { type: "continue" });
  assert.equal(state.phase, "diagnostic");
  const mid = M.view(state);
  assert.equal(mid.protocol, "hidden");
  assert.equal(mid.map, null);
  assert.equal(mid.question.typeLabel, "Diagnostic");
  assert.doesNotMatch(mid.lines.join(" ") + mid.question.prompt, /even if the pet looks normal right now/);
  mid.question.choices.forEach(function (c) {
    assert.equal(c.ok, undefined);
    assert.equal(c.score, undefined);
  });

  state = throughDiagnostic(HITS);
  assert.equal(state.phase, "map");
  assert.equal(JSON.stringify(state.levels), JSON.stringify({ sort: 2, toxin: 2, bloat: 2, limp: 2, routine: 2 }));
  assert.equal(M.proposeFocus(state.levels), "toxin");
  assert.match(M.view(state).lines.join(" "), /Nothing has been taught yet/);

  const missed = M.placeLevels({
    "d-routine": "now",
    "d-toxin": "skip",
    "d-limp": "drug",
    "d-bloat": "routine"
  });
  assert.equal(JSON.stringify(missed), JSON.stringify({ sort: 0, toxin: 0, bloat: 0, limp: 0, routine: 0 }));

  const near = M.placeLevels({
    "d-routine": "day",
    "d-toxin": "week",
    "d-limp": "now",
    "d-bloat": "later"
  });
  assert.equal(JSON.stringify(near), JSON.stringify({ sort: 0, toxin: 1, bloat: 1, limp: 1, routine: 1 }));

  const two = M.placeLevels({
    "d-routine": "routine",
    "d-toxin": "now",
    "d-limp": "month",
    "d-bloat": "morn"
  });
  assert.equal(JSON.stringify(two), JSON.stringify({ sort: 1, toxin: 2, bloat: 0, limp: 0, routine: 2 }));
});

test("teaching questions use the four labels and hide the answer key", function () {
  const types = {};
  Object.keys(M.LESSONS).forEach(function (id) {
    const lesson = M.LESSONS[id];
    ["q1", "advocate", "q2", "retest"].forEach(function (stage) {
      types[lesson[stage].type] = true;
      lesson[stage].choices.filter(function (c) { return !c.ok; }).forEach(function (c) {
        assert.ok(c.miss, id + " " + stage + " " + c.id);
        assert.ok(lesson.narrow[c.miss], id + " missing narrow " + c.miss);
        assert.ok(!lesson.narrow[c.miss].prompt.includes(lesson.reveal), id + " " + c.miss);
      });
    });
  });
  assert.ok(types.predict);
  assert.ok(types["explain-why"]);
  assert.ok(types["find-the-flaw"]);
  assert.ok(types.apply);
  assert.equal(M.TYPE_LABEL.predict, "Predict");
  assert.equal(M.TYPE_LABEL["explain-why"], "Explain why");
  assert.equal(M.TYPE_LABEL["find-the-flaw"], "Find the flaw");
  assert.equal(M.TYPE_LABEL.apply, "Apply");
});

test("a clean pair of checks raises the level by one", function () {
  Object.keys(M.LESSONS).forEach(function (id) {
    let state = throughTeach(id);
    assert.equal(state.phase, "teach");
    assert.equal(state.stage, "q1");
    assert.equal(M.view(state).protocol, "collapsed");
    const before = state.levels[id];
    state = answerRight(state);
    assert.equal(state.stage, "advocate");
    assert.equal(state.levels[id], before);
    assert.match(M.view(state).question.kicker, /Devil's advocate/);
    state = answerRight(state);
    assert.equal(state.stage, "q2");
    assert.equal(state.levels[id], before);
    state = answerRight(state);
    assert.equal(state.phase, "review-intro");
    assert.equal(state.levels[id], before + 1);
    assert.equal(state.raiseDelta.from, before);
    assert.equal(state.raiseDelta.to, before + 1);
    const seen = M.view(state);
    assert.match(seen.lines.join(" "), /moved from/);
    assert.equal(seen.map.rows.filter(function (row) { return row.id === id; })[0].level, before + 1);
  });
});

test("a wrong answer gets a narrower question and not the reveal", function () {
  let state = throughTeach("toxin");
  const reveal = M.LESSONS.toxin.reveal;
  state = answerWrong(state);
  assert.equal(state.stage, "narrow");
  assert.equal(state.fails, 1);
  assert.equal(state.levels.toxin, 2);
  const seen = M.view(state);
  assert.equal(seen.question.typeLabel, "Explain why");
  assert.match(seen.lines.join(" "), /Not quite/);
  assert.doesNotMatch(seen.lines.join("\n") + "\n" + seen.question.prompt, new RegExp(reveal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  state = answerWrong(state);
  assert.equal(state.phase, "explained");
  assert.match(M.view(state).lines.join(" "), new RegExp(reveal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(M.view(state).lines.join(" "), /Two attempts missed/);
  state = M.reduce(state, { type: "continue" });
  assert.equal(state.stage, "retest");
  assert.equal(state.levels.toxin, 2);
  state = answerRight(state);
  assert.equal(state.phase, "review-intro");
  assert.equal(state.levels.toxin, 2);
  assert.match(M.view(state).lines.join(" "), /does not move|level stays|The level stays/);
});

test("just tell me blocks the level and covers only that question", function () {
  let state = throughTeach("bloat");
  assert.equal(M.view(state).utilities.tell, true);
  state = M.reduce(state, { type: "tell" });
  assert.equal(state.phase, "explained");
  assert.match(M.view(state).lines.join(" "), /for this question only/);
  assert.match(M.view(state).lines.join(" "), new RegExp(M.LESSONS.bloat.reveal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  state = M.reduce(state, { type: "continue" });
  assert.equal(state.stage, "retest");
  state = answerRight(state);
  assert.equal(state.levels.bloat, 2);
  assert.equal(state.phase, "review-intro");
});

test("a missed spaced review lowers the earlier subskill", function () {
  let state = throughTeach("toxin");
  state = answerRight(state);
  state = answerRight(state);
  state = answerRight(state);
  assert.equal(state.reviewSkill, "sort");
  const before = state.levels.sort;
  state = M.reduce(state, { type: "continue" });
  assert.equal(state.phase, "review");
  assert.equal(M.view(state).question.kicker, "Spaced review");
  state = answerWrong(state);
  assert.equal(state.phase, "review-result");
  assert.equal(state.levels.sort, before - 1);
  assert.match(M.view(state).lines.join(" "), /drops from/);
});

test("a passed review does not raise a level", function () {
  let state = throughTeach("routine");
  state = answerRight(state);
  state = answerRight(state);
  state = answerRight(state);
  const reviewed = state.reviewSkill;
  const before = state.levels[reviewed];
  state = M.reduce(state, { type: "continue" });
  state = answerRight(state);
  assert.equal(state.levels[reviewed], before);
  assert.match(M.view(state).lines.join(" "), /does not raise a level/);
});

test("the short final assessment reports weakest areas and stops", function () {
  let state = throughTeach("sort");
  state = answerRight(state);
  state = answerRight(state);
  state = answerRight(state);
  state = M.reduce(state, { type: "continue" });
  state = answerRight(state);
  state = M.reduce(state, { type: "continue" });
  assert.equal(state.phase, "final-intro");
  assert.match(M.view(state).lines.join(" "), /default 4 out of 5/);
  assert.match(M.view(state).lines.join(" "), /integrative problem/);
  state = M.reduce(state, { type: "continue" });
  assert.equal(state.phase, "final");
  assert.equal(M.view(state).question.typeLabel, "Apply");
  state = answerRight(state);
  assert.equal(state.finalStep, 1);
  assert.equal(M.view(state).question.kicker, "Integrative problem");
  state = answerWrong(state);
  assert.equal(state.phase, "final-narrow");
  const narrow = M.view(state);
  assert.match(narrow.lines.join(" "), /Not quite/);
  assert.ok(!narrow.question.prompt.includes(M.FINALS[1].tell));
  state = answerRight(state);
  assert.equal(state.phase, "done");
  assert.equal(state.finalClean, false);
  const done = M.view(state);
  assert.match(done.lines.join(" "), /not a clean pass/);
  assert.match(done.lines.join(" "), /Weakest on this map/);
  assert.match(done.lines.join(" "), /scripted/i);
});

test("a clean final sample says both questions were right", function () {
  let state = throughTeach("toxin");
  state = answerRight(state);
  state = answerRight(state);
  state = answerRight(state);
  state = M.reduce(state, { type: "continue" });
  state = answerRight(state);
  state = M.reduce(state, { type: "continue" });
  state = M.reduce(state, { type: "continue" });
  state = answerRight(state);
  state = answerRight(state);
  assert.equal(state.phase, "done");
  assert.equal(state.finalHits, 2);
  assert.equal(state.finalClean, true);
  assert.match(M.view(state).lines.join(" "), /right on the first try/);
});

test("save state and show progress do not change levels", function () {
  let state = throughDiagnostic(HITS);
  const before = JSON.stringify(state.levels);
  state = M.reduce(state, { type: "progress" });
  assert.equal(state.progressNote, true);
  assert.equal(JSON.stringify(state.levels), before);
  assert.match(M.view(state).lines.join(" "), /Placement only/);
  state = M.reduce(state, { type: "save" });
  assert.match(state.saveText, /topic: Phone triage at Brightside Veterinary Clinic/);
  assert.match(state.saveText, /toxin 2/);
  assert.equal(JSON.stringify(state.levels), before);
  assert.match(app, /resume from:/);
  assert.match(M.view(state).saveText, /levels:/);
});

test("the comparison is an illustration, and only the Socratic path is set up to pass", function () {
  assert.match(M.COMPARE.disclaimer, /Illustrative simulation, not a study result/);
  assert.match(M.COMPARE.laterLabel, /a few questions later/);
  assert.match(M.COMPARE.skillNote, /just tell me/);
  assert.equal(M.COMPARE.socratic.result, "pass");
  assert.equal(M.COMPARE.dump.result, "miss");
  assert.match(M.COMPARE.dump.reply, /That's wrong/);
  assert.match(M.COMPARE.dump.reply, /come now/i);
  assert.doesNotMatch(M.COMPARE.socratic.reply, /come now/i);
  assert.doesNotMatch(M.COMPARE.socratic.reply, /emergency/i);
  assert.doesNotMatch(M.COMPARE.socratic.reply, /That's wrong/);
  assert.match(M.COMPARE.socratic.reply, /\?$/);
  assert.match(M.COMPARE.learner, /grapes/);
  assert.match(M.COMPARE.laterCase, /lily/);
  assert.match(app, /COMPARE/);
  assert.match(app, /data-mode/);
});

test("reduce ignores answers that are not on the current screen", function () {
  const start = M.initialState();
  assert.equal(M.reduce(start, { type: "answer", id: "now" }), start);
  assert.equal(M.reduce(start, { type: "focus", id: "toxin" }), start);
  assert.equal(M.reduce(start, { type: "tell" }).phase, "intent");
});
