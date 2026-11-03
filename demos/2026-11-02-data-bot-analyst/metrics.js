// Semantic layer and the loose readings Data Bot uses when the layer is off.
// Every number the page shows is computed here from the dataset.
(function () {
  const QUARTER = { start: "2026-07-01", end: "2026-09-30", label: "Jul 1–Sep 30, 2026" };
  const SEASON = { start: "2026-03-01", end: "2026-10-31", label: "Mar 1–Oct 31, 2026" };
  const LOOSE_WEEK_HOURS = 40;
  const LOOSE_WEEKS = 13;

  const METRICS = [
    {
      id: "booked_job",
      name: "Booked job",
      definition: "A job whose status is booked or completed. A cancelled job is not booked. When a window applies, the date is scheduled_on.",
    },
    {
      id: "completed_job",
      name: "Completed job",
      definition: "A job whose status is completed and whose completed_on is filled in.",
    },
    {
      id: "gross_revenue",
      name: "Gross revenue",
      definition: "Sum of gross_cents on completed jobs. Discounts stay in the number. Cancelled jobs and jobs that are still booked stay out.",
    },
    {
      id: "net_revenue",
      name: "Net revenue",
      definition: "Sum of gross_cents minus discount_cents on completed jobs. On this page the word revenue means net revenue. Labor and overhead are still inside it. It is not profit.",
    },
    {
      id: "customer",
      name: "Customer",
      definition: "A customer id with at least one completed job. A row in the customer file, a prospect, and a lead are not customers until that completed job exists. The status column on the customer file is not this metric.",
    },
    {
      id: "repeat_customer_rate",
      name: "Repeat-customer rate",
      definition: "Customers with two or more completed jobs in the season, divided by customers with at least one completed job in the season. The season in this file is Mar 1 through Oct 31, 2026.",
    },
    {
      id: "conversion",
      name: "Conversion",
      definition: "A lead whose completed_job_id is set, divided by leads for that campaign. A quote is not a conversion. A cancelled booking is not a conversion.",
    },
    {
      id: "cost_per_booked_job",
      name: "Cost per booked job",
      definition: "Campaign spend divided by booked jobs whose booked_via is that campaign and whose scheduled_on falls on or between the campaign start and end. Spend is the whole campaign, not a daily slice.",
    },
    {
      id: "crew_utilization",
      name: "Crew utilization",
      definition: "Labor minutes on completed jobs in the window, divided by that crew's capacity_minutes. Capacity is the hours the shop scheduled for the crew. Last quarter is Jul 1 through Sep 30, 2026. Cancelled and still-open jobs do not add hours.",
    },
    {
      id: "last_quarter",
      name: "Last quarter",
      definition: "Jul 1 through Sep 30, 2026. The page treats today as Nov 2, 2026, so this window does not move. A trailing 90 days would be a different window.",
    },
  ];

  const QUESTIONS = [
    { id: "revenue-neighborhood", role: "owner", chip: "Revenue by neighborhood", text: "What was revenue by neighborhood last quarter?" },
    { id: "repeat-rate", role: "owner", chip: "Repeat-customer rate", text: "What is our repeat-customer rate this season?" },
    { id: "customer-count", role: "owner", chip: "How many customers?", text: "How many customers do we have?" },
    { id: "gross-net", role: "owner", chip: "Gross and net revenue", text: "What was gross and net revenue last quarter?" },
    { id: "cheapest-campaign", role: "marketer", chip: "Cheapest booked jobs", text: "Which campaign brought the cheapest booked jobs?" },
    { id: "conversion", role: "marketer", chip: "Conversion by campaign", text: "What is our conversion rate by campaign?" },
    { id: "crew-utilization", role: "ops", chip: "Crew utilization", text: "How utilized was each crew last quarter?" },
  ];

  const ROLES = [
    { id: "owner", label: "Owner" },
    { id: "marketer", label: "Marketer" },
    { id: "ops", label: "Ops" },
  ];

  function metricById(id) {
    return METRICS.filter(function (item) { return item.id === id; })[0];
  }

  function questionById(id) {
    return QUESTIONS.filter(function (item) { return item.id === id; })[0];
  }

  function inWindow(iso, window) {
    return typeof iso === "string" && iso >= window.start && iso <= window.end;
  }

  function isCompleted(job) {
    return job.status === "completed" && !!job.completed_on;
  }

  function isBooked(job) {
    return job.status === "booked" || job.status === "completed";
  }

  function netCents(job) {
    return job.gross_cents - job.discount_cents;
  }

  function formatMoney(cents) {
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(Math.round(cents));
    const dollars = Math.floor(abs / 100);
    const rest = abs % 100;
    const body = dollars.toLocaleString("en-US");
    if (rest === 0) return sign + "$" + body;
    return sign + "$" + body + "." + String(rest).padStart(2, "0");
  }

  function formatPct(ratio) {
    const tenths = Math.round(ratio * 1000);
    const sign = tenths < 0 ? "-" : "";
    const abs = Math.abs(tenths);
    return sign + Math.floor(abs / 10).toLocaleString("en-US") + "." + (abs % 10) + "%";
  }

  function formatHours(minutes) {
    const tenths = Math.round(minutes * 10 / 60);
    const sign = tenths < 0 ? "-" : "";
    const abs = Math.abs(tenths);
    return sign + Math.floor(abs / 10).toLocaleString("en-US") + "." + (abs % 10);
  }

  function formatCount(value) {
    return Math.round(value).toLocaleString("en-US");
  }

  function normalize(raw) {
    return String(raw || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function matchQuestion(raw) {
    const q = normalize(raw);
    if (!q) return null;
    const exact = QUESTIONS.filter(function (item) {
      return normalize(item.text) === q || normalize(item.chip) === q;
    })[0];
    if (exact) return exact.id;
    const has = function (phrase) { return q.indexOf(phrase) !== -1; };
    const any = function () {
      return Array.prototype.some.call(arguments, function (phrase) { return has(phrase); });
    };
    if (any("profit", "margin", "forecast", "predict", "payroll", "wage", "hire", "employee", "rating", "review", "churn", "lifetime")) {
      return null;
    }
    if (any("cheap", "cheapest", "lowest cost", "cost per")) return "cheapest-campaign";
    if ((has("neighborhood") || has("neighborhoods")) && any("revenue", "sales", "earned")) return "revenue-neighborhood";
    if (has("repeat")) return "repeat-rate";
    if (any("gross", "net revenue", "net and gross", "gross and net") || q === "net" || q.indexOf(" net ") !== -1 || q.indexOf("net ") === 0) {
      return "gross-net";
    }
    if (any("util", "how busy") || (has("crew") && any("hour", "busy", "capacity"))) return "crew-utilization";
    if (any("conversion", "convert")) return "conversion";
    if (any("how many customer", "customer count", "number of customer", "customers do we", "customer total")) return "customer-count";
    if (any("revenue", "sales")) return "gross-net";
    if (has("campaign") && any("book", "job")) return "cheapest-campaign";
    return null;
  }

  function definedCustomerIds(data) {
    const ids = new Set();
    data.jobs.forEach(function (job) {
      if (isCompleted(job) && inWindow(job.completed_on, SEASON)) ids.add(job.customer_id);
    });
    return ids;
  }

  function repeatCustomerIds(data) {
    const counts = new Map();
    data.jobs.forEach(function (job) {
      if (isCompleted(job) && inWindow(job.completed_on, SEASON)) {
        counts.set(job.customer_id, (counts.get(job.customer_id) || 0) + 1);
      }
    });
    const ids = new Set();
    counts.forEach(function (count, id) {
      if (count >= 2) ids.add(id);
    });
    return ids;
  }

  function loosePopulation(data) {
    const orphanLeads = data.leads.filter(function (lead) { return !lead.customer_id; });
    return {
      fileRows: data.customers.length,
      orphanLeads: orphanLeads.length,
      total: data.customers.length + orphanLeads.length,
    };
  }

  function looseRepeatIds(data) {
    const counts = new Map();
    data.jobs.forEach(function (job) {
      if (inWindow(job.scheduled_on, SEASON)) {
        counts.set(job.customer_id, (counts.get(job.customer_id) || 0) + 1);
      }
    });
    const ids = new Set();
    counts.forEach(function (count, id) {
      if (count >= 2) ids.add(id);
    });
    return ids;
  }

  function quarterJobs(data, predicate) {
    return data.jobs.filter(function (job) {
      return inWindow(job.scheduled_on, QUARTER) && predicate(job);
    });
  }

  function campaignCosts(data, mode) {
    return data.campaigns.map(function (campaign) {
      const rows = data.jobs.filter(function (job) {
        return job.booked_via === campaign.id
          && inWindow(job.scheduled_on, { start: campaign.start_on, end: campaign.end_on });
      });
      const booked = rows.filter(isBooked);
      const cancelled = rows.filter(function (job) { return job.status === "cancelled"; });
      const used = mode === "defined" ? booked : rows;
      const cost = used.length === 0 ? null : campaign.spend_cents / used.length;
      return {
        id: campaign.id,
        name: campaign.name,
        shortName: campaign.short_name,
        spendCents: campaign.spend_cents,
        booked: booked.length,
        cancelled: cancelled.length,
        jobRows: rows.length,
        used: used.length,
        costCents: cost,
      };
    }).sort(function (a, b) {
      if (a.costCents == null && b.costCents == null) return a.name.localeCompare(b.name);
      if (a.costCents == null) return 1;
      if (b.costCents == null) return -1;
      if (a.costCents !== b.costCents) return a.costCents - b.costCents;
      return a.name.localeCompare(b.name);
    });
  }

function neighborhoodRevenue(data) {
  return data.neighborhoods.map(function (name) {
    const completed = data.jobs.filter(function (job) {
      return job.neighborhood === name && isCompleted(job) && inWindow(job.completed_on, QUARTER);
    });
    const looseJobs = data.jobs.filter(function (job) {
      return job.neighborhood === name && inWindow(job.scheduled_on, QUARTER);
    });
    const gross = completed.reduce(function (sum, job) { return sum + job.gross_cents; }, 0);
    const discounts = completed.reduce(function (sum, job) { return sum + job.discount_cents; }, 0);
    const looseGross = looseJobs.reduce(function (sum, job) { return sum + job.gross_cents; }, 0);
    return {
      name: name,
      completed: completed.length,
      cancelled: looseJobs.filter(function (job) { return job.status === "cancelled"; }).length,
      grossCents: gross,
      discountCents: discounts,
      netCents: gross - discounts,
      looseGrossCents: looseGross,
      jobRows: looseJobs.length,
    };
  });
}

  function sortNeighborhoods(rows, mode) {
    const key = mode === "defined" ? "netCents" : "looseGrossCents";
    return rows.slice().sort(function (a, b) {
      if (a[key] !== b[key]) return b[key] - a[key];
      return a.name.localeCompare(b.name);
    });
  }

  function quarterTotals(data) {
    const rows = neighborhoodRevenue(data);
    return rows.reduce(function (acc, row) {
      acc.completed += row.completed;
      acc.cancelled += row.cancelled;
      acc.grossCents += row.grossCents;
      acc.discountCents += row.discountCents;
      acc.netCents += row.netCents;
      acc.looseGrossCents += row.looseGrossCents;
      acc.jobRows += row.jobRows;
      return acc;
    }, { completed: 0, cancelled: 0, grossCents: 0, discountCents: 0, netCents: 0, looseGrossCents: 0, jobRows: 0 });
  }

  function crewUtilization(data) {
    const looseMinutes = LOOSE_WEEK_HOURS * LOOSE_WEEKS * 60;
    return data.crews.map(function (crew) {
      const inQuarter = data.jobs.filter(function (job) {
        return job.crew === crew.id && inWindow(job.scheduled_on, QUARTER);
      });
      const completedMinutes = inQuarter.filter(isCompleted).reduce(function (sum, job) {
        return sum + job.labor_minutes;
      }, 0);
      const allMinutes = inQuarter.reduce(function (sum, job) { return sum + job.labor_minutes; }, 0);
      const cancelledMinutes = inQuarter.filter(function (job) { return job.status === "cancelled"; }).reduce(function (sum, job) {
        return sum + job.labor_minutes;
      }, 0);
      return {
        id: crew.id,
        completedMinutes: completedMinutes,
        cancelledMinutes: cancelledMinutes,
        allMinutes: allMinutes,
        capacityMinutes: crew.capacity_minutes,
        looseCapacityMinutes: looseMinutes,
        definedRatio: crew.capacity_minutes === 0 ? null : completedMinutes / crew.capacity_minutes,
        looseRatio: looseMinutes === 0 ? null : allMinutes / looseMinutes,
      };
    });
  }

  function conversionByCampaign(data) {
    return data.campaigns.map(function (campaign) {
      const leads = data.leads.filter(function (lead) { return lead.campaign_id === campaign.id; });
      const completed = leads.filter(function (lead) { return !!lead.completed_job_id; }).length;
      const lost = leads.filter(function (lead) { return lead.status === "lost"; }).length;
      const quoted = leads.filter(function (lead) { return lead.status === "quoted"; }).length;
      const cancelled = leads.filter(function (lead) { return lead.status === "cancelled"; }).length;
      const loose = leads.length - lost;
      return {
        id: campaign.id,
        name: campaign.name,
        shortName: campaign.short_name,
        leads: leads.length,
        completed: completed,
        quoted: quoted,
        cancelled: cancelled,
        lost: lost,
        loose: loose,
        definedRatio: leads.length === 0 ? null : completed / leads.length,
        looseRatio: leads.length === 0 ? null : loose / leads.length,
      };
    });
  }

  function answerShell(data, id, mode, questionText) {
    const question = questionById(id);
    return {
      matched: true,
      id: id,
      mode: mode,
      role: question.role,
      question: questionText || question.text,
      metrics: [],
      looseReading: "",
      sql: "",
      columns: [],
      rows: [],
      chart: { caption: "", note: "", series: [] },
      caveats: [],
      headline: "",
      lede: "",
      contrast: "",
      sample: "",
    };
  }

  function unknownAnswer(questionText) {
    return {
      matched: false,
      id: null,
      mode: null,
      question: questionText,
      headline: "I don't have a defined metric for that.",
      lede: "Data Bot only computes the metrics in the list on this page. This question is not one of them, so there is no number to show.",
      known: METRICS.map(function (item) { return item.name; }),
    };
  }

  function cheapestAnswer(data, mode, questionText) {
    const answer = answerShell(data, "cheapest-campaign", mode, questionText);
    const defined = campaignCosts(data, "defined");
    const loose = campaignCosts(data, "loose");
    const active = mode === "defined" ? defined : loose;
    const other = mode === "defined" ? loose : defined;
    const winner = active[0];
    const otherWinner = other[0];
    answer.metrics = [metricById("cost_per_booked_job"), metricById("booked_job")];
    answer.looseReading = "Spend divided by every job row with that campaign id, including cancelled jobs. There is no status filter.";
    answer.headline = mode === "defined"
      ? winner.name + ", at " + formatMoney(winner.costCents) + " per booked job."
      : winner.name + ", at " + formatMoney(winner.costCents) + " per job row.";
    answer.lede = mode === "defined"
      ? "Six campaigns. Cost per booked job divides the campaign's spend by jobs whose status is booked or completed."
      : "Six campaigns. This reading divides spend by every job row tied to the campaign, cancelled rows included.";
    answer.contrast = "The other reading picks " + otherWinner.name + ", at " + formatMoney(otherWinner.costCents) + (mode === "defined" ? " per job row." : " per booked job.");
    answer.sql = mode === "defined"
      ? [
        "-- metric: cost_per_booked_job, booked_job",
        "-- spend is the full campaign spend",
        "SELECT campaigns.name,",
        "       campaigns.spend_cents,",
        "       COUNT(jobs.id) AS booked_jobs,",
        "       campaigns.spend_cents * 1.0 / COUNT(jobs.id) AS cost_per_booked_job_cents",
        "FROM campaigns",
        "LEFT JOIN jobs",
        "  ON jobs.booked_via = campaigns.id",
        " AND jobs.status IN ('booked', 'completed')",
        " AND jobs.scheduled_on BETWEEN campaigns.start_on AND campaigns.end_on",
        "GROUP BY campaigns.id",
        "ORDER BY cost_per_booked_job_cents ASC;",
      ].join("\n")
      : [
        "-- no metric. \"cheapest\" read as spend / job rows",
        "SELECT campaigns.name,",
        "       campaigns.spend_cents,",
        "       COUNT(jobs.id) AS job_rows,",
        "       campaigns.spend_cents * 1.0 / COUNT(jobs.id) AS cost_per_job_row_cents",
        "FROM campaigns",
        "LEFT JOIN jobs ON jobs.booked_via = campaigns.id",
        "GROUP BY campaigns.id",
        "ORDER BY cost_per_job_row_cents ASC;",
      ].join("\n");
    answer.columns = [
      { key: "name", label: "Campaign" },
      { key: "spend", label: "Spend", numeric: true },
      { key: "booked", label: "Booked jobs", numeric: true },
      { key: "cancelled", label: "Cancelled", numeric: true },
      { key: "cost", label: mode === "defined" ? "Cost per booked job" : "Cost per job row", numeric: true },
    ];
    answer.rows = active.map(function (row) {
      return {
        emphasize: row.id === winner.id,
        cells: {
          name: row.name,
          spend: formatMoney(row.spendCents),
          booked: formatCount(row.booked),
          cancelled: formatCount(row.cancelled),
          cost: formatMoney(row.costCents),
        },
      };
    });
    answer.chart = {
      caption: "Cost by campaign. Longer bars cost more. The cheapest campaign is the shortest bar.",
      note: "Longer bars cost more. The answer is the shortest bar.",
      series: active.map(function (row) {
        return {
          label: row.shortName,
          value: row.costCents,
          display: formatMoney(row.costCents),
          emphasize: row.id === winner.id,
        };
      }),
    };
    const bookedTotal = defined.reduce(function (sum, row) { return sum + row.booked; }, 0);
    const rowTotal = loose.reduce(function (sum, row) { return sum + row.jobRows; }, 0);
    answer.sample = bookedTotal + " booked jobs and " + rowTotal + " job rows across 6 campaigns. The whole file is in the query.";
    answer.caveats = [
      "Spend is the full amount stored on the campaign. It is not spread by day, and it is not limited to last quarter.",
      "A booked job has status booked or completed. " + winner.name + " has " + formatCount(winner.cancelled) + " cancelled jobs on the same campaign id.",
      "The other reading counts those cancelled rows, which is why the cheapest campaign changes.",
      "Nothing here was sampled from a larger account. The query sees every campaign row in the file.",
    ];
    answer.raw = { winnerId: winner.id, otherWinnerId: otherWinner.id, defined: defined, loose: loose };
    return answer;
  }

  function revenueAnswer(data, mode, questionText) {
    const answer = answerShell(data, "revenue-neighborhood", mode, questionText);
    const ranked = sortNeighborhoods(neighborhoodRevenue(data), mode);
    const winner = ranked[0];
    const otherRanked = sortNeighborhoods(neighborhoodRevenue(data), mode === "defined" ? "loose" : "defined");
    const other = otherRanked[0];
    const totals = quarterTotals(data);
    answer.metrics = [metricById("net_revenue"), metricById("last_quarter"), metricById("completed_job")];
    answer.looseReading = "Sum of gross_cents on every job with scheduled_on in last quarter, including cancelled jobs.";
    answer.headline = mode === "defined"
      ? winner.name + ", at " + formatMoney(winner.netCents) + " net revenue."
      : winner.name + ", at " + formatMoney(winner.looseGrossCents) + " gross across every job row.";
    answer.lede = mode === "defined"
      ? "Revenue means net revenue on completed jobs. The window is last quarter, Jul 1 through Sep 30, 2026."
      : "This reading adds gross_cents for every job scheduled last quarter, then ranks neighborhoods by that sum.";
    answer.contrast = mode === "defined"
      ? "The loose reading ranks " + other.name + " first, at " + formatMoney(other.looseGrossCents) + " gross."
      : "Net revenue on completed jobs ranks " + other.name + " first, at " + formatMoney(other.netCents) + ".";
    answer.sql = mode === "defined"
      ? [
        "-- metric: net_revenue, completed_job, last_quarter",
        "-- window: 2026-07-01 .. 2026-09-30",
        "SELECT jobs.neighborhood,",
        "       COUNT(jobs.id) AS completed_jobs,",
        "       SUM(jobs.gross_cents) AS gross_cents,",
        "       SUM(jobs.discount_cents) AS discount_cents,",
        "       SUM(jobs.gross_cents - jobs.discount_cents) AS net_cents",
        "FROM jobs",
        "WHERE jobs.status = 'completed'",
        "  AND jobs.completed_on BETWEEN '2026-07-01' AND '2026-09-30'",
        "GROUP BY jobs.neighborhood",
        "ORDER BY net_cents DESC;",
      ].join("\n")
      : [
        "-- no metric. \"revenue\" read as gross on every job row",
        "-- window: 2026-07-01 .. 2026-09-30",
        "SELECT jobs.neighborhood,",
        "       COUNT(jobs.id) AS job_rows,",
        "       SUM(jobs.gross_cents) AS gross_cents",
        "FROM jobs",
        "WHERE jobs.scheduled_on BETWEEN '2026-07-01' AND '2026-09-30'",
        "GROUP BY jobs.neighborhood",
        "ORDER BY gross_cents DESC;",
      ].join("\n");
    answer.columns = [
      { key: "name", label: "Neighborhood" },
      { key: "completed", label: "Completed jobs", numeric: true },
      { key: "net", label: "Net revenue", numeric: true },
      { key: "loose", label: "All-status gross", numeric: true },
    ];
    answer.rows = ranked.map(function (row) {
      return {
        emphasize: row.name === winner.name,
        cells: {
          name: row.name,
          completed: formatCount(row.completed),
          net: formatMoney(row.netCents),
          loose: formatMoney(row.looseGrossCents),
        },
      };
    });
    answer.chart = {
      caption: mode === "defined"
        ? "Net revenue by neighborhood for last quarter."
        : "All-status gross by neighborhood for last quarter.",
      note: mode === "defined" ? "Bar length is net revenue on completed jobs." : "Bar length is gross on every job row.",
      series: ranked.map(function (row) {
        const value = mode === "defined" ? row.netCents : row.looseGrossCents;
        return { label: row.name, value: value, display: formatMoney(value), emphasize: row.name === winner.name };
      }),
    };
    answer.sample = formatCount(totals.completed) + " completed jobs and " + formatCount(totals.cancelled) + " cancelled jobs scheduled in last quarter. " + formatCount(data.jobs.length) + " jobs are in the file.";
    answer.caveats = [
      "Last quarter is the calendar quarter before Nov 2, 2026: Jul 1 through Sep 30. It is not the trailing 90 days.",
      "Discounts on completed jobs in the quarter are " + formatMoney(totals.discountCents) + ". Net revenue removes them. Gross on completed jobs is " + formatMoney(totals.grossCents) + ".",
      "Hyde Park has cancelled plantings with a gross amount still stored on the row. The loose sum includes that gross. Net revenue does not.",
      "The whole quarter is in the query. There is no sample and no confidence interval.",
    ];
    answer.raw = { winner: winner.name, otherWinner: other.name, totals: totals };
    return answer;
  }

  function repeatAnswer(data, mode, questionText) {
    const answer = answerShell(data, "repeat-rate", mode, questionText);
    const definedCustomers = definedCustomerIds(data);
    const repeats = repeatCustomerIds(data);
    const loose = loosePopulation(data);
    const looseRepeats = looseRepeatIds(data);
    const definedRate = repeats.size / definedCustomers.size;
    const looseRate = looseRepeats.size / loose.total;
    const definedOneTime = definedCustomers.size - repeats.size;
    answer.metrics = [metricById("repeat_customer_rate"), metricById("customer")];
    answer.looseReading = "Customer ids with two or more jobs of any status, divided by customer-file rows plus leads that have no customer id.";
    answer.headline = mode === "defined"
      ? formatPct(definedRate) + " of customers with a completed job came back (" + formatCount(repeats.size) + " of " + formatCount(definedCustomers.size) + ")."
      : formatPct(looseRate) + " when the denominator is the loose customer count (" + formatCount(looseRepeats.size) + " of " + formatCount(loose.total) + ").";
    answer.lede = mode === "defined"
      ? "A repeat customer has two or more completed jobs in the season. The denominator is customers with at least one completed job."
      : "This reading keeps people with two or more job rows, then divides by every customer-file row and every lead that never received a customer id.";
    answer.contrast = mode === "defined"
      ? "The loose rate is " + formatPct(looseRate) + " (" + formatCount(looseRepeats.size) + " of " + formatCount(loose.total) + ")."
      : "The defined rate is " + formatPct(definedRate) + " (" + formatCount(repeats.size) + " of " + formatCount(definedCustomers.size) + ").";
    answer.sql = mode === "defined"
      ? [
        "-- metric: repeat_customer_rate, customer",
        "-- season: 2026-03-01 .. 2026-10-31",
        "WITH completed AS (",
        "  SELECT customer_id, COUNT(*) AS jobs",
        "  FROM jobs",
        "  WHERE status = 'completed'",
        "    AND completed_on BETWEEN '2026-03-01' AND '2026-10-31'",
        "  GROUP BY customer_id",
        ")",
        "SELECT SUM(CASE WHEN jobs >= 2 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) AS repeat_customer_rate,",
        "       SUM(CASE WHEN jobs >= 2 THEN 1 ELSE 0 END) AS repeat_customers,",
        "       COUNT(*) AS customers",
        "FROM completed;",
      ].join("\n")
      : [
        "-- no metric. \"customer\" read as file rows plus unattached leads",
        "WITH touches AS (",
        "  SELECT customer_id, COUNT(*) AS jobs",
        "  FROM jobs",
        "  GROUP BY customer_id",
        ")",
        "SELECT (SELECT COUNT(*) FROM touches WHERE jobs >= 2) * 1.0",
        "       / ((SELECT COUNT(*) FROM customers) + (SELECT COUNT(*) FROM leads WHERE customer_id IS NULL));",
      ].join("\n");
    answer.columns = [
      { key: "reading", label: "Reading" },
      { key: "repeats", label: "Repeat customers", numeric: true },
      { key: "denominator", label: "Denominator", numeric: true },
      { key: "rate", label: "Rate", numeric: true },
    ];
    answer.rows = [
      {
        emphasize: mode === "defined",
        cells: {
          reading: "Defined",
          repeats: formatCount(repeats.size),
          denominator: formatCount(definedCustomers.size),
          rate: formatPct(definedRate),
        },
      },
      {
        emphasize: mode === "loose",
        cells: {
          reading: "Loose",
          repeats: formatCount(looseRepeats.size),
          denominator: formatCount(loose.total),
          rate: formatPct(looseRate),
        },
      },
    ];
    const series = mode === "defined"
      ? [
        { label: "Repeat", value: repeats.size, display: formatCount(repeats.size), emphasize: true },
        { label: "One completed job", value: definedOneTime, display: formatCount(definedOneTime), emphasize: false },
      ]
      : [
        { label: "Two or more jobs", value: looseRepeats.size, display: formatCount(looseRepeats.size), emphasize: true },
        { label: "Everyone else in the loose count", value: loose.total - looseRepeats.size, display: formatCount(loose.total - looseRepeats.size), emphasize: false },
      ];
    answer.chart = {
      caption: mode === "defined"
        ? "Customers with a completed job, split into repeat and one-time."
        : "Loose customer count, split into people with two or more jobs and everyone else.",
      note: "The rate is the emphasized bar divided by both bars.",
      series: series,
    };
    answer.sample = formatCount(definedCustomers.size) + " customers have a completed job this season. The customer file has " + formatCount(loose.fileRows) + " rows. " + formatCount(loose.orphanLeads) + " leads have no customer id.";
    answer.caveats = [
      "The season is Mar 1 through Oct 31, 2026, which is every job date in the file. Last quarter is a shorter window and is not used here.",
      "Both readings find " + formatCount(repeats.size) + " customer ids with two or more completed jobs. The rates differ because the denominators differ.",
      "The loose denominator adds " + formatCount(loose.fileRows - definedCustomers.size) + " customer-file rows with no completed job and " + formatCount(loose.orphanLeads) + " leads.",
      "A route customer with several mow visits counts once, as a repeat. Visits are not customers.",
    ];
    answer.raw = {
      definedRepeats: repeats.size,
      definedCustomers: definedCustomers.size,
      looseRepeats: looseRepeats.size,
      looseTotal: loose.total,
    };
    return answer;
  }

  function customerAnswer(data, mode, questionText) {
    const answer = answerShell(data, "customer-count", mode, questionText);
    const defined = definedCustomerIds(data).size;
    const loose = loosePopulation(data);
    answer.metrics = [metricById("customer"), metricById("completed_job")];
    answer.looseReading = "Every row in the customer file, plus every lead whose customer id is blank.";
    answer.headline = mode === "defined"
      ? formatCount(defined) + " customers. Each has at least one completed job."
      : formatCount(loose.total) + ". That is " + formatCount(loose.fileRows) + " customer-file rows plus " + formatCount(loose.orphanLeads) + " leads with no customer id.";
    answer.lede = mode === "defined"
      ? "Customer means a customer id attached to a completed job. The status column on the file is not consulted."
      : "This reading counts rows. Prospects, cancelled-only rows, and leads that never booked are included.";
    answer.contrast = mode === "defined"
      ? "The loose count is " + formatCount(loose.total) + "."
      : "The defined count is " + formatCount(defined) + ".";
    answer.sql = mode === "defined"
      ? [
        "-- metric: customer, completed_job",
        "-- season: 2026-03-01 .. 2026-10-31",
        "SELECT COUNT(DISTINCT customer_id) AS customers",
        "FROM jobs",
        "WHERE status = 'completed'",
        "  AND completed_on BETWEEN '2026-03-01' AND '2026-10-31';",
      ].join("\n")
      : [
        "-- no metric. \"customer\" read as rows on hand",
        "SELECT (SELECT COUNT(*) FROM customers)",
        "     + (SELECT COUNT(*) FROM leads WHERE customer_id IS NULL) AS loose_customers;",
      ].join("\n");
    answer.columns = [
      { key: "reading", label: "Reading" },
      { key: "count", label: "Count", numeric: true },
      { key: "rule", label: "What is counted" },
    ];
    answer.rows = [
      { emphasize: mode === "defined", cells: { reading: "Defined", count: formatCount(defined), rule: "Completed job this season" } },
      { emphasize: mode === "loose", cells: { reading: "Loose", count: formatCount(loose.total), rule: "File rows plus unattached leads" } },
    ];
    answer.chart = {
      caption: "Defined customers beside the loose count.",
      note: "The two bars use different sets of rows.",
      series: [
        { label: "Defined", value: defined, display: formatCount(defined), emphasize: mode === "defined" },
        { label: "Loose", value: loose.total, display: formatCount(loose.total), emphasize: mode === "loose" },
      ],
    };
    answer.sample = formatCount(data.customers.length) + " customer-file rows, " + formatCount(data.leads.length) + " leads, " + formatCount(data.jobs.length) + " jobs.";
    answer.caveats = [
      "The defined count ignores customers.file_status. A row marked active with no completed job is not a customer.",
      formatCount(loose.fileRows - defined) + " customer-file rows have no completed job. They are prospects, open bookings, or cancelled-only rows.",
      "Leads that already point at a customer id are not added again. " + formatCount(loose.orphanLeads) + " leads have a blank customer id, mostly quotes and lost leads.",
      "This is the whole file for the 2026 season in the sample. It is not a rolling 12-month count.",
    ];
    answer.raw = { defined: defined, loose: loose.total, fileRows: loose.fileRows, orphanLeads: loose.orphanLeads };
    return answer;
  }

  function grossNetAnswer(data, mode, questionText) {
    const answer = answerShell(data, "gross-net", mode, questionText);
    const totals = quarterTotals(data);
    answer.metrics = [metricById("gross_revenue"), metricById("net_revenue"), metricById("last_quarter")];
    answer.looseReading = "Sum of gross_cents on every job scheduled last quarter, any status.";
    answer.headline = mode === "defined"
      ? "Net revenue last quarter was " + formatMoney(totals.netCents) + "."
      : "A loose reading of revenue is " + formatMoney(totals.looseGrossCents) + ".";
    answer.lede = mode === "defined"
      ? "Two defined metrics sit next to each other. Gross revenue is completed jobs before discounts. Net revenue subtracts discounts. The word revenue, alone, means net."
      : "This reading adds gross on cancelled jobs and on jobs that are not completed yet, and it does not subtract discounts.";
    answer.contrast = mode === "defined"
      ? "The loose gross is " + formatMoney(totals.looseGrossCents) + ". Completed gross, before discounts, is " + formatMoney(totals.grossCents) + "."
      : "Completed gross is " + formatMoney(totals.grossCents) + ". Net revenue is " + formatMoney(totals.netCents) + ".";
    answer.sql = mode === "defined"
      ? [
        "-- metric: gross_revenue, net_revenue, last_quarter",
        "SELECT SUM(gross_cents) AS gross_revenue_cents,",
        "       SUM(discount_cents) AS discount_cents,",
        "       SUM(gross_cents - discount_cents) AS net_revenue_cents",
        "FROM jobs",
        "WHERE status = 'completed'",
        "  AND completed_on BETWEEN '2026-07-01' AND '2026-09-30';",
      ].join("\n")
      : [
        "-- no metric. \"revenue\" read as gross on every row in the quarter",
        "SELECT SUM(gross_cents) AS loose_gross_cents",
        "FROM jobs",
        "WHERE scheduled_on BETWEEN '2026-07-01' AND '2026-09-30';",
      ].join("\n");
    answer.columns = [
      { key: "reading", label: "Reading" },
      { key: "amount", label: "Amount", numeric: true },
      { key: "rule", label: "Rule" },
    ];
    answer.rows = [
      { emphasize: mode === "loose", cells: { reading: "Loose gross", amount: formatMoney(totals.looseGrossCents), rule: "Every job row in the quarter" } },
      { emphasize: false, cells: { reading: "Gross revenue", amount: formatMoney(totals.grossCents), rule: "Completed jobs, discounts kept" } },
      { emphasize: mode === "defined", cells: { reading: "Net revenue", amount: formatMoney(totals.netCents), rule: "Completed jobs, discounts removed" } },
    ];
    answer.chart = {
      caption: "Three readings of last quarter's revenue.",
      note: "The emphasized bar is the number Data Bot would say in this mode.",
      series: [
        { label: "Loose gross", value: totals.looseGrossCents, display: formatMoney(totals.looseGrossCents), emphasize: mode === "loose" },
        { label: "Gross revenue", value: totals.grossCents, display: formatMoney(totals.grossCents), emphasize: false },
        { label: "Net revenue", value: totals.netCents, display: formatMoney(totals.netCents), emphasize: mode === "defined" },
      ],
    };
    answer.sample = formatCount(totals.completed) + " completed jobs and " + formatCount(totals.jobRows) + " job rows scheduled last quarter.";
    answer.caveats = [
      "Discounts on completed jobs are " + formatMoney(totals.discountCents) + ". That is the gap between gross revenue and net revenue.",
      "The gap between loose gross and gross revenue is cancelled and uncompleted jobs, " + formatMoney(totals.looseGrossCents - totals.grossCents) + " of gross.",
      "Net revenue is not profit. Crew pay, fuel, and overhead are not columns in this file, so Data Bot will not invent a margin.",
      "Window: Jul 1 through Sep 30, 2026. Today on this page is Nov 2, 2026.",
    ];
    answer.raw = totals;
    return answer;
  }

  function conversionAnswer(data, mode, questionText) {
    const answer = answerShell(data, "conversion", mode, questionText);
    const rows = conversionByCampaign(data);
    const ratioKey = mode === "defined" ? "definedRatio" : "looseRatio";
    const ranked = rows.slice().sort(function (a, b) {
      if (a[ratioKey] !== b[ratioKey]) return b[ratioKey] - a[ratioKey];
      return a.name.localeCompare(b.name);
    });
    const winner = ranked[0];
    const otherKey = mode === "defined" ? "looseRatio" : "definedRatio";
    const other = rows.slice().sort(function (a, b) {
      if (a[otherKey] !== b[otherKey]) return b[otherKey] - a[otherKey];
      return a.name.localeCompare(b.name);
    })[0];
    const leads = rows.reduce(function (sum, row) { return sum + row.leads; }, 0);
    const completed = rows.reduce(function (sum, row) { return sum + row.completed; }, 0);
    const looseHits = rows.reduce(function (sum, row) { return sum + row.loose; }, 0);
    answer.metrics = [metricById("conversion")];
    answer.looseReading = "Leads whose status is anything other than lost, divided by leads. Quotes and cancelled bookings count.";
    answer.headline = mode === "defined"
      ? winner.name + ", at " + formatPct(winner.definedRatio) + " (" + formatCount(winner.completed) + " of " + formatCount(winner.leads) + " leads became a completed job)."
      : winner.name + ", at " + formatPct(winner.looseRatio) + " (" + formatCount(winner.loose) + " of " + formatCount(winner.leads) + " leads are anything but lost).";
    answer.lede = mode === "defined"
      ? "A conversion is a lead with a completed job. The rate is that count divided by the campaign's leads."
      : "This reading treats every lead that is not marked lost as a conversion, including quotes and cancelled bookings.";
    answer.contrast = mode === "defined"
      ? "The loose reading ranks " + other.name + " first, at " + formatPct(other.looseRatio) + "."
      : "Completed jobs rank " + other.name + " first, at " + formatPct(other.definedRatio) + ".";
    answer.sql = mode === "defined"
      ? [
        "-- metric: conversion",
        "SELECT campaigns.name,",
        "       COUNT(leads.id) AS leads,",
        "       COUNT(leads.completed_job_id) AS completed_jobs,",
        "       COUNT(leads.completed_job_id) * 1.0 / COUNT(leads.id) AS conversion",
        "FROM campaigns",
        "LEFT JOIN leads ON leads.campaign_id = campaigns.id",
        "GROUP BY campaigns.id",
        "ORDER BY conversion DESC;",
      ].join("\n")
      : [
        "-- no metric. \"conversion\" read as not lost",
        "SELECT campaigns.name,",
        "       COUNT(leads.id) AS leads,",
        "       SUM(CASE WHEN leads.status <> 'lost' THEN 1 ELSE 0 END) AS not_lost,",
        "       SUM(CASE WHEN leads.status <> 'lost' THEN 1 ELSE 0 END) * 1.0 / COUNT(leads.id) AS loose_rate",
        "FROM campaigns",
        "LEFT JOIN leads ON leads.campaign_id = campaigns.id",
        "GROUP BY campaigns.id",
        "ORDER BY loose_rate DESC;",
      ].join("\n");
    answer.columns = [
      { key: "name", label: "Campaign" },
      { key: "leads", label: "Leads", numeric: true },
      { key: "completed", label: "Completed jobs", numeric: true },
      { key: "rate", label: mode === "defined" ? "Conversion" : "Not-lost rate", numeric: true },
    ];
    answer.rows = ranked.map(function (row) {
      return {
        emphasize: row.id === winner.id,
        cells: {
          name: row.name,
          leads: formatCount(row.leads),
          completed: formatCount(row.completed),
          rate: formatPct(mode === "defined" ? row.definedRatio : row.looseRatio),
        },
      };
    });
    answer.chart = {
      caption: mode === "defined" ? "Conversion by campaign." : "Share of leads that are not marked lost, by campaign.",
      note: "Bar length is the rate in this mode.",
      series: ranked.map(function (row) {
        const ratio = mode === "defined" ? row.definedRatio : row.looseRatio;
        return { label: row.shortName, value: ratio, display: formatPct(ratio), emphasize: row.id === winner.id };
      }),
    };
    answer.sample = formatCount(leads) + " leads. " + formatCount(completed) + " have a completed job. " + formatCount(looseHits) + " are anything but lost.";
    answer.caveats = [
      "Across all campaigns the defined rate is " + formatPct(completed / leads) + " (" + formatCount(completed) + " of " + formatCount(leads) + "). The loose rate is " + formatPct(looseHits / leads) + " (" + formatCount(looseHits) + " of " + formatCount(leads) + ").",
      "A quote has no job id. A cancelled booking has a job id and no completed job. Neither is a conversion.",
      "The rate uses each campaign's own leads. It does not weight campaigns by spend.",
      "The file holds every lead. There is no holdout set.",
    ];
    answer.raw = { winnerId: winner.id, otherWinnerId: other.id, completed: completed, leads: leads, looseHits: looseHits };
    return answer;
  }

  function crewAnswer(data, mode, questionText) {
    const answer = answerShell(data, "crew-utilization", mode, questionText);
    const rows = crewUtilization(data);
    const ratioKey = mode === "defined" ? "definedRatio" : "looseRatio";
    const ranked = rows.slice().sort(function (a, b) {
      if (a[ratioKey] !== b[ratioKey]) return b[ratioKey] - a[ratioKey];
      return a.id.localeCompare(b.id);
    });
    const winner = ranked[0];
    const other = rows.slice().sort(function (a, b) {
      const key = mode === "defined" ? "looseRatio" : "definedRatio";
      if (a[key] !== b[key]) return b[key] - a[key];
      return a.id.localeCompare(b.id);
    })[0];
    answer.metrics = [metricById("crew_utilization"), metricById("last_quarter"), metricById("completed_job")];
    answer.looseReading = "Every labor_minutes on a job scheduled last quarter, divided by 40 hours times 13 weeks. The crew's own capacity is ignored, and cancelled hours are added.";
    answer.headline = mode === "defined"
      ? winner.id + ", at " + formatPct(winner.definedRatio) + " of its scheduled hours."
      : winner.id + ", at " + formatPct(winner.looseRatio) + " of a 40-hour, 13-week quarter.";
    answer.lede = mode === "defined"
      ? "Utilization is completed labor hours divided by the hours stored on that crew for last quarter."
      : "This reading gives every crew the same 520-hour quarter and counts hour estimates on cancelled jobs.";
    answer.contrast = mode === "defined"
      ? "Against a flat 520-hour quarter, " + other.id + " ranks first, at " + formatPct(other.looseRatio) + "."
      : "Against each crew's own schedule, " + other.id + " ranks first, at " + formatPct(other.definedRatio) + ".";
    answer.sql = mode === "defined"
      ? [
        "-- metric: crew_utilization, completed_job, last_quarter",
        "SELECT crews.id,",
        "       SUM(CASE WHEN jobs.status = 'completed' THEN jobs.labor_minutes ELSE 0 END) AS completed_minutes,",
        "       crews.capacity_minutes,",
        "       SUM(CASE WHEN jobs.status = 'completed' THEN jobs.labor_minutes ELSE 0 END) * 1.0",
        "         / crews.capacity_minutes AS utilization",
        "FROM crews",
        "LEFT JOIN jobs",
        "  ON jobs.crew = crews.id",
        " AND jobs.scheduled_on BETWEEN '2026-07-01' AND '2026-09-30'",
        "GROUP BY crews.id",
        "ORDER BY utilization DESC;",
      ].join("\n")
      : [
        "-- no metric. \"utilization\" read as all hours / (40 * 13)",
        "SELECT crews.id,",
        "       SUM(jobs.labor_minutes) AS all_minutes,",
        "       40 * 13 * 60 AS assumed_minutes,",
        "       SUM(jobs.labor_minutes) * 1.0 / (40 * 13 * 60) AS loose_utilization",
        "FROM crews",
        "LEFT JOIN jobs",
        "  ON jobs.crew = crews.id",
        " AND jobs.scheduled_on BETWEEN '2026-07-01' AND '2026-09-30'",
        "GROUP BY crews.id",
        "ORDER BY loose_utilization DESC;",
      ].join("\n");
    answer.columns = mode === "defined"
      ? [
        { key: "crew", label: "Crew" },
        { key: "completed", label: "Completed hours", numeric: true },
        { key: "capacity", label: "Scheduled hours", numeric: true },
        { key: "rate", label: "Utilization", numeric: true },
      ]
      : [
        { key: "crew", label: "Crew" },
        { key: "all", label: "All job hours", numeric: true },
        { key: "assumed", label: "Assumed hours", numeric: true },
        { key: "rate", label: "Utilization", numeric: true },
      ];
    answer.rows = ranked.map(function (row) {
      if (mode === "defined") {
        return {
          emphasize: row.id === winner.id,
          cells: {
            crew: row.id,
            completed: formatHours(row.completedMinutes),
            capacity: formatHours(row.capacityMinutes),
            rate: formatPct(row.definedRatio),
          },
        };
      }
      return {
        emphasize: row.id === winner.id,
        cells: {
          crew: row.id,
          all: formatHours(row.allMinutes),
          assumed: formatHours(row.looseCapacityMinutes),
          rate: formatPct(row.looseRatio),
        },
      };
    });
    answer.chart = {
      caption: mode === "defined"
        ? "Crew utilization against each crew's scheduled hours."
        : "Crew utilization against a flat 520-hour quarter.",
      note: "Bar length is utilization. A bar can pass the others without passing 100 percent.",
      series: ranked.map(function (row) {
        const ratio = mode === "defined" ? row.definedRatio : row.looseRatio;
        return { label: row.id, value: ratio, display: formatPct(ratio), emphasize: row.id === winner.id };
      }),
    };
    const cancelledHours = rows.reduce(function (sum, row) { return sum + row.cancelledMinutes; }, 0);
    answer.sample = "6 crews. Last quarter is Jul 1 through Sep 30, 2026. Cancelled jobs in that window carry " + formatHours(cancelledHours) + " hours of estimates.";
    answer.caveats = [
      "Scheduled hours are the capacity_minutes field on the crew. They are not a guessed 40-hour week. Sycamore is scheduled for " + formatHours(rows.filter(function (row) { return row.id === "Sycamore"; })[0].capacityMinutes) + " hours.",
      "Hickory's cancelled plantings contribute " + formatHours(rows.filter(function (row) { return row.id === "Hickory"; })[0].cancelledMinutes) + " hours of estimates. Those hours were not worked. The loose reading still adds them.",
      "The loose denominator is " + formatCount(LOOSE_WEEK_HOURS) + " hours times " + formatCount(LOOSE_WEEKS) + " weeks, the same number for every crew.",
      "Over 100 percent means completed labor ran past the hours stored for that crew. It is not a forecast.",
    ];
    answer.raw = { winnerId: winner.id, otherWinnerId: other.id };
    return answer;
  }

  function runQuestion(data, id, mode, questionText) {
    if (!id) return unknownAnswer(questionText || "");
    if (mode !== "defined" && mode !== "loose") mode = "defined";
    if (id === "cheapest-campaign") return cheapestAnswer(data, mode, questionText);
    if (id === "revenue-neighborhood") return revenueAnswer(data, mode, questionText);
    if (id === "repeat-rate") return repeatAnswer(data, mode, questionText);
    if (id === "customer-count") return customerAnswer(data, mode, questionText);
    if (id === "gross-net") return grossNetAnswer(data, mode, questionText);
    if (id === "conversion") return conversionAnswer(data, mode, questionText);
    if (id === "crew-utilization") return crewAnswer(data, mode, questionText);
    return unknownAnswer(questionText || "");
  }

  function ask(data, text, mode) {
    const id = matchQuestion(text);
    if (!id) return unknownAnswer(text);
    return runQuestion(data, id, mode, text);
  }

  function contrast(data) {
    const definedCustomers = definedCustomerIds(data).size;
    const loose = loosePopulation(data);
    const totals = quarterTotals(data);
    const leads = data.leads.length;
    const converted = data.leads.filter(function (lead) { return !!lead.completed_job_id; }).length;
    const notLost = data.leads.filter(function (lead) { return lead.status !== "lost"; }).length;
    return {
      customer: {
        term: "Customer",
        defined: { value: formatCount(definedCustomers), detail: "Completed job this season" },
        loose: { value: formatCount(loose.total), detail: "File rows plus unattached leads" },
      },
      conversion: {
        term: "Conversion",
        defined: { value: formatPct(converted / leads), detail: formatCount(converted) + " of " + formatCount(leads) + " leads completed a job" },
        loose: { value: formatPct(notLost / leads), detail: formatCount(notLost) + " of " + formatCount(leads) + " leads are not marked lost" },
      },
      revenue: {
        term: "Revenue",
        defined: { value: formatMoney(totals.netCents), detail: "Net on completed jobs, last quarter" },
        loose: { value: formatMoney(totals.looseGrossCents), detail: "Gross on every job row, last quarter" },
      },
    };
  }

  globalThis.RedbudMetrics = {
    METRICS: METRICS,
    QUESTIONS: QUESTIONS,
    ROLES: ROLES,
    QUARTER: QUARTER,
    SEASON: SEASON,
    metricById: metricById,
    matchQuestion: matchQuestion,
    runQuestion: runQuestion,
    ask: ask,
    contrast: contrast,
    campaignCosts: campaignCosts,
    neighborhoodRevenue: neighborhoodRevenue,
    quarterTotals: quarterTotals,
    crewUtilization: crewUtilization,
    conversionByCampaign: conversionByCampaign,
    definedCustomerIds: definedCustomerIds,
    repeatCustomerIds: repeatCustomerIds,
    loosePopulation: loosePopulation,
    formatMoney: formatMoney,
    formatPct: formatPct,
  };
})();
