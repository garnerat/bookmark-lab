// Illustrative CI run for a fictional shop repo.
// Slice sizes follow Owen Gretzinger's Boardy write-up in shape, not as a copy of their logs.
// Waiting up to 11:00, lint 2:00 to 5s, tsc 70s to bun check 5s, an 8:00 test target to a 35s shard.
// Build time is a stand-in so the critical path stays visible. The all-on run lands just under 2:00.
(function () {
  const RUNNER_WAIT = 8;
  const LOCAL_HOOK = 9;
  const RED_ROUNDS = 2;
  const BASELINE = 2400;

  const JOBS = [
    { id: "lint", name: "Lint", wait: 270, setup: 40, warm: 14, run: 120 },
    { id: "typecheck", name: "Typecheck", wait: 250, setup: 35, warm: 12, run: 70 },
    { id: "build", name: "Build", wait: 215, setup: 40, warm: 14, run: 130 },
    { id: "tests", name: "Tests", wait: 660, setup: 90, warm: 30, run: 480 },
  ];

  const FLAGS = ["runners", "oxlint", "types", "shards", "cache", "parallel", "affected", "hook"];

  function blankFlags() {
    return {
      runners: false,
      oxlint: false,
      types: false,
      shards: false,
      cache: false,
      parallel: false,
      affected: false,
      hook: false,
    };
  }

  function normalize(flags) {
    const on = blankFlags();
    FLAGS.forEach((key) => {
      on[key] = Boolean(flags && flags[key]);
    });
    return on;
  }

  function runSeconds(id, flags) {
    if (id === "lint") return flags.oxlint ? 5 : 120;
    if (id === "typecheck") return flags.types ? 5 : 70;
    if (id === "build") return flags.affected ? 95 : 130;
    if (flags.affected && flags.shards) return 12;
    if (flags.affected) return 160;
    if (flags.shards) return 35;
    return 480;
  }

  function detail(id, flags) {
    if (id === "lint") return flags.oxlint ? "Oxlint, about 5s" : "ESLint, about 2:00";
    if (id === "typecheck") return flags.types ? "bun check, about 5s" : "tsc, about 70s";
    if (id === "build") {
      return flags.affected ? "Scheduling app only" : "Scheduling, dispatch, and billing";
    }
    if (flags.affected && flags.shards) return "Scheduling tests on one warm shard";
    if (flags.shards) return "Bigger shard, Vitest isolate:false";
    if (flags.affected) return "Scheduling package only";
    return "One 8:00 target, fresh worker per file";
  }

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 90) return s + "s";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + String(r).padStart(2, "0");
}

  function scenario(flags) {
    const on = normalize(flags);
    const jobs = JOBS.map((job) => {
      const wait = on.runners ? RUNNER_WAIT : job.wait;
      const setup = on.cache ? job.warm : job.setup;
      const run = runSeconds(job.id, on);
      return {
        id: job.id,
        name: job.name,
        detail: detail(job.id, on),
        wait,
        setup,
        run,
        total: wait + setup + run,
      };
    });

    const sumWall = jobs.reduce((sum, job) => sum + job.total, 0);
    const critical = jobs.reduce((best, job) => (job.total > best.total ? job : best), jobs[0]);
    const runWall = on.parallel ? critical.total : sumWall;
    const counted = on.parallel
      ? { wait: critical.wait, setup: critical.setup, run: critical.run }
      : jobs.reduce(
          (sum, job) => ({
            wait: sum.wait + job.wait,
            setup: sum.setup + job.setup,
            run: sum.run + job.run,
          }),
          { wait: 0, setup: 0, run: 0 },
        );
    const rounds = on.hook ? 1 : RED_ROUNDS;
    const untilGreen = runWall * rounds;

    return {
      flags: on,
      jobs,
      sumWall,
      runWall,
      counted,
      criticalId: critical.id,
      rounds,
      untilGreen,
      localHook: on.hook ? LOCAL_HOOK : 0,
      baseline: BASELINE,
      saved: BASELINE - runWall,
    };
  }

  globalThis.CiWait = {
    RUNNER_WAIT,
    LOCAL_HOOK,
    RED_ROUNDS,
    BASELINE,
    JOBS,
    FLAGS,
    blankFlags,
    formatDuration,
    scenario,
  };
})();
