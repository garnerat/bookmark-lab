import {
  DEPT_LABEL,
  EFFORT_CUT,
  EFFORT_SHORT,
  QUADRANTS,
  SESSIONS,
  SIGNAL_LABEL,
  SIGNALS,
  VALUE_CUT,
  addTask,
  createState,
  explainMap,
  formatNum,
  proposalText,
  quotesFor,
  rankTasks,
  removeTask,
  sessionByIndex,
  sessionIndexOf,
  sessionMoves,
  setSignal,
  updateTask,
} from "./model.js";

let state = createState();
let copied = false;
let copyFallback = false;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "value") node.value = String(value);
    else if (key === "checked" || key === "open") node[key] = true;
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  for (const child of children) append(node, child);
  return node;
}

function append(node, child) {
  if (child == null || child === false) return;
  if (Array.isArray(child)) {
    for (const item of child) append(node, item);
    return;
  }
  node.append(child.nodeType ? child : document.createTextNode(String(child)));
}

function mount(id, node) {
  document.getElementById(id).replaceChildren(node);
}

function motion() {
  return reduceMotion ? "auto" : "smooth";
}

function groupLabel(row) {
  if (!row.raisers.length) return "No one named it yet";
  const totals = new Map();
  for (const raiser of row.raisers) {
    totals.set(raiser.person.dept, (totals.get(raiser.person.dept) || 0) + 1);
  }
  let best = row.raisers[0].person.dept;
  let bestCount = -1;
  for (const [dept, count] of totals) {
    if (count > bestCount) {
      best = dept;
      bestCount = count;
    }
  }
  return DEPT_LABEL[best];
}

function named(row) {
  return row.raisers
    .map((raiser) => `${raiser.person.name} (${SIGNAL_LABEL[raiser.person.signal].toLowerCase()})`)
    .join(", ");
}

function orderedPeople() {
  const session = sessionByIndex(state.sessionIndex);
  const inRoom = session.people
    .map((id) => state.people.find((person) => person.id === id))
    .filter(Boolean);
  const rest = state.people.filter((person) => !session.people.includes(person.id));
  return [...inRoom, ...rest];
}

function reset() {
  state = createState();
  copied = false;
  copyFallback = false;
  render();
  window.scrollTo({ top: 0, behavior: motion() });
}

function render(opts = {}) {
  const session = sessionByIndex(state.sessionIndex);
  const rows = rankTasks(state);
  const hidden = state.tasks.length - rows.length;
  const explanation = explainMap(rows);
  mount("session-root", renderSession(session, rows, hidden));
  mount("map-root", renderMap(session, rows, explanation));
  mount("notes-root", renderNotes(session, rows));
  document.getElementById("proposal-text").value = proposalText(state);
  document.getElementById("prev").disabled = state.sessionIndex === 0;
  document.getElementById("next").disabled = state.sessionIndex === SESSIONS.length - 1;
  document.getElementById("copy").textContent = copied ? "Copied" : "Copy proposal";
  document.getElementById("copy-note").textContent = copyFallback
    ? "The button could not copy. The proposal text is selected. Copy it from the box."
    : "";
  document.getElementById("live").textContent = `${session.title}. ${rows.length} tasks on the map. ${explanation.text}`;

  if (opts.focus) {
    const node = document.querySelector(opts.focus);
    if (node) node.focus();
  } else if (opts.focusForm) {
    const field = document.querySelector(opts.focusForm);
    if (field) field.focus();
  } else if (opts.scroll) {
    requestAnimationFrame(() => {
      const title = document.getElementById("map-title");
      if (title) title.focus({ preventScroll: true });
      document.getElementById("map").scrollIntoView({ block: "start", behavior: motion() });
    });
  }
}

