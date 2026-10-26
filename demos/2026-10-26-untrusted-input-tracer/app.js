import {
  fileOrder,
  files,
  findingById,
  findings,
  hardening,
  phases,
  positives,
  runFinding,
  shopExcerpt,
  sinkLabel,
  sources,
  validateRecords,
  verifyRecord,
  wave1Covered,
} from "./model.js";

const steps = [
  { id: "intro", short: "Shop", label: "The shop and the six phases" },
  { id: "recon", short: "Map", label: "Phase 1, reconnaissance" },
  { id: "hunt1", short: "Wave 1", label: "Phase 2, hunting wave 1" },
  { id: "critic", short: "Critic", label: "Phase 2, coverage critic" },
  { id: "hunt2", short: "Wave 2", label: "Phase 2, hunting wave 2" },
  { id: "validate", short: "Disprove", label: "Phase 3, candidate validation" },
  { id: "record", short: "Record", label: "Phase 4, structured output" },
  { id: "verify", short: "Recheck", label: "Phase 5, independent verification" },
  { id: "report", short: "Report", label: "Phase 6, the report" },
];

const nextCopy = {
  intro: "Map the inputs",
  recon: "Start wave 1",
  hunt1: "I think that's all of them",
  critic: "Keep investigating",
  hunt2: "Try to disprove one",
  validate: "Write the records",
  record: "Verify a record",
  verify: "Read the report",
};

const state = {
  step: "intro",
  wave1Done: false,
  criticDone: false,
  pick: {
    hunt1: "sql-phone",
    hunt2: "idor-job",
    validate: "sql-phone",
    verify: "sql-phone",
  },
  fixes: {},
  file: "server.js",
  verifiedId: "",
  scroll: true,
};

const app = document.querySelector("#app");

function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "class") node.className = value;
      else node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    node.append(kid);
  }
  return node;
}

function b(props, ...kids) {
  return h("button", { type: "button", ...props }, ...kids);
}

function canOpen(id) {
  const afterCritic = new Set(["hunt2", "validate", "record", "verify", "report"]);
  if (afterCritic.has(id)) return state.criticDone;
  if (id === "critic") return state.wave1Done;
  return true;
}

function confirmed(wave) {
  return findings.filter((finding) => finding.verdict === "confirmed" && finding.wave === wave);
}

function fixedOn(id) {
  return Boolean(state.fixes[id]);
}

function render() {
  const y = state.scroll ? 0 : window.scrollY;
  app.replaceChildren(shell());
  if (state.scroll) {
    const title = app.querySelector("#step-title");
    if (title) title.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } else {
    window.scrollTo(0, y);
  }
  state.scroll = false;
}

function shell() {
  const step = steps.find((item) => item.id === state.step);
  return h(
    "div",
    {},
    nav(),
    h("p", { class: "kicker" }, step.label),
    h("h2", { id: "step-title", tabindex: "-1" }, heading(state.step)),
    bodyFor(state.step),
    dock(),
  );
}

function heading(id) {
  const titles = {
    intro: "Six phases, one small server",
    recon: "Where untrusted input enters",
    hunt1: "Follow the direct paths",
    critic: "You haven't found them all",
    hunt2: "The two paths wave 1 left closed",
    validate: "A fresh reviewer tries to disprove it",
    record: "Severity, line, cause, patch",
    verify: "Check the record against the lines",
    report: "What the shop should change",
  };
  return titles[id];
}

function nav() {
  return h(
    "ol",
    { class: "steps" },
    ...steps.map((step) => {
      const open = canOpen(step.id);
      return h(
        "li",
        {},
        b(
          {
            "data-go": step.id,
            "aria-current": state.step === step.id ? "step" : false,
            "aria-label": step.label,
            disabled: open ? false : true,
          },
          step.short,
        ),
      );
    }),
  );
}

function dock() {
  const index = steps.findIndex((step) => step.id === state.step);
  const kids = [];
  if (index > 0) {
    kids.push(b({ class: "secondary", "data-go": steps[index - 1].id }, "Back"));
  }
  const label = nextCopy[state.step];
  if (label) kids.push(b({ "data-next": "1" }, label));
  return h("div", { class: "dock" }, ...kids);
}

function bodyFor(id) {
  if (id === "intro") return intro();
  if (id === "recon") return recon();
  if (id === "hunt1") return hunt(1);
  if (id === "critic") return critic();
  if (id === "hunt2") return hunt(2);
  if (id === "validate") return validate();
  if (id === "record") return record();
  if (id === "verify") return verify();
  return report();
}

