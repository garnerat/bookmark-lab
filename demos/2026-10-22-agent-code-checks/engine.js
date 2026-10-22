/* CRAP, duplicate windows, and mutants for one JavaScript snippet.
   No DOM. The page and the node check both call AgentChecks. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AgentChecks = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const COMPARISON_FLIP = {
    "===": "!==",
    "!==": "===",
    "==": "!=",
    "!=": "==",
    "<": ">",
    ">": "<",
    "<=": ">=",
    ">=": "<=",
  };
  const COMPARISON_OPS = new Set(Object.keys(COMPARISON_FLIP));
  const DECISION_NODES = new Set([
    "IfStatement",
    "ForStatement",
    "ForInStatement",
    "ForOfStatement",
    "WhileStatement",
    "DoWhileStatement",
    "ConditionalExpression",
    "CatchClause",
  ]);
  const LOOP_NODES = new Set([
    "ForStatement",
    "ForInStatement",
    "ForOfStatement",
    "WhileStatement",
    "DoWhileStatement",
  ]);
  const MAX_CHARS = 20000;
  const SEED = 8;
  const MIN_TOKENS = 24;
  const MIN_LINES = 4;
  const MAX_DUPLICATES = 5;

  function acorn() {
    const parser = (typeof window !== "undefined" && window.acorn) || globalThis.acorn;
    if (!parser || typeof parser.parse !== "function") {
      throw new Error("The Acorn parser did not load.");
    }
    return parser;
  }

  function isFunction(node) {
    return node && (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    );
  }

  function eachNode(node, visit) {
    if (!node || typeof node.type !== "string") return;
    if (visit(node) === "skip") return;
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key === "type" || key === "start" || key === "end" || key === "loc" || key === "range") continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (let j = 0; j < value.length; j++) eachNode(value[j], visit);
      } else if (value && typeof value.type === "string") {
        eachNode(value, visit);
      }
    }
  }

  function parentMap(ast) {
    const parents = new Map();
    eachNode(ast, function (node) {
      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === "type" || key === "start" || key === "end" || key === "loc" || key === "range") continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (let j = 0; j < value.length; j++) {
            if (value[j] && typeof value[j].type === "string") parents.set(value[j], node);
          }
        } else if (value && typeof value.type === "string") {
          parents.set(value, node);
        }
      }
    });
    return parents;
  }

  function functionName(node, parent) {
    if (node.id && node.id.type === "Identifier") return node.id.name;
    if (!parent) return null;
    if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
    if ((parent.type === "MethodDefinition" || parent.type === "Property") && !parent.computed) {
      if (parent.key.type === "Identifier") return parent.key.name;
      if (parent.key.type === "Literal" && typeof parent.key.value === "string") return parent.key.value;
    }
    if (parent.type === "AssignmentExpression" && parent.left.type === "Identifier") return parent.left.name;
    return null;
  }

  function isTestName(name) {
    return typeof name === "string" && /^test(?:$|[^a-z])/i.test(name);
  }

  function directlyATest(node, parents) {
    const parent = parents.get(node);
    if (isTestName(functionName(node, parent))) return true;
    let current = parent;
    while (current) {
      if (isFunction(current)) return false;
      if (
        current.type === "VariableDeclarator" &&
        current.id.type === "Identifier" &&
        current.id.name === "tests"
      ) return true;
      current = parents.get(current);
    }
    return false;
  }

  function complexityOf(fnNode) {
    let score = 1;
    eachNode(fnNode.body, function (node) {
      if (isFunction(node)) return "skip";
      if (DECISION_NODES.has(node.type)) score += 1;
      else if (
        node.type === "LogicalExpression" &&
        (node.operator === "&&" || node.operator === "||" || node.operator === "??")
      ) score += 1;
      else if (node.type === "SwitchCase" && node.test) score += 1;
      else if ((node.type === "MemberExpression" || node.type === "CallExpression") && node.optional) {
        score += 1;
      }
    });
    return score;
  }

  function collectFunctions(ast, parents) {
    const functions = [];
    const testRanges = [];
    const testNames = [];

    function visit(node, inTest) {
      if (!node || typeof node.type !== "string") return;
      if (isFunction(node)) {
        const test = inTest || directlyATest(node, parents);
        const parent = parents.get(node);
        const name = functionName(node, parent);
        if (test) {
          testRanges.push([node.start, node.end]);
          if (name && isTestName(name) && /^[A-Za-z_$][\w$]*$/.test(name)) testNames.push(name);
        } else {
          const label = name || ("(anonymous L" + node.loc.start.line + ")");
          functions.push({
            name: label,
            line: node.loc.start.line,
            endLine: node.loc.end.line,
            start: node.start,
            end: node.end,
            node: node,
            complexity: complexityOf(node),
            probes: [],
          });
        }
        walkChildren(node, test);
        return;
      }
      walkChildren(node, inTest);
    }

    function walkChildren(node, inTest) {
      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === "type" || key === "start" || key === "end" || key === "loc" || key === "range") continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (let j = 0; j < value.length; j++) visit(value[j], inTest);
        } else if (value && typeof value.type === "string") {
          visit(value, inTest);
        }
      }
    }

    visit(ast, false);
    return { functions: functions, testRanges: testRanges, testNames: testNames };
  }

  function inRanges(ranges, start, end) {
    for (let i = 0; i < ranges.length; i++) {
      if (start >= ranges[i][0] && end <= ranges[i][1]) return true;
    }
    return false;
  }

  function applyEdits(source, edits) {
    const ordered = edits.slice().sort(function (a, b) {
      const ap = a.pos != null ? a.pos : a.start;
      const bp = b.pos != null ? b.pos : b.start;
      if (ap !== bp) return bp - ap;
      return b.seq - a.seq;
    });
    let out = source;
    for (let i = 0; i < ordered.length; i++) {
      const edit = ordered[i];
      if (edit.pos != null) out = out.slice(0, edit.pos) + edit.text + out.slice(edit.pos);
      else out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    }
    return out;
  }

  function instrument(code, functions) {
    const edits = [];
    let seq = 0;
    let nextId = 0;

    function insert(pos, text) {
      edits.push({ pos: pos, text: text, seq: seq++ });
    }

    function replace(start, end, text) {
      edits.push({ start: start, end: end, text: text, seq: seq++ });
    }

    function addProbe(fn, line) {
      const id = nextId++;
      fn.probes.push({ id: id, line: line });
      return id;
    }

    function instrumentBlock(block, fn) {
      for (let i = 0; i < block.body.length; i++) instrumentStmt(block.body[i], fn, false);
    }

    function instrumentStmt(stmt, fn, mustWrap) {
      if (!stmt || stmt.type === "EmptyStatement" || isFunction(stmt)) return;
      if (stmt.type === "BlockStatement") {
        instrumentBlock(stmt, fn);
        return;
      }
      const id = addProbe(fn, stmt.loc.start.line);
      if (mustWrap) {
        insert(stmt.start, "{__agentCheckHit(" + id + ");");
        insert(stmt.end, "}");
      } else {
        insert(stmt.start, "__agentCheckHit(" + id + ");");
      }
      instrumentControl(stmt, fn);
    }

    function instrumentControl(stmt, fn) {
      if (stmt.type === "IfStatement") {
        instrumentStmt(stmt.consequent, fn, true);
        if (stmt.alternate) instrumentStmt(stmt.alternate, fn, true);
      } else if (LOOP_NODES.has(stmt.type)) {
        instrumentStmt(stmt.body, fn, true);
      } else if (stmt.type === "SwitchStatement") {
        for (let i = 0; i < stmt.cases.length; i++) {
          const consequent = stmt.cases[i].consequent;
          for (let j = 0; j < consequent.length; j++) instrumentStmt(consequent[j], fn, false);
        }
      } else if (stmt.type === "TryStatement") {
        instrumentBlock(stmt.block, fn);
        if (stmt.handler) instrumentBlock(stmt.handler.body, fn);
        if (stmt.finalizer) instrumentBlock(stmt.finalizer, fn);
      } else if (stmt.type === "LabeledStatement") {
        instrumentStmt(stmt.body, fn, false);
      }
    }

    for (let i = 0; i < functions.length; i++) {
      const fn = functions[i];
      const body = fn.node.body;
      if (body.type !== "BlockStatement") {
        const id = addProbe(fn, body.loc.start.line);
        const expr = code.slice(body.start, body.end);
        replace(body.start, body.end, "{__agentCheckHit(" + id + ");return (" + expr + ");}");
      } else {
        const id = addProbe(fn, body.loc.start.line);
        insert(body.start + 1, "__agentCheckHit(" + id + ");");
        instrumentBlock(body, fn);
      }
    }

    return { code: applyEdits(code, edits), probeCount: nextId };
  }

  function collector(testNames) {
    const lines = [
      "const __agentCheckTests=[];",
      "if (typeof tests!==\"undefined\" && Array.isArray(tests)) {",
      "  for (let __i=0; __i<tests.length; __i++) {",
      "    const __t=tests[__i];",
      "    if (typeof __t===\"function\") __agentCheckTests.push({name:__t.name||(\"test \"+(__i+1)), fn:__t});",
      "    else if (Array.isArray(__t) && typeof __t[1]===\"function\") __agentCheckTests.push({name:String(__t[0]), fn:__t[1]});",
      "    else if (__t && typeof __t.fn===\"function\") __agentCheckTests.push({name:String(__t.name||(\"test \"+(__i+1))), fn:__t.fn});",
      "    else if (__t && typeof __t.run===\"function\") __agentCheckTests.push({name:String(__t.name||(\"test \"+(__i+1))), fn:__t.run});",
      "  }",
      "}",
    ];
    if (testNames.length) {
      lines.push("if (__agentCheckTests.length===0) {");
      for (let i = 0; i < testNames.length; i++) {
        const name = testNames[i];
        lines.push(
          "if (typeof " + name + "===\"function\") __agentCheckTests.push({name:" +
          JSON.stringify(name) + ", fn:" + name + "});"
        );
      }
      lines.push("}");
    }
    lines.push("return __agentCheckTests;");
    return lines.join("\n");
  }

  function firstDiff(before, after) {
    const a = before.split("\n");
    const b = after.split("\n");
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (a[i] !== b[i]) {
        return { line: i + 1, before: a[i] == null ? "" : a[i], after: b[i] == null ? "" : b[i] };
      }
    }
    return null;
  }

  function ownerOf(functions, node) {
    let found = null;
    for (let i = 0; i < functions.length; i++) {
      const fn = functions[i];
      if (node.start >= fn.start && node.end <= fn.end) {
        if (!found || (fn.end - fn.start) < (found.end - found.start)) found = fn;
      }
    }
    return found;
  }

  function operatorRange(node, code) {
    const between = code.slice(node.left.end, node.right.start);
    const idx = between.indexOf(node.operator);
    if (idx < 0) return null;
    const start = node.left.end + idx;
    return { start: start, end: start + node.operator.length };
  }

  function boundaryAlt(raw) {
    if (typeof raw !== "string" || !/^-?\d+$/.test(raw)) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || Math.abs(n) > 10000) return null;
    if (n === 0) return "1";
    if (n === 1) return "0";
    return String(n + 1);
  }

  function pushMutant(list, code, spec) {
    const next = code.slice(0, spec.start) + spec.replacement + code.slice(spec.end);
    if (next === code) return;
    let parsed = true;
    try {
      acorn().parse(next, { ecmaVersion: 2022 });
    } catch (err) {
      parsed = false;
    }
    if (!parsed) return;
    const diff = spec.preview || firstDiff(code, next);
    list.push({
      type: spec.type,
      typeLabel: spec.typeLabel,
      description: spec.description,
      functionName: spec.functionName,
      line: diff && diff.line ? diff.line : spec.line,
      before: diff ? diff.before : "",
      after: diff ? diff.after : "",
      source: next,
    });
  }

  function generateMutants(code, ast, functions, testRanges) {
    const mutants = [];

    eachNode(ast, function (node) {
      if (inRanges(testRanges, node.start, node.end)) return "skip";
      if (isFunction(node)) {
        const fn = ownerOf(functions, node);
        if (!fn || fn.node !== node) return;
        if (node.body.type !== "BlockStatement") return;
        const description = "Inserted an early return in " + fn.name;
        pushMutant(mutants, code, {
          type: "early-return",
          typeLabel: "Early return",
          description: description,
          functionName: fn.name,
          line: node.loc.start.line,
          start: node.body.start + 1,
          end: node.body.start + 1,
          replacement: "\n  return;",
          preview: { line: node.loc.start.line, before: "", after: "  return;" },
        });
        return;
      }

      const fn = ownerOf(functions, node);
      if (!fn) return;

      if (node.type === "BinaryExpression" && COMPARISON_OPS.has(node.operator)) {
        const range = operatorRange(node, code);
        if (range) {
          const flipped = COMPARISON_FLIP[node.operator];
          pushMutant(mutants, code, {
            type: "comparison",
            typeLabel: "Comparison",
            description: "Flipped " + node.operator + " to " + flipped + " in " + fn.name,
            functionName: fn.name,
            line: node.loc.start.line,
            start: range.start,
            end: range.end,
            replacement: flipped,
          });
        }
      }

      if (node.type === "BinaryExpression" && (node.operator === "+" || node.operator === "-")) {
        const leftLit = node.left.type === "Literal" && typeof node.left.value === "string";
        const rightLit = node.right.type === "Literal" && typeof node.right.value === "string";
        const template = node.left.type === "TemplateLiteral" || node.right.type === "TemplateLiteral";
        if (!leftLit && !rightLit && !template) {
          const range = operatorRange(node, code);
          if (range) {
            const swapped = node.operator === "+" ? "-" : "+";
            pushMutant(mutants, code, {
              type: "arithmetic",
              typeLabel: "Arithmetic",
              description: "Swapped " + node.operator + " for " + swapped + " in " + fn.name,
              functionName: fn.name,
              line: node.loc.start.line,
              start: range.start,
              end: range.end,
              replacement: swapped,
            });
          }
        }
      }

    });

    const parents = parentMap(ast);
    eachNode(ast, function (node) {
      if (inRanges(testRanges, node.start, node.end)) return "skip";
      if (isFunction(node)) return;

      if (node.type === "Literal" && typeof node.value === "number") {
        const parent = parents.get(node);
        if (
          parent &&
          parent.type === "BinaryExpression" &&
          COMPARISON_OPS.has(parent.operator) &&
          (parent.left === node || parent.right === node)
        ) {
          const alt = boundaryAlt(node.raw || String(node.value));
          if (alt != null) {
            const fn = ownerOf(functions, node);
            if (fn) {
              pushMutant(mutants, code, {
                type: "boundary",
                typeLabel: "Boundary",
                description: "Changed " + (node.raw || node.value) + " to " + alt + " in " + fn.name,
                functionName: fn.name,
                line: node.loc.start.line,
                start: node.start,
                end: node.end,
                replacement: alt,
              });
            }
          }
        }
      }

      const isCondition = node.type === "IfStatement" ||
        node.type === "WhileStatement" ||
        node.type === "DoWhileStatement" ||
        (node.type === "ForStatement" && node.test) ||
        node.type === "ConditionalExpression";
      if (!isCondition) return;
      const test = node.test;
      if (!test) return;
      const fn = ownerOf(functions, test);
      if (!fn) return;
      let replacement;
      let detail;
      if (test.type === "UnaryExpression" && test.operator === "!") {
        replacement = code.slice(test.argument.start, test.argument.end);
        detail = "Removed a negation in " + fn.name;
      } else {
        replacement = "!(" + code.slice(test.start, test.end) + ")";
        detail = "Negated the condition in " + fn.name;
      }
      pushMutant(mutants, code, {
        type: "negate",
        typeLabel: "Negate",
        description: detail,
        functionName: fn.name,
        line: test.loc.start.line,
        start: test.start,
        end: test.end,
        replacement: replacement,
      });
    });

    mutants.forEach(function (mutant, index) {
      mutant.id = index + 1;
    });
    return mutants;
  }

  function normalizedTokens(code) {
    const raw = [];
    acorn().parse(code, {
      ecmaVersion: 2022,
      locations: true,
      ranges: true,
      onToken: raw,
    });
    const tokens = [];
    for (let i = 0; i < raw.length; i++) {
      const token = raw[i];
      if (!token.type || token.type.label === "eof") continue;
      const keyword = token.type.keyword;
      let norm;
      if (keyword === "true" || keyword === "false" || keyword === "null") norm = "lit";
      else if (keyword) norm = keyword;
      else if (token.type.label === "name") norm = "id";
      else if (
        token.type.label === "num" ||
        token.type.label === "string" ||
        token.type.label === "regexp" ||
        token.type.label === "template"
      ) norm = "lit";
      else norm = token.value != null ? String(token.value) : token.type.label;
      tokens.push({
        norm: norm,
        start: token.start,
        end: token.end,
        line: token.loc.start.line,
      });
    }
    return tokens;
  }

  function findDuplicates(code, testRanges) {
    let tokens;
    try {
      tokens = normalizedTokens(code);
    } catch (err) {
      return [];
    }

    function hidden(start, end) {
      return inRanges(testRanges, start, end);
    }

    const buckets = new Map();
    for (let i = 0; i + SEED <= tokens.length; i++) {
      let skip = false;
      const parts = [];
      for (let k = 0; k < SEED; k++) {
        if (hidden(tokens[i + k].start, tokens[i + k].end)) {
          skip = true;
          break;
        }
        parts.push(tokens[i + k].norm);
      }
      if (skip) continue;
      const key = parts.join(" ");
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }

    const seen = new Set();
    const matches = [];

    function overlaps(aStart, aEnd, bStart, bEnd) {
      return !(aEnd <= bStart || bEnd <= aStart);
    }

    function extend(i, j) {
      let startA = i;
      let startB = j;
      let len = SEED;
      if (overlaps(
        tokens[startA].start,
        tokens[startA + len - 1].end,
        tokens[startB].start,
        tokens[startB + len - 1].end
      )) return;

      while (startA + len < tokens.length && startB + len < tokens.length) {
        if (tokens[startA + len].norm !== tokens[startB + len].norm) break;
        if (tokens[startA + len].norm === "function") break;
        const nextLen = len + 1;
        if (overlaps(
          tokens[startA].start,
          tokens[startA + nextLen - 1].end,
          tokens[startB].start,
          tokens[startB + nextLen - 1].end
        )) break;
        len = nextLen;
      }
      while (startA > 0 && startB > 0 && tokens[startA - 1].norm === tokens[startB - 1].norm) {
        if (overlaps(
          tokens[startA - 1].start,
          tokens[startA + len - 1].end,
          tokens[startB - 1].start,
          tokens[startB + len - 1].end
        )) break;
        startA -= 1;
        startB -= 1;
        len += 1;
        if (tokens[startA].norm === "function") break;
      }

      const fnAt = [];
      for (let k = 0; k < len; k++) {
        if (tokens[startA + k].norm === "function") fnAt.push(k);
      }
      if (fnAt.length > 1 || (fnAt.length === 1 && fnAt[0] !== 0)) {
        let bestStart = 0;
        let bestLen = fnAt[0] > 0 ? fnAt[0] : 0;
        for (let n = 0; n < fnAt.length; n++) {
          const sliceStart = fnAt[n];
          const sliceEnd = n + 1 < fnAt.length ? fnAt[n + 1] : len;
          if (sliceEnd - sliceStart > bestLen) {
            bestStart = sliceStart;
            bestLen = sliceEnd - sliceStart;
          }
        }
        if (bestLen <= 0) return;
        startA += bestStart;
        startB += bestStart;
        len = bestLen;
      }

      const a0 = tokens[startA].start;
      const a1 = tokens[startA + len - 1].end;
      const b0 = tokens[startB].start;
      const b1 = tokens[startB + len - 1].end;
      const linesA = tokens[startA + len - 1].line - tokens[startA].line + 1;
      const linesB = tokens[startB + len - 1].line - tokens[startB].line + 1;
      if (len < MIN_TOKENS || linesA < MIN_LINES || linesB < MIN_LINES) return;
      if (hidden(a0, a1) || hidden(b0, b1)) return;
      let structural = false;
      for (let k = 0; k < len; k++) {
        const norm = tokens[startA + k].norm;
        if (norm === "if" || norm === "for" || norm === "while" || norm === "switch" || norm === "?") {
          structural = true;
          break;
        }
      }
      if (!structural) return;
      const id = startA + ":" + startB + ":" + len;
      if (seen.has(id)) return;
      seen.add(id);
      matches.push({
        a0: a0,
        a1: a1,
        b0: b0,
        b1: b1,
        len: len,
        lineA1: tokens[startA].line,
        lineA2: tokens[startA + len - 1].line,
        lineB1: tokens[startB].line,
        lineB2: tokens[startB + len - 1].line,
      });
    }

    buckets.forEach(function (indexes) {
      const list = indexes.length > 40 ? indexes.slice(0, 40) : indexes;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (list[j] < list[i] + SEED) continue;
          extend(list[i], list[j]);
        }
      }
    });

    function overlapRatio(s1, e1, s2, e2) {
      const start = Math.max(s1, s2);
      const end = Math.min(e1, e2);
      if (end <= start) return 0;
      return (end - start) / Math.max(1, Math.min(e1 - s1, e2 - s2));
    }

    matches.sort(function (a, b) { return b.len - a.len; });
    const kept = [];
    for (let i = 0; i < matches.length && kept.length < MAX_DUPLICATES; i++) {
      const match = matches[i];
      let covered = false;
      for (let k = 0; k < kept.length; k++) {
        const prior = kept[k];
        const overlapA = overlapRatio(prior.a0, prior.a1, match.a0, match.a1);
        const overlapB = overlapRatio(prior.b0, prior.b1, match.b0, match.b1);
        if (overlapA >= 0.5 && overlapB >= 0.5) {
          covered = true;
          break;
        }
      }
      if (!covered) kept.push(match);
    }

    return kept.map(function (match) {
      return {
        tokens: match.len,
        lineA1: match.lineA1,
        lineA2: match.lineA2,
        lineB1: match.lineB1,
        lineB2: match.lineB2,
        textA: snippet(code, match.a0, match.a1),
        textB: snippet(code, match.b0, match.b1),
      };
    });
  }

  function snippet(code, start, end) {
    let s = start;
    let e = end;
    while (s > 0 && code.charCodeAt(s - 1) !== 10) s -= 1;
    while (e < code.length && code.charCodeAt(e) !== 10) e += 1;
    return code.slice(s, e).replace(/\s+$/, "");
  }

  function crapScore(complexity, coverage) {
    const missed = 1 - coverage;
    return complexity * complexity * missed * missed * missed + complexity;
  }

  function bandFor(score) {
    if (score >= 30) return "high";
    if (score >= 5) return "mid";
    return "low";
  }

  function scoreRun(functions, hitIds) {
    const hits = new Set(hitIds || []);
    return functions.map(function (fn) {
      const total = fn.probes.length;
      let hit = 0;
      for (let i = 0; i < fn.probes.length; i++) {
        if (hits.has(fn.probes[i].id)) hit += 1;
      }
      const coverage = total === 0 ? 0 : hit / total;
      const missedLines = [];
      const partialLines = [];
      const probeLines = new Map();
      for (let p = 0; p < fn.probes.length; p++) {
        const probe = fn.probes[p];
        if (!probeLines.has(probe.line)) probeLines.set(probe.line, { hit: 0, miss: 0 });
        const bucket = probeLines.get(probe.line);
        if (hits.has(probe.id)) bucket.hit += 1;
        else bucket.miss += 1;
      }
      probeLines.forEach(function (bucket, line) {
        if (bucket.hit === 0) missedLines.push(line);
        else if (bucket.miss > 0) partialLines.push(line);
      });
      missedLines.sort(function (a, b) { return a - b; });
      partialLines.sort(function (a, b) { return a - b; });
      const crap = crapScore(fn.complexity, coverage);
      return {
        name: fn.name,
        line: fn.line,
        endLine: fn.endLine,
        complexity: fn.complexity,
        statements: total,
        statementsHit: hit,
        coverage: coverage,
        missedLines: missedLines,
        partialLines: partialLines,
        crap: crap,
        band: bandFor(crap),
      };
    }).sort(function (a, b) {
      if (b.crap !== a.crap) return b.crap - a.crap;
      return a.line - b.line;
    });
  }

  function spread(list) {
    const types = ["comparison", "boundary", "negate", "arithmetic", "early-return"];
    const buckets = types.map(function (type) {
      return list.filter(function (mutant) { return mutant.type === type; });
    });
    const out = [];
    let guard = 0;
    while (guard < 10000) {
      guard += 1;
      let added = false;
      for (let i = 0; i < buckets.length; i++) {
        if (buckets[i].length) {
          out.push(buckets[i].shift());
          added = true;
        }
      }
      if (!added) break;
    }
    return out;
  }

  function selectMutants(mutants, scoredFunctions) {
    const covered = new Set();
    for (let i = 0; i < scoredFunctions.length; i++) {
      if (scoredFunctions[i].statementsHit > 0) covered.add(scoredFunctions[i].name);
    }
    const live = mutants.filter(function (mutant) { return covered.has(mutant.functionName); });
    const dead = mutants.filter(function (mutant) { return !covered.has(mutant.functionName); });
    const picked = spread(live).slice(0, 10).concat(spread(dead).slice(0, 6));
    picked.sort(function (a, b) {
      if (a.line !== b.line) return a.line - b.line;
      return a.type.localeCompare(b.type);
    });
    return picked;
  }

  function hasTopLevelReturn(ast) {
    let found = false;
    eachNode(ast, function (node) {
      if (isFunction(node)) return "skip";
      if (node.type === "ReturnStatement") found = true;
    });
    return found;
  }

  function analyze(raw) {
    const code = String(raw == null ? "" : raw).replace(/\r\n/g, "\n");
    if (!code.trim()) {
      return { error: "Paste a function and a few tests first." };
    }
    if (code.length > MAX_CHARS) {
      return { error: "Keep the snippet under 20,000 characters. This page checks one small module." };
    }
    let ast;
    try {
      ast = acorn().parse(code, {
        ecmaVersion: 2022,
        locations: true,
        ranges: true,
      });
    } catch (err) {
      const line = err.loc && err.loc.line ? " (line " + err.loc.line + ")" : "";
      return { error: "Could not parse that as JavaScript" + line + ". " + err.message };
    }
    if (hasTopLevelReturn(ast)) {
      return { error: "Top-level return is not supported. Keep the snippet a list of functions plus a tests array." };
    }

    const parents = parentMap(ast);
    const collected = collectFunctions(ast, parents);
    const functions = collected.functions;
    if (!functions.length) {
      return { error: "No functions found. Declare the module as functions, then add tests." };
    }
    const instrumented = instrument(code, functions);
    try {
      acorn().parse(instrumented.code, { ecmaVersion: 2022 });
    } catch (err) {
      const line = err.loc && err.loc.line ? " (line " + err.loc.line + ")" : "";
      return { error: "Instrumentation failed" + line + ". " + err.message };
    }
    const tail = collector(collected.testNames);
    const mutants = generateMutants(code, ast, functions, collected.testRanges);
    for (let i = 0; i < mutants.length; i++) mutants[i].source += "\n" + tail;
    const duplicates = findDuplicates(code, collected.testRanges);
    return {
      error: null,
      code: code,
      functions: functions,
      duplicates: duplicates,
      mutants: mutants,
      program: instrumented.code + "\n" + tail,
      tail: tail,
      probeCount: instrumented.probeCount,
    };
  }

  return {
    analyze: analyze,
    scoreRun: scoreRun,
    selectMutants: selectMutants,
    crapScore: crapScore,
    bandFor: bandFor,
  };
});
