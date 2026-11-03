# A data bot that will not invent a metric

A phone-first page for Redbud Lawn Co., a fictional lawn and landscape company in Oakley, Cincinnati. Data Bot answers a plain question from a few hundred synthetic rows, or it says the question has no defined metric.

With the semantic layer on, each answer names the metric, shows the query, runs that query in the page, and draws the table. With the layer off, the same words pick a convenient column, and customer, conversion, and revenue change. A pin keeps an answer on the dashboard in this browser.

The idea is from [@bot](https://x.com/bot/status/2117349540168876334): a team bot that gives people on-demand access to a data scientist. The rows, the crews, and the company are fiction.

Open `index.html`. There is no build step. Nothing is uploaded.

```bash
node --test check.js
```

The test checks the metric definitions against the generated rows, the loose-versus-defined gaps, the refusal for an unknown question, and that the lab index links this demo.