function intro() {
  return h(
    "div",
    {},
    h(
      "p",
      {},
      "Cloudflare’s skill runs a full audit in six phases, in this order. A question about one bug can use only the relevant part. This prompt asked for the full pass, so the walkthrough does too.",
    ),
    h(
      "ol",
      { class: "stack" },
      ...phases.map((phase) =>
        h("li", { class: "card" }, h("h3", {}, `${phase.n}. ${phase.name}`), h("p", {}, phase.text)),
      ),
    ),
    h(
      "p",
      { class: "caption" },
      "Profile: standard. On a shop this small a quick profile is also allowed, and a quick profile would defer the critic’s new units instead of hunting them. The prompt said to keep investigating, so the second wave runs.",
    ),
  );
}

function recon() {
  return h(
    "div",
    {},
    h("h3", {}, "Four research passes, then a ledger"),
    h(
      "p",
      {},
      "Reconnaissance reads the repo. It does not send a request at a deployed shop. These four passes are the ones the skill launches before anyone hunts.",
    ),
    h(
      "div",
      { class: "stack" },
      agent("1a · Product", "A Node HTTP server for one shop. Customers post a booking. A dispatcher exports jobs. There is no prior coverage ledger, so nothing is already covered."),
      agent("1b · Principals", "Anonymous visitor, signed-in customer, dispatcher. GET /admin/jobs returns 401 with no session. GET /admin/export, POST /upload, and POST /fax/retry do not read a session."),
      agent("1c · Entries and sinks", "Every form field, query parameter, and header below is in source. The pass records where each one goes. It does not decide yet whether that path breaks."),
      agent("1d · What can actually be run", "This page will not start the server. A full audit runs target code only inside the skill’s sandbox: no external network, a scrubbed environment, and writes confined to a scratch directory. Without that, behavior that depends on a live process stays an open lead. The fixtures later on compare dummy rows and strings, which this tab can do."),
    ),
    h("h3", {}, "Untrusted sources"),
    h(
      "div",
      { class: "stack" },
      ...sources.map((source) =>
        b(
          { class: "card", "data-file": source.file, "aria-pressed": state.file === source.file ? "true" : "false" },
          h("span", { class: "card-top" }, h("strong", {}, source.name), h("span", { class: "pill" }, source.kind)),
          h("span", { class: "caption" }, `${source.where} → ${source.goes}`),
        ),
      ),
    ),
    h("h3", {}, "Companions selected from the map"),
    h(
      "p",
      {},
      "CLIENT-SIDE.md, because public/status.js assigns innerHTML from the URL. WEB-PROTOCOL-AND-AUTH.md, the host-and-forwarded-header block, because absoluteHost reads X-Forwarded-Host. The other companion files stay unselected: this repo has no LLM tool, native parser, CI workflow, cloud policy, or local IPC service. package.json floats image-rotate, and there is no install or build that consumes it, so that question stays on the ordinary dependency check rather than a supply-chain hunt.",
    ),
    filePanel(),
    h(
      "details",
      { class: "box" },
      h("summary", {}, "One ledger unit, still planned"),
      h(
        "p",
        {},
        "The parent writes a unit for each entry, trust boundary, and attack class. The id percent-encodes those references and joins them with ::. This page keeps the fields and skips the encoding. Prior ledger: none.",
      ),
      h(
        "pre",
        { class: "code" },
        [
          "{",
          '  "surface": "server.js#POST /book",',
          '  "boundary": "lib/booking.js#findDuplicate",',
          '  "subsystem": "booking",',
          '  "attack_class": "ATTACK-CLASSES.md#Injection",',
          '  "status": "planned"',
          "}",
        ].join("\n"),
      ),
    ),
  );
}

function agent(title, text) {
  return h("div", { class: "card" }, h("h3", {}, title), h("p", {}, text));
}

function filePanel() {
  const lines = files[state.file];
  return h(
    "div",
    { class: "panel" },
    h("h3", {}, "The shop, as written"),
    h("div", { class: "files" }, ...fileOrder.map((name) =>
      b(
        { class: state.file === name ? "" : "secondary", "data-file": name, "aria-pressed": state.file === name ? "true" : "false" },
        name,
      ),
    )),
    h("p", { class: "caption" }, state.file),
    h(
      "ol",
      { class: "code" },
      ...lines.map((text, index) =>
        h("li", {}, h("span", { class: "n" }, String(index + 1)), h("span", {}, text || " ")),
      ),
    ),
  );
}

