# Which agents visit your site

A static page that reads an access log in the browser and sorts AI agents from search crawlers and from people.

Open `index.html`. There is no build step, no server, and no API key. A file you choose is read with `FileReader` and is not uploaded. **Load sample log** fills in a synthetic combined log for Queen City Coil, a fictional Cincinnati HVAC shop.

The signature list is in `signatures.js`. Tokens are the ones vendors document (OpenAI, Anthropic, Perplexity, Google, Microsoft, Apple, ByteDance’s Toutiao Search, Common Crawl, Amazon, and Meta). Google-Extended and Applebot-Extended are included as robots.txt controls, not as crawlers that show up on their own. The page says when a user-agent string can be spoofed, and that reverse DNS is the check it does not do.

CSV is also accepted: `user_agent,path,timestamp`, with optional `status`. Quote a user agent that contains a comma.

```bash
node --test parser.test.js
```

The test covers combined-log lines, a CSV with a comma inside the user agent, malformed lines, every signature’s example string, and the sample log’s ChatGPT-User pricing count.
