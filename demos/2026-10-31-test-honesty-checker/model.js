// Quote calculator, weak tests, and an in-page CRAP / mutation check.
// Scores come from tokenizing and running this module, not from a table.

export const COMPANY = "Linwood Comfort";
export const CRAP_GATE = 10;

export const MODULE = dedent(`
  // Linwood Comfort service quotes.
  // Fictional shop. The agent wrote this from a sample rate card.

  function basePrice(jobType) {
    if (jobType === "tune-up") return 129;
    if (jobType === "repair") return 240;
    if (jobType === "install") return 6400;
    return 0;
  }

  function surcharge(base, when) {
    const weekend = when.day === "sat" || when.day === "sun";
    const afterHours = when.hour < 8 || when.hour >= 17;
    if (weekend) return roundCents(base * 0.35);
    if (afterHours) return roundCents(base * 0.5);
    return 0;
  }

  function memberDiscount(amount, member) {
    const eligible = member === true;
    if (!eligible) return 0;
    return roundCents(amount * 0.1);
  }

  function salesTax(amount) {
    return roundCents(amount * 0.0675);
  }

  function quoteTotal(job) {
    const base = basePrice(job.type);
    const extra = surcharge(base, job.when);
    const gross = base + extra;
    const discount = memberDiscount(gross, job.member);
    const net = gross - discount;
    const tax = salesTax(net);
    return roundCents(net + tax);
  }

  function roundCents(amount) {
    return Math.round(amount * 100) / 100;
  }
`);

export const WEAK_TESTS = [
  {
    id: "weak-base",
    name: "basePrice returns a number",
    body: dedent(`
      for (const jobType of ["tune-up", "repair", "install", "filter"]) {
        const price = basePrice(jobType);
        assert(typeof price === "number", "base price should be a number");
        assert(Number.isFinite(price), "base price should be finite");
      }
    `),
  },
  {
    id: "weak-when",
    name: "surcharge returns a number",
    body: dedent(`
      for (const when of [
        { day: "sat", hour: 10 },
        { day: "sun", hour: 21 },
        { day: "tue", hour: 7 },
        { day: "tue", hour: 17 },
        { day: "tue", hour: 11 },
      ]) {
        const extra = surcharge(200, when);
        assert(typeof extra === "number", "surcharge should be a number");
        assert(Number.isFinite(extra), "surcharge should be finite");
      }
    `),
  },
  {
    id: "weak-member",
    name: "memberDiscount returns a number",
    body: dedent(`
      for (const member of [true, false]) {
        const discount = memberDiscount(200, member);
        assert(typeof discount === "number", "discount should be a number");
        assert(Number.isFinite(discount), "discount should be finite");
      }
    `),
  },
  {
    id: "weak-tax",
    name: "salesTax returns a number",
    body: dedent(`
      const tax = salesTax(200);
      assert(typeof tax === "number", "tax should be a number");
      assert(Number.isFinite(tax), "tax should be finite");
    `),
  },
  {
    id: "weak-total",
    name: "quoteTotal returns a number",
    body: dedent(`
      for (const job of [
        { type: "tune-up", when: { day: "tue", hour: 11 }, member: false },
        { type: "repair", when: { day: "sat", hour: 19 }, member: true },
        { type: "install", when: { day: "sun", hour: 9 }, member: false },
      ]) {
        const total = quoteTotal(job);
        assert(typeof total === "number", "quote should be a number");
        assert(Number.isFinite(total), "quote should be finite");
      }
    `),
  },
];