function hunt(wave) {
  const list = confirmed(wave);
  const slot = wave === 1 ? "hunt1" : "hunt2";
  const current = findingById(state.pick[slot]);
  return h(
    "div",
    {},
    h(
      "p",
      {},
      wave === 1
        ? "A hunter names the principal, the input, the control that should stop it, and the sink. Wave 1 follows the direct paths. The trace words are the skill’s: entrypoint, propagation, sink."
        : "Wave 2 is a new hunter on the units the critic reopened. Same method, paths wave 1 had marked done or never opened.",
    ),
    h("div", { class: "stack" }, ...list.map((finding) => pickButton(finding, slot))),
    findingDetail(current),
    wave === 1 ? coveredNote() : h("p", { class: "caption" }, "Both of these were still open after wave 1 said the file and the login check were done."),
    wave === 1 ? inspected() : null,
  );
}

function pickButton(finding, slot) {
  const on = state.pick[slot] === finding.id;
  const pill = finding.verdict === "confirmed"
    ? h("span", { class: "sev " + finding.severity }, finding.severity)
    : h("span", { class: "sev unrated" }, "unrated");
  return b(
    { class: "card", "data-pick": finding.id, "data-slot": slot, "aria-pressed": on ? "true" : "false" },
    h("span", { class: "card-top" }, h("strong", {}, finding.title), pill),
  );
}

function findingDetail(finding) {
  const on = fixedOn(finding.id);
  const result = runFinding(finding.id, on);
  const excerpt = shopExcerpt(finding.excerpt.file, finding.excerpt.snippet, finding.excerpt.count);
  return h(
    "section",
    { class: "panel", "aria-live": "polite" },
    h(
      "p",
      { class: "card-top" },
      h("span", { class: "pill" }, finding.attackClass),
      h("span", { class: "caption" }, finding.classRef),
    ),
    h("p", {}, h("strong", {}, "Principal. "), finding.principal),
    h("p", {}, h("strong", {}, "Invariant. "), finding.invariant),
    h("p", {}, finding.rootCause),
    h("h3", {}, "Trace"),
    h(
      "ol",
      { class: "trace" },
      ...finding.trace.map((step) =>
        h(
          "li",
          { class: step.role === "sink" ? "sink" : "" },
          h("span", { class: "role" }, `${step.role} · ${step.file}:${step.line}`),
          h("span", {}, step.caption),
        ),
      ),
    ),
    h("h3", {}, on ? "Patch" : `Shop · ${finding.excerpt.file}`),
    h(
      "p",
      { class: "caption" },
      on ? finding.patchNote : "The highlighted line is the step the fixture breaks.",
    ),
    on ? h("pre", { class: "code patch" }, finding.patch.join("\n")) : codeList(excerpt, finding.sinkSnippet),
    h("h3", {}, "Fixture input"),
    h(
      "p",
      { class: "caption" },
      "This is the concrete input the verifier uses. It is the minimum value that shows the break on dummy data.",
    ),
    h("div", { class: "fixture" }, h("b", {}, result.inputLabel), h("span", { class: "mono" }, result.input)),
    h("div", { class: "fixture" }, h("b", {}, "Request"), h("span", { class: "mono" }, result.request)),
    result.extra
      ? h("div", { class: "fixture" }, h("b", {}, result.extraLabel), h("span", { class: "mono" }, result.extra))
      : null,
    h(
      "div",
      { class: on ? "banner ok" : "banner bad" },
      h("p", {}, h("strong", {}, on ? "The path holds. " : "The path breaks. "), result.observed),
    ),
    b(
      { class: "fix", "data-fix": finding.id, "aria-pressed": on ? "true" : "false" },
      on ? "Show the shop path" : "Apply the smallest fix",
    ),
  );
}

function codeList(lines, sinkSnippet) {
  return h(
    "ol",
    { class: "code" },
    ...lines.map((line) =>
      h(
        "li",
        { class: sinkSnippet && line.text.includes(sinkSnippet) ? "hit" : "" },
        h("span", { class: "n" }, String(line.line)),
        h("span", {}, line.text || " "),
      ),
    ),
  );
}

