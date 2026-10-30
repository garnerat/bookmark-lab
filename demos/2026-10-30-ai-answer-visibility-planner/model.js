// Fictional sample for Linwood Comfort, a made-up Cincinnati HVAC shop.
// Google rank and the AI mention chance are separate. A fix moves one,
// the other, or both by different amounts. Mention counts are one
// binomial sample of RUNS prompts, seeded so a seed replays.

export const COMPANY = "Linwood Comfort";
export const RUNS = 20;
export const DEFAULT_SEED = 20261030;
export const GOOGLE_TOP = 10;
export const AI_BAR = 0.4;

export const CAUSES = [
  {
    id: "missing",
    label: "Missing page",
    blurb: "No page on the site answers this question.",
  },
  {
    id: "weak",
    label: "Weak page",
    blurb: "A page exists, and it does not answer the question.",
  },
  {
    id: "crawl",
    label: "Crawl or index problem",
    blurb: "The page answers it, and Google is not taking the page.",
  },
  {
    id: "third-party",
    label: "Third-party sources",
    blurb: "The answer is coming from sources you do not control.",
  },
];

export const CAUSE_SHORT = {
  missing: "Missing",
  weak: "Weak",
  crawl: "Crawl",
  "third-party": "Sources",
};

export const KINDS = [
  { id: "OWN", label: "Own", hint: "Pages you control" },
  { id: "CLAIM", label: "Claim", hint: "Profiles and listings you can take over" },
  { id: "EARN", label: "Earn", hint: "Reviews, editorial, and community mentions" },
  { id: "CONTEST", label: "Contest", hint: "Outdated or wrong information to correct" },
];

export const FIXES = [
  {
    id: "create-older-homes",
    title: "Publish an older-homes page",
    detail:
      "Nothing on the site answers this. A new page is a real gap, not a second article on a question you already cover.",
    createsPage: true,
    technical: false,
  },
  {
    id: "create-ductless",
    title: "Publish a ductless page",
    detail:
      "The site never mentions a house without ducts. Create the page because the gap is real.",
    createsPage: true,
    technical: false,
  },
  {
    id: "rewrite-repair",
    title: "Rewrite the furnace-age page",
    detail:
      "The page already ranks. It explains efficiency numbers and never says whether to repair or replace a 15-year-old furnace. Improve it. Do not publish a duplicate.",
    createsPage: false,
    technical: false,
  },
  {
    id: "rewrite-financing",
    title: "Rewrite the financing page",
    detail:
      "The page already ranks and only names a bank. Add a term, a sample monthly payment, and who qualifies. Do not start a second financing article.",
    createsPage: false,
    technical: false,
  },
  {
    id: "rewrite-safety",
    title: "Rewrite the carbon-monoxide page",
    detail:
      "Replace the pasted manufacturer checklist with what a visit checks on a twenty-year-old furnace in a Cincinnati house.",
    createsPage: false,
    technical: false,
  },
  {
    id: "rewrite-heat-pump",
    title: "Rewrite the heat-pump page",
    detail:
      "The page says the shop installs both. Add a Cincinnati winter comparison so the page actually answers the question.",
    createsPage: false,
    technical: false,
  },
  {
    id: "fix-maintenance-index",
    title: "Remove noindex from the tune-up plan",
    detail:
      "The plan page already answers the price question. A leftover staging flag blocks Google. Fix that page because a buyer question lands on it.",
    createsPage: false,
    technical: true,
  },
  {
    id: "fix-hyde-links",
    title: "Link the Hyde Park page and add it to the sitemap",
    detail:
      "The page answers same-day repair. Nothing links to it, and the sitemap omits it. This technical fix is in the loop because the prompt is a real buyer question.",
    createsPage: false,
    technical: true,
  },
  {
    id: "correct-directory",
    title: "Correct the Queen City Trades listing",
    detail:
      "The directory says the shop is permanently closed and still lists a 2019 phone number. Correct that. A new blog post will not outrank a source the answer already trusts.",
    createsPage: false,
    technical: false,
  },
  {
    id: "claim-gbp",
    title: "Claim the Google Business Profile",
    detail:
      "Hours, the east-side service area, and a real phone. This is a listing you can take over, not a new article.",
    createsPage: false,
    technical: false,
  },
  {
    id: "complete-angi",
    title: "Finish the Angi listing",
    detail:
      "Services, license number, and photos. The answer already cites this thin listing on a few of these prompts.",
    createsPage: false,
    technical: false,
  },
  {
    id: "claim-yelp",
    title: "Claim the Yelp listing",
    detail:
      "Two sample reviews and no photos. Take over the listing. It will not move Google rank.",
    createsPage: false,
    technical: false,
  },
  {
    id: "reply-reddit",
    title: "Answer the r/cincinnati thread",
    detail:
      "The thread is the same buyer questions already on this list: an older house, a dead furnace at night, Hyde Park. A useful reply, not a pitch, and not a new page on your site.",
    createsPage: false,
    technical: false,
  },
  {
    id: "compress-images",
    title: "Compress the homepage photos",
    detail:
      "The homepage is heavy. None of these buyer questions land on it. Site-wide cleanup waits until a warning sits on a page a buyer actually asks about.",
    createsPage: false,
    technical: true,
  },
];

