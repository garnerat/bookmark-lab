// Fictional enablement week for Mill Creek Mechanical.
// Rank = stated hours/week × adoption ÷ build effort.
// Adoption is the average signal of the people who named the task.
// Curious is 1, mixed is 0.5, resistant is 0.15, so a long task
// named only by resistant people loses to a shorter task curious people want.

export const COMPANY = "Mill Creek Mechanical";

export const SIGNALS = [
  { id: "curious", label: "Curious", weight: 1 },
  { id: "mixed", label: "Mixed", weight: 0.5 },
  { id: "resistant", label: "Resistant", weight: 0.15 },
];

export const SIGNAL_WEIGHT = Object.fromEntries(SIGNALS.map((signal) => [signal.id, signal.weight]));
export const SIGNAL_LABEL = Object.fromEntries(SIGNALS.map((signal) => [signal.id, signal.label]));

export const DEPT_LABEL = {
  owner: "Owner",
  office: "Office / Dispatch",
  field: "Field techs",
  sales: "Sales",
};

export const EFFORT_SHORT = {
  1: "starter",
  2: "light",
  3: "medium",
  4: "heavy",
  5: "major",
};

export const VALUE_CUT = 2;
export const EFFORT_CUT = 3;
export const WEAK_ADOPTION = 0.35;
export const STRONG_ADOPTION = 0.8;

export const QUADRANTS = [
  { id: "quick", title: "Do this first", hint: "More adopted hours, lighter build" },
  { id: "build", title: "Worth a real build", hint: "More adopted hours, heavier build" },
  { id: "later", title: "Easy, and still a no", hint: "Fewer adopted hours, lighter build" },
  { id: "trap", title: "Do not start here", hint: "Fewer adopted hours, heavier build" },
];

export const SESSIONS = [
  {
    id: "kickoff",
    title: "Leadership kickoff",
    when: "Tuesday 8:00 a.m.",
    summary:
      "Ninety minutes with Dana and the leads. You draft one after-hours text together, then ask what they would hand off tomorrow. A signal you mark now follows that person into later sessions. The office session is where an 8-hour task loses to a shorter one.",
    ask: "What would you hand to AI tomorrow?",
    people: ["dana", "marcus", "priya", "andre", "camille"],
  },
  {
    id: "office",
    title: "Office and dispatch",
    when: "Tuesday 10:00 a.m.",
    summary:
      "At the desk. Jordan runs one real vendor email through a draft and deletes the draft. Then each person names hours and whether they would use a tool. Luis picks up the customer texts Marcus only half wanted.",
    ask: "What would you hand to AI tomorrow, and about how many hours a week is it?",
    people: ["priya", "luis", "helen", "jordan"],
  },
  {
    id: "field",
    title: "Field techs",
    when: "Wednesday 3:30 p.m.",
    summary:
      "The first trucks are back. Keisha tries one photo note. Sam does not open the laptop. The largest hour count in the week shows up from someone who will not adopt a tool.",
    ask: "Which of today's jobs would you hand to AI tomorrow?",
    people: ["andre", "sam", "keisha", "tyrell", "noah"],
  },
  {
    id: "sales",
    title: "Sales",
    when: "Thursday 9:00 a.m.",
    summary:
      "Camille pastes a real walkthrough note and reads a draft estimate. Ben keeps his paper form and adds his name to the price book, still unwilling to use a tool.",
    ask: "Which part of the estimate would you hand off, and would you actually use it?",
    people: ["camille", "ben", "riley"],
  },
  {
    id: "walkthrough",
    title: "Walk the map",
    when: "Thursday 11:00 a.m.",
    summary:
      "Dana and Marcus stay. Walk the rank before you name a build. A long gray bar with a short green bar is the hour count a standalone audit would have sold. The proposal is three builds, each with a monthly session still in it.",
    ask: "Start with rank 1, not with the longest bar.",
    people: ["dana", "marcus"],
  },
];

