// Scripted simulation of Jane Street's socratic-tutor skill.
// Brightside Veterinary Clinic, the phone card, and every caller are fictional.
// The tutor does not call a model. Every branch is written in this file.
// Skill: https://github.com/janestreet/agent_skills/tree/master/socratic-tutor
(function () {
  "use strict";

  var FULL = "\u2588";
  var LIGHT = "\u2591";

  var CLINIC = "Brightside Veterinary Clinic";
  var TOPIC = "Phone triage";

  var POST = {
    name: "Zane Chee",
    handle: "injaneity",
    url: "https://x.com/injaneity/status/2124685667821297704",
    date: "23 Nov 2026",
    skill: "https://github.com/janestreet/agent_skills/tree/master/socratic-tutor",
    text: "neon + jane street\u2019s socratic tutor is an unpatched method for learning in a way that doesn\u2019t feel like talking to a slop machine"
  };

  var INTENT = {
    explain: "What's a triage protocol?",
    teach: "Teach me phone triage"
  };

  var GUARD_QUESTION = "Want a quick answer, or should I actually teach you this properly?";
  var DIAG_INTRO = "I'll start by asking a few questions, one at a time, to see what you already know.";
  var DIAG_HOLD = "I will not teach anything until the diagnostic is done.";

  var USE = {
    note: "It is an agent skill you add to an agent that supports skills.",
    hour: "Try it in under an hour: turn your own SOP into a tutor session for a new hire."
  };

  var LEVELS = [
    "unaware",
    "heard of it",
    "can follow along",
    "can do with help",
    "can do independently",
    "can teach it / handle edge cases"
  ];

  var TYPE_LABEL = {
    predict: "Predict",
    "explain-why": "Explain why",
    "find-the-flaw": "Find the flaw",
    apply: "Apply",
    diagnostic: "Diagnostic"
  };

  var SUBSKILLS = [
    { id: "sort", name: "Sort the call" },
    { id: "toxin", name: "Toxin calls" },
    { id: "bloat", name: "Bloat signs" },
    { id: "limp", name: "A stable limp" },
    { id: "routine", name: "Routine calls" }
  ];

  var FOCUS_PRIORITY = ["toxin", "bloat", "limp", "routine", "sort"];

  var PROTOCOL = {
    title: "Brightside phone card",
    disclaimer: "Fictional protocol, written for this page. Not veterinary advice. Not for a real patient.",
    emergencyNote: "If the clinic cannot see an emergency right away, send them to the nearest emergency hospital.",
    buckets: [
      {
        id: "emergency",
        name: "Emergency \u2014 come now",
        items: [
          "The pet ate or licked something toxic (chocolate, grapes or raisins, xylitol gum, lilies, rodent bait, human medicine), even if the pet looks normal right now.",
          "Bloat signs: trying to vomit and nothing comes up, a tight or swollen belly, pacing, drooling, or will not settle.",
          "Trouble breathing, collapse, a seizure happening now, bleeding that will not stop, or a male cat straining to pee with little or nothing coming out."
        ]
      },
      {
        id: "sameday",
        name: "Same-day \u2014 book today, not the emergency slot",
        items: [
          "Limping, and the pet is eating and drinking, with no car hit and no dangling leg.",
          "Vomited once or twice and is still bright and walking around.",
          "An ear or skin complaint that started today, and the pet is otherwise fine."
        ]
      },
      {
        id: "routine",
        name: "Routine \u2014 next wellness slot",
        items: [
          "Vaccine reminder, annual exam, or nail trim.",
          "A food or flea question when the pet is well and nothing was eaten."
        ]
      }
    ]
  };

  var COMPARE = {
    heading: "Socratic vs answer-dump",
    setup: "Same wrong answer from the new hire.",
    learner: "The beagle ate a handful of grapes and is playing fetch, so I'll put them on tomorrow's routine list.",
    disclaimer: "Illustrative simulation, not a study result. The script is written so the Socratic path passes this check. It is not evidence about which method works better.",
    skillNote: "The skill has no answer-dump mode. Its override is the command \"just tell me,\" and it covers the current question only. This pair is a contrast added on this page.",
    laterLabel: "Retention check, a few questions later",
    laterCase: "A cat licked a lily and is grooming like normal. The scripted learner is asked whether a routine visit tomorrow fits.",
    socratic: {
      name: "Socratic",
      reply: "You booked routine because the dog is playing fetch. The toxin line says even if the pet looks normal right now. If playing fetch means the dog looks normal, what happens to your reason for waiting?",
      learner: "No. Grooming is looking normal, and that is already the case the line refuses to postpone. Routine tomorrow does not fit.",
      result: "pass",
      resultLabel: "Scripted pass"
    },
    dump: {
      name: "Answer-dump",
      reply: "That's wrong. Grapes are a toxin on this card, so this stays an emergency even though the dog is playing. Take them off the routine list and tell them to come now.",
      learner: "The correction I heard was about grapes. This is a lily, and the cat looks normal, so routine tomorrow is fine.",
      result: "miss",
      resultLabel: "Scripted miss"
    }
  };

  function choice(id, label, ok, miss, score) {
    var row = { id: id, label: label, ok: !!ok };
    if (miss) row.miss = miss;
    if (score) row.score = score;
    return row;
  }

  var DIAG = [
    {
      id: "d-routine",
      type: "diagnostic",
      skill: "routine",
      prompt: "Maya calls about Luna, a healthy adult dog. \"The vaccine reminder came in the mail. She's eating and playing. No cough.\" What do you book?",
      choices: [
        choice("now", "Emergency. Come now.", false, null, "miss"),
        choice("day", "A same-day sick visit.", false, null, "near"),
        choice("routine", "The next routine wellness slot.", true, null, "hit"),
        choice("er", "Tell her to drive to an emergency hospital.", false, null, "miss")
      ]
    },
    {
      id: "d-toxin",
      type: "diagnostic",
      skill: "toxin",
      prompt: "A caller says their terrier ate a few grapes twenty minutes ago and seems totally fine. What do you do?",
      choices: [
        choice("week", "A routine slot next week.", false, null, "near"),
        choice("day", "Same-day this afternoon.", false, null, "near"),
        choice("now", "Emergency. Come now.", true, null, "hit"),
        choice("skip", "No visit. Say grapes are only a problem for cats.", false, null, "miss")
      ]
    },
    {
      id: "d-limp",
      type: "diagnostic",
      skill: "limp",
      prompt: "A Lab has been limping on a back leg since breakfast. He is eating and drinking. There was no car accident. The leg is not dangling. What do you book?",
      choices: [
        choice("now", "Emergency. Treat any limp as life-threatening.", false, null, "near"),
        choice("day", "A same-day appointment today.", true, null, "hit"),
        choice("month", "A routine slot next month.", false, null, "miss"),
        choice("drug", "No visit. Tell them to give a human pain tablet.", false, null, "miss")
      ]
    },
    {
      id: "d-bloat",
      type: "diagnostic",
      skill: "bloat",
      prompt: "A large dog is pacing and drooling. He tries to vomit and nothing comes up. His belly looks tight. The caller wants to come after work. What do you say?",
      choices: [
        choice("later", "After work is fine. The dog is still walking.", false, null, "near"),
        choice("routine", "Put it on the routine list.", false, null, "miss"),
        choice("now", "Come now. Do not wait.", true, null, "hit"),
        choice("morn", "Tomorrow morning, and skip dinner.", false, null, "miss")
      ]
    }
  ];

  function q(id, type, prompt, choices, kicker) {
    return { id: id, type: type, prompt: prompt, choices: choices, kicker: kicker || null };
  }

  var LESSONS = {
    toxin: {
      reveal: "A toxin call stays in the emergency bucket even when the pet looks normal. Playing, begging, or grooming is not a reason to wait.",
      q1: q("toxin-q1", "find-the-flaw", "A coworker tells a caller: \"Your pug ate dark chocolate an hour ago, but he is still begging for dinner, so tomorrow morning is fine.\" What is the flaw?", [
        choice("none", "There is no flaw. Begging means morning is fine.", false, "looks-fine"),
        choice("flaw", "The flaw is using begging to move a toxin call off the emergency bucket.", true),
        choice("routine", "The flaw is treating chocolate as urgent. It belongs on the routine list.", false, "routine")
      ]),
      advocate: q("toxin-adv", "explain-why", "Are you sure? A different dog ate two grapes and is playing fetch. Does the playing move the call to tomorrow?", [
        choice("yes", "Yes. Playing means tomorrow is fine.", false, "looks-fine"),
        choice("no", "No. Playing is looking normal, and the toxin line does not say to wait.", true)
      ], "Devil's advocate"),
      q2: q("toxin-q2", "apply", "New call. A cat licked a lily and went back to grooming. The caller wants the next routine opening. What do you book?", [
        choice("routine", "The next routine opening.", false, "looks-fine"),
        choice("day", "A same-day slot after lunch, not the emergency slot.", false, "looks-fine"),
        choice("now", "The emergency bucket. Grooming does not move a toxin call.", true)
      ]),
      retest: q("toxin-re", "apply", "A dog chewed xylitol gum and seems fine. The caller wants to finish a shift and come in five hours. What do you do with those five hours?", [
        choice("wait", "Leave the five hours. The dog seems fine.", false, "looks-fine"),
        choice("now", "Do not leave them. Looking fine does not postpone a toxin call.", true)
      ]),
      narrow: {
        "looks-fine": q("toxin-n-fine", "explain-why", "You used looking normal as a reason to wait. The toxin line lists \"even if the pet looks normal right now.\" If your reason is looking normal, is that reason inside the line, or outside it?", [
          choice("out", "Outside it. Looking normal is a separate rule that lets the call wait.", false, "looks-fine"),
          choice("in", "Inside it. Looking normal is the case the line already names.", true)
        ]),
        routine: q("toxin-n-routine", "explain-why", "You put something the pet ate on the routine list. Routine on this card is a reminder, an exam, or a nail trim, and the pet is well. Which line is a call about something eaten?", [
          choice("routine", "The routine line. Eating questions are wellness.", false, "routine"),
          choice("toxin", "The toxin line. The caller is reporting something eaten, not a wellness visit.", true)
        ]),
        "default": q("toxin-n-default", "explain-why", "Look at the reason you gave for waiting. The toxin line includes a pet that looks normal right now. Does your reason describe a pet that looks normal?", [
          choice("no", "No. My reason is about something else.", false, "looks-fine"),
          choice("yes", "Yes. My reason is that the pet looks normal, and that case is already in the line.", true)
        ])
      }
    },
    bloat: {
      reveal: "Unproductive retching with a tight or swollen belly is an emergency on this card. A later slot leaves bloat signs waiting.",
      q1: q("bloat-q1", "predict", "A Great Dane is pacing and drooling. He retches, and nothing comes up. His belly looks tight. If you book him after work, what are you predicting?", [
        choice("fine", "He will be fine until after work because he is still standing.", false, "wait"),
        choice("leave", "You are leaving unproductive retching and a tight belly in a later slot.", true),
        choice("well", "You are treating it as a wellness question about dinner.", false, "routine")
      ]),
      advocate: q("bloat-adv", "explain-why", "Are you sure? A different dog retches once, then eats dinner, and his belly is soft. Is that the same call?", [
        choice("same", "Yes. Any retch is the emergency line.", false, "over"),
        choice("diff", "No. He brought something up, then ate, and the belly is soft. That is not the bloat line.", true)
      ], "Devil's advocate"),
      q2: q("bloat-q2", "apply", "A shepherd is restless, trying to vomit, and nothing comes up. The abdomen looks swollen. The caller can arrive in six hours. What do you book?", [
        choice("later", "The six-hour slot.", false, "wait"),
        choice("now", "Come now.", true),
        choice("routine", "The next wellness slot.", false, "routine")
      ]),
      retest: q("bloat-re", "predict", "A doodle is drooling, will not settle, and keeps trying to vomit with nothing coming up. The caller asks to watch him overnight. What are you agreeing to if you say yes?", [
        choice("watch", "A quiet night. Watching is enough for those signs.", false, "wait"),
        choice("leave", "Leaving unproductive retching and restlessness until morning.", true)
      ]),
      narrow: {
        wait: q("bloat-n-wait", "explain-why", "You predicted the dog can wait because he is standing or being watched. The emergency line lists trying to vomit with nothing coming up, and a tight belly. Which of those two did standing cancel?", [
          choice("both", "Both. Standing means those signs can wait.", false, "wait"),
          choice("neither", "Neither. Standing is not on the line as a reason to cancel either sign.", true)
        ]),
        routine: q("bloat-n-routine", "explain-why", "You called this a wellness question. Wellness on this card is vaccines, exams, and nail trims for a pet who is well. This dog is retching with nothing coming up. Which line are those signs on?", [
          choice("routine", "The routine line.", false, "routine"),
          choice("bloat", "The bloat signs on the emergency line.", true)
        ]),
        over: q("bloat-n-over", "find-the-flaw", "You treated one vomit, a normal dinner, and a soft belly as bloat signs. The emergency line wants unproductive retching and a tight belly. Which of those is in the second call?", [
          choice("both", "Both. He vomited, so it counts.", false, "over"),
          choice("neither", "Neither. He brought something up, then ate, and the belly is soft.", true)
        ]),
        "default": q("bloat-n-default", "explain-why", "Two signs are on the emergency line together: nothing comes up, and the belly is tight. Did your answer keep those two signs together, or drop one of them?", [
          choice("drop", "I dropped one and still had him wait.", false, "wait"),
          choice("keep", "I have to keep both. Dropping one is how the wait sneaks in.", true)
        ])
      }
    },
    limp: {
      reveal: "A limp with normal eating, no car hit, and no dangling leg is a same-day visit on this card. It is not the emergency bucket, and it is not a routine wellness slot.",
      q1: q("limp-q1", "find-the-flaw", "A coworker marks every limp as an emergency, including a beagle who has been limping since breakfast, is eating normally, had no car hit, and has no dangling leg. What is the flaw?", [
        choice("none", "There is no flaw. Every limp is an emergency.", false, "over"),
        choice("flaw", "The flaw is using the emergency bucket for a limp the card lists as same-day.", true),
        choice("month", "The flaw is booking anything today. A limp can wait for next month's wellness slot.", false, "routine")
      ]),
      advocate: q("limp-adv", "explain-why", "Are you sure? What if the limp started after the dog was hit by a car? Does that stay a same-day limp?", [
        choice("stay", "Yes. A limp is always same-day.", false, "under"),
        choice("move", "No. A car hit is not the stable-limp line.", true)
      ], "Devil's advocate"),
      q2: q("limp-q2", "apply", "A collie has been limping on a front paw since noon, ate lunch, and was not in a car. The paw is on the ground, not dangling. What do you book?", [
        choice("now", "Emergency.", false, "over"),
        choice("day", "Same-day today.", true),
        choice("month", "Next month's wellness slot.", false, "routine")
      ]),
      retest: q("limp-re", "apply", "A terrier is limping and eating normally. The caller says he jumped off the couch and nothing looks broken. What do you book?", [
        choice("now", "Emergency, because he jumped.", false, "over"),
        choice("day", "Same-day. He is eating, the leg is not dangling, and there was no car hit.", true),
        choice("week", "A routine slot next week.", false, "routine")
      ]),
      narrow: {
        over: q("limp-n-over", "explain-why", "You kept this limp in the emergency bucket. The same-day line is a limp when the pet is eating and drinking, with no car hit and no dangling leg. Which extra fact in this call is the trauma?", [
          choice("limp", "The limp itself. That is the trauma.", false, "over"),
          choice("none", "None. This call has no car hit and no dangling leg.", true)
        ]),
        routine: q("limp-n-routine", "explain-why", "You sent a dog who is limping today to a later wellness slot. Same-day is for a problem that started today when the pet is otherwise stable. Is a new limp a wellness reminder, or a problem for today?", [
          choice("well", "A wellness reminder.", false, "routine"),
          choice("today", "A problem for today.", true)
        ]),
        under: q("limp-n-under", "find-the-flaw", "You kept a car hit on the same-day limp line. That line requires no car hit. Which fact broke the line?", [
          choice("none", "Nothing. A limp is same-day even after a car.", false, "under"),
          choice("car", "The car hit.", true)
        ]),
        "default": q("limp-n-default", "explain-why", "The stable-limp line needs all three: eating and drinking, no car hit, and no dangling leg. Which of those did you skip?", [
          choice("skip", "I treated the limp by itself and ignored the three.", false, "over"),
          choice("all", "I have to keep all three before I call it same-day.", true)
        ])
      }
    },
    routine: {
      reveal: "A vaccine reminder for a well pet is a routine wellness slot. It does not take an emergency or same-day sick slot.",
      q1: q("routine-q1", "predict", "The postcard says a rabies vaccine is due. The dog is eating and playing. If you book this as an emergency, what happens to today's emergency slot?", [
        choice("fine", "Nothing is lost. A vaccine is as urgent as bloat signs.", false, "over"),
        choice("filled", "A well-pet vaccine takes a slot the emergency line is for.", true),
        choice("skip", "The caller should be turned away. Reminders are not bookings.", false, "skip")
      ]),
      advocate: q("routine-adv", "explain-why", "Are you sure? The caller starts with a vaccine reminder, then says the dog has been vomiting all night and is too weak to stand. Does the call stay routine?", [
        choice("stay", "Yes. A vaccine reminder is always routine.", false, "under"),
        choice("leave", "No. Weak and vomiting all night is not a well pet. The reminder is not the urgent part.", true)
      ], "Devil's advocate"),
      q2: q("routine-q2", "apply", "A caller wants a nail trim. The cat is eating and grooming, and nothing was eaten that should not have been. What do you book?", [
        choice("now", "Emergency.", false, "over"),
        choice("day", "A same-day sick visit.", false, "over"),
        choice("routine", "The next routine slot.", true)
      ]),
      retest: q("routine-re", "apply", "A dog is due for an annual exam. He is bright and eating. The caller mentions no toxin and no limp. What do you book?", [
        choice("now", "Emergency, to be safe.", false, "over"),
        choice("day", "A same-day sick visit.", false, "over"),
        choice("routine", "The next routine wellness slot.", true)
      ]),
      narrow: {
        over: q("routine-n-over", "explain-why", "You gave a well pet a sick or emergency slot. The emergency line is toxins, bloat signs, breathing trouble, collapse, seizures, bleeding, and a male cat straining to pee. Which of those is in a reminder for a well pet?", [
          choice("vax", "The reminder itself. That is one of them.", false, "over"),
          choice("none", "None. The pet is well and the caller named a reminder.", true)
        ]),
        skip: q("routine-n-skip", "explain-why", "You turned the reminder away. The routine line is where vaccine reminders go when the pet is well. Is this call on that line?", [
          choice("out", "No. Reminders are not bookings.", false, "skip"),
          choice("on", "Yes. It is on the routine line.", true)
        ]),
        under: q("routine-n-under", "find-the-flaw", "You left a dog who is too weak to stand on the routine line because the caller said \"vaccine.\" The routine line is a well pet. What did you ignore?", [
          choice("none", "Nothing. The word vaccine decides the bucket.", false, "under"),
          choice("weak", "The dog is too weak to stand. That is not a well pet.", true)
        ]),
        "default": q("routine-n-default", "explain-why", "Routine on this card is a well pet and a reminder, an exam, or a nail trim. Is this pet well, and is the request one of those three?", [
          choice("no", "No. I still booked it as sick.", false, "over"),
          choice("yes", "Yes. Well pet, and one of those three.", true)
        ])
      }
    },
    sort: {
      reveal: "When several calls are waiting, the emergency bucket goes first. On this card that is bloat signs, a toxin, or a male cat straining to pee, not a vaccine reminder and not a stable limp.",
      q1: q("sort-q1", "predict", "Three callers are on hold. A vaccine reminder for a well dog. A limping dog who ate breakfast and was not hit by a car. A large dog with a tight belly, pacing, retching, and nothing coming up. Which call do you take first?", [
        choice("vax", "The vaccine reminder.", false, "vaccine"),
        choice("limp", "The limping dog.", false, "limp"),
        choice("bloat", "The dog with the tight belly and the empty retch.", true)
      ]),
      advocate: q("sort-adv", "explain-why", "Are you sure? The limp's owner is upset and talking over you. Do you take that call first because of the volume?", [
        choice("upset", "Yes. Take the limp first. The owner is upset.", false, "upset"),
        choice("no", "No. Volume does not move a stable limp ahead of bloat signs.", true)
      ], "Devil's advocate"),
      q2: q("sort-q2", "apply", "Two calls are waiting. A nail trim for a well cat, and a terrier who ate grapes and is playing. Who do you keep on the line to come now?", [
        choice("nail", "The nail trim.", false, "vaccine"),
        choice("grapes", "The terrier who ate grapes.", true)
      ]),
      retest: q("sort-re", "apply", "Two calls. A same-day ear complaint, and the pet is otherwise fine. A male cat is straining to pee and almost nothing is coming out. Who comes now?", [
        choice("ear", "The ear complaint.", false, "ear"),
        choice("cat", "The cat who is straining to pee.", true)
      ]),
      narrow: {
        vaccine: q("sort-n-vax", "explain-why", "You took the well-pet call first. Another caller is on the emergency line. Which call matches that line?", [
          choice("well", "The well-pet call.", false, "vaccine"),
          choice("emerg", "The call with the emergency signs, not the well pet.", true)
        ]),
        limp: q("sort-n-limp", "explain-why", "You took the limping dog first. He is eating, with no car hit. Another dog is retching with nothing coming up and has a tight belly. Which call is on the emergency line?", [
          choice("limp", "The limp.", false, "limp"),
          choice("bloat", "The tight belly and the empty retch.", true)
        ]),
        upset: q("sort-n-upset", "explain-why", "You let the caller's volume pick the bucket. The limp is a stable same-day case. The other line has bloat signs. Which fact is on the card: the volume, or the signs?", [
          choice("volume", "The volume.", false, "upset"),
          choice("signs", "The signs.", true)
        ]),
        ear: q("sort-n-ear", "explain-why", "You took an ear complaint, pet otherwise fine, ahead of a male cat straining to pee with almost nothing coming out. Which of those is on the emergency line?", [
          choice("ear", "The ear.", false, "ear"),
          choice("cat", "The cat straining to pee.", true)
        ]),
        "default": q("sort-n-default", "predict", "If you can take only one call first, which bucket is the one the card says cannot wait?", [
          choice("later", "Same-day or routine. Those can wait as well as anything else.", false, "vaccine"),
          choice("now", "The emergency bucket.", true)
        ])
      }
    }
  };

  var REVIEWS = {
    toxin: q("rev-toxin", "apply", "A puppy licked rodent bait and is running around the yard. The caller asks for tomorrow. What do you book?", [
      choice("tomorrow", "Tomorrow.", false),
      choice("now", "Emergency. Come now.", true)
    ], "Spaced review"),
    bloat: q("rev-bloat", "predict", "A dog will not settle, is drooling, and keeps trying to vomit. Nothing comes up. The belly is swollen. What are you predicting if you book him after dinner?", [
      choice("fine", "He can wait until after dinner.", false),
      choice("leave", "You are leaving bloat signs in a later slot.", true)
    ], "Spaced review"),
    limp: q("rev-limp", "apply", "A dog is limping this afternoon, ate normally, had no trauma, and the leg is not dangling. What do you book?", [
      choice("now", "Emergency.", false),
      choice("day", "Same-day today.", true),
      choice("month", "Next month.", false)
    ], "Spaced review"),
    routine: q("rev-routine", "apply", "The reminder says bordetella is due. The dog is well. What do you book?", [
      choice("now", "Emergency.", false),
      choice("routine", "The next routine slot.", true)
    ], "Spaced review"),
    sort: q("rev-sort", "apply", "A wellness exam and a dog who ate xylitol gum are both calling. Which one is the emergency?", [
      choice("well", "The wellness exam.", false),
      choice("gum", "The dog who ate xylitol gum.", true)
    ], "Spaced review")
  };

  REVIEWS.toxin.tell = LESSONS.toxin.reveal;
  REVIEWS.bloat.tell = LESSONS.bloat.reveal;
  REVIEWS.limp.tell = LESSONS.limp.reveal;
  REVIEWS.routine.tell = LESSONS.routine.reveal;
  REVIEWS.sort.tell = LESSONS.sort.reveal;

  var FINALS = [
    q("fin-1", "apply", "A caller says, \"Just the vaccine reminder. He's eating fine.\" What do you book?", [
      choice("now", "Emergency.", false),
      choice("day", "A same-day sick visit.", false),
      choice("routine", "The next routine wellness slot.", true)
    ]),
    q("fin-2", "apply", "One call, two problems. The dog is limping, eating normally, no car hit, and the caller then says he also ate a bag of chocolate chips and is still fishing chips off the floor. Which bucket do you use?", [
      choice("day", "Same-day, because of the limp. He is eating.", false),
      choice("routine", "Routine, because he is eating, so nothing is urgent.", false),
      choice("now", "Emergency. The chocolate is a toxin, and eating the chips does not move it.", true)
    ], "Integrative problem")
  ];

  FINALS[0].tell = LESSONS.routine.reveal;
  FINALS[0].narrow = q("fin-1n", "explain-why", "You booked a sick or emergency slot. The dog is well, and the caller named a reminder. Which line lists vaccine reminders?", [
    choice("now", "The emergency line.", false),
    choice("day", "The same-day line.", false),
    choice("routine", "The routine line.", true)
  ]);
  FINALS[0].narrow.tell = LESSONS.routine.reveal;

  FINALS[1].tell = "Both problems are in the call. The limp alone would be same-day. The chocolate is a toxin, and eating it off the floor is looking normal, which does not move a toxin call. The toxin sets the bucket.";
  FINALS[1].narrow = q("fin-2n", "explain-why", "You let the limp, or the eating, set the bucket. The limp alone would be same-day. Chocolate chips are on the toxin line, which includes a pet that looks normal. Which problem sets the bucket when both are in the same call?", [
    choice("limp", "The limp.", false),
    choice("toxin", "The toxin.", true)
  ]);
  FINALS[1].narrow.tell = FINALS[1].tell;

  function repeat(ch, n) {
    var s = "";
    var i;
    for (i = 0; i < n; i++) s += ch;
    return s;
  }

  function blocks(level) {
    var lv = level;
    if (lv < 0) lv = 0;
    if (lv > 5) lv = 5;
    var n = lv * 2;
    return repeat(FULL, n) + repeat(LIGHT, 10 - n);
  }

  function overallBlocks(pct) {
    var n = Math.round(pct / 10);
    if (n < 0) n = 0;
    if (n > 10) n = 10;
    return repeat(FULL, n) + repeat(LIGHT, 10 - n);
  }

  function overallPercent(levels) {
    var sum = 0;
    var i;
    for (i = 0; i < SUBSKILLS.length; i++) sum += levels[SUBSKILLS[i].id];
    return Math.round((100 * sum) / (SUBSKILLS.length * 5));
  }

  function pad(text, n) {
    var s = String(text);
    if (s.length >= n) return s.slice(0, n);
    while (s.length < n) s += " ";
    return s;
  }

  function skillById(id) {
    var i;
    for (i = 0; i < SUBSKILLS.length; i++) {
      if (SUBSKILLS[i].id === id) return SUBSKILLS[i];
    }
    return null;
  }

  function skillName(id) {
    var s = skillById(id);
    return s ? s.name : id;
  }

  function choiceById(question, id) {
    var i;
    if (!question) return null;
    for (i = 0; i < question.choices.length; i++) {
      if (question.choices[i].id === id) return question.choices[i];
    }
    return null;
  }

  function blankLevels() {
    return { sort: 0, toxin: 0, bloat: 0, limp: 0, routine: 0 };
  }

  function initialState() {
    return {
      phase: "intent",
      diagStep: 0,
      diag: {},
      levels: blankLevels(),
      placed: false,
      seenCard: false,
      focus: null,
      stage: "q1",
      miss: null,
      fails: 0,
      narrowFrom: null,
      toldFocus: false,
      toldQuestion: null,
      toldPhase: null,
      toldStage: null,
      earnedFirst: false,
      secondClean: false,
      levelRaised: false,
      retestNarrow: false,
      reviewSkill: null,
      reviewDelta: null,
      raiseDelta: null,
      finalStep: 0,
      finalHits: 0,
      finalClean: true,
      saveText: null,
      progressNote: false,
      pendingTell: null,
      explainReason: null
    };
  }

  function clone(state) {
    return {
      phase: state.phase,
      diagStep: state.diagStep,
      diag: Object.assign({}, state.diag),
      levels: Object.assign({}, state.levels),
      placed: state.placed,
      seenCard: state.seenCard,
      focus: state.focus,
      stage: state.stage,
      miss: state.miss,
      fails: state.fails,
      narrowFrom: state.narrowFrom,
      toldFocus: state.toldFocus,
      toldQuestion: state.toldQuestion,
      toldPhase: state.toldPhase,
      toldStage: state.toldStage,
      earnedFirst: state.earnedFirst,
      secondClean: state.secondClean,
      levelRaised: state.levelRaised,
      retestNarrow: state.retestNarrow,
      reviewSkill: state.reviewSkill,
      reviewDelta: state.reviewDelta ? Object.assign({}, state.reviewDelta) : null,
      raiseDelta: state.raiseDelta ? Object.assign({}, state.raiseDelta) : null,
      finalStep: state.finalStep,
      finalHits: state.finalHits,
      finalClean: state.finalClean,
      saveText: null,
      progressNote: false,
      pendingTell: state.pendingTell,
      explainReason: state.explainReason
    };
  }

  function placeLevels(diag) {
    function bandFor(qid) {
      var question = null;
      var i;
      for (i = 0; i < DIAG.length; i++) {
        if (DIAG[i].id === qid) question = DIAG[i];
      }
      var picked = choiceById(question, diag[qid]);
      var score = picked && picked.score ? picked.score : "miss";
      if (score === "hit") return 2;
      if (score === "near") return 1;
      return 0;
    }
    var hits = 0;
    var i;
    for (i = 0; i < DIAG.length; i++) {
      var picked = choiceById(DIAG[i], diag[DIAG[i].id]);
      if (picked && picked.score === "hit") hits += 1;
    }
    var sort = 0;
    if (hits === 4) sort = 2;
    else if (hits >= 2) sort = 1;
    return {
      sort: sort,
      toxin: bandFor("d-toxin"),
      bloat: bandFor("d-bloat"),
      limp: bandFor("d-limp"),
      routine: bandFor("d-routine")
    };
  }

  function proposeFocus(levels) {
    var best = FOCUS_PRIORITY[0];
    var i;
    for (i = 1; i < FOCUS_PRIORITY.length; i++) {
      var id = FOCUS_PRIORITY[i];
      if (levels[id] < levels[best]) best = id;
    }
    return best;
  }

  function pickReview(levels, focus) {
    var best = null;
    var i;
    for (i = 0; i < SUBSKILLS.length; i++) {
      var id = SUBSKILLS[i].id;
      if (id === focus) continue;
      if (best === null || levels[id] > levels[best]) best = id;
    }
    return best;
  }

  function weakestIds(levels) {
    var min = 5;
    var i;
    for (i = 0; i < SUBSKILLS.length; i++) {
      if (levels[SUBSKILLS[i].id] < min) min = levels[SUBSKILLS[i].id];
    }
    var ids = [];
    for (i = 0; i < SUBSKILLS.length; i++) {
      if (levels[SUBSKILLS[i].id] === min) ids.push(SUBSKILLS[i].id);
    }
    return ids;
  }

  function lessonQuestion(state) {
    var lesson = LESSONS[state.focus];
    if (!lesson) return null;
    if (state.stage === "q1") return lesson.q1;
    if (state.stage === "advocate") return lesson.advocate;
    if (state.stage === "q2") return lesson.q2;
    if (state.stage === "retest" && !state.retestNarrow) return lesson.retest;
    var key = state.miss || "default";
    return lesson.narrow[key] || lesson.narrow["default"];
  }

  function keyedQuestion(state) {
    if (state.phase === "diagnostic") return DIAG[state.diagStep] || null;
    if (state.phase === "teach") return lessonQuestion(state);
    if (state.phase === "review") return REVIEWS[state.reviewSkill] || null;
    if (state.phase === "final") return FINALS[state.finalStep] || null;
    if (state.phase === "final-narrow") {
      var item = FINALS[state.finalStep];
      return item ? item.narrow : null;
    }
    return null;
  }

  function tellText(state) {
    var question = keyedQuestion(state);
    if (question && question.tell) return question.tell;
    if (state.phase === "teach" && state.focus && LESSONS[state.focus]) return LESSONS[state.focus].reveal;
    return "";
  }

  function canTell(state) {
    var question = keyedQuestion(state);
    if (!question) return false;
    if (state.phase === "diagnostic") return false;
    if (state.toldQuestion && state.toldQuestion === question.id) return false;
    return state.phase === "teach" || state.phase === "review" || state.phase === "final" || state.phase === "final-narrow";
  }

  function presentQuestion(question, index, total) {
    if (!question) return null;
    var choices = [];
    var i;
    for (i = 0; i < question.choices.length; i++) {
      choices.push({ id: question.choices[i].id, label: question.choices[i].label });
    }
    return {
      id: question.id,
      type: question.type || "diagnostic",
      typeLabel: TYPE_LABEL[question.type] || "Diagnostic",
      kicker: question.kicker || null,
      prompt: question.prompt,
      choices: choices,
      index: index,
      total: total
    };
  }

  function skillMap(levels, focus, movedId) {
    var pct = overallPercent(levels);
    var rows = [];
    var i;
    for (i = 0; i < SUBSKILLS.length; i++) {
      var s = SUBSKILLS[i];
      var level = levels[s.id];
      var mark = "";
      if (s.id === focus) mark = "<- current focus";
      else if (level === 4) mark = "* independent";
      else if (level === 5) mark = "* can teach";
      rows.push({
        id: s.id,
        name: s.name,
        level: level,
        label: LEVELS[level],
        bar: blocks(level),
        mark: mark,
        moved: s.id === movedId
      });
    }
    var head = pad("Topic: " + TOPIC, 40) + "overall: " + overallBlocks(pct) + " " + pct + "%";
    var rule = repeat("-", 65);
    var body = [head, rule];
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      var mark = r.mark ? "  " + r.mark : "";
      body.push(pad(r.name, 22) + " [" + r.bar + "]  " + r.level + "/5" + mark);
    }
    body.push(rule);
    return {
      topic: TOPIC,
      overallPct: pct,
      overallBar: overallBlocks(pct),
      rows: rows,
      ascii: body.join("\n")
    };
  }

  function movedId(state) {
    if (state.phase === "review-intro" && state.raiseDelta) return state.raiseDelta.id;
    if (state.phase === "review-result" && state.reviewDelta && state.reviewDelta.from !== state.reviewDelta.to) {
      return state.reviewDelta.id;
    }
    return null;
  }

  function protocolMode(state) {
    if (state.phase === "card") return "open";
    if (!state.seenCard) return "hidden";
    if (state.phase === "map" || state.phase === "preface" || state.phase === "diagnostic") return "hidden";
    return "collapsed";
  }

  function linesFor(state) {
    var name;
    var lv;
    var suggested;
    var weak;
    var i;
    if (state.phase === "intent") {
      return [
        "Two ways to start. A one-off question gets a normal answer. The tutoring loop stays off.",
        "Asking to be taught, quizzed, or drilled starts a session. If a request were ambiguous, the skill would ask one question before any quiz: \"" + GUARD_QUESTION + "\""
      ];
    }
    if (state.phase === "oneoff") {
      return [
        "A triage protocol is the clinic's card for sorting a phone call into emergency, same-day, or routine before a slot is booked.",
        CLINIC + " is fictional, and so is the card on this page.",
        "You asked what a triage protocol is, so this is the answer. The diagnostic stays off."
      ];
    }
    if (state.phase === "preface") {
      return [DIAG_INTRO, DIAG_HOLD];
    }
    if (state.phase === "diagnostic") {
      return ["Diagnostic. Question " + (state.diagStep + 1) + " of " + DIAG.length + ". No lesson yet."];
    }
    if (state.phase === "map") {
      suggested = proposeFocus(state.levels);
      return [
        "Placement only. These levels are where the four questions put you. Nothing has been taught yet.",
        "I would start with " + skillName(suggested) + ", at " + state.levels[suggested] + "/5, " + LEVELS[state.levels[suggested]] + ". You can override.",
        "A level on this page moves one step, and only after two checks. One of them has to be unprompted recall. A direct explanation blocks the step."
      ];
    }
    if (state.phase === "card") {
      return [
        "This is the new material: a fictional phone card for " + CLINIC + ". It is not veterinary advice.",
        "Read it, then the questions start. I will ask one at a time and stop."
      ];
    }
    if (state.phase === "explained") {
      var follow = state.toldPhase === "teach"
        ? "The next check is the same idea from another angle. It does not count as unprompted recall, so the level does not move from it."
        : "That override covers only the question you were on.";
      if (state.explainReason === "tell") {
        return [
          "You asked to be told, for this question only.",
          state.pendingTell || "",
          follow
        ];
      }
      return [
        "Not quite. Two attempts missed, so here is the point directly.",
        state.pendingTell || "",
        follow
      ];
    }
    if (state.phase === "teach") {
      name = skillName(state.focus);
      if (state.stage === "q1") return ["First check. " + name + "."];
      if (state.stage === "advocate") return ["That matches the card."];
      if (state.stage === "q2") return ["Second check. This is a new case, not a repeat of an answer you were just given."];
      if (state.stage === "retest" && !state.retestNarrow) {
        return ["Same idea, other angle. This check does not move the level."];
      }
      return ["Not quite."];
    }
    if (state.phase === "review-intro") {
      name = skillName(state.focus);
      lv = state.levels[state.focus];
      if (state.raiseDelta) {
        return [
          name + " moved from " + state.raiseDelta.from + "/5 to " + state.raiseDelta.to + "/5.",
          "Two checks were met, and the second was a new case you had not just been told. The level moves one step.",
          "Next is a spaced review of " + skillName(state.reviewSkill) + "."
        ];
      }
      if (state.toldFocus) {
        return [
          name + " stays at " + lv + "/5.",
          "A direct explanation was used, so the later check is not unprompted recall. The level stays.",
          "Next is a spaced review of " + skillName(state.reviewSkill) + "."
        ];
      }
      return [
        name + " stays at " + lv + "/5.",
        "A level needs two independent checks, and the second one has to land without a narrower rescue. This run did not earn the step.",
        "Next is a spaced review of " + skillName(state.reviewSkill) + "."
      ];
    }
    if (state.phase === "review") {
      return [
        "Spaced review of " + skillName(state.reviewSkill) + ".",
        "In the skill this re-test arrives without warning, and a miss lowers the level. This page labels the card so the move is visible."
      ];
    }
    if (state.phase === "review-result") {
      var d = state.reviewDelta;
      name = skillName(d.id);
      if (!d.passed && d.from !== d.to) {
        return [
          name + " drops from " + d.from + "/5 to " + d.to + "/5.",
          "A missed review lowers the level. The skill would revisit that subskill."
        ];
      }
      if (!d.passed) {
        return [
          name + " stays at " + d.to + "/5.",
          "A missed review lowers the level. It is already at 0, so the bar stays empty."
        ];
      }
      return [
        name + " stays at " + d.to + "/5.",
        "One review pass does not raise a level. The skill wants two independent checks before a step up."
      ];
    }
    if (state.phase === "final-intro") {
      return [
        "The skill ends a course only when every subskill is at the target, default 4 out of 5, or 5 out of 5 if you asked for full mastery.",
        "Then it runs a mixed assessment: at least one question per subskill, and one integrative problem. A miss goes back to the teaching loop.",
        "This page is a short sample of that ending. One question, then one call that mixes two problems. Then it stops."
      ];
    }
    if (state.phase === "final") {
      if (state.finalStep === 0) return ["Final assessment. Question 1 of 2."];
      return ["Final assessment. Question 2 of 2. This one is the integrative problem: two issues in a single call."];
    }
    if (state.phase === "final-narrow") {
      return ["Not quite."];
    }
    if (state.phase === "done") {
      weak = weakestIds(state.levels);
      var bits = [];
      for (i = 0; i < weak.length; i++) {
        bits.push(skillName(weak[i]) + " (" + state.levels[weak[i]] + "/5)");
      }
      var head = state.finalHits === FINALS.length && state.finalClean
        ? "Both questions in this short sample were right on the first try."
        : "This short sample was not a clean pass. The skill would go back to the teaching loop. This page stops.";
      return [
        head,
        "Weakest on this map: " + bits.join(", ") + ".",
        "The tutor is scripted. " + CLINIC + " is fictional. The skill would keep going until every subskill is at the target, then run a full mixed assessment."
      ];
    }
    return [];
  }

  function continueLabel(state) {
    if (state.phase === "preface") return "Start the diagnostic";
    if (state.phase === "card") return "Ask the first question";
    if (state.phase === "explained") {
      if (state.toldPhase === "review") return "Continue";
      if (state.toldPhase === "final" || state.toldPhase === "final-narrow") return "Continue";
      if (state.toldStage === "retest" || state.retestNarrow) return "Continue";
      return "Ask the other angle";
    }
    if (state.phase === "review-intro") return "Go to spaced review";
    if (state.phase === "review-result") return "Go to the final assessment";
    if (state.phase === "final-intro") return "Start the final assessment";
    return "Continue";
  }

  function actionsFor(state) {
    var list = [];
    if (state.phase === "intent") {
      list.push({ type: "intent", id: "explain", label: INTENT.explain });
      list.push({ type: "intent", id: "teach", label: INTENT.teach });
    } else if (state.phase === "oneoff") {
      list.push({ type: "intent", id: "teach", label: INTENT.teach });
    } else if (state.phase === "map") {
      var suggested = proposeFocus(state.levels);
      var i;
      for (i = 0; i < SUBSKILLS.length; i++) {
        var s = SUBSKILLS[i];
        var prefix = s.id === suggested ? "Start here: " : "Override: ";
        list.push({
          type: "focus",
          id: s.id,
          label: prefix + s.name + ", " + state.levels[s.id] + "/5 " + LEVELS[state.levels[s.id]],
          suggested: s.id === suggested
        });
      }
    } else if (state.phase === "preface" || state.phase === "card" || state.phase === "explained" || state.phase === "review-intro" || state.phase === "review-result" || state.phase === "final-intro") {
      list.push({ type: "continue", id: "continue", label: continueLabel(state) });
    } else if (state.phase === "done") {
      list.push({ type: "restart", id: "restart", label: "Start over" });
    }
    return list;
  }

  function questionExtra(state) {
    if (state.phase === "diagnostic") return { index: state.diagStep + 1, total: DIAG.length };
    if (state.phase === "final" || state.phase === "final-narrow") return { index: state.finalStep + 1, total: FINALS.length };
    return { index: null, total: null };
  }

  function view(state) {
    var extra = questionExtra(state);
    var question = presentQuestion(keyedQuestion(state), extra.index, extra.total);
    var showMap = state.placed && state.phase !== "diagnostic";
    return {
      phase: state.phase,
      lines: linesFor(state),
      question: question,
      protocol: protocolMode(state),
      map: showMap ? skillMap(state.levels, state.focus, movedId(state)) : null,
      actions: actionsFor(state),
      utilities: {
        progress: state.placed,
        tell: canTell(state),
        save: state.placed
      },
      saveText: state.saveText,
      progressNote: state.progressNote,
      focus: state.focus,
      stage: state.stage
    };
  }

  function finishLesson(state) {
    state.phase = "review-intro";
    state.reviewSkill = pickReview(state.levels, state.focus);
    state.stage = "q1";
    state.miss = null;
    state.fails = 0;
    state.retestNarrow = false;
    return state;
  }

  function afterSecondCheck(state) {
    if (state.earnedFirst && state.secondClean && !state.toldFocus && !state.levelRaised) {
      var from = state.levels[state.focus];
      if (from < 5) {
        state.levels[state.focus] = from + 1;
        state.raiseDelta = { id: state.focus, from: from, to: from + 1 };
        state.levelRaised = true;
      } else {
        state.raiseDelta = null;
      }
    } else {
      state.raiseDelta = null;
    }
    return finishLesson(state);
  }

  function beginRetest(state) {
    state.phase = "teach";
    state.stage = "retest";
    state.fails = 0;
    state.miss = null;
    state.retestNarrow = false;
    state.narrowFrom = null;
    return state;
  }

  function toFinalIntro(state) {
    state.phase = "final-intro";
    return state;
  }

  function toDone(state) {
    state.phase = "done";
    return state;
  }

  function advanceFinal(state) {
    if (state.finalStep >= FINALS.length - 1) return toDone(state);
    state.phase = "final";
    state.finalStep += 1;
    return state;
  }

  function onIntent(state, id) {
    if (state.phase !== "intent" && state.phase !== "oneoff") return state;
    if (id === "explain") {
      var explained = clone(state);
      explained.phase = "oneoff";
      return explained;
    }
    if (id === "teach") {
      var next = initialState();
      next.phase = "preface";
      return next;
    }
    return state;
  }

  function onFocus(state, id) {
    if (state.phase !== "map") return state;
    if (!skillById(id)) return state;
    var next = clone(state);
    next.focus = id;
    next.phase = "card";
    next.seenCard = true;
    next.stage = "q1";
    next.fails = 0;
    next.miss = null;
    next.earnedFirst = false;
    next.secondClean = false;
    next.toldFocus = false;
    next.levelRaised = false;
    next.raiseDelta = null;
    return next;
  }

  function onContinue(state) {
    var next = clone(state);
    if (state.phase === "preface") {
      next.phase = "diagnostic";
      next.diagStep = 0;
      return next;
    }
    if (state.phase === "card") {
      next.phase = "teach";
      next.stage = "q1";
      return next;
    }
    if (state.phase === "explained") {
      if (state.toldPhase === "review") return toFinalIntro(next);
      if (state.toldPhase === "final" || state.toldPhase === "final-narrow") return advanceFinal(next);
      if (state.toldStage === "retest" || state.retestNarrow) return finishLesson(next);
      return beginRetest(next);
    }
    if (state.phase === "review-intro") {
      next.phase = "review";
      return next;
    }
    if (state.phase === "review-result") return toFinalIntro(next);
    if (state.phase === "final-intro") {
      next.phase = "final";
      next.finalStep = 0;
      return next;
    }
    return state;
  }

  function explainNow(state, text) {
    var next = clone(state);
    next.phase = "explained";
    next.pendingTell = text;
    next.explainReason = "tell";
    next.toldQuestion = (keyedQuestion(state) || {}).id || null;
    next.toldPhase = state.phase;
    next.toldStage = state.stage;
    if (state.phase === "teach") next.toldFocus = true;
    if (state.phase === "final" || state.phase === "final-narrow") next.finalClean = false;
    return next;
  }

  function onTell(state) {
    if (!canTell(state)) return state;
    return explainNow(state, tellText(state));
  }

  function onDiagnosticAnswer(state, id) {
    var question = DIAG[state.diagStep];
    if (!choiceById(question, id)) return state;
    var next = clone(state);
    next.diag[question.id] = id;
    next.diagStep += 1;
    if (next.diagStep >= DIAG.length) {
      next.levels = placeLevels(next.diag);
      next.placed = true;
      next.phase = "map";
    }
    return next;
  }

  function onTeachAnswer(state, id) {
    var question = lessonQuestion(state);
    var picked = choiceById(question, id);
    if (!picked) return state;
    if (state.retestNarrow && state.stage === "narrow") {
      return finishLesson(clone(state));
    }
    var next = clone(state);
    if (state.stage === "retest") {
      if (picked.ok) return finishLesson(next);
      next.stage = "narrow";
      next.retestNarrow = true;
      next.miss = picked.miss || "default";
      next.fails = 1;
      next.narrowFrom = "retest";
      return next;
    }
    if (!picked.ok) {
      next.fails += 1;
      next.miss = picked.miss || "default";
      if (next.stage === "q1" || next.stage === "advocate") {
        next.narrowFrom = "q1";
        if (next.stage === "advocate") next.earnedFirst = false;
      } else if (next.stage === "q2") {
        next.narrowFrom = "q2";
      }
      if (next.fails >= 2) {
        next.toldFocus = true;
        next.phase = "explained";
        next.pendingTell = LESSONS[state.focus].reveal;
        next.explainReason = "miss";
        next.toldPhase = "teach";
        next.toldStage = state.stage;
        next.earnedFirst = false;
        return next;
      }
      next.stage = "narrow";
      return next;
    }
    if (next.stage === "q1") {
      next.earnedFirst = true;
      next.fails = 0;
      next.miss = null;
      next.stage = "advocate";
      return next;
    }
    if (next.stage === "advocate") {
      next.fails = 0;
      next.miss = null;
      next.stage = "q2";
      return next;
    }
    if (next.stage === "narrow" && next.narrowFrom === "q2") {
      next.secondClean = false;
      return afterSecondCheck(next);
    }
    if (next.stage === "narrow") {
      next.earnedFirst = true;
      next.fails = 0;
      next.miss = null;
      next.stage = "q2";
      return next;
    }
    if (next.stage === "q2") {
      next.secondClean = true;
      return afterSecondCheck(next);
    }
    return next;
  }

  function onReviewAnswer(state, id) {
    var question = REVIEWS[state.reviewSkill];
    var picked = choiceById(question, id);
    if (!picked) return state;
    var next = clone(state);
    var from = next.levels[next.reviewSkill];
    if (!picked.ok) {
      var to = from > 0 ? from - 1 : 0;
      next.levels[next.reviewSkill] = to;
      next.reviewDelta = { id: next.reviewSkill, from: from, to: to, passed: false };
    } else {
      next.reviewDelta = { id: next.reviewSkill, from: from, to: from, passed: true };
    }
    next.phase = "review-result";
    return next;
  }

  function onFinalAnswer(state, id) {
    var question = keyedQuestion(state);
    var picked = choiceById(question, id);
    if (!picked) return state;
    var next = clone(state);
    if (state.phase === "final-narrow") return advanceFinal(next);
    if (!picked.ok) {
      next.finalClean = false;
      next.phase = "final-narrow";
      return next;
    }
    next.finalHits += 1;
    return advanceFinal(next);
  }

  function onAnswer(state, id) {
    if (state.phase === "diagnostic") return onDiagnosticAnswer(state, id);
    if (state.phase === "teach") return onTeachAnswer(state, id);
    if (state.phase === "review") return onReviewAnswer(state, id);
    if (state.phase === "final" || state.phase === "final-narrow") return onFinalAnswer(state, id);
    return state;
  }

  function onProgress(state) {
    if (!state.placed) return state;
    var next = clone(state);
    next.progressNote = true;
    next.saveText = state.saveText;
    next.pendingTell = state.pendingTell;
    return next;
  }

  function formatSave(state) {
    var bits = [];
    var i;
    for (i = 0; i < SUBSKILLS.length; i++) {
      var id = SUBSKILLS[i].id;
      bits.push(id + " " + state.levels[id]);
    }
    var notes = [];
    notes.push(state.seenCard ? "card shown" : "card not shown");
    if (state.focus) notes.push("focus " + state.focus);
    notes.push(state.toldFocus ? "direct explanation used on the focus" : "no direct explanation on the focus");
    if (state.reviewDelta) notes.push("review " + state.reviewDelta.id + (state.reviewDelta.passed ? " held" : " missed"));
    return [
      "topic: " + TOPIC + " at " + CLINIC + " (fictional)",
      "levels: " + bits.join(", "),
      "notes: " + notes.join("; ")
    ].join("\n");
  }

  function onSave(state) {
    if (!state.placed) return state;
    var next = clone(state);
    next.saveText = formatSave(state);
    next.progressNote = false;
    next.pendingTell = state.pendingTell;
    return next;
  }

  function reduce(state, action) {
    var type = action && action.type;
    var id = action && action.id;
    if (type === "restart") return initialState();
    if (type === "intent") return onIntent(state, id);
    if (type === "continue") return onContinue(state);
    if (type === "focus") return onFocus(state, id);
    if (type === "answer") return onAnswer(state, id);
    if (type === "progress") return onProgress(state);
    if (type === "tell") return onTell(state);
    if (type === "save") return onSave(state);
    return state;
  }

  globalThis.SocraticTutorLab = {
    CLINIC: CLINIC,
    TOPIC: TOPIC,
    POST: POST,
    INTENT: INTENT,
    GUARD_QUESTION: GUARD_QUESTION,
    DIAG_INTRO: DIAG_INTRO,
    DIAG_HOLD: DIAG_HOLD,
    USE: USE,
    LEVELS: LEVELS,
    TYPE_LABEL: TYPE_LABEL,
    SUBSKILLS: SUBSKILLS,
    PROTOCOL: PROTOCOL,
    COMPARE: COMPARE,
    DIAG: DIAG,
    LESSONS: LESSONS,
    REVIEWS: REVIEWS,
    FINALS: FINALS,
    FULL: FULL,
    LIGHT: LIGHT,
    initialState: initialState,
    reduce: reduce,
    view: view,
    placeLevels: placeLevels,
    proposeFocus: proposeFocus,
    pickReview: pickReview,
    weakestIds: weakestIds,
    blocks: blocks,
    overallBlocks: overallBlocks,
    overallPercent: overallPercent,
    skillMap: skillMap,
    keyedQuestion: keyedQuestion,
    canTell: canTell,
    FOOTER: "Scripted tutor. Brightside Veterinary Clinic is fictional. Not veterinary advice."
  };
})();