export const SOURCES = [
  {
    id: "older-page",
    kind: "OWN",
    name: "Older-homes guide",
    url: "linwoodcomfort.example/guides/older-homes",
    fixId: "create-older-homes",
    idle: "Not published. No URL answers older Cincinnati houses.",
    done: "Published. It covers plaster walls, old ducts, and houses built before 1940.",
  },
  {
    id: "ductless-page",
    kind: "OWN",
    name: "Ductless guide",
    url: "linwoodcomfort.example/guides/ductless-brick",
    fixId: "create-ductless",
    idle: "Not published. The site never mentions a house without ducts.",
    done: "Published. It answers brick houses that were built without ductwork.",
  },
  {
    id: "furnace-page",
    kind: "OWN",
    name: "Furnace-age guide",
    url: "linwoodcomfort.example/guides/furnace-age",
    fixId: "rewrite-repair",
    idle: "Published and ranking. It explains AFUE numbers and skips the 15-year decision.",
    done: "Rewritten to answer repair versus replace for a 15-year-old furnace.",
  },
  {
    id: "financing-page",
    kind: "OWN",
    name: "Financing guide",
    url: "linwoodcomfort.example/guides/financing",
    fixId: "rewrite-financing",
    idle: "Published and ranking. It names a bank and shows no payment.",
    done: "Rewritten with a term, a sample monthly payment, and who qualifies.",
  },
  {
    id: "co-page",
    kind: "OWN",
    name: "Carbon-monoxide guide",
    url: "linwoodcomfort.example/guides/carbon-monoxide",
    fixId: "rewrite-safety",
    idle: "Published. It is a manufacturer checklist pasted onto the site.",
    done: "Rewritten for a twenty-year-old furnace in a Cincinnati house.",
  },
  {
    id: "heat-page",
    kind: "OWN",
    name: "Heat-pump guide",
    url: "linwoodcomfort.example/guides/heat-pump-or-gas",
    fixId: "rewrite-heat-pump",
    idle: "Published. It says the shop installs both and never chooses.",
    done: "Rewritten with a Cincinnati winter comparison.",
  },
  {
    id: "plan-page",
    kind: "OWN",
    name: "Tune-up plan",
    url: "linwoodcomfort.example/plans/tune-up",
    fixId: "fix-maintenance-index",
    idle: "Answers the price question, then a staging flag left noindex on it.",
    done: "noindex removed. Google can take the page.",
  },
  {
    id: "hyde-page",
    kind: "OWN",
    name: "Hyde Park service page",
    url: "linwoodcomfort.example/areas/hyde-park",
    fixId: "fix-hyde-links",
    idle: "Answers same-day repair. Nothing links to it, and the sitemap omits it.",
    done: "Linked from the footer and listed in the sitemap.",
  },
  {
    id: "emergency-page",
    kind: "OWN",
    name: "Emergency service page",
    url: "linwoodcomfort.example/services/emergency",
    fixId: null,
    idle: "Ranks for the night-call query. The answer still prefers a directory that says you are closed.",
    done: "",
    when: [
      {
        fixId: "correct-directory",
        status: "Ranks for the night-call query. The directory no longer says the shop is closed.",
      },
    ],
  },
  {
    id: "seasonal-page",
    kind: "OWN",
    name: "When to book a tune-up",
    url: "linwoodcomfort.example/guides/when-to-tune-up",
    fixId: null,
    idle: "Answers the timing question directly. Leave it alone.",
    done: "",
  },
  {
    id: "gbp",
    kind: "CLAIM",
    name: "Google Business Profile",
    url: "Sample listing · east side",
    fixId: "claim-gbp",
    idle: "Unclaimed. Hours and the service area are blank.",
    done: "Claimed. Hours, east-side area, and phone are filled in.",
  },
  {
    id: "angi",
    kind: "CLAIM",
    name: "Angi listing",
    url: "Sample listing",
    fixId: "complete-angi",
    idle: "Thin. Services and the license number are empty.",
    done: "Services, license number, and photos are filled in.",
  },
  {
    id: "yelp",
    kind: "CLAIM",
    name: "Yelp listing",
    url: "Sample listing · 2 reviews",
    fixId: "claim-yelp",
    idle: "Unclaimed. Two sample reviews and no photos.",
    done: "Claimed, with photos and a current phone number.",
  },
  {
    id: "reddit",
    kind: "EARN",
    name: "r/cincinnati thread",
    url: "Furnace died in our 1920 bungalow. Who do you use?",
    fixId: "reply-reddit",
    idle: "The thread is the buyer question. The shop has not answered.",
    done: "A useful reply is in the thread. Not a pitch, and not a new page.",
  },
  {
    id: "enquirer",
    kind: "EARN",
    name: "East Side Home Guide",
    url: "Sample roundup · three other shops",
    fixId: null,
    idle: "Editorial roundup. It names other companies. You cannot edit it.",
    done: "",
  },
  {
    id: "newsletter",
    kind: "EARN",
    name: "Hyde Park block newsletter",
    url: "Sample neighbor note",
    fixId: null,
    idle: "A neighbor mentioned a different shop. You cannot edit the note.",
    done: "",
  },
  {
    id: "fire-dept",
    kind: "EARN",
    name: "City fire-safety page",
    url: "Sample public safety page",
    fixId: null,
    idle: "Safety steps, and no local company. You cannot edit it.",
    done: "",
  },
  {
    id: "pamphlet",
    kind: "EARN",
    name: "Efficiency pamphlet",
    url: "Sample generic handout",
    fixId: null,
    idle: "Generic advice, no Cincinnati winter, no local company.",
    done: "",
  },
  {
    id: "directory",
    kind: "CONTEST",
    name: "Queen City Trades Directory",
    url: "Sample listing · says permanently closed",
    fixId: "correct-directory",
    idle: "Says permanently closed, with a 2019 phone number: (513) 555-0148.",
    done: "Corrected. Open for night calls, with the current phone number.",
  },
];

