(function () {
  "use strict";

  var M = globalThis.SocraticTutorLab;
  var state = M.initialState();
  var fromUser = false;

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    var opts = attrs || {};
    Object.keys(opts).forEach(function (key) {
      if (key === "class") node.className = opts[key];
      else if (key === "text") node.textContent = opts[key];
      else node.setAttribute(key, opts[key]);
    });
    var i;
    for (i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child == null || child === false) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function announce(text) {
    $("live").textContent = text;
  }

  function renderProtocol(mode) {
    if (mode === "hidden") return null;
    var card = M.PROTOCOL;
    var body = el("div", { class: "protocol-body" });
    body.appendChild(el("p", { class: "disclaimer", text: card.disclaimer }));
    card.buckets.forEach(function (bucket) {
      var block = el("div", { class: "bucket bucket-" + bucket.id });
      block.appendChild(el("h3", { text: bucket.name }));
      var list = el("ul");
      bucket.items.forEach(function (item) {
        list.appendChild(el("li", { text: item }));
      });
      block.appendChild(list);
      body.appendChild(block);
    });
    body.appendChild(el("p", { class: "hint", text: card.emergencyNote }));
    if (mode === "collapsed") {
      var details = el("details", { class: "protocol" });
      details.appendChild(el("summary", { text: card.title }));
      details.appendChild(body);
      return details;
    }
    var open = el("div", { class: "protocol open" });
    open.appendChild(el("h3", { text: card.title }));
    open.appendChild(body);
    return open;
  }

  function renderMap(map) {
    var box = el("div", { class: "map-wrap" });
    var overall = el("p", { class: "map-overall" });
    overall.appendChild(el("span", { class: "map-k", text: "Topic: " + map.topic }));
    overall.appendChild(document.createTextNode(" "));
    overall.appendChild(el("span", { class: "map-bar", text: map.overallBar }));
    overall.appendChild(document.createTextNode(" " + map.overallPct + "% overall"));
    box.appendChild(overall);
    var list = el("ol", { class: "map" });
    map.rows.forEach(function (row) {
      var item = el("li", { class: row.moved ? "moved" : "" });
      if (row.mark === "<- current focus") item.className += (item.className ? " " : "") + "is-focus";
      var name = el("span", { class: "map-name", text: row.name });
      var meta = el("span", { class: "map-meta" });
      meta.appendChild(el("span", { class: "map-bar", text: row.bar }));
      meta.appendChild(document.createTextNode(" " + row.level + "/5 " + row.label));
      if (row.mark) meta.appendChild(el("span", { class: "map-mark", text: " " + row.mark }));
      item.appendChild(name);
      item.appendChild(meta);
      item.setAttribute("aria-label", row.name + ", " + row.level + " of 5, " + row.label + (row.mark ? ", " + row.mark : ""));
      list.appendChild(item);
    });
    box.appendChild(list);
    var ascii = el("details", { class: "ascii" });
    ascii.appendChild(el("summary", { text: "ASCII map, as the skill prints it" }));
    ascii.appendChild(el("pre", { class: "map-ascii", text: map.ascii }));
    box.appendChild(ascii);
    return box;
  }

  function renderSession() {
    var v = M.view(state);
    var root = $("session");
    clear(root);

    var mapFirst = v.phase === "map" || v.phase === "review-intro" || v.phase === "review-result" || v.phase === "done" || v.phase === "final-intro";

    if (v.map) {
      var ticker = el("div", { class: "ticker" });
      ticker.appendChild(el("span", { text: M.TOPIC }));
      ticker.appendChild(el("span", { class: "ticker-amount", text: v.map.overallPct + "%" }));
      root.appendChild(ticker);
    }

    v.lines.forEach(function (line) {
      if (!line) return;
      root.appendChild(el("p", { class: "tutor", text: line }));
    });

    if (v.progressNote && v.map) {
      root.appendChild(el("p", { class: "tutor", text: "Skill map. Overall " + v.map.overallPct + "%." }));
    }

    if (v.map && mapFirst) root.appendChild(renderMap(v.map));

    var protocol = renderProtocol(v.protocol);
    if (protocol && v.protocol === "open") root.appendChild(protocol);

    if (v.question) {
      var ask = el("div", { class: "ask", id: "ask" });
      var badges = el("p", { class: "badges" });
      badges.appendChild(el("span", { class: "badge", text: v.question.typeLabel }));
      if (v.question.kicker) badges.appendChild(el("span", { class: "badge badge-kicker", text: v.question.kicker }));
      if (v.question.index) {
        badges.appendChild(el("span", { class: "badge badge-quiet", text: v.question.index + " of " + v.question.total }));
      }
      ask.appendChild(badges);
      ask.appendChild(el("p", { class: "prompt", id: "question-prompt", tabindex: "-1", text: v.question.prompt }));
      var choices = el("div", { class: "choices", role: "group", "aria-label": "Answers" });
      v.question.choices.forEach(function (c) {
        choices.appendChild(el("button", {
          type: "button",
          "data-action": "answer",
          "data-id": c.id,
          text: c.label
        }));
      });
      ask.appendChild(choices);
      root.appendChild(ask);
    }

    if (v.actions.length) {
      var actions = el("div", { class: "choices" });
      v.actions.forEach(function (a) {
        var btn = el("button", {
          type: "button",
          "data-action": a.type,
          "data-id": a.id,
          text: a.label
        });
        if (a.suggested) btn.className = "suggested";
        if (a.type === "continue" || a.type === "restart") btn.className = "primary";
        actions.appendChild(btn);
      });
      root.appendChild(actions);
    }

    if (protocol && v.protocol !== "open") root.appendChild(protocol);

    if (v.map && !mapFirst) {
      var fold = el("details", { class: "map-fold" });
      var openMap = v.progressNote || v.map.rows.some(function (row) { return row.moved; });
      if (openMap) fold.setAttribute("open", "");
      fold.appendChild(el("summary", { text: "Skill map, " + v.map.overallPct + "% overall" }));
      fold.appendChild(renderMap(v.map));
      root.appendChild(fold);
    }

    if (v.utilities.progress || v.utilities.tell || v.utilities.save) {
      var utils = el("div", { class: "utils", role: "group", "aria-label": "Session commands" });
      if (v.utilities.progress) {
        utils.appendChild(el("button", { type: "button", "data-action": "progress", "data-id": "progress", text: "Show progress" }));
      }
      if (v.utilities.tell) {
        utils.appendChild(el("button", { type: "button", "data-action": "tell", "data-id": "tell", text: "Just tell me" }));
      }
      if (v.utilities.save) {
        utils.appendChild(el("button", { type: "button", "data-action": "save", "data-id": "save", text: "Save state" }));
      }
      root.appendChild(utils);
    }

    if (v.saveText) {
      var saved = el("div", { class: "saved" });
      saved.appendChild(el("p", { class: "hint", text: "Compact block for the skill's save command. In the skill, a new session continues if you paste it after \"resume from:\". This page does not restore a pasted block." }));
      saved.appendChild(el("pre", { text: v.saveText }));
      root.appendChild(saved);
    }

    var summary = v.question ? v.question.prompt : (v.lines[0] || "");
    announce(summary);

    if (fromUser) {
      var focusNode = state.progressNote
        ? (root.querySelector(".map-fold summary") || root.querySelector(".map-wrap"))
        : ($("question-prompt") || root.querySelector(".tutor") || root.querySelector("button"));
      if (state.saveText) focusNode = root.querySelector(".saved") || focusNode;
      if (focusNode && focusNode.focus) {
        if (!focusNode.hasAttribute("tabindex")) focusNode.setAttribute("tabindex", "-1");
        focusNode.focus();
        if (focusNode.scrollIntoView) focusNode.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function renderCompare() {
    var c = M.COMPARE;
    var root = $("compare");
    clear(root);
    root.appendChild(el("p", { text: c.setup }));
    root.appendChild(el("blockquote", {}, el("p", { text: c.learner })));
    root.appendChild(el("p", { class: "hint", text: c.skillNote }));

    var toggle = el("div", { class: "pair only-narrow", role: "group", "aria-label": "Which tutor to read" });
    toggle.appendChild(el("button", { type: "button", id: "mode-socratic", "aria-pressed": "true", text: "Socratic" }));
    toggle.appendChild(el("button", { type: "button", id: "mode-dump", "aria-pressed": "false", text: "Answer-dump" }));
    root.appendChild(toggle);

    var grid = el("div", { class: "compare-grid", id: "compare-grid", "data-mode": "socratic" });
    grid.appendChild(column(c.socratic, "col-socratic"));
    grid.appendChild(column(c.dump, "col-dump"));
    root.appendChild(grid);

    $("mode-socratic").addEventListener("click", function () { setMode("socratic"); });
    $("mode-dump").addEventListener("click", function () { setMode("dump"); });
  }

  function column(side, className) {
    var col = el("div", { class: "col " + className });
    col.appendChild(el("h3", { text: side.name }));
    col.appendChild(el("p", { class: "hint", text: "What the tutor says" }));
    col.appendChild(el("p", { text: side.reply }));
    col.appendChild(el("p", { class: "kicker-label", text: M.COMPARE.laterLabel }));
    col.appendChild(el("p", { text: M.COMPARE.laterCase }));
    col.appendChild(el("p", { class: "hint", text: "What that scripted learner says" }));
    col.appendChild(el("p", { text: side.learner }));
    col.appendChild(el("p", { class: side.result === "pass" ? "result pass" : "result miss", text: side.resultLabel }));
    return col;
  }

  function setMode(mode) {
    var grid = $("compare-grid");
    grid.setAttribute("data-mode", mode);
    $("mode-socratic").setAttribute("aria-pressed", mode === "socratic" ? "true" : "false");
    $("mode-dump").setAttribute("aria-pressed", mode === "dump" ? "true" : "false");
    announce(mode === "socratic" ? "Socratic follow-up" : "Answer-dump correction");
  }

  $("session").addEventListener("click", function (event) {
    var btn = event.target.closest("button");
    if (!btn || !$("session").contains(btn)) return;
    var type = btn.getAttribute("data-action");
    if (!type) return;
    fromUser = true;
    state = M.reduce(state, { type: type, id: btn.getAttribute("data-id") });
    renderSession();
  });

  renderCompare();
  renderSession();
})();
