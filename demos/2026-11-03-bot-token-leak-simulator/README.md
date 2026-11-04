# Most of the bot bill is re-reading

A phone-first page for Mill Creek Plumbing, a fictional shop in Northside, Cincinnati. Two preset bot teams run an illustrative month: one bot per task, or a few domain bots plus an ops bot.

Sliders set how often each bot wakes, how much old chat it carries, how big the rules and skills doc is, and how many tokens the new work takes. The month splits re-reading, rules, and new work, and prices them with editable example rates. Four fixes show the delta. A separate mistake count adds a handoff per extra bot and lowers the per-run miss once when rules and a verification check are on.

The ladder is from Lauren Tan’s workshop, quoted by [@0xg4tsby](https://x.com/0xg4tsby/status/2115791677105291629). The bill is from [@m4lkxx](https://x.com/m4lkxx/status/2115775972536434946), “Grok Bot: 6 Bots, 200+ Agents, a Smaller Bill.” The company and the counts are fiction.

Open `index.html`. There is no build step. Nothing is uploaded.

```bash
node --test check.js
```

The test checks the month’s arithmetic, the four fixes, the mistake ladder, and that the lab index links this demo.