export const QUESTIONS = [
  {
    id: "older-homes",
    decision: "Best HVAC company for an older Cincinnati home",
    short: "older houses",
    keyword: "hvac company older homes cincinnati",
    prompt:
      "Which HVAC company is a good fit for a 1920s house in Cincinnati with plaster walls and old ducts?",
    cause: "missing",
    why: "No page talks about older houses, plaster, or ducts that were never sized for a modern furnace. The simulated answer quotes a local roundup, the Reddit thread, and Angi.",
    fixId: "create-older-homes",
    pageId: "older-page",
    rank: null,
    rate: 0.06,
    sources: ["enquirer", "reddit", "angi"],
    effects: {
      "create-older-homes": { rankTo: 8, rateAdd: 0.18, addSources: ["older-page"] },
      "reply-reddit": { rateAdd: 0.28 },
      "complete-angi": { rateAdd: 0.08 },
    },
  },
  {
    id: "ductless",
    decision: "Ductless mini-split for a brick house with no ducts",
    short: "ductless",
    keyword: "ductless mini split cincinnati brick house",
    prompt:
      "Can a ductless mini-split heat and cool a Cincinnati brick house that was built without ducts?",
    cause: "missing",
    why: "The site never mentions ductless equipment. The simulated answer quotes a generic efficiency pamphlet.",
    fixId: "create-ductless",
    pageId: "ductless-page",
    rank: null,
    rate: 0.02,
    sources: ["pamphlet"],
    effects: {
      "create-ductless": { rankTo: 9, rateAdd: 0.15, addSources: ["ductless-page"] },
    },
  },
  {
    id: "repair-replace",
    decision: "Repair or replace a 15-year-old furnace",
    short: "repair or replace",
    keyword: "repair or replace 15 year old furnace",
    prompt:
      "Should I repair or replace a 15-year-old furnace in a Cincinnati bungalow, or keep patching it?",
    cause: "weak",
    why: "The furnace-age guide already ranks. It explains efficiency numbers and never says what to do with a 15-year-old unit, so the simulated answer barely uses it and still quotes the outdated directory.",
    fixId: "rewrite-repair",
    pageId: "furnace-page",
    rank: 7,
    rate: 0.1,
    sources: ["furnace-page", "directory"],
    effects: {
      "rewrite-repair": { rankTo: 5, rateAdd: 0.52 },
      "correct-directory": { rateAdd: 0.04, dropSources: ["directory"] },
    },
  },
  {
    id: "financing",
    decision: "Financing a furnace replacement",
    short: "financing",
    keyword: "furnace replacement financing cincinnati",
    prompt:
      "What financing do Cincinnati HVAC companies offer when a furnace replacement costs a few thousand dollars?",
    cause: "weak",
    why: "The financing page ranks and names a bank. It has no monthly payment, no term, and no note on who qualifies.",
    fixId: "rewrite-financing",
    pageId: "financing-page",
    rank: 8,
    rate: 0.12,
    sources: ["financing-page", "angi"],
    effects: {
      "rewrite-financing": { rankTo: 6, rateAdd: 0.46 },
      "complete-angi": { rateAdd: 0.06 },
    },
  },
  {
    id: "co-safety",
    decision: "Carbon monoxide worries with an old furnace",
    short: "carbon monoxide",
    keyword: "old furnace carbon monoxide cincinnati",
    prompt:
      "My furnace is about twenty years old. What should I ask a Cincinnati company to check for carbon monoxide?",
    cause: "weak",
    why: "The safety page is a pasted checklist. It never mentions a twenty-year-old furnace or what the visit includes, so the simulated answer quotes a city fire-safety page instead.",
    fixId: "rewrite-safety",
    pageId: "co-page",
    rank: 17,
    rate: 0.05,
    sources: ["fire-dept", "co-page"],
    effects: {
      "rewrite-safety": { rankTo: 11, rateAdd: 0.44 },
    },
  },
  {
    id: "heat-pump",
    decision: "Heat pump or gas furnace in a Cincinnati winter",
    short: "heat pump",
    keyword: "heat pump or gas furnace cincinnati",
    prompt: "In a Cincinnati winter, should I replace a gas furnace with a heat pump or keep gas?",
    cause: "weak",
    why: "The page says the shop installs both. No winter temperature and no bill comparison, so the simulated answer quotes a generic pamphlet.",
    fixId: "rewrite-heat-pump",
    pageId: "heat-page",
    rank: 15,
    rate: 0.08,
    sources: ["heat-page", "pamphlet"],
    effects: {
      "rewrite-heat-pump": { rankTo: 13, rateAdd: 0.42 },
    },
  },
  {
    id: "maintenance",
    decision: "What a Cincinnati tune-up plan should cost",
    short: "tune-up plan",
    keyword: "furnace maintenance plan cost cincinnati",
    prompt: "What should a yearly furnace tune-up plan cost in Cincinnati, and is it worth it?",
    cause: "crawl",
    why: "The plan page answers the price. A staging flag left noindex on it, so Google never ranked it. The simulated answer cites Angi and the unclaimed profile.",
    fixId: "fix-maintenance-index",
    pageId: "plan-page",
    rank: null,
    rate: 0.12,
    sources: ["angi", "gbp"],
    effects: {
      "fix-maintenance-index": { rankTo: 4, rateAdd: 0.04, addSources: ["plan-page"] },
    },
  },
  {
    id: "hyde-park",
    decision: "Same-day AC repair in Hyde Park",
    short: "Hyde Park",
    keyword: "same day ac repair hyde park cincinnati",
    prompt: "Who can do same-day AC repair in Hyde Park, Cincinnati, on a weekday?",
    cause: "crawl",
    why: "The Hyde Park page answers this, nothing links to it, and the sitemap omits it. The simulated answer uses a block newsletter, Reddit, and Angi.",
    fixId: "fix-hyde-links",
    pageId: "hyde-page",
    rank: null,
    rate: 0.2,
    sources: ["newsletter", "reddit", "angi"],
    effects: {
      "fix-hyde-links": { rankTo: 5, rateAdd: 0.05, addSources: ["hyde-page"] },
      "reply-reddit": { rateAdd: 0.22 },
      "complete-angi": { rateAdd: 0.04 },
    },
  },
  {
    id: "emergency",
    decision: "Who can come tonight if the furnace dies",
    short: "night calls",
    keyword: "emergency furnace repair cincinnati",
    prompt: "My furnace died tonight in Cincinnati and it is below freezing. Who can actually come out?",
    cause: "third-party",
    why: "The emergency page already ranks. The simulated answer still quotes Queen City Trades, which says the shop is permanently closed, plus the unanswered Reddit thread.",
    fixId: "correct-directory",
    pageId: "emergency-page",
    rank: 4,
    rate: 0.1,
    sources: ["directory", "reddit", "gbp"],
    effects: {
      "correct-directory": { rateAdd: 0.48, dropSources: ["directory"], addSources: ["emergency-page"] },
      "claim-gbp": { rankTo: 3, rateAdd: 0.04 },
      "reply-reddit": { rateAdd: 0.18 },
    },
  },
  {
    id: "east-side",
    decision: "A reliable company on the east side",
    short: "east side",
    keyword: "hvac company cincinnati east side",
    prompt: "Who is a reliable HVAC company on the east side of Cincinnati for a furnace replacement?",
    cause: "third-party",
    why: "A general service page is not what this prompt is losing to. The Google Business Profile is unclaimed, and the simulated answer cites Angi, Yelp, and a roundup of other shops.",
    fixId: "claim-gbp",
    pageId: null,
    rank: 14,
    rate: 0.16,
    sources: ["angi", "enquirer", "yelp", "gbp"],
    effects: {
      "claim-gbp": { rankTo: 6, rateAdd: 0.05 },
      "complete-angi": { rateAdd: 0.2 },
      "claim-yelp": { rateAdd: 0.08 },
    },
  },
  {
    id: "reddit-recs",
    decision: "What Cincinnati Reddit recommends this year",
    short: "Reddit recommendations",
    keyword: "cincinnati hvac recommendation reddit",
    prompt: "What are people on Cincinnati Reddit recommending for a furnace replacement this year?",
    cause: "third-party",
    why: "The r/cincinnati thread is the whole answer. The shop is not in it. A new page on your site is not what this prompt cites.",
    fixId: "reply-reddit",
    pageId: null,
    rank: 24,
    rate: 0.04,
    sources: ["reddit"],
    effects: {
      "reply-reddit": { rateAdd: 0.58 },
    },
  },
  {
    id: "tune-up-when",
    decision: "When to book the tune-up",
    short: "when to book",
    keyword: "when to schedule furnace tune up cincinnati",
    prompt:
      "When should I book a furnace tune-up in Cincinnati so I am not waiting through the first cold week?",
    cause: null,
    why: "The seasonal page answers this, and the simulated answer cites it. Leave it alone.",
    fixId: null,
    pageId: "seasonal-page",
    rank: 3,
    rate: 0.74,
    sources: ["seasonal-page"],
    effects: {},
  },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mixSeed(seed, draw, id) {
  let h = (seed >>> 0) ^ Math.imul(draw + 1, 0x9e3779b1);
  for (let i = 0; i < id.length; i += 1) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  }
  return (h >>> 0) || 1;
}

