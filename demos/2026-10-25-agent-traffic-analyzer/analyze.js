import { SIGNATURES, ROLES } from "./signatures.js";

const SEARCH_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
  "duckduckgo.com",
  "www.duckduckgo.com",
  "yahoo.com",
  "www.yahoo.com",
  "search.yahoo.com",
  "facebook.com",
  "l.facebook.com",
  "www.facebook.com",
  "instagram.com",
  "www.instagram.com",
  "t.co",
  "perplexity.ai",
  "www.perplexity.ai",
  "chatgpt.com",
  "www.chatgpt.com",
  "openai.com",
  "claude.ai",
  "www.claude.ai",
  "anthropic.com",
]);

const ABOUT = {
  pricing: "about your prices",
  contact: "how to reach you",
  services: "about your services",
  areas: "whether you serve their area",
  blog: "about something on your blog",
  about: "about your company",
  home: "about your business",
  llms: "for the short brief in llms.txt",
  robots: "for your robots.txt",
  sitemap: "for your sitemap",
  asset: "for a file on the site",
  other: "about that page",
};

const LLMS_BLURB = {
  pricing: "What it costs. Put the real ranges here.",
  contact: "How a customer asks for a visit, and where you work.",
  services: "The work you do, in one line.",
  areas: "Neighborhoods you actually serve.",
  blog: "A short answer a customer might ask an assistant.",
  about: "Who you are.",
  home: "The front page.",
  other: "A page that showed up in the log.",
};

export const SPOOFING_NOTE =
  "A user-agent string is a label the client sends. Anyone can copy GPTBot or Googlebot. Google, Bing, and Common Crawl say the real check is reverse DNS on the IP, then a forward lookup back to that same IP. This page cannot do that lookup. Nothing here proves a visit was the real crawler.";

export function timesWord(count) {
  return count === 1 ? "1 time" : `${count} times`;
}

