(function () {
  const model = globalThis.DeciderSwap;
  if (!model) return;

  const state = {
    mode: "dual",
    thresholdPercent: 60,
    fallback: "human",
    keyOrder: "sorted",
    volumeIndex: 0,
    selected: "a1",
    scroll: false,
  };

  const $ = (id) => document.getElementById(id);

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

  function current() {
    return model.evaluate({
      mode: state.mode,
      thresholdPercent: state.thresholdPercent,
      fallback: state.fallback,
      keyOrder: state.keyOrder,
    });
  }

  function costsFor(result) {
    return model.bill(
      model.VOLUMES[state.volumeIndex],
      state.mode,
      result.decider.abstain,
      result.n,
      state.fallback
    );
  }

  function messageOf(id) {
    return model.messageById(id);
  }

  function rowOf(result, id) {
    return result.rows.find((row) => row.id === id);
  }

  function snippet(text) {
    if (text.length <= 88) return text;
    const cut = text.slice(0, 84);
    const space = cut.lastIndexOf(" ");
    return (space > 40 ? cut.slice(0, space) : cut).trimEnd() + "…";
  }

  function pctLabel(count, total) {
    if (total === 0) return "—";
    return count + "/" + total + " (" + Math.round((100 * count) / total) + "%)";
  }

  function bars(scored, truth) {
    return el(
      "div",
      { class: "bars" },
      model.LABELS.map((label) => {
        const value = scored.thousandths[label.id];
        const picked = label.id === scored.label;
        const isTruth = label.id === truth;
        const cls = ["bar", picked ? "top" : "", isTruth ? "truth" : "", picked && !isTruth ? "miss" : ""]
          .filter(Boolean)
          .join(" ");
        const fill = el("span", { class: "fill" });
        fill.style.width = value / 10 + "%";
        const name = label.short + (isTruth ? " · truth" : "");
        return el("div", { class: cls }, [
          el("span", { class: "bar-name", text: name }),
          el("span", { class: "track", "aria-hidden": "true" }, [fill]),
          el("span", { class: "bar-pct", text: model.points(value) }),
        ]);
      })
    );
  }

  function column(title, scored, truth, active) {
    return el("div", { class: "col" + (active ? " on" : "") }, [
      el("h3", {}, [
        title,
        el("span", {
          class: "conf",
          text: "confidence " + Math.round(scored.confidence * 100) + "%",
        }),
      ]),
      bars(scored, truth),
    ]);
  }

  function renderModes() {
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-mode") === state.mode));
    });
    $("mode-note").textContent = model.modeSentence(state.mode);
    $("config").textContent = model.configText(state.mode);
  }

  function renderDetail(result) {
    const message = messageOf(state.selected);
    const row = rowOf(result, state.selected);
    const index = model.MESSAGES.findIndex((item) => item.id === message.id);
    $("picker").value = message.id;
    $("pos").textContent = index + 1 + " of " + model.MESSAGES.length;

    let appliedText;
    let appliedClass = "banner";
    if (row.source === "human") {
      appliedText = "Decider abstains. This message goes to a person. No label is applied.";
      appliedClass += " hold";
    } else if (row.source === "decider") {
      const name = model.labelById(row.applied).name;
      appliedText = row.applied === row.truth
        ? "Applied label: " + name + ", from the decision model. It matches the ground truth."
        : "Applied label: " + name + ", from the decision model. Ground truth is " + model.labelById(row.truth).name + ".";
      if (row.applied !== row.truth) appliedClass += " bad";
    } else {
      const name = model.labelById(row.applied).name;
      const via = row.abstained ? "LLM fallback after the decider abstained" : "the LLM, which this switch applies";
      appliedText = "Applied label: " + name + ", from " + via + ".";
      if (state.mode === "dual" && !row.agree) {
        appliedText += " The decider said " + model.labelById(row.decider.label).name + ".";
      }
      if (row.applied !== row.truth) appliedClass += " bad";
    }

    const bits = [
      el("p", { class: "tag", text: model.CHANNELS[message.channel] + " · " + message.clarity }),
      el("p", { class: "msg", text: message.text }),
      message.why ? el("p", { class: "why", text: message.why }) : null,
      el("div", { class: "pair" }, [
        column("LLM", row.llm, row.truth, state.mode !== "decider" || row.source === "llm"),
        column("Decision model", row.decider, row.truth, row.source === "decider"),
      ]),
      el("p", { class: appliedClass, text: appliedText }),
    ];
    $("detail").replaceChildren(...bits.filter(Boolean));
  }

  function renderReview(result) {
    const section = $("dual-review");
    const show = state.mode === "dual";
    section.hidden = !show;
    if (!show) return;
    $("agree").textContent = model.agreementSentence(result);
    const body = $("disagree-body");
    const misses = result.rows.filter((row) => !row.agree);
    if (!misses.length) {
      body.replaceChildren();
      $("disagree-empty").hidden = false;
      return;
    }
    $("disagree-empty").hidden = true;
    body.replaceChildren(
      ...misses.map((row) => {
        const message = messageOf(row.id);
        return el("tr", { class: row.flipped ? "flip" : "" }, [
          el("td", { "data-label": "Message" }, [
            el("button", { type: "button", class: "linkish", "data-pick": row.id, text: message.text }),
            row.flipped ? el("span", { class: "mini", text: "Key order flipped this label." }) : null,
          ]),
          el("td", { "data-label": "Ground truth", text: model.labelById(row.truth).short }),
          el("td", { "data-label": "LLM", text: model.labelById(row.llm.label).short }),
          el("td", { "data-label": "Decider", text: model.labelById(row.decider.label).short }),
          el("td", {
            "data-label": "Decider confidence",
            text: Math.round(row.decider.confidence * 100) + "%",
          }),
        ]);
      })
    );
  }

  function renderRoster(result) {
    $("roster").replaceChildren(
      ...model.MESSAGES.map((message) => {
        const row = rowOf(result, message.id);
        let status = "Match";
        let cls = "roster ok";
        if (row.source === "human") {
          status = "Held";
          cls = "roster hold";
        } else if (row.applied !== row.truth) {
          status = "Miss";
          cls = "roster miss";
        }
        if (state.mode === "dual" && !row.agree) {
          status = "Disagree";
          cls = "roster miss";
        }
        if (message.id === state.selected) cls += " on";
        return el("button", { type: "button", class: cls, "data-pick": message.id }, [
          el("span", { class: "roster-status", text: status }),
          el("span", { text: model.CHANNELS[message.channel] + " · " + snippet(message.text) }),
        ]);
      })
    );
  }

  function renderMetrics(result) {
    const stats = result.decider;
    const cards = [
      ["Decider accuracy", pctLabel(stats.correct, stats.labeled), "On the messages it still labels"],
      ["Coverage", pctLabel(stats.labeled, result.n), "Share it labels itself"],
      ["Fallback rate", pctLabel(stats.abstain, result.n), state.fallback === "llm" ? "Share sent to the LLM" : "Share sent to a person"],
    ];
    $("metrics").replaceChildren(
      ...cards.map(([name, value, note]) =>
        el("div", { class: "score" }, [
          el("span", { class: "name", text: name }),
          el("strong", { text: value }),
          el("span", { class: "base", text: note }),
        ])
      )
    );
    const lines = [model.thresholdSentence(result, state.fallback)];
    if (state.mode === "decider" && state.fallback === "llm") {
      lines.push("With the LLM filling abstains, " + result.resolvedCorrect + " of " + result.n + " final labels match the ground truth.");
    } else if (state.mode !== "decider") {
      lines.push("This switch still applies the LLM, which matches on " + result.llmCorrect + " of " + result.n + ". The cutoff is not applied yet.");
    }
    $("metric-note").textContent = lines.join(" ");
    $("threshold").value = String(state.thresholdPercent);
    $("threshold-readout").textContent = state.thresholdPercent + "%";
    $("threshold").setAttribute("aria-valuenow", String(state.thresholdPercent));
    $("threshold").setAttribute("aria-valuetext", state.thresholdPercent + " percent");
    document.querySelectorAll("[data-fallback]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-fallback") === state.fallback));
    });
  }

  function renderCosts(result) {
    const costs = costsFor(result);
    const cards = [
      ["LLM only", model.formatCents(costs.llmCents), model.formatMs(model.POST.llmMs) + " a call"],
      ["Decider, full use", model.formatCents(costs.fullCents), "$250 / million tickets"],
      ["Decider, in practice", model.formatCents(costs.practicalCents), "$500 / million tickets"],
    ];
    $("costs").replaceChildren(
      ...cards.map(([name, value, note]) =>
        el("div", { class: "score" }, [
          el("span", { class: "name", text: name }),
          el("strong", { text: value }),
          el("span", { class: "base", text: note }),
        ])
      )
    );
    $("volume").value = String(state.volumeIndex);
    $("volume-readout").textContent = model.formatCount(costs.volume) + " / month";
    $("volume").setAttribute("aria-valuenow", String(state.volumeIndex));
    $("volume").setAttribute("aria-valuetext", model.formatCount(costs.volume) + " messages per month");
    $("volume-note").textContent = model.volumeSentence(costs);
    $("switch-note").textContent = model.switchSentence(result, costs);
    $("month-note").textContent = "An ml.g5.xlarge left on for about " + model.POST.hoursInMonthIllustration + " hours is " + model.formatCents(costs.monthCents) + " whether these messages arrive or not.";
    $("latency-note").textContent = "Average wait on this switch: " + model.formatMs(costs.appliedMs) + ". The post's 897 ms is the decider call. The 640 ms figure is the throughput they used for about 5,600 tickets an hour.";
  }

  function renderGotcha(result) {
    const message = messageOf(model.GOTCHA_ID);
    const shown = model.score(message, "decider", state.keyOrder);
    $("shuffle").setAttribute("aria-pressed", String(state.keyOrder === "shuffled"));
    $("sort-keys").setAttribute("aria-pressed", String(state.keyOrder === "sorted"));
    $("gotcha-note").textContent = model.gotchaSentence(state.keyOrder);
    $("flip-count").textContent = result.flipCount + " of " + result.n + " decider labels " + (state.keyOrder === "shuffled" ? "flipped." : "would flip.");
    $("gotcha-json").textContent = model.payloadText(message, state.keyOrder);
    $("gotcha-bars").replaceChildren(
      el("p", { class: "msg", text: message.text }),
      column("Decider", shown, message.truth, true)
    );
  }

  function render() {
    const result = current();
    renderModes();
    renderDetail(result);
    renderReview(result);
    renderRoster(result);
    renderMetrics(result);
    renderCosts(result);
    renderGotcha(result);
    const live = model.thresholdSentence(result, state.fallback) + " " + model.switchSentence(result, costsFor(result));
    if ($("live").textContent !== live) $("live").textContent = live;
    if (state.scroll) {
      state.scroll = false;
      $("inbox").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
    }
  }

  function pick(id) {
    if (!model.messageById(id)) return;
    state.selected = id;
    state.scroll = true;
    render();
  }

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.getAttribute("data-mode");
      render();
    });
  });

  document.querySelectorAll("[data-fallback]").forEach((button) => {
    button.addEventListener("click", () => {
      state.fallback = button.getAttribute("data-fallback");
      render();
    });
  });

  $("threshold").addEventListener("input", () => {
    state.thresholdPercent = Number($("threshold").value);
    render();
  });

  $("volume").addEventListener("input", () => {
    state.volumeIndex = Number($("volume").value);
    render();
  });

  $("shuffle").addEventListener("click", () => {
    state.keyOrder = "shuffled";
    render();
  });

  $("sort-keys").addEventListener("click", () => {
    state.keyOrder = "sorted";
    render();
  });

  $("prev").addEventListener("click", () => {
    const ids = model.MESSAGES.map((message) => message.id);
    const index = ids.indexOf(state.selected);
    state.selected = ids[(index - 1 + ids.length) % ids.length];
    render();
  });

  $("next").addEventListener("click", () => {
    const ids = model.MESSAGES.map((message) => message.id);
    const index = ids.indexOf(state.selected);
    state.selected = ids[(index + 1) % ids.length];
    render();
  });

  $("picker").addEventListener("change", () => {
    state.selected = $("picker").value;
    render();
  });

  $("dual-review").addEventListener("click", (event) => {
    const button = event.target.closest("[data-pick]");
    if (!button) return;
    pick(button.getAttribute("data-pick"));
  });

  $("roster").addEventListener("click", (event) => {
    const button = event.target.closest("[data-pick]");
    if (!button) return;
    pick(button.getAttribute("data-pick"));
  });

  model.MESSAGES.forEach((message) => {
    $("picker").append(el("option", { value: message.id, text: model.CHANNELS[message.channel] + " · " + snippet(message.text) }));
  });

  $("volume").max = String(model.VOLUMES.length - 1);
  render();
})();