export function sampleMentions(rate, seed, draw, id) {
  const rng = mulberry32(mixSeed(seed, draw, id));
  let n = 0;
  for (let i = 0; i < RUNS; i += 1) {
    if (rng() < rate) n += 1;
  }
  return n;
}

export function googleScore(rank) {
  if (rank == null || rank > 30) return 0;
  return Math.max(0, Math.round(100 - (rank - 1) * 5));
}

export function formatPct(rate) {
  return `${Math.round(rate * 100)}%`;
}

export function fixById(id) {
  return FIXES.find((fix) => fix.id === id) || null;
}

export function createState(seed = DEFAULT_SEED) {
  const n = Number(seed);
  if (!Number.isInteger(n) || n < 1 || n > 999999999) {
    throw new Error("Seed must be an integer from 1 to 999999999");
  }
  return { seed: n, draw: 0, applied: [] };
}

export function applyFix(state, fixId) {
  if (!fixById(fixId)) throw new Error(`Unknown fix: ${fixId}`);
  if (state.applied.includes(fixId)) return state;
  return { seed: state.seed, draw: state.draw + 1, applied: state.applied.concat(fixId) };
}

export function rerun(state) {
  return { seed: state.seed, draw: state.draw + 1, applied: state.applied.slice() };
}

function clampRate(rate) {
  return Math.min(0.95, Math.max(0, Math.round(rate * 1000) / 1000));
}