function coveredNote() {
  return h(
    "div",
    {},
    h("h3", {}, "Marked covered in this wave"),
    h(
      "div",
      { class: "stack" },
      ...wave1Covered.map((item) =>
        h("div", { class: "card" }, h("strong", {}, item.title), h("p", { class: "caption" }, item.result)),
      ),
    ),
  );
}

function inspected() {
  const extras = findings.filter((finding) => finding.verdict !== "confirmed");
  return h(
    "div",
    {},
    h("h3", {}, "Also inspected, and not confirmed"),
    h(
      "div",
      { class: "stack" },
      ...extras.map((finding) =>
        h(
          "div",
          { class: "card" },
          h(
            "p",
            { class: "card-top" },
            h("strong", {}, finding.title),
            h("span", { class: finding.verdict === "rejected" ? "sev rejected" : "sev unrated" }, finding.verdict === "rejected" ? "rejected" : "unrated"),
          ),
          h("p", {}, finding.verdict === "rejected" ? finding.reason : finding.blocker),
        ),
      ),
    ),
  );
}

function critic() {
  return h(
    "div",
    {},
    h(
      "p",
      {},
      "Wave 1 closed six confirmed candidates and marked the job page covered because a missing session gets 401. The upload path was covered too: savePhoto really does keep the file name inside the upload root.",
    ),
    h(
      "blockquote",
      {},
      h(
        "p",
        {},
        "When you think you have found all vulnerabilities: You haven't. Keep investigating.",
      ),
    ),
    h(
      "p",
      { class: "caption" },
      "That line is the prompt. The skill’s coverage critic is the mechanism. It runs after the wave. It does not hunt. It looks for units the wave never actually traced, and for units closed without the path.",
    ),
    h(
      "div",
      { class: "stack" },
      h(
        "div",
        { class: "card" },
        h("h3", {}, "Reassign · GET /admin/jobs?id="),
        h("p", {}, "Access control. The hunter stopped at if (!req.session). getJob receives that session and never compares it to the row. A login check is not an owner check. The skill asks whether the check is the right one for the right resource."),
      ),
      h(
        "div",
        { class: "card" },
        h("h3", {}, "Missing unit · POST /fax/retry?name="),
        h("p", {}, "Resource and file handling. The hunter saw path.basename on the upload and stopped. resendFax, the function beside it, concatenates the query name onto the upload root. The method says to read the sibling path that reaches the same kind of sink."),
      ),
    ),
    h(
      "p",
      {},
      "A quick profile would stop here, mark both units deferred, and say the pass was partial. This walkthrough is on the standard profile, so the next wave hunts them. Cloudflare’s readme records a related result from their own test runs: a single run found roughly half of the vulnerabilities that repeated runs found in total. No one pass is complete, and a missing prior ledger is not empty coverage.",
    ),
  );
}

function validate() {
  const list = findings.filter((finding) => finding.verdict === "confirmed");
  const current = findingById(state.pick.validate);
  const on = fixedOn(current.id);
  const broken = current.run(false);
  const patched = current.run(true);
  return h(
    "div",
    {},
    h(
      "p",
      {},
      "The reviewer did not write this candidate. The job is to refute it from the source and from the same fixture. Hunters lean toward finding things. This pass leans toward killing a false positive.",
    ),
    h("div", { class: "stack" }, ...list.map((finding) => pickButton(finding, "validate"))),
    h("h3", {}, current.title),
    h(
      "ul",
      { class: "check" },
      checkItem("The first step is a real entry, and the last step is the sink", true, current.trace.map((step) => `${step.role} ${step.file}:${step.line}`).join(" → ")),
      checkItem("The strongest control on this path is already named", true, current.invariant),
      checkItem("The fixture shows the claimed result, and nothing stronger", broken.safe === false, broken.observed),
      checkItem(
        "The patch makes that same input hold",
        patched.safe === true,
        on ? patched.observed : "Turn the fix on to see this input stop at the control. The shop file stays unpatched either way.",
      ),
    ),
    h(
      "div",
      { class: "banner bad" },
      h(
        "p",
        {},
        h("strong", {}, "Decision on the shop as written: confirmed. "),
        "The trace matches the lines, and the fixture breaks. A short report of real findings beats a long list of theoretical ones. This one survived.",
      ),
    ),
    on
      ? h(
          "div",
          { class: "banner ok" },
          h("p", {}, h("strong", {}, "On the patch, this input holds. "), patched.observed),
        )
      : null,
    b(
      { class: "fix", "data-fix": current.id, "aria-pressed": on ? "true" : "false" },
      on ? "Show the broken fixture" : "Apply the smallest fix",
    ),
    h("h3", {}, "Two candidates that did not become findings"),
    h(
      "div",
      { class: "card" },
      h("p", { class: "card-top" }, h("strong", {}, findingById("forwarded-host").title), h("span", { class: "sev unrated" }, "unrated")),
      h("p", {}, findingById("forwarded-host").blocker),
      h("p", { class: "caption" }, findingById("forwarded-host").plan),
    ),
    h(
      "div",
      { class: "card" },
      h("p", { class: "card-top" }, h("strong", {}, findingById("dep-float").title), h("span", { class: "sev rejected" }, "rejected")),
      h("p", {}, findingById("dep-float").reason),
    ),
  );
}

