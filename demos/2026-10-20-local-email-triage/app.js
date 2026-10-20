import { EMAILS } from './emails.js';

const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const LIB_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

const SYSTEM = `Convert the customer email into one JSON object for a dispatcher.
summary: a sentence about the sender and their request.
action_items: an array of short task strings. Use [] if there is nothing to do.
events: an array of objects with title and when. Use [] if there is no appointment or deadline.
priority: high, medium, or low.
Use high for emergencies and upset customers, medium for scheduling and billing, and low for marketing or thank-you notes.`;

const RETRY_SYSTEM = `Reply with one JSON object only, no markdown.
Keys: summary (string), action_items (array of strings), events (array of {"title","when"}), priority ("high", "medium", or "low").`;

const $ = (id) => document.getElementById(id);

const inboxEl = $('inbox');
const cardsEl = $('cards');
const listEl = $('priority-list');
const overallEl = $('overall');
const statusEl = $('model-status');
const runtimeNote = $('runtime-note');
const progressWrap = $('progress-wrap');
const progressBar = $('progress-bar');
const loadBtn = $('load-model');
const triageAllBtn = $('triage-all');
const customBtn = $('run-custom');
const customText = $('custom-text');

let tf = null;
let generator = null;
let runtimeLabel = '';
let busy = false;
let sortKey = 'priority';
let running = null;
const results = new Map();
const extras = [];

function buildPrompt(email, retry) {
  const system = retry ? RETRY_SYSTEM : SYSTEM;
  return `<|im_start|>system
${system}<|im_end|>
<|im_start|>user
${email}<|im_end|>
<|im_start|>assistant
{"summary":"`;
}

function assemble(generated) {
  const text = generated ?? '';
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) return trimmed;
  if (trimmed.startsWith('"summary"')) return '{' + trimmed;
  return '{"summary":"' + text;
}

function jsonClosed(text) {
  let depth = 0;
  let started = false;
  let inStr = false;
  let esc = false;
  for (const ch of text) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') {
      started = true;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (started && depth === 0) return true;
    }
  }
  return false;
}