function projectQuestion(question, applied) {
  let rank = question.rank;
  let rate = question.rate;
  let sources = question.sources.slice();
  for (const fixId of applied) {
    const effect = question.effects[fixId];
    if (!effect) continue;
    if (effect.rankTo != null) rank = rank == null ? effect.rankTo : Math.min(rank, effect.rankTo);
    if (effect.rateAdd) rate += effect.rateAdd;
    if (effect.dropSources) sources = sources.filter((id) => !effect.dropSources.includes(id));
    if (effect.addSources) {
      for (const id of effect.addSources) {
        if (!sources.includes(id)) sources.push(id);
      }
    }
  }
  return { rank, rate: clampRate(rate), sources };
}

function sourceView(source, applied) {
  const done = Boolean(source.fixId && applied.includes(source.fixId));
  const override = (source.when || []).find((item) => applied.includes(item.fixId));
  return {
    id: source.id,
    kind: source.kind,
    name: source.name,
    url: source.url,
    fixId: source.fixId,
    done,
    actionable: Boolean(source.fixId) && !done,
    status: done ? source.done : override ? override.status : source.idle,
  };
}

export function measure(state) {
  const applied = state.applied;
  const questions = QUESTIONS.map((question) => {
    const projected = projectQuestion(question, applied);
    const mentions = sampleMentions(projected.rate, state.seed, state.draw, question.id);
    const fixApplied = Boolean(question.fixId && applied.includes(question.fixId));
    return {
      id: question.id,
      decision: question.decision,
      short: question.short,
      keyword: question.keyword,
      prompt: question.prompt,
      cause: question.cause,
      why: question.why,
      fixId: question.fixId,
      fixApplied,
      open: Boolean(question.fixId) && !fixApplied,
      pageId: question.pageId,
      rank: projected.rank,
      rate: projected.rate,
      mentions,
      score: googleScore(projected.rank),
      googleIn: projected.rank != null && projected.rank <= GOOGLE_TOP,
      aiIn: projected.rate >= AI_BAR,
      cited: projected.sources.map((id) => sourceView(sourceById(id), applied)),
    };
  });
  const googleTop10 = questions.filter((question) => question.googleIn).length;
  const aiTrue = questions.reduce((sum, question) => sum + question.rate, 0) / questions.length;
  const aiSample =
    questions.reduce((sum, question) => sum + question.mentions, 0) / (questions.length * RUNS);
  return {
    questions,
    sources: SOURCES.map((source) => sourceView(source, applied)),
    summary: {
      total: questions.length,
      googleTop10,
      aiTrue,
      aiSample,
      open: questions.filter((question) => question.open).length,
    },
  };
}

