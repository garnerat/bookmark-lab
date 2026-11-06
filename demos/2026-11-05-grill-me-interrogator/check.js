import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.GrillMe;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

function local(list, map) {
  return Array.from(list, map || ((item) => item));
}

function walkExtreme(seed, which) {
  let state = seed;
  for (let guard = 0; guard < 12; guard += 1) {
    const question = model.nextQuestion(state);
    if (!question) return state;
    const choice = which === "first" ? question.choices[0] : question.choices[question.choices.length - 1];
    const note = which === "last" ? "  example   note  " : "";
    state = model.give(state, choice.id, note);
  }
  throw new Error("The grill did not finish.");
}

test("the lab index links this demo and keeps the demos marker", () => {
  const posNew = index.indexOf("demos/2026-11-05-grill-me-interrogator/");
  const posNov4 = index.indexOf("demos/2026-11-04-semantic-layer/");
  const posMarker = index.indexOf("<!-- demos -->");
  assert.ok(posNov4 > 0 && posNew > posNov4 && posNew < posMarker);
  assert.equal((index.match(/<!-- demos -->/g) || []).length, 1);
  assert.match(index, /Grill the idea before you build/);
  assert.match(index, /2117734977312047537/);
  assert.match(index, /Source post/);
});

test("the page credits the stack post, names the skill, and stays local", () => {
  assert.match(page, /2117734977312047537/);
  assert.match(page, /\/grill-me/);
  assert.match(page, /mattpocock\/skills/);
  assert.match(page, /Oakley Heating &amp; Cooling|Oakley Heating & Cooling/);
  assert.match(page, /Northside/);
  assert.match(page, /Cincinnati/);
  assert.match(page, /fictional/i);
  assert.match(page, /example data/i);
  assert.match(page, /viewport/);
  assert.match(page, new RegExp(String(model.EXAMPLE_TUNEUPS)));
  assert.match(page, /Holes found/);
  assert.match(page, /Tightened one-paragraph spec/);
  assert.match(page, /Build now vs grill first/);
  assert.match(page, /Start over/);
  assert.match(page, /AI quoting bot for HVAC/);
  assert.match(page, /Agent that texts customers for reviews/);
  assert.match(page, /Chatbot on the website that books tune-ups/);
  assert.match(page, /Bot that writes our Facebook ads/);
  assert.match(page, /Shallow/);
  assert.match(page, /Deep/);
  assert.match(page, new RegExp("maxlength=\"" + model.IDEA_MAX + "\""));
  assert.match(page, new RegExp("maxlength=\"" + model.NOTE_MAX + "\""));
  assert.ok(page.includes(model.DEPTHS.deep.blurb));
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset/);
  assert.match(app, /reset-grill/);
  assert.match(app, /Holes found|holes/);
  assert.doesNotMatch(app, /innerHTML/);
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\.|api[_-]?key/i);
  assert.doesNotMatch(bundle, /\b(sk-|sk_live|AKIA)[A-Za-z0-9]/);
  for (const preset of model.PRESETS) {
    assert.match(page, new RegExp(preset.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("preset text routes to its own grill, and loose words follow keywords", () => {
  assert.equal(model.PRESETS.length, 4);
  for (const preset of model.PRESETS) {
    assert.equal(model.trackFor(preset.text, preset.id), preset.track);
    assert.equal(model.trackFor(preset.text, null), preset.track);
    assert.deepEqual(local(model.ambiguousTracks(preset.text, preset.id)), []);
  }
  assert.equal(model.trackFor("please text people for a rating", null), "reviews");
  assert.equal(model.trackFor("facebook campaign for spring", null), "ads");
  assert.equal(model.trackFor("organize the truck stock", null), "custom");
  const mixed = "a chatbot that quotes prices and books tune-ups";
  assert.equal(model.trackFor(mixed, null), "book");
  assert.deepEqual(local(model.ambiguousTracks(mixed, null)), ["quote", "book"]);
  const drifted = model.begin(model.PRESETS[0].text + " please", "deep", "quote");
  assert.equal(drifted.presetId, null);
  const locked = model.begin(model.PRESETS[0].text, "deep", "quote");
  assert.equal(locked.presetId, "quote");
  assert.equal(model.trackOf(locked), "quote");
});

test("ideas and notes are capped, and a bad choice is refused", () => {
  const long = "word ".repeat(80);
  const state = model.begin(long, "deep", null);
  assert.equal(state.ideaText.length, model.IDEA_MAX);
  assert.equal(model.ideaForGrill("  hello   world  "), "hello world");
  assert.equal(model.clampIdea("a".repeat(250)).length, model.IDEA_MAX);
  const started = model.begin("Keep the truck stock list current.", "deep", null);
  assert.throws(() => model.give(started, "not-a-choice"));
  assert.throws(() => model.give(model.begin("   ", "deep", null), "owner"));
  const answered = model.give(started, model.nextQuestion(started).choices[0].id, "x".repeat(200));
  assert.equal(answered.answers[0].note.length, model.NOTE_MAX);
});

test("each track has one question per check, and ids do not collide", () => {
  const ids = new Set();
  for (const question of model.QUESTIONS) {
    assert.equal(ids.has(question.id), false);
    ids.add(question.id);
    const choiceIds = question.choices.map((choice) => choice.id);
    assert.equal(new Set(choiceIds).size, choiceIds.length);
    assert.ok(question.choices.length >= 3);
    if (question.theme === "slice") {
      question.choices.forEach((choice) => {
        assert.ok(choice.sliceLabel);
        assert.ok(choice.specLabel);
        assert.ok(choice.detail);
      });
    } else if (question.theme !== "contradiction") {
      question.choices.forEach((choice) => assert.ok(choice.sentence.length > 20));
    }
  }
  for (const preset of model.PRESETS) {
    for (const depth of ["shallow", "deep"]) {
      const state = model.begin(preset.text, depth, preset.id);
      for (const theme of model.DEPTHS[depth].themes) {
        const found = model.QUESTIONS.filter((question) => question.theme === theme && question.depths.includes(depth) && question.tracks.includes(preset.track));
        assert.equal(found.length, 1, preset.track + " " + depth + " " + theme);
      }
      assert.equal(model.nextQuestion(state).id.startsWith(preset.track), true);
    }
  }
  const custom = model.begin("Keep the truck stock list current.", "deep", null);
  assert.equal(model.trackOf(custom), "custom");
  assert.equal(model.nextQuestion(custom).id.startsWith("custom"), true);
});

test("a tight deep grill stops at six, and a risky one runs to eight", () => {
  for (const preset of model.PRESETS.concat([{ id: null, text: "Keep the truck stock list current.", track: "custom" }])) {
    const tight = walkExtreme(model.begin(preset.text, "deep", preset.id), "first");
    assert.deepEqual(local(tight.answers, (answer) => answer.theme), local(model.DEPTHS.deep.themes));
    assert.equal(new Set(tight.answers.map((answer) => answer.questionId)).size, 6);
    assert.equal(model.ambitious(tight), false);
    assert.equal(model.activePairs(tight).length, 0);
    assert.deepEqual(local(model.holes(tight), (hole) => hole.id), ["fiction"]);
    assert.match(model.holes(tight)[0].body, new RegExp(String(model.EXAMPLE_TUNEUPS)));
    assert.equal(model.finished(tight), true);

    const risky = walkExtreme(model.begin(preset.text, "deep", preset.id), "last");
    assert.equal(risky.answers.length, 8);
    assert.deepEqual(local(risky.answers, (answer) => answer.theme).slice(0, 6), local(model.DEPTHS.deep.themes));
    assert.equal(risky.answers[6].theme, "slice");
    assert.equal(risky.answers[7].theme, "contradiction");
    assert.equal(model.nextQuestion(risky), null);
    const holeIds = model.holes(risky).map((hole) => hole.id);
    assert.ok(holeIds.includes("keep-big"));
    assert.ok(holeIds.includes("fiction"));
    assert.ok(model.holes(risky).some((hole) => hole.tone === "contradiction"));
    const view = model.present(model.give(
      { ...risky, answers: risky.answers.slice(0, 7) },
      risky.answers[7].choiceId
    ));
    assert.equal(view, null);
  }
});

test("shallow is three questions, and a conflict stays a hole instead of an extra question", () => {
  for (const preset of model.PRESETS) {
    const state = walkExtreme(model.begin(preset.text, "shallow", preset.id), "last");
    assert.deepEqual(local(state.answers, (answer) => answer.theme), ["customer", "success", "constraint"]);
    assert.match(model.spec(state), /were not asked/);
    assert.ok(model.holes(state).some((hole) => hole.id === "shallow"));
    assert.equal(model.comparison(state).slice.source, "default");
  }
  const conflicted = model.walk(model.begin(model.PRESETS[0].text, "shallow", "quote"), ["dispatcher", "accept", "book"]);
  assert.equal(conflicted.answers.length, 3);
  assert.equal(model.nextQuestion(conflicted), null);
  assert.ok(model.holes(conflicted).some((hole) => hole.tone === "contradiction"));
  assert.match(model.spec(conflicted), /accept a price|accept a bot price|price the customer can accept/i);
});

test("follow-up questions depend on the answers, and backing up recomputes the path", () => {
  const reviews = model.PRESETS.find((preset) => preset.id === "reviews");
  let state = model.walk(model.begin(reviews.text, "deep", "reviews"), ["finished", "consent", "friday", "wrong", "nothing", "owner"]);
  assert.equal(model.ambitious(state), false);
  assert.equal(model.nextQuestion(state).theme, "contradiction");
  assert.match(model.present(state).prompt, /Two answers are fighting/);
  state = model.give(state, "shrink");
  assert.equal(state.answers.length, 7);
  assert.equal(model.nextQuestion(state), null);
  assert.ok(model.holes(state).some((hole) => hole.id === "settled"));
  assert.equal(model.holes(state).some((hole) => hole.tone === "contradiction"), false);
  assert.match(model.spec(state), /tighter limit/);
  assert.equal(model.comparison(state).slice.id, "friday");

  const waiting = model.give(
    model.walk(model.begin(reviews.text, "deep", "reviews"), ["finished", "consent", "friday", "wrong", "nothing", "owner"]),
    "wait"
  );
  assert.equal(model.comparison(waiting).slice.id, "wait");
  assert.match(model.spec(waiting), /no bot this week/);

  let backed = {
    ideaText: state.ideaText,
    depth: state.depth,
    presetId: state.presetId,
    answers: state.answers.slice(0, 4),
  };
  assert.equal(model.nextQuestion(backed).theme, "data");
  backed = model.give(backed, "sheet");
  backed = model.give(backed, "owner");
  assert.equal(model.nextQuestion(backed), null);
  assert.equal(backed.answers.length, 6);

  const quote = model.PRESETS[0];
  const wide = model.walk(model.begin(quote.text, "deep", "quote"), ["anyone", "book", "approve", "underbid", "book", "owner"]);
  assert.equal(model.nextQuestion(wide).theme, "slice");
  const cut = model.give(wide, "draft");
  assert.equal(model.nextQuestion(cut), null);
  assert.equal(model.comparison(cut).slice.source, "answer");
  assert.equal(model.comparison(cut).slice.id, "draft");
  assert.match(model.holes(cut).map((hole) => hole.id).join(","), /broad/);
});

test("the spec is one paragraph from the answers, and skipped scope matches the idea", () => {
  const quote = model.PRESETS[0];
  const tight = walkExtreme(model.begin(quote.text, "deep", "quote"), "first");
  const paragraph = model.spec(tight);
  assert.match(paragraph, /dispatcher/);
  assert.match(paragraph, /price book/i);
  assert.match(paragraph, /8 of 10/);
  assert.match(paragraph, /fictional/);
  assert.match(paragraph, /The owner reads the quote/);
  assert.match(paragraph, /The first build is drafts for replacement visits/);
  assert.equal(paragraph.includes("\n"), false);
  assert.doesNotMatch(paragraph, /were not asked/);

  const fought = model.walk(model.begin(quote.text, "deep", "quote"), ["dispatcher", "book", "accept", "underbid", "nothing", "owner"]);
  assert.equal(model.nextQuestion(fought).theme, "slice");
  const settled = model.give(model.give(fought, "draft"), "shrink");
  const settledSpec = model.spec(settled);
  assert.match(settledSpec, /tighter limit/);
  assert.doesNotMatch(settledSpec, /customer can accept a bot price/);
  assert.match(settledSpec, /price book/i);

  for (const preset of model.PRESETS) {
    const state = model.begin(preset.text, "deep", preset.id);
    const labels = model.comparison(state).skipped.map((item) => item.label);
    assert.ok(labels.includes("Full CRM sync"), preset.id);
  }
  const reviews = model.begin(model.PRESETS[1].text, "deep", "reviews");
  assert.ok(model.comparison(reviews).skipped.some((item) => item.label === "SMS carrier setup"));
  const ads = model.begin(model.PRESETS[3].text, "deep", "ads");
  assert.ok(model.comparison(ads).skipped.some((item) => item.label === "Facebook Ads API"));
  const quotedText = model.begin("Build an AI quoting bot for HVAC jobs and text customers the total", "deep", null);
  assert.equal(model.trackOf(quotedText), "quote");
  const labels = model.comparison(quotedText).skipped.map((item) => item.label);
  assert.ok(labels.includes("SMS carrier setup"));
  assert.ok(labels.includes("Live price engine"));
  assert.ok(labels.includes("Full CRM sync"));
});