function renderSession(session, rows, hidden) {
  const ahead = hidden
    ? `${hidden} still show up in later sessions.`
    : "Every captured task is on the map.";
  return el("section", { class: "panel", "aria-label": "This session" }, [
    el("p", { class: "kicker" }, [`Session ${state.sessionIndex + 1} of ${SESSIONS.length} · ${session.when}`]),
    el("h2", { id: "session-title", tabindex: "-1" }, [session.title]),
    el("p", {}, [session.summary]),
    el("p", { class: "ask" }, [`The question in the room: ${session.ask}`]),
    el("p", { class: "count" }, [`${rows.length} of ${state.tasks.length} tasks on the map. ${ahead}`]),
    el("button", { type: "button", class: "secondary", onClick: reset }, ["Reset example"]),
  ]);
}

function renderCallout(explanation) {
  const wrap = el("div", {});
  if (explanation.pair) {
    wrap.append(el("div", { class: "vs" }, [
      versusCard(explanation.pair.cold, "cold", "More stated hours"),
      versusCard(explanation.pair.warm, "warm", "Higher rank"),
    ]));
  }
  wrap.append(el("p", { class: "banner point" }, [explanation.text]));
  return wrap;
}

function versusCard(row, tone, kicker) {
  return el("article", { class: `vs-card ${tone}` }, [
    el("p", { class: "kicker" }, [kicker]),
    el("h3", {}, [row.task.name]),
    el("p", { class: "hours" }, [`${formatNum(row.task.hoursPerWeek)} stated hrs`]),
    el("p", { class: "math" }, [
      `${formatNum(row.task.hoursPerWeek)} × ${formatNum(row.adoption)} = ${formatNum(row.adopted)} adopted`,
    ]),
    el("p", {}, [`Rank ${row.rank} · score ${formatNum(row.score)}`]),
  ]);
}

function bars(row, maxHours) {
  const stated = Math.min(100, (row.task.hoursPerWeek / maxHours) * 100);
  const adopted = Math.min(100, (row.adopted / maxHours) * 100);
  return el("div", { class: "bars", "aria-hidden": "true" }, [
    bar("Stated", stated, "stated"),
    bar("Adopted", adopted, "adopted"),
  ]);
}

function bar(label, pct, kind) {
  const fill = el("span");
  fill.style.width = `${pct}%`;
  return el("div", { class: "bar" }, [
    el("span", {}, [label]),
    el("div", { class: `track ${kind}` }, [fill]),
  ]);
}

function renderCard(row, session, maxHours) {
  const fresh = row.task.appears === session.id || row.raisers.some((raiser) => raiser.from === session.id);
  const editing = state.ui.editId === row.task.id;
  const card = el("article", { class: fresh ? "card fresh" : "card", id: `task-${row.task.id}` }, [
    el("h3", {}, [el("span", { class: "rank" }, [`${row.rank}. `]), row.task.name]),
    fresh
      ? el("p", {}, [
        el("span", { class: "pill new" }, [row.task.appears === session.id ? "Added this session" : "Grew this session"]),
      ])
      : null,
    el("p", { class: "math" }, [
      `${formatNum(row.task.hoursPerWeek)} hrs × ${formatNum(row.adoption)} ÷ ${row.task.effort} = ${formatNum(row.score)}`,
    ]),
    el("p", { class: "hint" }, [
      `${row.task.frequency} · effort ${row.task.effort}, ${EFFORT_SHORT[row.task.effort] || "custom"} · ${groupLabel(row)}`,
    ]),
    bars(row, maxHours),
    el("p", {}, [row.raisers.length ? `Named by ${named(row)}.` : "Nobody has named this, so adoption is 0."]),
    row.task.detail ? el("p", {}, [row.task.detail]) : null,
  ]);

  if (editing) {
    const draft = state.ui.editDraft?.id === row.task.id ? state.ui.editDraft : null;
    card.append(taskForm({
      idPrefix: `edit-${row.task.id}`,
      values: draft || {
        name: row.task.name,
        detail: row.task.detail,
        hours: String(row.task.hoursPerWeek),
        frequency: row.task.frequency,
        effort: String(row.task.effort),
        raiserIds: row.task.raisers.map((raiser) => raiser.personId),
      },
      raiserMeta: new Map(row.task.raisers.map((raiser) => [raiser.personId, raiser.from])),
      error: state.ui.errorWhere === "edit" ? state.ui.error : "",
      onSubmit: (input) => {
        const result = updateTask(state, row.task.id, input);
        if (!result.ok) {
          state.ui.editDraft = { id: row.task.id, ...input };
          state.ui.error = result.error;
          state.ui.errorWhere = "edit";
          render({ focusForm: `#edit-${CSS.escape(row.task.id)}-name` });
          return;
        }
        state.ui.editId = null;
        state.ui.editDraft = null;
        state.ui.error = "";
        render({ focus: `#task-${CSS.escape(row.task.id)} button` });
      },
      onCancel: () => {
        state.ui.editId = null;
        state.ui.editDraft = null;
        state.ui.error = "";
        render({ focus: `#task-${CSS.escape(row.task.id)} button` });
      },
    }));
  } else {
    const actions = el("div", { class: "card-actions" }, [
      el("button", {
        type: "button",
        class: "secondary",
        onClick: () => {
          state.ui.editId = row.task.id;
          state.ui.editDraft = null;
          state.ui.error = "";
          render({ focusForm: `#edit-${CSS.escape(row.task.id)}-name` });
        },
      }, ["Edit task"]),
    ]);
    if (row.task.custom) {
      actions.append(el("button", {
        type: "button",
        class: "secondary",
        onClick: () => {
          removeTask(state, row.task.id);
          if (state.ui.editId === row.task.id) state.ui.editId = null;
          render();
        },
      }, ["Remove"]));
    }
    card.append(actions);
  }
  return card;
}