export function joinList(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function nounFor(type, paths) {
  const only = paths.length === 1 ? paths[0] : "";
  if (type === "pricing") return paths.length > 1 ? "pricing pages" : "pricing page";
  if (type === "contact") return paths.length > 1 ? "contact pages" : "contact page";
  if (type === "services") {
    if (only.includes("ac-repair")) return "AC repair page";
    if (only.includes("furnace")) return "furnace page";
    if (only.includes("maintenance")) return "maintenance plan page";
    if (only === "/services") return "services page";
    return paths.length > 1 ? "service pages" : "services page";
  }
  if (type === "areas") return paths.length > 1 ? "service-area pages" : "service-area page";
  if (type === "blog") {
    if (paths.length > 1) return "blog posts";
    if (only === "/blog") return "blog";
    return "blog post";
  }
  if (type === "about") return "about page";
  if (type === "home") return "home page";
  if (type === "llms") return "llms.txt file";
  if (type === "robots") return "robots.txt file";
  if (type === "sitemap") return "sitemap";
  if (only) return only;
  return "pages";
}

function hostOf(referrer) {
  if (!referrer || referrer === "-") return "";
  try {
    const url = new URL(referrer);
    return url.hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function discoverSite(hits, comments) {
  if (comments && comments.site) {
    const site = comments.site.replace(/\/$/, "");
    if (/^https?:\/\//i.test(site)) return { site, source: "comment" };
  }
  const counts = new Map();
  for (const hit of hits) {
    const host = hostOf(hit.referrer);
    if (!host || SEARCH_HOSTS.has(host)) continue;
    counts.set(host, (counts.get(host) || 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [host, count] of counts) {
    if (count > bestCount) {
      best = host;
      bestCount = count;
    }
  }
  if (best) return { site: `https://${best}`, source: "referrer" };
  return { site: "https://example.com", source: "placeholder" };
}

function groupHits(hits) {
  const byAgent = new Map();
  for (const hit of hits) {
    const key = hit.agent.id;
    if (!byAgent.has(key)) byAgent.set(key, []);
    byAgent.get(key).push(hit);
  }
  const roleOrder = ["user", "training", "corpus", "ai-search", "search", "ads", "preview", "seo", "token", "tool", "other", "unknown", "human"];
  const agents = [...byAgent.entries()].map(([id, group]) => summarizeAgent(id, group));
  agents.sort((a, b) => {
    const role = roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    if (role !== 0) return role;
    return b.count - a.count || a.name.localeCompare(b.name);
  });
  return agents;
}

function summarizeAgent(id, hits) {
  const agent = hits[0].agent;
  const paths = new Map();
  const types = new Map();
  const statuses = new Map();
  for (const hit of hits) {
    const pathKey = hit.path;
    if (!paths.has(pathKey)) paths.set(pathKey, { path: pathKey, count: 0, statuses: new Map(), type: hit.pageType });
    const pathRow = paths.get(pathKey);
    pathRow.count += 1;
    const statusKey = hit.status == null ? "—" : String(hit.status);
    pathRow.statuses.set(statusKey, (pathRow.statuses.get(statusKey) || 0) + 1);
    if (!types.has(hit.pageType)) types.set(hit.pageType, { id: hit.pageType, label: hit.pageLabel, count: 0, paths: new Set() });
    const typeRow = types.get(hit.pageType);
    typeRow.count += 1;
    typeRow.paths.add(hit.path);
    statuses.set(statusKey, (statuses.get(statusKey) || 0) + 1);
  }
  const topPaths = [...paths.values()].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
  const topTypes = [...types.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    id,
    name: agent.name,
    vendor: agent.vendor,
    role: agent.role,
    roleLabel: ROLES[agent.role] ? ROLES[agent.role].label : agent.role,
    askAs: agent.askAs,
    summary: agent.summary,
    clause: agent.clause,
    doc: agent.doc,
    docLabel: agent.docLabel,
    robots: agent.robots,
    robotsToken: agent.robotsToken,
    robotsNote: agent.robotsNote,
    expectsInLogs: agent.expectsInLogs,
    count: hits.length,
    topPaths: topPaths.slice(0, 6).map((row) => ({
      path: row.path,
      count: row.count,
      type: row.type,
      statuses: [...row.statuses.entries()].map(([code, count]) => ({ code, count })),
    })),
    types: topTypes.map((row) => ({
      id: row.id,
      label: row.label,
      count: row.count,
      paths: [...row.paths],
    })),
    statuses: [...statuses.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function timeline(hits) {
  const timed = hits.filter((hit) => hit.dayKey);
  if (!timed.length) return { unit: "none", buckets: [] };
  const days = [...new Set(timed.map((hit) => hit.dayKey))].sort();
  const useHour = days.length <= 1;
  const buckets = new Map();
  for (const hit of timed) {
    const key = useHour ? `${hit.dayKey} ${String(hit.hour).padStart(2, "0")}` : hit.dayKey;
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: useHour ? hourLabel(hit.hour) : hit.dayLabel,
        total: 0,
        roles: {},
      });
    }
    const bucket = buckets.get(key);
    bucket.total += 1;
    bucket.roles[hit.agent.role] = (bucket.roles[hit.agent.role] || 0) + 1;
  }
  return {
    unit: useHour ? "hour" : "day",
    buckets: [...buckets.values()],
  };
}

function hourLabel(hour) {
  const h = hour % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const clock = h % 12 === 0 ? 12 : h % 12;
  return `${clock} ${suffix}`;
}

function userSentences(agent, humanHits) {
  if (!agent.types.length) return [];
  const top = agent.types[0];
  const noun = nounFor(top.id, top.paths);
  const about = ABOUT[top.id] || "about that page";
  const sentences = [
    `${agent.name} fetched your ${noun} ${timesWord(top.count)}: real people are asking ${agent.askAs} ${about}.`,
  ];
  const more = agent.types.slice(1).filter((type) => type.count >= 2 && type.id !== "asset").slice(0, 2);
  if (more.length) {
    const bits = more.map((type) => `your ${nounFor(type.id, type.paths)} ${timesWord(type.count)}`);
    sentences.push(`It also fetched ${joinList(bits)}.`);
  }
  const humanSame = humanHits.filter((hit) => hit.pageType === top.id).length;
  if (humanSame > 0) {
    sentences.push(`Browsers opened your ${noun} ${timesWord(humanSame)} in the same log.`);
  }
  return sentences;
}

function trainingSentence(agents) {
  const trainers = agents.filter((agent) => agent.role === "training");
  if (!trainers.length) return "";
  const listed = joinList(trainers.map((agent) => `${agent.name} (${agent.count})`));
  const clauses = trainers.slice(0, 2).map((agent) => agent.clause).filter(Boolean);
  return `Training crawlers in this log: ${listed}. ${clauses.join(" ")}`.trim();
}

function corpusSentence(agents) {
  const rows = agents.filter((agent) => agent.role === "corpus");
  if (!rows.length) return "";
  return rows
    .map(
      (agent) =>
        `${agent.name} fetched ${agent.count} URLs. That is Common Crawl’s public web corpus, not a chat assistant. The opt-out they document is a robots.txt disallow for CCBot.`,
    )
    .join(" ");
}

function notFoundRows(hits) {
  const rows = new Map();
  for (const hit of hits) {
    if (hit.status == null || hit.status < 400) continue;
    const key = `${hit.agent.id}|${hit.path}|${hit.status}`;
    if (!rows.has(key)) {
      rows.set(key, {
        agentId: hit.agent.id,
        agentName: hit.agent.name,
        role: hit.agent.role,
        path: hit.path,
        status: hit.status,
        count: 0,
      });
    }
    rows.get(key).count += 1;
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
}

function notFoundSentence(rows) {
  if (!rows.length) return "";
  const byAgent = new Map();
  for (const row of rows) {
    if (!byAgent.has(row.agentName)) byAgent.set(row.agentName, []);
    byAgent.get(row.agentName).push(`${row.path} (${row.count})`);
  }
  const bits = [...byAgent.entries()].map(([name, paths]) => `${name} got ${joinList(paths)}`);
  return `404s and other errors: ${joinList(bits)}. Those addresses were missing, or the crawler guessed them.`;
}

function llmsSentence(hits) {
  const rows = hits.filter((hit) => hit.pageType === "llms");
  if (!rows.length) {
    return "Nothing in this log requested /llms.txt. A short file there is a brief you write for assistants. A draft is below.";
  }
  const names = [...new Set(rows.map((hit) => hit.agent.name))];
  return `llms.txt was fetched ${timesWord(rows.length)}, by ${joinList(names)}. If that file is yours, keep the prices and the service list in it current.`;
}

function takeaways(hits, agents) {
  const lines = [];
  const humans = hits.filter((hit) => hit.agent.role === "human");
  const people = agents.filter((item) => item.role === "user");
  people.forEach((agent, index) => {
    lines.push(...userSentences(agent, index === 0 ? humans : []));
  });
  const training = trainingSentence(agents);
  if (training) lines.push(training);
  const tokens = agents.filter((agent) => agent.role === "token" && agent.clause);
  if (tokens.length) lines.push(tokens.map((agent) => agent.clause).join(" "));
  const corpus = corpusSentence(agents);
  if (corpus) lines.push(corpus);
  const missing = notFoundSentence(notFoundRows(hits));
  if (missing) lines.push(missing);
  lines.push(llmsSentence(hits));
  const browsers = humans.length;
  const requestWord = hits.length === 1 ? "parsed request" : "parsed requests";
  const look = browsers === 1 ? "looks" : "look";
  lines.push(
    browsers
      ? `Out of ${hits.length} ${requestWord}, ${browsers} ${look} like a person in a browser. The rest are assistants, crawlers, or something this list does not recognize.`
      : `Out of ${hits.length} ${requestWord}, none look like a normal browser.`,
  );
  return lines;
}

function pageComparison(hits) {
  const order = ["pricing", "services", "contact", "areas", "blog", "about", "home", "llms", "robots", "sitemap", "other", "asset"];
  const rows = new Map();
  for (const hit of hits) {
    if (!rows.has(hit.pageType)) rows.set(hit.pageType, { id: hit.pageType, label: hit.pageLabel, agents: 0, people: 0 });
    const row = rows.get(hit.pageType);
    if (hit.agent.role === "human") row.people += 1;
    else row.agents += 1;
  }
  return [...rows.values()]
    .filter((row) => row.id !== "asset" && row.agents + row.people > 0)
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id) || b.agents - a.agents);
}

function robotsDraft(agents) {
  const seen = agents.filter((agent) => agent.robots && agent.robots !== "omit" && agent.robotsToken);
  const lines = [
    "# Draft robots.txt. Read it before you publish it.",
    "# Built only from user-agent strings in the log you opened.",
    "# A Disallow is a request. Several user-triggered fetchers say they may ignore it.",
    "",
  ];
  const groups = [
    {
      title: "Training crawlers that showed up. The vendor says a Disallow is the opt-out.",
      role: "training",
      directive: "Disallow",
    },
    {
      title: "Public corpus crawler that showed up.",
      role: "corpus",
      directive: "Disallow",
    },
    {
      title: "People using an assistant. Blocking these can keep your pages out of the answer.",
      role: "user",
      directive: "Allow",
    },
    {
      title: "AI search crawlers. The vendors say these are the search opt-out, separate from training.",
      role: "ai-search",
      directive: "Allow",
    },
    {
      title: "Search engines that showed up.",
      role: "search",
      directive: "Allow",
    },
    {
      title: "A robots.txt control token showed up in a user-agent string. Vendors say these tokens do not fetch pages themselves.",
      role: "token",
      directive: "Disallow",
    },
  ];
  for (const group of groups) {
    const members = seen.filter((agent) => agent.role === group.role);
    if (!members.length) continue;
    lines.push(`# ${group.title}`);
    for (const agent of members) {
      if (agent.robotsNote) lines.push(`# ${agent.name}: ${agent.robotsNote}`);
      lines.push(`User-agent: ${agent.robotsToken}`);
      lines.push(`${group.directive}: /`);
      lines.push("");
    }
  }
  const tokenSeen = new Set(seen.map((agent) => agent.id));
  lines.push("# Not seen as their own crawler in this log.");
  lines.push("# Google and Apple document these as robots.txt controls for training use.");
  lines.push("# They say a disallow does not, by itself, remove the site from search.");
  for (const sig of SIGNATURES.filter((item) => item.role === "token")) {
    if (tokenSeen.has(sig.id)) continue;
    lines.push(`# ${sig.robotsNote}`);
    lines.push(`User-agent: ${sig.robotsToken}`);
    lines.push("Disallow: /");
    lines.push("");
  }
  lines.push("User-agent: *");
  lines.push("Allow: /");
  lines.push("");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function linkLabel(path, type) {
  if (type === "home") return "Home";
  if (type === "pricing") return "Pricing";
  if (type === "contact") return "Contact";
  if (type === "about") return "About";
  if (path === "/services") return "Services";
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "Page";
  return last
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function llmsDraft(hits, comments, siteInfo) {
  const name = (comments && comments.business) || "Your business";
  const summary = (comments && comments.summary) || "Replace this sentence with what you do, where you work, and how a customer hires you.";
  const fictional = comments && comments.sample;
  const lines = [`# ${name}`, ""];
  lines.push(`> ${summary}`);
  lines.push("");
  if (fictional) {
    lines.push("This business is invented for a demo. Replace every fact before you publish the file.");
    lines.push("");
  }
  if (siteInfo.source === "placeholder") {
    lines.push("The log did not include a hostname. The links below use example.com. Change them.");
    lines.push("");
  }
  lines.push("The shape of this file follows the llms.txt proposal: https://llmstxt.org/");
  lines.push("");
  const interesting = hits.filter((hit) => !["asset", "robots", "sitemap", "llms"].includes(hit.pageType));
  const counts = new Map();
  for (const hit of interesting) {
    if (!counts.has(hit.path)) counts.set(hit.path, { path: hit.path, type: hit.pageType, count: 0 });
    counts.get(hit.path).count += 1;
  }
  const pages = [...counts.values()].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)).slice(0, 8);
  if (pages.length) {
    lines.push("## Pages from this log");
    lines.push("");
    for (const page of pages) {
      const href = `${siteInfo.site}${page.path}`;
      const blur = LLMS_BLURB[page.type] || LLMS_BLURB.other;
      lines.push(`- [${linkLabel(page.path, page.type)}](${href}): ${blur}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

function totals(hits, skipped) {
  const count = (role) => hits.filter((hit) => hit.agent.role === role).length;
  return {
    parsed: hits.length,
    skipped: skipped.length,
    user: count("user"),
    training: count("training"),
    corpus: count("corpus"),
    aiSearch: count("ai-search"),
    search: count("search"),
    human: count("human"),
    other: hits.filter((hit) => !["user", "training", "corpus", "ai-search", "search", "human"].includes(hit.agent.role)).length,
  };
}

export function analyze(parsed) {
  const hits = parsed.hits || [];
  const skipped = parsed.skipped || [];
  const comments = parsed.comments || { sample: false };
  const agents = groupHits(hits);
  const site = discoverSite(hits, comments);
  return {
    hits,
    skipped,
    comments,
    format: parsed.format || "",
    agents,
    totals: totals(hits, skipped),
    timeline: timeline(hits),
    pages: pageComparison(hits),
    notFound: notFoundRows(hits),
    takeaways: hits.length ? takeaways(hits, agents) : [],
    robots: hits.length ? robotsDraft(agents) : "",
    llms: hits.length ? llmsDraft(hits, comments, site) : "",
    site,
    spoofing: SPOOFING_NOTE,
  };
}
