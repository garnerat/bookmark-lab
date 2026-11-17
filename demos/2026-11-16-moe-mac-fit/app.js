(function () {
  const model = globalThis.MoeMacFit;
  if (!model) return;

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

  function press(selector, match) {
    document.querySelectorAll(selector).forEach((node) => {
      const on = match(node);
      node.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function pressedValue(selector, attr) {
    const node = document.querySelector(selector + '[aria-pressed="true"]');
    return node ? node.getAttribute(attr) : null;
  }

  function read() {
    return {
      totalB: $("total-b").value,
      activeB: $("active-b").value,
      lookupB: $("lookup-b").value,
      bits: pressedValue("[data-bits]", "data-bits"),
      ramGB: pressedValue("[data-ram]", "data-ram"),
      bandwidthGBps: $("bandwidth").value,
      context: $("context").value,
      kvBytesPerToken: $("kv-bytes").value,
      headroom: pressedValue("[data-headroom]", "data-headroom"),
      lookupOnSsd: $("lookup-ssd").checked,
      streamExperts: $("stream-experts").checked,
      ssdGBps: $("ssd").value,
    };
  }

  function applyPreset(id) {
    const preset = id === "deepseek" ? model.DEEPSEEK : model.HY4;
    $("total-b").value = String(preset.totalB);
    $("active-b").value = preset.activeB == null ? "" : String(preset.activeB);
    $("lookup-b").value = String(preset.lookupB);
    press("[data-bits]", (node) => node.getAttribute("data-bits") === String(preset.bits));
    $("lookup-ssd").checked = true;
    $("stream-experts").checked = false;
    $("preset-note").textContent = id === "deepseek"
      ? "DeepSeek V4.1 Flash uses the posts’ 290 GB of FP4 experts, converted to 580B at 4 bits. Engram is not in that figure. Active params stay blank."
      : "Hy4 flash is 224B total, 12B active, 64B lookup, 4-bit, with the lookup on the SSD.";
  }

  function syncPresetButtons(result) {
    const id = result.ok ? model.matchPreset(result.input) : "custom";
    press("[data-preset]", (node) => node.getAttribute("data-preset") === id);
  }

  function syncBandwidthChip() {
    const value = Number($("bandwidth").value);
    press("[data-gbps]", (node) => Number(node.getAttribute("data-gbps")) === value);
  }

  function syncContextChip() {
    const value = Number($("context").value);
    press("[data-context]", (node) => Number(node.getAttribute("data-context")) === value);
  }

  let lastLive = "";

  function announce(text) {
    if (text === lastLive) return;
    lastLive = text;
    $("live").textContent = text;
  }

  function renderBar(result) {
    const bar = $("meter-bar");
    bar.replaceChildren();
    if (!result.ok || result.verdict === "NEED_ACTIVE") {
      $("meter-mark").hidden = true;
      return;
    }
    $("meter-mark").hidden = false;
    const scale = result.scaleGB || 1;
    result.segments.forEach((segment) => {
      const share = segment.gb / scale;
      const piece = el("span", {
        class: "seg " + segment.id + (share < 0.03 ? " sliver" : ""),
      });
      piece.style.flexGrow = String(segment.gb);
      piece.style.flexBasis = "0";
      bar.append(piece);
    });
    const pct = (result.input.ramGB / scale) * 100;
    const mark = $("meter-mark");
    mark.style.left = pct + "%";
    const label = $("meter-mark-label");
    label.textContent = model.formatB(result.input.ramGB) + " GB";
    if (pct > 88) label.style.transform = "translateX(-100%)";
    else if (pct < 12) label.style.transform = "translateX(0)";
    else label.style.transform = "translateX(-50%)";
  }

  function renderParts(result) {
    const list = $("parts");
    list.replaceChildren();
    if (!result.ok) return;
    const rows = result.verdict === "NEED_ACTIVE"
      ? [["Resident weights", "needs an active count"], ["KV cache", model.formatGB(result.kvGB)]]
      : (result.breakdown || []).filter((row) => row.gb > 1e-9).map((row) => [row.label, model.formatGB(row.gb)]);
    rows.forEach(([name, value]) => {
      list.append(el("li", { text: name + ": " + value }));
    });
  }

  function renderTiers(report) {
    const host = $("tiers");
    host.replaceChildren();
    if (!report.ok) return;
    report.tiers.forEach((row) => {
      const button = el("button", {
        type: "button",
        text: model.formatB(row.input.ramGB) + " GB · " + row.verdictLabel,
        "aria-pressed": row.input.ramGB === report.current.input.ramGB ? "true" : "false",
      });
      button.addEventListener("click", () => {
        press("[data-ram]", (node) => Number(node.getAttribute("data-ram")) === row.input.ramGB);
        render();
      });
      host.append(button);
    });
  }

  function render() {
    const input = read();
    const result = model.plan(input);
    const report = model.office(input);
    const verdict = $("verdict");
    verdict.textContent = result.verdictLabel;
    verdict.className = "verdict " + (
      result.verdict === "FITS" ? "fit" :
      result.verdict === "TIGHT" ? "tight" :
      result.verdict === "WONT_FIT" ? "miss" :
      result.verdict === "NEED_ACTIVE" ? "need" : "miss"
    );
    $("why").textContent = result.why;
    $("scenario-line").textContent = report.summary;
    $("gotcha").textContent = result.ok ? result.gotcha : result.why;
    const steps = $("steps");
    steps.replaceChildren();
    (result.ok ? result.steps : []).forEach((line) => {
      steps.append(el("li", { text: line }));
    });

    const context = result.ok ? result.input.context : Number($("context").value);
    const kv = result.ok ? result.input.kvBytesPerToken : Number($("kv-bytes").value);
    $("context-readout").textContent = model.commas(context) + " tokens";
    $("context").setAttribute("aria-valuenow", String(context));
    $("context").setAttribute("aria-valuetext", model.commas(context) + " tokens");
    $("kv-readout").textContent = model.commas(kv) + " bytes";
    $("kv-bytes").setAttribute("aria-valuenow", String(kv));
    $("kv-bytes").setAttribute("aria-valuetext", model.commas(kv) + " bytes per token");

    const shown = result.ok ? result.speed.shownTokPerSec : null;
    $("tok").textContent = shown == null ? "—" : model.formatTok(shown) + " tok/s";
    $("speed-line").textContent = result.ok ? result.speed.line : result.why;
    $("active-b").setAttribute("aria-invalid", result.ok && result.verdict === "NEED_ACTIVE" ? "true" : "false");

    renderBar(result);
    renderParts(result);
    renderTiers(report);
    syncPresetButtons(result);
    syncBandwidthChip();
    syncContextChip();

    const speedBit = shown == null ? "no speed estimate" : model.formatTok(shown) + " tokens per second, a rough estimate, not a benchmark";
    announce(result.verdictLabel + ". " + result.why + " " + speedBit);
  }

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-preset");
      if (id === "custom") {
        $("total-b").focus();
        $("preset-note").textContent = "Change total, active, lookup, or bits. Custom lights up when the numbers leave both posts.";
        return;
      }
      applyPreset(id);
      render();
    });
  });

  document.querySelectorAll("[data-bits]").forEach((button) => {
    button.addEventListener("click", () => {
      press("[data-bits]", (node) => node === button);
      render();
    });
  });

  document.querySelectorAll("[data-ram]").forEach((button) => {
    button.addEventListener("click", () => {
      press("[data-ram]", (node) => node === button);
      render();
    });
  });

  document.querySelectorAll("[data-headroom]").forEach((button) => {
    button.addEventListener("click", () => {
      press("[data-headroom]", (node) => node === button);
      render();
    });
  });

  document.querySelectorAll("[data-gbps]").forEach((button) => {
    button.addEventListener("click", () => {
      $("bandwidth").value = button.getAttribute("data-gbps");
      render();
    });
  });

  document.querySelectorAll("[data-context]").forEach((button) => {
    button.addEventListener("click", () => {
      $("context").value = button.getAttribute("data-context");
      render();
    });
  });

  ["total-b", "active-b", "lookup-b", "bandwidth", "ssd", "context", "kv-bytes"].forEach((id) => {
    $(id).addEventListener("input", render);
  });
  $("lookup-ssd").addEventListener("change", render);
  $("stream-experts").addEventListener("change", render);

  $("copy").addEventListener("click", () => {
    const text = $("snippet").textContent;
    const note = $("copy-note");
    const done = (message) => { note.textContent = message; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => done("Copied."),
        () => done("Select the snippet and copy it.")
      );
    } else {
      done("Select the snippet and copy it.");
    }
  });

  render();
})();
