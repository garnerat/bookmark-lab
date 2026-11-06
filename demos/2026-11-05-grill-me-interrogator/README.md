# Grill the idea before you build

A phone-first page for Oakley Heating & Cooling, a fictional shop in Oakley and Northside, Cincinnati. Pick a vague bot idea, or type one. A shallow grill asks three soft questions. A deep grill asks six to eight, and the next question depends on the idea and on the answers already given.

At the end the page shows the holes still open, a one-paragraph spec filled from those answers, and the scope you would have built from the vague sentence next to a smaller first slice.

The step is /grill-me, the interrogation skill from the mattpocock/skills pattern, as described in [Greg Isenberg’s agent-stack post](https://x.com/gregisenberg/status/2117734977312047537): voice note, then grill, then spec, then build. The shop, the counts, and the choices are fiction. Nothing is uploaded.

Open `index.html`. There is no build step.

```bash
node --test check.js
```

The test checks question order, keyword routing, the holes, the spec templates, the skipped-scope chips, and that the lab index links this demo.