function sourceById(id) {
  const source = SOURCES.find((item) => item.id === id);
  if (!source) throw new Error(`Missing source ${id}`);
  return source;
}

export function questionById(snap, id) {
  return snap.questions.find((question) => question.id === id);
}

export function sourceIdsForQuestion(question) {
  const ids = new Set(question.cited.map((source) => source.id));
  if (question.pageId) ids.add(question.pageId);
  return ids;
}

export function affectedIds(fixId) {
  return QUESTIONS.filter((question) => question.effects[fixId]).map((question) => question.id);
}

function rankText(rank) {
  return rank == null ? "not ranking" : `rank ${rank}`;
}

function googleStory(before, after) {
  if (before.rank === after.rank) return "flat";
  if (!before.googleIn && after.googleIn) return "entered";
  if (before.googleIn && !after.googleIn) return "left";
  const bothKnown = before.rank != null && after.rank != null;
  if (bothKnown && Math.abs(before.rank - after.rank) <= 3 && before.googleIn === after.googleIn) {
    return "nudge";
  }
  return "moved";
}

function aiStory(before, after) {
  if (after.rate - before.rate < 0.08) return "flat";
  if (!before.aiIn && after.aiIn) return "crossed";
  return "moved";
}

function sampleBit(before, after) {
  if (before.mentions === after.mentions) return ` This sample named you ${after.mentions} of ${RUNS}.`;
  return ` This sample named you ${after.mentions} of ${RUNS} (the one before named you ${before.mentions}).`;
}

