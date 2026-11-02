# Code mode that survives a crash

A phone-first page for Linwood Comfort, a fictional HVAC shop in Cincinnati. The agent answers one question from a fake job board: callbacks and parts cost per crew for completed warranty jobs last month.

Direct tool calls put every `list_jobs` page and every `get_job` payload into the model. Code mode runs those calls inside one script and returns the totals. A second panel crashes that script. Resume replays it from a journal: finished calls are not sent again, an in-flight call reruns only when the tool is marked safe, and a change to the script, the sandbox, or the underlying jobs each ends the way the source post describes.

The idea is from Manoj (@manojlds), [Code mode that survives a crash](https://x.com/manojlds/status/2115868615333327059), written up at [stacktoheap.com](https://stacktoheap.com/blog/2026/10/26/durable-code-mode-in-pi/) and shared by [@badlogicgames](https://x.com/badlogicgames/status/2116082498115657878). The byte counts on the page are computed from the sample jobs. The author’s Pi figures are quoted separately. He said that run is not a benchmark.

Open `index.html`. There is no build step. Nothing is uploaded.

```bash
node --test check.js
```

The test checks the job filter, the context-size gap, replay after a crash, and that the lab index links this demo.
