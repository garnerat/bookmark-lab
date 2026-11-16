(function () {
  const model = globalThis.StreamingVoiceOrder;
  if (!model) return;

  const $ = (id) => document.getElementById(id);

  const state = {
    applyMode: model.DEFAULTS.applyMode,
    speed: model.DEFAULTS.speed,
    latency: model.DEFAULTS.modelLatencyMs,
    runId: 0,
    source: "preview",
    playing: false,
    listening: false,
    phase: "idle",
    history: [],
    stream: model.emptyState(),
    streamLog: [],
    endItems: [],
    endAt: null,
    endShown: false,
    endFresh: false,
    transcript: "",
    rewriteNote: "",
    drinkWordAt: null,
    sessionStart: 0,
    modelWait: model.DEFAULTS.modelLatencyMs,
    lastAnnounce: "",
  };

  let silenceTimer = 0;
  let modelTimer = 0;
  let stepTimer = 0;
  let recognition = null;

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function speechCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key) => {
      if (attrs[key] == null || attrs[key] === false) return;
      if (key === "class") node.className = attrs[key];
      else if (key === "text") node.textContent = String(attrs[key]);
      else node.setAttribute(key, String(attrs[key]));
    });
    (children || []).forEach((child) => {
      if (child == null || child === false) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function wordsOf(text) {
    return model.splitWords(text);
  }

  function sameWords(left, right) {
    const a = wordsOf(left);
    const b = wordsOf(right);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
    return true;
  }

  function extendsWords(prev, next) {
    const left = wordsOf(prev);
    const right = wordsOf(next);
    if (right.length < left.length) return false;
    for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) return false;
    return true;
  }

  function scale(ms) {
    const factor = model.SPEED[state.speed] || 1;
    return ms / factor;
  }

  function elapsed() {
    if (!state.sessionStart) state.sessionStart = performance.now();
    return performance.now() - state.sessionStart;
  }

  function clearTimers() {
    clearTimeout(silenceTimer);
    clearTimeout(modelTimer);
    clearTimeout(stepTimer);
  }

  function stopPlayback() {
    state.playing = false;
    clearTimers();
    state.runId += 1;
  }

  function stopMic() {
    state.listening = false;
    if (!recognition) return;
    try { recognition.onend = null; recognition.stop(); } catch (err) { /* already stopped */ }
    recognition = null;
  }

  function blankRun() {
    state.history = [];
    state.stream = model.emptyState();
    state.streamLog = [];
    state.endItems = [];
    state.endAt = null;
    state.endShown = false;
    state.endFresh = false;
    state.endPatches = [];
    state.transcript = "";
    state.rewriteNote = "";
    state.drinkWordAt = null;
  }

  function pushEvent(event) {
    state.history.push(event);
    const prev = state.stream;
    const next = model.applyHypothesis(prev, event.transcript, state.applyMode);
    const duplicate = event.type === "rewrite" && state.applyMode === "naive";
    const rows = model.diffVisible(prev, next, { duplicate: duplicate, patches: next.patches });
    rows.forEach((row) => {
      state.streamLog.push(Object.assign({ at: event.at, type: event.type }, row));
    });
    state.stream = next;
    state.transcript = event.transcript;
    if (event.note) state.rewriteNote = event.note;
    if (!next.items.some((item) => item.kind === "drink")) state.drinkWordAt = null;
    else if (state.drinkWordAt == null) state.drinkWordAt = event.at;
  }

  function replayHistory() {
    const history = state.history.slice();
    state.history = [];
    state.stream = model.emptyState();
    state.streamLog = [];
    state.drinkWordAt = null;
    state.transcript = "";
    state.rewriteNote = "";
    history.forEach((event) => pushEvent(event));
  }

  function revealEnd(at) {
    const parsed = model.parseTranscript(state.transcript);
    state.endItems = parsed.items;
    state.endPatches = model.diffVisible(model.emptyState(), parsed, { patches: parsed.patches });
    state.endShown = true;
    state.endFresh = true;
    state.endAt = at;
    state.phase = "shown";
    state.playing = false;
    render();
    announce();
  }

  function armLiveEnd() {
    clearTimeout(silenceTimer);
    clearTimeout(modelTimer);
    const run = state.runId;
    state.phase = "speaking";
    state.endFresh = false;
    silenceTimer = setTimeout(() => {
      if (run !== state.runId) return;
      const latency = state.latency;
      state.modelWait = latency;
      state.phase = "model";
      render();
      modelTimer = setTimeout(() => {
        if (run !== state.runId) return;
        revealEnd(elapsed());
      }, latency);
    }, model.SILENCE_MS);
    render();
  }

  function beginLive() {
    stopPlayback();
    state.runId += 1;
    state.source = "live";
    state.phase = "speaking";
    state.sessionStart = performance.now();
    blankRun();
  }

  function acceptLive(text, origin) {
    if (state.source !== "live") beginLive();
    if (!sameWords(state.transcript, text)) {
      const type = extendsWords(state.transcript, text) ? "word" : "rewrite";
      pushEvent({ at: elapsed(), type: type, word: null, transcript: text });
    }
    if (origin === "mic" && $("utterance").value !== text) $("utterance").value = text;
    armLiveEnd();
    announce();
  }

  function playSample() {
    if (state.playing) {
      stopPlayback();
      state.phase = state.history.length ? "idle" : "idle";
      render();
      return;
    }
    stopMic();
    clearTimers();
    state.runId += 1;
    const run = state.runId;
    state.playing = true;
    state.source = "sample";
    state.phase = "speaking";
    state.sessionStart = performance.now();
    blankRun();
    $("utterance").value = "";
    const events = model.sampleEvents();
    let index = 0;

    const step = () => {
      if (run !== state.runId) return;
      pushEvent(events[index]);
      index += 1;
      render();
      announce();
      if (index >= events.length) {
        const last = events[events.length - 1];
        state.phase = "silence";
        render();
        silenceTimer = setTimeout(() => {
          if (run !== state.runId) return;
          const latency = state.latency;
          state.modelWait = latency;
          state.phase = "model";
          state.endAt = last.at + model.SILENCE_MS + latency;
          render();
          modelTimer = setTimeout(() => {
            if (run !== state.runId) return;
            revealEnd(last.at + model.SILENCE_MS + latency);
          }, scale(latency));
        }, scale(model.SILENCE_MS));
        return;
      }
      stepTimer = setTimeout(step, scale(events[index].at - events[index - 1].at));
    };
    step();
  }

  function resetAll() {
    stopMic();
    stopPlayback();
    state.runId += 1;
    state.source = "preview";
    state.phase = "idle";
    state.speed = state.speed;
    blankRun();
    $("utterance").value = "";
    $("mic-note").textContent = speechCtor()
      ? "The microphone is optional. SpeechRecognition is off until you press the button."
      : "This browser has no SpeechRecognition. The sample and the text box still run on this page.";
    render();
    announce();
  }

  function setMode(mode) {
    state.applyMode = mode === "naive" ? "naive" : "rederive";
    if (state.history.length) replayHistory();
    render();
    announce();
  }

  function setSpeed(speed) {
    state.speed = speed === "fast" ? "fast" : "normal";
    render();
  }

  function readLatency(value) {
    const next = model.clampLatency(value);
    state.latency = next;
    if (state.phase === "model") {
      clearTimeout(modelTimer);
      const run = state.runId;
      state.modelWait = next;
      const scripted = state.source !== "live";
      modelTimer = setTimeout(() => {
        if (run !== state.runId) return;
        const last = model.sampleEvents()[model.sampleEvents().length - 1];
        revealEnd(scripted ? last.at + model.SILENCE_MS + next : elapsed());
      }, scripted ? scale(next) : next);
    }
    render();
  }

  function prediction() {
    return model.simulate({ applyMode: state.applyMode, modelLatencyMs: state.latency });
  }

  function currentMark() {
    if (!state.history.length) return -1;
    return state.history[state.history.length - 1].at;
  }

  function view() {
    if (state.source === "live" && state.history.length) {
      const changes = state.streamLog.map((row) => ({
        at: row.at,
        label: model.labelPatch(row),
        duplicate: !!row.duplicate,
        streamLatencyMs: 0,
        endLatencyMs: state.endShown && state.endFresh ? state.endAt - row.at : null,
        happened: true,
      }));
      const drinkSeen = state.drinkWordAt;
      return {
        kind: "live",
        drinkWordAt: drinkSeen,
        drinkStreamMs: drinkSeen == null ? null : 0,
        drinkEndMs: state.endShown && state.endFresh && drinkSeen != null ? state.endAt - drinkSeen : null,
        endAt: state.endShown && state.endFresh ? state.endAt : null,
        speechMs: state.history.length ? currentMark() : null,
        changes: changes,
        latteCount: model.countName(state.stream.items, "latte"),
        caption: "Times are this run, measured from the first word on this page.",
      };
    }
    const sim = prediction();
    const mark = state.source === "sample" ? currentMark() : -1;
    return {
      kind: "sample",
      drinkWordAt: sim.drinkWordAt,
      drinkStreamMs: sim.streaming.drinkLatencyMs,
      drinkEndMs: sim.endOfTurn.drinkLatencyMs,
      endAt: sim.endRenderAt,
      speechMs: sim.speechMs,
      stillSpeakingMs: sim.stillSpeakingMs,
      silenceAt: sim.silenceAt,
      changes: sim.streaming.changes.map((row) => ({
        at: row.at,
        label: row.label,
        duplicate: !!row.duplicate,
        streamLatencyMs: row.streamLatencyMs,
        endLatencyMs: row.endLatencyMs,
        happened: mark >= row.at,
      })),
      latteCount: sim.streaming.latteCount,
      endLatteCount: sim.endOfTurn.latteCount,
      caption: state.source === "preview"
        ? "Predicted for the sample at 150 words per minute, before you press play. The end-of-turn ticket stays empty until the silence and the model wait finish."
        : "Sample times stay at 150 words per minute. Fast only compresses the wait.",
    };
  }

  function cap(value) {
    return String(value || "").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  function pendingLine(pending) {
    if (!pending) return "";
    const bits = [];
    if (pending.size) bits.push(cap(pending.size));
    if (pending.milk) bits.push(cap(pending.milk) + " milk");
    if (pending.temp) bits.push(cap(pending.temp));
    if (pending.extraShot) bits.push("Extra shot");
    (pending.syrups || []).forEach((syrup) => bits.push(cap(syrup)));
    return bits.join(" · ");
  }

  function renderTicket(node, items, pending, mode) {
    clearNode(node);
    const naiveBad = mode === "stream" && state.applyMode === "naive" && model.countName(items, "latte") > 1;
    node.classList.toggle("warn", naiveBad);
    const pill = mode === "stream"
      ? (state.phase === "speaking" || state.playing ? "Live" : "Streaming")
      : (state.phase === "model" ? "Model" : state.phase === "silence" ? "Silence" : state.endShown && state.endFresh ? "On the ticket" : state.endShown ? "Stale" : "Waiting");
    const pillClass = mode === "stream"
      ? (naiveBad ? "pill bad" : "pill live")
      : (state.endShown && state.endFresh ? "pill live" : "pill wait");
    node.append(el("div", { class: "ticket-top" }, [
      el("p", { class: "shop", text: "Ember & Oak" }),
      el("p", { class: pillClass, text: pill }),
    ]));
    node.append(el("hr", { class: "rule" }));
    if (!items.length && !(mode === "stream" && pendingLine(pending))) {
      const waiting = mode === "end" && (state.phase === "silence" || state.phase === "model" || state.phase === "speaking");
      const drinkShown = state.stream.items.some((item) => item.kind === "drink");
      node.append(el("p", {
        class: "empty",
        text: waiting
          ? (drinkShown
            ? "Waiting. The drink is already on the streaming ticket."
            : "Waiting for the sentence to finish.")
          : "Nothing on the ticket yet.",
      }));
      return;
    }
    items.forEach((item) => {
      const described = model.describeItem(item);
      const mods = described.mods.map((mod) => el("span", { class: "chip", text: mod }));
      node.append(el("div", { class: "item" }, [
        el("div", { class: "item-name", text: described.title }),
        mods.length ? el("div", { class: "mods" }, mods) : null,
      ]));
    });
    const ghost = mode === "stream" ? pendingLine(pending) : "";
    if (ghost) node.append(el("p", { class: "ghost", text: "Hearing " + ghost }));
  }

  function renderLog(node, rows, atFor) {
    clearNode(node);
    if (!rows.length) {
      node.append(el("li", {}, [
        el("span", { class: "when", text: "—" }),
        el("span", { class: "what", text: "No patches yet." }),
      ]));
      return;
    }
    rows.forEach((row) => {
      const label = row.label || model.labelPatch(row);
      node.append(el("li", {}, [
        el("span", { class: "when", text: model.formatClock(atFor(row)) }),
        el("span", { class: row.duplicate ? "what dup" : "what", text: label }),
      ]));
    });
  }

  function renderScores(data) {
    const scores = $("scores");
    clearNode(scores);
    const streamValue = data.drinkStreamMs == null ? "—" : model.formatMs(data.drinkStreamMs);
    const endValue = data.drinkEndMs == null ? "Waiting" : model.formatMs(data.drinkEndMs);
    const streamBase = data.drinkWordAt == null
      ? "No drink in this run yet."
      : data.kind === "live"
        ? "Painted on the same turn as the word, at " + model.formatClock(data.drinkWordAt) + "."
        : "From the word at " + model.formatClock(data.drinkWordAt) + ". The customer is still mid-sentence.";
    const endBase = data.endAt == null
      ? "The ticket paints after 700 ms of silence plus the model delay."
      : "The drink shows up at " + model.formatClock(data.endAt) + ".";
    scores.append(el("div", { class: "score stream" }, [
      el("span", { class: "name", text: "Time until the customer sees their drink · streaming" }),
      el("strong", { text: streamValue }),
      el("span", { class: "base", text: streamBase }),
    ]));
    scores.append(el("div", { class: "score end" }, [
      el("span", { class: "name", text: "Time until the customer sees their drink · end of turn" }),
      el("strong", { text: endValue }),
      el("span", { class: "base", text: endBase }),
    ]));
  }

  function renderTable(data) {
    const body = $("gaps").querySelector("tbody");
    clearNode(body);
    $("gaps-caption").textContent = data.caption;
    if (!data.changes.length) {
      const row = el("tr", {}, [
        el("td", { text: "Nothing has changed the ticket yet." }),
        el("td", { text: "—" }),
        el("td", { text: "—" }),
      ]);
      row.children[0].colSpan = 1;
      body.append(row);
      return;
    }
    data.changes.forEach((change) => {
      const streamText = model.formatMs(change.streamLatencyMs) + " · " + model.formatClock(change.at);
      const endText = change.endLatencyMs == null
        ? "Waiting"
        : model.formatMs(change.endLatencyMs) + " · " + model.formatClock(change.at + change.endLatencyMs);
      const row = el("tr", { class: change.happened ? "is-now" : "" }, [
        el("td", { text: change.label }),
        el("td", { text: streamText }),
        el("td", { text: endText }),
      ]);
      body.append(row);
    });
  }

  function renderTimeline(data) {
    const total = data.endAt || (data.speechMs ? data.speechMs + model.SILENCE_MS + state.latency : prediction().endRenderAt);
    const place = (id, at) => {
      const mark = $(id);
      if (at == null || !total) {
        mark.hidden = true;
        return;
      }
      mark.hidden = false;
      mark.style.left = Math.max(0, Math.min(100, (at / total) * 100)) + "%";
    };
    const streamAt = data.drinkWordAt == null ? null : data.drinkWordAt + (data.drinkStreamMs || 0);
    place("mark-stream", streamAt);
    place("mark-speech", data.speechMs);
    place("mark-end", data.endAt == null ? total : data.endAt);
    const drink = data.drinkWordAt == null ? "no drink yet" : "the drink word is at " + model.formatClock(data.drinkWordAt);
    const end = data.endAt == null ? "end of turn has not painted" : "end of turn paints at " + model.formatClock(data.endAt);
    $("timeline-desc").textContent = "Timeline. " + drink + ". " + end + ".";
  }

  function statusText() {
    if (state.phase === "listening") return "Listening. The streaming ticket updates when a word arrives. End of turn waits for silence.";
    if (state.phase === "speaking" && state.playing) return "Speaking the sample. Streaming is updating. End of turn is waiting for silence.";
    if (state.phase === "speaking") return "Words are arriving. Streaming is updating. End of turn is waiting for 700 ms of silence.";
    if (state.phase === "silence") return "700 ms of silence, then the model wait. The streaming ticket already has the drink if it was named.";
    if (state.phase === "model") return "Model latency " + model.formatMs(state.modelWait) + ". Streaming painted on the words. End of turn has not.";
    if (state.phase === "shown") return "End of turn painted the ticket.";
    return "Play the sample, type an order, or start the microphone. The microphone is optional.";
  }

  function render() {
    const data = view();
    $("play").textContent = state.playing ? "Stop sample" : "Play sample utterance";
    $("play").setAttribute("aria-pressed", state.playing ? "true" : "false");
    $("mic").textContent = state.listening ? "Stop microphone" : "Start microphone";
    $("mic").setAttribute("aria-pressed", state.listening ? "true" : "false");
    $("mic").disabled = !speechCtor();
    $("mode-rederive").setAttribute("aria-pressed", state.applyMode === "rederive" ? "true" : "false");
    $("mode-naive").setAttribute("aria-pressed", state.applyMode === "naive" ? "true" : "false");
    $("speed-normal").setAttribute("aria-pressed", state.speed === "normal" ? "true" : "false");
    $("speed-fast").setAttribute("aria-pressed", state.speed === "fast" ? "true" : "false");
    $("latency").value = String(state.latency);
    $("latency").setAttribute("aria-valuenow", String(state.latency));
    $("latency").setAttribute("aria-valuetext", model.formatMs(state.latency));
    $("latency-readout").textContent = model.formatMs(state.latency);

    $("play-note").textContent = reducedMotion()
      ? "Speaking pace is 150 words per minute. Fast compresses that clock. Nothing slides."
      : "Speaking pace is about 150 words per minute. Fast compresses the same clock. The times in the table stay at speaking pace.";

    if (!state.transcript) {
      $("heard").textContent = "Sample sentence: " + model.SAMPLE_SENTENCE;
    } else {
      $("heard").textContent = "Hypothesis: " + state.transcript;
    }
    const rewrite = $("rewrite-note");
    if (state.rewriteNote) {
      rewrite.hidden = false;
      rewrite.textContent = state.rewriteNote;
    } else {
      rewrite.hidden = true;
      rewrite.textContent = "";
    }
    $("status").textContent = statusText();

    const sim = prediction();
    const liveCount = model.countName(state.stream.items, "latte");
    if (state.source === "live" && liveCount > 1) {
      $("gotcha-count").textContent = "Streaming ticket now has " + liveCount + " lattes. The re-derive path would keep a single parse of the current hypothesis.";
    } else if (state.applyMode === "naive") {
      $("gotcha-count").textContent = "On the sample, naive append ends at " + sim.streaming.latteCount + " lattes. End of turn still parses once, so it keeps " + sim.endOfTurn.latteCount + ".";
    } else {
      $("gotcha-count").textContent = "On the sample, re-derive ends at " + sim.streaming.latteCount + " latte. The rewrite at " + model.formatClock(sim.drinkWordAt + model.REWRITE_MS) + " does not add another.";
    }

    const still = sim.stillSpeakingMs;
    $("gap-note").textContent = "Sample sentence, for scale. Last word at " + model.formatClock(sim.speechMs)
      + " + " + model.formatMs(model.SILENCE_MS) + " of silence + "
      + model.formatMs(state.latency) + " model = drink at " + model.formatClock(sim.endRenderAt)
      + ". Streaming shows it at " + model.formatClock(sim.drinkWordAt)
      + ", and the customer keeps talking for " + model.formatClock(still) + " after that word.";

    renderScores(data);
    renderTimeline(data.kind === "live" && data.endAt == null
      ? Object.assign({}, data, { endAt: null, speechMs: data.speechMs })
      : data);
    renderTable(data);

    const showStream = state.source === "preview" ? [] : state.stream.items;
    const showPending = state.source === "preview" ? model.emptyState().pending : state.stream.pending;
    renderTicket($("stream-ticket"), showStream, showPending, "stream");
    const endItems = state.endShown ? state.endItems : [];
    renderTicket($("end-ticket"), endItems, null, "end");

    const streamRows = state.source === "preview" ? [] : state.streamLog;
    renderLog($("stream-log"), streamRows, (row) => row.at);
    if (state.endShown && state.endFresh) {
      renderLog($("end-log"), state.endPatches || [], () => state.endAt);
    } else if (state.endShown && !state.endFresh) {
      renderLog($("end-log"), [{ label: "Stale ticket. A new word arrived, so this column is waiting again.", at: state.endAt, duplicate: false }], (row) => row.at);
    } else {
      renderLog($("end-log"), [], () => 0);
    }
  }

  function announce() {
    const stream = state.source === "preview" ? "empty" : model.summary(state.stream.items);
    const end = state.endShown && state.endFresh ? model.summary(state.endItems) : "waiting";
    const text = "Streaming ticket: " + stream + ". End of turn: " + end + ".";
    if (text === state.lastAnnounce) return;
    state.lastAnnounce = text;
    $("live").textContent = text;
  }

  function micMessage(code) {
    if (code === "not-allowed" || code === "service-not-allowed") {
      return "Microphone permission was blocked. The sample and the text box still work.";
    }
    if (code === "audio-capture") return "No microphone was found. The sample and the text box still work.";
    if (code === "network") return "This browser's recognizer did not connect. The sample and the text box stay on this page.";
    if (code === "no-speech") return "No speech yet. Keep going, or use the sample.";
    if (code === "aborted") return "Microphone stopped.";
    return "Microphone stopped (" + code + "). The sample and the text box still work.";
  }

  function startMic() {
    const Ctor = speechCtor();
    if (!Ctor) return;
    if (state.listening) {
      stopMic();
      $("mic-note").textContent = "Microphone off. The ticket keeps what it already heard.";
      render();
      return;
    }
    stopPlayback();
    state.runId += 1;
    state.source = "live";
    state.phase = "listening";
    state.sessionStart = performance.now();
    blankRun();
    $("utterance").value = "";
    recognition = new Ctor();
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript;
      acceptLive(text, "mic");
    };
    recognition.onerror = (event) => {
      const code = event && event.error ? event.error : "error";
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        state.listening = false;
      }
      $("mic-note").textContent = micMessage(code);
      render();
    };
    recognition.onend = () => {
      if (!state.listening || !recognition) return;
      try { recognition.start(); } catch (err) {
        state.listening = false;
        $("mic-note").textContent = "Microphone stopped. The sample and the text box still work.";
        render();
      }
    };
    try {
      recognition.start();
      state.listening = true;
      $("mic-note").textContent = "Listening. Interim words update the streaming ticket. This page does not upload the order. A browser recognizer may use its own service.";
    } catch (err) {
      state.listening = false;
      recognition = null;
      $("mic-note").textContent = "The microphone did not start. Use the sample or the text box.";
    }
    render();
  }

  function copySnippet() {
    const text = $("snippet").textContent;
    const note = $("copy-note");
    const fallback = () => {
      const range = document.createRange();
      range.selectNodeContents($("snippet"));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      note.textContent = "Select the snippet and copy it.";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        note.textContent = "Copied.";
      }, fallback);
      return;
    }
    fallback();
  }

  $("play").addEventListener("click", playSample);
  $("reset").addEventListener("click", resetAll);
  $("mic").addEventListener("click", startMic);
  $("mode-rederive").addEventListener("click", () => setMode("rederive"));
  $("mode-naive").addEventListener("click", () => setMode("naive"));
  $("speed-normal").addEventListener("click", () => setSpeed("normal"));
  $("speed-fast").addEventListener("click", () => setSpeed("fast"));
  $("copy").addEventListener("click", copySnippet);
  $("latency").addEventListener("input", (event) => readLatency(event.target.value));
  $("utterance").addEventListener("input", (event) => {
    if (state.listening) {
      stopMic();
      $("mic-note").textContent = "Microphone off while you type. Press start to listen again.";
    }
    acceptLive(event.target.value, "type");
  });

  if (!speechCtor()) {
    $("mic").disabled = true;
    $("mic-note").textContent = "This browser has no SpeechRecognition. The sample and the text box still run on this page.";
  }

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.addEventListener) motion.addEventListener("change", render);

  render();
  announce();
})();
