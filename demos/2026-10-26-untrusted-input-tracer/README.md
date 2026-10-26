# Follow the input to the sink

A static walkthrough of [Cloudflare’s security-audit skill](https://github.com/cloudflare/security-audit-skill) on a fictional Cincinnati plumbing-and-heating shop. The assignment is [Franz Bruckhoff’s prompt of the day](https://x.com/franzbruckhoff/status/2113401002355298410).

Open `index.html`. There is no build step. The fixtures compare dummy rows and strings in the page. They do not start Node, a shell, or a database.

```bash
node --test check.js
```

The test checks the verdict split (severity only on confirmed records), that every cited line exists, and that each fixture input breaks the shop path and holds after the patch.
