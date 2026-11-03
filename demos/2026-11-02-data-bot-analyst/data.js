// Fictional books for Redbud Lawn Co., a made-up lawn and landscape company in Oakley.
// Neighborhoods are Cincinnati place names used as labels. Crews are dispatcher codes.
// No household names, streets, phone numbers, or email addresses.
(function () {
  const COMPANY = "Redbud Lawn Co.";
  const NEIGHBORHOODS = [
    "Hyde Park",
    "Oakley",
    "Mount Lookout",
    "Clifton",
    "Northside",
    "Pleasant Ridge",
  ];

  const CREWS = [
    { id: "Cedar", capacity_minutes: 120 * 60, work: "Mow routes" },
    { id: "Maple", capacity_minutes: 110 * 60, work: "Mow routes" },
    { id: "Sycamore", capacity_minutes: 128 * 60, work: "Planting and mulch" },
    { id: "Birch", capacity_minutes: 100 * 60, work: "Planting and mulch" },
    { id: "Walnut", capacity_minutes: 96 * 60, work: "Mow and cleanup" },
    { id: "Hickory", capacity_minutes: 64 * 60, work: "Cleanup" },
  ];

  // Counts are the generator's recipe. The page sums jobs; it does not read these tallies.
  const CAMPAIGN_SPEC = [
    { id: "yard-sign", name: "Yard signs", short_name: "Yard signs", channel: "offline", spend_cents: 18000, start_on: "2026-04-15", end_on: "2026-10-31", completed: 10, booked: 2, cancelled: 0, quoted: 2, lost: 4 },
    { id: "community-board", name: "Oakley community board", short_name: "Community board", channel: "community", spend_cents: 36000, start_on: "2026-05-01", end_on: "2026-08-31", completed: 6, booked: 2, cancelled: 22, quoted: 8, lost: 4 },
    { id: "referral-card", name: "Referral card", short_name: "Referral card", channel: "referral", spend_cents: 24000, start_on: "2026-03-01", end_on: "2026-10-31", completed: 4, booked: 1, cancelled: 0, quoted: 1, lost: 6 },
    { id: "spring-mailer", name: "Spring postcard", short_name: "Spring postcard", channel: "mail", spend_cents: 84000, start_on: "2026-03-01", end_on: "2026-05-31", completed: 9, booked: 1, cancelled: 2, quoted: 4, lost: 8 },
    { id: "search-mow", name: "Search ads, mowing", short_name: "Search ads", channel: "search", spend_cents: 126000, start_on: "2026-04-01", end_on: "2026-10-15", completed: 9, booked: 5, cancelled: 4, quoted: 8, lost: 10 },
    { id: "social-fall", name: "Social ads, fall cleanup", short_name: "Social ads", channel: "social", spend_cents: 96000, start_on: "2026-09-01", end_on: "2026-10-31", completed: 3, booked: 3, cancelled: 2, quoted: 14, lost: 6 },
  ];

  const QUARTER = { start: "2026-07-01", end: "2026-09-30" };

  function addDays(iso, days) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  function datesOutsideQuarter(start, end, count) {
    const dates = [];
    for (let iso = start; iso <= end; iso = addDays(iso, 1)) {
      if (iso >= QUARTER.start && iso <= QUARTER.end) continue;
      dates.push(iso);
    }
    if (dates.length < count) {
      throw new Error("Not enough dates outside last quarter for " + start + ".." + end);
    }
    const picked = [];
    for (let i = 0; i < count; i++) {
      picked.push(dates[Math.floor((i * dates.length) / count)]);
    }
    return picked;
  }

  function build() {
    const customers = [];
    const jobs = [];
    const leads = [];
    let customerNum = 3001;
    let jobNum = 8001;
    let leadNum = 5001;
    let neighborhoodCursor = 0;

    function makeCustomer(neighborhood, fileStatus) {
      const customer = {
        id: "C-" + customerNum,
        neighborhood,
        file_status: fileStatus,
      };
      customerNum += 1;
      customers.push(customer);
      return customer;
    }

    function makeJob(fields) {
      const job = {
        id: "J-" + jobNum,
        customer_id: fields.customer_id,
        crew: fields.crew,
        neighborhood: fields.neighborhood,
        service: fields.service,
        status: fields.status,
        scheduled_on: fields.scheduled_on,
        completed_on: fields.completed_on,
        gross_cents: fields.gross_cents,
        discount_cents: fields.discount_cents,
        labor_minutes: fields.labor_minutes,
        booked_via: fields.booked_via,
      };
      jobNum += 1;
      jobs.push(job);
      return job;
    }

    function makeLead(fields) {
      leads.push({
        id: "L-" + leadNum,
        campaign_id: fields.campaign_id,
        status: fields.status,
        created_on: fields.created_on,
        neighborhood: fields.neighborhood,
        customer_id: fields.customer_id || null,
        job_id: fields.job_id || null,
        completed_job_id: fields.completed_job_id || null,
      });
      leadNum += 1;
    }

    CAMPAIGN_SPEC.forEach(function (spec) {
      const jobCount = spec.completed + spec.booked + spec.cancelled;
      const dates = datesOutsideQuarter(spec.start_on, spec.end_on, jobCount);
      const service = spec.id === "social-fall" ? "cleanup" : "mow";
      const gross = spec.id === "social-fall" ? 22000 : 8500;
      const minutes = spec.id === "social-fall" ? 180 : 75;
      const statuses = []
        .concat(Array(spec.completed).fill("completed"))
        .concat(Array(spec.booked).fill("booked"))
        .concat(Array(spec.cancelled).fill("cancelled"));
      statuses.forEach(function (status, index) {
        const neighborhood = NEIGHBORHOODS[neighborhoodCursor % NEIGHBORHOODS.length];
        neighborhoodCursor += 1;
        const fileStatus = status === "completed" ? "active" : status === "booked" ? "open" : "cancelled-only";
        const customer = makeCustomer(neighborhood, fileStatus);
        const scheduled = dates[index];
        const job = makeJob({
          customer_id: customer.id,
          crew: CREWS[index % CREWS.length].id,
          neighborhood,
          service,
          status,
          scheduled_on: scheduled,
          completed_on: status === "completed" ? scheduled : null,
          gross_cents: gross,
          discount_cents: 0,
          labor_minutes: minutes,
          booked_via: spec.id,
        });
        makeLead({
          campaign_id: spec.id,
          status: status === "booked" ? "booked" : status,
          created_on: scheduled,
          neighborhood,
          customer_id: customer.id,
          job_id: job.id,
          completed_job_id: status === "completed" ? job.id : null,
        });
      });
      const extraDates = datesOutsideQuarter(spec.start_on, spec.end_on, spec.quoted + spec.lost);
      for (let i = 0; i < spec.quoted; i++) {
        makeLead({
          campaign_id: spec.id,
          status: "quoted",
          created_on: extraDates[i],
          neighborhood: NEIGHBORHOODS[(neighborhoodCursor + i) % NEIGHBORHOODS.length],
        });
      }
      for (let i = 0; i < spec.lost; i++) {
        makeLead({
          campaign_id: spec.id,
          status: "lost",
          created_on: extraDates[spec.quoted + i],
          neighborhood: NEIGHBORHOODS[(neighborhoodCursor + spec.quoted + i) % NEIGHBORHOODS.length],
        });
      }
    });

    // Weekly mow routes in last quarter. Each customer has more than one completed visit.
    const routes = [
      { neighborhood: "Oakley", crew: "Cedar", customers: 9, visits: 4, gross_cents: 8500, minutes: 90 },
      { neighborhood: "Oakley", crew: "Maple", customers: 6, visits: 4, gross_cents: 9000, minutes: 90 },
      { neighborhood: "Hyde Park", crew: "Cedar", customers: 5, visits: 4, gross_cents: 12000, minutes: 80 },
      { neighborhood: "Mount Lookout", crew: "Maple", customers: 7, visits: 4, gross_cents: 10000, minutes: 70 },
      { neighborhood: "Pleasant Ridge", crew: "Cedar", customers: 6, visits: 3, gross_cents: 8000, minutes: 60 },
      { neighborhood: "Clifton", crew: "Maple", customers: 8, visits: 2, gross_cents: 7500, minutes: 60 },
      { neighborhood: "Northside", crew: "Walnut", customers: 7, visits: 2, gross_cents: 7000, minutes: 50 },
    ];
    routes.forEach(function (route) {
      for (let c = 0; c < route.customers; c++) {
        const customer = makeCustomer(route.neighborhood, "active");
        for (let v = 0; v < route.visits; v++) {
          const day = addDays("2026-07-06", (c % 14) + v * 7);
          makeJob({
            customer_id: customer.id,
            crew: route.crew,
            neighborhood: route.neighborhood,
            service: "mow",
            status: "completed",
            scheduled_on: day,
            completed_on: day,
            gross_cents: route.gross_cents,
            discount_cents: 0,
            labor_minutes: route.minutes,
            booked_via: "route",
          });
        }
      }
    });

    // One completed landscape job per customer, still inside last quarter.
    const landscapes = [
      { neighborhood: "Oakley", crew: "Sycamore", service: "mulch", n: 14, gross_cents: 145000, discount_cents: 5000, minutes: 300 },
      { neighborhood: "Oakley", crew: "Birch", service: "planting", n: 6, gross_cents: 280000, discount_cents: 0, minutes: 360 },
      { neighborhood: "Hyde Park", crew: "Sycamore", service: "planting", n: 8, gross_cents: 260000, discount_cents: 20000, minutes: 330 },
      { neighborhood: "Hyde Park", crew: "Walnut", service: "cleanup", n: 10, gross_cents: 98000, discount_cents: 0, minutes: 210 },
      { neighborhood: "Mount Lookout", crew: "Birch", service: "mulch", n: 8, gross_cents: 160000, discount_cents: 10000, minutes: 280 },
      { neighborhood: "Mount Lookout", crew: "Walnut", service: "cleanup", n: 6, gross_cents: 90000, discount_cents: 0, minutes: 180 },
      { neighborhood: "Pleasant Ridge", crew: "Sycamore", service: "mulch", n: 6, gross_cents: 150000, discount_cents: 0, minutes: 240 },
      { neighborhood: "Pleasant Ridge", crew: "Hickory", service: "cleanup", n: 5, gross_cents: 76000, discount_cents: 0, minutes: 180 },
      { neighborhood: "Clifton", crew: "Birch", service: "planting", n: 4, gross_cents: 175000, discount_cents: 15000, minutes: 300 },
      { neighborhood: "Clifton", crew: "Walnut", service: "aeration", n: 8, gross_cents: 14000, discount_cents: 0, minutes: 90 },
      { neighborhood: "Northside", crew: "Hickory", service: "cleanup", n: 6, gross_cents: 82000, discount_cents: 0, minutes: 200 },
      { neighborhood: "Northside", crew: "Cedar", service: "mulch", n: 2, gross_cents: 110000, discount_cents: 0, minutes: 240 },
    ];
    let landscapeIndex = 0;
    landscapes.forEach(function (batch) {
      for (let i = 0; i < batch.n; i++) {
        const customer = makeCustomer(batch.neighborhood, "active");
        const day = addDays("2026-07-03", (landscapeIndex * 4) % 80);
        landscapeIndex += 1;
        makeJob({
          customer_id: customer.id,
          crew: batch.crew,
          neighborhood: batch.neighborhood,
          service: batch.service,
          status: "completed",
          scheduled_on: day,
          completed_on: day,
          gross_cents: batch.gross_cents,
          discount_cents: batch.discount_cents,
          labor_minutes: batch.minutes,
          booked_via: "walk-in",
        });
      }
    });

    // Cancelled plantings in Hyde Park. Hour estimates sit on the row and were not worked.
    // They are on Hickory so a loose hour total and a loose revenue total both move.
    for (let i = 0; i < 12; i++) {
      const customer = makeCustomer("Hyde Park", "cancelled-only");
      makeJob({
        customer_id: customer.id,
        crew: "Hickory",
        neighborhood: "Hyde Park",
        service: "planting",
        status: "cancelled",
        scheduled_on: addDays("2026-07-08", i * 5),
        completed_on: null,
        gross_cents: 240000,
        discount_cents: 0,
        labor_minutes: 600,
        booked_via: "walk-in",
      });
    }

    for (let i = 0; i < 40; i++) {
      makeCustomer(NEIGHBORHOODS[i % NEIGHBORHOODS.length], "prospect");
    }

    const campaigns = CAMPAIGN_SPEC.map(function (spec) {
      return {
        id: spec.id,
        name: spec.name,
        short_name: spec.short_name,
        channel: spec.channel,
        spend_cents: spec.spend_cents,
        start_on: spec.start_on,
        end_on: spec.end_on,
      };
    });

    const dataset = {
      company: COMPANY,
      today: "2026-11-02",
      neighborhoods: NEIGHBORHOODS.slice(),
      crews: CREWS.map(function (crew) { return Object.assign({}, crew); }),
      campaigns,
      customers,
      jobs,
      leads,
    };
    validate(dataset);
    return dataset;
  }

  function validate(data) {
    const customerIds = new Set();
    data.customers.forEach(function (customer) {
      if (customerIds.has(customer.id)) throw new Error("Duplicate customer " + customer.id);
      customerIds.add(customer.id);
    });
    const crewIds = new Set(data.crews.map(function (crew) { return crew.id; }));
    const campaignIds = new Set(data.campaigns.map(function (campaign) { return campaign.id; }));
    const jobIds = new Set();
    data.jobs.forEach(function (job) {
      if (jobIds.has(job.id)) throw new Error("Duplicate job " + job.id);
      jobIds.add(job.id);
      if (!customerIds.has(job.customer_id)) throw new Error("Job missing customer " + job.id);
      if (!crewIds.has(job.crew)) throw new Error("Job missing crew " + job.id);
      if (job.status === "completed" && !job.completed_on) throw new Error("Completed job has no date " + job.id);
      if (job.status !== "completed" && job.completed_on) throw new Error("Open job has a completed date " + job.id);
      if (job.discount_cents > job.gross_cents) throw new Error("Discount above gross " + job.id);
      if (job.booked_via !== "route" && job.booked_via !== "walk-in" && !campaignIds.has(job.booked_via)) {
        throw new Error("Unknown source " + job.booked_via);
      }
    });
    data.leads.forEach(function (lead) {
      if (!campaignIds.has(lead.campaign_id)) throw new Error("Lead missing campaign " + lead.id);
      if (lead.customer_id && !customerIds.has(lead.customer_id)) throw new Error("Lead missing customer " + lead.id);
      if (lead.completed_job_id && !jobIds.has(lead.completed_job_id)) throw new Error("Lead missing job " + lead.id);
    });
    data.campaigns.forEach(function (campaign) {
      data.jobs.filter(function (job) { return job.booked_via === campaign.id; }).forEach(function (job) {
        if (job.scheduled_on < campaign.start_on || job.scheduled_on > campaign.end_on) {
          throw new Error("Campaign job outside its flight " + job.id);
        }
        if (job.scheduled_on >= QUARTER.start && job.scheduled_on <= QUARTER.end) {
          throw new Error("Campaign job landed in last quarter " + job.id);
        }
      });
    });
    const blob = JSON.stringify(data);
    if (blob.indexOf("@") !== -1) throw new Error("Sample contains an @");
    if (/\d{3}-\d{3}-\d{4}/.test(blob)) throw new Error("Sample contains a phone-shaped number");
  }

  let cached;
  function dataset() {
    if (!cached) cached = build();
    return cached;
  }

  globalThis.RedbudData = {
    COMPANY: COMPANY,
    dataset: dataset,
  };
})();