const PEOPLE = [
  { id: "dana", name: "Dana Ruiz", role: "Owner", dept: "owner", signal: "curious", stance: "Will try the after-hours text herself, and still wants to hit send." },
  { id: "marcus", name: "Marcus Hale", role: "General manager", dept: "owner", signal: "mixed", stance: "Named the customer texts. Does not want a tool sending them yet." },
  { id: "priya", name: "Priya Shah", role: "Office manager", dept: "office", signal: "curious", stance: "Already keeps a list of notes the desk types more than once." },
  { id: "luis", name: "Luis Ortega", role: "Dispatcher", dept: "office", signal: "curious", stance: "Routes the trucks and answers the morning texts." },
  { id: "helen", name: "Helen Cho", role: "Bookkeeper", dept: "office", signal: "resistant", stance: "Owns the Monday report. Asked, then warned you off the books." },
  { id: "jordan", name: "Jordan Peck", role: "Phones and inbox", dept: "office", signal: "curious", stance: "Sorts the shared inbox before the phones stack up." },
  { id: "andre", name: "Andre Brooks", role: "Lead technician", dept: "field", signal: "curious", stance: "Asked if truck photos could land on the job as a note." },
  { id: "sam", name: "Sam Whitaker", role: "Senior technician", dept: "field", signal: "resistant", stance: "Twenty years on the tools. Will not learn an app for pricing." },
  { id: "keisha", name: "Keisha Nolan", role: "Technician", dept: "field", signal: "curious", stance: "Retypes photo notes in the driveway and is tired of it." },
  { id: "tyrell", name: "Tyrell Adams", role: "Technician", dept: "field", signal: "mixed", stance: "Might use a stock list. Might ignore it after a week." },
  { id: "noah", name: "Noah Berg", role: "Apprentice", dept: "field", signal: "curious", stance: "Already counts truck stock on his phone." },
  { id: "camille", name: "Camille Ortiz", role: "Sales lead", dept: "sales", signal: "curious", stance: "Wants walkthrough notes to become an estimate she can edit." },
  { id: "ben", name: "Ben Iverson", role: "Comfort advisor", dept: "sales", signal: "resistant", stance: "Writes estimates on paper. Does not want a tool on pricing." },
  { id: "riley", name: "Riley Quinn", role: "Sales coordinator", dept: "sales", signal: "curious", stance: "Retypes Camille's walkthrough notes into the job system." },
];

