/* node check.js
   The buggy models find a violation. The fixed models find none. */
const assert = require("node:assert");
const { explore, play, getScenario } = require("./model.js");

let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("ok  " + name);
  } catch (err) {
    failed += 1;
    console.error("FAIL " + name);
    console.error(err && err.stack ? err.stack : err);
  }
}

function ids(steps) {
  return steps.filter((step) => step.actionId).map((step) => step.actionId);
}

function failsOnlyAtEnd(steps, id) {
  for (let i = 0; i < steps.length; i++) {
    const broken = steps[i].brokenIds.indexOf(id) !== -1;
    if (i < steps.length - 1) assert.strictEqual(broken, false, "prefix step " + i);
    else assert.strictEqual(broken, true, "final step");
  }
}

test("booking bug is a 5-step double charge, and the other invariants hold", () => {
  const buggy = explore("booking", false);
  assert.ok(buggy.violation);
  assert.strictEqual(buggy.violation.id, "charged-twice");
  assert.strictEqual(buggy.violation.steps, 5);
  assert.deepStrictEqual(ids(buggy.violation.trace), [
    "ada-hold",
    "ada-pay",
    "charge",
    "timeout",
    "charge",
  ]);
  failsOnlyAtEnd(buggy.violation.trace, "charged-twice");
  const last = buggy.violation.trace[buggy.violation.trace.length - 1].state;
  assert.strictEqual(last.charges, 2);
  assert.strictEqual(last.processor, "done");
  assert.strictEqual(last.webhook, "retrying");

  const broken = buggy.invariants.filter((inv) => !inv.ok).map((inv) => inv.id);
  assert.deepStrictEqual(broken, ["charged-twice"]);

  for (const state of buggy.states) {
    for (const inv of getScenario("booking").invariants) {
      if (inv.id === "charged-twice") continue;
      assert.strictEqual(inv.holds(state), true, inv.id);
    }
  }
});

test("booking fix charges once on the same steps and has no violations", () => {
  const buggy = explore("booking", false);
  const fixed = explore("booking", true);
  assert.strictEqual(fixed.violation, null);
  assert.ok(fixed.invariants.every((inv) => inv.ok));
  assert.notStrictEqual(fixed.statesExplored, buggy.statesExplored);
  assert.ok(fixed.statesExplored < buggy.statesExplored);

  const replay = play("booking", true, ids(buggy.violation.trace));
  assert.strictEqual(replay.blocked, null);
  assert.ok(replay.steps.every((step) => step.state.charges <= 1));
  assert.strictEqual(replay.steps[replay.steps.length - 1].state.charges, 1);
  assert.ok(replay.steps.every((step) => step.brokenIds.length === 0));

  for (const state of fixed.states) {
    assert.ok(state.charges <= 1);
  }
});

test("a retry before the capture is not a double charge", () => {
  const early = play("booking", false, [
    "ada-hold",
    "ada-pay",
    "timeout",
    "charge",
    "observe",
    "remind",
  ]);
  assert.strictEqual(early.blocked, null);
  const mid = early.steps[3].state;
  assert.strictEqual(mid.charges, 0);
  assert.strictEqual(mid.webhook, "retrying");
  const end = early.steps[early.steps.length - 1].state;
  assert.strictEqual(end.charges, 1);
  assert.strictEqual(end.booking, "confirmed");
  assert.strictEqual(end.reminder, "sent");
  assert.ok(early.steps.every((step) => step.brokenIds.length === 0));
});

test("reschedule keeps the slot and the happy path confirms", () => {
  const moved = play("booking", false, [
    "ada-hold",
    "ada-reschedule",
    "ada-pay",
    "charge",
    "observe",
    "remind",
  ]);
  const end = moved.steps[moved.steps.length - 1].state;
  assert.strictEqual(end.day, "Fri 9am");
  assert.strictEqual(end.slotOwner, "ada");
  assert.strictEqual(end.charges, 1);
  assert.strictEqual(end.reminder, "sent");
  assert.ok(moved.steps.every((step) => step.brokenIds.length === 0));

  const happy = play("booking", false, getScenario("booking").samples[1].actions);
  assert.strictEqual(happy.steps[happy.steps.length - 1].state.booking, "confirmed");
  assert.ok(happy.steps.every((step) => step.brokenIds.length === 0));
});

test("cancel drops a queued reminder and releases the slot", () => {
  const path = play("booking", false, ["ada-hold", "ada-pay", "charge", "observe", "ada-cancel"]);
  const end = path.steps[path.steps.length - 1].state;
  assert.strictEqual(end.booking, "cancelled");
  assert.strictEqual(end.slotOwner, "none");
  assert.strictEqual(end.reminder, "idle");
  assert.strictEqual(end.charges, 1);
  assert.ok(path.steps.every((step) => step.brokenIds.length === 0));
});

