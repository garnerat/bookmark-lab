// Fictional board for Linwood Comfort, a made-up Cincinnati HVAC shop.
// Crew names are dispatcher codes, not people. No household names, streets, or phone numbers.

export const SHOP = "Linwood Comfort";
export const MONTH = "2026-10";
export const MONTH_LABEL = "October 2026";
export const PAGE_SIZE = 12;
export const JOB_COUNT = 48;
export const CREWS = ["Oak", "Maple", "Birch", "Cedar"];

const ZONES = ["Zone East", "Zone North", "Zone River", "Zone Hill"];

const PARTS = [
  { sku: "CAP-45", name: "Run capacitor", cents: 1840 },
  { sku: "CNT-12", name: "Contactor", cents: 4260 },
  { sku: "FLT-20", name: "Filter kit", cents: 960 },
  { sku: "BLW-7", name: "Blower motor", cents: 14800 },
  { sku: "THR-3", name: "Thermostat", cents: 6400 },
  { sku: "BRD-9", name: "Control board", cents: 11250 },
  { sku: "DRS-2", name: "Drain sensor", cents: 2100 },
  { sku: "COL-1", name: "Coil cleaner", cents: 740 },
];

function buildJobs() {
  const jobs = [];
  for (let i = 0; i < JOB_COUNT; i++) {
    const warrantyOctober = i % 3 === 0;
    const crew = CREWS[i % 4];
    const zone = ZONES[i % 4];
    let status;
    let tags;
    let completed_on;
    let summary;
    if (warrantyOctober) {
      status = "completed";
      tags = ["warranty", i % 2 === 0 ? "no-cool" : "no-heat"];
      completed_on = `${MONTH}-${String((i % 27) + 1).padStart(2, "0")}`;
      summary = tags[1] === "no-cool"
        ? "Return visit, cooling short cycle"
        : "Return visit, heat would not start";
    } else if (i % 5 === 1) {
      status = "scheduled";
      tags = ["maintenance"];
      completed_on = null;
      summary = "Seasonal check still on the board";
    } else if (i % 5 === 2) {
      status = "completed";
      tags = ["repair"];
      completed_on = `2026-09-${String((i % 27) + 1).padStart(2, "0")}`;
      summary = "Repair closed in September";
    } else if (i % 7 === 0) {
      status = "completed";
      tags = ["warranty"];
      completed_on = `2026-09-${String((i % 20) + 1).padStart(2, "0")}`;
      summary = "Warranty visit from September";
    } else if (i % 5 === 4) {
      status = "cancelled";
      tags = ["emergency"];
      completed_on = null;
      summary = "Cancelled before the truck rolled";
    } else {
      status = "completed";
      tags = ["maintenance"];
      completed_on = `${MONTH}-${String((i % 27) + 1).padStart(2, "0")}`;
      summary = "October maintenance, not a warranty tag";
    }
    const callbacks = (i * 3 + 1) % 5;
    const partA = PARTS[i % PARTS.length];
    const partB = PARTS[(i + 3) % PARTS.length];
    const parts = [
      { sku: partA.sku, name: partA.name, qty: 1, cents: partA.cents },
      { sku: partB.sku, name: partB.name, qty: 1 + (i % 2), cents: partB.cents },
    ];
    if (i % 4 === 0) {
      const partC = PARTS[(i + 5) % PARTS.length];
      parts.push({ sku: partC.sku, name: partC.name, qty: 1, cents: partC.cents });
    }
    const tag = tags[0];
    const notes = [
      `Crew ${crew} closed a ${tag} job in ${zone}.`,
      summary + ".",
      "The unit ran through a short observation after the parts were in.",
      "The sample record stores no household name.",
      `Callbacks logged before this close: ${callbacks}.`,
    ].join(" ");
    jobs.push({
      id: `J-${2401 + i}`,
      status,
      tags,
      completed_on,
      crew,
      zone,
      summary,
      callbacks,
      parts,
      notes,
      labor_minutes: 45 + (i % 8) * 15,
      truck: `Van ${(i % 4) + 1}`,
    });
  }
  return jobs;
}

let cached;
export function allJobs() {
  if (!cached) cached = buildJobs();
  return cached;
}

export function isMatch(job) {
  return job.status === "completed"
    && job.tags.includes("warranty")
    && typeof job.completed_on === "string"
    && job.completed_on.startsWith(MONTH);
}

export function matchedJobs() {
  return allJobs().filter(isMatch);
}

export function pageCount() {
  return Math.ceil(allJobs().length / PAGE_SIZE);
}

export function summarize(job) {
  return {
    id: job.id,
    status: job.status,
    tags: job.tags,
    completed_on: job.completed_on,
    crew: job.crew,
    zone: job.zone,
    summary: job.summary,
  };
}

export function detailOf(job) {
  return {
    id: job.id,
    status: job.status,
    tags: job.tags,
    completed_on: job.completed_on,
    crew: job.crew,
    zone: job.zone,
    summary: job.summary,
    callbacks: job.callbacks,
    labor_minutes: job.labor_minutes,
    truck: job.truck,
    parts: job.parts,
    notes: job.notes,
  };
}

export function listJobs(page) {
  const jobs = allJobs();
  const start = (page - 1) * PAGE_SIZE;
  const slice = start < 0 || start >= jobs.length ? [] : jobs.slice(start, start + PAGE_SIZE);
  return {
    page,
    page_size: PAGE_SIZE,
    total: jobs.length,
    jobs: slice.map(summarize),
  };
}

export function getJob(id) {
  const job = allJobs().find((item) => item.id === id);
  if (!job) return null;
  return detailOf(job);
}