export const STRONG_TESTS = [
  {
    id: "rate-card",
    step: 1,
    name: "Pin the rate card",
    why: "The suite never checks the rate card. A tune-up at 130 still returns a number. Pin 129, 240, 6400, and 0 for an unknown job.",
    body: dedent(`
      assertEqual(basePrice("tune-up"), 129, "tune-up");
      assertEqual(basePrice("repair"), 240, "repair");
      assertEqual(basePrice("install"), 6400, "install");
      assertEqual(basePrice("filter"), 0, "unknown job");
    `),
  },
  {
    id: "clock",
    step: 2,
    name: "Pin the clock and the weekend",
    why: "8:00 am and 5:00 pm are the edges. Saturday stays on the weekend rate, even at 7:00 am. The old asserts never try those hours.",
    body: dedent(`
      assertEqual(surcharge(200, { day: "tue", hour: 10 }), 0, "weekday midday");
      assertEqual(surcharge(200, { day: "tue", hour: 7 }), 100, "before 8");
      assertEqual(surcharge(200, { day: "tue", hour: 8 }), 0, "at 8");
      assertEqual(surcharge(200, { day: "tue", hour: 16 }), 0, "before 5 pm");
      assertEqual(surcharge(200, { day: "tue", hour: 17 }), 100, "at 5 pm");
      assertEqual(surcharge(200, { day: "sat", hour: 10 }), 70, "Saturday");
      assertEqual(surcharge(200, { day: "sun", hour: 10 }), 70, "Sunday");
      assertEqual(surcharge(200, { day: "sat", hour: 7 }), 70, "Saturday morning");
    `),
  },
  {
    id: "member",
    step: 3,
    name: "Pin the member discount",
    why: "Members take 10% off. Everyone else takes none. The flag has to be the boolean true. A flipped check still returns a number.",
    body: dedent(`
      assertEqual(memberDiscount(200, true), 20, "member");
      assertEqual(memberDiscount(200, false), 0, "not a member");
    `),
  },
  {
    id: "total",
    step: 4,
    name: "Pin the tax and one full total",
    why: "Tax is 6.75% of the discounted amount, added once. A Tuesday 7:00 pm repair for a member is $345.87. Swapping a plus for a minus still looks done to the old suite.",
    body: dedent(`
      assertEqual(salesTax(200), 13.5, "tax on 200");
      assertEqual(quoteTotal({
        type: "repair",
        when: { day: "tue", hour: 19 },
        member: true,
      }), 345.87, "Tuesday evening member repair");
    `),
  },
];

export const SAMPLE_JOBS = [
  {
    id: "tune",
    label: "Tuesday tune-up",
    when: "10:00 am",
    who: "Not a member",
    job: { type: "tune-up", when: { day: "tue", hour: 10 }, member: false },
    total: 137.71,
  },
  {
    id: "weekend",
    label: "Saturday repair",
    when: "7:00 am",
    who: "Member",
    job: { type: "repair", when: { day: "sat", hour: 7 }, member: true },
    total: 311.28,
  },
  {
    id: "install",
    label: "Tuesday install",
    when: "7:00 pm",
    who: "Not a member",
    job: { type: "install", when: { day: "tue", hour: 19 }, member: false },
    total: 10248,
  },
];

export function crapScore(complexity, coverage) {
  const missed = 1 - coverage;
  return complexity * complexity * missed * missed * missed + complexity;
}

export function formatCrap(value) {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return rounded.toFixed(2);
}

export function formatMoney(amount) {
  const negative = amount < 0;
  const cents = Math.round(Math.abs(amount) * 100);
  const dollars = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (negative ? "-$" : "$") + grouped + "." + rest;
}

export function analyze(enabledIds = []) {
  const enabled = new Set(enabledIds);
  const tests = WEAK_TESTS.concat(STRONG_TESTS.filter((test) => enabled.has(test.id)));
  return analyzeSource(MODULE, tests);
}

export function analyzeSource(source, tests) {
  const inspected = inspect(source);
  const executable = inspected.functions.flatMap((fn) => fn.lines);
  const baseline = runSuite(source, tests, executable);
  const functions = scoreFunctions(inspected.functions, baseline.hits);
  const lines = executable.length;
  const linesHit = executable.filter((line) => baseline.hits[line] > 0).length;
  const lineCoverage = lines === 0 ? 1 : linesHit / lines;
  const worstCrap = functions.reduce((max, fn) => Math.max(max, fn.crap), 0);
  const passed = baseline.ok;

  if (!passed) {
    const failed = baseline.results.filter((item) => !item.pass);
    const error = baseline.loadError || failed.map((item) => item.name + ": " + item.error).join("\n");
    return {
      ok: false,
      error,
      tests: baseline.results,
      functions,
      lineCoverage,
      lines,
      linesHit,
      mutants: [],
      killed: 0,
      survived: 0,
      mutationScore: null,
      worstCrap,
    };
  }

  const mutants = buildMutants(source, inspected).map((mutant) => judgeMutant(mutant, tests));
  const killed = mutants.filter((mutant) => mutant.killed).length;
  return {
    ok: true,
    error: null,
    tests: baseline.results,
    functions,
    lineCoverage,
    lines,
    linesHit,
    mutants,
    killed,
    survived: mutants.length - killed,
    mutationScore: mutants.length === 0 ? 1 : killed / mutants.length,
    worstCrap,
  };
}

