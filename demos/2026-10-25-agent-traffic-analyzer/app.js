import { analyze, SPOOFING_NOTE } from "./analyze.js";
import { parseLog } from "./parse.js";
import { SAMPLE_LOG } from "./sample-log.js";
import { ROLES, SIGNATURES } from "./signatures.js";

const logBox = document.getElementById("log");
const results = document.getElementById("results");
const fileNote = document.getElementById("file-note");
const stale = document.getElementById("stale");
const fileInput = document.getElementById("file");
const panel = logBox.closest(".panel");

let lastText = "";

function el(tag, props, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children || []) node.append(child);
  return node;
}

function tone(role) {
  return `tone-${role || "other"}`;
}

function clear(node) {
  node.replaceChildren();
}

const VERIFY = [
  ["Google’s reverse-DNS check", "https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests"],
  ["Bing’s reverse-DNS check", "https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26"],
  ["Common Crawl on fake CCBot strings", "https://commoncrawl.org/ccbot"],
];

function renderNotes() {
  const root = document.getElementById("notes");
  clear(root);
  const byVendor = new Map();
  for (const sig of SIGNATURES) {
    if (!byVendor.has(sig.vendor)) byVendor.set(sig.vendor, []);
    byVendor.get(sig.vendor).push(sig);
  }
  for (const [vendor, rows] of byVendor) {
    const list = el("ul", { class: "notes" });
    for (const sig of rows) {
      const role = ROLES[sig.role];
      const item = el("li", {}, [
        el("strong", { text: sig.name }),
        document.createTextNode(` · ${role ? role.label : sig.role}. ${sig.summary} `),
        el("a", { href: sig.doc, text: sig.docLabel }),
        document.createTextNode("."),
      ]);
      if (sig.expectsInLogs === false) {
        item.append(el("div", { class: "hint token-flag", text: "Documented as a robots.txt control. A normal crawl will not show this token." }));
      }
      list.append(item);
    }
    root.append(el("div", { class: "vendor" }, [el("h3", { text: vendor }), list]));
  }
  root.append(el("h3", { text: "The string can be copied" }));
  root.append(el("p", { text: SPOOFING_NOTE }));
  const links = el("ul", { class: "notes" });
  for (const [label, href] of VERIFY) links.append(el("li", {}, [el("a", { href, text: label })]));
  root.append(links);
  root.append(
    el("p", {
      class: "hint",
      text: "SEO crawlers such as AhrefsBot and SemrushBot are on the list only so they are not counted as a person. curl, Wget, python-requests, Go-http-client, and HeadlessChrome are filed as tools. Anything else with a bot-shaped name is “other crawler,” with no vendor attached.",
    }),
  );
}

function metric(label, value, hint) {
  return el("article", { class: "metric" }, [
    el("span", { class: "metric-k", text: label }),
    el("strong", { text: String(value) }),
    hint ? el("span", { class: "hint", text: hint }) : el("span"),
  ]);
}

function barRow(name, count, max, role) {
  const width = max ? Math.max(2, Math.round((count / max) * 100)) : 0;
  return el("li", {}, [
    el("span", { class: "rank-name", text: name }),
    el("span", { class: "track", title: `${count}` }, [
      el("span", { class: `fill ${tone(role)}`, style: `width:${width}%` }),
    ]),
    el("span", { class: "count", text: String(count) }),
  ]);
}

function typeChart(pages) {
  const max = Math.max(...pages.map((row) => Math.max(row.agents, row.people)), 1);
  const list = el("div", { class: "types" });
  for (const row of pages) {
    const agentWidth = Math.round((row.agents / max) * 100);
    const peopleWidth = Math.round((row.people / max) * 100);
    list.append(
      el("div", { class: "type-row" }, [
        el("span", { class: "type-name", text: row.label }),
        el("span", { class: "pair" }, [
          el("span", {}, [
            el("i", { text: "Agents" }),
            el("span", { class: "track" }, [el("span", { class: "fill tone-mix", style: `width:${agentWidth}%` })]),
            el("b", { text: String(row.agents) }),
          ]),
          el("span", {}, [
            el("i", { text: "People" }),
            el("span", { class: "track" }, [el("span", { class: "fill tone-human", style: `width:${peopleWidth}%` })]),
            el("b", { text: String(row.people) }),
          ]),
        ]),
      ]),
    );
  }
  return list;
}

