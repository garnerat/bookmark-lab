(function () {
  "use strict";

  var model = globalThis.SocraticTutor;
  var state = model.createState();
  var mode = "chat";

  function $(id) {
    return document.getElementById(id);
  }

  function h(tag, attrs) {
    var node = document.createElement(tag);
    var opts = attrs || {};
    Object.keys(opts).forEach(function (key) {
      var value = opts[key];
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value == null ? "" : String(value);
      else if (value != null && value !== false) node.setAttribute(key, value === true ? "" : String(value));
    });
    for (var i = 2; i < arguments.length; i += 1) {
      var child = arguments[i];
      if (child == null || child === false) continue;
      node.append(child);
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setMode(next) {
    mode = next;
    $("panels").setAttribute("data-mode", mode);
    $("tab-chat").setAttribute("aria-pressed", mode === "chat" ? "true" : "false");
    $("tab-tutor").setAttribute("aria-pressed", mode === "tutor" ? "true" : "false");
  }

  function announce(view) {
    var bits = [];
    if (view.kicker) bits.push(view.kicker);
    if (view.question) bits.push(view.question.prompt);
    else if (view.paragraphs[0]) bits.push(view.paragraphs[0]);
    if (view.note[0]) bits.push(view.note[0]);
    $("live").textContent = bits.join(" ");
  }

  function choiceButton(choice, type) {
    var button = h("button", { type: "button", text: choice.text });
    button.addEventListener("click", function () {
      apply({ type: type, id: choice.id });
    });
    return button;
  }

  function renderChat(view) {
    var root = $("chat");
    clear(root);
    root.append(h("h2", { id: "chat-title", text: "Chatbot" }));
    root.append(h("p", { class: "hint", text: "This side answers by lecturing." }));
    if (!view.lecture) {
      root.append(h("p", { text: "Pick a sentence above. This side hands you the whole answer in one lecture." }));
      return;
    }
    root.append(h("div", { class: "bubble user" },
      h("p", { class: "who", text: "You" }),
      h("p", { text: view.userLine })
    ));
    var lecture = h("div", { class: "bubble chat" }, h("p", { class: "who", text: "Chatbot · lecture" }));
    view.lecture.forEach(function (paragraph) {
      lecture.append(h("p", { text: paragraph }));
    });
    root.append(lecture);
  }

  function renderStrict() {
    var wrap = h("div", { class: "strict" });
    var group = h("div", { class: "segment", role: "group", "aria-label": "Be strict" });
    [
      ["on", "Be strict", true],
      ["off", "One answer counts", false]
    ].forEach(function (item) {
      var button = h("button", {
        type: "button",
        text: item[1],
        "data-strict": item[0],
        "aria-pressed": state.strict === item[2] ? "true" : "false"
      });
      button.addEventListener("click", function () {
        apply({ type: "strict", on: item[2] });
      });
      group.append(button);
    });
    wrap.append(group);
    wrap.append(h("p", {
      class: "hint",
      text: "On, a level moves only after two independent checks, and one of them has to be recall. Off, a single correct answer moves it."
    }));
    return wrap;
  }

  function renderMap(view) {
    var box = h("div", { class: "map", id: "skill-map", tabindex: "-1" });
    box.append(h("p", { class: "eyebrow", text: "Skill map" }));
    box.append(h("p", { class: "overall", text: "Overall " + view.map.overall + "%" }));
    view.map.rows.forEach(function (row) {
      var skill = h("div", { class: row.focus ? "skill is-focus" : "skill" });
      var top = h("div", { class: "skill-top" });
      top.append(h("span", { class: "skill-name", text: row.name }));
      top.append(h("span", { class: "skill-level", text: row.level + "/5 · " + row.label }));
      skill.append(top);
      var track = h("div", {
        class: "track",
        role: "meter",
        "aria-valuemin": "0",
        "aria-valuemax": "5",
        "aria-valuenow": String(row.level),
        "aria-valuetext": row.level + " of 5, " + row.label,
        "aria-label": row.name
      });
      var fill = h("span", { class: "fill" });
      fill.style.width = ((row.level / 5) * 100) + "%";
      track.append(fill);
      skill.append(track);
      if (row.focus) skill.append(h("p", { class: "skill-mark", text: "current focus" }));
      box.append(skill);
    });
    box.append(h("p", { class: "hint", text: "The lines use the skill's block characters, full block and light shade." }));
    var pre = h("pre", { class: "ascii", "aria-label": "ASCII skill map", text: view.map.text });
    box.append(pre);
    var legend = model.LEVELS.map(function (level) {
      return level.level + " " + level.label;
    }).join(" · ");
    box.append(h("p", { class: "hint legend", text: legend }));
    return box;
  }

  function renderTutor(view) {
    var root = $("tutor");
    clear(root);
    root.setAttribute("data-phase", view.phase);
    root.append(h("h2", { text: "Socratic tutor" }));
    if (view.userLine) {
      root.append(h("div", { class: "bubble user" },
        h("p", { class: "who", text: "You" }),
        h("p", { text: view.userLine })
      ));
    }
    if (view.showStrict) root.append(renderStrict());
    if (view.map) root.append(renderMap(view));
    if (view.note.length) {
      var noteClass = "note";
      if (view.summary && view.summary.passed) noteClass += " pass";
      var note = h("div", { class: noteClass, tabindex: "-1" });
      view.note.forEach(function (line) {
        note.append(h("p", { text: line }));
      });
      root.append(note);
    }
    var turn = h("div", { class: "turn" });
    if (view.kicker) turn.append(h("p", { class: "kicker", text: view.kicker }));
    turn.append(h("p", { class: "who", text: "Socratic tutor" }));
    if (view.question) {
      view.paragraphs.forEach(function (paragraph) {
        turn.append(h("p", { text: paragraph }));
      });
      turn.append(h("h3", { id: "tutor-title", tabindex: "-1", text: view.question.prompt }));
      var answers = h("div", { class: "choices", role: "group", "aria-label": "Answers" });
      view.question.choices.forEach(function (choice) {
        answers.append(choiceButton(choice, "choice"));
      });
      turn.append(answers);
    } else if (view.heading) {
      turn.append(h("h3", { id: "tutor-title", tabindex: "-1", text: view.heading }));
      view.paragraphs.forEach(function (paragraph) {
        turn.append(h("p", { text: paragraph }));
      });
    }
    if (view.actions.length) {
      var actions = h("div", { class: "choices", role: "group", "aria-label": view.actionsLabel });
      view.actions.forEach(function (action) {
        var klass = action.proposed || action.type === "continue" || action.type === "guard" ? "primary" : "secondary";
        var button = h("button", { type: "button", class: klass, text: action.text });
        button.addEventListener("click", function () {
          apply({ type: action.type, id: action.id });
        });
        actions.append(button);
      });
      turn.append(actions);
    }
    root.append(turn);
    if (view.showRestart) {
      var restart = h("button", { type: "button", class: "secondary", id: "restart", text: "Start over" });
      restart.addEventListener("click", function () {
        apply({ type: "restart" });
      });
      root.append(restart);
    }
  }

  function render() {
    var view = model.present(state);
    setMode(mode);
    document.body.classList.toggle("in-session", !view.showPrompts);
    $("setup").hidden = !view.showPrompts;
    renderChat(view);
    renderTutor(view);
    announce(view);
  }

  function focusStep() {
    var map = $("skill-map");
    var note = document.querySelector(".note");
    var title = $("tutor-title");
    if (state.phase === "map" && map) map.focus();
    else if (note) note.focus();
    else if (title) title.focus();
  }

  function apply(action) {
    var prev = state.phase;
    state = model.act(state, action);
    if (action.type === "prompt") mode = "tutor";
    if (action.type === "restart") mode = "chat";
    render();
    if (action.type === "strict") {
      var pressed = document.querySelector('[data-strict="' + (state.strict ? "on" : "off") + '"]');
      if (pressed) pressed.focus();
      return;
    }
    if (prev !== state.phase) focusStep();
  }

  function initPrompts() {
    var group = h("div", { class: "choices", role: "group", "aria-label": "What you say" });
    model.PROMPTS.forEach(function (prompt) {
      group.append(choiceButton(prompt, "prompt"));
    });
    $("prompts").append(group);
  }

  $("tab-chat").addEventListener("click", function () { setMode("chat"); });
  $("tab-tutor").addEventListener("click", function () { setMode("tutor"); });
  $("copy").addEventListener("click", function () {
    var text = $("install-command").textContent.trim();
    var status = $("copy-status");
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      status.textContent = "Select the command and copy it.";
      return;
    }
    navigator.clipboard.writeText(text).then(function () {
      status.textContent = "Copied.";
    }, function () {
      status.textContent = "Select the command and copy it.";
    });
  });

  initPrompts();
  render();
})();
