(function (root) {
  "use strict";

  var FULL = "\u2588";
  var LIGHT = "\u2591";

  var LEVELS = [
    { level: 0, label: "unaware" },
    { level: 1, label: "heard of it" },
    { level: 2, label: "can follow along" },
    { level: 3, label: "can do with help" },
    { level: 4, label: "can do independently" },
    { level: 5, label: "can teach it / handle edge cases" }
  ];

  var SUBSKILLS = [
    { id: "read", name: "Read the request" },
    { id: "limit", name: "Don't invent a firm price" },
    { id: "handoff", name: "Hand off jobs outside the book" },
    { id: "gaps", name: "Leave unknown facts blank" },
    { id: "check", name: "Owner reviews before send" }
  ];

  var SHOP = {
    name: "Clifton Air Co.",
    place: "Clifton, Cincinnati",
    range: "$4,800 to $7,200"
  };

  var GUARD_QUESTION = "Want a quick answer, or should I actually teach you this properly?";
  var DIAG_INTRO = "I'll start by asking a few questions, one at a time, to see what you already know.";
  var LOOP_OFF = "This was a one-off question, so the tutoring loop stays off.";
  var NOT_QUITE = "Not quite.";

  var PROMPTS = [
    {
      id: "explain",
      kind: "oneoff",
      text: "Explain how an agent should answer a quote email."
    },
    {
      id: "howto",
      kind: "ambiguous",
      text: "How do I use an agent for quotes?"
    },
    {
      id: "teach",
      kind: "teach",
      text: "Teach me how an agent should handle a customer quote request."
    }
  ];

  var QUICK = [
    "The agent can send the book's range for a standard furnace replacement, " + SHOP.range + " in this example, and it should not invent a single firm price. A firm price waits until a tech sees the house.",
    "Oil boilers, heat pumps, and commercial jobs are outside the book, so those go to a person. Missing facts stay blank. The owner reads the draft before it is sent.",
    LOOP_OFF
  ];

  var LECTURE = [
    "An agent handling a quote for a heating shop should do five things, and here they all are.",
    "Read the email and write down the address, the equipment, and the timing. Also write down what is missing.",
    "If the job is in the price book, send the range and not a number you made up. A standard furnace replacement in this shop's book is " + SHOP.range + ". A firm price waits until a tech sees the house.",
    "If the job is outside the book, stop. Oil boilers, heat pumps, and commercial work go to a person.",
    "Do not fill the blanks in. Basement access, the flue, and closet size stay unknown until someone looks.",
    "The owner reads the draft before it is sent. A tidy draft is still a draft.",
    "A finished reply sounds like this: \"Furnace replacements in our book run " + SHOP.range + " for a standard install. A firm price waits until a tech sees the house. Which afternoon this week works for a look?\""
  ];

  var DIAGNOSTIC = [
    {
      id: "d1",
      prompt: "A customer emails: \"Furnace is dead at 1842 Clifton Ave. Can you quote a replacement this week?\" What should the agent do first?",
      choices: [
        { id: "price", text: "Find a recent furnace job and send that price.", set: { read: 1 } },
        { id: "pull", text: "Write down the address, the dead furnace, and \"this week,\" and list what the email left out.", set: { read: 3 } },
        { id: "brand", text: "Ask which brand they want before doing anything with the rest of the email.", set: { read: 1 } }
      ]
    },
    {
      id: "d2",
      prompt: "The price book says a standard furnace replacement is " + SHOP.range + ". The customer asks for the exact price. What should the agent send?",
      choices: [
        { id: "mid", text: "Pick $5,900, the middle, so they have one number.", set: { limit: 1 } },
        { id: "range", text: "Send the range and say a firm price waits until a tech sees the house.", set: { limit: 3 } },
        { id: "none", text: "Say the shop does not discuss money by email.", set: { limit: 0 } }
      ]
    },
    {
      id: "d3",
      prompt: "The same thread says they have an oil boiler and want a heat pump. Nobody has seen the basement. What should the agent do?",
      choices: [
        { id: "quote", text: "Quote a heat pump and describe a typical basement so the reply looks finished.", set: { handoff: 0, gaps: 0 } },
        { id: "stop", text: "Stop. Hand the job to a person, and leave the basement unknown.", set: { handoff: 3, gaps: 3 } },
        { id: "furnace", text: "Send the furnace range and add \"basement looks standard.\"", set: { handoff: 1, gaps: 0 } }
      ]
    },
    {
      id: "d4",
      prompt: "The draft is ready and the customer is waiting. What happens next?",
      choices: [
        { id: "after", text: "Send it, then text the owner.", set: { check: 1 } },
        { id: "hold", text: "Hold it. Nothing is sent until the owner has read it.", set: { check: 3 } },
        { id: "skip", text: "Send it. A second look slows the shop down.", set: { check: 0 } }
      ]
    }
  ];

  var LESSONS = {
    read: {
      explain: "Reading means writing down the facts the email actually gave, and leaving a blank where it gave none. Address, equipment, and timing are the facts a quote needs.",
      ask: {
        prompt: "A new email says only: \"Can you come look at the AC?\" What should the agent write down before it drafts anything?",
        choices: [
          { id: "slot", correct: false, text: "Nothing. Offer the next open morning." },
          { id: "facts", correct: true, text: "That the address, the equipment, and the timing are all missing." },
          { id: "brand", correct: false, text: "The brand they want. Treat that as the whole request." }
        ]
      },
      narrow: {
        prompt: "The email never names a street. If the agent offers Thursday anyway, what has it skipped?",
        choices: [
          { id: "tone", correct: false, text: "Nothing that matters. A friendly time is enough." },
          { id: "where", correct: true, text: "The place. A visit has no address yet." },
          { id: "logo", correct: false, text: "The logo. The wording can wait." }
        ]
      },
      retest: {
        prompt: "Another note says \"heater making a noise, sometime next month.\" Which start is right?",
        choices: [
          { id: "fill", correct: false, text: "Fill in the shop's address and call it a furnace." },
          { id: "blanks", correct: true, text: "Record \"heater\" and \"next month,\" and leave the address and the kind of heater blank." },
          { id: "price", correct: false, text: "Skip the reading and attach a price." }
        ]
      },
      recall: {
        prompt: "Are you sure? What about an email that says \"same as my neighbor\"? What does the agent still have to list?",
        choices: [
          { id: "copy", correct: false, text: "Nothing. Copy the neighbor's last quote." },
          { id: "own", correct: true, text: "This customer's address, the equipment, and the timing. The neighbor's job is not this request." },
          { id: "name", correct: false, text: "Only a first name." }
        ]
      }
    },
    limit: {
      explain: "A firm number is a promise the book does not support. The agent may repeat the book's range. It may not invent a single price.",
      ask: {
        prompt: "The book lists a standard furnace replacement at " + SHOP.range + ". The customer writes: \"Just give me the number so I can decide tonight.\" What should the agent send?",
        choices: [
          { id: "mid", correct: false, text: "$5,900, so they have one number tonight." },
          { id: "range", correct: true, text: "The range, plus a line that a firm price waits until a tech sees the house." },
          { id: "none", correct: false, text: "No price. Say the shop does not discuss money by email." }
        ]
      },
      narrow: {
        prompt: "If the agent sends $5,900 and the flue has to be rebuilt, who is stuck with that number?",
        choices: [
          { id: "nobody", correct: false, text: "Nobody. A number in an email is only a guess." },
          { id: "shop", correct: true, text: "The shop. The customer heard a promise." },
          { id: "customer", correct: false, text: "The customer. They should have known it could change." }
        ]
      },
      retest: {
        prompt: "A different customer wants a water-heater swap. The book has a range. The closet has not been seen. Which reply fits?",
        choices: [
          { id: "firm", correct: false, text: "Send one price from the middle of the range and name a day." },
          { id: "range", correct: true, text: "Send the book's range and say there is no firm price until the closet is seen." },
          { id: "invent", correct: false, text: "Guess a standard closet and quote as if it were measured." }
        ]
      },
      recall: {
        prompt: "Are you sure? A landlord wants \"the price\" for two furnaces on a street no one has visited. What does the agent send?",
        choices: [
          { id: "firm", correct: false, text: "One number for both, so the landlord can budget tonight." },
          { id: "range", correct: true, text: "The book's range for a furnace, and a note that a firm price waits on a visit." },
          { id: "silence", correct: false, text: "Nothing until the owner types an exact price for that street." }
        ]
      }
    },
    handoff: {
      explain: "Outside the book means stop, and hand the job to a person. Oil boilers, heat pumps, and commercial work are not lines the agent gets to price.",
      ask: {
        prompt: "A property manager asks for a quote to replace an oil boiler with a heat pump in a church. What should the agent do?",
        choices: [
          { id: "quote", correct: false, text: "Send a heat-pump price from a similar job last spring." },
          { id: "stop", correct: true, text: "Stop. That job is outside the book, so hand it to a person." },
          { id: "furnace", correct: false, text: "Send the furnace range. It is close enough." }
        ]
      },
      narrow: {
        prompt: "The book has no heat-pump line. If the agent prices it anyway, what is it using?",
        choices: [
          { id: "book", correct: false, text: "The book. A missing line just means use the nearest one." },
          { id: "outside", correct: true, text: "Something the book does not contain. That is a job for a person." },
          { id: "speed", correct: false, text: "The customer's deadline. A fast number is the priority." }
        ]
      },
      retest: {
        prompt: "A restaurant wants a quote for rooftop cooling the book never lists. What happens?",
        choices: [
          { id: "range", correct: false, text: "Send the furnace range with the restaurant's name on it." },
          { id: "person", correct: true, text: "Hand it to a person. The book does not cover that job." },
          { id: "guess", correct: false, text: "Guess a rooftop price so the reply is not empty." }
        ]
      },
      recall: {
        prompt: "Are you sure? What about a landlord who says \"just use the furnace number for the heat pump\"? What should the agent do?",
        choices: [
          { id: "agree", correct: false, text: "Use the furnace number. The landlord asked for it." },
          { id: "stop", correct: true, text: "Refuse the swap and hand the heat pump to a person." },
          { id: "discount", correct: false, text: "Send the furnace number minus ten percent." }
        ]
      }
    },
    gaps: {
      explain: "An unknown fact stays blank. A guess dressed up as a detail is still a guess.",
      ask: {
        prompt: "The furnace email never says whether the tech can get into the basement. What belongs in the draft?",
        choices: [
          { id: "typical", correct: false, text: "A line that the basement is a typical Clifton basement." },
          { id: "blank", correct: true, text: "Nothing about the basement. Leave it unknown." },
          { id: "visited", correct: false, text: "A line that a tech already looked, so the customer can relax." }
        ]
      },
      narrow: {
        prompt: "The draft says \"basement access is fine.\" The email did not say that. What is that sentence?",
        choices: [
          { id: "helpful", correct: false, text: "A helpful extra. The customer will correct it if needed." },
          { id: "invented", correct: true, text: "A fact the agent invented. It has to come out." },
          { id: "book", correct: false, text: "A line from the price book. The book covers basements." }
        ]
      },
      retest: {
        prompt: "A water-heater email says nothing about the closet. The draft says \"closet is standard.\" What should the agent do with that line?",
        choices: [
          { id: "keep", correct: false, text: "Keep it so the quote looks complete." },
          { id: "cut", correct: true, text: "Cut it. The closet has not been described." },
          { id: "photo", correct: false, text: "Change it to \"we have a photo of the closet\" even though no photo arrived." }
        ]
      },
      recall: {
        prompt: "Are you sure? The customer writes \"the usual setup, you know.\" What does the agent record for the parts the email never names?",
        choices: [
          { id: "usual", correct: false, text: "The shop's usual layout. The customer said usual." },
          { id: "blank", correct: true, text: "Blanks. \"Usual\" does not name the basement, the flue, or the closet." },
          { id: "prior", correct: false, text: "Whatever the last customer had." }
        ]
      }
    },
    check: {
      explain: "A draft is not sent until the owner has read it. A waiting customer does not skip that read.",
      ask: {
        prompt: "The draft is tidy and the customer is waiting on the phone. What happens before anyone hits send?",
        choices: [
          { id: "send", correct: false, text: "Send it. A second read makes the shop look slow." },
          { id: "owner", correct: true, text: "The owner reads it. Nothing goes out until then." },
          { id: "after", correct: false, text: "Send it, then text the owner that it went out." }
        ]
      },
      narrow: {
        prompt: "The owner has not opened the draft. The customer is still on the phone. What is true of that draft?",
        choices: [
          { id: "ready", correct: false, text: "It is ready. Waiting is only politeness." },
          { id: "unsent", correct: true, text: "It is not sent. The owner's read has not happened." },
          { id: "customer", correct: false, text: "The customer already approved it by calling." }
        ]
      },
      retest: {
        prompt: "A different draft is two sentences and looks obvious. The owner is on a roof. What should the agent do?",
        choices: [
          { id: "send", correct: false, text: "Send it. Two sentences cannot be wrong." },
          { id: "hold", correct: true, text: "Hold it until the owner has read it, roof or not." },
          { id: "tech", correct: false, text: "Have the tech text it to the customer from the van." }
        ]
      },
      recall: {
        prompt: "Are you sure? What about a draft the agent has checked twice itself? Who still has to read it before it is sent?",
        choices: [
          { id: "agent", correct: false, text: "No one else. Two checks by the agent are enough." },
          { id: "owner", correct: true, text: "The owner. The agent's own check is not the owner's read." },
          { id: "customer", correct: false, text: "The customer, after it arrives, which counts as the review." }
        ]
      }
    }
  };

  var REVIEWS = {
    read: {
      prompt: "A week later someone writes only: \"AC again.\" What does the agent list before it drafts?",
      choices: [
        { id: "book", correct: false, text: "Nothing else. Put them on the next slot." },
        { id: "missing", correct: true, text: "Address, which equipment, and when. The note has none of those." },
        { id: "price", correct: false, text: "The price first. The address can wait." }
      ]
    },
    limit: {
      prompt: "A landlord asks for the price of a furnace replacement at a house no one has visited. What can the agent send?",
      choices: [
        { id: "one", correct: false, text: "One number in the middle of the range." },
        { id: "range", correct: true, text: "The book's range, and a line that a firm price waits on a visit." },
        { id: "zero", correct: false, text: "No reply until the owner types an exact dollar amount." }
      ]
    },
    handoff: {
      prompt: "A church asks for a quote to replace an oil boiler with a heat pump. What does the agent do?",
      choices: [
        { id: "range", correct: false, text: "Send the furnace range. A quote is a quote." },
        { id: "person", correct: true, text: "Stop and hand it to a person. That job is not in the book." },
        { id: "guess", correct: false, text: "Quote a heat pump from a typical church basement." }
      ]
    },
    gaps: {
      prompt: "The email does not say whether the basement is accessible. The draft currently says \"basement is standard.\" What should change?",
      choices: [
        { id: "keep", correct: false, text: "Keep it. A complete-sounding draft is better." },
        { id: "blank", correct: true, text: "Delete that sentence. The basement is unknown." },
        { id: "visit", correct: false, text: "Change it to \"we already inspected the basement.\"" }
      ]
    },
    check: {
      prompt: "The draft looks finished and the customer asked for a reply today. Who has to read it before it is sent?",
      choices: [
        { id: "agent", correct: false, text: "No one. The agent already wrote it." },
        { id: "owner", correct: true, text: "The owner. Today does not skip that read." },
        { id: "tech", correct: false, text: "A tech, after the customer receives it." }
      ]
    }
  };

  var FINAL = {
    prompt: "A customer at 410 Warner Street wants a firm price today to replace an oil boiler with a heat pump. No one has seen the basement. The draft says \"$6,100, we can install Thursday.\" What should happen to that draft?",
    choices: [
      { id: "send", correct: false, text: "Send it. They asked for a price today." },
      { id: "hold", correct: true, text: "Do not send it. Hand it to the owner with the gaps listed. The job is outside the book, the basement is unknown, and $6,100 is a firm price nobody earned." },
      { id: "swap", correct: false, text: "Replace $6,100 with the furnace range and send that." }
    ]
  };

  function emptyBase() {
    var base = {};
    SUBSKILLS.forEach(function (skill) { base[skill.id] = 0; });
    return base;
  }

  function emptyChecks() {
    var checks = {};
    SUBSKILLS.forEach(function (skill) { checks[skill.id] = []; });
    return checks;
  }

  function createState() {
    return {
      phase: "pick",
      promptId: null,
      strict: true,
      base: emptyBase(),
      checks: emptyChecks(),
      focus: null,
      diagIndex: 0,
      fails: 0,
      finalCorrect: null
    };
  }

  function copyState(state) {
    var base = {};
    var checks = {};
    SUBSKILLS.forEach(function (skill) {
      base[skill.id] = state.base[skill.id];
      checks[skill.id] = state.checks[skill.id].map(function (item) {
        return { kind: item.kind, correct: item.correct };
      });
    });
    return {
      phase: state.phase,
      promptId: state.promptId,
      strict: state.strict,
      base: base,
      checks: checks,
      focus: state.focus,
      diagIndex: state.diagIndex,
      fails: state.fails,
      finalCorrect: state.finalCorrect
    };
  }

  function skillById(id) {
    for (var i = 0; i < SUBSKILLS.length; i += 1) {
      if (SUBSKILLS[i].id === id) return SUBSKILLS[i];
    }
    return null;
  }

  function promptById(id) {
    for (var i = 0; i < PROMPTS.length; i += 1) {
      if (PROMPTS[i].id === id) return PROMPTS[i];
    }
    return null;
  }

  function findChoice(question, id) {
    if (!question) return null;
    for (var i = 0; i < question.choices.length; i += 1) {
      if (question.choices[i].id === id) return question.choices[i];
    }
    return null;
  }

  function publicChoices(choices) {
    return choices.map(function (choice) {
      return { id: choice.id, text: choice.text };
    });
  }

  function proposedFocus(base) {
    var best = SUBSKILLS[0].id;
    SUBSKILLS.forEach(function (skill) {
      if (base[skill.id] < base[best]) best = skill.id;
    });
    return best;
  }

  function reviewTarget(state) {
    var ids = [];
    SUBSKILLS.forEach(function (skill) {
      if (skill.id !== state.focus) ids.push(skill.id);
    });
    for (var i = 0; i < ids.length; i += 1) {
      if (state.base[ids[i]] > 0) return ids[i];
    }
    return ids[0];
  }

  function bump(state, id) {
    var checks = (state.checks[id] || []).filter(function (item) {
      return item.correct && item.kind !== "review";
    });
    if (!checks.length) return 0;
    if (!state.strict) return 1;
    var prompted = checks.some(function (item) { return item.kind === "prompted"; });
    var recall = checks.some(function (item) { return item.kind === "recall"; });
    return prompted && recall ? 1 : 0;
  }

  function reviewDelta(state, id) {
    var review = (state.checks[id] || []).find(function (item) { return item.kind === "review"; });
    if (!review || review.correct) return 0;
    return -1;
  }

  function displayedLevels(state) {
    var levels = {};
    SUBSKILLS.forEach(function (skill) {
      var level = state.base[skill.id] + bump(state, skill.id) + reviewDelta(state, skill.id);
      if (level < 0) level = 0;
      if (level > 5) level = 5;
      levels[skill.id] = level;
    });
    return levels;
  }

  function overallPercent(levels) {
    var sum = 0;
    SUBSKILLS.forEach(function (skill) { sum += levels[skill.id]; });
    return Math.round((sum / (SUBSKILLS.length * 5)) * 100);
  }

  function blocks(filled, total) {
    var n = filled;
    if (n < 0) n = 0;
    if (n > total) n = total;
    return FULL.repeat(n) + LIGHT.repeat(total - n);
  }

  function skillMapText(state) {
    var levels = displayedLevels(state);
    var pct = overallPercent(levels);
    var lines = [];
    lines.push(" Topic: Customer quote: overall: " + blocks(Math.round(pct / 10), 10) + " " + pct + "%");
    lines.push("-----------------------------------------------------------------");
    SUBSKILLS.forEach(function (skill) {
      var level = levels[skill.id];
      var suffix = " " + LEVELS[level].label;
      if (state.focus === skill.id) suffix += " <- current focus";
      lines.push(skill.name.padEnd(32, " ") + "[" + blocks(level * 2, 10) + "] " + level + "/5" + suffix);
    });
    lines.push("-----------------------------------------------------------------");
    return lines.join("\n");
  }

  function mapView(state) {
    var levels = displayedLevels(state);
    return {
      text: skillMapText(state),
      overall: overallPercent(levels),
      rows: SUBSKILLS.map(function (skill) {
        return {
          id: skill.id,
          name: skill.name,
          level: levels[skill.id],
          label: LEVELS[levels[skill.id]].label,
          focus: state.focus === skill.id
        };
      })
    };
  }

  function addCheck(state, id, kind, correct) {
    state.checks[id] = state.checks[id].concat([{ kind: kind, correct: correct }]);
  }

  function startDiag(state) {
    var next = copyState(state);
    next.phase = "diag";
    next.diagIndex = 0;
    next.base = emptyBase();
    next.checks = emptyChecks();
    next.focus = null;
    next.fails = 0;
    next.finalCorrect = null;
    return next;
  }

  function choosePrompt(state, id) {
    if (state.phase !== "pick") return state;
    var prompt = promptById(id);
    if (!prompt) return state;
    var next = copyState(state);
    next.promptId = prompt.id;
    if (prompt.kind === "teach") return startDiag(next);
    next.phase = prompt.kind === "ambiguous" ? "guard" : "oneoff";
    return next;
  }

  function chooseGuard(state, id) {
    if (id === "teach" && (state.phase === "guard" || state.phase === "oneoff")) return startDiag(state);
    if (id === "quick" && state.phase === "guard") {
      var next = copyState(state);
      next.phase = "oneoff";
      return next;
    }
    return state;
  }

  function setStrict(state, on) {
    var strict = !!on;
    if (state.strict === strict) return state;
    var next = copyState(state);
    next.strict = strict;
    return next;
  }

  function chooseFocus(state, id) {
    if (state.phase !== "map") return state;
    if (!skillById(id)) return state;
    var next = copyState(state);
    next.focus = id;
    next.phase = "ask";
    next.fails = 0;
    return next;
  }

  function answerDiag(state, choiceId) {
    if (state.phase !== "diag") return state;
    var question = DIAGNOSTIC[state.diagIndex];
    var choice = findChoice(question, choiceId);
    if (!choice) return state;
    var next = copyState(state);
    Object.keys(choice.set).forEach(function (id) {
      next.base[id] = choice.set[id];
    });
    if (next.diagIndex + 1 < DIAGNOSTIC.length) {
      next.diagIndex += 1;
      return next;
    }
    next.phase = "map";
    next.focus = proposedFocus(next.base);
    return next;
  }

  function answerAsk(state, choiceId) {
    if (state.phase !== "ask") return state;
    var choice = findChoice(LESSONS[state.focus].ask, choiceId);
    if (!choice) return state;
    var next = copyState(state);
    addCheck(next, state.focus, "prompted", choice.correct);
    next.fails = choice.correct ? 0 : 1;
    next.phase = choice.correct ? "recall" : "narrow";
    return next;
  }

  function answerNarrow(state, choiceId) {
    if (state.phase !== "narrow") return state;
    var choice = findChoice(LESSONS[state.focus].narrow, choiceId);
    if (!choice) return state;
    var next = copyState(state);
    if (choice.correct) {
      addCheck(next, state.focus, "assisted", true);
      next.phase = "recall";
      return next;
    }
    next.fails = 2;
    next.phase = "explain";
    return next;
  }

  function continueFromExplain(state) {
    if (state.phase !== "explain") return state;
    var next = copyState(state);
    next.phase = "retest";
    return next;
  }

  function answerRetest(state, choiceId) {
    if (state.phase !== "retest") return state;
    var choice = findChoice(LESSONS[state.focus].retest, choiceId);
    if (!choice) return state;
    var next = copyState(state);
    addCheck(next, state.focus, "retest", choice.correct);
    next.phase = "review";
    return next;
  }

  function answerRecall(state, choiceId) {
    if (state.phase !== "recall") return state;
    var choice = findChoice(LESSONS[state.focus].recall, choiceId);
    if (!choice) return state;
    var next = copyState(state);
    addCheck(next, state.focus, "recall", choice.correct);
    next.phase = "review";
    return next;
  }

  function answerReview(state, choiceId) {
    if (state.phase !== "review") return state;
    var id = reviewTarget(state);
    var choice = findChoice(REVIEWS[id], choiceId);
    if (!choice) return state;
    var next = copyState(state);
    addCheck(next, id, "review", choice.correct);
    next.phase = "final";
    return next;
  }

  function answerFinal(state, choiceId) {
    if (state.phase !== "final") return state;
    var choice = findChoice(FINAL, choiceId);
    if (!choice) return state;
    var next = copyState(state);
    next.finalCorrect = choice.correct;
    next.phase = "summary";
    return next;
  }

  function act(state, action) {
    if (!action || !action.type) return state;
    if (action.type === "restart") return createState();
    if (action.type === "strict") return setStrict(state, action.on);
    if (action.type === "prompt") return choosePrompt(state, action.id);
    if (action.type === "guard") return chooseGuard(state, action.id);
    if (action.type === "focus") return chooseFocus(state, action.id);
    if (action.type === "continue") return continueFromExplain(state);
    if (action.type === "choice") {
      if (state.phase === "guard") return chooseGuard(state, action.id);
      if (state.phase === "diag") return answerDiag(state, action.id);
      if (state.phase === "ask") return answerAsk(state, action.id);
      if (state.phase === "narrow") return answerNarrow(state, action.id);
      if (state.phase === "retest") return answerRetest(state, action.id);
      if (state.phase === "recall") return answerRecall(state, action.id);
      if (state.phase === "review") return answerReview(state, action.id);
      if (state.phase === "final") return answerFinal(state, action.id);
    }
    return state;
  }

  var MAP_PHASES = { map: 1, ask: 1, narrow: 1, explain: 1, retest: 1, recall: 1, review: 1, final: 1, summary: 1 };

  function weakest(levels) {
    var min = 5;
    SUBSKILLS.forEach(function (skill) {
      if (levels[skill.id] < min) min = levels[skill.id];
    });
    var names = [];
    SUBSKILLS.forEach(function (skill) {
      if (levels[skill.id] === min) names.push(skill.name);
    });
    return { min: min, names: names, allSame: names.length === SUBSKILLS.length };
  }

  function noteFor(state) {
    var lines = [];
    if (!state.focus || state.phase === "map" || state.phase === "pick" || state.phase === "diag") return lines;
    var id = state.focus;
    var name = skillById(id).name;
    var base = state.base[id];
    var checks = state.checks[id] || [];
    var promptedOk = checks.some(function (item) { return item.kind === "prompted" && item.correct; });
    var promptedBad = checks.some(function (item) { return item.kind === "prompted" && !item.correct; });
    var recall = checks.find(function (item) { return item.kind === "recall"; });
    var assisted = checks.find(function (item) { return item.kind === "assisted"; });
    var retest = checks.find(function (item) { return item.kind === "retest"; });
    var raisedTo = Math.min(5, base + 1);

    if (promptedOk) {
      if (state.strict) {
        lines.push("Be strict is on. The first correct answer did not raise " + name + ". It stayed at " + base + "/5.");
      } else {
        lines.push("Be strict is off. The first correct answer raised " + name + " from " + base + "/5 to " + raisedTo + "/5.");
      }
    }
    if (promptedOk && recall && recall.correct) {
      if (state.strict) {
        lines.push("The recall check was the second independent check, and it was right. " + name + " is now " + raisedTo + "/5.");
      } else {
        lines.push("The recall check was also right. The level had already moved on the first answer. The skill would have waited for this one.");
      }
    }
    if (promptedOk && recall && !recall.correct) {
      if (state.strict) {
        lines.push("The recall check was wrong, so " + name + " stays at " + base + "/5.");
      } else {
        lines.push("The recall check was wrong. Be strict is off, so the level stays at the raise from the first answer.");
      }
    }
    if (assisted && assisted.correct && promptedBad) {
      if (state.strict) {
        lines.push("The narrower question was right. That was done with help, so it does not count as an independent check. " + name + " stays at " + base + "/5.");
      } else {
        lines.push("Be strict is off. The assisted answer raised " + name + " from " + base + "/5 to " + raisedTo + "/5.");
      }
    }
    if (recall && recall.correct && !promptedOk) {
      if (state.strict) {
        lines.push("The new case was right. Be strict still wants two independent checks, and the assisted answer is not one of them. " + name + " stays at " + base + "/5.");
      } else {
        lines.push("The new case was right. Be strict is off, so the level had already moved on the assisted answer.");
      }
    }
    if (retest && retest.correct) {
      if (state.strict) {
        lines.push("The re-test was right, and it came right after the explanation. That is not unprompted recall. " + name + " stays at " + base + "/5.");
      } else {
        lines.push("Be strict is off. The re-test raised " + name + " from " + base + "/5 to " + raisedTo + "/5. The skill would not treat a re-test that follows an explanation as a new level.");
      }
    }
    if (retest && !retest.correct) {
      lines.push("The re-test was wrong. " + name + " stays at " + base + "/5.");
    }

    var reviewId = reviewTarget(state);
    var review = (state.checks[reviewId] || []).find(function (item) { return item.kind === "review"; });
    if (review) {
      var reviewName = skillById(reviewId).name;
      var before = state.base[reviewId];
      if (review.correct) {
        lines.push("Spaced review of " + reviewName + " held at " + before + "/5. A pass does not move it ahead.");
      } else if (before === 0) {
        lines.push("Spaced review of " + reviewName + " was missed. It is already at 0/5, unaware, so it cannot fall further. The skill would still revisit it.");
      } else {
        lines.push("Spaced review of " + reviewName + " was missed. The level drops from " + before + "/5 to " + (before - 1) + "/5.");
      }
    }
    return lines;
  }

  function headingFor(state) {
    if (state.phase === "pick") return "The tutor is waiting";
    if (state.phase === "oneoff") return "Quick answer";
    if (state.phase === "map") return "Where should the lesson start?";
    if (state.phase === "explain") return "A short explanation";
    if (state.phase === "summary") return "Where the session landed";
    return "";
  }

  function present(state) {
    var prompt = state.promptId ? promptById(state.promptId) : null;
    var view = {
      phase: state.phase,
      kicker: "",
      heading: "",
      paragraphs: [],
      question: null,
      actions: [],
      actionsLabel: "Next step",
      showRestart: state.phase !== "pick",
      showStrict: !!MAP_PHASES[state.phase],
      showPrompts: state.phase === "pick",
      note: noteFor(state),
      map: MAP_PHASES[state.phase] ? mapView(state) : null,
      lecture: prompt ? LECTURE : null,
      userLine: prompt ? prompt.text : null,
      summary: null,
      reviewName: null
    };

    if (state.phase === "pick") {
      view.kicker = "Waiting for a request";
      view.heading = headingFor(state);
      view.paragraphs = ["Pick a sentence above. A lesson starts only if you ask to be taught."];
      return view;
    }

    if (state.phase === "oneoff") {
      view.kicker = "Intent guard. One-off question.";
      view.heading = headingFor(state);
      view.paragraphs = QUICK.slice();
      view.actions = [{ type: "guard", id: "teach", text: "Teach me this properly" }];
      view.actionsLabel = "Change the request";
      return view;
    }

    if (state.phase === "guard") {
      view.kicker = "Intent guard. Not a clear request to be taught.";
      view.question = {
        prompt: GUARD_QUESTION,
        choices: [
          { id: "quick", text: "Quick answer" },
          { id: "teach", text: "Teach me properly" }
        ]
      };
      return view;
    }

    if (state.phase === "diag") {
      var diag = DIAGNOSTIC[state.diagIndex];
      view.kicker = "Diagnostic · " + (state.diagIndex + 1) + " of " + DIAGNOSTIC.length + ". No teaching yet.";
      if (state.diagIndex === 0) view.paragraphs = [DIAG_INTRO];
      view.question = { prompt: diag.prompt, choices: publicChoices(diag.choices) };
      return view;
    }

    if (state.phase === "map") {
      var proposed = skillById(state.focus);
      view.kicker = "Initial skill map.";
      view.heading = headingFor(state);
      view.paragraphs = [
        "Here is the skill map. Nothing has been taught yet.",
        "I would start with " + proposed.name + ". You can pick a different subskill."
      ];
      view.actionsLabel = "Choose a subskill";
      view.actions = SUBSKILLS.map(function (skill) {
        var proposedRow = skill.id === state.focus;
        return {
          type: "focus",
          id: skill.id,
          proposed: proposedRow,
          text: proposedRow ? "Start with " + skill.name : "Work on " + skill.name + " instead"
        };
      });
      return view;
    }

    var lesson = LESSONS[state.focus];

    if (state.phase === "ask") {
      view.kicker = "One question.";
      view.question = { prompt: lesson.ask.prompt, choices: publicChoices(lesson.ask.choices) };
      return view;
    }

    if (state.phase === "narrow") {
      view.kicker = "Narrower question. The answer stays back.";
      view.paragraphs = [NOT_QUITE];
      view.question = { prompt: lesson.narrow.prompt, choices: publicChoices(lesson.narrow.choices) };
      return view;
    }

    if (state.phase === "explain") {
      view.kicker = "Two misses. A short explanation, then a new angle.";
      view.heading = headingFor(state);
      view.paragraphs = [lesson.explain];
      view.actions = [{ type: "continue", text: "Re-test from a new angle" }];
      view.actionsLabel = "Continue";
      return view;
    }

    if (state.phase === "retest") {
      view.kicker = "Re-test from a new angle.";
      view.question = { prompt: lesson.retest.prompt, choices: publicChoices(lesson.retest.choices) };
      return view;
    }

    if (state.phase === "recall") {
      view.kicker = "Second check. Unprompted recall.";
      view.question = { prompt: lesson.recall.prompt, choices: publicChoices(lesson.recall.choices) };
      return view;
    }

    if (state.phase === "review") {
      var reviewId = reviewTarget(state);
      var review = REVIEWS[reviewId];
      view.reviewName = skillById(reviewId).name;
      view.kicker = "Spaced review.";
      view.paragraphs = ["An earlier subskill comes back, with no warning."];
      view.question = { prompt: review.prompt, choices: publicChoices(review.choices) };
      return view;
    }

    if (state.phase === "final") {
      view.kicker = "Final mixed assessment.";
      view.paragraphs = ["One problem that uses the whole quote, not a single subskill."];
      view.question = { prompt: FINAL.prompt, choices: publicChoices(FINAL.choices) };
      return view;
    }

    var levels = displayedLevels(state);
    var weak = weakest(levels);
    var weakLine = weak.allSame
      ? "No subskill is behind the others. All five are at " + weak.min + "/5, still short of the default target of 4."
      : "Weakest: " + weak.names.join(", ") + " at " + weak.min + "/5.";
    view.kicker = "Session summary.";
    view.heading = headingFor(state);
    view.paragraphs = [
      state.finalCorrect
        ? "The integrative question passed."
        : "The integrative question did not pass. The skill would go back to the teaching loop.",
      weakLine,
      "The default target is 4/5 on every subskill. Level 5 also takes an edge case and an explanation clear enough to teach. This simulation stops after one pass."
    ];
    view.summary = {
      passed: !!state.finalCorrect,
      weakest: weak.names.slice(),
      min: weak.min,
      allSame: weak.allSame
    };
    return view;
  }

  root.SocraticTutor = {
    LEVELS: LEVELS,
    SUBSKILLS: SUBSKILLS,
    SHOP: SHOP,
    PROMPTS: PROMPTS,
    DIAGNOSTIC: DIAGNOSTIC,
    LESSONS: LESSONS,
    REVIEWS: REVIEWS,
    FINAL: FINAL,
    GUARD_QUESTION: GUARD_QUESTION,
    DIAG_INTRO: DIAG_INTRO,
    LOOP_OFF: LOOP_OFF,
    NOT_QUITE: NOT_QUITE,
    LECTURE: LECTURE,
    QUICK: QUICK,
    createState: createState,
    act: act,
    present: present,
    displayedLevels: displayedLevels,
    skillMapText: skillMapText,
    overallPercent: overallPercent,
    reviewTarget: reviewTarget,
    proposedFocus: proposedFocus
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