function renderTimeline(data) {
  const wrap = el("div", { class: "timeline" });
  const max = Math.max(...data.buckets.map((bucket) => bucket.total), 1);
  const seen = new Set();
  const order = ["user", "training", "corpus", "ai-search", "search", "human", "ads", "preview", "seo", "tool", "token", "other", "unknown"];
  for (const bucket of data.buckets) {
    const height = Math.max(8, Math.round((bucket.total / max) * 110));
    const stack = el("span", { class: "stack", style: `height:${height}px` });
    const bits = [];
    for (const role of order) {
      const count = bucket.roles[role] || 0;
      if (!count) continue;
      seen.add(role);
      const seg = Math.round((count / bucket.total) * height);
      stack.append(el("i", { class: tone(role), style: `height:${Math.max(seg, 2)}px` }));
      bits.push(`${count} ${ROLES[role] ? ROLES[role].legend : role}`);
    }
    const col = el("div", { class: "day" }, [
      el("span", { class: "day-n", text: String(bucket.total) }),
      el("div", { class: "col", "aria-label": `${bucket.label}: ${bucket.total}. ${bits.join(", ")}` }, [stack]),
      el("span", { class: "day-label", text: bucket.label }),
    ]);
    wrap.append(col);
  }
  const legend = el("ul", { class: "legend" });
  for (const role of order) {
    if (!seen.has(role)) continue;
    legend.append(
      el("li", {}, [
        el("i", { class: `swatch ${tone(role)}` }),
        document.createTextNode(ROLES[role] ? ROLES[role].legend : role),
      ]),
    );
  }
  return el("div", {}, [wrap, legend]);
}

function agentCard(agent, open) {
  const summary = el("summary", {}, [
    el("span", { class: "agent-name", text: agent.name }),
    el("span", { class: `pill ${tone(agent.role)}`, text: agent.roleLabel }),
    el("span", { class: "agent-count", text: String(agent.count) }),
  ]);
  const body = [el("p", { text: agent.summary })];
  if (agent.doc) body.push(el("p", { class: "hint" }, [el("a", { href: agent.doc, text: agent.docLabel })]));
  const pills = el("div", { class: "statuses" });
  for (const status of agent.statuses) {
    const bad = status.code !== "—" && Number(status.code) >= 400;
    const ok = status.code.startsWith("2");
    pills.append(el("span", { class: `pill${bad ? " bad" : ""}${ok ? " ok" : ""}`, text: `${status.code} × ${status.count}` }));
  }
  body.push(pills);
  const paths = el("ul", { class: "paths" });
  for (const path of agent.topPaths) {
    paths.append(
      el("li", {}, [
        el("span", { class: "path", text: path.path }),
        el("span", { class: "count", text: String(path.count) }),
      ]),
    );
  }
  body.push(paths);
  const card = el("details", { class: "agent", open: open ? "" : null }, [summary, el("div", { class: "agent-body" }, body)]);
  if (!open) card.removeAttribute("open");
  return card;
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const previous = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => {
    button.textContent = previous;
  }, 1600);
}

function snippet(title, text, note) {
  const button = el("button", { type: "button", class: "secondary small", text: "Copy" });
  button.addEventListener("click", () => copyText(text, button));
  return el("article", { class: "snippet" }, [
    el("div", { class: "snippet-head" }, [el("h3", { text: title }), button]),
    note ? el("p", { class: "caption", text: note }) : el("span"),
    el("pre", { text }),
  ]);
}

