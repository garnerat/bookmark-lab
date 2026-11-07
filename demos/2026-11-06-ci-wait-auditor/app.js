(function () {
  const model = globalThis.CiWait;
  const flags = model.blankFlags();

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

  function fmt(seconds) {
    return model.formatDuration(seconds);
  }

  function fillBar(bar, wait, setup, run, total) {
    bar.replaceChildren();
    bar.style.width = (total / model.BASELINE) * 100 + "%";
    [
      ["wait", wait],
      ["setup", setup],
      ["run", run],
    ].forEach(([kind, seconds]) => {
      if (seconds <= 0) return;
      bar.append(el("span", { class: "seg " + kind, style: "flex:" + seconds + " 1 0" }));
    });
  }

  function auditLine(on) {
    if (on.cache) {
      return "Agent audit: seeding the PR cache from main is on. That was the hidden setup bug agents had been retrying instead of fixing.";
    }
    return "Agent audit: the biggest hidden bug was a missing PR cache seed from main, so agents retried cold installs instead of fixing setup.";
  }

  function syncPressed() {
    document.querySelectorAll("button[data-flag]").forEach((button) => {
      button.setAttribute("aria-pressed", flags[button.dataset.flag] ? "true" : "false");
    });
  }

  function render() {
    const result = model.scenario(flags);
    const parts =
      "Waiting " +
      fmt(result.counted.wait) +
      " · Setup " +
      fmt(result.counted.setup) +
      " · Running " +
      fmt(result.counted.run);

    $("run-time").textContent = fmt(result.runWall);
    $("sticky-time").textContent = fmt(result.runWall);
    $("run-parts").textContent = parts;
    $("sticky-until").textContent =
      result.rounds + (result.rounds === 1 ? " run · " : " runs · ") + fmt(result.untilGreen);
    $("saved").textContent = result.saved
      ? fmt(result.saved) + " faster than the 40:00 start."
      : "This is the slow start: about 40 minutes of queue, cold setup, and serial checks.";

    $("audit").textContent = auditLine(result.flags);

    const mode = $("mode");
    if (result.flags.parallel) {
      const critical = result.jobs.find((job) => job.id === result.criticalId);
      mode.textContent =
        "Jobs overlap. This run is the slowest job (" +
        critical.name +
        ", " +
        fmt(result.runWall) +
        "), not the sum of every job (" +
        fmt(result.sumWall) +
        ").";
    } else {
      mode.textContent = "Jobs run one after another, so this run is every bar added together.";
    }

    fillBar($("summary-bar"), result.counted.wait, result.counted.setup, result.counted.run, result.runWall);

    const list = $("jobs");
    list.replaceChildren();
    result.jobs.forEach((job) => {
      const onClock = !result.flags.parallel || job.id === result.criticalId;
      const head = el("div", { class: "job-head" }, [
        el("h3", { text: job.name }),
        onClock && result.flags.parallel ? el("span", { class: "badge", text: "Sets the clock" }) : null,
        el("span", { class: "job-time", text: fmt(job.total) }),
      ]);
      const track = el("div", { class: "track" }, [el("div", { class: "bar" })]);
      fillBar(track.firstChild, job.wait, job.setup, job.run, job.total);
      track.firstChild.setAttribute("aria-hidden", "true");
      const meta =
        "Waiting " + fmt(job.wait) + " · Setup " + fmt(job.setup) + " · Running " + fmt(job.run);
      const note = result.flags.parallel && !onClock ? "Runs at the same time. It does not add to this run." : "";
      list.append(
        el("article", { class: "job" + (onClock && result.flags.parallel ? " critical" : "") }, [
          head,
          el("p", { class: "job-detail", text: job.detail }),
          track,
          el("p", { class: "job-meta", text: meta }),
          note ? el("p", { class: "job-note", text: note }) : null,
        ]),
      );
    });

    const rounds = $("rounds-copy");
    const miss = $("miss-bar");
    if (result.flags.hook) {
      rounds.textContent =
        "Pre-push hook: format, lint, and typecheck on the changed files finish in 9s. The agent fixes the type error in scheduling/slot.ts before the push. Until green: 1 CI run, " +
        fmt(result.runWall) +
        ".";
      fillBar(miss, 0, 0, result.localHook, result.localHook);
      miss.style.width = (result.localHook / result.runWall) * 100 + "%";
      $("miss-label").textContent = "Local hook 9s, drawn against this CI run (" + fmt(result.runWall) + ").";
    } else {
      rounds.textContent =
        "No pre-push hook: the agent learns about the type error from a red check and pushes again. Until green: " +
        result.rounds +
        " CI runs, " +
        fmt(result.untilGreen) +
        ".";
      fillBar(miss, result.counted.wait, result.counted.setup, result.counted.run, result.runWall);
      $("miss-label").textContent = "The extra red run costs another " + fmt(result.runWall) + ".";
    }

    $("live").textContent =
      "This CI run is " +
      fmt(result.runWall) +
      ". " +
      parts +
      ". Until green: " +
      result.rounds +
      " run" +
      (result.rounds === 1 ? "" : "s") +
      ", " +
      fmt(result.untilGreen) +
      ".";
  }

  $("toggles").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-flag]");
    if (!button) return;
    const flag = button.dataset.flag;
    flags[flag] = !flags[flag];
    button.setAttribute("aria-pressed", flags[flag] ? "true" : "false");
    render();
  });

  $("all-on").addEventListener("click", () => {
    model.FLAGS.forEach((key) => {
      flags[key] = true;
    });
    syncPressed();
    render();
  });

  $("reset").addEventListener("click", () => {
    model.FLAGS.forEach((key) => {
      flags[key] = false;
    });
    syncPressed();
    render();
  });

  render();
})();