function tryParse(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    try {
      return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

function asString(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    for (const key of ['task', 'text', 'title', 'summary', 'action', 'name']) {
      if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
    }
    const first = Object.values(value).find((item) => typeof item === 'string' && item.trim());
    if (first) return first.trim();
  }
  return '';
}

function normalizePriority(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (['high', 'urgent', 'critical', 'emergency'].includes(text)) return 'high';
  if (['medium', 'med', 'normal', 'moderate'].includes(text)) return 'medium';
  if (['low', 'none', 'info'].includes(text)) return 'low';
  return '';
}

function normalizeActions(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map(asString).filter(Boolean);
}

function normalizeEvents(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const events = [];
  for (const item of list) {
    if (typeof item === 'string') {
      const title = item.trim();
      if (title) events.push({ title, when: '' });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const title = asString(item.title ?? item.name ?? item.event ?? item.summary);
    const when = asString(item.when ?? item.date ?? item.time ?? item.start);
    if (title || when) events.push({ title: title || 'Event', when });
  }
  return events;
}

function normalize(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const summary = asString(obj.summary);
  const priority = normalizePriority(obj.priority);
  if (!summary || !priority) return null;
  return {
    summary,
    action_items: normalizeActions(obj.action_items ?? obj.actionItems),
    events: normalizeEvents(obj.events),
    priority,
  };
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatRate(tokens, ms) {
  if (!tokens || !ms) return '—';
  return `${(tokens / (ms / 1000)).toFixed(1)} tok/s`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const mb = bytes / 1048576;
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setProgress(percent, indeterminate) {
  progressWrap.hidden = false;
  progressWrap.classList.toggle('indeterminate', Boolean(indeterminate) || percent == null);
  const value = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  progressBar.style.width = progressWrap.classList.contains('indeterminate') ? '' : `${value}%`;
  progressBar.setAttribute('aria-valuenow', String(Math.round(value)));
}

function orderIndex(id) {
  const sample = EMAILS.findIndex((email) => email.id === id);
  if (sample >= 0) return sample;
  const extra = extras.findIndex((email) => email.id === id);
  return 1000 + (extra < 0 ? 0 : extra);
}

function priorityRank(result) {
  if (!result?.ok) return 9;
  return { high: 0, medium: 1, low: 2 }[result.triage.priority];
}

function sortedResults() {
  const rows = [...results.values()];
  rows.sort((a, b) => {
    if (sortKey === 'latency') return (a.ms || Infinity) - (b.ms || Infinity);
    if (sortKey === 'inbox') return orderIndex(a.id) - orderIndex(b.id);
    const byPriority = priorityRank(a) - priorityRank(b);
    if (byPriority) return byPriority;
    return orderIndex(a.id) - orderIndex(b.id);
  });
  return rows;
}

function badge(kind, label) {
  const node = document.createElement('span');
  node.className = `badge ${kind}`;
  node.textContent = label;
  return node;
}

function renderInbox() {
  inboxEl.replaceChildren();
  for (const email of EMAILS) {
    const item = document.createElement('article');
    item.className = 'inbox-item';
    const title = document.createElement('h3');
    title.textContent = email.subject;
    const who = document.createElement('p');
    who.className = 'who';
    who.textContent = `${email.from} · ${email.address}`;
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Read email';
    const pre = document.createElement('pre');
    pre.textContent = email.body;
    details.append(summary, pre);
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.dataset.run = email.id;
    button.textContent = 'Triage';
    button.disabled = !generator || busy;
    button.addEventListener('click', () => { runEmails([email]); });
    actions.append(button);
    item.append(title, who, details, actions);
    inboxEl.append(item);
  }
}

function renderOverall() {
  if (results.size === 0 && !running) {
    overallEl.textContent = 'No emails triaged yet. A 0.5B model writes a first pass, not a finished dispatcher.';
    return;
  }
  let tokens = 0;
  let ms = 0;
  for (const result of results.values()) {
    tokens += result.tokens || 0;
    ms += result.ms || 0;
  }
  const done = [...results.values()].filter((result) => result.ok).length;
  overallEl.textContent = `${done} parsed of ${results.size} finished · ${tokens} generated tokens in ${formatDuration(ms)} of model time · ${formatRate(tokens, ms)} overall`;
}

function renderList() {
  listEl.replaceChildren();
  const rows = sortedResults();
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Triage an email to fill the prioritized list.';
    listEl.append(empty);
    return;
  }
  const ol = document.createElement('ol');
  ol.className = 'plist';
  for (const result of rows) {
    const li = document.createElement('li');
    const kind = result.ok ? result.triage.priority : 'unparsed';
    const label = result.ok ? result.triage.priority : 'unparsed';
    const title = document.createElement('strong');
    title.textContent = result.email.subject;
    const summary = document.createElement('span');
    summary.className = 'summary';
    summary.textContent = result.ok ? result.triage.summary : 'The model did not return JSON in the expected shape.';
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = formatDuration(result.ms);
    li.append(badge(kind, label), title, summary, meta);
    ol.append(li);
  }
  listEl.append(ol);
}

function addList(parent, title, items, emptyText) {
  const heading = document.createElement('h4');
  heading.textContent = title;
  parent.append(heading);
  if (!items.length) {
    const p = document.createElement('p');
    p.textContent = emptyText;
    parent.append(p);
    return;
  }
  const ul = document.createElement('ul');
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    ul.append(li);
  }
  parent.append(ul);
}

function renderCard(result, liveText) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = result.email.id;
  card.dataset.state = result.state || 'done';
  if (result.ok) card.dataset.parsed = 'true';
  else if (result.state !== 'running') card.dataset.parsed = 'false';

  const top = document.createElement('div');
  top.className = 'card-top';
  const headingWrap = document.createElement('div');
  const heading = document.createElement('h3');
  heading.textContent = result.email.subject;
  const who = document.createElement('p');
  who.className = 'who';
  who.textContent = result.email.from;
  headingWrap.append(heading, who);
  let pill;
  if (result.state === 'running') pill = badge('running', result.retried ? 'retrying' : 'reading');
  else if (result.ok) pill = badge(result.triage.priority, result.triage.priority);
  else pill = badge('unparsed', 'unparsed');
  top.append(headingWrap, pill);
  card.append(top);

  if (result.state === 'running') {
    const p = document.createElement('p');
    p.className = 'summary';
    p.textContent = result.retried
      ? 'The first reply was not usable JSON. Asking once more.'
      : 'Generating a JSON record in this tab.';
    const raw = document.createElement('div');
    raw.className = 'live-raw';
    raw.textContent = liveText || '';
    card.append(p, raw);
    return card;
  }

  if (result.ok) {
    const summary = document.createElement('p');
    summary.className = 'summary';
    summary.textContent = result.triage.summary;
    card.append(summary);
    addList(card, 'Action items', result.triage.action_items, 'None.');
    addList(
      card,
      'Events',
      result.triage.events.map((event) => event.when ? `${event.title} — ${event.when}` : event.title),
      'None.',
    );
  } else {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = result.error
      ? `The model run stopped: ${result.raw}`
      : 'The model did not return JSON in the expected shape after one retry. Raw output is below.';
    card.append(note);
  }

  const stats = document.createElement('p');
  stats.className = 'stats';
  const bits = [
    `Latency ${formatDuration(result.ms)}`,
    `${result.tokens || 0} tokens`,
    formatRate(result.tokens, result.ms),
  ];
  if (result.retried) bits.push('retried once');
  stats.textContent = bits.join(' · ');
  card.append(stats);

  const details = document.createElement('details');
  if (result.ok) details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = result.ok ? 'JSON' : 'Raw model output';
  const pre = document.createElement('pre');
  pre.className = 'json';
  pre.textContent = result.ok ? JSON.stringify(result.triage, null, 2) : (result.raw || '');
  details.append(summary, pre);
  card.append(details);
  return card;
}

function render() {
  renderInbox();
  renderOverall();
  renderList();
  const cards = [];
  if (running) cards.push(renderCard(running, running.liveText));
  const finished = [...results.values()].sort((a, b) => b.finishedAt - a.finishedAt);
  for (const result of finished) cards.push(renderCard(result));
  if (!cards.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Cards for each email show up here.';
    cardsEl.replaceChildren(empty);
  } else {
    cardsEl.replaceChildren(...cards);
  }
  triageAllBtn.disabled = !generator || busy;
  customBtn.disabled = !generator || busy;
  loadBtn.disabled = busy || Boolean(generator);
}

function syncSortButtons() {
  for (const button of document.querySelectorAll('[data-sort]')) {
    button.setAttribute('aria-pressed', button.dataset.sort === sortKey ? 'true' : 'false');
  }
}

async function chooseRuntime() {
  const forced = new URLSearchParams(location.search).get('device');
  if (forced === 'wasm') return { device: 'wasm', dtype: 'q4', label: 'WASM (q4)' };
  if (forced === 'webgpu') return { device: 'webgpu', dtype: 'q4f16', label: 'WebGPU (q4f16)' };
  if (navigator.gpu) {
    try {
      const adapter = await Promise.race([
        navigator.gpu.requestAdapter(),
        new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (adapter) return { device: 'webgpu', dtype: 'q4f16', label: 'WebGPU (q4f16)' };
    } catch {
      // WASM below.
    }
  }
  return { device: 'wasm', dtype: 'q4', label: 'WASM (q4)' };
}

function onProgress(info) {
  if (!info || typeof info !== 'object') return;
  if (info.status === 'progress' || info.status === 'progress_total') {
    const loaded = formatBytes(info.loaded);
    const total = formatBytes(info.total);
    const name = info.file ? ` ${info.file}` : '';
    const amount = loaded && total ? ` (${loaded} / ${total})` : '';
    setStatus(`Downloading${name}${amount}`);
    setProgress(Number(info.progress) || 0, false);
  } else if (info.status === 'initiate' || info.status === 'download') {
    setStatus(`Starting ${info.file || 'a model file'}`);
    setProgress(null, true);
  } else if (info.status === 'done' && info.file) {
    setStatus(`Fetched ${info.file}`);
  } else if (info.status === 'ready') {
    setStatus('Weights are in. Starting the runtime…');
    setProgress(null, true);
  }
}

async function loadModel() {
  if (generator || busy) return;
  busy = true;
  render();
  setStatus('Loading Transformers.js…');
  setProgress(null, true);
  try {
    tf = await import(LIB_URL);
    tf.env.allowLocalModels = false;
    const choice = await chooseRuntime();
    runtimeLabel = choice.label;
    runtimeNote.textContent = `Loading ${MODEL_ID} on ${choice.label}. First-time download is about ${choice.device === 'webgpu' ? '490 MB' : '780 MB'}.`;
    setStatus(`Preparing ${choice.label}…`);
    try {
      generator = await tf.pipeline('text-generation', MODEL_ID, {
        device: choice.device,
        dtype: choice.dtype,
        progress_callback: onProgress,
      });
    } catch (error) {
      if (choice.device !== 'wasm') {
        runtimeLabel = 'WASM (q4)';
        runtimeNote.textContent = 'WebGPU did not start. Falling back to WASM (q4), about 780 MB the first time.';
        setStatus('WebGPU failed. Downloading the WASM weights…');
        generator = await tf.pipeline('text-generation', MODEL_ID, {
          device: 'wasm',
          dtype: 'q4',
          progress_callback: onProgress,
        });
      } else {
        throw error;
      }
    }
    document.body.dataset.runtime = runtimeLabel.startsWith('WebGPU') ? 'webgpu' : 'wasm';
    progressWrap.classList.remove('indeterminate');
    setProgress(100, false);
    setStatus(`Model ready on ${runtimeLabel}. Emails stay in this tab.`);
  } catch (error) {
    generator = null;
    setStatus(`The model did not load. ${error?.message || error}`);
    progressWrap.hidden = true;
  } finally {
    busy = false;
    render();
  }
}

async function generateOnce(emailText, retry) {
  const prompt = buildPrompt(emailText, retry);
  const promptLen = generator.tokenizer.encode(prompt, { add_special_tokens: false }).length;
  let tokens = 0;
  const streamer = new tf.TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk) => {
      if (!running) return;
      running.liveText = (running.liveText || '') + chunk;
      const live = cardsEl.querySelector('.live-raw');
      if (live) live.textContent = running.liveText;
    },
    token_callback_function: (ids) => {
      tokens += ids.length;
    },
  });
  const stop = new (class extends tf.StoppingCriteria {
    _call(inputIds) {
      return inputIds.map((ids) => {
        const generated = ids.slice(promptLen);
        if (!generated.length) return false;
        let text = '';
        try {
          text = generator.tokenizer.decode(generated, { skip_special_tokens: true });
        } catch {
          return false;
        }
        return jsonClosed(assemble(text));
      });
    }
  })();
  const started = performance.now();
  const output = await generator(prompt, {
    max_new_tokens: 170,
    do_sample: false,
    repetition_penalty: 1.05,
    no_repeat_ngram_size: 6,
    return_full_text: false,
    add_special_tokens: false,
    stopping_criteria: stop,
    streamer,
  });
  const ms = performance.now() - started;
  const item = Array.isArray(output) ? output[0] : output;
  let text = '';
  if (typeof item?.generated_text === 'string') text = item.generated_text;
  else if (Array.isArray(item?.generated_text)) text = item.generated_text.at(-1)?.content || '';
  if (!tokens) {
    const encoded = generator.tokenizer.encode(text, { add_special_tokens: false });
    tokens = encoded.length;
  }
  return { text, ms, tokens };
}

