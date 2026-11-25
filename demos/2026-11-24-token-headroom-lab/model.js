// Illustrative simulation of ideas from Headroom's README and docs.
// Juniper Hill Inn, every guest, and every log line were written for this page.
// This is not Headroom's code, and the token estimates are not its benchmarks.
// https://github.com/headroomlabs-ai/headroom
(function () {
  "use strict";

  var FAILURE = "channel still holds walk-in hold WH-9-441, so the Harper party booking was not written";
  var MODE_SHARE = 0.9;
  var EXAMPLE_PRICE_PER_MILLION = 3;

  var ROOMS = [
    [1, "Cedar"],
    [2, "Maple"],
    [3, "Birch"],
    [4, "Alder"],
    [5, "Pine"],
    [6, "Hemlock"],
    [7, "Willow"],
    [8, "Aspen"],
    [9, "Spruce"],
    [10, "Lark"],
    [11, "Finch"],
    [12, "Wren"],
    [13, "Heron"],
    [14, "Owl"]
  ];

  var NIGHTS = [
    "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30",
    "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06", "2026-12-07",
    "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12", "2026-12-13"
  ];

  var EMAIL = [
    "From: morgan.hale.example@guest.invalid",
    "To: desk@juniperhill.example",
    "Subject: Arriving after the door code expires",
    "",
    "Hello,",
    "",
    "We have the Maple room, room 2, on Friday 27 November 2026. The train gets in late, so we should reach the inn around 9:40pm. The front-door code in the confirmation stops working at 9pm. Could you leave the side door unlatched, or send a night code to the phone number already on the reservation?",
    "",
    "Pip, our small dog, is already on the pet form. We booked Maple so we would not share a wall with the kitchen. Please keep that room if you can.",
    "",
    "Thank you,",
    "Morgan Hale"
  ].join("\n");

  var NEEDLES = {
    reservations: ["WH-9-441", "Harper party", "failed"],
    log: ["WH-9-441", "Harper party", "result=failed"],
    email: ["9:40pm", "side door", "9pm"]
  };

  var INPUTS = [
    {
      id: "reservations",
      label: "Reservation JSON",
      detail: "280 repetitive room-nights",
      question: "Which room failed to sync, and why?",
      truth: "Room 9, Spruce, on Thursday 26 November 2026. The channel still holds walk-in hold WH-9-441, so the Harper party booking was not written."
    },
    {
      id: "log",
      label: "Sync log",
      detail: "280 near-identical lines, one error",
      question: "Why did room 9's booking fail to sync?",
      truth: "The channel still holds walk-in hold WH-9-441, so the Harper party booking was not written."
    },
    {
      id: "email",
      label: "Guest email",
      detail: "Prose, one letter",
      question: "What time is the Hale party arriving, and what do they need after 9pm?",
      truth: "Around 9:40pm. The front-door code stops at 9pm, so they need the side door unlatched or a night code."
    }
  ];

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function show(value) {
    return value === "" ? "(blank)" : String(value);
  }

  function reservationRows() {
    var rows = [];
    NIGHTS.forEach(function (night) {
      ROOMS.forEach(function (room) {
        var failed = room[0] === 9 && night === "2026-11-26";
        rows.push({
          property_id: "juniper-hill-inn",
          property_name: "Juniper Hill Inn",
          timezone: "America/Denver",
          channel: "direct",
          source_system: "innkeeper-sync",
          board: "breakfast",
          room_count: 14,
          night: night,
          room: room[0],
          room_name: room[1],
          party: failed ? "Harper party" : "unnamed",
          status: failed ? "conflict" : "confirmed",
          sync_state: failed ? "failed" : "ok",
          note: failed ? FAILURE : ""
        });
      });
    });
    return rows;
  }

  function stamp(index) {
    var total = index * 3;
    var seconds = total % 60;
    var minutes = 14 + Math.floor(total / 60);
    var hours = 6 + Math.floor(minutes / 60);
    minutes = minutes % 60;
    return "2026-11-24T" + pad(hours) + ":" + pad(minutes) + ":" + pad(seconds) + "Z";
  }

  function logLines() {
    var lines = [];
    var index = 0;
    NIGHTS.forEach(function (night, dayIndex) {
      ROOMS.forEach(function (room) {
        var failed = room[0] === 9 && night === "2026-11-26";
        if (failed) {
          lines.push(
            stamp(index) +
            " ERROR innkeeper-sync room=9 night=2026-11-26 result=failed reason=\"" +
            FAILURE +
            "\""
          );
        } else {
          var elapsed = 11 + ((room[0] + dayIndex) % 5);
          lines.push(
            stamp(index) +
            " INFO innkeeper-sync room=" + room[0] +
            " night=" + night +
            " result=ok elapsed_ms=" + elapsed
          );
        }
        index += 1;
      });
    });
    return lines;
  }

  function originalText(id) {
    if (id === "reservations") return JSON.stringify(reservationRows(), null, 2);
    if (id === "log") return logLines().join("\n");
    if (id === "email") return EMAIL;
    return "";
  }

  function estimateTokens(text) {
    var chars = String(text == null ? "" : text).length;
    return Math.ceil(chars / 4);
  }

  function savedPercent(beforeTokens, afterTokens) {
    if (beforeTokens <= 0) return 0;
    return Math.round(((beforeTokens - afterTokens) / beforeTokens) * 1000) / 10;
  }

  function costPerThousandCalls(tokens, pricePerMillion) {
    if (pricePerMillion === "" || pricePerMillion == null) return null;
    var price = Number(pricePerMillion);
    if (!isFinite(price) || price < 0) return null;
    return (tokens * price) / 1000;
  }

  function costs(tokensBefore, tokensAfter, pricePerMillion) {
    var before = costPerThousandCalls(tokensBefore, pricePerMillion);
    var after = costPerThousandCalls(tokensAfter, pricePerMillion);
    if (before == null || after == null) return null;
    return { before: before, after: after, difference: before - after };
  }

  function hasAnswer(id, text) {
    return NEEDLES[id].every(function (needle) {
      return String(text).indexOf(needle) !== -1;
    });
  }

  function countsFor(rows, key) {
    var counts = {};
    rows.forEach(function (row) {
      var label = show(row[key]);
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }

  function formatCounts(counts) {
    return Object.keys(counts).sort(function (a, b) {
      if (counts[b] !== counts[a]) return counts[b] - counts[a];
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    }).map(function (label) {
      return label + " \u00d7 " + counts[label];
    }).join(", ");
  }

  function splitFields(rows) {
    var keys = Object.keys(rows[0]);
    var constants = {};
    var constantKeys = [];
    var varying = [];
    keys.forEach(function (key) {
      var first = rows[0][key];
      var same = rows.every(function (row) { return row[key] === first; });
      if (same) {
        constants[key] = first;
        constantKeys.push(key);
      } else {
        varying.push(key);
      }
    });
    return { constants: constants, constantKeys: constantKeys, varying: varying };
  }

  function anomalyRows(rows) {
    var keys = Object.keys(rows[0]);
    var modes = {};
    keys.forEach(function (key) {
      var counts = {};
      rows.forEach(function (row) {
        var label = String(row[key]);
        counts[label] = (counts[label] || 0) + 1;
      });
      var best = null;
      var bestN = -1;
      Object.keys(counts).forEach(function (label) {
        if (counts[label] > bestN) {
          best = label;
          bestN = counts[label];
        }
      });
      if (bestN / rows.length >= MODE_SHARE) modes[key] = best;
    });
    return rows.filter(function (row) {
      return Object.keys(modes).some(function (key) {
        return String(row[key]) !== modes[key];
      });
    });
  }

  function project(row, keys) {
    var out = {};
    keys.forEach(function (key) { out[key] = row[key]; });
    return out;
  }

  function roomDirectory() {
    return ROOMS.map(function (room) { return room[0] + " " + room[1]; }).join(", ");
  }

  function statLines(rows, keys) {
    var lines = [];
    keys.forEach(function (key) {
      var counts = countsFor(rows, key);
      var distinct = Object.keys(counts).length;
      if (distinct <= 4) {
        lines.push("  " + key + ": " + formatCounts(counts));
      } else if (key === "night") {
        lines.push("  night: " + rows[0].night + " \u2026 " + rows[rows.length - 1].night + " (" + distinct + " nights)");
      } else if (key === "room") {
        var nums = rows.map(function (row) { return row.room; });
        lines.push("  room: " + Math.min.apply(null, nums) + "\u2013" + Math.max.apply(null, nums));
      } else {
        lines.push("  " + key + ": " + distinct + " distinct values");
      }
    });
    return lines;
  }

  function jsonAfter(aggressive) {
    var rows = reservationRows();
    var anomalies = anomalyRows(rows);
    var shown = rows;
    var displayCount = rows.length;
    var keptAnomalies = anomalies;
    if (aggressive) {
      shown = rows.filter(function (row) { return anomalies.indexOf(row) === -1; });
      keptAnomalies = [];
    }
    var fields = splitFields(shown);
    var lines = [];
    lines.push("json_array: constants written once, then a schema, stats, and sample rows");
    lines.push("rows: " + displayCount);
    lines.push("constants_written_once:");
    fields.constantKeys.forEach(function (key) {
      lines.push("  " + key + ": " + show(fields.constants[key]));
    });
    lines.push("schema: " + fields.varying.join(", "));
    lines.push("room_directory: " + roomDirectory());
    lines.push("stats:");
    statLines(shown, fields.varying).forEach(function (line) { lines.push(line); });
    if (aggressive) lines.push("read_as: every row has sync_state ok");
    lines.push("sample_rows:");
    lines.push("  first: " + JSON.stringify(project(shown[0], fields.varying)));
    lines.push("  last: " + JSON.stringify(project(shown[shown.length - 1], fields.varying)));
    keptAnomalies.forEach(function (row) {
      lines.push("  anomaly: " + JSON.stringify(project(row, fields.varying)));
    });
    if (!aggressive) {
      lines.push("[" + rows.length + " rows compressed to sample rows. Original stored locally. Retrieve: jh-reservations]");
    }
    return lines.join("\n");
  }

  function elapsedRange(lines) {
    var values = [];
    lines.forEach(function (line) {
      var match = /elapsed_ms=(\d+)/.exec(line);
      if (match) values.push(Number(match[1]));
    });
    return Math.min.apply(null, values) + "\u2013" + Math.max.apply(null, values);
  }

  function logAfter(aggressive) {
    var lines = logLines();
    var errors = lines.filter(function (line) { return line.indexOf(" ERROR ") !== -1; });
    var infos = lines.filter(function (line) { return line.indexOf(" result=ok ") !== -1; });
    var out = [];
    out.push("log: repeated ok lines collapsed to a count");
    out.push("lines: " + lines.length);
    out.push("repeated: INFO innkeeper-sync result=ok \u00d7 " + (aggressive ? lines.length : infos.length));
    out.push("elapsed_ms: " + elapsedRange(infos));
    out.push("nights: " + NIGHTS[0] + " \u2026 " + NIGHTS[NIGHTS.length - 1]);
    out.push("rooms: 1\u201314");
    if (aggressive) {
      out.push("read_as: every line is an ok sync");
    } else {
      out.push("kept_errors:");
      errors.forEach(function (line) { out.push("  " + line); });
      out.push("[" + lines.length + " lines compressed. Original stored locally. Retrieve: jh-sync-log]");
    }
    return out.join("\n");
  }

  function technique(id, aggressive, kept) {
    if (id === "email") {
      return "No repeated rows or log lines. The toy copies the email through unchanged, in the spirit of Headroom leaving short prose alone.";
    }
    if (id === "reservations" && !aggressive) {
      return "Fields that are the same on every row are written once and left off the rows. The schema is the keys that still vary. Stats count those keys. The sample keeps the first row, the last row, and the one row that breaks a field that is otherwise at least 90% one value. A retrieve marker stands in for a local original.";
    }
    if (id === "reservations" && aggressive) {
      return "The one non-modal row was deleted first. The failure fields then look constant, so they are written once as ok, and the row count still says 280. The sample is only the first and last rows. No retrieve marker.";
    }
    if (id === "log" && !aggressive) {
      return "Every INFO line with result=ok becomes one count, plus the elapsed range. The ERROR line is copied whole. A retrieve marker stands in for a local original of all 280 lines.";
    }
    return "The ERROR line was deleted, and the ok count was written as 280. No retrieve marker.";
  }

  function verdict(id, aggressive, kept) {
    if (id === "email") {
      return {
        title: "The answer is still in the compressed context.",
        body: "The characters did not change, so the estimated savings are 0%. Headroom's README claims prose compresses little. Aggressive mode finds nothing repeated to drop."
      };
    }
    if (kept) {
      return {
        title: "The answer is still in the compressed context.",
        body: id === "log"
          ? "The repeated ok lines are one count. The ERROR line for room 9 is still in the text, including hold WH-9-441. The retrieve marker stands in for Headroom's CCR store: the original log stays on the machine, and a later retrieve could load it."
          : "Room 9, Spruce, on 2026-11-26 is still in the sample, with sync_state failed and hold WH-9-441. The retrieve marker stands in for Headroom's CCR store, so the full 280 rows could be loaded back from the machine."
      };
    }
    return {
      title: "The answer is gone. The agent would be wrong.",
      body: id === "log"
        ? "Aggressive mode deleted the one ERROR line and counted it as another ok sync. The text says all 280 lines succeeded. Hold WH-9-441 is not in that text, and nothing points at a local original. Headroom's README describes the other choice: keep the error, and keep the original retrievable."
        : "Aggressive mode deleted the conflict row, then summarized the rest as if all 280 room-nights had sync_state ok. Hold WH-9-441 is not in that text, and nothing points at a local original. Headroom's README describes the other choice: keep the anomaly, and keep the original retrievable."
    };
  }

  function agentAnswer(id, kept) {
    if (id === "email") {
      return "The Hale party arrives around 9:40pm. The front-door code stops at 9pm, so they need the side door unlatched or a night code.";
    }
    if (kept && id === "reservations") {
      return "Room 9, Spruce, failed on 2026-11-26. The channel still holds walk-in hold WH-9-441, so the Harper party booking was not written.";
    }
    if (kept && id === "log") {
      return "Room 9 failed because the channel still holds walk-in hold WH-9-441, so the Harper party booking was not written.";
    }
    if (id === "log") return "Room 9 did not fail. Every line in this log is an ok sync.";
    return "Nothing failed. All 280 room-nights show sync_state ok.";
  }

  function inputById(id) {
    for (var i = 0; i < INPUTS.length; i += 1) {
      if (INPUTS[i].id === id) return INPUTS[i];
    }
    return INPUTS[0];
  }

  function run(id, options) {
    var aggressive = !!(options && options.aggressive);
    var input = inputById(id);
    var before = originalText(input.id);
    var after = input.id === "reservations" ? jsonAfter(aggressive) : input.id === "log" ? logAfter(aggressive) : before;
    var tokensBefore = estimateTokens(before);
    var tokensAfter = estimateTokens(after);
    var kept = hasAnswer(input.id, after);
    var words = verdict(input.id, aggressive, kept);
    return {
      id: input.id,
      label: input.label,
      detail: input.detail,
      question: input.question,
      truth: input.truth,
      aggressive: aggressive,
      before: before,
      after: after,
      tokensBefore: tokensBefore,
      tokensAfter: tokensAfter,
      savedTokens: tokensBefore - tokensAfter,
      savedPercent: savedPercent(tokensBefore, tokensAfter),
      answerKept: kept,
      agentAnswer: agentAnswer(input.id, kept),
      verdictTitle: words.title,
      verdictBody: words.body,
      technique: technique(input.id, aggressive, kept),
      hasMarker: after.indexOf("Original stored locally") !== -1
    };
  }

  globalThis.HeadroomLab = {
    EXAMPLE_PRICE_PER_MILLION: EXAMPLE_PRICE_PER_MILLION,
    FAILURE: FAILURE,
    ROOMS: ROOMS,
    NIGHTS: NIGHTS,
    INPUTS: INPUTS,
    reservationRows: reservationRows,
    logLines: logLines,
    originalText: originalText,
    estimateTokens: estimateTokens,
    savedPercent: savedPercent,
    costPerThousandCalls: costPerThousandCalls,
    costs: costs,
    hasAnswer: hasAnswer,
    run: run
  };
})();
