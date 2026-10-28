# Enablement opportunity mapper

A phone-first page for a fictional Cincinnati HVAC and plumbing shop. You step through a leadership kickoff and three department sessions. Tasks people would hand to AI land on an opportunity map. Rank is stated hours times adoption, divided by build effort. A long task named only by resistant people sits below a shorter task curious people want.

The idea is from Luke Pierce’s article “AI Audits Are Dead. Sell This Instead,” bookmarked at <https://x.com/lukepierceops/status/2115245000351154480>. The shop, the staff, and the hours are made up.

Open `index.html`. There is no build step. Nothing is uploaded.

```bash
node --test check.js
```

The test checks the rank inversion, session reveal, proposal text, and that the lab index links this demo.