const TASKS = [
  {
    id: "after-hours",
    name: "Draft the after-hours on-call text",
    detail: "Dana sends the same five sentences when a no-heat call or a leak comes in after 6 p.m.",
    firstStep: "On the next on-call night, Dana reviews a draft before it is sent. The tool does not text the customer.",
    hoursPerWeek: 2,
    frequency: "A few nights a week",
    effort: 2,
    appears: "kickoff",
    raisers: [
      { personId: "dana", from: "kickoff", quote: "The after-hours texts. I would hand those off tomorrow, if I still get to hit send." },
    ],
  },
  {
    id: "wheres-my-tech",
    name: "Answer the where's-my-tech texts",
    detail: "Customers text the shared inbox asking when the truck will arrive. Someone retypes the schedule in the reply.",
    firstStep: "Luis tries drafts on tomorrow morning's texts and sends them himself.",
    hoursPerWeek: 3.5,
    frequency: "Every weekday",
    effort: 2,
    appears: "kickoff",
    raisers: [
      { personId: "marcus", from: "kickoff", quote: "Those texts eat the morning. I do not want a tool sending them yet." },
      { personId: "luis", from: "office", quote: "I send those. I would use a draft tomorrow if it reads the schedule right." },
    ],
  },
  {
    id: "monday-report",
    name: "Rebuild the Monday job report",
    detail: "Helen rebuilds one report every Monday from Jobline, the parts sheet, and last week's email. She is the only person who does it.",
    firstStep: "Do not build this until the person who owns the report asks to try a draft on a copy of the sheet.",
    hoursPerWeek: 8,
    frequency: "Every Monday",
    effort: 2,
    appears: "office",
    raisers: [
      { personId: "helen", from: "office", quote: "The Monday report, if you are writing it down. It does not get to touch the books." },
    ],
  },
  {
    id: "inbox-triage",
    name: "Triage the office inbox",
    detail: "Vendor mail, parts delays, and scheduling notes land in one inbox. Jordan and Luis sort it before the phones stack up.",
    firstStep: "Jordan runs the real inbox for one morning with drafts she can throw away. Nothing sends on its own.",
    hoursPerWeek: 4.5,
    frequency: "Every weekday",
    effort: 2,
    appears: "office",
    raisers: [
      { personId: "jordan", from: "office", quote: "The inbox. I would hand it over tomorrow morning." },
      { personId: "luis", from: "office", quote: "Same inbox. I want the parts delays pulled out before I route the trucks." },
    ],
  },
  {
    id: "copy-tools",
    name: "Copy job notes across three tools",
    detail: "The closed-job note is typed into Jobline, the parts sheet, and the customer email.",
    firstStep: "Priya picks one closed job and stops at a draft she pastes herself.",
    hoursPerWeek: 5,
    frequency: "Many times a day",
    effort: 4,
    appears: "office",
    raisers: [
      { personId: "priya", from: "office", quote: "I type the same note three times. About five hours if you count the techs at night." },
      { personId: "andre", from: "field", quote: "That triple copy is real. I would take a draft that lands on the job." },
      { personId: "keisha", from: "field", quote: "I retype it in the driveway. I would use that." },
    ],
  },
  {
    id: "photo-notes",
    name: "Turn truck photos into job notes",
    detail: "Techs take photos at the unit, then retype what they saw into Jobline at the end of the day.",
    firstStep: "Keisha tries one real photo after the route, edits the note, and saves it herself.",
    hoursPerWeek: 3.5,
    frequency: "Every job",
    effort: 2,
    appears: "field",
    raisers: [
      { personId: "keisha", from: "field", quote: "The photos. I already take them. I do not want to retype them tonight." },
      { personId: "andre", from: "field", quote: "If the note is wrong I will fix it. I would still try it tomorrow." },
    ],
  },
  {
    id: "truck-stock",
    name: "Count truck stock before Monday",
    detail: "Each tech walks the truck on Monday morning so the parts sheet matches the shelves.",
    firstStep: "Noah tries a photo of one shelf. Tyrell can skip it until he asks to join.",
    hoursPerWeek: 5,
    frequency: "Monday mornings",
    effort: 3,
    appears: "field",
    raisers: [
      { personId: "tyrell", from: "field", quote: "Stock count is tedious. I might use a list. I might ignore it." },
      { personId: "noah", from: "field", quote: "I will try it. I already do the count on my phone." },
    ],
  },
  {
    id: "price-book",
    name: "Refresh the truck price book",
    detail: "Prices in the truck book do not match what sales quotes. Sam puts the chasing and the rework at about 11 hours a week across techs and sales. He does not want a tool for it.",
    firstStep: "Leave it. Revisit only if a curious person who quotes or invoices asks for it.",
    hoursPerWeek: 11,
    frequency: "On quotes and price changes",
    effort: 4,
    appears: "field",
    raisers: [
      { personId: "sam", from: "field", quote: "The price book is fiction. Write down 11 hours. I am not learning an app for it." },
      { personId: "ben", from: "sales", quote: "Sam is right about the hours. I still write prices my way." },
    ],
  },
  {
    id: "estimates",
    name: "Write the estimate from the walkthrough",
    detail: "Camille and Riley turn walkthrough notes into a customer estimate in the job system.",
    firstStep: "Camille pastes one real walkthrough and edits the draft before a customer sees it.",
    hoursPerWeek: 4,
    frequency: "Several a day",
    effort: 2,
    appears: "sales",
    raisers: [
      { personId: "camille", from: "sales", quote: "The estimate after a walkthrough. I would use that this week." },
      { personId: "riley", from: "sales", quote: "I retype Camille's notes. I want that gone." },
    ],
  },
];

export function createState() {
  return {
    people: structuredClone(PEOPLE),
    tasks: structuredClone(TASKS),
    sessionIndex: 0,
    nextId: 1,
    ui: emptyUi(),
  };
}

export function emptyUi() {
  return { editId: null, addOpen: false, staffOpen: false, error: "", errorWhere: "" };
}

export function sessionByIndex(index) {
  return SESSIONS[index] ?? SESSIONS[0];
}