function renderMap(session, rows, explanation) {
  const maxHours = Math.max(1, ...rows.map((row) => row.task.hoursPerWeek));
  const section = el("section", { class: "panel", id: "map", "aria-label": "Opportunity map" }, [
    el("h2", { id: "map-title", tabindex: "-1" }, ["Opportunity map"]),
    el("p", {}, [
      `Rank = stated hours × adoption ÷ build effort. Curious counts as 1, mixed as 0.5, resistant as 0.15. More adopted hours means ${VALUE_CUT} or more. A heavier build is effort ${EFFORT_CUT} or higher. Gray is stated hours. Green is what adoption leaves. Every bar uses the same scale.`,
    ]),
    renderCallout(explanation),
  ]);
  if (!rows.length) {
    section.append(el("p", { class: "empty" }, ["No tasks yet. Add one from the room, or open the next session."]));
    return section;
  }
  section.append(el("h3", {}, ["Ranked"]));
  for (const row of rows) section.append(renderCard(row, session, maxHours));
  section.append(el("h3", {}, ["Two by two"]));
  section.append(el("div", { class: "axis-x", "aria-hidden": "true" }, [
    el("span", {}, ["Lighter build"]),
    el("span", {}, ["Heavier build"]),
  ]));
  const grid = el("div", { class: "map-grid" });
  for (const quadrant of QUADRANTS) {
    const items = rows.filter((row) => row.quadrant === quadrant.id);
    const block = el("section", { class: `quad quad-${quadrant.id}`, "aria-label": quadrant.title }, [
      el("h3", {}, [quadrant.title]),
      el("p", { class: "hint" }, [quadrant.hint]),
    ]);
    if (!items.length) {
      block.append(el("p", { class: "empty" }, ["None"]));
    } else {
      const list = el("ul", {});
      for (const row of items) list.append(el("li", {}, [`${row.rank}. ${row.task.name}`]));
      block.append(list);
    }
    grid.append(block);
  }
  section.append(grid);
  const formula = el("details", { class: "box" }, [
    el("summary", {}, ["How a score is built"]),
    el("p", { class: "formula" }, [
      "Adoption is the average signal of the people who have named the task so far. A person from a later session does not count until you open that session. Effort runs from 1, a prompt beside work they already do, to 5, a new place the numbers live. Dividing by effort is what keeps a heavy integration from outranking a lighter workflow the curious people asked for.",
    ]),
  ]);
  section.append(formula);
  return section;
}

