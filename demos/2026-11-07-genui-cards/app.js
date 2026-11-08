(function () {
  const ui = globalThis.GenUI;
  const $ = (id) => document.getElementById(id);

  const state = {
    question: "schedule",
    presentation: "card",
    platform: "slack",
    guard: "valid",
    frames: [],
    index: -1,
    finalized: false,
    note: "",
  };
  let generation = 0;
  let autoplay = null;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = String(value);
      else node.setAttribute(key, String(value));
    });
    (children || []).forEach((child) => {
      if (child == null) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function prepared() {
    return ui.prepare(state.question, state.guard);
  }

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function md(text) {
    const frag = document.createDocumentFragment();
    const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
    let last = 0;
    let match = re.exec(text);
    while (match) {
      if (match.index > last) frag.append(document.createTextNode(text.slice(last, match.index)));
      if (match[1] != null) frag.append(el("strong", { text: match[1] }));
      else frag.append(el("code", { text: match[2] }));
      last = match.index + match[0].length;
      match = re.exec(text);
    }
    if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
    return frag;
  }

  function press(selector, attr, value) {
    document.querySelectorAll(selector).forEach((button) => {
      button.setAttribute("aria-pressed", button.getAttribute(attr) === value ? "true" : "false");
    });
  }

  function syncPressed() {
    press("[data-question]", "data-question", state.question);
    press("[data-presentation]", "data-presentation", state.presentation);
    press("[data-platform]", "data-platform", state.platform);
    press("[data-guard]", "data-guard", state.guard);
  }

  function platformLabel() {
    if (state.platform === "slack") return "Slack-like";
    if (state.platform === "teams") return "Teams-like";
    return "Web card";
  }

  function guardCopy(pack) {
    const tables = ui.countType(pack.spec, "Table");
    if (state.guard === "bad") {
      return "These props are not in the catalog. toCard throws CardSpecError when the stream ends. The issues go back to the model.";
    }
    if (state.guard === "limits") {
      return "This spec has " + tables + " tables. toCard(spec, { limits: { tables: 1 } }) rejects it instead of posting a degraded card.";
    }
    if (state.guard === "degrade") {
      return "This spec has " + tables + " tables and no limits. The Slack adapter turns the second table into a code block. Teams and the web keep both tables.";
    }
    if (tables > 1) {
      return "toCard accepts this spec. It already has two tables, so a Slack-like card still degrades the second one unless you pass limits.";
    }
    return "toCard accepts this spec. Every element is in the catalog, and the props match.";
  }

  function statusText(pack) {
    const total = state.frames.length;
    if (state.index < 0) {
      return "Waiting for the root Card. An empty message is not posted.";
    }
    if (!state.finalized) {
      if (state.index === 0) {
        return "Posted. The root Card is on screen. The next edit waits " + ui.INTERVAL_MS + "ms.";
      }
      return "Editing the same message. " + state.index + " of " + (total - 1) + " blocks are in. Next edit in " + ui.INTERVAL_MS + "ms.";
    }
    const view = outcome(pack);
    if (view.error) {
      return "CardSpecError. " + view.error.issues.length + " issues go back to the model.";
    }
    if (view.degraded) return "Accepted, then the Slack adapter turned the second table into a code block.";
    return "Stream finished. toCard accepted the spec.";
  }

  function outcome(pack) {
    const frame = state.index >= 0 ? state.frames[state.index] : null;
    if (!frame) return { card: null, error: null, degraded: false };
    if (!state.finalized) {
      const partial = ui.present(ui.toPartialCard(frame), state.platform);
      return { card: partial, error: null, degraded: hasDegraded(partial) };
    }
    try {
      const card = ui.present(ui.toCard(pack.spec, { limits: pack.limits || undefined }), state.platform);
      return { card: card, error: null, degraded: hasDegraded(card) };
    } catch (error) {
      const partial = ui.present(ui.toPartialCard(frame), state.platform);
      return { card: partial, error: error, degraded: hasDegraded(partial) };
    }
  }

  function hasDegraded(card) {
    if (!card) return false;
    let found = false;
    function walk(node) {
      if (!node || found) return;
      if (node.degraded) found = true;
      (node.children || []).forEach(walk);
    }
    walk(card);
    return found;
  }

  function formatNum(value) {
    const text = String(value);
    if (text.indexOf(".") !== -1) return text;
    return text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function seriesChart(chart) {
    const series = chart.series || [];
    const categories = chart.categories || [];
    const max = Math.max.apply(
      null,
      series.reduce((all, item) => all.concat(item.values), [1]),
    );
    const width = 320;
    const height = 120;
    const step = categories.length === 1 ? width : width / (categories.length - 1);

    if (chart.type === "bar") {
      const rows = categories.map((category, index) => {
        const value = series[0] ? series[0].values[index] : 0;
        const row = el("div", { class: "bar-row" });
        row.append(el("span", { class: "bar-label", text: category }));
        const track = el("span", { class: "bar-track" });
        track.append(
          el("span", {
            class: "bar-fill",
            style: "width:" + Math.max(4, (value / max) * 100) + "%",
          }),
        );
        row.append(track);
        row.append(el("span", { class: "bar-value", text: formatNum(value) }));
        return row;
      });
      return el("div", { class: "bars" }, rows);
    }

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("class", "series-svg");
    svg.setAttribute("role", "img");
    const title = document.createElementNS(ns, "title");
    title.textContent = chart.type + " chart";
    svg.append(title);
    series.forEach((item, seriesIndex) => {
      const coords = item.values.map((value, index) => {
        const x = categories.length === 1 ? width / 2 : index * step;
        const y = height - (value / max) * (height - 8) - 4;
        return [x, y];
      });
      const line = coords.map((point) => point[0] + "," + point[1]).join(" ");
      if (chart.type === "area" && coords.length) {
        const poly = document.createElementNS(ns, "polygon");
        const last = coords[coords.length - 1];
        const first = coords[0];
        poly.setAttribute(
          "points",
          line + " " + last[0] + "," + (height - 2) + " " + first[0] + "," + (height - 2),
        );
        poly.setAttribute("class", "area-fill s" + seriesIndex);
        svg.append(poly);
      }
      const path = document.createElementNS(ns, "polyline");
      path.setAttribute("points", line);
      path.setAttribute("class", "series-line s" + seriesIndex);
      svg.append(path);
    });
    const labels = el(
      "div",
      { class: "axis" },
      categories.map((category, index) => {
        const value = series[0] ? series[0].values[index] : "";
        return el("span", {}, [el("b", { text: category }), el("small", { text: formatNum(value) })]);
      }),
    );
    return el("div", { class: "series" }, [svg, labels]);
  }

  function pieChart(chart) {
    const segments = chart.segments || [];
    const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "pie");
    svg.setAttribute("role", "img");
    const title = document.createElementNS(ns, "title");
    title.textContent = "Pie chart";
    svg.append(title);
    let angle = -Math.PI / 2;
    segments.forEach((segment, index) => {
      const sweep = (segment.value / total) * Math.PI * 2;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const large = sweep > Math.PI ? 1 : 0;
      const radius = 46;
      const x1 = 50 + radius * Math.cos(start);
      const y1 = 50 + radius * Math.sin(start);
      const x2 = 50 + radius * Math.cos(end);
      const y2 = 50 + radius * Math.sin(end);
      const path = document.createElementNS(ns, "path");
      path.setAttribute(
        "d",
        "M 50 50 L " + x1 + " " + y1 + " A " + radius + " " + radius + " 0 " + large + " 1 " + x2 + " " + y2 + " Z",
      );
      path.setAttribute("class", "slice s" + index);
      svg.append(path);
    });
    const legend = el(
      "ul",
      { class: "legend" },
      segments.map((segment, index) => {
        const pct = Math.round((segment.value / total) * 100);
        return el("li", {}, [
          el("i", { class: "swatch s" + index, "aria-hidden": "true" }),
          document.createTextNode(segment.label + " · " + segment.value + " · " + pct + "%"),
        ]);
      }),
    );
    return el("div", { class: "pie-wrap" }, [svg, legend]);
  }

  function chartNode(node, fresh) {
    const figure = el("figure", { class: "chart" + (fresh ? " just-in" : "") });
    figure.append(el("figcaption", { text: node.title + " · " + node.chart.type }));
    figure.append(node.chart.type === "pie" ? pieChart(node.chart) : seriesChart(node.chart));
    return figure;
  }

  function roofSketch(alt) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 320 140");
    svg.setAttribute("class", "roof");
    svg.setAttribute("role", "img");
    const title = document.createElementNS(ns, "title");
    title.textContent = alt;
    svg.append(title);
    const shapes = [
      ["rect", { x: "0", y: "0", width: "320", height: "140", class: "sky" }],
      ["polygon", { points: "40,78 160,28 280,78", class: "roof-plane" }],
      ["rect", { x: "70", y: "78", width: "180", height: "46", class: "wall" }],
      ["rect", { x: "148", y: "96", width: "24", height: "28", class: "door" }],
      ["circle", { cx: "250", cy: "36", r: "10", class: "sun" }],
    ];
    shapes.forEach((shape) => {
      const part = document.createElementNS(ns, shape[0]);
      Object.keys(shape[1]).forEach((key) => part.setAttribute(key, shape[1][key]));
      svg.append(part);
    });
    const figure = el("figure", { class: "photo" });
    figure.append(svg);
    figure.append(el("figcaption", { text: alt + " Drawn here. The URL in the spec is not fetched." }));
    return figure;
  }

  function tableNode(node, fresh) {
    if (node.degraded) {
      const wrap = el("div", { class: "degraded" + (fresh ? " just-in" : "") });
      wrap.append(
        el("p", {
          class: "degrade-note",
          text: "Slack adapter: this second table became a code block. Pass limits to reject the spec instead.",
        }),
      );
      if (node.caption) wrap.append(el("p", { class: "table-caption", text: node.caption }));
      wrap.append(el("pre", { class: "codeblock", text: node.code }));
      return wrap;
    }
    const wrap = el("div", { class: "table-scroll" + (fresh ? " just-in" : "") });
    if (node.caption) wrap.append(el("p", { class: "table-caption", text: node.caption }));
    const table = el("table");
    const head = el("tr", {}, node.headers.map((header, index) => el("th", { scope: "col", style: alignStyle(node.align, index), text: header })));
    table.append(el("thead", {}, [head]));
    const body = el("tbody");
    node.rows.forEach((row) => {
      const tr = el("tr");
      row.forEach((cell, index) => {
        const cellNode = el("td", { style: alignStyle(node.align, index) });
        cellNode.append(el("span", { class: "cell-label", text: node.headers[index] }));
        cellNode.append(document.createTextNode(String(cell)));
        tr.append(cellNode);
      });
      body.append(tr);
    });
    table.append(body);
    wrap.append(table);
    return wrap;
  }

  function alignStyle(align, index) {
    const value = align && align[index];
    if (value === "right" || value === "center") return "text-align:" + value;
    return "";
  }

  function cardBody(card, freshCount) {
    return card.children.map((child, index) => renderChild(child, index >= card.children.length - freshCount));
  }

  function renderChild(node, fresh) {
    if (node.type === "Text") {
      const p = el("p", { class: "card-text " + node.style + (fresh ? " just-in" : "") });
      p.append(md(node.content));
      return p;
    }
    if (node.type === "Fields") {
      return el(
        "div",
        { class: "fields" + (fresh ? " just-in" : "") },
        node.fields.map((field) =>
          el("div", { class: "field" }, [el("strong", { text: field.value }), el("span", { text: field.label })]),
        ),
      );
    }
    if (node.type === "Table") return tableNode(node, fresh);
    if (node.type === "Chart") return chartNode(node, fresh);
    if (node.type === "Divider") return el("hr", { class: fresh ? "just-in" : "" });
    if (node.type === "Image") {
      const figure = roofSketch(node.alt);
      if (fresh) figure.classList.add("just-in");
      return figure;
    }
    if (node.type === "Section") {
      return el("div", { class: "section" + (fresh ? " just-in" : "") }, node.children.map((child) => renderChild(child, false)));
    }
    if (node.type === "Actions") {
      const actions = el(
        "div",
        { class: "card-actions" + (fresh ? " just-in" : "") },
        node.buttons.map((button) => {
          const nodeButton = el("button", {
            type: "button",
            class: "card-button " + (button.style || "default"),
            text: button.label,
          });
          const detail = button.kind === "link" ? button.url : button.id;
          nodeButton.addEventListener("click", () => {
            state.note = "Example only. “" + button.label + "” is not sent. " + detail;
            $("action-note").textContent = state.note;
            const note = actions.querySelector(".action-result");
            if (note) note.textContent = state.note;
            else actions.append(el("p", { class: "action-result", text: state.note }));
          });
          return nodeButton;
        }),
      );
      if (state.note) actions.append(el("p", { class: "action-result", text: state.note }));
      return actions;
    }
    return el("p", { text: node.type });
  }

  function messageShell(inner) {
    const shell = el("div", { class: "msg " + state.platform });
    if (state.platform !== "web") {
      const who = el("div", { class: "who" });
      who.append(el("span", { class: "avatar", "aria-hidden": "true", text: "SA" }));
      const name = el("div", { class: "who-copy" });
      const line = el("p", { class: "who-name" });
      line.append(el("strong", { text: "Shop agent" }));
      line.append(el("span", { class: "app-badge", text: "APP" }));
      name.append(line);
      name.append(
        el("p", {
          class: "who-meta",
          text: state.platform === "slack" ? "Slack-like · Block Kit" : "Teams-like · Adaptive Card",
        }),
      );
      who.append(name);
      shell.append(who);
    } else {
      shell.append(el("p", { class: "who-meta web-label", text: "Web card · same spec" }));
    }
    shell.append(inner);
    return shell;
  }

  function errorBox(error) {
    const box = el("div", { class: "error-box", role: "alert" });
    box.append(el("h3", { text: error.name }));
    box.append(
      el("p", {
        text:
          state.guard === "limits"
            ? "The partial card was already on screen. toCard then rejected the finished spec. A bot would retry or edit the message."
            : "The readable issues below are what the model gets back, so it can send a corrected spec.",
      }),
    );
    box.append(el("ul", {}, error.issues.map((issue) => el("li", { text: issue }))));
    return box;
  }

  function renderStage(pack, view) {
    const stage = $("stage");
    stage.replaceChildren();
    if (view.error) stage.append(errorBox(view.error));

    if (state.presentation === "text") {
      const bubble = el("div", { class: "bubble prose" });
      bubble.append(el("p", { class: "card-text" }, [md(pack.prose)]));
      stage.append(messageShell(bubble));
      stage.append(
        el("p", {
          class: "hint",
          text: "This is the whole reply. Switch to the card to watch the same facts render from the spec.",
        }),
      );
    } else if (!view.card) {
      stage.append(
        messageShell(
          el("div", { class: "bubble waiting" }, [
            el("p", { text: "Waiting for the root Card. streamCard does not post an empty message." }),
          ]),
        ),
      );
    } else {
      const bubble = el("article", { class: "bubble card" });
      if (view.error) {
        bubble.append(
          el("p", {
            class: "partial-banner",
            text: "Partial message. The finished spec was rejected, so this should not stay up as the answer.",
          }),
        );
      }
      const header = el("header", { class: "card-head" });
      if (view.card.title) header.append(el("h3", { text: view.card.title }));
      if (view.card.subtitle) header.append(el("p", { text: view.card.subtitle }));
      bubble.append(header);
      const freshCount = state.finalized || state.index <= 0 ? 0 : 1;
      cardBody(view.card, freshCount).forEach((node) => bubble.append(node));
      stage.append(messageShell(bubble));
      if (view.degraded && !view.error) {
        stage.append(
          el("p", {
            class: "hint",
            text: "The spec is valid. Slack degraded the second table on the way out. Teams-like and the web card keep it as a table.",
          }),
        );
      }
    }

    $("action-note").textContent = state.note;
  }

  function renderSpec(pack) {
    const pre = $("spec");
    if (state.index < 0) {
      pre.textContent = "";
      $("spec-meta").textContent = "The model has not emitted the root yet.";
      return;
    }
    const shown = state.frames[state.index];
    pre.textContent = JSON.stringify(shown, null, 2);
    pre.scrollTop = pre.scrollHeight;
    const elements = Object.keys(shown.elements).length;
    $("spec-meta").textContent = state.finalized
      ? "Finished spec · " + elements + " elements · updateIntervalMs " + ui.INTERVAL_MS
      : "Streaming · " + elements + " elements so far · edits at most every " + ui.INTERVAL_MS + "ms";
  }

  function renderMeter() {
    const total = state.frames.length + 1;
    const done = state.index < 0 ? 0 : state.index + (state.finalized ? 2 : 1);
    $("meter").style.width = Math.min(100, (done / total) * 100) + "%";
  }

  function renderCatalog(pack) {
    const used = ui.usedTypes(pack.spec);
    document.querySelectorAll("#catalog li").forEach((item) => {
      const on = used.indexOf(item.dataset.type) !== -1;
      item.classList.toggle("used", on);
      const badge = item.querySelector(".badge");
      if (badge) badge.remove();
      if (on) item.append(el("span", { class: "badge", text: "In this answer" }));
    });
    const callout = document.querySelector('[data-banned="Callout"]');
    if (callout) callout.classList.toggle("used-bad", used.indexOf("Callout") !== -1);
  }

  function render() {
    const pack = prepared();
    const view = outcome(pack);
    syncPressed();
    $("facts").textContent = "Same facts either way: " + pack.facts + ". Example data.";
    $("guard-copy").textContent = guardCopy(pack);
    $("sticky-status").textContent = statusText(pack);
    $("compare-note").textContent =
      state.presentation === "card"
        ? platformLabel() + " is rendering the spec below. Flip the presentation and the facts stay put."
        : "Plain text ignores the catalog. The spec below is what the card is built from.";
    renderMeter();
    renderStage(pack, view);
    renderSpec(pack);
    renderCatalog(pack);
    if (state.finalized || state.index <= 0) $("live").textContent = statusText(pack);
  }

  function stopAutoplay() {
    if (!autoplay) return;
    autoplay.disconnect();
    autoplay = null;
  }

  async function play(force) {
    stopAutoplay();
    const gen = ++generation;
    const pack = prepared();
    state.frames = ui.framesOf(pack.spec);
    state.index = -1;
    state.finalized = false;
    state.note = "";
    render();
    const animate = force || !reducedMotion();
    if (!animate) return;
    for (let index = 0; index < state.frames.length; index += 1) {
      await wait(ui.INTERVAL_MS);
      if (gen !== generation) return;
      state.index = index;
      render();
    }
    await wait(ui.INTERVAL_MS);
    if (gen !== generation) return;
    state.finalized = true;
    render();
  }

  function finish() {
    stopAutoplay();
    generation += 1;
    const pack = prepared();
    state.frames = ui.framesOf(pack.spec);
    state.index = state.frames.length - 1;
    state.finalized = true;
    state.note = "";
    render();
  }

  function restart() {
    state.note = "";
    if (reducedMotion()) finish();
    else play(true);
  }

  document.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
      state.question = button.dataset.question;
      restart();
    });
  });
  document.querySelectorAll("[data-presentation]").forEach((button) => {
    button.addEventListener("click", () => {
      state.presentation = button.dataset.presentation;
      render();
    });
  });
  document.querySelectorAll("[data-platform]").forEach((button) => {
    button.addEventListener("click", () => {
      state.platform = button.dataset.platform;
      render();
    });
  });
  document.querySelectorAll("[data-guard]").forEach((button) => {
    button.addEventListener("click", () => {
      state.guard = button.dataset.guard;
      restart();
    });
  });
  $("replay").addEventListener("click", () => play(true));
  $("finish").addEventListener("click", finish);

  const motionNote = $("motion-note");
  state.frames = ui.framesOf(prepared().spec);
  render();
  if (reducedMotion()) {
    motionNote.hidden = false;
    finish();
  } else if ("IntersectionObserver" in window) {
    autoplay = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      stopAutoplay();
      play(false);
    }, { threshold: 0.2 });
    autoplay.observe($("stage"));
  } else {
    play(false);
  }
})();
