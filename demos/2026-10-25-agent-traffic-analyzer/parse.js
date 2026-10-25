import { classifyUa } from "./signatures.js";

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Combined: host ident user [time] "request" status bytes "referer" "ua"
const COMBINED =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+"([^"]*)"\s+(\S+)\s+(\S+)\s+"([^"]*)"\s+"([^"]*)"(?:\s.*)?$/;

// Common Log Format, without referer and user agent.
const CLF =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+"([^"]*)"\s+(\S+)\s+(\S+)\s*$/;

const HEADER_ALIASES = {
  user_agent: "ua",
  "user-agent": "ua",
  useragent: "ua",
  ua: "ua",
  agent: "ua",
  path: "path",
  url: "path",
  uri: "path",
  request: "path",
  request_path: "path",
  timestamp: "time",
  time: "time",
  date: "time",
  datetime: "time",
  ts: "time",
  status: "status",
  status_code: "status",
  code: "status",
  ip: "ip",
  remote_addr: "ip",
  host: "ip",
  referrer: "referrer",
  referer: "referrer",
  bytes: "bytes",
  size: "bytes",
  body_bytes_sent: "bytes",
};

const PAGE_TESTS = [
  { id: "robots", label: "robots.txt", test: (p) => /\/robots\.txt$/i.test(p) },
  { id: "sitemap", label: "Sitemap", test: (p) => /sitemap[^/]*\.xml$/i.test(p) },
  { id: "llms", label: "llms.txt", test: (p) => /\/llms\.txt$/i.test(p) },
  { id: "asset", label: "Files", test: (p) => /\.(css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|map|avif)$/i.test(p) },
  { id: "pricing", label: "Pricing", test: (p) => /\/(pricing|prices|rates|cost)(?:\/|$)/i.test(p) },
  { id: "contact", label: "Contact", test: (p) => /\/(contact|quote|book|schedule|appointment)(?:\/|$)/i.test(p) },
  { id: "areas", label: "Service areas", test: (p) => /\/(service-areas?|locations?)(?:\/|$)/i.test(p) },
  { id: "services", label: "Services", test: (p) => /\/services?(?:\/|$)/i.test(p) },
  { id: "blog", label: "Blog", test: (p) => /\/(blog|news|articles?|posts?)(?:\/|$)/i.test(p) },
  { id: "about", label: "About", test: (p) => /\/(about|team|company)(?:\/|$)/i.test(p) },
  { id: "home", label: "Home", test: (p) => p === "/" || p === "/index.html" || p === "/index.php" },
];

export function pageType(path) {
  const value = path || "/";
  for (const entry of PAGE_TESTS) {
    if (entry.test(value)) return { id: entry.id, label: entry.label };
  }
  return { id: "other", label: "Other" };
}

export function parseApacheTime(value) {
  const match = /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})(?:\s+([+-])(\d{2})(\d{2}))?$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (month == null) return null;
  const day = Number(match[1]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 0 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  let offsetMin = 0;
  if (match[7]) {
    const sign = match[7] === "-" ? -1 : 1;
    offsetMin = sign * (Number(match[8]) * 60 + Number(match[9]));
  }
  const utc = Date.UTC(year, month, day, hour, minute, second) - offsetMin * 60000;
  if (Number.isNaN(utc)) return null;
  return {
    ms: utc,
    dayKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    hour,
    labelDay: `${match[2].slice(0, 1).toUpperCase()}${match[2].slice(1, 3).toLowerCase()} ${day}`,
  };
}

export function parseFlexibleTime(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === "-") return null;
  const apache = parseApacheTime(text);
  if (apache) return apache;
  let iso = text.includes("T") ? text : text.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso += "T00:00:00Z";
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(iso)) iso += "Z";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const clock = new Date(ms);
  // Prefer the clock written in the string when it has no zone, which we treat as UTC.
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  let dayKey;
  let hour;
  let labelDay;
  if (!zoned) {
    dayKey = iso.slice(0, 10);
    hour = Number(iso.slice(11, 13)) || 0;
    labelDay = labelFromKey(dayKey);
  } else if (/[+-]\d{2}:?\d{2}$/.test(text.replace(" ", "T"))) {
    const local = text.replace(" ", "T");
    const datePart = local.slice(0, 10);
    hour = Number(local.slice(11, 13));
    dayKey = datePart;
    labelDay = labelFromKey(dayKey);
  } else {
    dayKey = clock.toISOString().slice(0, 10);
    hour = clock.getUTCHours();
    labelDay = labelFromKey(dayKey);
  }
  return { ms, dayKey, hour, labelDay };
}

function labelFromKey(dayKey) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [, m, d] = dayKey.split("-");
  return `${months[Number(m) - 1]} ${Number(d)}`;
}

