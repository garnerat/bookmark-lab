// Streaming voice-to-UI for a fictional coffee counter.
// Ember & Oak Coffee, the menu, and the order are fiction.
// The parser is deterministic. This file does not call a model or a network.
// It illustrates the idea in the bookmarked post. It is not Jev.
(function () {
  const WPM = 150;
  const WORD_MS = 60000 / WPM;
  const SILENCE_MS = 700;
  const REWRITE_MS = 200;
  const SHOP = "Ember & Oak Coffee";

  const SOURCE = {
    postUrl: "https://x.com/kunalabcdani/status/2119892841723990319",
    postId: "2119892841723990319",
    handle: "kunalabcdani",
    posted: "9 Nov 2026",
    quote: "What if we could manipulate UI at the speed of thought? Built this voice coffee ordering system with @typesafeai Jev. The drink and any updates show up while I'm still mid-sentence, ~200 ms from word to screen.",
  };

  const SAMPLE_SENTENCE = "a large oat latte, actually make it iced, and um, no, medium, plus a croissant";
  const SPOKEN = ["a", "large", "oat", "latte", "actually", "make", "it", "iced", "and", "um", "no", "medium", "plus", "a", "croissant"];
  const REWRITE_NOTE = "Recognizer rewrite: “a large oat latte” became “I'll have a large oat latte”. Earlier words changed. The drink did not.";

  const DRINKS = {
    latte: "hot",
    cortado: "hot",
    "cold brew": "iced",
    chai: "hot",
    matcha: "hot",
  };
  const PASTRIES = { croissant: 1, muffin: 1, scone: 1, "banana bread": 1 };
  const SIZES = { small: 1, medium: 1, large: 1 };
  const MILKS = { whole: 1, oat: 1, almond: 1, skim: 1, soy: 1 };
  const SYRUPS = { vanilla: 1, caramel: 1, hazelnut: 1 };
  const TEMPS = { hot: "hot", iced: "iced", ice: "iced" };
  const CORRECTIONS = { actually: "actually", instead: "instead", no: "no", not: "no", wait: "actually" };
  const JOINS = { and: 1, plus: 1, also: 1 };

  const RANGES = { latency: { min: 300, max: 3000, step: 100 } };
  const DEFAULTS = { modelLatencyMs: 1200, applyMode: "rederive", speed: "normal" };
  const SPEED = { normal: 1, fast: 8 };

  const MENU = {
    drinks: ["latte", "cortado", "cold brew", "chai", "matcha"],
    sizes: ["small", "medium", "large"],
    milks: ["whole", "oat", "almond", "skim", "soy"],
    syrups: ["vanilla", "caramel", "hazelnut"],
    pastries: ["croissant", "muffin", "scone", "banana bread"],
    temps: ["hot", "iced"],
    extras: ["extra shot"],
  };

  function splitWords(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  function emptyPending() {
    return { size: null, milk: null, temp: null, extraShot: false, syrups: [] };
  }

  function clonePending(pending) {
    const source = pending || emptyPending();
    return {
      size: source.size || null,
      milk: source.milk || null,
      temp: source.temp || null,
      extraShot: !!source.extraShot,
      syrups: source.syrups ? source.syrups.slice() : [],
    };
  }

  function cloneItem(item) {
    return {
      kind: item.kind,
      name: item.name,
      size: item.size || null,
      milk: item.milk || null,
      temp: item.temp || null,
      tempSpoken: !!item.tempSpoken,
      extraShot: !!item.extraShot,
      syrups: item.syrups ? item.syrups.slice() : [],
    };
  }

  function emptyState() {
    return {
      items: [],
      pending: emptyPending(),
      current: -1,
      correction: null,
      expectNew: false,
      transcript: "",
      patchLog: [],
      patches: [],
    };
  }

  function cloneState(state) {
    const source = state || emptyState();
    return {
      items: (source.items || []).map(cloneItem),
      pending: clonePending(source.pending),
      current: source.current == null ? -1 : source.current,
      correction: source.correction || null,
      expectNew: !!source.expectNew,
      transcript: source.transcript || "",
      patchLog: (source.patchLog || []).map((patch) => Object.assign({}, patch)),
      patches: (source.patches || []).map((patch) => Object.assign({}, patch)),
    };
  }

  function lastDrinkIndex(items) {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].kind === "drink") return i;
    }
    return -1;
  }

  function readAtom(words, index) {
    const word = words[index];
    const next = words[index + 1];
    const pair = next ? word + " " + next : "";
    if (pair === "scratch that") return { kind: "scratch", consume: 2 };
    if (pair === "make that" || pair === "make it") return { kind: "correct", via: "make that", consume: 2 };
    if (pair === "cold brew") return { kind: "drink", value: "cold brew", consume: 2 };
    if (pair === "banana bread") return { kind: "pastry", value: "banana bread", consume: 2 };
    if (pair === "extra shot" || pair === "another shot" || pair === "double shot") return { kind: "shot", consume: 2 };
    if (pair === "oat milk" || pair === "almond milk" || pair === "whole milk" || pair === "skim milk" || pair === "soy milk") {
      return { kind: "milk", value: pair.split(" ")[0], consume: 2 };
    }
    if (DRINKS[word]) return { kind: "drink", value: word, consume: 1 };
    if (PASTRIES[word]) return { kind: "pastry", value: word, consume: 1 };
    if (SIZES[word]) return { kind: "size", value: word, consume: 1 };
    if (MILKS[word]) return { kind: "milk", value: word, consume: 1 };
    if (TEMPS[word]) return { kind: "temp", value: TEMPS[word], consume: 1 };
    if (SYRUPS[word]) return { kind: "syrup", value: word, consume: 1 };
    if (word === "shot") return { kind: "shot", consume: 1 };
    if (JOINS[word]) return { kind: "join", consume: 1 };
    if (word === "with") return { kind: "with", consume: 1 };
    if (CORRECTIONS[word]) return { kind: "correct", via: CORRECTIONS[word], consume: 1 };
    return { kind: "skip", consume: 1 };
  }

  function lookahead(words, start) {
    let index = start;
    let hops = 0;
    while (index < words.length && hops < 8) {
      const atom = readAtom(words, index);
      if (atom.kind === "skip" || atom.kind === "with") {
        index += atom.consume;
        hops += 1;
        continue;
      }
      if (atom.kind === "correct" || atom.kind === "scratch") return "correction";
      if (atom.kind === "join") return "join";
      if (atom.kind === "drink" || atom.kind === "pastry") return "item";
      if (atom.kind === "size" || atom.kind === "milk" || atom.kind === "temp" || atom.kind === "shot" || atom.kind === "syrup") {
        index += atom.consume;
        hops += 1;
        continue;
      }
      return "other";
    }
    return "none";
  }

  function runParser(words, initial) {
    const items = (initial.items || []).map(cloneItem);
    let pending = clonePending(initial.pending);
    let current = initial.current == null || initial.current < 0 ? lastDrinkIndex(items) : initial.current;
    let correction = initial.correction || null;
    let expectNew = !!initial.expectNew;
    const patches = [];
    let index = 0;

    function pushPatch(patch) {
      if (correction && patch.via === undefined) patch.via = correction;
      patches.push(patch);
    }

    function pushDrink(name) {
      const spokenTemp = pending.temp;
      const item = {
        kind: "drink",
        name: name,
        size: pending.size,
        milk: pending.milk,
        temp: spokenTemp || DRINKS[name],
        tempSpoken: !!spokenTemp,
        extraShot: pending.extraShot,
        syrups: pending.syrups.slice(),
      };
      items.push(item);
      current = items.length - 1;
      pushPatch({ op: "add-item", kind: "drink", name: name });
      if (item.size) pushPatch({ op: "set-size", size: item.size, name: name });
      if (item.milk) pushPatch({ op: "set-milk", milk: item.milk, name: name });
      pushPatch({ op: "set-temp", temp: item.temp, name: name, via: item.tempSpoken ? null : "default" });
      if (item.extraShot) pushPatch({ op: "set-extra-shot", name: name });
      item.syrups.forEach((syrup) => pushPatch({ op: "add-syrup", syrup: syrup, name: name }));
      pending = emptyPending();
      expectNew = false;
      correction = null;
    }

    function pushPastry(name) {
      items.push({ kind: "pastry", name: name, size: null, milk: null, temp: null, tempSpoken: false, extraShot: false, syrups: [] });
      pushPatch({ op: "add-item", kind: "pastry", name: name });
      pending = emptyPending();
      expectNew = false;
      correction = null;
    }

    while (index < words.length) {
      const atom = readAtom(words, index);
      const nextIndex = index + atom.consume;

      if (atom.kind === "scratch") {
        if (items.length) {
          const removed = items.pop();
          patches.push({ op: "remove-item", name: removed.name, via: "scratch that" });
          current = lastDrinkIndex(items);
        }
        pending = emptyPending();
        correction = null;
        expectNew = false;
        index = nextIndex;
        continue;
      }

      if (atom.kind === "join") {
        if (lookahead(words, nextIndex) === "item") {
          expectNew = true;
          pending = emptyPending();
          correction = null;
        }
        index = nextIndex;
        continue;
      }

      if (atom.kind === "with" || atom.kind === "skip") {
        index = nextIndex;
        continue;
      }

      if (atom.kind === "correct") {
        correction = correction || atom.via;
        expectNew = false;
        index = nextIndex;
        continue;
      }

      if (atom.kind === "drink") {
        const openDrink = !expectNew && current >= 0 && items[current] && items[current].kind === "drink";
        if (correction && openDrink) {
          const drink = items[current];
          const from = drink.name;
          if (from !== atom.value) {
            drink.name = atom.value;
            if (!drink.tempSpoken) drink.temp = DRINKS[atom.value];
            pushPatch({ op: "swap-drink", from: from, name: atom.value });
          }
          correction = null;
          expectNew = false;
        } else if (correction && !expectNew && items.length && items[items.length - 1].kind === "pastry") {
          const removed = items.pop();
          patches.push({ op: "remove-item", name: removed.name, via: correction });
          pushDrink(atom.value);
        } else {
          pushDrink(atom.value);
        }
        index = nextIndex;
        continue;
      }

      if (atom.kind === "pastry") {
        if (correction && !expectNew && items.length) {
          const last = items[items.length - 1];
          if (last.kind === "pastry" && last.name !== atom.value) {
            const from = last.name;
            last.name = atom.value;
            pushPatch({ op: "swap-item", from: from, name: atom.value });
            correction = null;
            pending = emptyPending();
            expectNew = false;
          } else if (last.kind !== "pastry") {
            const removed = items.pop();
            patches.push({ op: "remove-item", name: removed.name, via: correction });
            current = lastDrinkIndex(items);
            pushPastry(atom.value);
          } else {
            correction = null;
          }
        } else {
          pushPastry(atom.value);
        }
        index = nextIndex;
        continue;
      }

      const open = !expectNew && current >= 0 && items[current] && items[current].kind === "drink";
      const keepCorrection = !!(correction && lookahead(words, nextIndex) === "item");
      if (!open) {
        if (atom.kind === "size") pending.size = atom.value;
        else if (atom.kind === "milk") pending.milk = atom.value;
        else if (atom.kind === "temp") pending.temp = atom.value;
        else if (atom.kind === "shot") pending.extraShot = true;
        else if (atom.kind === "syrup" && pending.syrups.indexOf(atom.value) === -1) pending.syrups.push(atom.value);
      } else if (atom.kind === "size") {
        const from = items[current].size;
        if (from !== atom.value) {
          items[current].size = atom.value;
          pushPatch({ op: "set-size", size: atom.value, from: from, name: items[current].name });
        }
      } else if (atom.kind === "milk") {
        const from = items[current].milk;
        if (from !== atom.value) {
          items[current].milk = atom.value;
          pushPatch({
            op: from ? "swap-milk" : "set-milk",
            milk: atom.value,
            from: from,
            name: items[current].name,
          });
        }
      } else if (atom.kind === "temp") {
        const from = items[current].temp;
        if (from !== atom.value) {
          items[current].temp = atom.value;
          items[current].tempSpoken = true;
          pushPatch({ op: "set-temp", temp: atom.value, from: from, name: items[current].name });
        }
      } else if (atom.kind === "shot") {
        if (!items[current].extraShot) {
          items[current].extraShot = true;
          pushPatch({ op: "set-extra-shot", name: items[current].name });
        }
      } else if (atom.kind === "syrup" && items[current].syrups.indexOf(atom.value) === -1) {
        items[current].syrups.push(atom.value);
        pushPatch({ op: "add-syrup", syrup: atom.value, name: items[current].name });
      }
      if (!keepCorrection) correction = null;
      index = nextIndex;
    }

    return {
      items: items,
      pending: pending,
      current: current,
      correction: correction,
      expectNew: expectNew,
      patches: patches,
    };
  }

  function parseTranscript(text) {
    const parsed = runParser(splitWords(text), emptyState());
    parsed.transcript = String(text || "");
    parsed.patchLog = parsed.patches.map((patch) => Object.assign({}, patch));
    return parsed;
  }

  function sharedPrefix(prev, next) {
    const left = splitWords(prev || "");
    const right = splitWords(next || "");
    let index = 0;
    while (index < left.length && index < right.length && left[index] === right[index]) index += 1;
    return {
      left: left,
      right: right,
      shared: index,
      extends: index === left.length && right.length >= left.length,
    };
  }

  function applyHypothesis(state, transcript, applyMode) {
    const mode = applyMode === "naive" ? "naive" : "rederive";
    const base = cloneState(state || emptyState());
    const text = transcript == null ? "" : String(transcript);
    if (!splitWords(text).length) {
      const cleared = emptyState();
      cleared.transcript = "";
      return cleared;
    }
    if (mode === "rederive") {
      const parsed = runParser(splitWords(text), emptyState());
      return {
        items: parsed.items,
        pending: parsed.pending,
        current: parsed.current,
        correction: parsed.correction,
        expectNew: parsed.expectNew,
        transcript: text,
        patches: parsed.patches,
        patchLog: parsed.patches.map((patch) => Object.assign({}, patch)),
      };
    }
    const prefix = sharedPrefix(base.transcript, text);
    if (!base.transcript) {
      const parsed = runParser(prefix.right, emptyState());
      return {
        items: parsed.items,
        pending: parsed.pending,
        current: parsed.current,
        correction: parsed.correction,
        expectNew: parsed.expectNew,
        transcript: text,
        patches: parsed.patches,
        patchLog: parsed.patches.map((patch) => Object.assign({}, patch)),
      };
    }
    if (prefix.extends) {
      const stepped = runParser(prefix.right.slice(prefix.left.length), base);
      return {
        items: stepped.items,
        pending: stepped.pending,
        current: stepped.current,
        correction: stepped.correction,
        expectNew: stepped.expectNew,
        transcript: text,
        patches: stepped.patches,
        patchLog: base.patchLog.concat(stepped.patches),
      };
    }
    const parsed = runParser(prefix.right, emptyState());
    const items = base.items.map(cloneItem).concat(parsed.items.map(cloneItem));
    const patches = parsed.patches.map((patch) => Object.assign({}, patch, { duplicate: true, reason: "rewrite" }));
    let current = parsed.current;
    if (current >= 0) current += base.items.length;
    else current = lastDrinkIndex(items);
    return {
      items: items,
      pending: clonePending(parsed.pending),
      current: current,
      correction: parsed.correction,
      expectNew: parsed.expectNew,
      transcript: text,
      patches: patches,
      patchLog: base.patchLog.concat(patches),
    };
  }

  function countName(items, name) {
    return (items || []).filter((item) => item.name === name).length;
  }

  function titleWord(value) {
    return String(value || "").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  function describeItem(item) {
    if (!item) return { title: "", mods: [] };
    if (item.kind === "pastry") return { title: titleWord(item.name), mods: [] };
    const mods = [];
    if (item.temp) mods.push(titleWord(item.temp));
    if (item.size) mods.push(titleWord(item.size));
    if (item.milk) mods.push(titleWord(item.milk) + " milk");
    if (item.extraShot) mods.push("Extra shot");
    (item.syrups || []).forEach((syrup) => mods.push(titleWord(syrup)));
    return { title: titleWord(item.name), mods: mods };
  }

  function summary(items) {
    if (!items || !items.length) return "Nothing on the ticket.";
    return items.map((item) => {
      const described = describeItem(item);
      return described.mods.length ? described.title + " (" + described.mods.join(", ") + ")" : described.title;
    }).join("; ");
  }

  function matchVia(patches, row) {
    const list = patches || [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const patch = list[i];
      if (patch.op !== row.op && !(row.op === "set-milk" && patch.op === "swap-milk") && !(row.op === "swap-milk" && patch.op === "set-milk")) continue;
      if (row.size && patch.size && patch.size !== row.size) continue;
      if (row.temp && patch.temp && patch.temp !== row.temp) continue;
      if (row.milk && patch.milk && patch.milk !== row.milk) continue;
      if (row.syrup && patch.syrup && patch.syrup !== row.syrup) continue;
      if (row.name && patch.name && patch.name !== row.name && patch.op !== "swap-milk" && patch.op !== "set-milk" && patch.op !== "set-size" && patch.op !== "set-temp" && patch.op !== "add-syrup" && patch.op !== "set-extra-shot") continue;
      return patch.via || null;
    }
    return null;
  }

  function diffVisible(before, after, meta) {
    const prior = before || emptyState();
    const next = after || emptyState();
    const rows = [];
    const grew = next.items.length > prior.items.length;
    const pendingBefore = prior.pending || emptyPending();
    const pendingAfter = next.pending || emptyPending();
    if (!grew) {
      if (pendingAfter.size && pendingAfter.size !== pendingBefore.size) {
        rows.push({ op: "set-size", size: pendingAfter.size, pending: true });
      }
      if (pendingAfter.milk && pendingAfter.milk !== pendingBefore.milk) {
        rows.push({ op: "set-milk", milk: pendingAfter.milk, pending: true });
      }
      if (pendingAfter.temp && pendingAfter.temp !== pendingBefore.temp) {
        rows.push({ op: "set-temp", temp: pendingAfter.temp, pending: true });
      }
      if (pendingAfter.extraShot && !pendingBefore.extraShot) rows.push({ op: "set-extra-shot", pending: true });
      (pendingAfter.syrups || []).forEach((syrup) => {
        if ((pendingBefore.syrups || []).indexOf(syrup) === -1) rows.push({ op: "add-syrup", syrup: syrup, pending: true });
      });
    }

    const length = Math.max(prior.items.length, next.items.length);
    for (let index = 0; index < length; index += 1) {
      const oldItem = prior.items[index];
      const newItem = next.items[index];
      if (!oldItem && newItem) {
        const duplicate = !!(meta && meta.duplicate);
        rows.push({ op: "add-item", kind: newItem.kind, name: newItem.name, duplicate: duplicate });
        if (!duplicate && newItem.kind === "drink") {
          if (newItem.size && newItem.size !== pendingBefore.size) {
            rows.push({ op: "set-size", size: newItem.size, name: newItem.name });
          }
          if (newItem.milk && newItem.milk !== pendingBefore.milk) {
            rows.push({ op: "set-milk", milk: newItem.milk, name: newItem.name });
          }
          if (newItem.temp && newItem.temp !== pendingBefore.temp) {
            rows.push({
              op: "set-temp",
              temp: newItem.temp,
              name: newItem.name,
              via: newItem.tempSpoken ? null : "default",
            });
          }
          if (newItem.extraShot && !pendingBefore.extraShot) rows.push({ op: "set-extra-shot", name: newItem.name });
          (newItem.syrups || []).forEach((syrup) => {
            if ((pendingBefore.syrups || []).indexOf(syrup) === -1) {
              rows.push({ op: "add-syrup", syrup: syrup, name: newItem.name });
            }
          });
        }
      } else if (oldItem && !newItem) {
        rows.push({ op: "remove-item", name: oldItem.name, via: "scratch that" });
      } else if (oldItem && newItem) {
        if (oldItem.name !== newItem.name) {
          rows.push({ op: oldItem.kind === "pastry" && newItem.kind === "pastry" ? "swap-item" : "swap-drink", from: oldItem.name, name: newItem.name });
        }
        if (oldItem.kind === "drink" && newItem.kind === "drink") {
          if (oldItem.size !== newItem.size && newItem.size) {
            rows.push({ op: "set-size", size: newItem.size, from: oldItem.size, name: newItem.name });
          }
          if (oldItem.milk !== newItem.milk && newItem.milk) {
            rows.push({ op: oldItem.milk ? "swap-milk" : "set-milk", milk: newItem.milk, from: oldItem.milk, name: newItem.name });
          }
          if (oldItem.temp !== newItem.temp && newItem.temp) {
            rows.push({ op: "set-temp", temp: newItem.temp, from: oldItem.temp, name: newItem.name });
          }
          if (!oldItem.extraShot && newItem.extraShot) rows.push({ op: "set-extra-shot", name: newItem.name });
          (newItem.syrups || []).forEach((syrup) => {
            if ((oldItem.syrups || []).indexOf(syrup) === -1) rows.push({ op: "add-syrup", syrup: syrup, name: newItem.name });
          });
        }
      }
    }

    const parserPatches = (meta && meta.patches) || next.patches || [];
    return rows.map((row) => {
      const copy = Object.assign({}, row);
      if (!copy.pending && !copy.via) copy.via = matchVia(parserPatches, copy);
      return copy;
    });
  }

  function labelPatch(row) {
    if (!row) return "";
    let text = row.op || "";
    if (row.op === "add-item") text = "add " + row.name;
    else if (row.op === "remove-item") text = "remove " + row.name;
    else if (row.op === "swap-drink" || row.op === "swap-item") text = "swap " + row.from + " for " + row.name;
    else if (row.op === "set-size") text = "set size " + row.size + (row.from ? " · was " + row.from : "");
    else if (row.op === "set-milk") text = "set milk " + row.milk;
    else if (row.op === "swap-milk") text = "swap milk " + (row.from ? row.from + " for " : "") + row.milk;
    else if (row.op === "set-temp") text = "set " + row.temp;
    else if (row.op === "set-extra-shot") text = "extra shot";
    else if (row.op === "add-syrup") text = "add " + row.syrup;
    if (row.pending) text += " · waiting for the drink";
    if (row.via) text += " · " + row.via;
    if (row.duplicate) text = "duplicate · " + text;
    return text;
  }

  function formatMs(ms) {
    if (ms == null || !Number.isFinite(ms)) return "—";
    const rounded = Math.round(ms);
    const digits = String(Math.abs(rounded));
    const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (rounded < 0 ? "-" : "") + withCommas + " ms";
  }

  function formatClock(ms) {
    if (ms == null || !Number.isFinite(ms)) return "—";
    return (Math.max(0, ms) / 1000).toFixed(1) + "s";
  }

  function clampLatency(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return DEFAULTS.modelLatencyMs;
    return Math.min(RANGES.latency.max, Math.max(RANGES.latency.min, Math.round(number)));
  }

  function sampleEvents() {
    const events = [];
    let words = [];
    SPOKEN.forEach((word, index) => {
      words.push(word);
      const at = index * WORD_MS;
      events.push({ at: at, type: "word", word: word, transcript: words.join(" ") });
      if (word === "latte") {
        words = ["I'll", "have"].concat(words);
        events.push({
          at: at + REWRITE_MS,
          type: "rewrite",
          word: null,
          transcript: words.join(" "),
          note: REWRITE_NOTE,
        });
      }
    });
    return events;
  }

  function replay(events, applyMode) {
    const mode = applyMode === "naive" ? "naive" : "rederive";
    let state = emptyState();
    const changes = [];
    events.forEach((event) => {
      const next = applyHypothesis(state, event.transcript, mode);
      const rows = diffVisible(state, next, {
        duplicate: event.type === "rewrite" && mode === "naive",
        patches: next.patches,
      });
      rows.forEach((row) => {
        changes.push(Object.assign({ at: event.at, type: event.type, latencyMs: 0 }, row));
      });
      state = next;
    });
    return { state: state, changes: changes };
  }

  function firstDrinkAt(changes) {
    const hit = (changes || []).find((row) => row.op === "add-item" && row.kind === "drink" && !row.duplicate);
    return hit ? hit.at : null;
  }

  function simulate(input) {
    const source = input || {};
    const applyMode = source.applyMode === "naive" ? "naive" : "rederive";
    const modelLatencyMs = clampLatency(source.modelLatencyMs);
    const events = sampleEvents();
    const played = replay(events, applyMode);
    const last = events[events.length - 1];
    const drinkWord = events.find((event) => event.word === "latte");
    const silenceAt = last.at + SILENCE_MS;
    const endRenderAt = silenceAt + modelLatencyMs;
    const endOrder = parseTranscript(last.transcript);
    const drinkWordAt = drinkWord.at;
    const drinkSeenAt = firstDrinkAt(played.changes);
    const changes = played.changes.map((row) => Object.assign({}, row, {
      streamAt: row.at,
      endAt: endRenderAt,
      streamLatencyMs: 0,
      endLatencyMs: endRenderAt - row.at,
      label: labelPatch(row),
    }));
    return {
      input: { applyMode: applyMode, modelLatencyMs: modelLatencyMs },
      events: events,
      finalTranscript: last.transcript,
      speechMs: last.at,
      silenceAt: silenceAt,
      endRenderAt: endRenderAt,
      drinkWordAt: drinkWordAt,
      streaming: {
        items: played.state.items,
        pending: played.state.pending,
        drinkSeenAt: drinkSeenAt,
        drinkLatencyMs: drinkSeenAt == null ? null : drinkSeenAt - drinkWordAt,
        changes: changes,
        latteCount: countName(played.state.items, "latte"),
      },
      endOfTurn: {
        items: endOrder.items,
        pending: endOrder.pending,
        drinkSeenAt: endRenderAt,
        drinkLatencyMs: endRenderAt - drinkWordAt,
        latteCount: countName(endOrder.items, "latte"),
      },
      gapMs: endRenderAt - (drinkSeenAt == null ? drinkWordAt : drinkSeenAt),
      stillSpeakingMs: last.at - drinkWordAt,
    };
  }

  function ordersEqual(left, right) {
    return JSON.stringify(left || []) === JSON.stringify(right || []);
  }

  globalThis.StreamingVoiceOrder = {
    WPM: WPM,
    WORD_MS: WORD_MS,
    SILENCE_MS: SILENCE_MS,
    REWRITE_MS: REWRITE_MS,
    SHOP: SHOP,
    SOURCE: SOURCE,
    SAMPLE_SENTENCE: SAMPLE_SENTENCE,
    SPOKEN: SPOKEN,
    REWRITE_NOTE: REWRITE_NOTE,
    MENU: MENU,
    RANGES: RANGES,
    DEFAULTS: DEFAULTS,
    SPEED: SPEED,
    emptyState: emptyState,
    splitWords: splitWords,
    parseTranscript: parseTranscript,
    applyHypothesis: applyHypothesis,
    diffVisible: diffVisible,
    labelPatch: labelPatch,
    formatMs: formatMs,
    formatClock: formatClock,
    clampLatency: clampLatency,
    sampleEvents: sampleEvents,
    replay: replay,
    simulate: simulate,
    describeItem: describeItem,
    summary: summary,
    countName: countName,
    ordersEqual: ordersEqual,
  };
})();
