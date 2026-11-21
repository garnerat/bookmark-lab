(function () {
  "use strict";

  const model = globalThis.Funnel;
  const $ = function (id) { return document.getElementById(id); };

  const state = {
    skipRevalidation: false,
    skipMatchers: false,
    regexOnly: false,
    stage: "report",
    openId: null,
  };

  let booted = false;

  function h(tag, attrs) {
    const node = document.createElement(tag);
    const opts = attrs || {};
    Object.keys(opts).forEach(function (key) {
      const value = opts[key];
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value == null ? "" : String(value);
      else if (value != null && value !== false) node.setAttribute(key, value === true ? "" : String(value));
    });
    for (let i = 2; i < arguments.length; i += 1) {
      const child = arguments[i];
      if (child == null || child === false) continue;
      node.append(child);
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function badge(text, kind) {
    return h("span", { class: "badge badge-" + kind, text: text });
  }

  function meter(stage, fileCount) {
    const track = h("span", { class: "meter", "aria-hidden": "true" });
    const fill = h("span");
    const width = stage.skipped || stage.count === 0 ? 0 : Math.max(8, Math.round((stage.count / fileCount) * 100));
    fill.style.width = width + "%";
    track.append(fill);
    return track;
  }

  function stageButton(stage, on, fileCount) {
    const btn = h("button", {
      type: "button",
      id: "stage-" + stage.id,
      class: "stage" + (on ? " is-on" : "") + (stage.skipped ? " is-off" : ""),
      "data-stage": stage.id,
      "aria-pressed": on ? "true" : "false",
    });
    const names = h("span", { class: "stage-names" });
    names.append(h("span", { class: "stage-k", text: stage.kicker }), h("span", { class: "stage-t", text: stage.title }));
    const top = h("span", { class: "stage-top" });
    top.append(names, h("span", { class: "stage-n", text: stage.skipped ? "off" : String(stage.count) }));
    btn.append(top, meter(stage, fileCount), h("span", { class: "stage-h", text: stage.hint }));
    return btn;
  }

  function itemButton(card, open) {
    const btn = h("button", {
      type: "button",
      id: "item-" + card.id,
      class: "item-btn" + (open ? " is-open" : ""),
      "data-file": card.id,
      "aria-expanded": open ? "true" : "false",
      "aria-controls": "panel-" + card.id,
    });
    const top = h("span", { class: "item-top" });
    top.append(h("span", { class: "item-title", text: card.heading }), badge(card.badge, card.kind));
    btn.append(top, h("span", { class: "path", text: card.path }));
    return btn;
  }

  function panel(card) {
    const box = h("div", { class: "panel", id: "panel-" + card.id });
    box.append(h("pre", { text: card.code }));
    const list = h("dl");
    card.lines.forEach(function (line) {
      list.append(h("dt", { text: line.label }), h("dd", { text: line.text }));
    });
    box.append(list);
    return box;
  }

  function renderFunnel(result) {
    const root = $("funnel");
    clear(root);
    result.stages.forEach(function (stage) {
      root.append(stageButton(stage, stage.id === state.stage, result.counts.files));
    });
  }

  function renderCost(cost) {
    const root = $("cost");
    clear(root);
    const grid = h("div", { class: "cost-grid" });
    cost.cards.forEach(function (card) {
      const article = h("article", { class: "cost-card" + (card.active ? " is-active" : "") });
      article.append(h("h3", { text: card.title }));
      article.append(h("p", { class: "figure", text: card.figure }));
      article.append(h("p", { text: card.detail }));
      if (card.active) article.append(h("p", { class: "now", text: "This run" }));
      grid.append(article);
    });
    root.append(grid, h("p", { class: "hint", text: cost.formula }));
  }

  function renderGotcha(gotcha) {
    const root = $("gotcha");
    clear(root);
    if (!gotcha) return;
    const box = h("div", { class: "gotcha" });
    box.append(h("h3", { text: gotcha.title }));
    box.append(h("p", { text: gotcha.text }));
    gotcha.files.forEach(function (file) {
      box.append(h("p", { class: "path", text: file.path }));
      box.append(h("pre", { text: file.code }));
      box.append(h("button", {
        type: "button",
        "data-show-file": file.id,
        text: "Show this file in the candidate list",
      }));
    });
    root.append(box);
  }

  function renderList(result) {
    const stage = result.stages.find(function (item) { return item.id === state.stage; });
    const cards = result.cards[state.stage];
    const known = {};
    cards.forEach(function (card) { known[card.id] = true; });
    if (state.openId && !known[state.openId]) state.openId = null;

    $("list-heading").textContent = stage.title;
    let hint = stage.hint;
    if (state.stage === "surfaces") hint = hint + " " + result.surfaceLegend + ".";
    $("list-hint").textContent = hint;

    const root = $("list");
    clear(root);
    if (cards.length === 0) {
      root.append(h("p", { class: "empty", text: stage.empty || "Nothing is in this stage for the switches that are on." }));
      return;
    }
    cards.forEach(function (card) {
      const open = state.openId === card.id;
      const wrap = h("div", { class: "item" });
      wrap.append(itemButton(card, open));
      if (open) wrap.append(panel(card));
      root.append(wrap);
    });
  }

  function render() {
    const focusId = document.activeElement && document.activeElement.id;
    const result = model.run(state);
    $("summary").textContent = result.summary;
    $("toggle-revalidation").setAttribute("aria-pressed", state.skipRevalidation ? "true" : "false");
    $("toggle-matchers").setAttribute("aria-pressed", state.skipMatchers ? "true" : "false");
    $("toggle-regex").setAttribute("aria-pressed", state.regexOnly ? "true" : "false");
    renderFunnel(result);
    renderCost(result.cost);
    renderGotcha(result.gotcha);
    renderList(result);
    if (booted) $("live").textContent = result.summary;
    booted = true;
    if (focusId) {
      const next = document.getElementById(focusId);
      if (next) next.focus();
    }
  }

  function onClick(event) {
    const show = event.target.closest("[data-show-file]");
    if (show) {
      state.stage = "candidates";
      state.openId = show.getAttribute("data-show-file");
      render();
      const opened = document.getElementById("item-" + state.openId);
      if (opened && opened.scrollIntoView) opened.scrollIntoView({ block: "nearest" });
      return;
    }
    const stage = event.target.closest("[data-stage]");
    if (stage) {
      state.stage = stage.getAttribute("data-stage");
      state.openId = null;
      render();
      return;
    }
    const item = event.target.closest("button[data-file]");
    if (item) {
      const id = item.getAttribute("data-file");
      state.openId = state.openId === id ? null : id;
      render();
    }
  }

  function bindToggle(id, key) {
    $(id).addEventListener("click", function () {
      state[key] = !state[key];
      render();
    });
  }

  document.querySelector("main").addEventListener("click", onClick);
  bindToggle("toggle-revalidation", "skipRevalidation");
  bindToggle("toggle-matchers", "skipMatchers");
  bindToggle("toggle-regex", "regexOnly");

  $("copy-cmd").addEventListener("click", function () {
    const button = $("copy-cmd");
    const text = "npx deepsec init";
    function done(copied) {
      button.textContent = copied ? "Copied" : "Copy the command";
      $("live").textContent = copied ? "Copied npx deepsec init." : "The command is in the box above.";
      window.setTimeout(function () { button.textContent = "Copy the command"; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  });

  render();
})();