export function sessionIndexOf(id) {
  return SESSIONS.findIndex((session) => session.id === id);
}

export function formatNum(n) {
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return String(rounded);
}

export function joinNames(parts) {
  if (parts.length === 0) return "Nobody";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function isVisible(task, sessionIndex) {
  const appear = sessionIndexOf(task.appears);
  return appear !== -1 && appear <= sessionIndex;
}

export function activeRaisers(task, people, sessionIndex) {
  return task.raisers
    .filter((raiser) => sessionIndexOf(raiser.from) !== -1 && sessionIndexOf(raiser.from) <= sessionIndex)
    .map((raiser) => ({ ...raiser, person: people.find((person) => person.id === raiser.personId) }))
    .filter((raiser) => raiser.person);
}

export function quadrantOf(adopted, effort) {
  const highValue = adopted >= VALUE_CUT;
  const heavy = effort >= EFFORT_CUT;
  if (highValue && !heavy) return "quick";
  if (highValue && heavy) return "build";
  if (!highValue && !heavy) return "later";
  return "trap";
}

export function rankTasks(state) {
  const sessionIndex = state.sessionIndex;
  const rows = state.tasks
    .filter((task) => isVisible(task, sessionIndex))
    .map((task) => {
      const raisers = activeRaisers(task, state.people, sessionIndex);
      const adoption = raisers.length
        ? raisers.reduce((sum, raiser) => sum + SIGNAL_WEIGHT[raiser.person.signal], 0) / raisers.length
        : 0;
      const adopted = task.hoursPerWeek * adoption;
      const score = task.effort > 0 ? adopted / task.effort : 0;
      return {
        task,
        raisers,
        adoption,
        adopted,
        score,
        quadrant: quadrantOf(adopted, task.effort),
      };
    });
  rows.sort((a, b) =>
    b.score - a.score ||
    b.adopted - a.adopted ||
    a.task.effort - b.task.effort ||
    a.task.name.localeCompare(b.task.name)
  );
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return rows;
}

function whoAre(raisers) {
  const signals = raisers.map((raiser) => raiser.person.signal);
  if (signals.every((signal) => signal === signals[0])) {
    const names = joinNames(raisers.map((raiser) => raiser.person.name));
    const verb = raisers.length === 1 ? "is" : "are";
    return `${names} ${verb} ${signals[0]}.`;
  }
  return `${joinNames(raisers.map((raiser) => `${raiser.person.name} is ${raiser.person.signal}`))}.`;
}

export function explainMap(rows) {
  const coldPool = rows.filter((row) => row.adoption < WEAK_ADOPTION && row.task.hoursPerWeek > 0);
  if (!coldPool.length) {
    return {
      pair: null,
      text: rows.length
        ? "No task on the map is carried by a resistant signal. Rank is adopted hours divided by build effort."
        : "Nothing is on the map yet.",
    };
  }
  const cold = coldPool.slice().sort((a, b) => b.task.hoursPerWeek - a.task.hoursPerWeek || a.rank - b.rank)[0];
  const warmPool = rows.filter((row) =>
    row.adoption >= STRONG_ADOPTION &&
    row.task.hoursPerWeek < cold.task.hoursPerWeek &&
    row.score > cold.score
  );
  if (!warmPool.length) {
    return {
      pair: null,
      text: `${cold.task.name} is ${formatNum(cold.task.hoursPerWeek)} stated hours with weak adoption, at rank ${cold.rank}. No shorter curious task is ahead of it right now.`,
    };
  }
  warmPool.sort((a, b) => b.score - a.score || a.task.hoursPerWeek - b.task.hoursPerWeek);
  const warm = warmPool[0];
  const text = `${cold.task.name} is ${formatNum(cold.task.hoursPerWeek)} hours a week and ranks ${cold.rank}. ${whoAre(cold.raisers)} Adopted hours are ${formatNum(cold.adopted)}. ${warm.task.name} is ${formatNum(warm.task.hoursPerWeek)} hours a week and ranks ${warm.rank}. ${whoAre(warm.raisers)} The shorter task wins.`;
  return { pair: { cold, warm }, text };
}

export function sessionMoves(rows, sessionId) {
  return rows.filter((row) => row.task.appears === sessionId || row.raisers.some((raiser) => raiser.from === sessionId));
}

function leadDept(raisers) {
  if (!raisers.length) return "the department that owns the work";
  const totals = new Map();
  for (const raiser of raisers) {
    const weight = SIGNAL_WEIGHT[raiser.person.signal];
    totals.set(raiser.person.dept, (totals.get(raiser.person.dept) || 0) + weight);
  }
  let best = raisers[0].person.dept;
  let bestWeight = -1;
  for (const [dept, weight] of totals) {
    if (weight > bestWeight) {
      best = dept;
      bestWeight = weight;
    }
  }
  return DEPT_LABEL[best];
}

function whyLine(row) {
  if (row.adoption >= STRONG_ADOPTION) {
    return "Curious people named this, and the adopted hours hold up against the build effort.";
  }
  if (row.adoption >= 0.5) {
    return "Adoption is mixed. Build the small version with the curious people leading.";
  }
  return "This ranks on the formula, and adoption is still weak. Confirm a curious user before building it.";
}

function namedSignals(raisers) {
  return joinNames(raisers.map((raiser) => `${raiser.person.name} (${raiser.person.signal})`));
}

export function proposalText(state) {
  const rows = rankTasks(state);
  const session = sessionByIndex(state.sessionIndex);
  const included = SESSIONS.slice(0, state.sessionIndex + 1);
  const ahead = SESSIONS.slice(state.sessionIndex + 1);
  const top = rows.slice(0, 3);
  const weak = rows
    .filter((row) => row.adoption < WEAK_ADOPTION)
    .sort((a, b) => b.task.hoursPerWeek - a.task.hoursPerWeek);
  const lines = [
    `${COMPANY.toUpperCase()} — opportunity map and build proposal`,
    "Fictional example. Not a real company, staff, or engagement.",
    "",
    "Gathered in enablement sessions, not a standalone audit. Each session ends with tasks people would hand to AI tomorrow. The facilitator notes who is curious, mixed, or resistant.",
    "Sessions in this draft:",
    ...included.map((item) => `- ${item.title} (${item.when})`),
  ];
  const aheadWork = ahead.filter((item) => item.id !== "walkthrough");
  if (aheadWork.length) {
    lines.push(`Still ahead: ${joinNames(ahead.map((item) => item.title))}. Tasks from ${joinNames(aheadWork.map((item) => item.title))} are not in the numbers yet.`);
  } else if (ahead.length) {
    lines.push("Still ahead: the walkthrough with the owner. Every task is already on the map.");
  } else {
    lines.push("The kickoff and the three department sessions are in this map. This hour is the walkthrough with the owner.");
  }
  lines.push(
    "",
    "Score = stated hours/week × adoption ÷ build effort.",
    "Adoption averages the people who named the task: curious 1, mixed 0.5, resistant 0.15.",
    "A long task named only by resistant people ranks below a shorter task the curious people want.",
    "",
    "Ranked map",
  );
  if (!rows.length) {
    lines.push("No tasks captured yet.");
  }
  for (const row of rows) {
    lines.push(
      `${row.rank}. ${row.task.name} — ${formatNum(row.task.hoursPerWeek)} hrs × ${formatNum(row.adoption)} ÷ ${row.task.effort} = ${formatNum(row.score)}. ${namedSignals(row.raisers)}. ${row.task.frequency}.`,
    );
  }
  lines.push("", top.length < 3 ? `Top builds so far (${top.length} on the map)` : "Top 3 builds");
  if (!top.length) lines.push("None yet. Run the department sessions before naming builds.");
  top.forEach((row, index) => {
    const allies = row.raisers.filter((raiser) => raiser.person.signal !== "resistant");
    const who = allies.length ? joinNames(allies.map((raiser) => raiser.person.name)) : "whoever asks to try it";
    const first = row.task.firstStep || "Start with one real example in the next session. A person checks the draft before it is saved or sent.";
    lines.push(
      `${index + 1}. ${row.task.name}`,
      `   Why: ${whyLine(row)}`,
      `   First step: ${first}`,
      `   Monthly enablement: one session a month with ${leadDept(row.raisers)}, on this workflow, with ${who}. Count who is still using it before you add scope.`,
    );
  });
  lines.push("", "Not first");
  if (!weak.length) {
    lines.push("No resistant-only task is on the map yet.");
  } else {
    for (const row of weak) {
      lines.push(`- ${row.task.name} — ${formatNum(row.task.hoursPerWeek)} stated hrs, adoption ${formatNum(row.adoption)}, rank ${row.rank}. ${namedSignals(row.raisers)}.`);
    }
  }
  lines.push(
    "",
    "What the owner is buying",
    "A kickoff, hands-on sessions by department, this map, the builds above, and monthly enablement for each build. The map is a side effect of the sessions. Adoption is the predictor of whether a build gets used.",
    "",
    `Draft status: ${session.title}. Figures follow the notes on this page, including edits.`,
    "Source idea: https://x.com/lukepierceops/status/2115245000351154480",
    "Bookmark Lab example. Not a client engagement.",
  );
  return lines.join("\n");
}

function parseTaskInput(input, people) {
  const name = String(input.name ?? "").trim();
  if (!name) return { error: "Name the task." };
  if (name.length > 80) return { error: "Keep the task name under 80 characters." };
  const hours = Math.round(Number(input.hours) * 100) / 100;
  if (!Number.isFinite(hours) || hours < 0 || hours > 80) return { error: "Hours per week should be between 0 and 80." };
  const effort = Number(input.effort);
  if (!Number.isInteger(effort) || effort < 1 || effort > 5) return { error: "Build effort is a whole number from 1 to 5." };
  const frequency = String(input.frequency ?? "").trim().slice(0, 48) || "Weekly";
  const detail = String(input.detail ?? "").trim().slice(0, 280);
  const raiserIds = [...new Set(input.raiserIds ?? [])].filter((id) => people.some((person) => person.id === id));
  return { name, hours, effort, frequency, detail, raiserIds };
}

export function addTask(state, input) {
  const parsed = parseTaskInput(input, state.people);
  if (parsed.error) return { ok: false, error: parsed.error };
  const session = sessionByIndex(state.sessionIndex);
  state.tasks.push({
    id: `custom-${state.nextId++}`,
    name: parsed.name,
    detail: parsed.detail,
    firstStep: "",
    hoursPerWeek: parsed.hours,
    frequency: parsed.frequency,
    effort: parsed.effort,
    appears: session.id,
    custom: true,
    raisers: parsed.raiserIds.map((personId) => ({ personId, from: session.id, quote: "" })),
  });
  return { ok: true };
}

export function updateTask(state, id, input) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return { ok: false, error: "That task is not on the map." };
  const parsed = parseTaskInput(input, state.people);
  if (parsed.error) return { ok: false, error: parsed.error };
  const sessionId = sessionByIndex(state.sessionIndex).id;
  const previous = new Map(task.raisers.map((raiser) => [raiser.personId, raiser]));
  task.name = parsed.name;
  task.detail = parsed.detail;
  task.hoursPerWeek = parsed.hours;
  task.frequency = parsed.frequency;
  task.effort = parsed.effort;
  task.raisers = parsed.raiserIds.map((personId) => {
    const prior = previous.get(personId);
    if (prior) return { ...prior };
    return { personId, from: sessionId, quote: "" };
  });
  return { ok: true };
}

export function removeTask(state, id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task?.custom) return { ok: false, error: "The sample tasks stay. Reset the example to restore edits." };
  state.tasks = state.tasks.filter((item) => item.id !== id);
  return { ok: true };
}

export function setSignal(state, personId, signal) {
  if (!SIGNAL_WEIGHT[signal]) return { ok: false, error: "Unknown signal." };
  const person = state.people.find((item) => item.id === personId);
  if (!person) return { ok: false, error: "Unknown person." };
  person.signal = signal;
  return { ok: true };
}

export function quotesFor(state, personId, sessionId) {
  const lines = [];
  for (const task of state.tasks) {
    for (const raiser of task.raisers) {
      if (raiser.personId === personId && raiser.from === sessionId && raiser.quote) {
        lines.push({ taskName: task.name, quote: raiser.quote });
      }
    }
  }
  return lines;
}
