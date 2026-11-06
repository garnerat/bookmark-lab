(function () {
  const model = globalThis.GrillMe;
  const $ = (id) => document.getElementById(id);

  const state = {
    presetId: null,
    depth: "deep",
    session: null,
    pendingChoice: null,
    questionId: null,
  };

  function say(text) {
    $("live").textContent = text;
  }

  function ideaValue() {
    return $("idea").value;
  }

  function syncSetup() {
    const raw = ideaValue();
    const idea = model.ideaForGrill(raw);
    const match = model.PRESETS.find((preset) => model.ideaForGrill(preset.text) === idea);
    state.presetId = match ? match.id : null;
    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.preset === state.presetId ? "true" : "false");
    });
    $("idea-count").textContent = raw.length + " of " + model.IDEA_MAX;
    $("track-hint").textContent = model.trackBlurb(raw, state.presetId);
    $("start").disabled = idea.length === 0;
  }

  function syncDepth() {
    document.querySelectorAll("[data-depth]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.depth === state.depth ? "true" : "false");
    });
    $("depth-blurb").textContent = model.DEPTHS[state.depth].blurb;
  }

  function show(id, on) {
    $(id).hidden = !on;
    document.body.classList.toggle("in-grill", $("setup").hidden);
  }

  function reveal(id) {
    const node = $(id);
    if (node && node.scrollIntoView) node.scrollIntoView({ block: "start" });
  }

  function resetAll() {
    state.presetId = null;
    state.depth = "deep";
    state.session = null;
    state.pendingChoice = null;
    state.questionId = null;
    $("idea").value = "";
    $("note").value = "";
    syncSetup();
    syncDepth();
    show("setup", true);
    show("grill", false);
    show("report", false);
    say("Back at the start. Pick an idea when you are ready.");
    $("idea").focus();
  }

  function paintChoices(view) {
    const box = $("choices");
    box.replaceChildren();
    view.choices.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.dataset.choice = option.id;
      button.setAttribute("aria-pressed", option.id === state.pendingChoice ? "true" : "false");
      button.textContent = option.label;
      box.append(button);
    });
  }

  function noteCount() {
    $("note-count").textContent = $("note").value.length + " of " + model.NOTE_MAX;
  }

  function showGrill(focusTitle) {
    const view = model.present(state.session);
    if (!view) {
      showReport();
      return;
    }
    const fresh = view.id !== state.questionId;
    state.questionId = view.id;
    if (fresh) {
      state.pendingChoice = null;
      $("note").value = "";
    }
    $("grill-kicker").textContent = (view.depth === "deep" ? "Deep grill" : "Shallow grill") + " · " + model.TRACKS[view.track].label;
    $("idea-reminder").replaceChildren();
    const label = document.createElement("strong");
    label.textContent = "Idea being grilled";
    $("idea-reminder").append(label, document.createTextNode(state.session.ideaText));
    const progress = view.depth === "shallow"
      ? "Question " + view.index + " of 3."
      : "Question " + view.index + ". Six checks always. A wide answer can add a slice question. A conflict can add one more. Eight is the cap.";
    $("progress").textContent = progress;
    $("theme").textContent = view.themeLabel;
    $("q-title").textContent = view.prompt;
    $("q-help").textContent = view.help;
    paintChoices(view);
    noteCount();
    $("next").disabled = !state.pendingChoice;
    $("back").textContent = state.session.answers.length === 0 ? "Back to the idea" : "Previous question";
    show("setup", false);
    show("report", false);
    show("grill", true);
    say("Question " + view.index + ". " + view.themeLabel + ". " + view.prompt);
    reveal("grill");
    if (focusTitle) $("q-title").focus();
  }

  function toneLabel(tone) {
    if (tone === "contradiction") return "Contradiction";
    if (tone === "settled") return "Settled";
    return "Still open";
  }

  function chip(text, className) {
    const node = document.createElement("li");
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function showReport() {
    const result = model.report(state.session);
    const depthLabel = result.depth === "deep" ? "deep" : "short";
    $("report-lead").textContent = "You answered " + result.questionCount + " " + (result.questionCount === 1 ? "question" : "questions") + " in the " + depthLabel + " grill for " + result.trackLabel + ". The paragraph below uses only those answers.";

    const holes = $("holes");
    holes.replaceChildren();
    result.holes.forEach((item) => {
      const card = document.createElement("article");
      card.className = "hole " + item.tone;
      const tag = document.createElement("p");
      tag.className = "tag";
      tag.textContent = toneLabel(item.tone);
      const title = document.createElement("h3");
      title.textContent = item.title;
      const body = document.createElement("p");
      body.textContent = item.body;
      card.append(tag, title, body);
      holes.append(card);
    });

    $("spec").textContent = result.spec;

    const compare = $("compare");
    compare.replaceChildren();
    const left = document.createElement("div");
    left.className = "col";
    const leftTitle = document.createElement("h3");
    leftTitle.textContent = "Build now";
    const leftCopy = document.createElement("p");
    leftCopy.textContent = "Skip the grill and start from the vague sentence, and this is the example scope that usually comes with it. A two-tech shop does not need all of it for a first week.";
    const chips = document.createElement("ul");
    chips.className = "chips";
    result.comparison.skipped.forEach((item) => chips.append(chip(item.label)));
    left.append(leftTitle, leftCopy, chips);

    const right = document.createElement("div");
    right.className = "col after";
    const rightTitle = document.createElement("h3");
    rightTitle.textContent = "Grill first";
    const because = document.createElement("p");
    because.textContent = result.comparison.because;
    const slice = document.createElement("p");
    slice.className = "slice-chip";
    slice.textContent = result.comparison.slice.label;
    const detail = document.createElement("p");
    detail.className = "slice-detail";
    detail.textContent = result.comparison.slice.detail;
    right.append(rightTitle, because, slice, detail);
    compare.append(left, right);

    const list = $("transcript");
    list.replaceChildren();
    result.transcript.forEach((item) => {
      const li = document.createElement("li");
      const who = document.createElement("div");
      who.className = "who";
      who.textContent = "Question " + item.index + " · " + item.theme;
      const prompt = document.createElement("p");
      prompt.textContent = item.prompt;
      const answer = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = item.label;
      answer.append(strong);
      li.append(who, prompt, answer);
      if (item.note) {
        const note = document.createElement("p");
        note.textContent = "Note: " + item.note;
        li.append(note);
      }
      list.append(li);
    });

    show("setup", false);
    show("grill", false);
    show("report", true);
    say("Grill finished. " + result.holes.length + " items under holes found.");
    reveal("report");
    $("report-title").setAttribute("tabindex", "-1");
    $("report-title").focus();
  }

  function restoreLast() {
    const answers = state.session.answers;
    if (!answers.length) {
      show("setup", true);
      show("grill", false);
      show("report", false);
      $("idea").focus();
      return;
    }
    const last = answers[answers.length - 1];
    state.session = {
      ideaText: state.session.ideaText,
      depth: state.session.depth,
      presetId: state.session.presetId,
      answers: answers.slice(0, -1),
    };
    state.questionId = null;
    showGrill(false);
    state.pendingChoice = last.choiceId;
    $("note").value = last.note;
    noteCount();
    paintChoices(model.present(state.session));
    $("next").disabled = false;
    const pressed = document.querySelector('[data-choice="' + last.choiceId + '"]');
    if (pressed) pressed.focus();
  }

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = model.PRESETS.find((item) => item.id === button.dataset.preset);
      $("idea").value = preset.text;
      syncSetup();
      $("idea").focus();
    });
  });

  document.querySelectorAll("[data-depth]").forEach((button) => {
    button.addEventListener("click", () => {
      state.depth = button.dataset.depth;
      syncDepth();
    });
  });

  $("idea").addEventListener("input", syncSetup);

  $("start").addEventListener("click", () => {
    const idea = model.ideaForGrill(ideaValue());
    if (!idea) return;
    state.session = model.begin(ideaValue(), state.depth, state.presetId);
    state.pendingChoice = null;
    state.questionId = null;
    showGrill(true);
  });

  $("choices").addEventListener("click", (event) => {
    const button = event.target.closest("[data-choice]");
    if (!button) return;
    state.pendingChoice = button.dataset.choice;
    $("choices").querySelectorAll("[data-choice]").forEach((item) => {
      item.setAttribute("aria-pressed", item === button ? "true" : "false");
    });
    $("next").disabled = false;
  });

  $("note").addEventListener("input", noteCount);

  $("next").addEventListener("click", () => {
    if (!state.pendingChoice) return;
    state.session = model.give(state.session, state.pendingChoice, $("note").value);
    state.pendingChoice = null;
    state.questionId = null;
    if (model.nextQuestion(state.session)) showGrill(true);
    else showReport();
  });

  $("back").addEventListener("click", restoreLast);
  $("revise").addEventListener("click", restoreLast);
  $("reset-grill").addEventListener("click", resetAll);
  $("reset-report").addEventListener("click", resetAll);

  syncSetup();
  syncDepth();
})();
