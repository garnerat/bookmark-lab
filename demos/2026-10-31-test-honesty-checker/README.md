# Is the agent's test suite honest?

A phone-first page for Linwood Comfort, a fictional HVAC shop in Cincinnati. An agent-written quote calculator ships with tests that cover every line and barely assert anything. The page runs the module and the tests in the browser, scores cyclomatic complexity, line coverage, and CRAP, then mutation-tests the module. You add one stronger test at a time and watch surviving mutants fail.

The loop is from Uncle Bob Martin's ub-mode skill, linked from <https://x.com/unclebobmartin/status/2114388856976069095> and published at <https://github.com/unclebob/ub-mode>. This page is a small in-browser check for one file, not the crapper, dryer, or mutator tools.

Open `index.html`. There is no build step. Nothing is uploaded.

```bash
node --test check.js
```

The test checks that coverage is complete while the weak suite kills few mutants, that each added test kills at least one more, and that the lab index links this demo.
