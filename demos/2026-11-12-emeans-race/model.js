// Educational re-implementation of the e-means update on a fictional 2D map.
// This is not FAISS. The batch and step use the quality-law coefficients
// shipped in FAISS 1.16 (contrib/e_means README). Those match the paper's
// Table 2 up to rounding. The powers were not refit for this page.
// Paper: https://arxiv.org/abs/2611.09501
// Code: https://github.com/facebookresearch/faiss/blob/main/contrib/e_means/base.py
(function () {
  const SHOP = {
    name: "Oakley Comfort Co.",
    place: "Oakley, Cincinnati",
    note: "Fictional shop, fictional calls. Not a real company and not real customers.",
  };

  const ZONES = [
    { name: "Oakley", x: 0.58, y: 0.55, sx: 0.09, sy: 0.07, weight: 1600 },
    { name: "Hyde Park", x: 0.42, y: 0.40, sx: 0.10, sy: 0.08, weight: 1400 },
    { name: "Madisonville", x: 0.74, y: 0.60, sx: 0.11, sy: 0.08, weight: 1200 },
    { name: "Norwood", x: 0.36, y: 0.68, sx: 0.10, sy: 0.09, weight: 1500 },
    { name: "Pleasant Ridge", x: 0.66, y: 0.78, sx: 0.08, sy: 0.07, weight: 800 },
    { name: "Mount Lookout", x: 0.52, y: 0.28, sx: 0.08, sy: 0.07, weight: 700 },
    { name: "Evanston", x: 0.28, y: 0.50, sx: 0.09, sy: 0.08, weight: 900 },
    { name: "Kennedy Heights", x: 0.80, y: 0.80, sx: 0.07, sy: 0.06, weight: 500 },
    { name: "O'Bryonville", x: 0.40, y: 0.30, sx: 0.06, sy: 0.05, weight: 400 },
    { name: "Columbia-Tusculum", x: 0.70, y: 0.22, sx: 0.07, sy: 0.06, weight: 500 },
  ];

  const DEFAULTS = {
    n: 8000,
    k: 8,
    epochs: 8,
    seed: 7,
    ema: true,
    cosine: true,
    revive: true,
    finalize: true,
  };

  // FAISS README equations (2) and (3): quality batch, then the step law.
  // Quality is the batch FAISS selects when d <= 16. This map is d = 2.
  const QUALITY_BATCH = [0.00439175, 0.134749, 0.876473, 0.813344];
  const ALPHA_LAW = [0.8244, -0.4617, 0.9003, -0.4498, -0.1057];
  const ALPHA_FLOOR = 0.1;
  const INIT_COUNT = 1e-10;
  const REVIVE_EVERY = 5;
  const REVIVE_TAU = 0.1;
  const SPLIT_DELTA = 1e-4;
  const SCATTER = 0.08;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(rng) {
    const u = Math.max(rng(), 1e-12);
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
  }

  function roundPowerOfTwo(value) {
    if (value <= 1) return 1;
    const low = 2 ** Math.floor(Math.log2(value));
    const high = low * 2;
    return value / low < high / value ? low : high;
  }

  function scalingLaw(n, k, epochs) {
    const batchCoef = QUALITY_BATCH[0];
    const rawBatch =
      batchCoef *
      k ** QUALITY_BATCH[1] *
      n ** QUALITY_BATCH[2] *
      epochs ** QUALITY_BATCH[3];
    let batchSize = roundPowerOfTwo(rawBatch);
    batchSize = Math.max(1, Math.min(batchSize, Math.floor(n / 2), n));
    const alphaRaw =
      ALPHA_LAW[0] *
      k ** ALPHA_LAW[1] *
      batchSize ** ALPHA_LAW[2] *
      n ** ALPHA_LAW[3] *
      epochs ** ALPHA_LAW[4];
    const alpha0 = Math.min(1, Math.max(1e-4, alphaRaw));
    return {
      name: "quality",
      rawBatch: rawBatch,
      batchSize: batchSize,
      alpha0: alpha0,
      alphaFloor: alpha0 * ALPHA_FLOOR,
    };
  }

  function scheduledAlpha(alpha0, step, totalSteps) {
    const fraction = Math.min(step, totalSteps) / Math.max(1, totalSteps);
    const cosine = 0.5 * (1 + Math.cos(Math.PI * fraction));
    return alpha0 * (ALPHA_FLOOR + (1 - ALPHA_FLOOR) * cosine);
  }

  function makeCalls(n, seed) {
    const rng = mulberry32(seed >>> 0);
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    let weightSum = 0;
    for (let i = 0; i < ZONES.length; i++) weightSum += ZONES[i].weight;
    const scatterN = Math.floor(n * SCATTER);
    for (let i = 0; i < n; i++) {
      if (i < scatterN) {
        x[i] = 0.05 + rng() * 0.9;
        y[i] = 0.05 + rng() * 0.9;
        continue;
      }
      let r = rng() * weightSum;
      let bi = 0;
      for (; bi < ZONES.length - 1; bi++) {
        r -= ZONES[bi].weight;
        if (r <= 0) break;
      }
      const zone = ZONES[bi];
      x[i] = clamp(zone.x + gauss(rng) * zone.sx, 0.02, 0.98);
      y[i] = clamp(zone.y + gauss(rng) * zone.sy, 0.02, 0.98);
    }
    return { x: x, y: y, n: n, scatterN: scatterN };
  }

  function sampleCentroids(x, y, n, k, rng) {
    const cx = new Float64Array(k);
    const cy = new Float64Array(k);
    const used = new Set();
    let j = 0;
    while (j < k) {
      const i = Math.floor(rng() * n);
      if (used.has(i)) continue;
      used.add(i);
      cx[j] = x[i];
      cy[j] = y[i];
      j += 1;
    }
    return { cx: cx, cy: cy };
  }

  function mse(x, y, n, cx, cy) {
    const k = cx.length;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const px = x[i];
      const py = y[i];
      let best = Infinity;
      for (let j = 0; j < k; j++) {
        const dx = px - cx[j];
        const dy = py - cy[j];
        const dist = dx * dx + dy * dy;
        if (dist < best) best = dist;
      }
      sum += best;
    }
    return sum / n;
  }

  function nearest(px, py, cx, cy) {
    let best = Infinity;
    let bj = 0;
    for (let j = 0; j < cx.length; j++) {
      const dx = px - cx[j];
      const dy = py - cy[j];
      const dist = dx * dx + dy * dy;
      if (dist < best) {
        best = dist;
        bj = j;
      }
    }
    return bj;
  }

  function lloydUpdate(x, y, n, cx, cy) {
    const k = cx.length;
    const sx = new Float64Array(k);
    const sy = new Float64Array(k);
    const count = new Float64Array(k);
    for (let i = 0; i < n; i++) {
      const j = nearest(x[i], y[i], cx, cy);
      sx[j] += x[i];
      sy[j] += y[i];
      count[j] += 1;
    }
    for (let j = 0; j < k; j++) {
      if (count[j] > 0) {
        cx[j] = sx[j] / count[j];
        cy[j] = sy[j] / count[j];
      }
    }
  }

  function shuffle(order, rng) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
  }

  function revive(cx, cy, sumX, sumY, count, rng) {
    const k = cx.length;
    let mean = 0;
    for (let j = 0; j < k; j++) mean += count[j];
    mean /= k;
    const dead = [];
    const pool = [];
    for (let j = 0; j < k; j++) {
      if (count[j] < REVIVE_TAU * mean) dead.push(j);
      else pool.push(j);
    }
    let splits = 0;
    for (let d = 0; d < dead.length; d++) {
      const target = dead[d];
      let total = 0;
      for (let p = 0; p < pool.length; p++) total += count[pool[p]];
      if (!(total > 0) || pool.length === 0) break;
      let r = rng() * total;
      let pick = pool.length - 1;
      for (let p = 0; p < pool.length; p++) {
        r -= count[pool[p]];
        if (r <= 0) {
          pick = p;
          break;
        }
      }
      const donor = pool[pick];
      pool.splice(pick, 1);
      const half = count[donor] / 2;
      const dox = cx[donor] * (1 - SPLIT_DELTA);
      const doy = cy[donor] * (1 + SPLIT_DELTA);
      const cdx = cx[donor] * (1 + SPLIT_DELTA);
      const cdy = cy[donor] * (1 - SPLIT_DELTA);
      count[donor] = half;
      count[target] = half;
      cx[donor] = dox;
      cy[donor] = doy;
      cx[target] = cdx;
      cy[target] = cdy;
      sumX[donor] = dox * half;
      sumY[donor] = doy * half;
      sumX[target] = cdx * half;
      sumY[target] = cdy * half;
      splits += 1;
    }
    return splits;
  }

  function createRace(options) {
    const n = options.n;
    const k = options.k;
    const epochs = options.epochs;
    const seed = options.seed >>> 0;
    const ema = options.ema !== false;
    const cosine = options.cosine !== false;
    const doRevive = options.revive !== false;
    const doFinalize = options.finalize !== false;
    const calls = options.points || makeCalls(n, seed);
    const x = calls.x;
    const y = calls.y;
    const law = scalingLaw(n, k, epochs);
    const batchSize = options.batchSize
      ? Math.max(1, Math.min(n, options.batchSize | 0))
      : law.batchSize;
    const alpha0 = options.alpha0 == null ? law.alpha0 : options.alpha0;
    const init = sampleCentroids(x, y, n, k, mulberry32(seed));
    const lloydX = Float64Array.from(init.cx);
    const lloydY = Float64Array.from(init.cy);
    const emaX = Float64Array.from(init.cx);
    const emaY = Float64Array.from(init.cy);
    const referenceX = Float64Array.from(init.cx);
    const referenceY = Float64Array.from(init.cy);
    for (let epoch = 0; epoch < 25; epoch++) lloydUpdate(x, y, n, referenceX, referenceY);
    const lloyd25 = mse(x, y, n, referenceX, referenceY);
    const count = new Float64Array(k);
    const sumX = new Float64Array(k);
    const sumY = new Float64Array(k);
    for (let j = 0; j < k; j++) {
      count[j] = INIT_COUNT;
      sumX[j] = INIT_COUNT * emaX[j];
      sumY[j] = INIT_COUNT * emaY[j];
    }
    const order = new Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    const stepsPerEpoch = Math.ceil(n / batchSize);
    const totalSteps = stepsPerEpoch * epochs;
    const startLoss = mse(x, y, n, lloydX, lloydY);
    const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);

    const race = {
      n: n,
      k: k,
      epochs: epochs,
      seed: seed,
      ema: ema,
      cosine: cosine,
      revive: doRevive,
      finalize: doFinalize,
      x: x,
      y: y,
      recipe: {
        name: options.batchSize ? "given" : law.name,
        batchSize: batchSize,
        alpha0: alpha0,
        alphaFloor: alpha0 * ALPHA_FLOOR,
        rawBatch: law.rawBatch,
        stepsPerEpoch: stepsPerEpoch,
      },
      lloydX: lloydX,
      lloydY: lloydY,
      emaX: emaX,
      emaY: emaY,
      lloyd25: lloyd25,
      lossLloyd: [{ epoch: 0, loss: startLoss }],
      lossE: [{ epoch: 0, loss: startLoss }],
      epochsL: 0,
      seen: 0,
      batches: 0,
      batchInEpoch: 0,
      epochsE: 0,
      splits: 0,
      finalized: false,
      finalizeDelta: null,
      crossEpoch: null,
      finishedE: epochs === 0,
      lastTouchedL: 0,
      lastTouchedE: 0,
      totalTouchedL: 0,
      totalTouchedE: 0,
      lloydMoved: false,
      order: order,
      rng: rng,
      count: count,
      sumX: sumX,
      sumY: sumY,
      finX: new Float64Array(k),
      finY: new Float64Array(k),
      finN: new Float64Array(k),
      totalSteps: totalSteps,
    };

    race.stepLloyd = function () {
      if (race.epochsL >= race.epochs) return race;
      lloydUpdate(x, y, n, lloydX, lloydY);
      race.epochsL += 1;
      race.lastTouchedL = n;
      race.totalTouchedL += n;
      race.lossLloyd.push({ epoch: race.epochsL, loss: mse(x, y, n, lloydX, lloydY) });
      return race;
    };

    race.stepBatch = function () {
      if (race.finishedE) return race;
      const epoch = Math.floor((race.seen + 1e-6) / n);
      if (race.batchInEpoch === 0) {
        shuffle(order, rng);
        if (doFinalize && epoch === epochs - 1) {
          race.finX.fill(0);
          race.finY.fill(0);
          race.finN.fill(0);
        }
      }
      const start = race.batchInEpoch * batchSize;
      const end = Math.min(n, start + batchSize);
      const touched = end - start;
      const bsx = new Float64Array(k);
      const bsy = new Float64Array(k);
      const bn = new Float64Array(k);
      for (let p = start; p < end; p++) {
        const i = order[p];
        const j = nearest(x[i], y[i], emaX, emaY);
        bsx[j] += x[i];
        bsy[j] += y[i];
        bn[j] += 1;
      }
      if (doFinalize && epoch === epochs - 1) {
        for (let j = 0; j < k; j++) {
          race.finX[j] += bsx[j];
          race.finY[j] += bsy[j];
          race.finN[j] += bn[j];
        }
      }
      const alpha = ema ? (cosine ? scheduledAlpha(alpha0, race.batches, totalSteps) : alpha0) : 0;
      if (ema) {
        const keep = 1 - alpha;
        for (let j = 0; j < k; j++) {
          count[j] = keep * count[j] + alpha * bn[j];
          sumX[j] = keep * sumX[j] + alpha * bsx[j];
          sumY[j] = keep * sumY[j] + alpha * bsy[j];
          if (count[j] > 0) {
            emaX[j] = sumX[j] / count[j];
            emaY[j] = sumY[j] / count[j];
          }
        }
      } else {
        for (let j = 0; j < k; j++) {
          count[j] += bn[j];
          sumX[j] += bsx[j];
          sumY[j] += bsy[j];
          if (count[j] > 0) {
            emaX[j] = sumX[j] / count[j];
            emaY[j] = sumY[j] / count[j];
          }
        }
      }
      race.batches += 1;
      race.seen += touched;
      race.lastTouchedE = touched;
      race.totalTouchedE += touched;
      race.batchInEpoch += 1;
      if (doRevive && race.batches % REVIVE_EVERY === 0) {
        race.splits += revive(emaX, emaY, sumX, sumY, count, rng);
      }
      const epochDone = race.batchInEpoch >= stepsPerEpoch;
      if (epochDone && doFinalize && epoch === epochs - 1) {
        const before = mse(x, y, n, emaX, emaY);
        for (let j = 0; j < k; j++) {
          if (race.finN[j] > 0) {
            emaX[j] = race.finX[j] / race.finN[j];
            emaY[j] = race.finY[j] / race.finN[j];
            count[j] = race.finN[j];
            sumX[j] = race.finX[j];
            sumY[j] = race.finY[j];
          }
        }
        race.finalized = true;
        race.finalizeDelta = mse(x, y, n, emaX, emaY) - before;
      }
      if (epochDone) {
        race.batchInEpoch = 0;
        race.epochsE = epoch + 1;
      }
      const loss = mse(x, y, n, emaX, emaY);
      const frac = race.seen / n;
      race.lossE.push({ epoch: frac, loss: loss });
      if (race.crossEpoch == null && loss <= lloyd25) race.crossEpoch = frac;
      if (race.seen >= n * epochs) race.finishedE = true;
      return race;
    };

    race.stepTogether = function () {
      const before = race.epochsL;
      if (!race.finishedE) race.stepBatch();
      const complete = Math.floor((race.seen + 1e-6) / n);
      while (race.epochsL < complete && race.epochsL < race.epochs) race.stepLloyd();
      race.lloydMoved = race.epochsL > before;
      return race;
    };

    race.runToEnd = function () {
      while (!race.finishedE || race.epochsL < race.epochs) {
        if (race.finishedE && race.epochsL >= race.epochs) break;
        race.stepTogether();
      }
      return race;
    };

    return race;
  }

  globalThis.EmeansRace = {
    SHOP: SHOP,
    ZONES: ZONES,
    DEFAULTS: DEFAULTS,
    SCATTER: SCATTER,
    QUALITY_BATCH: QUALITY_BATCH,
    ALPHA_LAW: ALPHA_LAW,
    ALPHA_FLOOR: ALPHA_FLOOR,
    INIT_COUNT: INIT_COUNT,
    REVIVE_EVERY: REVIVE_EVERY,
    REVIVE_TAU: REVIVE_TAU,
    SPLIT_DELTA: SPLIT_DELTA,
    scalingLaw: scalingLaw,
    scheduledAlpha: scheduledAlpha,
    makeCalls: makeCalls,
    mse: mse,
    createRace: createRace,
    roundPowerOfTwo: roundPowerOfTwo,
  };
})();