function personRow(person, sessionId, inRoom) {
  const row = el("div", { class: "person" }, [
    el("div", { class: "person-top" }, [
      el("strong", {}, [person.name]),
      inRoom ? el("span", { class: "pill room" }, ["In the room"]) : null,
    ]),
    el("p", { class: "role" }, [person.role === DEPT_LABEL[person.dept] ? person.role : `${person.role} · ${DEPT_LABEL[person.dept]}`]),
    el("p", { class: "stance" }, [person.stance]),
  ]);
  const signals = el("div", {
    class: "segment signals",
    role: "group",
    "aria-label": `${person.name} adoption signal`,
  });
  for (const signal of SIGNALS) {
    signals.append(el("button", {
      type: "button",
      id: `signal-${person.id}-${signal.id}`,
      "data-signal": signal.id,
      "aria-pressed": person.signal === signal.id ? "true" : "false",
      onClick: () => {
        setSignal(state, person.id, signal.id);
        render({ focus: `#signal-${person.id}-${signal.id}` });
      },
    }, [signal.label]));
  }
  row.append(signals);
  for (const line of quotesFor(state, person.id, sessionId)) {
    row.append(el("blockquote", { class: "quote" }, [
      el("span", {}, [line.taskName]),
      line.quote,
    ]));
  }
  return row;
}

function renderNotes(session, rows) {
  const moves = sessionMoves(rows, session.id);
  const section = el("section", { class: "panel", "aria-label": "Notes from the room" }, [
    el("h2", {}, ["In the room"]),
    el("p", { class: "hint" }, ["Toggle a signal and the ranks move. The same signal follows that person into later sessions."]),
    el("h3", {}, ["Named this session"]),
  ]);
  if (!moves.length) {
    section.append(el("p", { class: "empty" }, ["No new tasks. Use the hour to walk the rank."]));
  } else {
    const list = el("ul", { class: "move-list" });
    for (const row of moves) {
      const grew = row.task.appears !== session.id;
      list.append(el("li", {}, [
        el("span", { class: "pill new" }, [grew ? "Grew" : "New"]),
        row.task.name,
      ]));
    }
    section.append(list);
  }
  for (const personId of session.people) {
    const person = state.people.find((item) => item.id === personId);
    if (person) section.append(personRow(person, session.id, true));
  }
  const others = state.people.filter((person) => !session.people.includes(person.id));
  if (others.length) {
    const details = el("details", {
      class: "box",
      open: state.ui.staffOpen,
      onToggle: (event) => {
        state.ui.staffOpen = event.currentTarget.open;
      },
    }, [
      el("summary", {}, [`All ${state.people.length} signals`]),
    ]);
    const body = el("div", {});
    for (const person of others) body.append(personRow(person, session.id, false));
    details.append(body);
    section.append(details);
  }
  section.append(el("h3", {}, ["Add a task"]));
  section.append(el("p", { class: "hint" }, ["It joins this session. Check the people who named it. Their signals set adoption."]));
  if (!state.ui.addOpen) {
    section.append(el("button", {
      type: "button",
      onClick: () => {
        state.ui.addOpen = true;
        state.ui.addDraft = null;
        state.ui.error = "";
        render({ focusForm: "#add-name" });
      },
    }, ["Add a task"]));
  } else {
    const draft = state.ui.addDraft;
    section.append(taskForm({
      idPrefix: "add",
      submitLabel: "Add to the map",
      values: draft || {
        name: "",
        detail: "",
        hours: "2",
        frequency: "Every weekday",
        effort: "2",
        raiserIds: [],
      },
      raiserMeta: new Map(),
      error: state.ui.errorWhere === "add" ? state.ui.error : "",
      onSubmit: (input) => {
        const result = addTask(state, input);
        if (!result.ok) {
          state.ui.addDraft = input;
          state.ui.error = result.error;
          state.ui.errorWhere = "add";
          render({ focusForm: "#add-name" });
          return;
        }
        state.ui.addOpen = false;
        state.ui.addDraft = null;
        state.ui.error = "";
        render({ scroll: true });
      },
      onCancel: () => {
        state.ui.addOpen = false;
        state.ui.addDraft = null;
        state.ui.error = "";
        render();
      },
    }));
  }
  return section;
}