export function describeQuestion(before, after) {
  const name = before.decision;
  const g = googleStory(before, after);
  const a = aiStory(before, after);
  const fromR = rankText(before.rank);
  const toR = rankText(after.rank);
  const fromA = formatPct(before.rate);
  const toA = formatPct(after.rate);
  if (g === "flat" && a === "flat") {
    return `${name}: still ${fromR}. The AI chance stayed ${fromA}.${sampleBit(before, after)}`;
  }
  if ((g === "entered" || g === "ranked") && a === "flat") {
    return `${name}: Google went from ${fromR} to ${toR}. The AI chance stayed near ${fromA}. Google moved, and the AI mention barely did.`;
  }
  if (g === "flat" && (a === "moved" || a === "crossed")) {
    return `${name}: Google stayed ${fromR}. The AI chance went from ${fromA} to ${toA}. AI moved, and Google rank did not.`;
  }
  if (g === "nudge" && (a === "moved" || a === "crossed")) {
    return `${name}: Google only stepped from ${fromR} to ${toR}. The AI chance went from ${fromA} to ${toA}. The two scores did not move together.`;
  }
  if (g === "nudge" && a === "flat") {
    return `${name}: Google stepped from ${fromR} to ${toR}. The AI chance stayed near ${fromA}.`;
  }
  const stillOut = after.googleIn ? "" : " Google is still outside the top 10.";
  const stillUnder = after.aiIn ? "" : " The AI chance is still under 40%, so other sources still carry the answer.";
  return `${name}: Google went from ${fromR} to ${toR}. The AI chance went from ${fromA} to ${toA}.${stillOut}${stillUnder} They did not move by the same amount.`;
}

function portfolioClause(before, after) {
  const g0 = before.summary.googleTop10;
  const g1 = after.summary.googleTop10;
  const total = before.summary.total;
  const p0 = formatPct(before.summary.aiTrue);
  const p1 = formatPct(after.summary.aiTrue);
  const gPart =
    g0 === g1
      ? `Google's top 10 stayed at ${g1} of ${total}`
      : `Google's top 10 went from ${g0} to ${g1} of ${total}`;
  const aPart = p0 === p1 ? `the average AI mention stayed about ${p1}` : `the average AI mention went from ${p0} to ${p1}`;
  return `${gPart}, and ${aPart}.`;
}