export function priceBreakdown(job) {
  const fn = new Function(
    "job",
    MODULE +
      "\nconst base = basePrice(job.type);\n" +
      "const extra = surcharge(base, job.when);\n" +
      "const gross = base + extra;\n" +
      "const discount = memberDiscount(gross, job.member);\n" +
      "const net = gross - discount;\n" +
      "const tax = salesTax(net);\n" +
      "const total = quoteTotal(job);\n" +
      "return { base, extra, gross, discount, net, tax, total };\n",
  );
  return fn(job);
}

function dedent(text) {
  const lines = text.replace(/^\n/, "").replace(/\n$/, "").split("\n");
  const widths = lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length);
  const pad = widths.length === 0 ? 0 : Math.min(...widths);
  return lines.map((line) => line.slice(pad)).join("\n");
}

function scoreFunctions(functions, hits) {
  return functions.map((fn) => {
    const total = fn.lines.length;
    const covered = fn.lines.filter((line) => hits[line] > 0).length;
    const coverage = total === 0 ? 1 : covered / total;
    return {
      name: fn.name,
      line: fn.line,
      complexity: fn.complexity,
      covered,
      total,
      coverage,
      crap: crapScore(fn.complexity, coverage),
    };
  });
}

function judgeMutant(mutant, tests) {
  const outcome = runSuite(mutant.source, tests, null);
  if (outcome.loadError) {
    return {
      ...publicMutant(mutant),
      killed: true,
      killerId: null,
      killerName: null,
      error: outcome.loadError,
    };
  }
  const failed = outcome.results.find((item) => !item.pass);
  return {
    ...publicMutant(mutant),
    killed: !outcome.ok,
    killerId: failed ? failed.id : null,
    killerName: failed ? failed.name : null,
    error: failed ? failed.error : null,
  };
}

function publicMutant(mutant) {
  return {
    id: mutant.id,
    functionName: mutant.functionName,
    line: mutant.line,
    kind: mutant.kind,
    original: mutant.original,
    replacement: mutant.replacement,
    start: mutant.start,
    end: mutant.end,
    before: mutant.before,
    after: mutant.after,
    label: mutant.label,
    source: mutant.source,
  };
}

