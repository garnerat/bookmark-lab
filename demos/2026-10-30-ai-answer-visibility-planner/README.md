# AI answer visibility planner

A phone-first page for Linwood Comfort, a fictional residential HVAC shop in Cincinnati. Twelve homeowner questions are each a Google keyword and an AI prompt. You diagnose a lost prompt, apply one fix, and rerun a seeded sample of 20 prompts. Google rank and AI mentions move on different fixes.

The loop is from the bookmarked post at <https://x.com/wespreadjam/status/2115568290307469548>. The shop, the ranks, the listings, and the thread are made up. The 4,600% figure is the post’s claim, not a result this page measures.

Open `index.html`. There is no build step. Nothing is uploaded.

```bash
node --test check.js
```

The test checks the four diagnoses, the improve-before-create rule, that Google and AI move apart, and that the lab index links this demo.
