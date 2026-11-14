(function () {
  const model = globalThis.PrefixCacheLab;
  if (!model) return;

  const $ = (id) => document.getElementById(id);

  const state = {
    prefillTokPerSec: model.DEFAULTS.prefillTokPerSec,
    contractTokens: model.DEFAULTS.contractTokens,
    turns: model.DEFAULTS.turns,
    mode: model.DEFAULTS.mode,
    breaker: model.DEFAULTS.breaker,
    playToken: 0,
    playing: false,
    stepIndex: 0,
    result: null,
  };

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = String(value);
      else node.setAttribute(key, String(value));
    });
    (children || []).forEach((child) => {
      if (child == null || child === false) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function commas(n) {
    return Math.round(n).toLocaleString("en-US");
  }

  function formatSeconds(seconds) {
    if (!Number.isFinite(seconds)) return "—";
    if (seconds < 10) return seconds.toFixed(2) + "s";
    if (seconds < 1000) return seconds.toFixed(1) + "s";
    return Math.round(seconds).toLocaleString("en-US") + "s";
  }

  function formatSpeedup(factor) {
    if (factor == null || !Number.isFinite(factor)) return "—";
    if (factor < 10) return factor.toFixed(2) + "×";
    if (factor < 100) return factor.toFixed(1) + "×";
    return Math.round(factor).toLocaleString("en-US") + "×";
  }

  function formatGB(gb) {
    if (gb >= 10) return gb.toFixed(1) + " GB";
    return gb.toFixed(2) + " GB";
  }

  function current() {
    return model.simulate({
      prefillTokPerSec: state.prefillTokPerSec,
      contractTokens: state.contractTokens,
      turns: state.turns,
      mode: state.mode,
      breaker: state.breaker,
    });
  }

  function kindCopy(row, result) {
    if (row.kind === "cold") return "First prefill. Nothing is cached yet, in either mode.";
    if (row.kind === "hit") return "Follow-up. The prefix matches, so only the new question is prefilled.";
    if (row.kind === "timestamp") {
      return "The system prompt starts with a new clock, Current time: " + row.clock + ". Token 0 changed, so the contract is prefilled again.";
    }
    if (row.kind === "edit") {
      return "The paralegal rewrites the first question to “" + model.EDITED_FIRST_QUESTION + "” The contract above it stays cached. From the edited question through this one, the tokens are prefilled again.";
    }
    return "No cache. The engine prefills the whole history, then the new question.";
  }

  function segment(className, tokens) {
    if (tokens <= 0) return null;
    const node = el("i", { class: "seg " + className });
    node.style.flex = tokens + " 1 0";
    return node;
  }

  function turnLabel(row) {
    const n = row.index + 1;
    if (row.kind === "cold") return "Turn " + n + " · first prefill";
    if (row.kind === "hit") return "Turn " + n + " · cache hit";
    if (row.kind === "timestamp") return "Turn " + n + " · cache miss";
    if (row.kind === "edit") return "Turn " + n + " · edited prefix";
    return "Turn " + n + " · full re-read";
  }

  function paintTimeline(result) {
    const root = $("timeline");
    root.replaceChildren();
    result.rows.forEach((row) => {
      const bar = el("div", {
        class: "bar",
        role: "img",
        "aria-label": turnLabel(row) + ". " + commas(row.cachedTokens) + " cached prefix tokens. " + commas(row.recomputedPrefixTokens) + " recomputed prefix tokens. " + commas(row.newTokens) + " new tokens. " + formatSeconds(row.ttftSeconds) + " simulated to the first word.",
      }, [
        segment("cached", row.cachedTokens),
        segment("recompute", row.recomputedPrefixTokens),
        segment("new", row.newTokens),
      ]);
      const card = el("article", { class: "turn", id: "turn-" + row.index }, [
        el("h3", { text: turnLabel(row) }),
        el("p", { class: "who", text: "Paralegal" }),
        el("p", { class: "bubble", text: row.question }),
        bar,
        el("p", { class: "counts", text: commas(row.cachedTokens) + " cached · " + commas(row.recomputeTokens) + " recomputed · " + formatSeconds(row.ttftSeconds) + " simulated" }),
        el("p", { class: "kind hint", text: kindCopy(row, result) }),
        el("p", { class: "who", text: "Local model" }),
        el("p", { class: "bubble", text: row.answer }),
      ]);
      root.append(card);
    });
  }

  function paintMix(result) {
    const mix = $("mix");
    const legend = $("mix-legend");
    const contract = result.input.contractTokens;
    const stamp = result.input.breaker === "timestamp" ? model.TIMESTAMP_TOKENS : 0;
    mix.replaceChildren();
    if (stamp) {
      const piece = el("i", { class: "stamp" });
      piece.style.flex = stamp + " 1 0";
      mix.append(piece);
    }
    [["system", model.SYSTEM_TOKENS], ["letter", model.LETTER_TOKENS], ["contract", contract]].forEach(([name, tokens]) => {
      const piece = el("i", { class: name });
      piece.style.flex = tokens + " 1 0";
      mix.append(piece);
    });
    const parts = [
      commas(model.SYSTEM_TOKENS) + " firm instructions",
      commas(model.LETTER_TOKENS) + " engagement-letter template",
      commas(contract) + " pasted contract",
    ];
    if (stamp) parts.unshift(stamp + " clock tokens at the top, changed every turn");
    mix.setAttribute("aria-label", "Opening prefix. " + parts.join(". ") + ". " + commas(result.stableHead + stamp) + " tokens before the first question.");

    legend.replaceChildren();
    const items = [
      ["system", "Firm instructions · " + commas(model.SYSTEM_TOKENS)],
      ["letter", "Engagement letter · " + commas(model.LETTER_TOKENS)],
      ["contract", "Pasted contract · " + commas(contract)],
    ];
    if (stamp) items.unshift(["stamp", "Clock at the top · " + stamp]);
    items.forEach(([name, text]) => {
      legend.append(el("li", {}, [el("i", { class: "swatch " + name, "aria-hidden": "true" }), text]));
    });
  }

  function scoreCard(name, value, base, shown) {
    return el("p", { class: shown ? "score is-shown" : "score" }, [
      el("span", { class: "name", text: name }),
      el("strong", { text: value }),
      el("span", { class: "base", text: base }),
    ]);
  }

  function paintSummary(result) {
    const totals = result.totals;
    const showingCache = result.input.mode === "cache";
    $("summary").replaceChildren(
      scoreCard("No cache, all turns", formatSeconds(totals.nocacheSeconds), "simulated", !showingCache),
      scoreCard("Prefix cache, all turns", formatSeconds(totals.cacheSeconds), "simulated", showingCache),
      scoreCard("Speedup, all turns", formatSpeedup(totals.speedup), "simulated, no cache ÷ prefix cache", false),
      scoreCard("Speedup, follow-ups", formatSpeedup(totals.followupSpeedup), "simulated, after the cold first turn", false)
    );

    const width = totals.nocacheSeconds === 0 ? 0 : Math.max(0, Math.min(100, (totals.cacheSeconds / totals.nocacheSeconds) * 100));
    const bars = $("timebars");
    bars.replaceChildren();
    [
      ["No cache", "recompute", 100, formatSeconds(totals.nocacheSeconds)],
      ["Prefix cache", "cached", width, formatSeconds(totals.cacheSeconds)],
    ].forEach(([label, color, pct, value]) => {
      const fill = el("i", { class: color });
      fill.style.width = pct + "%";
      bars.append(el("div", { class: "time-row" }, [
        el("span", { text: label }),
        el("div", { class: "track", "aria-hidden": "true" }, [fill]),
        el("span", { text: value }),
      ]));
    });

    const cold = model.simulate(Object.assign({}, result.input, { mode: "nocache" })).rows[0].ttftSeconds;
    const follow = "Follow-ups alone: no cache " + formatSeconds(totals.followupNocacheSeconds) + ", prefix cache " + formatSeconds(totals.followupCacheSeconds) + ", both simulated. The first turn is " + formatSeconds(cold) + " either way.";
    $("speed-note").textContent = follow + (result.input.breaker === "timestamp"
      ? " With a timestamp at the top, the two modes match: the cache never hits."
      : result.input.breaker === "edit"
        ? (result.editRecovers
          ? " In the prefix-cache column, the edit spikes one follow-up, then the rewritten prefix hits again."
          : " The edit lands on the last turn, so the prefix-cache column has no later hit to show. Add a turn to see the cache recover.")
        : " With a stable prefix, a cached follow-up prefills " + model.QUESTION_TOKENS + " tokens.");
  }

  function paintMemory(result) {
    const mem = result.memory;
    const pct = Math.max(0, Math.min(100, mem.fractionOfMachine * 100));
    $("memory-readout").textContent = "About " + formatGB(mem.gigabytes) + " of KV, approximate";
    $("memory-fill").style.width = pct + "%";
    $("memory-track").setAttribute(
      "aria-label",
      "Approximate KV cache " + formatGB(mem.gigabytes) + " of 64 GB after " + commas(mem.contextTokens) + " tokens. Illustrative only."
    );
    $("memory-caption").textContent = commas(mem.contextTokens) + " tokens after the last scripted reply, times 262,144 bytes. That is " + pct.toFixed(1) + "% of the 64 GB track. Approximate, not a measurement.";
  }

  function paintReadouts(result) {
    const speed = result.input.prefillTokPerSec;
    const contract = result.input.contractTokens;
    const turns = result.input.turns;
    $("prefill-readout").textContent = commas(speed) + " tokens/sec";
    $("contract-readout").textContent = commas(contract) + " tokens";
    $("turns-readout").textContent = turns + (turns === 1 ? " turn" : " turns");
    setSlider($("prefill"), speed, commas(speed) + " tokens per second");
    setSlider($("contract"), contract, commas(contract) + " tokens");
    setSlider($("turns"), turns, turns + " turns");
    const ref = model.SOURCE.rereadTokens / speed;
    $("prefill-hint").textContent = commas(model.SOURCE.rereadTokens) + " tokens at this speed take " + formatSeconds(ref) + " in this simulation. The post reported " + model.SOURCE.rereadSeconds + "s for a 24K re-read.";
  }

  function setSlider(node, value, text) {
    node.value = String(value);
    node.setAttribute("aria-valuenow", String(value));
    node.setAttribute("aria-valuetext", text);
  }

  function paintBreaker(result) {
    const map = { none: "breaker-none", timestamp: "breaker-timestamp", edit: "breaker-edit" };
    Object.entries(map).forEach(([name, id]) => {
      $(id).setAttribute("aria-pressed", result.input.breaker === name ? "true" : "false");
    });
    const note = $("breaker-note");
    if (result.input.breaker === "timestamp") {
      note.textContent = "Each turn inserts a different “Current time” as the first 16 tokens. The rest of the prompt matches, and that is not enough. Time to the first word jumps back to a full re-read. The timeline clocks are fixed examples, not the time on this phone.";
    } else if (result.input.breaker === "edit") {
      const turnNo = result.editIndex + 1;
      note.textContent = "On turn " + turnNo + " the first question changes and the token count stays 40. Cached tokens stop at the contract. A timestamp at the top would have thrown the contract away too.";
    } else {
      note.textContent = "The prefix is identical across turns, so a cache hit is allowed after the first prefill.";
    }
  }

  function paintPlayNote(result) {
    const scale = model.ANIMATION_MS_PER_SIM_SECOND;
    const screenMs = result.rows.reduce((total, row) => total + row.ttftSeconds * scale, 0);
    const screen = screenMs < 1000 ? Math.round(screenMs) + " ms" : (screenMs / 1000).toFixed(1) + " seconds";
    const motion = reduceMotion()
      ? " Motion is reduced, so the replay does not pause."
      : " On this screen, 1 simulated second is " + scale + " ms. Replaying the mode you selected takes about " + screen + ".";
    $("play-note").textContent = "Play walks the turns and counts the simulated seconds up to each wait." + motion + " The numbers printed on the turns stay the full simulated seconds.";
  }

  function paintModes() {
    $("mode-nocache").setAttribute("aria-pressed", state.mode === "nocache" ? "true" : "false");
    $("mode-cache").setAttribute("aria-pressed", state.mode === "cache" ? "true" : "false");
  }

  function hideClock() {
    $("clock").hidden = true;
    $("meter").hidden = true;
    $("meter-fill").style.width = "0%";
    document.querySelectorAll(".turn.is-active").forEach((node) => node.classList.remove("is-active"));
  }

  function syncPlayButton() {
    const play = $("play");
    play.setAttribute("aria-pressed", state.playing ? "true" : "false");
    play.textContent = state.playing ? "Stop" : "Play the wait";
    $("step").disabled = state.playing;
  }

  function render() {
    state.playToken += 1;
    state.playing = false;
    state.stepIndex = 0;
    hideClock();
    syncPlayButton();
    const result = current();
    state.result = result;
    paintModes();
    paintReadouts(result);
    paintMix(result);
    paintBreaker(result);
    paintSummary(result);
    paintMemory(result);
    paintPlayNote(result);
    paintTimeline(result);
  }

  function announce(text) {
    $("live").textContent = text;
  }

  function runClock(row, token) {
    const totalMs = reduceMotion() ? 0 : row.ttftSeconds * model.ANIMATION_MS_PER_SIM_SECOND;
    const clock = $("clock");
    const meter = $("meter");
    const fill = $("meter-fill");
    clock.hidden = false;
    meter.hidden = false;
    const started = performance.now();
    announce(turnLabel(row) + ". Thinking for " + formatSeconds(row.ttftSeconds) + " simulated.");
    return new Promise((resolve) => {
      function frame(now) {
        if (token !== state.playToken) {
          resolve(false);
          return;
        }
        const t = totalMs <= 0 ? 1 : Math.min(1, (now - started) / totalMs);
        const shown = row.ttftSeconds * t;
        clock.textContent = turnLabel(row) + " · Thinking… " + formatSeconds(shown) + " simulated of " + formatSeconds(row.ttftSeconds);
        fill.style.width = (t * 100) + "%";
        if (t < 1) {
          requestAnimationFrame(frame);
          return;
        }
        resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }

  function mark(index, on) {
    const node = $("turn-" + index);
    if (!node) return;
    node.classList.toggle("is-active", on);
    if (on && !reduceMotion()) node.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  async function playAll() {
    if (state.playing) {
      state.playToken += 1;
      state.playing = false;
      hideClock();
      syncPlayButton();
      announce("Replay stopped.");
      return;
    }
    const token = state.playToken + 1;
    state.playToken = token;
    state.playing = true;
    syncPlayButton();
    const rows = state.result.rows;
    for (let i = 0; i < rows.length; i++) {
      if (token !== state.playToken) return;
      mark(i, true);
      const ok = await runClock(rows[i], token);
      mark(i, false);
      if (!ok) return;
    }
    if (token !== state.playToken) return;
    state.playing = false;
    hideClock();
    syncPlayButton();
    announce("Replay finished. The times on the turns are simulated.");
  }

  async function step() {
    if (state.playing || !state.result) return;
    const token = state.playToken + 1;
    state.playToken = token;
    state.playing = true;
    syncPlayButton();
    const i = state.stepIndex % state.result.rows.length;
    mark(i, true);
    const ok = await runClock(state.result.rows[i], token);
    mark(i, false);
    if (token !== state.playToken || !ok) return;
    state.stepIndex = (i + 1) % state.result.rows.length;
    state.playing = false;
    hideClock();
    syncPlayButton();
  }

  $("mode-nocache").addEventListener("click", () => {
    state.mode = "nocache";
    render();
  });
  $("mode-cache").addEventListener("click", () => {
    state.mode = "cache";
    render();
  });
  $("breaker-none").addEventListener("click", () => {
    state.breaker = "none";
    render();
  });
  $("breaker-timestamp").addEventListener("click", () => {
    state.breaker = "timestamp";
    render();
  });
  $("breaker-edit").addEventListener("click", () => {
    state.breaker = "edit";
    render();
  });
  $("prefill").addEventListener("input", () => {
    state.prefillTokPerSec = Number($("prefill").value);
    render();
  });
  $("contract").addEventListener("input", () => {
    state.contractTokens = Number($("contract").value);
    render();
  });
  $("turns").addEventListener("input", () => {
    state.turns = Number($("turns").value);
    render();
  });
  $("play").addEventListener("click", () => {
    playAll();
  });
  $("step").addEventListener("click", () => {
    step();
  });
  $("reset").addEventListener("click", () => {
    state.prefillTokPerSec = model.DEFAULTS.prefillTokPerSec;
    state.contractTokens = model.DEFAULTS.contractTokens;
    state.turns = model.DEFAULTS.turns;
    state.mode = model.DEFAULTS.mode;
    state.breaker = model.DEFAULTS.breaker;
    render();
    announce("Reset to the default simulation.");
  });

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.addEventListener) motion.addEventListener("change", render);

  render();
})();