test("booking invariant predicates reject crafted bad states", () => {
  const inv = Object.fromEntries(getScenario("booking").invariants.map((item) => [item.id, item]));
  const base = getScenario("booking").initial();
  assert.strictEqual(inv["charged-twice"].holds({ ...base, charges: 2 }), false);
  assert.strictEqual(inv["charged-twice"].holds({ ...base, charges: 1 }), true);
  assert.strictEqual(
    inv["double-booked"].holds({ ...base, customer: "holding", booking: "held", slotOwner: "none" }),
    false
  );
  assert.strictEqual(
    inv["no-late-reminder"].holds({ ...base, booking: "cancelled", reminder: "queued" }),
    false
  );
  assert.strictEqual(
    inv["no-late-reminder"].holds({ ...base, reminder: "sent", reminderAbout: "none" }),
    false
  );
});

test("invoice bug is the stale dunning snapshot, and the guard removes it", () => {
  const buggy = explore("invoice", false);
  const fixed = explore("invoice", true);
  assert.ok(buggy.violation);
  assert.strictEqual(buggy.violation.id, "no-dunning-after-pay");
  assert.strictEqual(buggy.violation.steps, 6);
  assert.deepStrictEqual(ids(buggy.violation.trace), [
    "send",
    "deliver",
    "record",
    "stage",
    "pay",
    "fire",
  ]);
  failsOnlyAtEnd(buggy.violation.trace, "no-dunning-after-pay");
  const broken = buggy.invariants.filter((inv) => !inv.ok).map((inv) => inv.id);
  assert.deepStrictEqual(broken, ["no-dunning-after-pay"]);

  assert.strictEqual(fixed.violation, null);
  assert.ok(fixed.invariants.every((inv) => inv.ok));
  assert.strictEqual(buggy.statesExplored, fixed.statesExplored + 1);

  const replay = play("invoice", true, ids(buggy.violation.trace));
  assert.strictEqual(replay.blockedId, "fire");
  const stuck = replay.steps[replay.steps.length - 1].state;
  assert.strictEqual(stuck.client, "paid");
  assert.strictEqual(stuck.dunning, "staged");
  assert.ok(replay.steps.every((step) => step.brokenIds.length === 0));

  for (const state of fixed.states) {
    assert.strictEqual(state.dunnedWhilePaid, false);
  }
});

test("paying before the dunning job is staged is safe", () => {
  const safe = play("invoice", false, ["send", "deliver", "record", "pay", "stage"]);
  assert.strictEqual(safe.blocked, null);
  const end = safe.steps[safe.steps.length - 1].state;
  assert.strictEqual(end.client, "paid");
  assert.strictEqual(end.snapshotUnpaid, false);
  assert.strictEqual(end.dunning, "staged");
  assert.ok(safe.steps.every((step) => step.brokenIds.length === 0));
  const fire = getScenario("invoice").actions.find((action) => action.id === "fire");
  assert.strictEqual(fire.enabled(end, false), false);
});

test("invoice predicates reject a second email and an early dunning note", () => {
  const inv = Object.fromEntries(getScenario("invoice").invariants.map((item) => [item.id, item]));
  const base = getScenario("invoice").initial();
  assert.strictEqual(inv["one-email"].holds({ ...base, emails: 2 }), false);
  assert.strictEqual(inv["dunning-after-invoice"].holds({ ...base, dunning: "staged", emails: 0 }), false);
  assert.strictEqual(inv["no-dunning-after-pay"].holds({ ...base, dunnedWhilePaid: true }), false);
  assert.strictEqual(
    inv["no-dunning-after-pay"].holds({ ...base, client: "paid", dunning: "sent", dunnedWhilePaid: false }),
    true
  );
});

test("charts only mention states and actions the model can reach", () => {
  for (const id of ["booking", "invoice"]) {
    for (const fix of [false, true]) {
      const result = explore(id, fix);
      const scenario = getScenario(id);
      const actionIds = new Set(scenario.actions.map((action) => action.id));
      for (const state of result.states) {
        for (const group of scenario.groups) {
          for (const region of group.regions) {
            const active = region.active(state);
            assert.ok(
              region.states.some((node) => node.id === active),
              id + " " + region.id + " missing " + active
            );
          }
        }
      }
      for (const group of scenario.groups) {
        for (const region of group.regions) {
          const known = new Set(region.states.map((node) => node.id));
          for (const edge of region.edges) {
            assert.ok(known.has(edge.from), edge.from);
            assert.ok(known.has(edge.to), edge.to);
            assert.ok(actionIds.has(edge.action), edge.action);
          }
        }
      }
    }
  }
});

test("searches are deterministic and finite", () => {
  for (const id of ["booking", "invoice"]) {
    const a = explore(id, false);
    const b = explore(id, false);
    assert.strictEqual(a.statesExplored, b.statesExplored);
    assert.deepStrictEqual(ids(a.violation.trace), ids(b.violation.trace));
    assert.ok(a.statesExplored > 10);
    assert.ok(a.statesExplored < 5000);
    console.log("     " + id + " buggy " + a.statesExplored + " / fixed " + explore(id, true).statesExplored);
  }
});

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all passed");