function effortSelect(id, selected) {
  const select = el("select", { id, name: "effort" });
  for (let effort = 1; effort <= 5; effort += 1) {
    const option = el("option", { value: String(effort) }, [`${effort} · ${EFFORT_SHORT[effort]}`]);
    if (String(effort) === String(selected)) option.selected = true;
    select.append(option);
  }
  return select;
}

function field(id, label, control) {
  return el("label", { class: "field", for: id }, [el("span", {}, [label]), control]);
}

function taskForm({ idPrefix, values, raiserMeta, error, onSubmit, onCancel, submitLabel }) {
  const form = el("form", {
    class: "task-form",
    onSubmit: (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSubmit({
        name: data.get("name"),
        detail: data.get("detail"),
        hours: data.get("hours"),
        frequency: data.get("frequency"),
        effort: data.get("effort"),
        raiserIds: data.getAll("raiser"),
      });
    },
  });
  form.append(
    field(`${idPrefix}-name`, "Task", el("input", {
      id: `${idPrefix}-name`,
      name: "name",
      required: true,
      maxlength: "80",
      value: values.name,
    })),
    field(`${idPrefix}-hours`, "Hours per week", el("input", {
      id: `${idPrefix}-hours`,
      name: "hours",
      type: "number",
      inputmode: "decimal",
      min: "0",
      max: "80",
      step: "0.5",
      required: true,
      value: values.hours,
    })),
    field(`${idPrefix}-frequency`, "How often", el("input", {
      id: `${idPrefix}-frequency`,
      name: "frequency",
      list: "freqs",
      maxlength: "48",
      value: values.frequency,
    })),
    field(`${idPrefix}-effort`, "Build effort", effortSelect(`${idPrefix}-effort`, values.effort)),
    field(`${idPrefix}-detail`, "What the work is", el("textarea", {
      id: `${idPrefix}-detail`,
      name: "detail",
      maxlength: "280",
      rows: "3",
    })),
  );
  form.querySelector("textarea").value = values.detail || "";
  const checks = el("div", { class: "checks" });
  for (const person of orderedPeople()) {
    const from = raiserMeta.get(person.id);
    const when = from ? ` · named in ${sessionByIndex(sessionIndexOf(from)).title}` : "";
    checks.append(el("label", { class: "checkline" }, [
      el("input", {
        type: "checkbox",
        name: "raiser",
        value: person.id,
        checked: values.raiserIds.includes(person.id),
      }),
      `${person.name}, ${SIGNAL_LABEL[person.signal].toLowerCase()}${when}`,
    ]));
  }
  form.append(el("span", { class: "hint" }, ["Check everyone who named it. Someone from a later session stays off the map until you get there."]));
  form.append(checks);
  if (error) form.append(el("p", { class: "error", role: "alert" }, [error]));
  form.append(el("div", { class: "form-actions" }, [
    el("button", { type: "submit" }, [submitLabel]),
    el("button", { type: "button", class: "secondary", onClick: onCancel }, ["Cancel"]),
  ]));
  return form;
}

document.getElementById("prev").addEventListener("click", () => {
  if (state.sessionIndex === 0) return;
  state.sessionIndex -= 1;
  state.ui.editId = null;
  state.ui.addOpen = false;
  state.ui.error = "";
  render({ scroll: true });
});

document.getElementById("next").addEventListener("click", () => {
  if (state.sessionIndex >= SESSIONS.length - 1) return;
  state.sessionIndex += 1;
  state.ui.editId = null;
  state.ui.addOpen = false;
  state.ui.error = "";
  render({ scroll: true });
});

document.getElementById("copy").addEventListener("click", async () => {
  const text = document.getElementById("proposal-text").value;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
    copyFallback = false;
    render();
    window.setTimeout(() => {
      copied = false;
      const button = document.getElementById("copy");
      if (button) button.textContent = "Copy proposal";
    }, 1600);
  } catch {
    copied = false;
    copyFallback = true;
    render();
    const area = document.getElementById("proposal-text");
    area.focus();
    area.select();
  }
});

render();
