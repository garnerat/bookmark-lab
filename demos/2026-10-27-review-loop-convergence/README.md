# Make the review loop finish

A phone-first toy of an agent author and an agent reviewer on one pull request. The idea is from [Addy Osmani’s article](https://x.com/addyosmani/status/2114604912520921136) on how the Claude Code team reviews code (also on the [claude.dev blog](https://claude.dev/blog/solving-code-review-at-anthropic/)).

Open `index.html`. There is no build step and no network call. The probabilities are invented so the failure is easy to see. They are not the team’s measurements.

```bash
node --test check.js
```