async function runEmails(list) {
  if (!generator || busy || !list.length) return;
  busy = true;
  render();
  for (const email of list) {
    running = {
      email,
      id: email.id,
      state: 'running',
      ok: false,
      retried: false,
      liveText: '',
    };
    render();
    let ms = 0;
    let tokens = 0;
    let raw = '';
    let triage = null;
    let error = false;
    let retried = false;
    try {
      const first = await generateOnce(email.body, false);
      ms += first.ms;
      tokens += first.tokens;
      raw = assemble(first.text);
      triage = normalize(tryParse(raw));
      if (!triage) {
        retried = true;
        running.retried = true;
        running.liveText = '';
        render();
        const second = await generateOnce(email.body, true);
        ms += second.ms;
        tokens += second.tokens;
        raw = assemble(second.text);
        triage = normalize(tryParse(raw));
      }
    } catch (err) {
      error = true;
      raw = err?.message || String(err);
    }
    results.set(email.id, {
      id: email.id,
      email,
      ok: Boolean(triage),
      triage,
      raw,
      retried,
      error,
      ms,
      tokens,
      finishedAt: Date.now(),
    });
    running = null;
    render();
  }
  busy = false;
  render();
}

function pastedEmail() {
  const body = customText.value.trim();
  if (!body) return null;
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const subjectLine = lines.find((line) => /^subject:/i.test(line));
  const subject = subjectLine
    ? subjectLine.replace(/^subject:\s*/i, '').slice(0, 90)
    : (lines[0] || 'Pasted email').slice(0, 90);
  const email = {
    id: `custom-${Date.now()}`,
    from: 'Pasted locally',
    address: '',
    subject: subject || 'Pasted email',
    body,
  };
  extras.push(email);
  return email;
}

loadBtn.addEventListener('click', () => { loadModel(); });
triageAllBtn.addEventListener('click', () => { runEmails(EMAILS); });
customBtn.addEventListener('click', () => {
  const email = pastedEmail();
  if (email) runEmails([email]);
});
for (const button of document.querySelectorAll('[data-sort]')) {
  button.addEventListener('click', () => {
    sortKey = button.dataset.sort;
    syncSortButtons();
    render();
  });
}

render();
