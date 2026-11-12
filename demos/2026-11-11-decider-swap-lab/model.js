// Scripted simulation of swapping an LLM labeler for a small decision model.
// Probabilities are written by hand. Nothing here is trained or fetched.
(function () {
  const ORDER = ["noheat", "maintenance", "quote", "billing", "warranty", "spam", "other"];

  const LABELS = [
    {
      id: "noheat",
      name: "Emergency, no heat",
      short: "No heat",
      criterion: "The heat is off, the home is cold, or someone reports a gas smell. They need a person today.",
    },
    {
      id: "maintenance",
      name: "Maintenance booking",
      short: "Maintenance",
      criterion: "They want a tune-up, a filter, or a seasonal visit, and the system is still running.",
    },
    {
      id: "quote",
      name: "Quote request",
      short: "Quote",
      criterion: "They want a price for equipment or a replacement before anyone is booked.",
    },
    {
      id: "billing",
      name: "Billing question",
      short: "Billing",
      criterion: "They are asking about a charge, a refund, an invoice copy, or how to pay.",
    },
    {
      id: "warranty",
      name: "Warranty claim",
      short: "Warranty",
      criterion: "Something this shop installed or replaced has failed, and they want that coverage honored.",
    },
    {
      id: "spam",
      name: "Spam or vendor pitch",
      short: "Spam",
      criterion: "A seller, a lead broker, or an agency wants the shop's money or its customer list.",
    },
    {
      id: "other",
      name: "Other / none",
      short: "Other",
      criterion: "None of the labels fit. Hours, a thank-you, a wrong number, or a job note with no emergency.",
    },
  ];

  const LABEL_BY_ID = {};
  LABELS.forEach((label) => {
    LABEL_BY_ID[label.id] = label;
  });

  const CONFUSABLE = {
    noheat: "maintenance",
    maintenance: "quote",
    quote: "maintenance",
    billing: "warranty",
    warranty: "billing",
    spam: "quote",
    other: "maintenance",
  };

  const KEYS = ["body", "channel", "desk", "received"];
  const PERMS = [
    ["received", "body", "desk", "channel"],
    ["desk", "received", "channel", "body"],
    ["channel", "body", "received", "desk"],
    ["body", "received", "channel", "desk"],
  ];

  // Reported by the Strands Agents post. The calculator uses these rounded figures.
  const POST = {
    llmName: "Claude Sonnet 4.6",
    llmMs: 4215,
    llmInputTokens: 6554,
    llmOutputTokens: 170,
    llmUsdPerTicket: 0.0222,
    llmUsdPerMillion: 22200,
    inputUsdPerMillionTokens: 3,
    outputUsdPerMillionTokens: 15,
    deciderName: "Strands Decider E4B",
    instance: "ml.g5.xlarge",
    instanceUsdPerHour: 1.408,
    deciderMs: 897,
    deciderInputTokens: 2009,
    deciderOutputTokens: 1,
    throughputMs: 640,
    ticketsPerHour: 5600,
    usdPerMillionFull: 250,
    usdPerMillionPractical: 500,
    cheaperTimes: 44,
    reductionPercent: 98,
    categories: 20,
    rollbackSeconds: 45,
    keyOrderMaxDelta: 0.19,
    hoursInMonthIllustration: 730,
  };

  const VOLUMES = [2000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000];
  const GOTCHA_ID = "b2";
  const CHANNELS = { web: "Web form", text: "Text", email: "Email" };

  function zero() {
    const out = {};
    ORDER.forEach((id) => {
      out[id] = 0;
    });
    return out;
  }

  function evenTail(topId, top, secondId, second) {
    const out = zero();
    out[topId] = top;
    out[secondId] = second;
    const rest = ORDER.filter((id) => id !== topId && id !== secondId);
    const remain = 1000 - top - second;
    if (remain < 0) throw new Error("evenTail overflow");
    const each = Math.floor(remain / rest.length);
    let extra = remain - each * rest.length;
    rest.forEach((id) => {
      out[id] = each + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
    });
    return out;
  }

  function pairNudge(loseId, gainId, amount) {
    const out = zero();
    out[loseId] = -amount;
    out[gainId] = amount;
    return out;
  }

  function view(topId, top, secondId, second, confidence) {
    return { p: evenTail(topId, top, secondId, second), c: confidence };
  }

  const CLEAR_CONF = [
    900, 920, 880, 940,
    860, 900, 920, 880,
    910, 890, 930, 870,
    900, 860, 940,
    880, 920, 900,
    860, 910, 890,
    930, 870, 900,
  ];

  const CLEAR_SPECS = [
    ["c01", "text", "noheat", "Furnace quit overnight. The house is 48 and we are in coats. Can someone come now?"],
    ["c02", "web", "noheat", "No heat since 6. The thermostat says 70. The vents are cold. There is a newborn here."],
    ["c03", "email", "noheat", "The boiler is off. We smell gas and we are standing outside. Please treat this as an emergency."],
    ["c04", "text", "noheat", "The heat pump is silent. Indoor temperature is 52. The outdoor unit will not spin."],
    ["c05", "web", "maintenance", "Please book the spring tune-up the week of April 6. The furnace is working."],
    ["c06", "text", "maintenance", "Your filter reminder came through. We want the maintenance visit, not a repair."],
    ["c07", "email", "maintenance", "Please schedule the yearly furnace check. The last one was October 2025. The heat works."],
    ["c08", "web", "maintenance", "Please replace the 16x25 filter and the humidifier pad. Nothing is down."],
    ["c09", "email", "quote", "The house is about 2,400 square feet in Price Hill. What would a new 96% furnace cost, installed?"],
    ["c10", "web", "quote", "We want a ballpark to replace the furnace and the central air together. The system still runs."],
    ["c11", "text", "quote", "Please quote a heat pump for a 1,100 square foot ranch. We want numbers before we book anyone."],
    ["c12", "email", "quote", "The HOA needs a written estimate for a rooftop unit on a 4-unit building. No service call yet."],
    ["c13", "text", "billing", "The card was charged twice for the October visit. Invoice 4412. Please refund one of them."],
    ["c14", "email", "billing", "Please send a copy of the November 2 invoice for a flex spending account."],
    ["c15", "web", "billing", "The portal shows $240. The technician said $180. Which one do I pay?"],
    ["c16", "web", "warranty", "You installed this furnace in March. It bangs on startup. We were told parts were covered for 10 years."],
    ["c17", "text", "warranty", "The capacitor you replaced six weeks ago failed again. That visit should still be under warranty."],
    ["c18", "email", "warranty", "The thermostat you sold us in August has a blank screen. The receipt is attached."],
    ["c19", "email", "spam", "We buy HVAC companies in Ohio. Do you have 20 minutes to talk about selling your maintenance plans?"],
    ["c20", "web", "spam", "SEO for heating contractors. We promise page-one rankings. Reply STOP to opt out."],
    ["c21", "text", "spam", "This is LeadNest. We have 40 furnace leads on the west side this week at $45 each."],
    ["c22", "text", "other", "What time do you close on Saturday?"],
    ["c23", "email", "other", "Wrong number. I was trying to reach a dentist."],
    ["c24", "web", "other", "Thanks for getting the heat back on yesterday. No reply needed."],
  ];

  function clearMessage(spec, confidence) {
    const id = spec[0];
    const channel = spec[1];
    const truth = spec[2];
    const text = spec[3];
    const second = CONFUSABLE[truth];
    return {
      id: id,
      channel: channel,
      text: text,
      truth: truth,
      clarity: "clear",
      why: "",
      llm: view(truth, 910, second, 30, 910),
      decider: view(truth, 880, second, 20, confidence),
      nudge: pairNudge(truth, second, 40),
      nudgeC: -20,
    };
  }

  const HARD = [
    {
      id: "b1",
      channel: "text",
      truth: "maintenance",
      clarity: "borderline",
      text: "The back bedroom is chilly. The rest of the house is fine. Can this wait for a tune-up slot?",
      why: "They asked for a tune-up slot, and the heat is still on in the rest of the house.",
      llm: view("maintenance", 780, "noheat", 140, 830),
      decider: view("maintenance", 470, "noheat", 420, 570),
      nudge: pairNudge("maintenance", "noheat", 80),
      nudgeC: -40,
    },
    {
      id: "b2",
      channel: "web",
      truth: "quote",
      clarity: "borderline",
      text: "The air conditioner struggled last July. Please send a replacement price. We can book a tune-up if the price is too high.",
      why: "The request is the replacement price. The tune-up is only if that price is too high.",
      llm: view("quote", 780, "maintenance", 140, 830),
      decider: view("quote", 480, "maintenance", 450, 590),
      nudge: pairNudge("quote", "maintenance", 190),
      nudgeC: -40,
    },
    {
      id: "b3",
      channel: "email",
      truth: "warranty",
      clarity: "borderline",
      text: "You were here in the spring for a warranty repair. The blower is loud again. I think the warranty still covers it, but I am not sure which visit that was.",
      why: "They are claiming the warranty. The doubt is about which visit, not about wanting a tune-up.",
      llm: view("warranty", 780, "maintenance", 140, 830),
      decider: view("warranty", 500, "maintenance", 450, 620),
      nudge: pairNudge("warranty", "maintenance", 80),
      nudgeC: -40,
    },
    {
      id: "b4",
      channel: "web",
      truth: "spam",
      clarity: "borderline",
      text: "A homeowner asked what a furnace costs, and we charge installers for the introduction. Are you taking shared leads at $45?",
      why: "They are selling leads. The price in the message is their fee, not a customer asking for a furnace.",
      llm: view("spam", 780, "quote", 140, 830),
      decider: view("spam", 510, "quote", 450, 650),
      nudge: pairNudge("spam", "quote", 90),
      nudgeC: -40,
    },
    {
      id: "b5",
      channel: "email",
      truth: "billing",
      clarity: "borderline",
      text: "Please explain the extra line on invoice 4418. The part from that job is working, so this is about the bill.",
      why: "They say the part works and they are asking about the invoice.",
      llm: view("billing", 780, "warranty", 140, 830),
      decider: view("billing", 520, "warranty", 460, 670),
      nudge: pairNudge("billing", "warranty", 100),
      nudgeC: -40,
    },
    {
      id: "b6",
      channel: "text",
      truth: "noheat",
      clarity: "borderline",
      text: "Heat is off every night and the house is in the 50s by morning. Days are fine. Do we need an emergency visit or a tune-up?",
      why: "The heat is off overnight and the house is in the 50s. That is an emergency even though days feel normal.",
      llm: view("noheat", 780, "maintenance", 140, 830),
      decider: view("noheat", 530, "maintenance", 470, 710),
      nudge: pairNudge("noheat", "maintenance", 70),
      nudgeC: -40,
    },
    {
      id: "a1",
      channel: "email",
      truth: "maintenance",
      clarity: "ambiguous",
      text: "The furnace short-cycles. Please come look, and if it is not worth fixing send a price to replace it.",
      why: "They want a technician. The replacement price is only if the repair is not worth it.",
      llm: view("maintenance", 740, "quote", 140, 780),
      decider: view("quote", 640, "maintenance", 200, 330),
      nudge: pairNudge("quote", "maintenance", 50),
      nudgeC: 0,
    },
    {
      id: "a2",
      channel: "text",
      truth: "billing",
      clarity: "ambiguous",
      text: "Please review a charge I do not recognize on invoice 4418. I am not asking for a technician unless that charge is for a part I never got.",
      why: "They asked for the charge to be reviewed and said not to send a technician yet.",
      llm: view("billing", 740, "warranty", 140, 780),
      decider: view("warranty", 600, "billing", 220, 380),
      nudge: pairNudge("warranty", "billing", 40),
      nudgeC: 0,
    },
    {
      id: "a3",
      channel: "web",
      truth: "quote",
      clarity: "ambiguous",
      text: "Please send the attic-unit quote you promised. Also move Tuesday's visit to Thursday if that quote is still good.",
      why: "The thing they are waiting on is the quote. Moving the visit depends on it.",
      llm: view("quote", 740, "maintenance", 140, 780),
      decider: view("maintenance", 580, "quote", 250, 420),
      nudge: pairNudge("maintenance", "quote", 30),
      nudgeC: 0,
    },
    {
      id: "a4",
      channel: "email",
      truth: "warranty",
      clarity: "ambiguous",
      text: "The heat pump you installed on September 12 freezes up every morning. Please book the warranty visit. We are holding the invoice until it is fixed.",
      why: "They asked for the warranty visit. The unpaid invoice is leverage, not the question.",
      llm: view("warranty", 740, "billing", 140, 780),
      decider: view("billing", 560, "warranty", 260, 470),
      nudge: pairNudge("billing", "warranty", 40),
      nudgeC: 0,
    },
    {
      id: "a5",
      channel: "web",
      truth: "spam",
      clarity: "ambiguous",
      text: "Do you offer financing? A homeowner in Northside asked our desk to find an installer. We sell the lead. We are not the homeowner.",
      why: "They sell leads. Nobody in this message is a customer of the shop. Both scripted labelers miss it.",
      llm: view("quote", 560, "spam", 250, 640),
      decider: view("other", 520, "spam", 200, 610),
      nudge: pairNudge("other", "spam", 40),
      nudgeC: 0,
    },
    {
      id: "a6",
      channel: "email",
      truth: "noheat",
      clarity: "ambiguous",
      text: "I applied for the installer job last week. Separate from that, the apartment has had no heat since last night and it is 51 degrees.",
      why: "A job note can wait. No heat tonight cannot. The ground truth is the emergency.",
      llm: view("noheat", 740, "other", 140, 780),
      decider: view("other", 630, "noheat", 190, 680),
      nudge: pairNudge("other", "noheat", 50),
      nudgeC: 0,
    },
  ];

  function stamp(index) {
    const total = 8 * 60 + index * 7;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return "2026-11-11T" + String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":00";
  }

  const MESSAGES = CLEAR_SPECS.map((spec, index) => clearMessage(spec, CLEAR_CONF[index])).concat(HARD);
  MESSAGES.forEach((message, index) => {
    message.received = stamp(index);
    message.shuffledKeys = PERMS[index % PERMS.length].slice();
  });

  function sum(map) {
    return ORDER.reduce((total, id) => total + map[id], 0);
  }

  function topId(map) {
    let best = ORDER[0];
    ORDER.forEach((id) => {
      if (map[id] > map[best]) best = id;
    });
    return best;
  }

  function score(message, who, keyOrder) {
    const source = message[who];
    const useNudge = who === "decider" && keyOrder === "shuffled";
    const thousandths = {};
    ORDER.forEach((id) => {
      thousandths[id] = source.p[id] + (useNudge ? message.nudge[id] : 0);
    });
    const confidenceThousandths = source.c + (useNudge ? message.nudgeC : 0);
    return {
      label: topId(thousandths),
      thousandths: thousandths,
      confidenceThousandths: confidenceThousandths,
      confidence: confidenceThousandths / 1000,
    };
  }

  function validate() {
    if (CLEAR_SPECS.length !== 24 || CLEAR_CONF.length !== 24) throw new Error("clear set");
    if (MESSAGES.length !== 36) throw new Error("count");
    const ids = {};
    MESSAGES.forEach((message) => {
      if (ids[message.id]) throw new Error("dup " + message.id);
      ids[message.id] = true;
      if (!CHANNELS[message.channel]) throw new Error("channel " + message.id);
      if (!LABEL_BY_ID[message.truth]) throw new Error("truth " + message.id);
      if (sum(message.llm.p) !== 1000) throw new Error(message.id + " llm sum");
      if (sum(message.decider.p) !== 1000) throw new Error(message.id + " decider sum");
      if (sum(message.nudge) !== 0) throw new Error(message.id + " nudge sum");
      ORDER.forEach((id) => {
        const next = message.decider.p[id] + message.nudge[id];
        if (next < 0 || next > 1000) throw new Error(message.id + " range");
        if (Math.abs(message.nudge[id]) > 190) throw new Error(message.id + " cap");
      });
      const sorted = score(message, "decider", "sorted");
      const shuffled = score(message, "decider", "shuffled");
      const llm = score(message, "llm", "sorted");
      if (sorted.confidenceThousandths < 0 || shuffled.confidenceThousandths > 1000) {
        throw new Error(message.id + " conf");
      }
      if (message.clarity === "clear") {
        if (sorted.label !== message.truth || llm.label !== message.truth || shuffled.label !== message.truth) {
          throw new Error(message.id + " clear");
        }
        if (message.decider.c < 860) throw new Error(message.id + " clear conf");
      } else if (message.clarity === "borderline") {
        if (sorted.label !== message.truth || llm.label !== message.truth || shuffled.label === message.truth) {
          throw new Error(message.id + " borderline");
        }
      } else if (message.clarity === "ambiguous") {
        if (sorted.label === message.truth || shuffled.label !== sorted.label) throw new Error(message.id + " ambiguous");
      } else {
        throw new Error("clarity");
      }
      const sortedKeys = message.shuffledKeys.slice().sort().join(",");
      if (sortedKeys !== KEYS.slice().sort().join(",")) throw new Error("perm " + message.id);
      if (message.shuffledKeys.join(",") === KEYS.join(",")) throw new Error("perm sorted " + message.id);
    });
    if (score(MESSAGES.find((message) => message.id === "b2"), "decider", "sorted").label !== "quote") {
      throw new Error("gotcha");
    }
  }

  validate();

  function messageById(id) {
    return MESSAGES.find((message) => message.id === id);
  }

  function evaluate(options) {
    const mode = options.mode;
    const keyOrder = options.keyOrder;
    const fallback = options.fallback;
    const thresholdPercent = options.thresholdPercent;
    const cutoff = thresholdPercent * 10;
    let agreement = 0;
    let labeled = 0;
    let correct = 0;
    let llmCorrect = 0;
    let resolvedCorrect = 0;
    const flipIds = [];
    const rows = MESSAGES.map((message) => {
      const llm = score(message, "llm", "sorted");
      const decider = score(message, "decider", keyOrder);
      const sorted = score(message, "decider", "sorted");
      const shuffled = score(message, "decider", "shuffled");
      const flipped = sorted.label !== shuffled.label;
      if (flipped) flipIds.push(message.id);
      const agree = llm.label === decider.label;
      if (agree) agreement += 1;
      if (llm.label === message.truth) llmCorrect += 1;
      const keeps = decider.confidenceThousandths >= cutoff;
      if (keeps && decider.label === message.truth) correct += 1;
      if (keeps) labeled += 1;
      let source;
      let applied;
      if (mode === "decider") {
        if (keeps) {
          source = "decider";
          applied = decider.label;
        } else if (fallback === "llm") {
          source = "llm";
          applied = llm.label;
        } else {
          source = "human";
          applied = "human";
        }
      } else {
        source = "llm";
        applied = llm.label;
      }
      if (source !== "human" && applied === message.truth) resolvedCorrect += 1;
      return {
        id: message.id,
        truth: message.truth,
        clarity: message.clarity,
        llm: llm,
        decider: decider,
        agree: agree,
        flipped: flipped,
        keeps: keeps,
        source: source,
        applied: applied,
        abstained: mode === "decider" && !keeps,
      };
    });
    const n = MESSAGES.length;
    const abstain = n - labeled;
    return {
      n: n,
      rows: rows,
      mode: mode,
      keyOrder: keyOrder,
      fallback: fallback,
      thresholdPercent: thresholdPercent,
      agreement: agreement,
      flipIds: flipIds,
      flipCount: flipIds.length,
      llmCorrect: llmCorrect,
      resolvedCorrect: resolvedCorrect,
      decider: {
        labeled: labeled,
        correct: correct,
        abstain: abstain,
        accuracy: labeled ? correct / labeled : null,
        coverage: labeled / n,
        fallbackRate: abstain / n,
      },
    };
  }

  function group(n) {
    return String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatCents(cents) {
    const negative = cents < 0;
    const abs = Math.abs(Math.round(cents));
    const dollars = Math.floor(abs / 100);
    const rem = abs % 100;
    const body = rem === 0 && dollars >= 100 ? group(dollars) : group(dollars) + "." + String(rem).padStart(2, "0");
    return (negative ? "-$" : "$") + body;
  }

  function formatMs(ms) {
    return group(ms) + " ms";
  }

  function formatCount(n) {
    return group(n);
  }

  function centsPerMillion(volume, perMillion) {
    return Math.round((volume * perMillion) / 1e4);
  }

  function appliedMs(mode, abstain, total, fallback) {
    if (mode !== "decider") return POST.llmMs;
    if (fallback === "llm") return Math.round(POST.deciderMs + (abstain / total) * POST.llmMs);
    return POST.deciderMs;
  }

  function monthInstanceCents() {
    // 730 hours * $1.408, in cents, with integer math.
    return Math.round((POST.hoursInMonthIllustration * 1408) / 10);
  }

  function volumeBand(volume) {
    if (volume < 50000) return "small";
    if (volume < 250000) return "mid";
    return "high";
  }

  function bill(volume, mode, abstain, total, fallback) {
    const llmCents = centsPerMillion(volume, POST.llmUsdPerMillion);
    const fullCents = centsPerMillion(volume, POST.usdPerMillionFull);
    const practicalCents = centsPerMillion(volume, POST.usdPerMillionPractical);
    const extraCents = Math.round((abstain * llmCents) / total);
    const blendLlmCents = practicalCents + extraCents;
    const blendHumanCents = practicalCents;
    let switchCents = llmCents;
    if (mode === "dual") switchCents = llmCents + practicalCents;
    if (mode === "decider") switchCents = fallback === "llm" ? blendLlmCents : blendHumanCents;
    return {
      volume: volume,
      band: volumeBand(volume),
      llmCents: llmCents,
      fullCents: fullCents,
      practicalCents: practicalCents,
      extraCents: extraCents,
      blendLlmCents: blendLlmCents,
      blendHumanCents: blendHumanCents,
      switchCents: switchCents,
      savingsCents: llmCents - switchCents,
      appliedMs: appliedMs(mode, abstain, total, fallback),
      monthCents: monthInstanceCents(),
    };
  }

  function thresholdSentence(result, fallback) {
    const dest = fallback === "llm" ? "the LLM" : "a person";
    const labeled = result.decider.labeled;
    if (labeled === 0) {
      return "At " + result.thresholdPercent + "% confidence, the decider labels nothing. All " + result.n + " messages go to " + dest + ".";
    }
    return "At " + result.thresholdPercent + "% confidence, the decider labels " + labeled + " of " + result.n + ", " + result.decider.correct + " of those match the ground truth, and " + result.decider.abstain + " go to " + dest + ".";
  }

  function agreementSentence(result) {
    const pct = Math.round((100 * result.agreement) / result.n);
    let sentence = result.agreement + " of " + result.n + " messages get the same top label (" + pct + "%).";
    if (result.keyOrder === "shuffled") {
      sentence += " Shuffled keys flip " + result.flipCount + " borderline labels, and those join the disagreements.";
    } else {
      sentence += " DUAL keeps the LLM label. The rows below are for review, not for an automatic merge.";
    }
    return sentence;
  }

  function points(thousandths) {
    const tenths = thousandths / 10;
    return (thousandths % 10 === 0 ? tenths.toFixed(0) : tenths.toFixed(1)) + "%";
  }

  function probability(thousandths) {
    const text = (thousandths / 1000).toFixed(2);
    return text.replace(/0$/, "").replace(/\.0$/, "");
  }

  function gotchaSentence(keyOrder) {
    const message = messageById(GOTCHA_ID);
    const before = score(message, "decider", "sorted");
    const after = score(message, "decider", "shuffled");
    const name = LABEL_BY_ID.quote.short;
    const drop = name + " on this message goes from " + probability(before.thousandths.quote) + " to " + probability(after.thousandths.quote) + ", a change of 0.19.";
    if (keyOrder === "sorted") {
      return "Keys are sorted, which is the fix. Shuffle them and " + drop + " The top label would flip.";
    }
    return "Nothing in the text changed. Only the key order changed. " + drop + " The top label flips.";
  }

  function payloadText(message, keyOrder) {
    const payload = {
      body: message.text,
      channel: message.channel,
      desk: "front",
      received: message.received,
    };
    const keys = keyOrder === "sorted" ? KEYS.slice() : message.shuffledKeys;
    const lines = keys.map((key) => "  " + JSON.stringify(key) + ": " + JSON.stringify(payload[key]));
    return "{\n" + lines.join(",\n") + "\n}";
  }

  function configText(mode) {
    const name = mode === "llm" ? "BEDROCK" : mode === "dual" ? "DUAL" : "DECIDER";
    return "# Read on every message. The post's rollback was a 45-second config change.\nrouting = " + name + "  # BEDROCK | DUAL | DECIDER";
  }

  function modeSentence(mode) {
    if (mode === "llm") return "LLM only. The post called this BEDROCK. The decision model does not run.";
    if (mode === "dual") return "Both run in parallel. The LLM label is the one that is applied. Disagreements are compared, not merged.";
    return "Decision model only. Below the confidence cutoff it abstains.";
  }

  function switchSentence(result, costs) {
    const money = formatCents(costs.switchCents);
    const wait = formatMs(costs.appliedMs);
    const blend = formatCents(costs.blendLlmCents);
    if (result.mode === "llm") {
      return "This switch is LLM only: " + money + " this month, " + wait + " a call. Fallback blend if DECIDER calls Sonnet on abstains: " + blend + ".";
    }
    if (result.mode === "dual") {
      return "DUAL runs both, so this month is " + money + " and the wait is still " + wait + ". Fallback blend on DECIDER, with Sonnet only on abstains: " + blend + ".";
    }
    if (result.fallback === "llm") {
      return "DECIDER with LLM fallback: " + money + " this month (" + formatCents(costs.practicalCents) + " for every decider call plus " + formatCents(costs.extraCents) + " of Sonnet on abstains). Average wait " + wait + ".";
    }
    return "DECIDER, with a person on abstains: " + money + " in model spend, " + wait + " on the calls it keeps. The person's time is not in the post's prices, so the blended model spend stays " + money + ".";
  }

  function volumeSentence(costs) {
    const llm = formatCents(costs.llmCents);
    const practical = formatCents(costs.practicalCents);
    const gap = formatCents(Math.abs(costs.llmCents - costs.practicalCents));
    if (costs.band === "small") {
      return "This month, at the post's per-ticket rates: LLM " + llm + ", decider " + practical + ". The gap is " + gap + ".";
    }
    if (costs.band === "mid") {
      return "This month: LLM " + llm + ", decider " + practical + ". The gap is " + gap + " and growing. It is still not the million-ticket case.";
    }
    return "This month: LLM " + llm + ", decider " + practical + ". The savings dominate at this volume.";
  }

  function tokenUsd() {
    return (POST.llmInputTokens * POST.inputUsdPerMillionTokens + POST.llmOutputTokens * POST.outputUsdPerMillionTokens) / 1e6;
  }

  globalThis.DeciderSwap = {
    SHOP: {
      name: "Cumminsville Comfort",
      place: "Cincinnati",
      neighborhood: "Cumminsville",
    },
    LABELS: LABELS,
    ORDER: ORDER,
    MESSAGES: MESSAGES,
    POST: POST,
    VOLUMES: VOLUMES,
    KEYS: KEYS,
    CHANNELS: CHANNELS,
    GOTCHA_ID: GOTCHA_ID,
    labelById: function (id) {
      return LABEL_BY_ID[id];
    },
    messageById: messageById,
    score: score,
    evaluate: evaluate,
    bill: bill,
    appliedMs: appliedMs,
    monthInstanceCents: monthInstanceCents,
    volumeBand: volumeBand,
    formatCents: formatCents,
    formatMs: formatMs,
    formatCount: formatCount,
    points: points,
    thresholdSentence: thresholdSentence,
    agreementSentence: agreementSentence,
    gotchaSentence: gotchaSentence,
    payloadText: payloadText,
    configText: configText,
    modeSentence: modeSentence,
    switchSentence: switchSentence,
    volumeSentence: volumeSentence,
    tokenUsd: tokenUsd,
  };
})();
