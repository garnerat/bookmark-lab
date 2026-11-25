(function () {
  "use strict";

  var model = globalThis.HeadroomLab;
  if (!model) return;

  var $ = function (id) { return document.getElementById(id); };
  var live = $("live");
  var lastLive = "";

  function money(amount) {
    if (amount == null || !isFinite(amount)) return "\u2014";
    var abs = Math.abs(amount);
    var digits = abs > 0 && abs < 0.01 ? 4 : 2;
    return (amount < 0 ? "\u2212" : "") + "$" + abs.toFixed(digits);
  }

  function group(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function pct(n) {
    var text = (Math.round(n * 10) / 10).toFixed(1);
    if (text.slice(-2) === ".0") text = text.slice(0, -2);
    return text + "%";
  }

  function selectedId() {
    var node = document.querySelector("[data-input][aria-pressed='true']");
    return node ? node.getAttribute("data-input") : "reservations";
  }

  function announce(text) {
    if (!live || text === lastLive) return;
    lastLive = text;
    live.textContent = text;
  }

  function render() {
    var id = selectedId();
    var aggressive = $("aggressive").checked;
    var view = model.run(id, { aggressive: aggressive });
    var price = $("price").value;
    var bill = model.costs(view.tokensBefore, view.tokensAfter, price);

    document.querySelectorAll("[data-input]").forEach(function (button) {
      var on = button.getAttribute("data-input") === view.id;
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });

    $("aggressive-wrap").className = aggressive ? "check is-on" : "check";
    $("question").textContent = view.question;
    $("tokens-before").textContent = group(view.tokensBefore);
    $("tokens-after").textContent = group(view.tokensAfter);
    $("tokens-saved").textContent = pct(view.savedPercent);
    $("before-meta").textContent = "Full tool output. " + group(view.tokensBefore) + " estimated tokens. Scroll inside the box.";
    $("after-meta").textContent = view.answerKept
      ? "What the agent would be sent. The answer is still in this text."
      : "What the agent would be sent. The answer is not in this text.";
    $("before").textContent = view.before;
    $("after").textContent = view.after;
    $("after-pane").className = view.answerKept ? "pane is-good" : "pane is-bad";

    var verdict = $("verdict");
    verdict.className = view.answerKept ? "verdict kept" : "verdict dropped";
    $("verdict-title").textContent = view.verdictTitle;
    $("verdict-body").textContent = view.verdictBody;
    $("agent-label").textContent = "What the agent would answer from the compressed context";
    $("agent").textContent = view.agentAnswer;
    $("truth").textContent = view.truth;
    $("technique").textContent = view.technique;

    if (!bill) {
      $("cost-before").textContent = "\u2014";
      $("cost-after").textContent = "\u2014";
      $("cost-diff").textContent = "\u2014";
      $("cost-note").textContent = "Enter an example price of zero or more.";
    } else {
      $("cost-before").textContent = money(bill.before);
      $("cost-after").textContent = money(bill.after);
      $("cost-diff").textContent = money(bill.difference);
      $("cost-note").textContent = bill.difference === 0
        ? "Same estimated input cost either way, at " + money(Number(price)) + " per million tokens, for 1,000 calls."
        : "About " + money(bill.difference) + " less input spend per 1,000 calls at " + money(Number(price)) + " per million tokens. Output tokens are not in this calculator.";
    }

    announce(
      view.label + ". " +
      (aggressive ? "Aggressive mode." : "Anomalies kept.") + " " +
      pct(view.savedPercent) + " estimated savings. " +
      view.verdictTitle
    );
  }

  document.querySelectorAll("[data-input]").forEach(function (button) {
    button.addEventListener("click", function () {
      document.querySelectorAll("[data-input]").forEach(function (other) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      });
      render();
    });
  });

  $("aggressive").addEventListener("change", render);
  $("price").addEventListener("input", render);
  render();
})();
