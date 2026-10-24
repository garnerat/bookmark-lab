/* Explicit-state models and a tiny breadth-first checker.
   No DOM. The page and the node script both call StateHunt. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StateHunt = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STATE_LIMIT = 5000;

  function startStep(scenario, state) {
    return {
      actionId: null,
      actor: null,
      actorLabel: null,
      label: "Start",
      say: scenario.opening,
      state: state,
      brokenIds: brokenIds(scenario, state),
    };
  }

  function brokenIds(scenario, state) {
    const ids = [];
    for (let i = 0; i < scenario.invariants.length; i++) {
      if (!scenario.invariants[i].holds(state)) ids.push(scenario.invariants[i].id);
    }
    return ids;
  }

  function actionMap(scenario) {
    const map = new Map();
    for (let i = 0; i < scenario.actions.length; i++) {
      map.set(scenario.actions[i].id, scenario.actions[i]);
    }
    return map;
  }

  function makeStep(scenario, fix, action, before, after) {
    return {
      actionId: action.id,
      actor: action.actor,
      actorLabel: action.actorLabel,
      label: action.label,
      say: action.say(before, after, fix),
      state: after,
      brokenIds: brokenIds(scenario, after),
    };
  }

  function play(scenarioId, fix, actionIds) {
    const scenario = getScenario(scenarioId);
    const actions = actionMap(scenario);
    let state = scenario.initial();
    const steps = [startStep(scenario, state)];
    for (let i = 0; i < actionIds.length; i++) {
      const action = actions.get(actionIds[i]);
      if (!action || !action.enabled(state, !!fix)) {
        return {
          steps: steps,
          blocked: action || null,
          blockedId: actionIds[i],
        };
      }
      const next = action.apply(state, !!fix);
      steps.push(makeStep(scenario, !!fix, action, state, next));
      state = next;
    }
    return { steps: steps, blocked: null, blockedId: null };
  }

  function traceTo(scenario, fix, endKey, states, parent, actions) {
    const keys = [];
    let key = endKey;
    while (key) {
      keys.push(key);
      const prev = parent.get(key);
      key = prev ? prev.prev : null;
    }
    keys.reverse();
    const steps = [];
    for (let i = 0; i < keys.length; i++) {
      const state = states.get(keys[i]);
      if (i === 0) {
        steps.push(startStep(scenario, state));
      } else {
        const action = actions.get(parent.get(keys[i]).actionId);
        steps.push(makeStep(scenario, fix, action, states.get(keys[i - 1]), state));
      }
    }
    return steps;
  }

  function explore(scenarioId, fix) {
    const scenario = getScenario(scenarioId);
    const useFix = !!fix;
    const actions = actionMap(scenario);
    const init = scenario.initial();
    const initKey = scenario.key(init);
    const states = new Map();
    const parent = new Map();
    const queue = [initKey];
    states.set(initKey, init);
    parent.set(initKey, null);

    const firstBreak = new Map();
    if (brokenIds(scenario, init).length) {
      for (let i = 0; i < scenario.invariants.length; i++) {
        const inv = scenario.invariants[i];
        if (!inv.holds(init)) firstBreak.set(inv.id, initKey);
      }
    }

    let head = 0;
    while (head < queue.length) {
      if (states.size > STATE_LIMIT) {
        throw new Error("State limit exceeded for " + scenario.id);
      }
      const key = queue[head++];
      const state = states.get(key);
      for (let i = 0; i < scenario.actions.length; i++) {
        const action = scenario.actions[i];
        if (!action.enabled(state, useFix)) continue;
        const next = action.apply(state, useFix);
        const nextKey = scenario.key(next);
        if (states.has(nextKey)) continue;
        states.set(nextKey, next);
        parent.set(nextKey, { prev: key, actionId: action.id });
        queue.push(nextKey);
        for (let j = 0; j < scenario.invariants.length; j++) {
          const inv = scenario.invariants[j];
          if (!firstBreak.has(inv.id) && !inv.holds(next)) {
            firstBreak.set(inv.id, nextKey);
          }
        }
      }
    }

    const invariants = scenario.invariants.map(function (inv) {
      const endKey = firstBreak.get(inv.id) || null;
      const trace = endKey ? traceTo(scenario, useFix, endKey, states, parent, actions) : null;
      return {
        id: inv.id,
        name: inv.name,
        detail: inv.detail,
        ok: !endKey,
        steps: trace ? trace.length - 1 : null,
        trace: trace,
      };
    });

    let violation = null;
    for (let i = 0; i < invariants.length; i++) {
      const inv = invariants[i];
      if (inv.ok) continue;
      if (!violation || inv.steps < violation.steps) violation = inv;
    }

    return {
      scenarioId: scenario.id,
      fix: useFix,
      statesExplored: states.size,
      states: Array.from(states.values()),
      invariants: invariants,
      violation: violation,
    };
  }

  function bookingInitial() {
    return {
      customer: "browsing",
      slotOwner: "none",
      booking: "none",
      day: "Thu 2pm",
      processor: "idle",
      webhook: "idle",
      charges: 0,
      reminder: "idle",
      reminderAbout: "none",
    };
  }

  function bookingKey(s) {
    return [
      s.customer,
      s.slotOwner,
      s.booking,
      s.day,
      s.processor,
      s.webhook,
      s.charges,
      s.reminder,
      s.reminderAbout,
    ].join("|");
  }

  const booking = {
    id: "booking",
    title: "Portrait booking",
    blurb:
      "Ada holds a portrait slot at Maple Lane Studio, pays a deposit, and may cancel or move the day. The card processor and the shop agent run beside her. The shop confirms a capture, retries when it has not seen a result, and sends a reminder.",
    fixOn: "Fix on: idempotency key",
    fixOff: "Fix off",
    fixNoteOn:
      "The processor stores one idempotency key for this booking. A retry returns the first capture and does not charge again.",
    fixNoteOff:
      "Every charge request is new. If the shop retries after the capture already succeeded, the processor can take the deposit twice.",
    opening:
      "Ada is browsing the Thursday 2pm slot. It is open, the processor is idle, and nobody has been charged.",
    fixKind: "idempotency",
    initial: bookingInitial,
    key: bookingKey,
    samples: [
      { id: "bug", label: "Counterexample" },
      {
        id: "happy",
        label: "Happy path",
        actions: ["ada-hold", "ada-pay", "charge", "observe", "remind"],
      },
      {
        id: "early",
        label: "The other retry",
        actions: ["ada-hold", "ada-pay", "timeout", "charge", "observe", "remind"],
      },
      {
        id: "move",
        label: "Move the day",
        actions: ["ada-hold", "ada-reschedule", "ada-pay", "charge", "observe", "remind"],
      },
    ],
    actions: [
      {
        id: "ada-hold",
        actor: "customer",
        actorLabel: "Ada",
        label: "Hold the slot",
        enabled: function (s) {
          return s.customer === "browsing" && s.slotOwner === "none";
        },
        apply: function (s) {
          return {
            ...s,
            customer: "holding",
            slotOwner: "ada",
            booking: "held",
          };
        },
        say: function (_before, after) {
          return "Ada holds " + after.day + ". The slot is no longer open.";
        },
      },
      {
        id: "ada-pay",
        actor: "customer",
        actorLabel: "Ada",
        label: "Pay the deposit",
        enabled: function (s) {
          return s.customer === "holding" && s.processor === "idle" && s.webhook === "idle";
        },
        apply: function (s) {
          return {
            ...s,
            customer: "paying",
            processor: "working",
            webhook: "waiting",
          };
        },
        say: function () {
          return "Ada submits the deposit. The processor starts a charge, and the shop waits for the result.";
        },
      },
      {
        id: "ada-reschedule",
        actor: "customer",
        actorLabel: "Ada",
        label: "Reschedule",
        enabled: function (s) {
          return s.customer === "holding" || s.customer === "paying" || s.customer === "confirmed";
        },
        apply: function (s) {
          return {
            ...s,
            day: s.day === "Thu 2pm" ? "Fri 9am" : "Thu 2pm",
          };
        },
        say: function (_before, after) {
          return "Ada moves the sitting to " + after.day + " and keeps the slot.";
        },
      },
      {
        id: "ada-cancel",
        actor: "customer",
        actorLabel: "Ada",
        label: "Cancel",
        enabled: function (s) {
          return s.customer === "holding" || s.customer === "paying" || s.customer === "confirmed";
        },
        apply: function (s) {
          return {
            ...s,
            customer: "cancelled",
            booking: "cancelled",
            slotOwner: "none",
            reminder: s.reminder === "queued" ? "idle" : s.reminder,
          };
        },
        say: function (before) {
          if (before.reminder === "queued") {
            return "Ada cancels. The slot opens, and the queued reminder is dropped.";
          }
          if (before.charges >= 1) {
            return "Ada cancels and the slot opens. This model does not refund a charge that already happened.";
          }
          return "Ada cancels. The slot is open again.";
        },
      },
      {
        id: "charge",
        actor: "processor",
        actorLabel: "Processor",
        label: "Capture the deposit",
        enabled: function (s) {
          return s.processor === "working" && s.charges < 2;
        },
        apply: function (s, fix) {
          const already = s.charges >= 1;
          return {
            ...s,
            charges: fix && already ? s.charges : s.charges + 1,
            processor: "done",
          };
        },
        say: function (before, after, fix) {
          if (after.charges >= 2) {
            return "The processor treats the retry as a new charge. Ada has been charged twice for one deposit.";
          }
          if (fix && before.charges >= 1) {
            return "The processor finds this booking's idempotency key and returns the first capture. Ada has still been charged once.";
          }
          return "The processor captures the deposit. Ada has been charged once.";
        },
      },
      {
        id: "timeout",
        actor: "shop",
        actorLabel: "Shop",
        label: "Time out and retry",
        enabled: function (s) {
          return s.webhook === "waiting";
        },
        apply: function (s) {
          return {
            ...s,
            webhook: "retrying",
            processor: "working",
          };
        },
        say: function (before) {
          if (before.processor === "done" && before.charges >= 1) {
            return "The shop has not read the result, so it treats the charge as lost and asks the processor to run it again. The first capture already happened.";
          }
          return "The shop asks for another charge while the first attempt is still in flight. Nothing has been captured yet.";
        },
      },
      {
        id: "observe",
        actor: "shop",
        actorLabel: "Shop",
        label: "Read the result",
        enabled: function (s) {
          return s.processor === "done" && (s.webhook === "waiting" || s.webhook === "retrying");
        },
        apply: function (s) {
          if (s.booking !== "held") {
            return { ...s, webhook: "acked" };
          }
          return {
            ...s,
            webhook: "acked",
            booking: "confirmed",
            customer: "confirmed",
            reminder: "queued",
          };
        },
        say: function (before, after) {
          if (after.booking === "confirmed" && before.booking !== "confirmed") {
            return "The shop reads the successful charge, confirms the sitting, and queues a reminder.";
          }
          return "The shop reads the processor result and leaves the cancelled booking alone. No reminder is queued.";
        },
      },
      {
        id: "remind",
        actor: "shop",
        actorLabel: "Shop",
        label: "Send the reminder",
        enabled: function (s) {
          return s.reminder === "queued" && s.booking === "confirmed";
        },
        apply: function (s) {
          return {
            ...s,
            reminder: "sent",
            reminderAbout: "confirmed",
          };
        },
        say: function () {
          return "The shop sends the reminder. The booking is still confirmed, so this send is allowed.";
        },
      },
    ],
    invariants: [
      {
        id: "charged-twice",
        name: "A customer is never charged twice",
        detail: "The deposit for one booking is captured at most once.",
        holds: function (s) {
          return s.charges <= 1;
        },
      },
      {
        id: "double-booked",
        name: "A slot is never double-booked",
        detail: "The portrait slot has one owner, and a cancelled booking does not keep it.",
        holds: function (s) {
          const adaIn =
            s.customer === "holding" ||
            s.customer === "paying" ||
            s.customer === "confirmed" ||
            s.booking === "confirmed";
          if (adaIn && s.slotOwner !== "ada") return false;
          if (!adaIn && s.slotOwner === "ada") return false;
          if ((s.booking === "cancelled" || s.booking === "none") && s.slotOwner !== "none") return false;
          if (s.booking === "held" && s.slotOwner !== "ada") return false;
          if (s.slotOwner !== "none" && s.slotOwner !== "ada") return false;
          return true;
        },
      },
      {
        id: "no-late-reminder",
        name: "A cancelled booking never gets a reminder",
        detail: "A reminder is queued only while the booking is confirmed, and a queued one is dropped on cancel.",
        holds: function (s) {
          if (s.booking === "cancelled" && s.reminder === "queued") return false;
          if (s.reminder === "queued" && s.booking !== "confirmed") return false;
          if (s.reminder === "sent" && s.reminderAbout !== "confirmed") return false;
          return true;
        },
      },
    ],
    groups: [
      {
        id: "customer",
        title: "Ada",
        kicker: "Customer",
        note: "Reschedule stays in the current state and flips the day.",
        regions: [
          {
            id: "ada",
            title: "Booking",
            states: [
              { id: "browsing", label: "Browsing" },
              { id: "holding", label: "Holding" },
              { id: "paying", label: "Paying" },
              { id: "confirmed", label: "Confirmed" },
              { id: "cancelled", label: "Cancelled" },
            ],
            edges: [
              { from: "browsing", to: "holding", action: "ada-hold" },
              { from: "holding", to: "paying", action: "ada-pay" },
              { from: "paying", to: "confirmed", action: "observe" },
              { from: "holding", to: "cancelled", action: "ada-cancel" },
              { from: "paying", to: "cancelled", action: "ada-cancel" },
              { from: "confirmed", to: "cancelled", action: "ada-cancel" },
            ],
            active: function (s) {
              return s.customer;
            },
          },
        ],
      },
      {
        id: "processor",
        title: "Card processor",
        kicker: "Actor",
        note: "The dashed arrow is a retry after the processor has already finished.",
        regions: [
          {
            id: "processor",
            title: "Charge",
            states: [
              { id: "idle", label: "Idle" },
              { id: "working", label: "Working" },
              { id: "done", label: "Done" },
            ],
            edges: [
              { from: "idle", to: "working", action: "ada-pay" },
              { from: "working", to: "done", action: "charge" },
              { from: "done", to: "working", action: "timeout", dashed: true },
            ],
            active: function (s) {
              return s.processor;
            },
          },
        ],
      },
      {
        id: "shop",
        title: "Shop agent",
        kicker: "Parallel",
        note: "The webhook and the reminder are both part of the shop agent. A state of the chart is one state from each.",
        regions: [
          {
            id: "webhook",
            title: "Webhook",
            states: [
              { id: "idle", label: "Idle" },
              { id: "waiting", label: "Waiting" },
              { id: "retrying", label: "Retrying" },
              { id: "acked", label: "Acked" },
            ],
            edges: [
              { from: "idle", to: "waiting", action: "ada-pay" },
              { from: "waiting", to: "retrying", action: "timeout", dashed: true },
              { from: "waiting", to: "acked", action: "observe" },
              { from: "retrying", to: "acked", action: "observe" },
            ],
            active: function (s) {
              return s.webhook;
            },
          },
          {
            id: "reminder",
            title: "Reminder",
            states: [
              { id: "idle", label: "Idle" },
              { id: "queued", label: "Queued" },
              { id: "sent", label: "Sent" },
            ],
            edges: [
              { from: "idle", to: "queued", action: "observe" },
              { from: "queued", to: "sent", action: "remind" },
              { from: "queued", to: "idle", action: "ada-cancel", dashed: true },
            ],
            active: function (s) {
              return s.reminder;
            },
          },
        ],
      },
    ],
    specTitle: "TLA+ for the buggy booking model",
    spec: [
      "---- MODULE MapleLane ----",
      "EXTENDS Integers",
      "",
      "VARIABLES customer, slotOwner, booking, day, processor, webhook,",
      "          charges, reminder, reminderAbout",
      "",
      "Vars == <<customer, slotOwner, booking, day, processor, webhook,",
      "         charges, reminder, reminderAbout>>",
      "",
      "Init ==",
      '  /\\ customer = "browsing" /\\ slotOwner = "none" /\\ booking = "none"',
      '  /\\ day = "Thu 2pm" /\\ processor = "idle" /\\ webhook = "idle"',
      '  /\\ charges = 0 /\\ reminder = "idle" /\\ reminderAbout = "none"',
      "",
      "Hold ==",
      '  /\\ customer = "browsing" /\\ slotOwner = "none"',
      '  /\\ customer\' = "holding" /\\ slotOwner\' = "ada" /\\ booking\' = "held"',
      "  /\\ UNCHANGED <<day, processor, webhook, charges, reminder, reminderAbout>>",
      "",
      "Pay ==",
      '  /\\ customer = "holding" /\\ processor = "idle" /\\ webhook = "idle"',
      '  /\\ customer\' = "paying" /\\ processor\' = "working" /\\ webhook\' = "waiting"',
      "  /\\ UNCHANGED <<slotOwner, booking, day, charges, reminder, reminderAbout>>",
      "",
      "Reschedule ==",
      '  /\\ customer \\in {"holding", "paying", "confirmed"}',
      '  /\\ day\' = IF day = "Thu 2pm" THEN "Fri 9am" ELSE "Thu 2pm"',
      "  /\\ UNCHANGED <<customer, slotOwner, booking, processor, webhook,",
      "                charges, reminder, reminderAbout>>",
      "",
      "Cancel ==",
      '  /\\ customer \\in {"holding", "paying", "confirmed"}',
      '  /\\ customer\' = "cancelled" /\\ booking\' = "cancelled" /\\ slotOwner\' = "none"',
      '  /\\ reminder\' = IF reminder = "queued" THEN "idle" ELSE reminder',
      "  /\\ UNCHANGED <<day, processor, webhook, charges, reminderAbout>>",
      "",
      "\\* The bug is here together with Timeout. Charge does not remember",
      "\\* that this booking was already captured, so a retry adds another charge.",
      "\\* The search stops at 2, which is already enough to break the invariant.",
      "Charge ==",
      '  /\\ processor = "working" /\\ charges < 2',
      "  /\\ charges' = charges + 1 /\\ processor' = \"done\"",
      "  /\\ UNCHANGED <<customer, slotOwner, booking, day, webhook, reminder, reminderAbout>>",
      "",
      "\\* Enabled even when processor = \"done\": the shop has not read the result,",
      "\\* so it asks for the charge again. The next Charge can then fire twice.",
      "Timeout ==",
      '  /\\ webhook = "waiting"',
      '  /\\ webhook\' = "retrying" /\\ processor\' = "working"',
      "  /\\ UNCHANGED <<customer, slotOwner, booking, day, charges, reminder, reminderAbout>>",
      "",
      "ObserveHeld ==",
      '  /\\ processor = "done" /\\ webhook \\in {"waiting", "retrying"} /\\ booking = "held"',
      '  /\\ webhook\' = "acked" /\\ booking\' = "confirmed"',
      '  /\\ customer\' = "confirmed" /\\ reminder\' = "queued"',
      "  /\\ UNCHANGED <<slotOwner, day, processor, charges, reminderAbout>>",
      "",
      "ObserveOther ==",
      '  /\\ processor = "done" /\\ webhook \\in {"waiting", "retrying"} /\\ booking # "held"',
      '  /\\ webhook\' = "acked"',
      "  /\\ UNCHANGED <<customer, slotOwner, booking, day, processor, charges,",
      "                reminder, reminderAbout>>",
      "",
      "Observe == ObserveHeld \\/ ObserveOther",
      "",
      "Remind ==",
      '  /\\ reminder = "queued" /\\ booking = "confirmed"',
      '  /\\ reminder\' = "sent" /\\ reminderAbout\' = "confirmed"',
      "  /\\ UNCHANGED <<customer, slotOwner, booking, day, processor, webhook, charges>>",
      "",
      "Next == Hold \\/ Pay \\/ Reschedule \\/ Cancel \\/ Charge \\/ Timeout \\/ Observe \\/ Remind",
      "",
      "NeverChargedTwice == charges <= 1",
      "",
      "NeverDoubleBooked ==",
      '  /\\ slotOwner \\in {"none", "ada"}',
      '  /\\ ((customer \\in {"holding", "paying", "confirmed"} \\/ booking = "confirmed")',
      '       => slotOwner = "ada")',
      '  /\\ (booking \\in {"none", "cancelled"} => slotOwner = "none")',
      "",
      "NoReminderAfterCancel ==",
      '  /\\ ~(booking = "cancelled" /\\ reminder = "queued")',
      '  /\\ reminder = "queued" => booking = "confirmed"',
      '  /\\ reminder = "sent" => reminderAbout = "confirmed"',
      "",
      "\\* What the fix changes, and only that:",
      "\\*   charges' = IF charges = 0 THEN 1 ELSE charges",
      "",
      "Spec == Init /\\ [][Next]_Vars",
      "====",
    ].join("\n"),
  };

  function invoiceInitial() {
    return {
      agent: "ready",
      mailer: "idle",
      client: "owes",
      emails: 0,
      dunning: "idle",
      snapshotUnpaid: false,
      dunnedWhilePaid: false,
    };
  }

  function invoiceKey(s) {
    return [
      s.agent,
      s.mailer,
      s.client,
      s.emails,
      s.dunning,
      s.snapshotUnpaid ? 1 : 0,
      s.dunnedWhilePaid ? 1 : 0,
    ].join("|");
  }

  const invoice = {
    id: "invoice",
    title: "Invoice dunning",
    blurb:
      "The same studio's agent emails an invoice for a print order. If the invoice still looks unpaid, the agent stages a dunning note. The client can pay while that job sits staged. The mailer, the agent, and the client each move on their own.",
    fixOn: "Fix on: live payment check",
    fixOff: "Fix off",
    fixNoteOn:
      "Before sending, the agent reads whether the client has paid now. A staged job does not get to trust the snapshot it saved earlier.",
    fixNoteOff:
      "The dunning job saves unpaid-or-paid when it is staged, and it sends from that snapshot. A payment that lands in between is invisible to it.",
    opening:
      "The print-order invoice has not been sent. The client has not paid. No dunning note is staged.",
    fixKind: "guard",
    initial: invoiceInitial,
    key: invoiceKey,
    samples: [
      { id: "bug", label: "Counterexample" },
      {
        id: "safe",
        label: "Pays first",
        actions: ["send", "deliver", "record", "pay", "stage"],
      },
    ],
    actions: [
      {
        id: "send",
        actor: "agent",
        actorLabel: "Agent",
        label: "Send the invoice",
        enabled: function (s) {
          return s.agent === "ready" && s.emails === 0 && s.mailer === "idle";
        },
        apply: function (s) {
          return { ...s, agent: "waiting", mailer: "queued", emails: 1 };
        },
        say: function () {
          return "The agent hands the invoice to the mailer. That is the only send.";
        },
      },
      {
        id: "deliver",
        actor: "mailer",
        actorLabel: "Mailer",
        label: "Deliver the email",
        enabled: function (s) {
          return s.mailer === "queued";
        },
        apply: function (s) {
          return { ...s, mailer: "delivered" };
        },
        say: function () {
          return "The mailer delivers the invoice. The agent has not recorded that yet.";
        },
      },
      {
        id: "record",
        actor: "agent",
        actorLabel: "Agent",
        label: "Record delivery",
        enabled: function (s) {
          return s.agent === "waiting" && s.mailer === "delivered";
        },
        apply: function (s) {
          return { ...s, agent: "done" };
        },
        say: function () {
          return "The agent marks the invoice delivered and may now stage a follow-up.";
        },
      },
      {
        id: "pay",
        actor: "client",
        actorLabel: "Client",
        label: "Pay the invoice",
        enabled: function (s) {
          return s.client === "owes" && s.emails >= 1;
        },
        apply: function (s) {
          return { ...s, client: "paid" };
        },
        say: function () {
          return "The client pays the invoice.";
        },
      },
      {
        id: "stage",
        actor: "agent",
        actorLabel: "Agent",
        label: "Stage the dunning note",
        enabled: function (s) {
          return s.agent === "done" && s.dunning === "idle";
        },
        apply: function (s) {
          return {
            ...s,
            dunning: "staged",
            snapshotUnpaid: s.client === "owes",
          };
        },
        say: function (before) {
          if (before.client === "owes") {
            return "The agent stages a dunning note and saves a snapshot: the invoice looks unpaid.";
          }
          return "The agent stages a dunning note and saves a snapshot: the client has already paid.";
        },
      },
      {
        id: "fire",
        actor: "agent",
        actorLabel: "Agent",
        label: "Send the dunning note",
        enabled: function (s, fix) {
          if (s.dunning !== "staged") return false;
          return fix ? s.client === "owes" : s.snapshotUnpaid;
        },
        apply: function (s) {
          return {
            ...s,
            dunning: "sent",
            dunnedWhilePaid: s.client === "paid",
          };
        },
        say: function (_before, after) {
          if (after.dunnedWhilePaid) {
            return "The dunning note goes out anyway. The job trusted the unpaid snapshot and never looked at the payment again.";
          }
          return "The agent sends the dunning note. The invoice is still unpaid.";
        },
        blockedSay:
          "The fix refuses this step. The client has paid, so the dunning note is not sent.",
      },
    ],
    invariants: [
      {
        id: "no-dunning-after-pay",
        name: "A paid invoice never gets a dunning note",
        detail: "The note is not sent after the client has already paid. Paying later, after a note that went out on time, is fine.",
        holds: function (s) {
          return !s.dunnedWhilePaid;
        },
      },
      {
        id: "one-email",
        name: "The invoice is emailed at most once",
        detail: "The agent asks the mailer to deliver the invoice a single time.",
        holds: function (s) {
          return s.emails <= 1;
        },
      },
      {
        id: "dunning-after-invoice",
        name: "A dunning note never precedes the invoice",
        detail: "Nothing is staged or sent until the invoice email exists.",
        holds: function (s) {
          return s.dunning === "idle" || s.emails >= 1;
        },
      },
    ],
    groups: [
      {
        id: "agent",
        title: "Agent",
        kicker: "Parallel",
        note: "Sending the invoice and deciding to dun are two regions of the same agent.",
        regions: [
          {
            id: "agent",
            title: "Invoice",
            states: [
              { id: "ready", label: "Ready" },
              { id: "waiting", label: "Waiting" },
              { id: "done", label: "Recorded" },
            ],
            edges: [
              { from: "ready", to: "waiting", action: "send" },
              { from: "waiting", to: "done", action: "record" },
            ],
            active: function (s) {
              return s.agent;
            },
          },
          {
            id: "dunning",
            title: "Dunning",
            states: [
              { id: "idle", label: "Idle" },
              { id: "staged", label: "Staged" },
              { id: "sent", label: "Sent" },
            ],
            edges: [
              { from: "idle", to: "staged", action: "stage" },
              { from: "staged", to: "sent", action: "fire" },
            ],
            active: function (s) {
              return s.dunning;
            },
          },
        ],
      },
      {
        id: "mailer",
        title: "Mailer",
        kicker: "Actor",
        note: "Delivery is separate from the agent recording it.",
        regions: [
          {
            id: "mailer",
            title: "Email",
            states: [
              { id: "idle", label: "Idle" },
              { id: "queued", label: "Queued" },
              { id: "delivered", label: "Delivered" },
            ],
            edges: [
              { from: "idle", to: "queued", action: "send" },
              { from: "queued", to: "delivered", action: "deliver" },
            ],
            active: function (s) {
              return s.mailer;
            },
          },
        ],
      },
      {
        id: "client",
        title: "Client",
        kicker: "Actor",
        note: "The client can pay as soon as the invoice exists, including while dunning is staged.",
        regions: [
          {
            id: "client",
            title: "Payment",
            states: [
              { id: "owes", label: "Owes" },
              { id: "paid", label: "Paid" },
            ],
            edges: [{ from: "owes", to: "paid", action: "pay" }],
            active: function (s) {
              return s.client;
            },
          },
        ],
      },
    ],
    specTitle: "TLA+ for the buggy invoice model",
    spec: [
      "---- MODULE MapleInvoice ----",
      "EXTENDS Integers",
      "",
      "VARIABLES agent, mailer, client, emails, dunning, snapshotUnpaid, dunnedWhilePaid",
      "",
      "Vars == <<agent, mailer, client, emails, dunning, snapshotUnpaid, dunnedWhilePaid>>",
      "",
      "Init ==",
      '  /\\ agent = "ready" /\\ mailer = "idle" /\\ client = "owes"',
      '  /\\ emails = 0 /\\ dunning = "idle" /\\ snapshotUnpaid = FALSE',
      "  /\\ dunnedWhilePaid = FALSE",
      "",
      "Send ==",
      '  /\\ agent = "ready" /\\ emails = 0 /\\ mailer = "idle"',
      '  /\\ agent\' = "waiting" /\\ mailer\' = "queued" /\\ emails\' = 1',
      "  /\\ UNCHANGED <<client, dunning, snapshotUnpaid, dunnedWhilePaid>>",
      "",
      "Deliver ==",
      '  /\\ mailer = "queued" /\\ mailer\' = "delivered"',
      "  /\\ UNCHANGED <<agent, client, emails, dunning, snapshotUnpaid, dunnedWhilePaid>>",
      "",
      "Record ==",
      '  /\\ agent = "waiting" /\\ mailer = "delivered" /\\ agent\' = "done"',
      "  /\\ UNCHANGED <<mailer, client, emails, dunning, snapshotUnpaid, dunnedWhilePaid>>",
      "",
      "Pay ==",
      '  /\\ client = "owes" /\\ emails >= 1 /\\ client\' = "paid"',
      "  /\\ UNCHANGED <<agent, mailer, emails, dunning, snapshotUnpaid, dunnedWhilePaid>>",
      "",
      "Stage ==",
      '  /\\ agent = "done" /\\ dunning = "idle"',
      '  /\\ dunning\' = "staged"',
      '  /\\ snapshotUnpaid\' = (client = "owes")',
      "  /\\ UNCHANGED <<agent, mailer, client, emails, dunnedWhilePaid>>",
      "",
      "\\* The bug: Fire trusts the snapshot from Stage, not the live payment.",
      "Fire ==",
      '  /\\ dunning = "staged" /\\ snapshotUnpaid',
      '  /\\ dunning\' = "sent"',
      '  /\\ dunnedWhilePaid\' = (client = "paid")',
      "  /\\ UNCHANGED <<agent, mailer, client, emails, snapshotUnpaid>>",
      "",
      "Next == Send \\/ Deliver \\/ Record \\/ Pay \\/ Stage \\/ Fire",
      "",
      "NoDunningAfterPay == ~dunnedWhilePaid",
      "EmailedOnce == emails <= 1",
      "DunningAfterInvoice == dunning = \"idle\" \\/ emails >= 1",
      "",
      "\\* What the fix changes, and only that:",
      "\\*   Fire requires client = \"owes\" instead of snapshotUnpaid.",
      "",
      "Spec == Init /\\ [][Next]_Vars",
      "====",
    ].join("\n"),
  };

  const scenarios = [booking, invoice];

  function getScenario(id) {
    for (let i = 0; i < scenarios.length; i++) {
      if (scenarios[i].id === id) return scenarios[i];
    }
    throw new Error("Unknown scenario " + id);
  }

  return {
    explore: explore,
    play: play,
    getScenario: getScenario,
    scenarios: scenarios,
  };
});