function runSuite(source, tests, executableLines) {
  const code = executableLines ? instrument(source, executableLines) : source;
  const hits = Object.create(null);
  let results;
  try {
    const fn = new Function("__hit", "assert", "assertEqual", code + "\n" + harness(tests));
    results = fn(
      (line) => {
        hits[line] = (hits[line] || 0) + 1;
      },
      assert,
      assertEqual,
    );
  } catch (error) {
    return {
      ok: false,
      loadError: String(error && error.message ? error.message : error),
      results: [],
      hits,
    };
  }
  const list = Array.isArray(results) ? results : [];
  return {
    ok: list.every((item) => item.pass),
    loadError: null,
    results: list,
    hits,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

function assertEqual(actual, expected, message) {
  if (Object.is(actual, expected)) return;
  const prefix = message ? message + ": " : "";
  throw new Error(prefix + "expected " + String(expected) + ", got " + String(actual));
}

function harness(tests) {
  const entries = tests.map((test) => {
    return (
      "{ id: " + JSON.stringify(test.id) +
      ", name: " + JSON.stringify(test.name) +
      ", fn: function () {\n" + test.body + "\n} }"
    );
  });
  return [
    "const __tests = [" + entries.join(",\n") + "];",
    "const __results = [];",
    "for (const __test of __tests) {",
    "  try {",
    "    __test.fn();",
    "    __results.push({ id: __test.id, name: __test.name, pass: true, error: null });",
    "  } catch (__error) {",
    "    __results.push({ id: __test.id, name: __test.name, pass: false, error: String(__error && __error.message || __error) });",
    "  }",
    "}",
    "return __results;",
  ].join("\n");
}

function instrument(source, lines) {
  const set = new Set(lines);
  return source.split("\n").map((line, index) => {
    const number = index + 1;
    if (!set.has(number)) return line;
    const indent = line.match(/^\s*/)[0];
    return indent + "__hit(" + number + "); " + line.slice(indent.length);
  }).join("\n");
}

function inspect(source) {
  const tokens = tokenize(source);
  const functions = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (!(tokens[i].type === "ident" && tokens[i].value === "function")) continue;
    const startToken = i;
    let j = i + 1;
    let name = "anonymous";
    if (tokens[j] && tokens[j].type === "ident") {
      name = tokens[j].value;
      j += 1;
    }
    while (j < tokens.length && tokens[j].value !== "{") j += 1;
    if (j >= tokens.length) continue;
    const endToken = matchingBrace(tokens, j);
    functions.push({
      name,
      line: tokens[i].line,
      startToken,
      endToken,
      bodyStart: j + 1,
      bodyEnd: endToken,
      lines: [],
    });
  }
  for (let i = 0; i < tokens.length; i += 1) {
    const owners = functions.filter((fn) => i >= fn.bodyStart && i < fn.bodyEnd);
    if (owners.length === 0) continue;
    owners.sort((a, b) => (a.bodyEnd - a.bodyStart) - (b.bodyEnd - b.bodyStart));
    const owner = owners[0];
    if (!owner.lines.includes(tokens[i].line)) owner.lines.push(tokens[i].line);
  }
  for (const fn of functions) {
    fn.lines.sort((a, b) => a - b);
    fn.complexity = complexityOf(tokens, fn);
  }
  return { tokens, functions };
}

function matchingBrace(tokens, openIndex) {
  let depth = 0;
  for (let k = openIndex; k < tokens.length; k += 1) {
    if (tokens[k].value === "{") depth += 1;
    else if (tokens[k].value === "}") {
      depth -= 1;
      if (depth === 0) return k;
    }
  }
  return tokens.length - 1;
}

function complexityOf(tokens, fn) {
  let score = 1;
  let i = fn.bodyStart;
  while (i < fn.bodyEnd) {
    const token = tokens[i];
    if (token.type === "ident" && token.value === "function") {
      let j = i + 1;
      while (j < fn.bodyEnd && tokens[j].value !== "{") j += 1;
      i = j < fn.bodyEnd ? matchingBrace(tokens, j) + 1 : i + 1;
      continue;
    }
    if (isDecision(token)) score += 1;
    i += 1;
  }
  return score;
}

function isDecision(token) {
  if (token.type === "ident" && (token.value === "if" || token.value === "for" || token.value === "while" || token.value === "catch" || token.value === "case")) {
    return true;
  }
  return token.type === "op" && (token.value === "&&" || token.value === "||" || token.value === "??" || token.value === "?." || token.value === "?");
}

function buildMutants(source, inspected) {
  const mutants = [];
  const tokens = inspected.tokens;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    for (const replacement of replacementsFor(tokens, index)) {
      const parts = lineParts(source, token);
      const name = ownerName(inspected.functions, index);
      mutants.push({
        id: token.start + ":" + token.value + "->" + replacement,
        functionName: name,
        line: token.line,
        kind: kindFor(token.value, replacement),
        original: token.value,
        replacement,
        start: token.start,
        end: token.end,
        before: parts.before,
        after: parts.after,
        label: labelFor(name, token.line, token.value, replacement),
        source: source.slice(0, token.start) + replacement + source.slice(token.end),
      });
    }
  }
  return mutants;
}

function ownerName(functions, tokenIndex) {
  const owners = functions.filter((fn) => tokenIndex >= fn.startToken && tokenIndex <= fn.endToken);
  if (owners.length === 0) return "module";
  owners.sort((a, b) => (a.endToken - a.startToken) - (b.endToken - b.startToken));
  return owners[0].name;
}

function kindFor(original, replacement) {
  if (original === "!" || original === "true" || original === "false") return "boolean";
  if (original === "&&" || original === "||") return "logic";
  if (original === "+" || original === "-") return "arithmetic";
  if (original === "===" || original === "!==") return "comparison";
  if (original === "<" || original === "<=" || original === ">" || original === ">=") {
    const boundary =
      (original === "<" && replacement === "<=") ||
      (original === "<=" && replacement === "<") ||
      (original === ">" && replacement === ">=") ||
      (original === ">=" && replacement === ">");
    return boundary ? "boundary" : "comparison";
  }
  return "constant";
}