function safeDecode(path) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export function splitTarget(raw) {
  if (raw == null) return null;
  let path = String(raw).trim();
  if (!path || path === "*" || path === "-") return null;
  let query = "";
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = url.pathname || "/";
      query = url.search || "";
    } catch {
      return null;
    }
  } else {
    const q = path.indexOf("?");
    if (q >= 0) {
      query = path.slice(q);
      path = path.slice(0, q);
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;
  path = safeDecode(path);
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return { path, query };
}

function parseRequest(request) {
  const match = /^([A-Za-z]+)\s+(\S+)(?:\s+\S+)?$/.exec(request.trim());
  if (!match) return null;
  const target = splitTarget(match[2]);
  if (!target) return null;
  return { method: match[1].toUpperCase(), ...target };
}

function statusOf(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (text === "-" || text === "") return null;
  if (!/^\d{3}$/.test(text)) return undefined;
  const code = Number(text);
  if (code < 100 || code > 599) return undefined;
  return code;
}

function bytesOf(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (text === "-" || text === "") return null;
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

function makeHit(fields) {
  const type = pageType(fields.path);
  return {
    ip: fields.ip || "",
    time: fields.time,
    timeMs: fields.time ? fields.time.ms : null,
    dayKey: fields.time ? fields.time.dayKey : "",
    hour: fields.time ? fields.time.hour : null,
    dayLabel: fields.time ? fields.time.labelDay : "",
    method: fields.method || "GET",
    path: fields.path,
    query: fields.query || "",
    status: fields.status,
    bytes: fields.bytes,
    referrer: fields.referrer || "",
    ua: fields.ua || "",
    agent: classifyUa(fields.ua || ""),
    pageType: type.id,
    pageLabel: type.label,
  };
}

function parseComment(line, comments) {
  const match = /^#\s*([a-z][a-z0-9_-]*)\s*:\s*(.+)$/i.exec(line.trim());
  if (!match) return;
  const key = match[1].toLowerCase();
  const value = match[2].trim();
  if (key === "sample") comments.sample = /^(yes|true|1)$/i.test(value);
  else comments[key] = value;
}

function looksLikeHeader(line) {
  if (!line.includes(",")) return false;
  const cells = parseCsvLine(line).map((cell) => cell.trim().toLowerCase());
  return cells.some((cell) => HEADER_ALIASES[cell] === "ua") && cells.some((cell) => HEADER_ALIASES[cell] === "path");
}

export function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else quoted = false;
      } else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

function columnMap(headerCells) {
  const map = {};
  headerCells.forEach((cell, index) => {
    const key = HEADER_ALIASES[cell.trim().toLowerCase()];
    if (key && map[key] == null) map[key] = index;
  });
  return map;
}

function hitFromCsv(cells, map) {
  const ua = cells[map.ua] != null ? cells[map.ua].trim() : "";
  const pathRaw = cells[map.path] != null ? cells[map.path].trim() : "";
  const target = splitTarget(pathRaw);
  if (!target) return { error: "missing path" };
  const timeRaw = map.time != null ? cells[map.time] : "";
  const status = map.status != null ? statusOf(cells[map.status]) : null;
  if (status === undefined) return { error: "bad status" };
  return {
    hit: makeHit({
      ip: map.ip != null ? (cells[map.ip] || "").trim() : "",
      time: parseFlexibleTime(timeRaw),
      method: "GET",
      path: target.path,
      query: target.query,
      status,
      bytes: map.bytes != null ? bytesOf(cells[map.bytes]) : null,
      referrer: map.referrer != null ? (cells[map.referrer] || "").trim() : "",
      ua,
    }),
  };
}

function parseCsv(lines) {
  const hits = [];
  const skipped = [];
  const header = looksLikeHeader(lines[0]);
  const map = header
    ? columnMap(parseCsvLine(lines[0]))
    : { ua: 0, path: 1, time: 2, status: 3, referrer: 4 };
  const start = header ? 1 : 0;
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    const cells = parseCsvLine(line);
    if (cells.length < 2 || cells.every((cell) => cell.trim() === "")) {
      skipped.push({ line: line.trim(), reason: "not a CSV row" });
      continue;
    }
    const parsed = hitFromCsv(cells, map);
    if (parsed.error) skipped.push({ line: line.trim(), reason: parsed.error });
    else hits.push(parsed.hit);
  }
  return { hits, skipped, format: "csv" };
}

function parseAccess(lines) {
  const hits = [];
  const skipped = [];
  for (const line of lines) {
    const combined = COMBINED.exec(line.trim());
    const clf = combined ? null : CLF.exec(line.trim());
    const match = combined || clf;
    if (!match) {
      skipped.push({ line: line.trim(), reason: "not a combined or common log line" });
      continue;
    }
    const status = statusOf(match[6]);
    if (status === undefined) {
      skipped.push({ line: line.trim(), reason: "status is not a 3-digit code" });
      continue;
    }
    const request = parseRequest(match[5]);
    if (!request) {
      skipped.push({ line: line.trim(), reason: "request line could not be read" });
      continue;
    }
    const time = parseApacheTime(match[4]);
    hits.push(
      makeHit({
        ip: match[1],
        time,
        method: request.method,
        path: request.path,
        query: request.query,
        status,
        bytes: bytesOf(match[7]),
        referrer: combined ? match[8] : "",
        ua: combined ? match[9] : "",
      }),
    );
  }
  return { hits, skipped, format: "combined" };
}

function isAccessLine(line) {
  const text = line.trim();
  return COMBINED.test(text) || CLF.test(text);
}

export function parseLog(text) {
  const comments = { sample: false };
  const body = [];
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      parseComment(trimmed, comments);
      continue;
    }
    body.push(line);
  }
  if (!body.length) {
    return { hits: [], skipped: [], comments, format: "empty" };
  }
  const accessCount = body.filter(isAccessLine).length;
  const csvHeader = looksLikeHeader(body[0]);
  const useCsv = csvHeader || (accessCount === 0 && body.some((line) => line.includes(",")));
  const parsed = useCsv ? parseCsv(body) : parseAccess(body);
  return { ...parsed, comments };
}