function render(report) {
  clear(results);
  if (!report.hits.length) {
    const empty = el("section", { class: "panel empty" }, [
      el("h2", { text: "Nothing to sort yet" }),
      el("p", {
        class: "caption",
        text: report.skipped.length
          ? `Skipped ${report.skipped.length} lines. None of them looked like a combined log row or a CSV row.`
          : "Paste a log or load the sample. Comment lines that start with # are notes, not requests.",
      }),
    ]);
    results.append(empty);
    results.dataset.ready = "";
    return;
  }

  const { totals } = report;
  const searchTotal = totals.search + totals.aiSearch;
  const root = el("div", {});
  if (report.comments.sample) {
    root.append(
      el("p", {
        class: "banner",
        text: "Sample data. Queen City Coil is a fictional Cincinnati HVAC shop. These requests were written for the demo, not captured from a server.",
      }),
    );
  }
  root.append(el("h2", { text: "What this log is saying" }));
  root.append(
    el("p", {
      class: "caption",
      text: `${totals.parsed} requests parsed${totals.skipped ? ` · ${totals.skipped} lines skipped` : ""}${report.format === "csv" ? " · CSV" : ""}.`,
    }),
  );
  root.append(
    el("div", { class: "metrics" }, [
      metric("Assistant fetches", totals.user, "A person triggered these"),
      metric("Training crawlers", totals.training, totals.corpus ? `Plus ${totals.corpus} from Common Crawl` : "May be used to train a model"),
      metric("Search crawlers", searchTotal, `${totals.search} search engines · ${totals.aiSearch} AI search`),
      metric("Likely people", totals.human, totals.other ? `${totals.other} other clients` : "Normal browser strings"),
    ]),
  );

  const story = el("div", { class: "takeaways" });
  report.takeaways.forEach((line, index) => {
    story.append(el("p", { class: index === 0 ? "lead" : "", text: line }));
  });
  story.append(el("p", { class: "spoof", text: report.spoofing }));
  root.append(story);

  const ranked = [...report.agents].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const max = ranked[0] ? ranked[0].count : 1;
  root.append(el("h2", { text: "Who showed up" }));
  root.append(el("p", { class: "caption", text: "Each row is one user-agent signature. People in ordinary browsers are one row." }));
  root.append(el("ol", { class: "rank" }, ranked.map((agent) => barRow(agent.name, agent.count, max, agent.role))));

  root.append(el("h2", { text: "What they opened" }));
  root.append(el("p", { class: "caption", text: "Agents here means every client that did not look like a person’s browser, including search engines. Paths are grouped by the kind of page." }));
  root.append(typeChart(report.pages));

  root.append(el("h2", { text: "When they came" }));
  root.append(
    el("p", {
      class: "caption",
      text: report.timeline.unit === "hour"
        ? "Hours use the clock time written in the log."
        : "Days use the date written in the log, not a converted time zone.",
    }),
  );
  if (report.timeline.buckets.length) root.append(renderTimeline(report.timeline));
  else root.append(el("p", { class: "hint", text: "None of the rows had a time this page could read." }));

  root.append(el("h2", { text: "Each agent" }));
  let opened = false;
  for (const agent of report.agents) {
    const open = !opened && agent.role === "user";
    if (open) opened = true;
    root.append(agentCard(agent, open));
  }

  if (report.notFound.length) {
    root.append(el("h2", { text: "Pages that failed" }));
    const misses = el("ul", { class: "misses" });
    for (const row of report.notFound) {
      misses.append(
        el("li", {}, [
          el("span", { class: "path", text: row.path }),
          el("span", { text: `${row.status} · ${row.agentName} · ${row.count}` }),
        ]),
      );
    }
    root.append(misses);
  }

  if (report.skipped.length) {
    const examples = report.skipped.slice(0, 5).map((row) => row.line.slice(0, 180));
    const block = el("details", { class: "agent" }, [
      el("summary", {}, [el("span", { class: "agent-name", text: `${report.skipped.length} lines skipped` })]),
      el("div", { class: "agent-body" }, [
        el("p", { class: "caption", text: "They were not a combined log line or a CSV row. The counts above leave them out." }),
        el("ul", { class: "paths" }, examples.map((line) => el("li", {}, [el("span", { class: "path", text: line })]))),
      ]),
    ]);
    root.append(block);
  }

  root.append(el("h2", { text: "A draft you could publish" }));
  root.append(
    el("p", {
      class: "caption",
      text: "Read both before you put them on the site. Disallow is a request, and several of the live fetchers say they may ignore robots.txt. The llms.txt draft only knows the pages in this log.",
    }),
  );
  root.append(
    el("div", { class: "snippets" }, [
      snippet("robots.txt", report.robots, "Training crawlers that appeared are set to Disallow. Search and live fetches are set to Allow. Google-Extended and Applebot-Extended are included only as the training controls those vendors document."),
      snippet("llms.txt", report.llms, "A short brief for an assistant. Replace anything that is not true of the business."),
    ]),
  );

  const section = el("section", { class: "panel", id: "report" }, [...root.childNodes]);
  results.append(section);
  results.dataset.ready = "yes";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function run() {
  lastText = logBox.value;
  stale.hidden = true;
  const parsed = parseLog(logBox.value);
  render(analyze(parsed));
}

function readFile(file) {
  if (!file) return;
  if (file.size > 8_000_000) {
    fileNote.hidden = false;
    fileNote.textContent = "That file is over 8 MB. Cut it down and try again. It was not uploaded.";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    logBox.value = String(reader.result || "");
    fileNote.hidden = false;
    fileNote.textContent = `Read ${file.name} on this device. It was not uploaded.`;
    run();
  };
  reader.readAsText(file);
}

document.getElementById("sample").addEventListener("click", () => {
  logBox.value = SAMPLE_LOG;
  fileNote.hidden = false;
  fileNote.textContent = "Sample log loaded. Queen City Coil is fictional.";
  run();
});
document.getElementById("analyze").addEventListener("click", run);
document.getElementById("upload").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  readFile(fileInput.files && fileInput.files[0]);
  fileInput.value = "";
});
logBox.addEventListener("input", () => {
  if (results.dataset.ready === "yes" && logBox.value !== lastText) stale.hidden = false;
});
panel.addEventListener("dragover", (event) => {
  event.preventDefault();
  panel.classList.add("drag");
});
panel.addEventListener("dragleave", () => panel.classList.remove("drag"));
panel.addEventListener("drop", (event) => {
  event.preventDefault();
  panel.classList.remove("drag");
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  readFile(file);
});

renderNotes();