function checkItem(name, ok, detail) {
  return h(
    "li",
    {},
    h("span", { class: ok ? "pill ok" : "pill bad" }, ok ? "holds" : "open"),
    " ",
    h("strong", {}, name),
    h("p", { class: "caption" }, detail),
  );
}

function record() {
  const errors = validateRecords();
  const groups = [
    ["confirmed", "Confirmed"],
    ["needs_validation", "Needs validation, unrated"],
    ["rejected", "Rejected"],
  ];
  return h(
    "div",
    {},
    h(
      "p",
      {},
      "The prompt asks for four fields. The skill adds a verdict in front of them, and it withholds severity unless the verdict is confirmed. This page checks that split on these records. It does not claim to have run Cloudflare’s schema file.",
    ),
    h(
      "div",
      { class: errors.length ? "banner bad" : "banner ok" },
      h(
        "p",
        {},
        errors.length
          ? "Record check failed: " + errors.join("; ")
          : "Record check passed: every confirmed item has severity, file, cause, vector, and a patch. The open lead has a blocker and a plan, and no severity. The rejection has a reason, and no severity.",
      ),
    ),
    ...groups.map(([verdict, label]) =>
      h(
        "section",
        {},
        h("h3", {}, label),
        h(
          "div",
          { class: "stack" },
          ...findings.filter((finding) => finding.verdict === verdict).map(recordCard),
        ),
      ),
    ),
  );
}

function recordCard(finding) {
  const sink = sinkLabel(finding);
  if (finding.verdict === "confirmed") {
    const result = finding.run(false);
    return h(
      "article",
      { class: "card" },
      h("p", { class: "card-top" }, h("strong", {}, finding.title), h("span", { class: "sev " + finding.severity }, finding.severity)),
      field("1 · Severity", `${finding.severity}. Confidence ${finding.confidence}. Impact shown by the fixture is ${finding.impact}, and the rating is not set above that.`),
      field("2 · File and line", sink),
      field("3 · Root cause and vector", `${finding.rootCause} ${finding.vector}`),
      field("4 · Remediation", finding.remediation),
      field("Observed result", result.observed),
      field("Principal", finding.principal),
      h("p", { class: "caption mono" }, finding.fingerprint),
    );
  }
  if (finding.verdict === "needs_validation") {
    return h(
      "article",
      { class: "card" },
      h("p", { class: "card-top" }, h("strong", {}, finding.title), h("span", { class: "sev unrated" }, "unrated")),
      field("File and line", sink),
      field("Claim", finding.claimed),
      field("Blocker", finding.blocker),
      field("Owner check", finding.plan),
      h("p", { class: "caption mono" }, finding.fingerprint),
    );
  }
  return h(
    "article",
    { class: "card" },
    h("p", { class: "card-top" }, h("strong", {}, finding.title), h("span", { class: "sev rejected" }, "rejected")),
    field("File and line", sink),
    field("Why it was rejected", finding.reason),
    h("p", { class: "caption mono" }, finding.fingerprint),
  );
}

function field(label, text) {
  return h("p", {}, h("strong", {}, label + ". "), text);
}

