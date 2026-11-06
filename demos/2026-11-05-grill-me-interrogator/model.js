"use strict";

/**
 * Scripted grill for a fictional shop. Question order is rules on the
 * idea's words and on answers already given. No network and no model.
 */
(function () {
  const IDEA_MAX = 200;
  const NOTE_MAX = 140;
  const EXAMPLE_TUNEUPS = 40;

  const PRESETS = [
    {
      id: "quote",
      label: "AI quoting bot for HVAC",
      text: "Build an AI quoting bot for HVAC jobs.",
      track: "quote",
    },
    {
      id: "reviews",
      label: "Agent that texts customers for reviews",
      text: "An agent that texts customers and asks them for a review.",
      track: "reviews",
    },
    {
      id: "book",
      label: "Chatbot on the website that books tune-ups",
      text: "A chatbot on the website that books tune-ups.",
      track: "book",
    },
    {
      id: "ads",
      label: "Bot that writes our Facebook ads",
      text: "A bot that writes our Facebook ads.",
      track: "ads",
    },
  ];

  const DEPTHS = {
    shallow: {
      id: "shallow",
      label: "Shallow",
      blurb: "Three soft questions. You hear the idea. You do not pin a build.",
      themes: ["customer", "success", "constraint"],
    },
    deep: {
      id: "deep",
      label: "Deep",
      blurb: "Six to eight sharp questions. Customer, constraint, success, failure, data, and the handoff. A risky answer can add a slice question, a conflict question, or both.",
      themes: ["customer", "constraint", "success", "failure", "data", "handoff"],
    },
  };

  const THEME_LABELS = {
    customer: "Customer",
    constraint: "Constraint",
    success: "Success",
    failure: "Failure",
    data: "Data",
    handoff: "Handoff",
    slice: "First slice",
    contradiction: "Conflict",
  };

  const TRACKS = {
    quote: { id: "quote", label: "quoting", noun: "a quoting bot" },
    reviews: { id: "reviews", label: "review texts", noun: "a review-texting agent" },
    book: { id: "book", label: "tune-up booking", noun: "a booking chatbot" },
    ads: { id: "ads", label: "Facebook ads", noun: "an ads bot" },
    custom: { id: "custom", label: "a general shop task", noun: "a general shop bot" },
  };

  const TRACK_PATTERNS = {
    quote: [/quot/i, /pric/i, /estimat/i, /\bbids?\b/i, /\bhvac\b/i],
    reviews: [/reviews?/i, /ratings?/i, /testimonials?/i, /\bsms\b/i, /texts? customers/i],
    book: [/\bbook(?:s|ing)?\b/i, /schedul/i, /tune-?ups?/i, /appointments?/i, /chatbots?/i, /calendars?/i],
    ads: [/facebook/i, /instagram/i, /\bads?\b/i, /campaigns?/i],
  };

  const TRACK_ORDER = ["quote", "reviews", "book", "ads"];

  function choice(id, label, sentence, extra) {
    return Object.assign({ id, label, sentence, tags: [] }, extra || {});
  }

  function question(id, tracks, depths, theme, prompt, help, choices) {
    return {
      id,
      tracks: typeof tracks === "string" ? [tracks] : tracks.slice(),
      depths: typeof depths === "string" ? [depths] : depths.slice(),
      theme,
      prompt,
      help,
      choices,
    };
  }

  const PAIRS = [
    {
      id: "live-price",
      wide: "wants-live-price",
      tight: "no-live-price",
      wideSay: "a customer should be able to accept a price from the bot",
      tightSay: "the bot may not state a price that is not already in the price book",
    },
    {
      id: "price-without-data",
      wide: "wants-live-price",
      tight: "no-data",
      wideSay: "the bot should name a price the customer can accept",
      tightSay: "there is nothing reliable for the bot to read",
    },
    {
      id: "needs-records",
      wide: "needs-data",
      tight: "no-data",
      wideSay: "the success check needs real records",
      tightSay: "the shop has nothing reliable for a bot to read",
    },
    {
      id: "notes-are-not-prices",
      wide: "wants-live-price",
      tight: "notes-only",
      wideSay: "the bot should name a price",
      tightSay: "it can read only call notes, which do not contain the price book",
    },
    {
      id: "person-sends",
      wide: "customer-facing",
      tight: "no-auto-send",
      wideSay: "the customer gets the result with no person in between",
      tightSay: "a person has to send it or confirm it",
    },
    {
      id: "unowned-send",
      wide: "no-handoff",
      tight: "no-auto-send",
      wideSay: "nobody reviews the result before it goes out",
      tightSay: "a person has to send it",
    },
    {
      id: "blast-consent",
      wide: "blast",
      tight: "consent-first",
      wideSay: "texts should go out broadly",
      tightSay: "only people who were told the shop might write",
    },
    {
      id: "blast-manual",
      wide: "blast",
      tight: "no-auto-send",
      wideSay: "texts should go out broadly and on their own",
      tightSay: "a person has to send each one",
    },
    {
      id: "phones-missing",
      wide: "needs-phones",
      tight: "no-data",
      wideSay: "the shop can work from a list of people to text",
      tightSay: "there is no reliable list",
    },
    {
      id: "phones-wrong-source",
      wide: "needs-phones",
      tight: "no-phones",
      wideSay: "the shop needs phone numbers for finished jobs",
      tightSay: "the source named does not have those numbers",
    },
    {
      id: "calendar-paper",
      wide: "writes-calendar",
      tight: "paper-only",
      wideSay: "the bot writes a confirmed time",
      tightSay: "the schedule is a paper board the bot cannot see",
    },
    {
      id: "calendar-banned",
      wide: "writes-calendar",
      tight: "no-calendar-write",
      wideSay: "the bot writes a confirmed time",
      tightSay: "the first version may not write on the schedule",
    },
    {
      id: "calendar-no-slots",
      wide: "writes-calendar",
      tight: "no-slots",
      wideSay: "the bot confirms a time",
      tightSay: "the source it can read has no open slots",
    },
    {
      id: "slots-paper",
      wide: "needs-slots",
      tight: "paper-only",
      wideSay: "the bot and the dispatcher look at the same open slots",
      tightSay: "those slots live on a paper board",
    },
    {
      id: "slots-missing",
      wide: "needs-slots",
      tight: "no-slots",
      wideSay: "the bot needs open slots",
      tightSay: "the source it can read does not have them",
    },
    {
      id: "emergency-barred",
      wide: "emergency-auto",
      tight: "tuneup-only",
      wideSay: "no-heat calls get a slot without the dispatcher",
      tightSay: "the first version is tune-ups only",
    },
    {
      id: "emergency-customer",
      wide: "emergency",
      tight: "tuneup-only",
      wideSay: "no-heat callers are in the first version",
      tightSay: "the first version is tune-ups only",
    },
    {
      id: "self-serve-confirm",
      wide: "customer-facing",
      tight: "human-confirm",
      wideSay: "the customer leaves with a time and no phone call",
      tightSay: "a person confirms every request by phone",
    },
    {
      id: "auto-publish",
      wide: "auto-publish",
      tight: "no-auto-publish",
      wideSay: "ads go out without a weekly review",
      tightSay: "the bot may not publish or spend",
    },
    {
      id: "offer-missing",
      wide: "needs-offer",
      tight: "no-data",
      wideSay: "the bot writes from a real offer",
      tightSay: "there is no written offer to read",
    },
    {
      id: "watch-it",
      wide: "no-handoff",
      tight: "human-check",
      wideSay: "the task runs with nobody watching",
      tightSay: "a person checks it before a customer sees it",
    },
  ];

  const QUESTIONS = [
    question(
      "quote-soft-customer",
      "quote",
      "shallow",
      "customer",
      "Who would actually use an HVAC quoting bot at Oakley Heating & Cooling first?",
      "Name one person. Everyone else can wait.",
      [
        choice("dispatcher", "The dispatcher, after a phone call", "The first user is the dispatcher, who starts a quote after a phone call."),
        choice("owner", "The owner, after the shop is closed", "The first user is the owner, working after the shop is closed."),
        choice("homeowner", "A homeowner on the website", "The first user is a homeowner who shows up on the website.", { tags: ["customer-facing"] }),
        choice("anyone", "Whoever asks for a price", "The first user is whoever asks for a price.", { tags: ["broad-customer"], risk: "broad" }),
      ]
    ),
    question(
      "quote-soft-success",
      "quote",
      "shallow",
      "success",
      "What would make the first month feel worth it?",
      "A feeling is enough for the short grill. A count can wait.",
      [
        choice("drafts", "The owner can send a draft the same day, instead of the next morning", "A good first month, as an example, means the owner can send a draft the same day instead of the next morning.", { tags: ["modest"] }),
        choice("calls", "Fewer “just send me a price” calls", "A good first month means fewer “just send me a price” calls. There is no example baseline for that yet.", { tags: ["vague-metric"] }),
        choice("accept", "The site names a price the customer can accept", "A good first month means the site names a price the customer can accept.", { tags: ["wants-live-price", "needs-data", "customer-facing"], risk: "auto" }),
      ]
    ),
    question(
      "quote-soft-constraint",
      "quote",
      "shallow",
      "constraint",
      "What would you rather this bot never do on a first try?",
      "One limit is enough. It can be small.",
      [
        choice("book", "Never invent a price that is not in the price book", "The first version may not invent a price that is not in the price book.", { tags: ["no-live-price"] }),
        choice("date", "Never promise an install date", "The first version may not promise an install date."),
        choice("send", "Never send anything to a customer by itself", "The first version may draft, and it may not send anything to a customer by itself.", { tags: ["no-auto-send"] }),
        choice("none", "Nothing is off limits if it saves time", "Nothing was ruled out. If it saves time, it is allowed.", { tags: ["no-limits"], risk: "auto" }),
      ]
    ),

    question(
      "reviews-soft-customer",
      "reviews",
      "shallow",
      "customer",
      "Who is the review text really for?",
      "The customer receives it. Someone at the shop has to own it.",
      [
        choice("owner", "The owner, who is tired of asking in person", "The first user is the owner, who is tired of asking for reviews in person."),
        choice("happy", "A customer the day after a finished job", "The first audience is a customer the day after a finished job."),
        choice("everyone", "Every number in the spreadsheet", "The first audience is every number in the spreadsheet.", { tags: ["broad-customer", "blast"], risk: "broad" }),
      ]
    ),
    question(
      "reviews-soft-success",
      "reviews",
      "shallow",
      "success",
      "What would a good month of asking look like?",
      "Example hopes are fine. Say so if the number is made up.",
      [
        choice("friday", "The owner has a short Friday list and sends it themselves", "A good month means the owner has a short Friday list and sends the texts themselves.", { tags: ["needs-phones", "modest"] }),
        choice("eight", "About 8 new reviews. That count is an example.", "A good month means about 8 new reviews. That count is an example, not a measured baseline.", { tags: ["needs-phones", "modest"] }),
        choice("auto", "Every finished job gets a text the same night, with no list", "A good month means every finished job gets a text the same night, with no list for a person to review.", { tags: ["blast", "needs-phones", "customer-facing"], risk: "auto" }),
      ]
    ),
    question(
      "reviews-soft-constraint",
      "reviews",
      "shallow",
      "constraint",
      "What should a review text never do?",
      "Pick the limit that would embarrass the shop if it failed.",
      [
        choice("consent", "Never text someone who was not told the shop might write", "The first version may text only people who were told the shop might write.", { tags: ["consent-first"] }),
        choice("reward", "Never offer a discount for a review", "The first version may not offer a discount in exchange for a review."),
        choice("send", "The bot may draft the text. A person sends it.", "The bot may draft the text, and a person sends it.", { tags: ["no-auto-send"] }),
        choice("none", "Text everyone. Sorting it out later is fine.", "Nothing was ruled out. Texting everyone, and sorting it out later, was allowed.", { tags: ["no-limits", "blast"], risk: "auto" }),
      ]
    ),

    question(
      "book-soft-customer",
      "book",
      "shallow",
      "customer",
      "Who is the booking chatbot for, on a normal week?",
      "A normal week is not a no-heat night. You can say so if it is.",
      [
        choice("tuneup", "A homeowner who wants a tune-up", "The first user is a homeowner who wants a tune-up."),
        choice("landlord", "A landlord booking the same visit for a few buildings", "The first user is a landlord booking the same kind of visit for a few buildings."),
        choice("emergency", "Someone with no heat tonight", "The first user is someone with no heat tonight.", { tags: ["emergency"], risk: "broad" }),
        choice("anyone", "Anyone on the website", "The first user is anyone on the website.", { tags: ["broad-customer"], risk: "broad" }),
      ]
    ),
    question(
      "book-soft-success",
      "book",
      "shallow",
      "success",
      "What would “it works” mean by the end of a month?",
      "Keep it to something the dispatcher would notice.",
      [
        choice("callback", "The dispatcher confirms the same day. That timing is an example aim.", "A good month means the dispatcher confirms requests the same day. That timing is an example aim, not a measured rate.", { tags: ["modest"] }),
        choice("notes", "Fewer missed sticky notes on the board", "A good month means fewer missed sticky notes on the board.", { tags: ["vague-metric"] }),
        choice("self", "The customer leaves with a confirmed time and no phone call", "A good month means the customer leaves with a confirmed time and no phone call.", { tags: ["writes-calendar", "customer-facing"], risk: "auto" }),
      ]
    ),
    question(
      "book-soft-constraint",
      "book",
      "shallow",
      "constraint",
      "What should the chatbot not be allowed to do yet?",
      "One fence is enough for the short grill.",
      [
        choice("tuneups", "Tune-ups only. No installs, and no no-heat emergencies.", "The first version is tune-ups only. It does not book installs or no-heat emergencies.", { tags: ["tuneup-only"] }),
        choice("board", "It may not write on the schedule board", "The first version may not write on the schedule board.", { tags: ["no-calendar-write"] }),
        choice("phone", "Every request is confirmed by a person on the phone", "A person confirms every request by phone.", { tags: ["human-confirm"] }),
        choice("open", "If the calendar looks free, it can book it", "If the calendar looks free, the bot may book it.", { tags: ["writes-calendar", "no-limits"], risk: "auto" }),
      ]
    ),

    question(
      "ads-soft-customer",
      "ads",
      "shallow",
      "customer",
      "Who should a Facebook ad from this shop talk to?",
      "A neighborhood is a better answer than a platform.",
      [
        choice("local", "A homeowner in Oakley or Northside who wants a tune-up", "The ad talks to a homeowner in Oakley or Northside who wants a tune-up."),
        choice("replace", "Someone comparing a replacement", "The ad talks to someone who is comparing a replacement."),
        choice("past", "People who already used the shop", "The ad talks to people who already used the shop."),
        choice("city", "Everyone in Cincinnati", "The ad talks to everyone in Cincinnati.", { tags: ["broad-customer"], risk: "broad" }),
      ]
    ),
    question(
      "ads-soft-success",
      "ads",
      "shallow",
      "success",
      "What would a useful first month of ads look like?",
      "Drafts count. Spend does not have to.",
      [
        choice("three", "Three drafts a week the owner is willing to paste. That pace is an example.", "A good month means three drafts a week the owner is willing to paste. That pace is an example.", { tags: ["needs-offer", "modest"] }),
        choice("calls", "The phone rings from people in the area the shop actually drives", "A good month means the phone rings from people in the area the shop actually drives. This page has no baseline for that.", { tags: ["vague-metric"] }),
        choice("auto", "Ads go live without a weekly review", "A good month means ads go live without a weekly review.", { tags: ["auto-publish", "needs-offer", "customer-facing"], risk: "auto" }),
      ]
    ),
    question(
      "ads-soft-constraint",
      "ads",
      "shallow",
      "constraint",
      "What should the ad bot never claim or do?",
      "The owner has to be able to say the sentence out loud.",
      [
        choice("offer", "Only this month’s real offer. No invented discount.", "The bot may use only this month’s real offer. It may not invent a discount.", { tags: ["no-invented-offer"] }),
        choice("voice", "The owner has to recognize the voice", "The owner has to recognize the voice as the shop’s."),
        choice("spend", "It may not publish or spend", "The bot may not publish an ad or spend money.", { tags: ["no-auto-publish"] }),
        choice("clicks", "It can claim whatever will get clicks", "Nothing was ruled out. Claims that might get clicks were allowed.", { tags: ["no-limits", "invented-ok"], risk: "auto" }),
      ]
    ),

    question(
      "custom-soft-customer",
      "custom",
      "shallow",
      "customer",
      (state) => "Who is “" + ideaOf(state) + "” for, if you had to name one person at Oakley Heating & Cooling?",
      "One person. The second person is a later version.",
      [
        choice("owner", "The owner", "The first user is the owner."),
        choice("dispatcher", "The dispatcher", "The first user is the dispatcher."),
        choice("tech", "A tech in the field", "The first user is a tech in the field."),
        choice("anyone", "Anyone who calls or visits the site", "The first user is anyone who calls or visits the site.", { tags: ["broad-customer"], risk: "broad" }),
      ]
    ),
    question(
      "custom-soft-success",
      "custom",
      "shallow",
      "success",
      "What would make you glad you tried this for a month?",
      "A week of real use is a stronger answer than a hope about revenue.",
      [
        choice("week", "The owner uses it on real jobs for one week and still likes it. That trial is an example.", "A good month means the owner uses it on real jobs for one week and still likes it. That trial is an example, not a metric from a real shop.", { tags: ["modest"] }),
        choice("same-day", "A chore that currently waits until evening gets done the same day", "A good month means a chore that currently waits until evening gets done the same day."),
        choice("money", "The shop makes more money", "A good month means the shop makes more money. That is not countable from anything named here.", { tags: ["vague-metric"] }),
        choice("auto", "It runs the whole task with nobody watching", "A good month means the whole task runs with nobody watching.", { tags: ["customer-facing", "no-handoff", "needs-data"], risk: "auto" }),
      ]
    ),
    question(
      "custom-soft-constraint",
      "custom",
      "shallow",
      "constraint",
      "What should the first try refuse to do?",
      "A limit is a gift to the person who would have to maintain this.",
      [
        choice("check", "A person checks it before a customer sees it", "A person checks the result before a customer sees it.", { tags: ["human-check"] }),
        choice("vendor", "No new vendor and no new login in week one", "Week one adds no new vendor and no new login."),
        choice("send", "It cannot spend money or send messages by itself", "It cannot spend money or send messages by itself.", { tags: ["no-auto-send"] }),
        choice("none", "No special limits. Build the sentence as it was said.", "Nothing was ruled out. The sentence would be built as it was said.", { tags: ["no-limits"], risk: "auto" }),
      ]
    ),

    question(
      "quote-customer",
      "quote",
      "deep",
      "customer",
      "Who is standing there when a quote is needed on a Tuesday morning?",
      "Pick the person the first version actually serves. A second persona is a second project.",
      [
        choice("dispatcher", "The dispatcher, turning a phone note into a quote", "The first user is the dispatcher, who turns a phone note into a quote the owner can send."),
        choice("tech", "The tech on site, who does not want to type", "The first user is the tech on site, who wants a quote started without a long write-up."),
        choice("phone", "The homeowner on the phone, who wants a number before they hang up", "The first user is the homeowner on the phone, who wants a number before they hang up.", { tags: ["customer-facing"] }),
        choice("anyone", "Anyone who lands on the website", "The first user is anyone who lands on the website.", { tags: ["broad-customer"], risk: "broad" }),
      ]
    ),
    question(
      "quote-constraint",
      "quote",
      "deep",
      "constraint",
      "What is off limits in the first version, even if a fuller bot would look more impressive?",
      "Impressive is how a quoting bot grows a parts API and a payment button.",
      [
        choice("book", "No price that is not already in the price book", "The first version may not state a price that is not already in the price book.", { tags: ["no-live-price"] }),
        choice("date", "It may not put a date on the board", "The first version may not put an install date on the board."),
        choice("none", "If it can quote, it should quote. No special limits.", "Nothing was ruled out. If the bot can quote, it is allowed to quote.", { tags: ["no-limits"], risk: "auto" }),
        choice("send", "It may draft, and it may not send", "The first version may draft a quote, and it may not send it.", { tags: ["no-auto-send"] }),
      ]
    ),
    question(
      "quote-success",
      "quote",
      "deep",
      "success",
      "How will you know the first month worked? Pick one check you could actually count.",
      "The 8-of-10 figure below is an example. It is not this shop’s history, because this shop is fictional.",
      [
        choice("approve", "The owner accepts about 8 of 10 drafts without a rewrite. That ratio is an example.", "The month worked, in this example, if the owner accepts about 8 of 10 drafts without a rewrite. That ratio is fictional.", { tags: ["modest"] }),
        choice("same-day", "Replacement visits get a draft the same day. That timing is an example goal.", "The month worked, as an example goal, if replacement visits get a draft the same day.", { tags: ["modest"] }),
        choice("calls", "Inbound “what’s the price” calls drop. There is no baseline yet.", "The month worked if inbound “what’s the price” calls drop. No baseline was named, so this check cannot be counted yet.", { tags: ["vague-metric"] }),
        choice("accept", "A customer can accept a bot price on the website", "The month worked if a customer can accept a bot price on the website.", { tags: ["wants-live-price", "needs-data", "customer-facing"], risk: "auto" }),
      ]
    ),
    question(
      "quote-failure",
      "quote",
      "deep",
      "failure",
      "What does a bad quote do to this shop?",
      "Pick the miss that costs money or trust, not the one that merely sounds awkward.",
      [
        choice("underbid", "It underbids a replacement and the shop eats the job", "A bad result to avoid: the bot underbids a replacement and the shop eats the job."),
        choice("date", "It promises a day the board cannot keep", "A bad result to avoid: the bot promises a day the board cannot keep."),
        choice("system", "It quotes a system the shop does not install", "A bad result to avoid: the bot quotes a system the shop does not install."),
        choice("voice", "It sounds like a call center and the customer hangs up", "A bad result to avoid: the quote sounds like a call center and the customer hangs up."),
      ]
    ),
    question(
      "quote-data",
      "quote",
      "deep",
      "data",
      "What can the bot actually read today, without a new system?",
      "If the honest answer is “someone would have to type it,” pick that.",
      [
        choice("book", "The price book PDF the owner already keeps", "The bot may read the price book PDF the owner already keeps."),
        choice("sheet", "Last year’s job spreadsheet. Those rows are an example, not a live catalog.", "The bot may read last year’s job spreadsheet. Those rows are an example, not a live catalog.", { tags: ["stale-data"] }),
        choice("notes", "Only the notes from the call or the visit", "The bot may read only the notes from the call or the visit.", { tags: ["notes-only"] }),
        choice("nothing", "Nothing reliable. Someone would have to type the prices in.", "There is nothing reliable to read. Someone would have to type the prices in.", { tags: ["no-data"] }),
      ]
    ),
    question(
      "quote-handoff",
      "quote",
      "deep",
      "handoff",
      "Who reads the quote before a customer can see it?",
      "“Nobody” is an answer. It is also how a wrong price leaves the shop.",
      [
        choice("owner", "The owner", "The owner reads the quote before a customer can see it.", { tags: ["human-handoff"] }),
        choice("dispatcher", "The dispatcher", "The dispatcher reads the quote before a customer can see it.", { tags: ["human-handoff"] }),
        choice("tech", "The tech who walked the house", "The tech who walked the house reads the quote before a customer can see it.", { tags: ["human-handoff"] }),
        choice("nobody", "Nobody. If it looks done, it can go out.", "Nobody reads the quote before it goes out.", { tags: ["no-handoff"], risk: "auto" }),
      ]
    ),
    question(
      "quote-slice",
      "quote",
      "deep",
      "slice",
      "The answers still describe a wide build. What is the smallest slice you would let this shop trust this week?",
      "The grill will keep a smaller slice even if you refuse one.",
      [
        choice("draft", "Drafts for replacement visits a tech already walked", "", {
          sliceLabel: "Drafts for replacement visits a tech already walked",
          specLabel: "drafts for replacement visits a tech already walked",
          detail: "The dispatcher pastes the visit notes. The bot fills a draft from the example price book. The owner reads it before anyone sends it. No customer-facing bot in that first slice.",
        }),
        choice("checklist", "A price-book checklist the dispatcher ticks. No paragraph, and no send.", "", {
          sliceLabel: "A price-book checklist the dispatcher ticks",
          specLabel: "a price-book checklist the dispatcher ticks, with no paragraph and no send",
          detail: "The dispatcher ticks what the tech found. The prices come from the book. Nobody receives a composed quote until a person writes one.",
        }),
        choice("ranges", "A public page of ranges, not a quote for one house", "", {
          sliceLabel: "A public page of ranges, not a quote for one house",
          specLabel: "a public page of ranges, not a quote for one house",
          detail: "The page shows example ranges for common replacements. It does not price a specific house, and it does not collect an acceptance.",
        }),
        choice("all", "The whole quoting bot. Grilling should not shrink it.", "", {
          sliceLabel: "The whole quoting bot",
          specLabel: "the whole quoting bot",
          detail: "The full quoting bot stays in scope.",
          tags: ["keep-big"],
          risk: "auto",
        }),
      ]
    ),

    question(
      "reviews-customer",
      "reviews",
      "deep",
      "customer",
      "Who is on the other end of the first review text?",
      "A list of everyone is a different project from a list of finished jobs the owner recognizes.",
      [
        choice("finished", "A customer the day after a job the shop actually finished", "The first text goes to a customer the day after a job the shop actually finished."),
        choice("owner", "The owner, who needs a list because asking in the driveway is not happening", "The first user is the owner, who needs a list because asking in the driveway is not happening."),
        choice("five", "Only customers who already seemed happy", "The first text goes only to customers who already seemed happy.", { tags: ["cherry-pick"] }),
        choice("everyone", "Every phone number in the spreadsheet", "The first text goes to every phone number in the spreadsheet.", { tags: ["broad-customer", "blast"], risk: "broad" }),
      ]
    ),
    question(
      "reviews-constraint",
      "reviews",
      "deep",
      "constraint",
      "What is off limits, even if it would raise the review count?",
      "A higher count is not worth a text the shop would not send by hand.",
      [
        choice("consent", "Only people who were told they might hear from the shop", "Texts go only to people who were told they might hear from the shop.", { tags: ["consent-first"] }),
        choice("reward", "No discount, gift, or credit in exchange for a review", "The shop does not offer a discount, a gift, or a credit in exchange for a review."),
        choice("blast", "Text everyone. A filter can come later.", "Texting everyone was allowed, and a filter was postponed.", { tags: ["blast", "no-limits"], risk: "auto" }),
        choice("send", "The bot may draft the text. A person sends it.", "The bot may draft the text, and a person sends it.", { tags: ["no-auto-send"] }),
      ]
    ),
    question(
      "reviews-success",
      "reviews",
      "deep",
      "success",
      "How will you know a month of asking worked?",
      "About 8 reviews is an example target on this page. It is not a real tally.",
      [
        choice("friday", "Each Friday the owner has a short list and sends the texts. One sitting is the example, not a quota.", "The month worked, as an example, if each Friday the owner has a short list and sends the texts in one sitting.", { tags: ["needs-phones", "modest"] }),
        choice("eight", "About 8 new reviews show up. That number is an example, and there is no real baseline here.", "The month worked, as an example target, if about 8 new reviews show up. That number is fictional, and this page has no real baseline.", { tags: ["needs-phones", "modest"] }),
        choice("stars", "Only likely 5-star jobs get asked, so the public average goes up", "The month worked if only likely 5-star jobs get asked, so the public average goes up.", { tags: ["cherry-pick", "needs-phones"] }),
        choice("auto", "The bot texts every completed job the same night, with no list to review", "The month worked if the bot texts every completed job the same night, with no list for a person to review.", { tags: ["blast", "needs-phones", "customer-facing"], risk: "auto" }),
      ]
    ),
    question(
      "reviews-failure",
      "reviews",
      "deep",
      "failure",
      "What does a bad ask do to a customer who just paid you?",
      "Pick the one you would not want to explain on the phone the next morning.",
      [
        choice("wrong", "A text lands on someone who had a bad day, or on the wrong house", "A bad result to avoid: a text lands on someone who had a bad day, or on the wrong house."),
        choice("night", "It texts at 9 at night", "A bad result to avoid: the text goes out at 9 at night."),
        choice("pulled", "It offers a reward and the review gets pulled down", "A bad result to avoid: a reward is offered and the review gets pulled down."),
        choice("nag", "A good customer gets a second and a third nag", "A bad result to avoid: a good customer gets a second and a third nag."),
      ]
    ),
    question(
      "reviews-data",
      "reviews",
      "deep",
      "data",
      "Where are the names and numbers the text would use?",
      "A Google listing shows stars. It does not show who to ask next.",
      [
        choice("sheet", "A spreadsheet column for phone and job date. The columns are an example.", "The bot may read a spreadsheet column for phone and job date. Those columns are an example, not a live export.", { tags: ["has-phones"] }),
        choice("inbox", "The shared inbox. Someone would copy numbers by hand.", "The numbers live in the shared inbox, and someone would copy them by hand.", { tags: ["manual-data"] }),
        choice("google", "The Google listing. It shows reviews, not who still needs to be asked.", "The named source is the Google listing, which shows reviews and not who still needs to be asked.", { tags: ["no-phones"] }),
        choice("nothing", "There is no clean list of who agreed to be texted", "There is no clean list of who agreed to be texted.", { tags: ["no-data"] }),
      ]
    ),
    question(
      "reviews-handoff",
      "reviews",
      "deep",
      "handoff",
      "Who sends the text, and who notices if someone writes back angry?",
      "The reply is part of the job. A bot that only sends is half a tool.",
      [
        choice("owner", "The owner sends from the shop phone and reads the replies", "The owner sends from the shop phone and reads the replies.", { tags: ["human-handoff"] }),
        choice("dispatcher", "The dispatcher sends, and the owner sees the replies the same day", "The dispatcher sends, and the owner sees the replies the same day.", { tags: ["human-handoff"] }),
        choice("bot", "The bot sends. Replies sit until someone remembers.", "The bot sends, and replies sit until someone remembers.", { tags: ["no-handoff"], risk: "auto" }),
        choice("nobody", "Nobody watches replies. The ask is the whole job.", "Nobody watches replies. The ask was treated as the whole job.", { tags: ["no-handoff"], risk: "auto" }),
      ]
    ),
    question(
      "reviews-slice",
      "reviews",
      "deep",
      "slice",
      "This is wider than a Friday list. What would you let the shop do this week, and no more?",
      "A carrier account can wait until a person has sent the texts by hand.",
      [
        choice("friday", "A Friday list the owner texts from the shop phone", "", {
          sliceLabel: "A Friday list the owner texts from the shop phone",
          specLabel: "a Friday list the owner texts from the shop phone",
          detail: "Completed jobs are listed with a short text written out. The owner sends it from the shop phone. No carrier account and no review API in that first slice.",
        }),
        choice("card", "A card on the kitchen counter. No texting.", "", {
          sliceLabel: "A card on the kitchen counter, and no texting",
          specLabel: "a card left on the kitchen counter, with no texting",
          detail: "The tech leaves a card that names the Google listing. The shop does not text anyone, and it does not open a carrier account.",
        }),
        choice("inbox", "A draft sitting in the shared inbox. A person hits send.", "", {
          sliceLabel: "A draft in the shared inbox that a person sends",
          specLabel: "a draft in the shared inbox that a person sends",
          detail: "The draft waits in the inbox the shop already uses. A person sends it during the day. Nothing goes out at night, and nothing is automatic.",
        }),
        choice("all", "The whole texting agent. Do not shrink the idea.", "", {
          sliceLabel: "The whole texting agent",
          specLabel: "the whole texting agent",
          detail: "The full texting agent stays in scope.",
          tags: ["keep-big"],
          risk: "auto",
        }),
      ]
    ),

    question(
      "book-customer",
      "book",
      "deep",
      "customer",
      "Who is the chatbot booking for in the first version?",
      "No-heat at 8 p.m. is a different product from a tune-up next Thursday.",
      [
        choice("tuneup", "A homeowner scheduling a tune-up", "The first user is a homeowner scheduling a tune-up."),
        choice("landlord", "A landlord with a few buildings on a maintenance round", "The first user is a landlord with a few buildings on a maintenance round."),
        choice("emergency", "Someone with no heat, who needs a slot tonight", "The first user is someone with no heat who needs a slot tonight.", { tags: ["emergency"], risk: "broad" }),
        choice("anyone", "Anyone who opens the website", "The first user is anyone who opens the website.", { tags: ["broad-customer"], risk: "broad" }),
      ]
    ),
    question(
      "book-constraint",
      "book",
      "deep",
      "constraint",
      "What must the chatbot refuse to do, even when the customer asks?",
      "The paper board is still the schedule. A bot that cannot see it should not pretend to.",
      [
        choice("tuneups", "Tune-ups only. No installs, and no no-heat emergencies.", "The first version books tune-ups only. It does not book installs or no-heat emergencies.", { tags: ["tuneup-only"] }),
        choice("board", "It may not write on the schedule board", "The first version may not write on the schedule board.", { tags: ["no-calendar-write"] }),
        choice("phone", "Every request is confirmed by a person on the phone", "A person confirms every request by phone before it is real.", { tags: ["human-confirm"] }),
        choice("open", "If a slot looks free, book it and move on", "If a slot looks free, the bot may book it and move on.", { tags: ["writes-calendar", "no-limits"], risk: "auto" }),
      ]
    ),
    question(
      "book-success",
      "book",
      "deep",
      "success",
      "What will you count at the end of the month?",
      "Same-day confirmation is an example aim. It is not a rate from a real board.",
      [
        choice("callback", "The dispatcher confirms the same day. That aim is an example.", "The month worked, as an example aim, if the dispatcher confirms requests the same day.", { tags: ["modest"] }),
        choice("seen", "The bot and the dispatcher are looking at the same open slots", "The month worked if the bot and the dispatcher are looking at the same open slots.", { tags: ["needs-slots"] }),
        choice("self", "The customer leaves with a confirmed time and no phone call", "The month worked if the customer leaves with a confirmed time and no phone call.", { tags: ["writes-calendar", "customer-facing"], risk: "auto" }),
        choice("heat", "No-heat calls get a slot without the dispatcher", "The month worked if no-heat calls get a slot without the dispatcher.", { tags: ["emergency-auto", "writes-calendar"], risk: "auto" }),
      ]
    ),
    question(
      "book-failure",
      "book",
      "deep",
      "failure",
      "What does a bad booking do on a morning the board is already full?",
      "Double-booking a tech is the expensive one. A clumsy sentence is not.",
      [
        choice("double", "Two jobs land on one tech at the same hour", "A bad result to avoid: two jobs land on one tech at the same hour."),
        choice("overnight", "A no-heat call sits in a chatbot overnight", "A bad result to avoid: a no-heat call sits in a chatbot overnight."),
        choice("zone", "It books a house outside the area the shop actually drives", "A bad result to avoid: it books a house outside the area the shop actually drives."),
        choice("card", "It takes a card number the shop did not ask for", "A bad result to avoid: it takes a card number the shop did not ask for."),
      ]
    ),
    question(
      "book-data",
      "book",
      "deep",
      "data",
      "What can the bot see that tells it a slot is actually open?",
      "If the answer is the paper board, the bot cannot see the slots. Say that plainly.",
      [
        choice("sheet", "A weekly spreadsheet the dispatcher updates. The sheet is an example.", "The bot may read a weekly spreadsheet the dispatcher updates. That sheet is an example, not a live calendar.", { tags: ["has-sheet"] }),
        choice("board", "The paper board in the shop. The bot cannot see it.", "The schedule is the paper board in the shop, and the bot cannot see it.", { tags: ["paper-only"] }),
        choice("memory", "Whoever answers the phone knows the week. Nothing is written for a bot.", "Whoever answers the phone knows the week, and nothing is written down for a bot to read.", { tags: ["no-data"] }),
        choice("site", "The website’s service list. It has no open slots.", "The bot may read the website’s service list, which has no open slots.", { tags: ["no-slots"] }),
      ]
    ),
    question(
      "book-handoff",
      "book",
      "deep",
      "handoff",
      "Who confirms the time before the customer is told it is real?",
      "A chatbot that says “you’re booked” has already done the handoff, even if it was wrong.",
      [
        choice("dispatcher", "The dispatcher calls back", "The dispatcher calls back and confirms the time before it is real.", { tags: ["human-handoff"] }),
        choice("owner", "The owner", "The owner confirms the time before it is real.", { tags: ["human-handoff"] }),
        choice("tech", "The tech whose name would go on the board", "The tech whose name would go on the board confirms the time before it is real.", { tags: ["human-handoff"] }),
        choice("bot", "The bot confirms it. The board gets updated later, if someone remembers.", "The bot confirms the time, and the board gets updated later if someone remembers.", { tags: ["no-handoff"], risk: "auto" }),
      ]
    ),
    question(
      "book-slice",
      "book",
      "deep",
      "slice",
      "What is the smallest booking change you would trust before the next busy week?",
      "About 40 tune-ups in a busy week is a fictional volume on this page, so the slice should survive a full board.",
      [
        choice("form", "A tune-up request form the dispatcher confirms by phone", "", {
          sliceLabel: "A tune-up request form the dispatcher confirms by phone",
          specLabel: "a tune-up request form the dispatcher confirms by phone",
          detail: "The site collects the address, the system type, and two times that might work. The dispatcher calls back the same day. The bot does not write on the calendar.",
        }),
        choice("hours", "A page with office hours and the phone number. No booking.", "", {
          sliceLabel: "A page with office hours and the phone number",
          specLabel: "a page that shows office hours and the phone number, with no booking",
          detail: "The page tells people when to call. It does not offer slots, and it does not say they are booked.",
        }),
        choice("list", "A morning list of requests. Nothing is confirmed until a person says so.", "", {
          sliceLabel: "A morning list of requests, confirmed only by a person",
          specLabel: "a morning list of requests that stays unconfirmed until a person says so",
          detail: "Requests collect overnight into a list. In the morning a person marks what the board can hold. The site never says “booked.”",
        }),
        choice("all", "The whole chatbot, including a confirmed time on screen", "", {
          sliceLabel: "The whole booking chatbot",
          specLabel: "the whole booking chatbot, including a confirmed time on screen",
          detail: "The full chatbot stays in scope.",
          tags: ["keep-big"],
          risk: "auto",
        }),
      ]
    ),

    question(
      "ads-customer",
      "ads",
      "deep",
      "customer",
      "Who is the ad for, in a sentence the owner could say at the counter?",
      "“Homeowners” is still a crowd. A neighborhood and a job is a customer.",
      [
        choice("local", "A homeowner in Oakley or Northside looking for a tune-up", "The ad is for a homeowner in Oakley or Northside who is looking for a tune-up."),
        choice("replace", "A homeowner comparing a replacement this season", "The ad is for a homeowner comparing a replacement this season."),
        choice("past", "Past customers who have not been back this year", "The ad is for past customers who have not been back this year."),
        choice("city", "Anyone in Cincinnati who might need HVAC", "The ad is for anyone in Cincinnati who might need HVAC.", { tags: ["broad-customer"], risk: "broad" }),
      ]
    ),
    question(
      "ads-constraint",
      "ads",
      "deep",
      "constraint",
      "What may the bot not say, and what may it not do with the ad account?",
      "An invented discount is a promise the tech has to honor in the driveway.",
      [
        choice("offer", "Only this month’s real offer. No invented discount.", "The bot may use only this month’s real offer, and it may not invent a discount.", { tags: ["no-invented-offer"] }),
        choice("voice", "If the owner would not say it out loud, it does not ship", "If the owner would not say the line out loud, it does not ship."),
        choice("free", "It can claim whatever will get the click", "Claims that might get the click were allowed, including ones the shop has not made.", { tags: ["invented-ok", "no-limits"], risk: "auto" }),
        choice("spend", "It may not publish, and it may not spend", "The bot may not publish an ad, and it may not spend.", { tags: ["no-auto-publish"] }),
      ]
    ),
    question(
      "ads-success",
      "ads",
      "deep",
      "success",
      "What is the check for the first month, in something you can count without an ad account API?",
      "Three drafts a week is an example pace. Cost per lead needs an account this page does not have.",
      [
        choice("three", "Three drafts a week the owner is willing to paste. That pace is an example.", "The month worked, as an example pace, if the owner is willing to paste three drafts a week.", { tags: ["needs-offer", "modest"] }),
        choice("calls", "Calls come from the neighborhoods the shop already serves. No baseline is on this page.", "The month worked if calls come from the neighborhoods the shop already serves. No baseline is on this page, so the check is not ready.", { tags: ["vague-metric"] }),
        choice("cheap", "Cost per lead falls. No example account is connected here.", "The month worked if cost per lead falls. No example account is connected on this page, so this cannot be checked here.", { tags: ["vague-metric"] }),
        choice("auto", "Ads go live on their own, without a weekly review", "The month worked if ads go live on their own, without a weekly review.", { tags: ["auto-publish", "needs-offer", "customer-facing"], risk: "auto" }),
      ]
    ),
    question(
      "ads-failure",
      "ads",
      "deep",
      "failure",
      "What does a bad ad do that a person then has to undo?",
      "Spend and promises are harder to undo than a stiff sentence.",
      [
        choice("city", "It runs for a neighborhood the shop does not serve", "A bad result to avoid: an ad runs for a neighborhood the shop does not serve."),
        choice("discount", "It offers a discount nobody approved", "A bad result to avoid: the ad offers a discount nobody approved."),
        choice("spend", "Spend continues after the offer has ended", "A bad result to avoid: spend continues after the offer has ended."),
        choice("voice", "The copy sounds like a chain, not a shop with two techs", "A bad result to avoid: the copy sounds like a chain, not a shop with two techs."),
      ]
    ),
    question(
      "ads-data",
      "ads",
      "deep",
      "data",
      "What can the bot read so it does not invent the offer?",
      "Last season’s posts are how an old price gets a new audience.",
      [
        choice("offer", "A note from the owner with this month’s offer", "The bot may read a note from the owner with this month’s offer.", { tags: ["has-offer"] }),
        choice("photos", "Photos already on the shop phone. That camera roll is an example, not a library.", "The bot may use photos already on the shop phone. That camera roll is an example, not a managed library."),
        choice("old", "Last season’s posts, which may be out of date", "The bot may read last season’s posts, which may be out of date.", { tags: ["stale-data"] }),
        choice("nothing", "No written offer. The bot would have to invent one.", "There is no written offer. The bot would have to invent one.", { tags: ["no-data"] }),
      ]
    ),
    question(
      "ads-handoff",
      "ads",
      "deep",
      "handoff",
      "Who reads the ad before it can spend a dollar?",
      "Pasting into the page the shop already has is a handoff. An API that publishes is the absence of one.",
      [
        choice("owner", "The owner pastes the one they like", "The owner pastes the ad they like, and nothing publishes itself.", { tags: ["human-handoff"] }),
        choice("dispatcher", "The dispatcher checks the offer, then the owner pastes", "The dispatcher checks the offer, and then the owner pastes.", { tags: ["human-handoff"] }),
        choice("friend", "A friend who sometimes helps with the page, still with the owner’s yes", "A friend who sometimes helps with the page posts only after the owner says yes.", { tags: ["human-handoff"] }),
        choice("bot", "The bot publishes. The owner looks later.", "The bot publishes, and the owner looks later.", { tags: ["no-handoff", "auto-publish"], risk: "auto" }),
      ]
    ),
    question(
      "ads-slice",
      "ads",
      "deep",
      "slice",
      "What would you ship this week if the ads API did not exist?",
      "If the answer needs a developer account, it is not this week’s slice.",
      [
        choice("three", "Three drafts a week, pasted by hand into the page the shop already has", "", {
          sliceLabel: "Three drafts a week, pasted by hand",
          specLabel: "three drafts a week, pasted by hand into the page the shop already has",
          detail: "The bot writes three short ads from this month’s offer. The owner pastes the one they like. Nothing is published by the bot, and nothing new is spent by an API. Three a week is an example pace.",
        }),
        choice("offer", "One written offer, and no ads until that note exists", "", {
          sliceLabel: "One written offer, and no ads until it exists",
          specLabel: "one written offer, and no ads until that note exists",
          detail: "Week one is the owner writing this month’s offer in a few sentences. No drafts, no spend, and no new tool until that note exists.",
        }),
        choice("post", "A regular page post, not an ad", "", {
          sliceLabel: "A regular page post, not an ad",
          specLabel: "a regular page post, not an ad and not a spend",
          detail: "The shop posts on the Facebook page it already has. There is no ad account work, no pixel, and no audience sync.",
        }),
        choice("all", "The whole ads bot, including publishing", "", {
          sliceLabel: "The whole ads bot, including publishing",
          specLabel: "the whole ads bot, including publishing",
          detail: "The full ads bot stays in scope.",
          tags: ["keep-big"],
          risk: "auto",
        }),
      ]
    ),

    question(
      "custom-customer",
      "custom",
      "deep",
      "customer",
      (state) => "Who, at Oakley Heating & Cooling, is the first person “" + ideaOf(state) + "” is for?",
      "If the answer is “the customer,” name the job they are trying to finish.",
      [
        choice("owner", "The owner", "The first user is the owner."),
        choice("dispatcher", "The dispatcher", "The first user is the dispatcher."),
        choice("tech", "A tech on a job", "The first user is a tech on a job."),
        choice("anyone", "A customer who has never called, or anyone on the site", "The first user is a customer who has never called, or anyone on the site.", { tags: ["broad-customer"], risk: "broad" }),
      ]
    ),
    question(
      "custom-constraint",
      "custom",
      "deep",
      "constraint",
      "What does the first version refuse, even if the original sentence included it?",
      "The original sentence is allowed to be bigger than week one.",
      [
        choice("check", "A person checks it before a customer sees it", "A person checks the result before a customer sees it.", { tags: ["human-check"] }),
        choice("vendor", "No new vendor and no new login in week one", "Week one adds no new vendor and no new login."),
        choice("none", "No special limits", "Nothing was ruled out for the first version.", { tags: ["no-limits"], risk: "auto" }),
        choice("send", "It cannot spend money or send a message by itself", "It cannot spend money or send a message by itself.", { tags: ["no-auto-send"] }),
      ]
    ),
    question(
      "custom-success",
      "custom",
      "deep",
      "success",
      "What could you tally on paper at the end of the month?",
      "“More money” is a hope. A week of use is a tally.",
      [
        choice("week", "The owner uses it on real jobs for one week and still wants it. That trial is an example.", "The month worked, as an example trial, if the owner uses it on real jobs for one week and still wants it.", { tags: ["modest"] }),
        choice("sheet", "It fills the shop’s existing spreadsheet correctly enough that the owner stops retyping", "The month worked if it fills the shop’s existing spreadsheet correctly enough that the owner stops retyping.", { tags: ["needs-data"] }),
        choice("money", "The shop makes more money", "The month worked if the shop makes more money. Nothing named here can count that.", { tags: ["vague-metric"] }),
        choice("auto", "It runs the whole task with nobody watching", "The month worked if the whole task runs with nobody watching.", { tags: ["customer-facing", "no-handoff", "needs-data"], risk: "auto" }),
      ]
    ),
    question(
      "custom-failure",
      "custom",
      "deep",
      "failure",
      "What failure would make the shop turn it off?",
      "Pick the miss a customer would feel, or a mess the dispatcher would have to clean up.",
      [
        choice("wrong", "It contacts the wrong customer, or the wrong house", "A bad result to avoid: it contacts the wrong customer, or the wrong house."),
        choice("invent", "It states a price, a date, or a promise the shop did not make", "A bad result to avoid: it states a price, a date, or a promise the shop did not make."),
        choice("inbox", "It creates a second inbox someone has to babysit", "A bad result to avoid: it creates a second inbox someone has to babysit."),
        choice("quiet", "It fails quietly and the shop trusts the blank result", "A bad result to avoid: it fails quietly and the shop trusts the blank result."),
      ]
    ),
    question(
      "custom-data",
      "custom",
      "deep",
      "data",
      "What record that already exists could a first version read?",
      "The board, the spreadsheet, the price book, and the inbox are the whole stack in this example.",
      [
        choice("stack", "The board, the spreadsheet, or the price book. Whichever this task already uses.", "The first version may read the board, the spreadsheet, or the price book, whichever this task already uses."),
        choice("inbox", "The shared inbox", "The first version may read the shared inbox."),
        choice("site", "The public website, and nothing internal", "The first version may read the public website, and nothing internal.", { tags: ["no-data"] }),
        choice("nothing", "Nothing written down. Someone would have to start a pile.", "Nothing is written down. Someone would have to start a pile before a bot could help.", { tags: ["no-data"] }),
      ]
    ),
    question(
      "custom-handoff",
      "custom",
      "deep",
      "handoff",
      "Who is on the hook if the result is wrong?",
      "Name a person. A bot cannot take the call back from an angry customer.",
      [
        choice("owner", "The owner", "The owner is on the hook if the result is wrong.", { tags: ["human-handoff"] }),
        choice("dispatcher", "The dispatcher", "The dispatcher is on the hook if the result is wrong.", { tags: ["human-handoff"] }),
        choice("tech", "The tech whose job it touches", "The tech whose job it touches is on the hook if the result is wrong.", { tags: ["human-handoff"] }),
        choice("nobody", "Nobody in particular. It should just be right.", "Nobody in particular is on the hook. The result was expected to just be right.", { tags: ["no-handoff"], risk: "auto" }),
      ]
    ),
    question(
      "custom-slice",
      "custom",
      "deep",
      "slice",
      (state) => "“" + ideaOf(state) + "” is still a whole project. What is the piece you could do by hand this week?",
      "If you cannot do it by hand once, a bot cannot be checked.",
      [
        choice("manual", "One week of the job, done by hand, with the notes kept", "", {
          sliceLabel: "One manual week of the job, with notes kept",
          specLabel: "one manual week of the job, with the notes kept",
          detail: "Do the task by hand for a week and keep the notes. The first build, later, is a template for that exact task. The owner checks it. There is no new vendor and no CRM in that week.",
        }),
        choice("template", "A template the owner fills. The bot does not send it anywhere.", "", {
          sliceLabel: "A template the owner fills, which the bot does not send",
          specLabel: "a template the owner fills, which is not sent anywhere by a bot",
          detail: "The template is a page or a note with the blanks the job always needs. A person fills it. Nothing is sent, posted, or booked from it.",
        }),
        choice("check", "A checklist. No new screen.", "", {
          sliceLabel: "A checklist, and no new screen",
          specLabel: "a checklist, and no new screen",
          detail: "The checklist is the questions a person already asks, written down. There is no login, no bot, and no second inbox.",
        }),
        choice("all", "The whole idea, built as it was first said", "", {
          sliceLabel: "The whole idea, built as first stated",
          specLabel: "the whole idea, built as it was first said",
          detail: "The full idea stays in scope.",
          tags: ["keep-big"],
          risk: "auto",
        }),
      ]
    ),

    question(
      "contradiction",
      ["quote", "reviews", "book", "ads", "custom"],
      "deep",
      "contradiction",
      function (state) {
        const pairs = activePairs(state);
        const pair = pairs[0];
        const extra = pairs.length > 1 ? " There are " + pairs.length + " conflicts in the answers so far, and this choice applies to all of them." : "";
        return "Two answers are fighting. One side says " + pair.wideSay + ". The other says " + pair.tightSay + ". Which one should the written spec keep?" + extra;
      },
      "Keeping both leaves the hole in the spec. The tighter limit is the one that stops a promise the shop cannot keep.",
      [
        choice("shrink", "Keep the tighter limit", "Where the answers disagreed, the spec keeps the tighter limit and leaves the wider promise out.", { tags: ["yielded"] }),
        choice("wait", "Wait until the missing piece is real", "Where the answers disagreed, the spec waits until the missing piece exists, and that piece is not assumed into the first build.", { tags: ["yielded"] }),
        choice("keep", "Keep both, and decide during the build", "Where the answers disagreed, both sides stay, and the decision is postponed into the build.", { tags: ["keep-conflict"], risk: "auto" }),
      ]
    ),
  ];

  const SCOPE = {
    quote: [
      { id: "live-price", label: "Live price engine" },
      { id: "parts", label: "Parts distributor API" },
      { id: "accept", label: "Customer accept button" },
      { id: "install", label: "Install-date booking" },
      { id: "crm", label: "Full CRM sync" },
    ],
    reviews: [
      { id: "sms", label: "SMS carrier setup" },
      { id: "consent", label: "Consent and quiet-hours program" },
      { id: "google", label: "Google review API" },
      { id: "sentiment", label: "Sentiment model" },
      { id: "crm", label: "Full CRM sync" },
    ],
    book: [
      { id: "widget", label: "Website chatbot vendor" },
      { id: "calendar", label: "Two-way calendar sync" },
      { id: "payment", label: "Payment capture" },
      { id: "emergency", label: "Emergency dispatch routing" },
      { id: "crm", label: "Full CRM sync" },
    ],
    ads: [
      { id: "fb-api", label: "Facebook Ads API" },
      { id: "publish", label: "Auto-publish to the ad account" },
      { id: "pixel", label: "Pixel and audience sync" },
      { id: "images", label: "Image generator" },
      { id: "crm", label: "Full CRM sync" },
    ],
    custom: [
      { id: "crm", label: "Full CRM sync" },
      { id: "auth", label: "Accounts and login" },
      { id: "inbox", label: "A second shared inbox" },
      { id: "vendor", label: "A vendor platform before a manual week" },
    ],
  };

  const EXTRA_SCOPE = [
    { pattern: /\b(text|texts|texting|sms)\b/i, item: { id: "sms", label: "SMS carrier setup" } },
    { pattern: /\breviews?\b/i, item: { id: "google", label: "Google review API" } },
    { pattern: /facebook|instagram|\bads?\b/i, item: { id: "fb-api", label: "Facebook Ads API" } },
    { pattern: /\bbook(?:s|ing)?\b|schedul|calendar|tune-?ups?/i, item: { id: "calendar", label: "Two-way calendar sync" } },
    { pattern: /quot|pric|estimat/i, item: { id: "live-price", label: "Live price engine" } },
  ];

  function ideaOf(state) {
    return ideaForGrill(state.ideaText) || "this idea";
  }

  function clampIdea(text) {
    return String(text || "").slice(0, IDEA_MAX);
  }

  function ideaForGrill(text) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, IDEA_MAX);
  }

  function clampNote(text) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
  }

  function matchingPreset(text, presetId) {
    if (!presetId) return null;
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) return null;
    if (ideaForGrill(preset.text) !== ideaForGrill(text)) return null;
    return preset;
  }

  function trackScores(text) {
    const raw = ideaForGrill(text);
    const scores = {};
    TRACK_ORDER.forEach((track) => {
      scores[track] = TRACK_PATTERNS[track].reduce((count, pattern) => count + (pattern.test(raw) ? 1 : 0), 0);
    });
    return scores;
  }

  function bestKeywordTrack(text) {
    const scores = trackScores(text);
    let winner = "custom";
    let best = 0;
    TRACK_ORDER.forEach((track) => {
      const score = scores[track];
      if (score > best) {
        best = score;
        winner = track;
      }
    });
    return winner;
  }

  function trackFor(text, presetId) {
    const preset = matchingPreset(text, presetId);
    if (preset) return preset.track;
    return bestKeywordTrack(text);
  }

  function ambiguousTracks(text, presetId) {
    if (matchingPreset(text, presetId)) return [];
    const scores = trackScores(text);
    return TRACK_ORDER.filter((track) => scores[track] > 0);
  }

  function begin(ideaText, depth, presetId) {
    const idea = ideaForGrill(ideaText);
    const preset = matchingPreset(idea, presetId);
    return {
      ideaText: idea,
      depth: depth === "shallow" ? "shallow" : "deep",
      presetId: preset ? preset.id : null,
      answers: [],
    };
  }

  function trackOf(state) {
    return trackFor(state.ideaText, state.presetId);
  }

  function questionById(id) {
    return QUESTIONS.find((item) => item.id === id) || null;
  }

  function choiceByAnswer(answer) {
    if (!answer) return null;
    const item = questionById(answer.questionId);
    if (!item) return null;
    return item.choices.find((option) => option.id === answer.choiceId) || null;
  }

  function choiceFor(state, theme) {
    const answer = state.answers.find((item) => item.theme === theme);
    return choiceByAnswer(answer);
  }

  function candidates(state, theme) {
    const track = trackOf(state);
    return QUESTIONS.filter((item) => item.theme === theme && item.depths.includes(state.depth) && item.tracks.includes(track));
  }

  function onlyQuestion(list, theme, state) {
    if (list.length !== 1) {
      throw new Error("Expected one " + theme + " question for " + trackOf(state) + "/" + state.depth + ", found " + list.map((item) => item.id).join(", "));
    }
    return list[0];
  }

  function tagSet(state) {
    const tags = new Set();
    state.answers.forEach((answer) => {
      const picked = choiceByAnswer(answer);
      (picked && picked.tags ? picked.tags : []).forEach((tag) => tags.add(tag));
    });
    return tags;
  }

  function activePairs(state) {
    const tags = tagSet(state);
    return PAIRS.filter((pair) => tags.has(pair.wide) && tags.has(pair.tight));
  }

  function ambitious(state) {
    return state.answers.some((answer) => {
      const picked = choiceByAnswer(answer);
      return picked && (picked.risk === "broad" || picked.risk === "auto");
    });
  }

  function nextQuestion(state) {
    if (!state || !ideaForGrill(state.ideaText)) return null;
    if (state.answers.length >= 8) return null;
    const asked = new Set(state.answers.map((answer) => answer.theme));
    const required = DEPTHS[state.depth].themes;
    for (let i = 0; i < required.length; i += 1) {
      const theme = required[i];
      if (!asked.has(theme)) return onlyQuestion(candidates(state, theme), theme, state);
    }
    if (state.depth !== "deep") return null;
    if (!asked.has("slice") && ambitious(state)) {
      const slice = candidates(state, "slice");
      if (slice.length === 1) return slice[0];
    }
    if (!asked.has("contradiction") && activePairs(state).length > 0 && state.answers.length < 8) {
      const conflict = candidates(state, "contradiction");
      if (conflict.length === 1) return conflict[0];
    }
    return null;
  }

  function give(state, choiceId, note) {
    const item = nextQuestion(state);
    if (!item) throw new Error("The grill is already finished.");
    const picked = item.choices.find((option) => option.id === choiceId);
    if (!picked) throw new Error("Unknown choice " + choiceId + " for " + item.id + ".");
    return {
      ideaText: state.ideaText,
      depth: state.depth,
      presetId: state.presetId,
      answers: state.answers.concat([{
        questionId: item.id,
        theme: item.theme,
        choiceId: picked.id,
        note: clampNote(note),
      }]),
    };
  }

  function walk(state, choiceIds) {
    return choiceIds.reduce((current, choiceId) => give(current, choiceId), state);
  }

  function present(state) {
    const item = nextQuestion(state);
    if (!item) return null;
    const pairs = activePairs(state);
    return {
      id: item.id,
      theme: item.theme,
      themeLabel: THEME_LABELS[item.theme],
      prompt: typeof item.prompt === "function" ? item.prompt(state) : item.prompt,
      help: typeof item.help === "function" ? item.help(state) : item.help,
      choices: item.choices.map((option) => ({ id: option.id, label: option.label })),
      index: state.answers.length + 1,
      depth: state.depth,
      track: trackOf(state),
      conflictCount: item.theme === "contradiction" ? pairs.length : 0,
    };
  }

  function priorState(state, count) {
    return {
      ideaText: state.ideaText,
      depth: state.depth,
      presetId: state.presetId,
      answers: state.answers.slice(0, count),
    };
  }

  function yielded(state) {
    const picked = choiceFor(state, "contradiction");
    return Boolean(picked && picked.tags.indexOf("yielded") !== -1);
  }

  function suppressedWideTags(state) {
    const drop = new Set();
    if (!yielded(state)) return drop;
    activePairs(state).forEach((pair) => drop.add(pair.wide));
    return drop;
  }

  function defaultSlice(track) {
    const item = QUESTIONS.find((question) => question.theme === "slice" && question.tracks.indexOf(track) !== -1);
    const picked = item.choices[0];
    return {
      id: picked.id,
      label: picked.sliceLabel,
      specLabel: picked.specLabel,
      detail: picked.detail,
      source: "default",
    };
  }

  function recommendedSlice(state) {
    const decision = choiceFor(state, "contradiction");
    if (decision && decision.id === "wait") {
      return {
        id: "wait",
        label: "No bot this week",
        specLabel: "no bot this week",
        detail: "Waiting was the answer to the conflict. Week one is gathering the missing piece by hand. A bot that needs that piece is not the first build.",
        source: "wait",
      };
    }
    const chosen = choiceFor(state, "slice");
    if (chosen && chosen.tags.indexOf("keep-big") === -1) {
      return {
        id: chosen.id,
        label: chosen.sliceLabel,
        specLabel: chosen.specLabel,
        detail: chosen.detail,
        source: "answer",
      };
    }
    const slice = defaultSlice(trackOf(state));
    if (chosen && chosen.tags.indexOf("keep-big") !== -1) slice.source = "held";
    return slice;
  }

  function sliceBecause(state, slice) {
    if (slice.source === "wait") {
      return "You chose to wait when two answers fought. Waiting replaces any slice until the missing piece exists.";
    }
    if (slice.source === "held") {
      return "You asked to keep the whole build. The grill still recommends the smaller slice. That split is a hole, not a tie.";
    }
    if (slice.source === "answer") {
      return "This is the smaller slice you picked when the grill asked you to cut.";
    }
    if (state.depth === "shallow") {
      return "The short grill never asked for a slice. This is the cautious default for this kind of idea, not a finding from failure, data, or handoff.";
    }
    if (state.answers.some((answer) => answer.theme === "contradiction")) {
      return "The conflict was about a limit, not about how wide the idea is, so there was no extra slice question. This is still the cautious first slice for this kind of idea.";
    }
    return "The answers were tight enough to skip an extra slice question. This is the cautious first slice for this kind of idea.";
  }

  function skippedScope(state) {
    const track = trackOf(state);
    const items = SCOPE[track].slice();
    const seen = {};
    items.forEach((item) => {
      seen[item.id] = true;
    });
    const idea = ideaForGrill(state.ideaText);
    EXTRA_SCOPE.forEach((extra) => {
      if (!extra.pattern.test(idea) || seen[extra.item.id]) return;
      seen[extra.item.id] = true;
      items.push(extra.item);
    });
    return items;
  }

  function spec(state) {
    const drop = suppressedWideTags(state);
    const sentences = [];
    sentences.push("Oakley Heating & Cooling will start from this idea: “" + ideaOf(state) + "”.");
    ["customer", "constraint", "success", "failure", "data", "handoff"].forEach((theme) => {
      const picked = choiceFor(state, theme);
      if (!picked) return;
      const hidden = (picked.tags || []).some((tag) => drop.has(tag));
      if (hidden) return;
      sentences.push(picked.sentence);
    });
    const decision = choiceFor(state, "contradiction");
    if (decision) sentences.push(decision.sentence);
    const slice = recommendedSlice(state);
    sentences.push("The first build is " + slice.specLabel + ". " + slice.detail);
    const notes = state.answers.map((answer) => answer.note).filter(Boolean);
    if (notes.length) {
      sentences.push("In your own words, you also wrote: “" + notes.join(" ") + "”.");
    }
    if (state.depth === "shallow") {
      sentences.push("Failure, the data the bot may read, and the handoff were not asked in this short grill, so they stay out of the spec.");
    }
    return sentences.join(" ");
  }

  function hole(id, tone, title, body) {
    return { id, tone, title, body };
  }

  function holes(state) {
    const found = [];
    const tags = tagSet(state);
    const pairs = activePairs(state);
    const idea = ideaOf(state);
    const conflictsAsked = state.answers.some((answer) => answer.theme === "contradiction");

    if (!conflictsAsked) {
      pairs.forEach((pair) => {
        const tail = state.depth === "shallow"
          ? " A deep grill would have stopped and asked which side wins. This short grill leaves both answers in place."
          : " Both answers are still in the transcript.";
        found.push(hole(
          "pair-" + pair.id,
          "contradiction",
          "These two answers fight",
          "One side says " + pair.wideSay + ". The other says " + pair.tightSay + "." + tail
        ));
      });
    } else if (yielded(state)) {
      const decision = choiceFor(state, "contradiction");
      const which = decision.id === "wait"
        ? "You chose to wait. The first slice is no bot this week, and the wider promise stays out of the paragraph."
        : "You kept the tighter limit. The spec drops the wider promise. The transcript still has it, so it does not get to sneak into the build.";
      found.push(hole(
        "settled",
        "settled",
        "A side was chosen",
        which + " Conflicts called: " + pairs.map((pair) => pair.wideSay + " versus " + pair.tightSay).join("; ") + "."
      ));
    } else if (pairs.length) {
      pairs.forEach((pair) => {
        found.push(hole(
          "pair-" + pair.id,
          "contradiction",
          "These two answers fight",
          "One side says " + pair.wideSay + ". The other says " + pair.tightSay + ". You chose to keep both and decide during the build, so the hole is still open."
        ));
      });
    }

    if (tags.has("keep-big")) {
      found.push(hole(
        "keep-big",
        "open",
        "The whole build is still on the table",
        "You answered the slice question by keeping the entire idea. The comparison still shows the smaller slice. The grill did not shrink the work if the spec quietly grows back to the first sentence."
      ));
    }
    if (tags.has("broad-customer")) {
      found.push(hole(
        "broad",
        "open",
        "The customer is still everyone",
        "An answer says this is for anyone who shows up. A first version needs one person and one job, or the build will try to serve a whole city from a shop with two techs."
      ));
    }
    if (tags.has("no-handoff")) {
      found.push(hole(
        "handoff",
        "open",
        "Nobody owns the handoff",
        "An answer lets the result go out with no person reading it. The dispatcher and the owner are still the ones who know the board. A first slice keeps one of them in the loop."
      ));
    }
    if (tags.has("no-limits")) {
      found.push(hole(
        "limits",
        "open",
        "Nothing was ruled out",
        "The constraint answer left the whole idea in play. A grill that rules nothing out does not change what gets built."
      ));
    }
    if (tags.has("vague-metric")) {
      found.push(hole(
        "metric",
        "open",
        "Success is not countable yet",
        "The success answer cannot be checked from anything this example shop has on paper. Pick a count you could do with a tally mark, or the build has no finish line."
      ));
    }
    if (tags.has("cherry-pick")) {
      found.push(hole(
        "cherry",
        "open",
        "Only the happy jobs get asked",
        "Choosing only likely 5-star jobs makes the public record look cleaner than the week. The hole is not technical. It is the shop saying something the work did not earn."
      ));
    }
    if (tags.has("stale-data")) {
      found.push(hole(
        "stale",
        "open",
        "The source may be stale",
        "The data answer uses last year’s jobs or last season’s posts. Those are example leftovers on this page. A price or an offer in them can be wrong for this month, and a bot will repeat it with a straight face."
      ));
    }
    if (tags.has("notes-only") && trackOf(state) === "quote") {
      found.push(hole(
        "notes",
        "open",
        "Call notes are not a price book",
        "The bot can read the notes from the call, and those notes do not contain a price. A draft still needs the price book, or a person typing the number, before it is a quote."
      ));
    }
    if (tags.has("paper-only") && !pairs.some((pair) => pair.tight === "paper-only")) {
      found.push(hole(
        "paper",
        "open",
        "The paper board stays invisible",
        "The schedule in this example is a paper board, and the bot cannot see it. That is fine while the first slice does not pretend to know which slots are open."
      ));
    }
    const named = ambiguousTracks(state.ideaText, state.presetId);
    if (named.length >= 2) {
      const followed = TRACKS[trackOf(state)].label;
      found.push(hole(
        "ambiguous",
        "open",
        "The idea names more than one job",
        "The words match more than one kind of bot (" + named.map((id) => TRACKS[id].label).join(", ") + "). This grill follows " + followed + ". The other job is still sitting in the sentence. Split them before you build, or you will build both."
      ));
    }
    if (ideaForGrill(state.ideaText).length < 12) {
      found.push(hole(
        "short",
        "open",
        "The idea is still a fragment",
        "“" + idea + "” is too short to grill properly. The questions still run, and the spec stays vague in the same places the sentence is vague."
      ));
    }
    if (state.depth === "shallow") {
      found.push(hole(
        "shallow",
        "open",
        "The short grill left three checks closed",
        "Failure, the data the bot may read, and the handoff were not asked. The spec is thinner on purpose. A deep grill is where those get forced."
      ));
    }
    const notes = state.answers.map((answer) => answer.note).filter(Boolean);
    if (notes.length) {
      found.push(hole(
        "note",
        "open",
        "Your note is not checked by the rules",
        "You added words the question bank does not interpret: “" + notes.join(" ") + "”. Read them against the paragraph. If they fight it, the paragraph does not know."
      ));
    }
    found.push(hole(
      "fiction",
      "open",
      "The shop and the counts are fiction",
      "Oakley Heating & Cooling, the busy-week figure of about " + EXAMPLE_TUNEUPS + " tune-ups, and any 8-of-10 or reviews-per-month figure are example numbers. They are not a real company’s books."
    ));
    return found;
  }

  function transcript(state) {
    return state.answers.map((answer, index) => {
      const item = questionById(answer.questionId);
      const picked = choiceByAnswer(answer);
      const then = priorState(state, index);
      return {
        index: index + 1,
        theme: THEME_LABELS[answer.theme],
        prompt: typeof item.prompt === "function" ? item.prompt(then) : item.prompt,
        label: picked.label,
        note: answer.note,
      };
    });
  }

  function comparison(state) {
    const slice = recommendedSlice(state);
    return {
      skipped: skippedScope(state),
      slice,
      because: sliceBecause(state, slice),
    };
  }

  function report(state) {
    const track = trackOf(state);
    return {
      idea: ideaOf(state),
      track,
      trackLabel: TRACKS[track].label,
      depth: state.depth,
      holes: holes(state),
      spec: spec(state),
      comparison: comparison(state),
      transcript: transcript(state),
      questionCount: state.answers.length,
    };
  }

  function trackBlurb(text, presetId) {
    const idea = ideaForGrill(text);
    if (!idea) return "Pick a chip or type a sentence. The grill starts from those words.";
    const named = ambiguousTracks(idea, presetId);
    const track = trackFor(idea, presetId);
    if (matchingPreset(idea, presetId)) {
      return "Preset locked to the " + TRACKS[track].label + " grill. Edit the sentence if this is a different job.";
    }
    if (named.length >= 2) {
      return "These words match more than one grill (" + named.map((id) => TRACKS[id].label).join(", ") + "). The questions will follow " + TRACKS[track].label + ", and the other job stays listed as a hole.";
    }
    if (track === "custom") {
      return "These words do not match quoting, reviews, booking, or ads. The questions stay general, and they still use this shop.";
    }
    return "These words follow the " + TRACKS[track].label + " grill.";
  }

  function finished(state) {
    return Boolean(ideaForGrill(state.ideaText)) && !nextQuestion(state);
  }

  globalThis.GrillMe = {
    IDEA_MAX,
    NOTE_MAX,
    EXAMPLE_TUNEUPS,
    PRESETS,
    DEPTHS,
    THEME_LABELS,
    TRACKS,
    QUESTIONS,
    PAIRS,
    clampIdea,
    ideaForGrill,
    clampNote,
    trackFor,
    trackScores,
    ambiguousTracks,
    trackBlurb,
    begin,
    trackOf,
    questionById,
    nextQuestion,
    give,
    walk,
    present,
    ambitious,
    activePairs,
    holes,
    spec,
    comparison,
    report,
    transcript,
    finished,
  };
})();