export function describeMove(before, after, fixId, focusId) {
  if (!fixId) {
    return `${describeQuestion(questionById(before, focusId), questionById(after, focusId))} The chances did not change. Google ranks stay. The AI count is a new sample of 20.`;
  }
  const fix = fixById(fixId);
  if (!affectedIds(fixId).length) {
    return `${fix.title} does not touch a buyer question. Google and AI both stayed put.`;
  }
  const affected = QUESTIONS.find((question) => question.id === focusId)?.effects?.[fixId];
  if (!affected) return `${fix.title} does not touch this question. ${portfolioClause(before, after)}`;
  return `${describeQuestion(questionById(before, focusId), questionById(after, focusId))} ${portfolioClause(before, after)}`;
}

export function axes(before, after) {
  return {
    google: after.summary.googleTop10 !== before.summary.googleTop10,
    ai: after.summary.aiTrue - before.summary.aiTrue >= 0.02,
  };
}

export function doubleDown(prev, curr) {
  if (!prev || !curr) return "";
  if (prev.ai && !prev.google && curr.ai && !curr.google) {
    return "Same pattern as the last change: AI moved, Google did not. Double down on that.";
  }
  if (prev.google && !prev.ai && curr.google && !curr.ai) {
    return "Same pattern as the last change: Google moved, AI did not. Double down on that.";
  }
  return "";
}

export function validate() {
  const fixIds = new Set(FIXES.map((fix) => fix.id));
  const sourceIds = new Set(SOURCES.map((source) => source.id));
  const kinds = new Set(KINDS.map((kind) => kind.id));
  const causeIds = new Set(CAUSES.map((cause) => cause.id));
  if (QUESTIONS.length < 10 || QUESTIONS.length > 12) {
    throw new Error(`Expected 10 to 12 questions, got ${QUESTIONS.length}`);
  }
  for (const source of SOURCES) {
    if (!kinds.has(source.kind)) throw new Error(`Bad kind on ${source.id}`);
    if (source.fixId && !fixIds.has(source.fixId)) throw new Error(`Bad fix on ${source.id}`);
  }
  for (const question of QUESTIONS) {
    if (!question.keyword || !question.prompt) throw new Error(`Blank prompt on ${question.id}`);
    if (question.cause != null && !causeIds.has(question.cause)) {
      throw new Error(`Bad cause on ${question.id}`);
    }
    if (question.fixId && !fixIds.has(question.fixId)) throw new Error(`Bad fix on ${question.id}`);
    if (question.pageId && !sourceIds.has(question.pageId)) {
      throw new Error(`Bad page on ${question.id}`);
    }
    for (const sourceId of question.sources) {
      if (!sourceIds.has(sourceId)) throw new Error(`Bad cite ${sourceId} on ${question.id}`);
    }
    for (const [fixId, effect] of Object.entries(question.effects)) {
      if (!fixIds.has(fixId)) throw new Error(`Bad effect ${fixId} on ${question.id}`);
      for (const sourceId of [...(effect.addSources || []), ...(effect.dropSources || [])]) {
        if (!sourceIds.has(sourceId)) throw new Error(`Bad effect source ${sourceId}`);
      }
    }
    if (question.cause === "weak" || question.cause === "crawl") {
      const fix = fixById(question.fixId);
      if (!fix || fix.createsPage) throw new Error(`${question.id} should improve, not create`);
    }
    if (question.cause === "missing") {
      const fix = fixById(question.fixId);
      if (!fix?.createsPage) throw new Error(`${question.id} is a real gap and needs a page`);
    }
    if (question.cause == null && question.fixId) throw new Error(`${question.id} is won and has a fix`);
  }
  const keywords = new Set(QUESTIONS.map((question) => question.keyword));
  if (keywords.size !== QUESTIONS.length) throw new Error("Duplicate keywords");
}

export function seriesFor(history, questionId) {
  return history.map((step) => {
    const question = questionById(step.snap, questionId);
    return {
      label: step.label,
      google: question.score,
      ai: Math.round((question.mentions / RUNS) * 100),
      rank: question.rank,
      mentions: question.mentions,
    };
  });
}
