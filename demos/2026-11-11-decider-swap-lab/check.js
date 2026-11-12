import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function load() {
  const context = { console };
  context.globalThis = context;
  const code = readFileSync(new URL("./model.js", import.meta.url), "utf8");
  vm.runInNewContext(code, context, { filename: "model.js" });
  return context.DeciderSwap;
}

const model = load();
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./model.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const bundle = page + app + css + source;

const sorted = { mode: "decider", thresholdPercent: 60, fallback: "human", keyOrder: "sorted" };

test("the lab index lists this demo after the previous day", () => {
  const holdoutAt = index.indexOf("demos/2026-11-10-holdout-overfit-lab/");
  const here = index.indexOf("demos/2026-11-11-decider-swap-lab/");
  const marker = index.indexOf("<!-- demos -->");
  assert.ok(holdoutAt !== -1 && holdoutAt < here && here < marker);
  assert.match(index, /2026-11-11: Swap the LLM for a decision model/);
  assert.match(index, /badlogicgames\/status\/2120089050476368318/);
  assert.match(index, /Source post/);
  assert.match(index, /Cincinnati/);
});

test("the page cites the post, the blog, and the simulation", () => {
  assert.match(page, /badlogicgames\/status\/2120089050476368318/);
  assert.match(page, /Mario Zechner/);
  assert.match(page, /Andrew bookmarked/);
  assert.match(page, /classifiers are all you need/);
  assert.match(page, /strandsagents\.com\/blog\/amazon-saves-millions-replacing-sonnet-with-strands-decider/);
  assert.match(page, /Nov 9, 2026/);
  assert.match(page, /Cumminsville Comfort/);
  assert.match(page, /Cincinnati/);
  assert.match(page, /fictional|made-up/);
  assert.match(page, /Simulation/);
  assert.match(page, /not a trained model/i);
  assert.match(page, /viewport/);
  assert.match(page, /<noscript>/);
  assert.match(page, /data-mode="llm"/);
  assert.match(page, /data-mode="dual"/);
  assert.match(page, /data-mode="decider"/);
  assert.match(page, /data-fallback="human"/);
  assert.match(page, /data-fallback="llm"/);
  assert.match(page, /Sort keys/);
  assert.match(page, /Shuffle JSON key order/);
  assert.match(page, /Human review/);
  assert.match(page, /Fall back to the LLM/);
  for (const phrase of [
    "4,215 ms",
    "6,554",
    "170",
    "$0.0222",
    "$22,200",
    "$3 per million input",
    "$15 per million output",
    "897 ms",
    "2,009",
    "ml.g5.xlarge",
    "$1.408",
    "640 ms",
    "5,600",
    "$250",
    "$500",
    "44×",
    "98%",
    "20 categories",
    "AppConfig",
    "BEDROCK",
    "DUAL",
    "DECIDER",
    "45-second",
    "0.19",
    "closed choice from a known catalog",
    "Volume is high",
    "Latency matters",
    "explanation text",
    "changes weekly",
    "few thousand tokens",
    "one- or two-sentence criterion",
    "self-hosted",
    "predictability",
    "dollar savings are tiny",
    "savings dominate",
  ]) {
    assert.match(page, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  model.LABELS.forEach((label) => {
    assert.match(page, new RegExp(label.criterion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(page, new RegExp(label.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("the page stays local and phone-friendly", () => {
  assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|new WebSocket|googleapis|cdn\.|api[_-]?key|innerHTML/i);
  assert.match(css, /system-ui/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(page, /src="\.\/model\.js"/);
  assert.match(page, /src="\.\/app\.js"/);
  assert.match(page, /href="\.\/styles\.css"/);
});

test("the inbox is 36 fictional messages across 7 labels", () => {
  assert.equal(model.MESSAGES.length, 36);
  assert.equal(model.LABELS.length, 7);
  assert.equal(model.SHOP.name, "Cumminsville Comfort");
  const ids = model.MESSAGES.map((message) => message.id);
  assert.equal(new Set(ids).size, ids.length);
  const truths = {};
  model.MESSAGES.forEach((message) => {
    assert.ok(model.labelById(message.truth));
    truths[message.truth] = (truths[message.truth] || 0) + 1;
    assert.doesNotMatch(message.text, /@|https?:|\b\d{3}[-.)]\d{3}/);
    assert.ok(message.text.length > 20);
  });
  model.LABELS.forEach((label) => assert.ok(truths[label.id] >= 3, label.id));
  assert.equal(model.MESSAGES.filter((message) => message.clarity === "clear").length, 24);
  assert.equal(model.MESSAGES.filter((message) => message.clarity === "borderline").length, 6);
  assert.equal(model.MESSAGES.filter((message) => message.clarity === "ambiguous").length, 6);
});

test("probabilities sum to 1 and the nudge never exceeds 0.19", () => {
  let max = 0;
  model.MESSAGES.forEach((message) => {
    ["sorted", "shuffled"].forEach((keyOrder) => {
      const scored = model.score(message, "decider", keyOrder);
      const total = model.ORDER.reduce((sum, id) => sum + scored.thousandths[id], 0);
      assert.equal(total, 1000);
      model.ORDER.forEach((id) => {
        assert.ok(scored.thousandths[id] >= 0);
        assert.ok(scored.thousandths[id] <= 1000);
      });
    });
    model.ORDER.forEach((id) => {
      max = Math.max(max, Math.abs(message.nudge[id]));
    });
    const llmShuffled = model.score(message, "llm", "shuffled");
    const llmSorted = model.score(message, "llm", "sorted");
    assert.deepEqual(llmShuffled.thousandths, llmSorted.thousandths);
  });
  assert.equal(max, 190);
  assert.equal(model.POST.keyOrderMaxDelta, 0.19);
});

test("clear cases agree, borderline cases flip, ambiguous cases stay wrong", () => {
  model.MESSAGES.forEach((message) => {
    const llm = model.score(message, "llm", "sorted");
    const sorted = model.score(message, "decider", "sorted");
    const shuffled = model.score(message, "decider", "shuffled");
    if (message.clarity === "clear") {
      assert.equal(sorted.label, message.truth);
      assert.equal(shuffled.label, message.truth);
      assert.equal(llm.label, message.truth);
    }
    if (message.clarity === "borderline") {
      assert.equal(sorted.label, message.truth);
      assert.notEqual(shuffled.label, message.truth);
      assert.equal(llm.label, message.truth);
    }
    if (message.clarity === "ambiguous") {
      assert.notEqual(sorted.label, message.truth);
      assert.equal(shuffled.label, sorted.label);
    }
  });
  const gotcha = model.messageById("b2");
  assert.equal(gotcha.nudge.quote, -190);
  assert.equal(gotcha.nudge.maintenance, 190);
  const before = model.score(gotcha, "decider", "sorted");
  const after = model.score(gotcha, "decider", "shuffled");
  assert.equal(before.label, "quote");
  assert.equal(after.label, "maintenance");
  assert.equal(before.thousandths.quote - after.thousandths.quote, 190);
  const sortedText = model.payloadText(gotcha, "sorted");
  const shuffledText = model.payloadText(gotcha, "shuffled");
  assert.match(sortedText, /"body"[\s\S]*"channel"[\s\S]*"desk"[\s\S]*"received"/);
  assert.notEqual(sortedText, shuffledText);
});

test("the cutoff trades coverage for accuracy", () => {
  const open = model.evaluate({ mode: "decider", thresholdPercent: 0, fallback: "human", keyOrder: "sorted" });
  assert.equal(open.decider.labeled, 36);
  assert.equal(open.decider.correct, 30);
  assert.equal(open.decider.abstain, 0);
  assert.equal(open.agreement, 30);
  assert.equal(open.llmCorrect, 35);
  assert.equal(open.flipCount, 6);

  const mid = model.evaluate(sorted);
  assert.equal(mid.decider.labeled, 30);
  assert.equal(mid.decider.correct, 28);
  assert.equal(mid.decider.abstain, 6);
  assert.equal(
    model.thresholdSentence(mid, "human"),
    "At 60% confidence, the decider labels 30 of 36, 28 of those match the ground truth, and 6 go to a person."
  );

  const tight = model.evaluate({ mode: "decider", thresholdPercent: 80, fallback: "human", keyOrder: "sorted" });
  assert.equal(tight.decider.labeled, 24);
  assert.equal(tight.decider.correct, 24);
  assert.equal(tight.decider.abstain, 12);

  const none = model.evaluate({ mode: "decider", thresholdPercent: 100, fallback: "llm", keyOrder: "sorted" });
  assert.equal(none.decider.labeled, 0);
  assert.equal(none.decider.accuracy, null);
  assert.match(model.thresholdSentence(none, "llm"), /labels nothing/);
});

test("DUAL keeps the LLM label and shuffle adds the borderline disagreements", () => {
  const dual = model.evaluate({ mode: "dual", thresholdPercent: 60, fallback: "human", keyOrder: "sorted" });
  assert.equal(dual.agreement, 30);
  const row = dual.rows.find((item) => item.id === "a1");
  assert.equal(row.agree, false);
  assert.equal(row.source, "llm");
  assert.equal(row.applied, row.llm.label);
  assert.equal(row.applied, row.truth);

  const shuffled = model.evaluate({ mode: "dual", thresholdPercent: 0, fallback: "human", keyOrder: "shuffled" });
  assert.equal(shuffled.agreement, 24);
  assert.equal(Array.from(shuffled.flipIds).sort().join(","), "b1,b2,b3,b4,b5,b6");
  assert.equal(shuffled.llmCorrect, 35);
  const flipped = shuffled.rows.find((item) => item.id === "b2");
  assert.equal(flipped.agree, false);
  assert.equal(flipped.decider.label, "maintenance");
});

test("abstaining routes to a person or back to the LLM", () => {
  const human = model.evaluate(sorted).rows.find((row) => row.id === "a1");
  assert.equal(human.source, "human");
  assert.equal(human.applied, "human");
  assert.equal(human.abstained, true);

  const llm = model.evaluate({ mode: "decider", thresholdPercent: 60, fallback: "llm", keyOrder: "sorted" });
  const row = llm.rows.find((item) => item.id === "a1");
  assert.equal(row.source, "llm");
  assert.equal(row.applied, row.llm.label);
  assert.equal(llm.resolvedCorrect, 34);

  const kept = llm.rows.find((item) => item.id === "c01");
  assert.equal(kept.source, "decider");
  assert.equal(kept.applied, kept.truth);
});

test("money and latency use the post's per-ticket figures", () => {
  assert.equal(model.VOLUMES[0], 2000);
  assert.equal(model.VOLUMES[model.VOLUMES.length - 1], 2000000);
  assert.ok(Math.abs(model.tokenUsd() - 0.022212) < 1e-9);
  assert.equal(model.monthInstanceCents(), 102784);

  const shop = model.bill(2000, "llm", 6, 36, "human");
  assert.equal(shop.llmCents, 4440);
  assert.equal(shop.practicalCents, 100);
  assert.equal(shop.fullCents, 50);
  assert.equal(shop.band, "small");
  assert.match(model.volumeSentence(shop), /\$44\.40/);
  assert.match(model.volumeSentence(shop), /\$1\.00/);

  const dual = model.bill(2000, "dual", 6, 36, "human");
  assert.equal(dual.switchCents, 4540);

  const blend = model.bill(1000000, "decider", 6, 36, "llm");
  assert.equal(blend.llmCents, 2220000);
  assert.equal(blend.practicalCents, 50000);
  assert.equal(blend.fullCents, 25000);
  assert.equal(blend.extraCents, 370000);
  assert.equal(blend.blendLlmCents, 420000);
  assert.equal(blend.switchCents, 420000);
  assert.equal(blend.band, "high");
  assert.match(model.volumeSentence(blend), /savings dominate/);
  assert.match(model.switchSentence(model.evaluate({ mode: "decider", thresholdPercent: 60, fallback: "llm", keyOrder: "sorted" }), blend), /\$4,200/);

  assert.equal(model.appliedMs("llm", 6, 36, "human"), 4215);
  assert.equal(model.appliedMs("dual", 6, 36, "llm"), 4215);
  assert.equal(model.appliedMs("decider", 6, 36, "human"), 897);
  assert.equal(model.appliedMs("decider", 6, 36, "llm"), 1600);

  const human = model.bill(2000, "decider", 6, 36, "human");
  assert.equal(human.switchCents, 100);
  assert.match(model.switchSentence(model.evaluate(sorted), human), /person's time is not/);
});

test("sorting keys restores the decider and the payload", () => {
  const message = model.messageById("b2");
  const once = model.score(message, "decider", "sorted");
  const twice = model.score(message, "decider", "sorted");
  assert.deepEqual(once.thousandths, twice.thousandths);
  assert.deepEqual(once.thousandths, message.decider.p);
  assert.match(model.gotchaSentence("shuffled"), /top label flips/);
  assert.match(model.gotchaSentence("sorted"), /Keys are sorted/);
  assert.match(model.configText("llm"), /BEDROCK/);
  assert.match(model.configText("decider"), /DECIDER/);
  assert.match(model.agreementSentence(model.evaluate(sorted)), /30 of 36/);
});