function verify() {
  const list = findings.filter((finding) => finding.verdict === "confirmed" || finding.verdict === "needs_validation");
  const current = findingById(state.pick.verify);
  const shown = state.verifiedId === current.id ? verifyRecord(current.id) : null;
  return h(
    "div",
    {},
    h(
      "p",
      {},
      "Phase 5 uses a fresh reviewer on the written record, not on the hunter’s notes. The check below re-reads the cited lines and re-runs the unpatched fixture. The patch is judged only as the remediation.",
    ),
    h("div", { class: "stack" }, ...list.map((finding) => pickButton(finding, "verify"))),
    h("h3", {}, current.title),
    h("p", { class: "caption" }, sinkLabel(current)),
    b({ "data-verify": current.id }, "Verify this record"),
    shown
      ? h(
          "ul",
          { class: "check" },
          ...shown.map((item) => checkItem(item.name, item.ok, item.detail)),
        )
      : h("p", { class: "caption" }, "The checks stay blank until you run them."),
    shown && shown.every((item) => item.ok)
      ? h("div", { class: "banner ok" }, h("p", {}, "Verified. The record matches the lines and the fixture."))
      : null,
  );
}

function report() {
  const confirmedRows = findings.filter((finding) => finding.verdict === "confirmed");
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  confirmedRows.sort((a, b) => order[a.severity] - order[b.severity]);
  return h(
    "div",
    {},
    h(
      "p",
      {},
      "Standard profile, whole repo, no budget cap, no prior ledger. Execution here was string and dummy-row checks, because this page does not provide the skill’s sandbox. Six confirmed findings, one unrated lead, one rejection. Wave 1 had marked the owner check and the fax path done. They were not.",
    ),
    h("h3", {}, "Confirmed"),
    h(
      "div",
      { class: "stack" },
      ...confirmedRows.map((finding) =>
        h(
          "div",
          { class: "card" },
          h(
            "p",
            { class: "card-top" },
            h("span", { class: "sev " + finding.severity }, finding.severity),
            h("span", { class: "mono caption" }, sinkLabel(finding)),
          ),
          h("strong", {}, finding.title),
          h("p", {}, finding.run(false).observed),
          h("p", {}, h("strong", {}, "Fix. "), finding.remediation),
        ),
      ),
    ),
    h("h3", {}, "Needs validation"),
    h(
      "div",
      { class: "card" },
      h("strong", {}, findingById("forwarded-host").title),
      h("p", {}, findingById("forwarded-host").blocker),
      h("p", { class: "caption" }, findingById("forwarded-host").plan),
    ),
    h("h3", {}, "Hardening, not findings"),
    h("ul", {}, ...hardening.map((item) => h("li", {}, item))),
    h("h3", {}, "What the shop already does"),
    h("ul", {}, ...positives.map((item) => h("li", {}, item))),
    h(
      "p",
      {},
      "Coverage from this walkthrough: the direct sinks were traced, then the critic reopened two units and wave 2 traced those too. The skill’s own line still applies after that. No one pass is complete. Their readme puts a number on the same idea, from their test runs: a single run found roughly half of the vulnerabilities that repeated runs found in total.",
    ),
    h(
      "p",
      { class: "source" },
      "Skill: ",
      h("a", { href: "https://github.com/cloudflare/security-audit-skill" }, "github.com/cloudflare/security-audit-skill"),
      ". Prompt: ",
      h(
        "a",
        { href: "https://x.com/franzbruckhoff/status/2113401002355298410" },
        "Franz Bruckhoff, prompt of the day",
      ),
      ".",
    ),
  );
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-go], [data-next], [data-pick], [data-file], [data-fix], [data-verify]");
  if (!target || target.disabled) return;
  if (target.dataset.go) {
    const id = target.dataset.go;
    if (!canOpen(id)) return;
    state.step = id;
    state.scroll = true;
    render();
    return;
  }
  if (target.dataset.next) {
    if (state.step === "hunt1") state.wave1Done = true;
    if (state.step === "critic") state.criticDone = true;
    const index = steps.findIndex((step) => step.id === state.step);
    const following = steps[index + 1];
    if (following && canOpen(following.id)) {
      state.step = following.id;
      state.scroll = true;
      render();
    }
    return;
  }
  if (target.dataset.pick) {
    state.pick[target.dataset.slot] = target.dataset.pick;
    if (target.dataset.slot === "verify") state.verifiedId = "";
    render();
    return;
  }
  if (target.dataset.file) {
    state.file = target.dataset.file;
    render();
    return;
  }
  if (target.dataset.fix) {
    const id = target.dataset.fix;
    state.fixes[id] = !state.fixes[id];
    render();
    return;
  }
  if (target.dataset.verify) {
    state.verifiedId = target.dataset.verify;
    state.pick.verify = target.dataset.verify;
    render();
  }
});

render();