function labelFor(name, line, original, replacement) {
  if (original === "!" && replacement === "") return name + ", line " + line + ": removed !";
  return name + ", line " + line + ": " + original + " became " + replacement;
}

function lineParts(source, token) {
  const lineStart = source.lastIndexOf("\n", Math.max(0, token.start - 1)) + 1;
  let lineEnd = source.indexOf("\n", token.end);
  if (lineEnd === -1) lineEnd = source.length;
  const line = source.slice(lineStart, lineEnd);
  const column = token.start - lineStart;
  return {
    before: line.slice(0, column),
    after: line.slice(column + token.value.length),
  };
}

function replacementsFor(tokens, index) {
  const token = tokens[index];
  if (token.type === "number") {
    const next = nudgeNumber(token.value);
    return next ? [next] : [];
  }
  if (token.type === "ident" && (token.value === "true" || token.value === "false")) {
    return [token.value === "true" ? "false" : "true"];
  }
  if (token.type !== "op") return [];
  if (token.value === "!") {
    const next = tokens[index + 1];
    if (next && (next.type === "ident" || next.value === "(")) return [""];
    return [];
  }
  if (token.value === "&&") return ["||"];
  if (token.value === "||") return ["&&"];
  if (token.value === "===") return ["!=="];
  if (token.value === "!==") return ["==="];
  if (token.value === "<") return ["<=", ">"];
  if (token.value === "<=") return ["<", ">="];
  if (token.value === ">") return [">=", "<"];
  if (token.value === ">=") return [">", "<="];
  if ((token.value === "+" || token.value === "-") && isBinaryAddSub(tokens, index)) {
    return [token.value === "+" ? "-" : "+"];
  }
  return [];
}

function isBinaryAddSub(tokens, index) {
  const previous = tokens[index - 1];
  if (!previous) return false;
  if (previous.type === "number" || previous.type === "ident" || previous.type === "string") return true;
  return previous.value === ")" || previous.value === "]";
}

function nudgeNumber(text) {
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  if (text.includes(".")) {
    const next = Math.round((Number(text) + 0.01) * 10000) / 10000;
    const formatted = String(next);
    if (formatted === text) return null;
    return formatted;
  }
  return String(Number(text) + 1);
}

// Enough of a scan for this module: comments, strings, numbers, names, operators.
function tokenize(source) {
  const tokens = [];
  const op3 = new Set(["===", "!==", ">>>"]);
  const op2 = new Set(["==", "!=", "<=", ">=", "&&", "||", "??", "?.", "=>", "++", "--", "+=", "-=", "**", "<<", ">>"]);
  let i = 0;
  let line = 1;

  while (i < source.length) {
    const ch = source[i];
    if (ch === "\n") {
      line += 1;
      i += 1;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line += 1;
        i += 1;
      }
      i = Math.min(source.length, i + 2);
      continue;
    }
    if (ch === "'" || ch === "\"" || ch === "`") {
      const start = i;
      const startLine = line;
      const quote = ch;
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === "\n") line += 1;
        i += 1;
      }
      if (i < source.length) i += 1;
      tokens.push({ type: "string", value: source.slice(start, i), start, end: i, line: startLine });
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      const start = i;
      const startLine = line;
      i += 1;
      while (i < source.length && ((source[i] >= "0" && source[i] <= "9") || source[i] === ".")) i += 1;
      tokens.push({ type: "number", value: source.slice(start, i), start, end: i, line: startLine });
      continue;
    }
    if ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_" || ch === "$") {
      const start = i;
      const startLine = line;
      i += 1;
      while (i < source.length) {
        const c = source[i];
        const ident = (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "_" || c === "$";
        if (!ident) break;
        i += 1;
      }
      tokens.push({ type: "ident", value: source.slice(start, i), start, end: i, line: startLine });
      continue;
    }
    const three = source.slice(i, i + 3);
    const two = source.slice(i, i + 2);
    if (op3.has(three)) {
      tokens.push({ type: "op", value: three, start: i, end: i + 3, line });
      i += 3;
      continue;
    }
    if (op2.has(two)) {
      tokens.push({ type: "op", value: two, start: i, end: i + 2, line });
      i += 2;
      continue;
    }
    tokens.push({ type: "op", value: ch, start: i, end: i + 1, line });
    i += 1;
  }
  return tokens;
}
