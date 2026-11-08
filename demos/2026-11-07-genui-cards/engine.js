(function () {
  // Local stand-in for @json-render/chat. It checks the same flat spec shape,
  // the standard catalog, CardSpecError issues, the 500ms stream, and the
  // Slack second-table degradation. It is not the library.
  const INTERVAL_MS = 500;

  const CATALOG = [
    ["Card", "Root of the message. It needs a title, an image, or a child."],
    ["Section", "Groups related elements inside the card."],
    ["Text", "A markdown paragraph. Styles are plain, bold, and muted."],
    ["Fields", "A grid of label and value pairs. Children are Field elements."],
    ["Field", "One label and one value, inside Fields."],
    ["Table", "Headers and rows. Slack turns a second table into a code block."],
    ["Chart", "A pie, bar, line, or area chart."],
    ["Divider", "A line between groups."],
    ["Image", "An image from an https URL, plus alt text."],
    ["Actions", "A row of Button and LinkButton elements."],
    ["Button", "An action the bot handles. It needs an id and a label."],
    ["LinkButton", "A button that opens a URL."],
  ];

  class CardSpecError extends Error {
    constructor(issues) {
      super(issues.join("\n"));
      this.name = "CardSpecError";
      this.issues = issues;
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(value);
}

  function el(type, props, children) {
    return { type: type, props: props || {}, children: children || [] };
  }

  const schedule = {
    id: "schedule",
    label: "What's on tomorrow?",
    facts: "3 stops, 6.5 crew hours, first arrival 8:00",
    prose:
      "Tomorrow, Sunday November 8, the example board has 3 stops and 6.5 crew hours, and the first arrival is 8:00. H-184 is a leak call in Hyde Park for Crew A, 3 hours, starting at 8:00. Q-221 is a quote walk in Mt. Lookout for the estimator, 1.5 hours, at 11:00. H-186 is a gutter reset in East Walnut Hills for Crew B, 2 hours, at 1:30. Hours across those stops run 3, then 1.5, then 2. Crew A is on the first roof. This is example data for Copper Lantern Roofing, a fictional Hyde Park shop, not a real schedule. The next step would be to text Crew A or open job H-184.",
    spec: {
      root: "card",
      elements: {
        card: el(
          "Card",
          {
            title: "Sunday board",
            subtitle: "Nov 8, 2026 · example data",
          },
          ["intro", "kpis", "hoursChart", "board", "rule", "noteWrap", "photo", "actions"],
        ),
        intro: el("Text", {
          content:
            "**3 stops** tomorrow. The first is a leak call in Hyde Park at 8:00. Crew A is on that roof.",
        }),
        kpis: el("Fields", {}, ["stops", "hours", "first"]),
        stops: el("Field", { label: "Stops", value: "3" }),
        hours: el("Field", { label: "Crew hours", value: "6.5" }),
        first: el("Field", { label: "First arrival", value: "8:00" }),
        hoursChart: el("Chart", {
          title: "Hours on each stop",
          chart: {
            type: "line",
            categories: ["8:00", "11:00", "1:30"],
            series: [{ name: "Hours", values: [3, 1.5, 2] }],
            xLabel: "Start",
            yLabel: "Hours",
          },
        }),
        board: el("Table", {
          caption: "Example board",
          headers: ["Time", "Job", "Neighborhood", "Who"],
          align: ["left", "left", "left", "left"],
          rows: [
            ["8:00", "H-184 leak", "Hyde Park", "Crew A"],
            ["11:00", "Q-221 walk", "Mt. Lookout", "Estimator"],
            ["1:30", "H-186 gutters", "East Walnut Hills", "Crew B"],
          ],
        }),
        rule: el("Divider", {}),
        noteWrap: el("Section", {}, ["note"]),
        note: el("Text", {
          content: "Example board. Crews are labels, not people.",
          style: "muted",
        }),
        photo: el("Image", {
          url: "https://example.invalid/copper-lantern/sunday-roof.svg",
          alt: "Example sketch of a gable roof. Not a photo of a house.",
        }),
        actions: el("Actions", {}, ["textCrew", "openJob"]),
        textCrew: el("Button", {
          id: "text-crew-a",
          label: "Text Crew A",
          style: "primary",
        }),
        openJob: el("LinkButton", {
          label: "Open H-184",
          url: "https://example.invalid/jobs/H-184",
        }),
      },
    },
  };

  const quotes = {
    id: "quotes",
    label: "Compare the two quotes",
    facts: "shingles $10,550, metal $15,200, difference $4,650",
    prose:
      "Job Q-220 has two example quotes for the same house. Architectural shingles come to $10,550: tear-off $2,400, shingles $6,800, flashing $900, and disposal $450. Standing-seam metal comes to $15,200: tear-off $2,400, panels $11,200, flashing $1,150, and disposal $450. Metal is $4,650 more, about 44% more, and the sample warranty runs longer. These are example prices for Copper Lantern Roofing, a fictional Hyde Park shop, not a bid you can send. The next step would be to send the shingle quote or open Q-220.",
    spec: {
      root: "card",
      elements: {
        card: el(
          "Card",
          {
            title: "Two quotes for Q-220",
            subtitle: "Same house · example prices",
          },
          ["intro", "kpis", "totals", "rule", "shingles", "metal", "noteWrap", "actions"],
        ),
        intro: el("Text", {
          content:
            "Metal is **$4,650** more than architectural shingles. That is about 44% more, with a longer sample warranty.",
        }),
        kpis: el("Fields", {}, ["shingleTotal", "metalTotal", "gap"]),
        shingleTotal: el("Field", { label: "Shingles", value: "$10,550" }),
        metalTotal: el("Field", { label: "Metal", value: "$15,200" }),
        gap: el("Field", { label: "Difference", value: "$4,650" }),
        totals: el("Chart", {
          title: "Quote totals",
          chart: {
            type: "bar",
            categories: ["Shingles", "Metal"],
            series: [{ name: "Dollars", values: [10550, 15200] }],
            xLabel: "Quote",
            yLabel: "Dollars",
          },
        }),
        rule: el("Divider", {}),
        shingles: el("Table", {
          caption: "Shingle quote",
          headers: ["Item", "Amount"],
          align: ["left", "right"],
          rows: [
            ["Tear-off", "$2,400"],
            ["Shingles", "$6,800"],
            ["Flashing", "$900"],
            ["Disposal", "$450"],
            ["Total", "$10,550"],
          ],
        }),
        metal: el("Table", {
          caption: "Metal quote",
          headers: ["Item", "Amount"],
          align: ["left", "right"],
          rows: [
            ["Tear-off", "$2,400"],
            ["Panels", "$11,200"],
            ["Flashing", "$1,150"],
            ["Disposal", "$450"],
            ["Total", "$15,200"],
          ],
        }),
        noteWrap: el("Section", {}, ["note"]),
        note: el("Text", {
          content: "Example prices. This is not a bid.",
          style: "muted",
        }),
        actions: el("Actions", {}, ["sendShingle", "openQuote"]),
        sendShingle: el("Button", {
          id: "send-shingle",
          label: "Send shingle quote",
          style: "primary",
        }),
        openQuote: el("LinkButton", {
          label: "Open Q-220",
          url: "https://example.invalid/quotes/Q-220",
        }),
      },
    },
  };

  const leads = {
    id: "leads",
    label: "How did leads look?",
    facts: "14 new leads, 9 quotes out, 4 booked",
    prose:
      "For the example week of November 1 through November 7, Copper Lantern Roofing had 14 new leads, 9 quotes out, and 4 booked. That is 4 booked out of 14 leads. By day the leads ran Sun 1, Mon 2, Tue 2, Wed 3, Thu 2, Fri 3, Sat 1. Sources were yard signs 5, Google 4, repeat customers 3, and the insurance desk 2. Hyde Park had 5 leads and 2 booked, Mt. Lookout 4 and 1, Madisonville 3 and 1, East Walnut Hills 2 and 0. These rows are example data for a fictional Hyde Park shop, not a real week. The lead list would open from the card.",
    spec: {
      root: "card",
      elements: {
        card: el(
          "Card",
          {
            title: "Leads, Nov 1–7",
            subtitle: "Example week",
          },
          ["intro", "kpis", "sources", "byDay", "rule", "places", "noteWrap", "actions"],
        ),
        intro: el("Text", {
          content:
            "**14 new leads.** 4 booked. Hyde Park sent the most leads on this example week.",
        }),
        kpis: el("Fields", {}, ["newLeads", "quotesOut", "booked"]),
        newLeads: el("Field", { label: "New leads", value: "14" }),
        quotesOut: el("Field", { label: "Quotes out", value: "9" }),
        booked: el("Field", { label: "Booked", value: "4" }),
        sources: el("Chart", {
          title: "Where leads came from",
          chart: {
            type: "pie",
            segments: [
              { label: "Yard signs", value: 5 },
              { label: "Google", value: 4 },
              { label: "Repeat", value: 3 },
              { label: "Insurance", value: 2 },
            ],
          },
        }),
        byDay: el("Chart", {
          title: "Leads each day",
          chart: {
            type: "area",
            categories: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            series: [{ name: "Leads", values: [1, 2, 2, 3, 2, 3, 1] }],
            xLabel: "Day",
            yLabel: "Leads",
          },
        }),
        rule: el("Divider", {}),
        places: el("Table", {
          caption: "Example leads by neighborhood",
          headers: ["Neighborhood", "Leads", "Booked"],
          align: ["left", "right", "right"],
          rows: [
            ["Hyde Park", "5", "2"],
            ["Mt. Lookout", "4", "1"],
            ["Madisonville", "3", "1"],
            ["East Walnut Hills", "2", "0"],
          ],
        }),
        noteWrap: el("Section", {}, ["note"]),
        note: el("Text", {
          content: "Example week. Neighborhoods are labels, not a customer list.",
          style: "muted",
        }),
        actions: el("Actions", {}, ["pinWeek", "openLeads"]),
        pinWeek: el("Button", {
          id: "pin-week",
          label: "Pin this week",
          style: "primary",
        }),
        openLeads: el("LinkButton", {
          label: "Open the lead list",
          url: "https://example.invalid/leads/2026-11-01",
        }),
      },
    },
  };

  const QUESTIONS = [schedule, quotes, leads];

  function questionById(id) {
    const found = QUESTIONS.find((item) => item.id === id);
    if (!found) throw new Error("unknown question " + id);
    return found;
  }

function withBadProps(spec) {
  const next = clone(spec);
  const elements = next.elements;
  const textKey = Object.keys(elements).find((key) => elements[key].type === "Text");
  if (textKey) {
    elements[textKey].props = Object.assign({}, elements[textKey].props, { content: "" });
  }
  const chartKey = Object.keys(elements).find((key) => elements[key].type === "Chart");
    if (chartKey) {
      elements[chartKey].props = Object.assign({}, elements[chartKey].props, {
        chart: Object.assign({}, elements[chartKey].props.chart, { type: "radar" }),
      });
    }
    const buttonKey = Object.keys(elements).find((key) => elements[key].type === "Button");
    if (buttonKey) {
      elements[buttonKey].props = Object.assign({}, elements[buttonKey].props, {
        style: "success",
      });
    }
    elements.callout = el("Callout", { text: "Watch the pitch." });
    elements.orphan = el("Field", { label: "Pitch" });
    elements.card.children = elements.card.children.concat(["callout", "orphan"]);
    return next;
  }

  function withSecondTable(spec) {
    const next = clone(spec);
    const tables = Object.keys(next.elements).filter((key) => next.elements[key].type === "Table");
    if (tables.length >= 2) return next;
    next.elements.truck = el("Table", {
      caption: "Example materials staged",
      headers: ["Material", "Units"],
      align: ["left", "right"],
      rows: [
        ["Architectural shingles", "18 squares"],
        ["Ice and water", "4 rolls"],
      ],
    });
    const children = next.elements.card.children.slice();
    const actionsAt = children.indexOf("actions");
    if (actionsAt === -1) children.push("truck");
    else children.splice(actionsAt, 0, "truck");
    next.elements.card.children = children;
    return next;
  }

  function prepare(questionId, guard) {
    const question = questionById(questionId);
    let spec = clone(question.spec);
    let limits = null;
    if (guard === "bad") spec = withBadProps(spec);
    if (guard === "degrade" || guard === "limits") spec = withSecondTable(spec);
    if (guard === "limits") limits = { tables: 1 };
    return {
      id: question.id,
      label: question.label,
      facts: question.facts,
      prose: question.prose,
      spec: spec,
      limits: limits,
    };
  }

  function chartIssues(key, chart) {
    const issues = [];
    if (!chart || typeof chart !== "object") {
      issues.push(key + ".props.chart: expected a pie, bar, line, or area chart");
      return issues;
    }
    if (chart.type === "pie") {
      if (!Array.isArray(chart.segments) || chart.segments.length < 1) {
        issues.push(key + ".props.chart.segments: expected at least one segment");
        return issues;
      }
      chart.segments.forEach((segment, index) => {
        if (!segment || typeof segment.label !== "string" || segment.label.length < 1) {
          issues.push(
            key + ".props.chart.segments." + index + ".label: expected a non-empty string",
          );
        }
        if (!segment || typeof segment.value !== "number" || !(segment.value > 0)) {
          issues.push(
            key + ".props.chart.segments." + index + ".value: expected a positive number",
          );
        }
      });
      return issues;
    }
    if (chart.type === "bar" || chart.type === "line" || chart.type === "area") {
      if (!Array.isArray(chart.categories) || chart.categories.length < 1) {
        issues.push(key + ".props.chart.categories: expected at least one category");
      } else {
        chart.categories.forEach((category, index) => {
          if (typeof category !== "string" || category.length < 1) {
            issues.push(
              key + ".props.chart.categories." + index + ": expected a non-empty string",
            );
          }
        });
      }
      if (!Array.isArray(chart.series) || chart.series.length < 1) {
        issues.push(key + ".props.chart.series: expected at least one series");
      } else {
        chart.series.forEach((series, index) => {
          if (!series || typeof series.name !== "string" || series.name.length < 1) {
            issues.push(
              key + ".props.chart.series." + index + ".name: expected a non-empty string",
            );
          }
          if (!series || !Array.isArray(series.values)) {
            issues.push(key + ".props.chart.series." + index + ".values: expected an array of numbers");
          }
        });
      }
      return issues;
    }
    issues.push(key + ".props.chart.type: expected pie, bar, line, or area");
    return issues;
  }

  function propIssues(key, item) {
    const props = item.props || {};
    const issues = [];
    if (item.type === "Card") {
      if (props.title != null && typeof props.title !== "string") {
        issues.push(key + ".props.title: expected a string");
      }
      if (props.subtitle != null && typeof props.subtitle !== "string") {
        issues.push(key + ".props.subtitle: expected a string");
      }
      if (props.imageUrl != null && props.imageUrl !== "" && !isHttpUrl(props.imageUrl)) {
        issues.push(key + ".props.imageUrl: expected an http or https URL");
      }
      return issues;
    }
    if (item.type === "Section" || item.type === "Fields" || item.type === "Actions" || item.type === "Divider") {
      return issues;
    }
    if (item.type === "Text") {
      if (typeof props.content !== "string" || props.content.length < 1) {
        issues.push(key + ".props.content: expected a non-empty string");
      }
      if (props.style != null && !["plain", "bold", "muted"].includes(props.style)) {
        issues.push(key + ".props.style: expected plain, bold, or muted");
      }
      return issues;
    }
    if (item.type === "Field") {
      if (typeof props.label !== "string" || props.label.length < 1) {
        issues.push(key + ".props.label: expected a non-empty string");
      }
      if (typeof props.value !== "string" && typeof props.value !== "number") {
        issues.push(key + ".props.value: expected a string or number");
      }
      return issues;
    }
    if (item.type === "Table") {
      if (!Array.isArray(props.headers) || props.headers.length < 1 || props.headers.some((header) => typeof header !== "string")) {
        issues.push(key + ".props.headers: expected at least one header");
      }
      if (!Array.isArray(props.rows)) {
        issues.push(key + ".props.rows: expected an array of rows");
      } else {
        props.rows.forEach((row, index) => {
          if (!Array.isArray(row) || row.some((cell) => typeof cell !== "string" && typeof cell !== "number")) {
            issues.push(key + ".props.rows." + index + ": expected cells to be strings or numbers");
          }
        });
      }
      if (props.align != null && (!Array.isArray(props.align) || props.align.some((align) => !["left", "center", "right"].includes(align)))) {
        issues.push(key + ".props.align: expected left, center, or right");
      }
      return issues;
    }
    if (item.type === "Chart") {
      if (typeof props.title !== "string" || props.title.length < 1) {
        issues.push(key + ".props.title: expected a non-empty string");
      }
      return issues.concat(chartIssues(key, props.chart));
    }
    if (item.type === "Image") {
      if (!isHttpUrl(props.url)) issues.push(key + ".props.url: expected an http or https URL");
      if (typeof props.alt !== "string" || props.alt.length < 1) {
        issues.push(key + ".props.alt: expected a non-empty string");
      }
      return issues;
    }
    if (item.type === "Button") {
      if (typeof props.id !== "string" || props.id.length < 1) {
        issues.push(key + ".props.id: expected a non-empty string");
      }
      if (typeof props.label !== "string" || props.label.length < 1) {
        issues.push(key + ".props.label: expected a non-empty string");
      }
      if (props.style != null && !["primary", "danger", "default"].includes(props.style)) {
        issues.push(key + ".props.style: expected primary, danger, or default");
      }
      return issues;
    }
    if (item.type === "LinkButton") {
      if (typeof props.label !== "string" || props.label.length < 1) {
        issues.push(key + ".props.label: expected a non-empty string");
      }
      if (!isHttpUrl(props.url)) issues.push(key + ".props.url: expected an http or https URL");
      return issues;
    }
    issues.push(key + ': unknown component "' + item.type + '"');
    return issues;
  }

  function structureIssues(spec, elements) {
    const issues = [];
    const root = elements[spec.root];
    if (!root) issues.push('root "' + spec.root + '" is not an element');
    else if (root.type !== "Card") issues.push("root must be a Card");

    const slots = {
      Card: true,
      Section: true,
      Fields: true,
      Actions: true,
    };

    Object.keys(elements).forEach((key) => {
      const item = elements[key];
      const children = item.children || [];
      if (children.length && !slots[item.type]) {
        issues.push(key + ": " + item.type + " cannot have children");
      }
      children.forEach((childKey) => {
        const child = elements[childKey];
        if (!child) {
          issues.push(key + ': missing child "' + childKey + '"');
          return;
        }
        if (item.type === "Fields" && child.type !== "Field") {
          issues.push(key + ": Fields only holds Field elements");
        }
        if (item.type === "Actions" && child.type !== "Button" && child.type !== "LinkButton") {
          issues.push(key + ": Actions only holds Button and LinkButton elements");
        }
      });
      if (item.type === "Table" && Array.isArray(item.props.headers) && Array.isArray(item.props.rows)) {
        const width = item.props.headers.length;
        item.props.rows.forEach((row, index) => {
          if (Array.isArray(row) && row.length !== width) {
            issues.push(key + ": row " + index + " has " + row.length + " cells, expected " + width);
          }
        });
      }
      if (item.type === "Chart" && item.props.chart && item.props.chart.type !== "pie" && Array.isArray(item.props.chart.categories) && Array.isArray(item.props.chart.series)) {
        const count = item.props.chart.categories.length;
        item.props.chart.series.forEach((series) => {
          if (series && Array.isArray(series.values) && series.values.length !== count) {
            issues.push(
              key +
                ': series "' +
                series.name +
                '" has ' +
                series.values.length +
                " values, expected " +
                count,
            );
          }
        });
      }
    });
    return issues;
  }

  function hasContent(card) {
    const props = card.props || {};
    return Boolean(props.title || props.imageUrl || (card.children && card.children.length));
  }

  function limitIssues(elements, limits) {
    const issues = [];
    const entries = Object.keys(elements).map((key) => [key, elements[key]]);
    const count = (type) => entries.filter((entry) => entry[1].type === type).length;
    const over = (value, max) => max !== undefined && value > max;
    if (over(count("Table"), limits.tables)) {
      issues.push("at most " + limits.tables + " Table per message");
    }
    if (over(count("Chart"), limits.charts)) {
      issues.push("at most " + limits.charts + " Chart per message");
    }
    entries.forEach((entry) => {
      const key = entry[0];
      const item = entry[1];
      const props = item.props || {};
      if (item.type === "Fields" && over((item.children || []).length, limits.fields)) {
        issues.push(key + ": at most " + limits.fields + " fields");
      }
      if (item.type === "Table") {
        if (Array.isArray(props.rows) && over(props.rows.length + 1, limits.tableRows)) {
          issues.push(key + ": at most " + limits.tableRows + " rows including the header");
        }
        if (Array.isArray(props.headers) && over(props.headers.length, limits.tableColumns)) {
          issues.push(key + ": at most " + limits.tableColumns + " columns");
        }
      }
      if (item.type === "Chart" && props.chart) {
        const chart = props.chart;
        if (typeof props.title === "string" && over(props.title.length, limits.chartTitle)) {
          issues.push(key + ": title longer than " + limits.chartTitle + " characters");
        }
        const labels =
          chart.type === "pie"
            ? (chart.segments || []).map((segment) => segment.label)
            : (chart.categories || []).concat((chart.series || []).map((series) => series.name));
        labels.forEach((label) => {
          if (typeof label === "string" && over(label.length, limits.chartLabel)) {
            issues.push(
              key + ': label "' + label + '" longer than ' + limits.chartLabel + " characters",
            );
          }
        });
        const groups = chart.type === "pie" ? (chart.segments || []).length : (chart.series || []).length;
        if (over(groups, limits.chartSeries)) {
          issues.push(key + ": at most " + limits.chartSeries + " series or segments");
        }
        if (chart.type !== "pie" && Array.isArray(chart.categories) && over(chart.categories.length, limits.chartPoints)) {
          issues.push(key + ": at most " + limits.chartPoints + " categories");
        }
      }
    });
    return issues;
  }

  function collectIssues(spec, options) {
    const limits = options && options.limits;
    if (!spec || typeof spec.root !== "string" || !spec.elements) {
      return ["spec needs a root and elements"];
    }
    const elements = spec.elements;
    let issues = [];
    Object.keys(elements).forEach((key) => {
      issues = issues.concat(propIssues(key, elements[key]));
    });
    if (!issues.length) issues = structureIssues(spec, elements);
    if (!issues.length && elements[spec.root] && !hasContent(elements[spec.root])) {
      issues.push("the Card needs a title, an image or at least one child");
    }
    if (!issues.length && limits) issues = limitIssues(elements, limits);
    return issues;
  }

  function skip() {
    const error = new Error("skip");
    error.skip = true;
    return error;
  }

  function toChild(key, elements) {
    const item = elements[key];
    if (!item) throw skip();
    const props = item.props || {};
    if (item.type === "Section") {
      const children = (item.children || []).map((childKey) => toChild(childKey, elements));
      if (!children.length) throw skip();
      return { type: "Section", children: children };
    }
    if (item.type === "Text") {
      return { type: "Text", content: props.content, style: props.style || "plain" };
    }
    if (item.type === "Fields") {
      const fields = (item.children || []).map((childKey) => {
        const child = elements[childKey];
        if (!child || child.type !== "Field") throw skip();
        return { label: child.props.label, value: String(child.props.value) };
      });
      if (!fields.length) throw skip();
      return { type: "Fields", fields: fields };
    }
    if (item.type === "Table") {
      return {
        type: "Table",
        caption: props.caption || "",
        headers: props.headers,
        align: props.align || [],
        rows: props.rows.map((row) => row.map((cell) => String(cell))),
      };
    }
    if (item.type === "Chart") {
      return { type: "Chart", title: props.title, chart: clone(props.chart) };
    }
    if (item.type === "Divider") return { type: "Divider" };
    if (item.type === "Image") return { type: "Image", url: props.url, alt: props.alt };
    if (item.type === "Actions") {
      const buttons = (item.children || []).map((childKey) => {
        const child = elements[childKey];
        if (!child || (child.type !== "Button" && child.type !== "LinkButton")) throw skip();
        if (child.type === "Button") {
          return {
            kind: "button",
            id: child.props.id,
            label: child.props.label,
            style: child.props.style || "default",
          };
        }
        return { kind: "link", label: child.props.label, url: child.props.url };
      });
      if (!buttons.length) throw skip();
      return { type: "Actions", buttons: buttons };
    }
    throw skip();
  }

  function buildCard(root, elements) {
    const children = [];
    (root.children || []).forEach((key) => {
      try {
        children.push(toChild(key, elements));
      } catch (error) {
        if (!error || !error.skip) throw error;
      }
    });
    return {
      type: "Card",
      title: root.props.title || "",
      subtitle: root.props.subtitle || "",
      imageUrl: root.props.imageUrl || "",
      children: children,
    };
  }

  function validElements(spec) {
    const kept = {};
    Object.keys(spec.elements).forEach((key) => {
      const item = spec.elements[key];
      if (!propIssues(key, item).length) kept[key] = item;
    });
    return kept;
  }

  function toCard(spec, options) {
    const issues = collectIssues(spec, options);
    if (issues.length) throw new CardSpecError(issues);
    return buildCard(spec.elements[spec.root], spec.elements);
  }

  function toPartialCard(spec) {
    if (!spec || typeof spec.root !== "string" || !spec.elements) return null;
    const elements = validElements(spec);
    const root = elements[spec.root];
    if (!root || root.type !== "Card") return null;
    const card = buildCard(root, elements);
    if (!card.title && !card.subtitle && !card.imageUrl && !card.children.length) return null;
    return card;
  }

  function tableCode(table) {
    const header = table.headers.join(" | ");
    const rule = table.headers.map(() => "---").join(" | ");
    const rows = table.rows.map((row) => row.join(" | "));
    return [header, rule].concat(rows).join("\n");
  }

  function present(card, platform) {
    if (!card) return null;
    const copy = clone(card);
    if (platform !== "slack") return copy;
    let seen = 0;
    function walk(node) {
      if (!node) return;
      if (node.type === "Table") {
        seen += 1;
        if (seen > 1) {
          node.degraded = true;
          node.code = tableCode(node);
        }
      }
      (node.children || []).forEach(walk);
    }
    walk(copy);
    return copy;
  }

  function framesOf(spec) {
    const rootKey = spec.root;
    const root = spec.elements[rootKey];
    const frames = [];
    const elements = {};
    elements[rootKey] = {
      type: root.type,
      props: clone(root.props),
      children: [],
    };
    frames.push({ root: rootKey, elements: clone(elements) });

    function addSubtree(key) {
      const item = spec.elements[key];
      elements[key] = {
        type: item.type,
        props: clone(item.props),
        children: [],
      };
      (item.children || []).forEach((childKey) => {
        addSubtree(childKey);
        elements[key].children.push(childKey);
      });
    }

    (root.children || []).forEach((childKey) => {
      addSubtree(childKey);
      elements[rootKey].children.push(childKey);
      frames.push({ root: rootKey, elements: clone(elements) });
    });
    return frames;
  }

  function usedTypes(spec) {
    const seen = [];
    Object.keys(spec.elements).forEach((key) => {
      const type = spec.elements[key].type;
      if (seen.indexOf(type) === -1) seen.push(type);
    });
    return seen;
  }

  function countType(spec, type) {
    return Object.keys(spec.elements).filter((key) => spec.elements[key].type === type).length;
  }

  globalThis.GenUI = {
    INTERVAL_MS: INTERVAL_MS,
    CATALOG: CATALOG,
    QUESTIONS: QUESTIONS,
    CardSpecError: CardSpecError,
    prepare: prepare,
    framesOf: framesOf,
    toCard: toCard,
    toPartialCard: toPartialCard,
    present: present,
    usedTypes: usedTypes,
    countType: countType,
    collectIssues: collectIssues,
  };
})();
