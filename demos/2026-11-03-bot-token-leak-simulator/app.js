(function () {
  const model = globalThis.TokenLeak;

  const state = {
    preset: "sprawl",
    bots: model.team("sprawl"),
    compact: false,
    cadence: false,
    consolidate: false,
    shortRules: false,
    verify: false,
    extraHandoffs: 0,
    monthOpen: false,
  };

  const FIELDS = [
    ["runsPerDay", "Runs per day", "How often this bot wakes."],
    ["historyTokens", "Chat history each run", "Old chat carried in, tokens."],
    ["rulesTokens", "Rules and skills each run", "The doc this bot reads, tokens."],
    ["workPerRun", "New work each run", "Tokens spent on the job itself."],
  ];

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
      if (child == null) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function tokens(n) {
    const sign = n < 0 ? "−" : "";
    const value = Math.abs(n);
    if (value >= 1e6) {
      const digits = value >= 1e7 ? 1 : 2;
      return sign + (value / 1e6).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }) + " million";
    }
    return sign + Math.round(value).toLocaleString("en-US");
  }

  function money(n) {
    const sign = n < 0 ? "−" : "";
    return sign + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pct(share) {
    return (share * 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  }

  function rate(p) {
    const value = p * 100;
    const digits = Math.abs(value * 10 - Math.round(value * 10)) < 1e-6 ? 1 : 2;
    return value.toFixed(digits) + "%";
  }

  function fieldText(field, value) {
    if (field === "runsPerDay") return value.toLocaleString("en-US") + " / day";
    return value.toLocaleString("en-US");
  }

  function prices() {
    return {
      inputPerMillion: Number($("price-input").value),
      workPerMillion: Number($("price-work").value),
    };
  }

  function options() {
    return {
      compact: state.compact,
      cadence: state.cadence,
      consolidate: state.consolidate,
      shortRules: state.shortRules,
      verify: state.verify,
      extraHandoffs: state.extraHandoffs,
      prices: prices(),
    };
  }

  function leakOn() {
    return state.compact || state.cadence || state.consolidate || state.shortRules;
  }

  function renderChrome() {
    const preset = model.PRESETS[state.preset];
    const clean = model.isPresetClean(state.preset, state.bots);
    $("preset-sprawl").setAttribute("aria-pressed", state.preset === "sprawl" ? "true" : "false");
    $("preset-lean").setAttribute("aria-pressed", state.preset === "lean" ? "true" : "false");
    $("team-note").textContent = preset.summary + (clean ? "" : " Sliders are adjusted.");
    $("fix-compact").checked = state.compact;
    $("fix-cadence").checked = state.cadence;
    $("fix-consolidate").checked = state.consolidate;
    $("fix-rules").checked = state.shortRules;
    $("fix-verify").checked = state.verify;
    $("handoff-value").textContent = String(state.extraHandoffs);
    $("handoff-minus").disabled = state.extraHandoffs <= 0;
    $("handoff-plus").disabled = state.extraHandoffs >= model.MAX_EXTRA_HANDOFFS;
  }

  function botSummary(bot) {
    return bot.runsPerDay + "/day · " + bot.historyTokens.toLocaleString("en-US") + " history";
  }

  function renderBots() {
    const root = $("bots");
    const open = new Set([...root.querySelectorAll("details[open]")].map((node) => node.dataset.id));
    root.replaceChildren();
    state.bots.forEach((bot) => {
      const details = el("details", { class: "bot", "data-id": bot.id });
      if (open.has(bot.id)) details.open = true;
      const summary = el("summary", {}, [
        el("span", { class: "bot-name", text: bot.name }),
        el("span", { class: "bot-stat", text: botSummary(bot) }),
      ]);
      details.append(summary, el("p", { class: "bot-blurb", text: bot.blurb }));
      FIELDS.forEach(([field, label, help]) => {
        const spec = model.LIMITS[field];
        const wrap = el("label", { class: "slider" });
        const shown = fieldText(field, bot[field]);
        const output = el("output", { text: shown });
        const input = el("input", {
          type: "range",
          min: spec.min,
          max: spec.max,
          step: spec.step,
          value: bot[field],
          "aria-label": bot.name + ", " + label,
          "aria-valuemin": spec.min,
          "aria-valuemax": spec.max,
          "aria-valuenow": bot[field],
          "aria-valuetext": shown,
        });
        input.addEventListener("input", () => {
          const value = model.snap(field, Number(input.value));
          bot[field] = value;
          const text = fieldText(field, value);
          output.textContent = text;
          input.setAttribute("aria-valuenow", String(value));
          input.setAttribute("aria-valuetext", text);
          summary.querySelector(".bot-stat").textContent = botSummary(bot);
          renderChrome();
          renderOutput();
        });
        wrap.append(
          el("span", { class: "slider-top" }, [el("span", { text: label }), output]),
          input,
          el("span", { class: "slider-help", text: help })
        );
        details.append(wrap);
      });
      root.append(details);
    });
  }

  function bandNote(share) {
    if (share >= 0.75 && share <= 0.88) {
      return "Inside the high band. The write-up’s export was about 75% re-reading. This band, 75% to 88%, is only a guide drawn on the chart.";
    }
    if (share > 0.88) {
      return "Above the high band drawn on the chart. The write-up’s export was about 75% re-reading.";
    }
    return "Under the write-up’s 75%. Shortening the chat, or waking less often, is what moves a team out of that band in this example.";
  }

  function workNote(share) {
    if (share <= 0.03) {
      return "New work is " + pct(share) + " of tokens here. The write-up’s export put the work itself at about 1%.";
    }
    return "New work is " + pct(share) + " of tokens here, because the chats are shorter relative to the job.";
  }

  function panel(kind, title, tokenCount, cost, share) {
    return el("div", { class: "panel " + kind }, [
      el("h3", { text: title }),
      el("span", { class: "num", text: tokens(tokenCount) }),
      el("span", { class: "sub", text: money(cost) + " · " + pct(share) }),
    ]);
  }

  function column(title, spent, mistakes) {
    const rows = [
      ["Re-reading share", pct(spent.rereadShare)],
      ["Tokens", tokens(spent.totalTokens)],
      ["Estimated cost", money(spent.totalCost)],
      ["Runs", spent.runs.toLocaleString("en-US")],
      ["Dropped details", mistakes.perMonth.toFixed(1)],
    ];
    return el("div", { class: title === "With these fixes" ? "col after" : "col" }, [
      el("h3", { text: title }),
      ...rows.map(([label, value]) => el("div", { class: "stat" }, [
        el("span", { text: label }),
        el("b", { text: value }),
      ])),
    ]);
  }

  function deltaBox(delta) {
    if (!leakOn()) {
      return el("div", { class: "delta flat" }, [
        el("p", { text: "The two columns match until a fix is on. The right column follows the four switches. Verification and extra handoffs apply to both columns." }),
      ]);
    }
    const cheaper = delta.cost < -0.005;
    const pricier = delta.cost > 0.005;
    const klass = cheaper ? "delta down" : pricier ? "delta up" : "delta flat";
    const tokenClause = delta.tokens < 0
      ? "These fixes remove " + tokens(Math.abs(delta.tokens)) + " tokens"
      : "These fixes add " + tokens(delta.tokens) + " tokens";
    const costClause = cheaper
      ? " and " + money(Math.abs(delta.cost)) + " in this example."
      : pricier
        ? " and cost " + money(delta.cost) + " more in this example."
        : ".";
    const sharePoints = Math.abs(delta.rereadShare * 100).toFixed(1);
    const shareClause = delta.rereadShare < -0.0005
      ? " Re-reading share falls " + sharePoints + " points."
      : delta.rereadShare > 0.0005
        ? " Re-reading share rises " + sharePoints + " points."
        : " Re-reading share stays put.";
    const miss = Math.abs(delta.mistakes).toFixed(1);
    const missClause = delta.mistakes < -0.05
      ? " Expected dropped details fall by " + miss + "."
      : delta.mistakes > 0.05
        ? " Expected dropped details rise by " + miss + "."
        : " Expected dropped details stay put.";
    return el("div", { class: klass }, [
      el("p", { text: tokenClause + costClause + shareClause + missClause + " Illustrative example, not a measurement." }),
    ]);
  }

  function fixReport(view) {
    const effect = view.after.effective;
    const blocks = [];
    if (state.compact) {
      const changed = effect.compactChanges;
      const lead = changed.length
        ? changed.length + (changed.length === 1 ? " bot drops" : " bots drop") + " to a " + model.COMPACT_HISTORY_TOKENS.toLocaleString("en-US") + "-token summary."
        : "Every bot is already at or under " + model.COMPACT_HISTORY_TOKENS.toLocaleString("en-US") + " tokens of history.";
      blocks.push(el("div", {}, [
        el("h3", { text: "Summarize the chat" }),
        el("p", { text: lead }),
      ]));
    }
    if (state.cadence) {
      const changed = effect.cadenceChanges;
      const lead = changed.length
        ? changed.map((item) => item.name + " " + item.from + "→" + item.to).join(", ") + ". New work for the month stays."
        : "No bot runs more than " + model.CADENCE_CAP + " times a day.";
      blocks.push(el("div", {}, [
        el("h3", { text: "Slow the noisy routines" }),
        el("p", { text: lead }),
      ]));
    }
    if (state.consolidate) {
      const info = effect.consolidateInfo;
      let lead;
      if (info.already) {
        lead = "These bots are already one per domain, so nobody merges.";
      } else {
        const groups = info.groups
          .filter((group) => group.members.length > 1)
          .map((group) => group.name + " merges " + group.members.join(", "));
        lead = info.beforeCount + " bots become " + info.afterCount + ". " + groups.join(". ") + ".";
      }
      blocks.push(el("div", {}, [
        el("h3", { text: "Merge overlapping bots" }),
        el("p", { text: lead }),
      ]));
    }
    if (state.shortRules) {
      const info = effect.rulesInfo;
      const lead = info.capped
        ? info.capped + (info.capped === 1 ? " bot was" : " bots were") + " over " + model.SHORT_RULES_TOKENS.toLocaleString("en-US") + " tokens. Each run now reads " + model.SHORT_RULES_TOKENS.toLocaleString("en-US") + ". Writing the file is " + model.RULES_AUTHOR_ONCE.toLocaleString("en-US") + " tokens once."
        : "Every bot is already at or under " + model.SHORT_RULES_TOKENS.toLocaleString("en-US") + " tokens, so the file is not rewritten.";
      blocks.push(el("div", {}, [
        el("h3", { text: "Short rules file" }),
        el("p", { text: lead }),
      ]));
    }
    if (!blocks.length) {
      return el("p", { class: "hint", text: "Turn on a fix to see what it changes." });
    }
    return el("div", { class: "panel" }, blocks);
  }

  function monthList(spent) {
    return el("details", { class: "more" }, [
      el("summary", { text: "Month by bot" }),
      el("ul", { class: "month-list" }, spent.perBot.map((item) => el("li", {}, [
        el("strong", { text: item.name }),
        el("span", { text: item.runs.toLocaleString("en-US") + " runs · re-read " + tokens(item.history) + " · rules " + tokens(item.rules) + " · work " + tokens(item.work) + " · " + pct(item.rereadShare) + " re-read" }),
      ]))),
      el("p", { class: "hint", text: "One-time writes and the verification tokens, when this example charges them, sit in the month’s rules total and not on a single bot." }),
    ]);
  }

  function renderLadder(mistakes, botCount) {
    const steps = [
      ["Job", true],
      ["Rules", mistakes.shortRules],
      ["Skills", mistakes.shortRules],
      ["Verification", mistakes.verify],
      ["Bots · " + botCount, true],
    ];
    $("ladder").replaceChildren(el("div", { class: "ladder", role: "list", "aria-label": "Ladder" }, steps.map(([label, on]) => (
      el("span", { class: on ? "on" : "", role: "listitem", text: label + (on ? "" : " · off") })
    ))));
  }

  function renderMistakes(view) {
    const mistakes = view.after.mistakes;
    const chain = mistakes.chainLength;
    const touch = chain === 1 ? "1 bot" : chain + " bots";
    const hand = mistakes.handoffs === 1 ? "1 handoff" : mistakes.handoffs + " handoffs";
    $("verify-copy").textContent = model.hasVerifier(state.bots) && state.verify
      ? "On. The ops bot already runs this check, so the token estimate does not add a second one. The per-run miss is cut in half."
      : state.verify
        ? "On. This example adds " + model.VERIFY_AUTHOR_ONCE.toLocaleString("en-US") + " tokens once to write the check, and " + model.VERIFY_PER_RUN.toLocaleString("en-US") + " tokens on every run. The per-run miss is cut in half."
        : "Off. Each run keeps the higher miss rate. Turn it on to pay for the check once.";
    $("handoff-note").textContent = "One more handoff adds " + mistakes.oneMoreHandoff.toFixed(1) + " dropped details this month. The per-run miss stays " + rate(mistakes.perRunMiss) + ". This stepper does not add a bot’s tokens.";
    const counted = "A job is touched by " + touch + " and passed along with " + hand + ". A touch drops a detail " + rate(mistakes.perRunMiss) + " of the time. A handoff drops one " + rate(mistakes.handoffMiss) + " of the time. " + model.JOBS_PER_DAY + " jobs a day for " + model.MONTH_DAYS + " days is " + mistakes.jobs.toLocaleString("en-US") + " jobs, so this example expects " + mistakes.perMonth.toFixed(1) + " dropped details (" + mistakes.perJob.toFixed(3) + " per job).";
    $("mistake-report").replaceChildren(
      el("div", { class: "hero" }, [
        el("p", { class: "eyebrow", text: "Illustrative example, not a measurement" }),
        el("p", { class: "share-value" + (mistakes.perMonth > 100 ? "" : " calm"), text: mistakes.perMonth.toFixed(1) }),
        el("p", { class: "share-kicker", text: "expected dropped details this month" }),
        el("p", { text: counted }),
      ])
    );
    renderLadder(mistakes, view.after.effective.bots.length);
  }

  function renderOutput() {
    const view = model.compare(state.bots, options());
    const spent = view.after.spend;
    const inBand = spent.rereadShare >= 0.75;
    const stackBits = [
      ["history", spent.historyTokens],
      ["rules", spent.rulesTokens],
      ["work", spent.workTokens],
    ].filter(([, count]) => count > 0);

    const more = monthList(spent);
    if (state.monthOpen) more.open = true;
    more.addEventListener("toggle", () => { state.monthOpen = more.open; });

    $("results").replaceChildren(
      el("div", { class: "hero" }, [
        el("p", { class: "eyebrow", text: "Illustrative month · " + model.MONTH_DAYS + " days · not a measurement" }),
        el("p", { class: "share-value" + (inBand ? "" : " calm"), text: pct(spent.rereadShare) }),
        el("p", { class: "share-kicker", text: "of tokens are old chat, read again" }),
        el("div", { class: "band", "aria-hidden": "true" }, [
          el("div", { class: "band-zone", style: "left:75%;width:13%" }),
          el("div", { class: "band-you", style: "left:" + Math.max(0, Math.min(100, spent.rereadShare * 100)) + "%" }),
        ]),
        el("div", { class: "band-scale" }, [
          el("span", { text: "0%" }),
          el("span", { class: "band-label", text: "75–88%" }),
          el("span", { text: "100%" }),
        ]),
        el("p", { text: bandNote(spent.rereadShare) }),
        el("div", {
          class: "stack",
          role: "img",
          "aria-label": "Token split. Re-reading " + pct(spent.rereadShare) + ", rules " + pct(spent.rulesShare) + ", new work " + pct(spent.workShare) + ".",
        }, stackBits.map(([kind, count]) => el("i", { class: kind, style: "flex:" + count + " 1 0" }))),
        el("ul", { class: "legend" }, [
          el("li", {}, [el("i", { class: "swatch history" }), "Re-reading history"]),
          el("li", {}, [el("i", { class: "swatch rules" }), "Rules and skills"]),
          el("li", {}, [el("i", { class: "swatch work" }), "New work"]),
        ]),
      ]),
      el("div", { class: "trio" }, [
        panel("history", "Re-reading history", spent.historyTokens, spent.historyCost, spent.rereadShare),
        panel("rules", "Rules and skills", spent.rulesTokens, spent.rulesCost, spent.rulesShare),
        panel("work", "New work", spent.workTokens, spent.workCost, spent.workShare),
      ]),
      el("p", { text: workNote(spent.workShare) }),
      el("p", { class: "hint", text: spent.runs.toLocaleString("en-US") + " runs · example cost " + money(spent.totalCost) + " at $" + spent.prices.inputPerMillion.toLocaleString("en-US") + " and $" + spent.prices.workPerMillion.toLocaleString("en-US") + " per million." }),
      more
    );
    $("fix-report").replaceChildren(
      el("div", { class: "compare" }, [
        column("Before fixes", view.before.spend, view.before.mistakes),
        column("With these fixes", view.after.spend, view.after.mistakes),
      ]),
      deltaBox(view.delta),
      fixReport(view)
    );
    renderMistakes(view);
    $("live").textContent = "Re-reading share " + pct(spent.rereadShare) + ". Example cost " + money(spent.totalCost) + ". Expected dropped details " + view.after.mistakes.perMonth.toFixed(1) + " this month.";
  }

  function applyPreset(id) {
    state.preset = id;
    state.bots = model.team(id);
    state.compact = false;
    state.cadence = false;
    state.consolidate = false;
    state.shortRules = false;
    state.verify = model.PRESETS[id].verify;
    state.extraHandoffs = 0;
    renderChrome();
    renderBots();
    renderOutput();
  }

  $("preset-sprawl").addEventListener("click", () => applyPreset("sprawl"));
  $("preset-lean").addEventListener("click", () => applyPreset("lean"));
  $("reset").addEventListener("click", () => applyPreset(state.preset));
  $("fix-compact").addEventListener("change", () => { state.compact = $("fix-compact").checked; renderOutput(); });
  $("fix-cadence").addEventListener("change", () => { state.cadence = $("fix-cadence").checked; renderOutput(); });
  $("fix-consolidate").addEventListener("change", () => { state.consolidate = $("fix-consolidate").checked; renderOutput(); });
  $("fix-rules").addEventListener("change", () => { state.shortRules = $("fix-rules").checked; renderOutput(); });
  $("fix-verify").addEventListener("change", () => { state.verify = $("fix-verify").checked; renderOutput(); });
  $("price-input").addEventListener("input", renderOutput);
  $("price-work").addEventListener("input", renderOutput);
  $("handoff-minus").addEventListener("click", () => {
    state.extraHandoffs = Math.max(0, state.extraHandoffs - 1);
    renderChrome();
    renderOutput();
  });
  $("handoff-plus").addEventListener("click", () => {
    state.extraHandoffs = Math.min(model.MAX_EXTRA_HANDOFFS, state.extraHandoffs + 1);
    renderChrome();
    renderOutput();
  });

  renderChrome();
  renderBots();
  renderOutput();
})();
