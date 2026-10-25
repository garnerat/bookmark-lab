import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "./analyze.js";
import { pageType, parseApacheTime, parseCsvLine, parseLog } from "./parse.js";
import { SAMPLE_LOG } from "./sample-log.js";
import { SIGNATURES, classifyUa } from "./signatures.js";

function combined({
  ip = "203.0.113.5",
  time = "25/Oct/2026:09:15:42 +0000",
  request = "GET /pricing HTTP/1.1",
  status = "200",
  bytes = "1800",
  referrer = "-",
  ua = "Mozilla/5.0",
}) {
  return `${ip} - - [${time}] "${request}" ${status} ${bytes} "${referrer}" "${ua}"`;
}

test("reads a combined log line, including the Apache timestamp and timezone", () => {
  const parsed = parseLog(
    combined({
      ip: "192.0.2.10",
      time: "10/Oct/2000:13:55:36 -0700",
      request: "GET /apache_pb.gif HTTP/1.0",
      status: "200",
      bytes: "2326",
      referrer: "http://www.example.com/start.html",
      ua: "Mozilla/4.08 [en] (Win98; I ;Nav)",
    }),
  );
  assert.equal(parsed.hits.length, 1);
  assert.equal(parsed.skipped.length, 0);
  const hit = parsed.hits[0];
  assert.equal(hit.ip, "192.0.2.10");
  assert.equal(hit.method, "GET");
  assert.equal(hit.path, "/apache_pb.gif");
  assert.equal(hit.status, 200);
  assert.equal(hit.bytes, 2326);
  assert.equal(hit.referrer, "http://www.example.com/start.html");
  assert.equal(hit.pageType, "asset");
  assert.equal(new Date(hit.timeMs).toISOString(), "2000-10-10T20:55:36.000Z");
});

test("keeps a comma inside a quoted browser user agent", () => {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  const parsed = parseLog(combined({ ua, request: "GET /pricing?plan=fall HTTP/1.1", status: "301" }));
  assert.equal(parsed.hits[0].ua, ua);
  assert.equal(parsed.hits[0].path, "/pricing");
  assert.equal(parsed.hits[0].query, "?plan=fall");
  assert.equal(parsed.hits[0].status, 301);
  assert.equal(parsed.hits[0].agent.id, "human");
  assert.equal(parsed.hits[0].pageType, "pricing");
});

test("parses an IPv6 address and an absolute request URL", () => {
  const parsed = parseLog(
    combined({
      ip: "2001:db8:1::20",
      request: "GET https://queencitycoil.example/services/ac-repair HTTP/1.1",
      ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    }),
  );
  assert.equal(parsed.hits[0].ip, "2001:db8:1::20");
  assert.equal(parsed.hits[0].path, "/services/ac-repair");
  assert.equal(parsed.hits[0].agent.id, "googlebot");
});

test("accepts common log format, a missing status, and extra trailing fields", () => {
  const clf = `127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET / HTTP/1.0" 200 2326`;
  const dashed = combined({ status: "-", bytes: "-" });
  const extra = `${combined({ ua: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" })} rt=0.012`;
  const parsed = parseLog([clf, dashed, extra].join("\n"));
  assert.equal(parsed.hits.length, 3);
  assert.equal(parsed.hits[0].ua, "");
  assert.equal(parsed.hits[0].agent.role, "unknown");
  assert.equal(parsed.hits[1].status, null);
  assert.equal(parsed.hits[1].bytes, null);
  assert.equal(parsed.hits[2].agent.id, "bingbot");
});

test("skips malformed lines and keeps the good ones around them", () => {
  const text = [
    "# note: this file mixes shapes",
    "",
    combined({ path: "/contact" }).replace("GET /pricing", "GET /contact"),
    "this is not a log",
    '203.0.113.5 - - [25/Oct/2026:09:15:42 +0000] "GET /pricing HTTP/1.1" 200',
    '203.0.113.5 - - [25/Oct/2026:09:15:42 +0000] "GET /pricing HTTP/1.1" abc 10 "-" "Mozilla/5.0"',
    '10.0.0.1 - - [25/Oct/2026:09:15:42 +0000] GET /pricing HTTP/1.1 200 10 "-" "Mozilla/5.0"',
    combined({ request: "not a request line", ua: "GPTBot/1.0" }),
    combined({ ua: "CCBot/2.0 (https://commoncrawl.org/faq/)" }),
  ].join("\r\n");
  const parsed = parseLog(text);
  assert.equal(parsed.hits.length, 2);
  assert.equal(parsed.hits[0].path, "/contact");
  assert.equal(parsed.hits[1].agent.id, "ccbot");
  assert.equal(parsed.skipped.length, 5);
  assert.ok(parsed.skipped.some((row) => row.line === "this is not a log"));
  assert.ok(parsed.skipped.some((row) => row.reason.includes("status")));
});

test("parses a CSV with a quoted user agent, a header, and a short row", () => {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  const text = [
    "user_agent,path,timestamp,status",
    `"${ua}",/pricing,2026-10-25T13:00:00Z,200`,
    '"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",/contact,2026-10-25T13:05:00-04:00,200',
    "only-one-field",
    "",
  ].join("\n");
  const parsed = parseLog(text);
  assert.equal(parsed.format, "csv");
  assert.equal(parsed.hits.length, 2);
  assert.equal(parsed.hits[0].ua, ua);
  assert.equal(parsed.hits[0].agent.role, "human");
  assert.equal(parsed.hits[0].path, "/pricing");
  assert.equal(parsed.hits[0].dayKey, "2026-10-25");
  assert.equal(parsed.hits[1].agent.id, "chatgpt-user");
  assert.equal(parsed.hits[1].hour, 13);
  assert.equal(parsed.skipped.length, 1);
});

test("CSV without a header uses user_agent, path, timestamp", () => {
  const text = "GPTBot/1.4,https://shop.example/blog/post,2026-10-01 08:30:00\n";
  const parsed = parseLog(text);
  assert.equal(parsed.hits.length, 1);
  assert.equal(parsed.hits[0].agent.id, "gptbot");
  assert.equal(parsed.hits[0].path, "/blog/post");
  assert.equal(parsed.hits[0].pageType, "blog");
  assert.equal(parsed.hits[0].dayKey, "2026-10-01");
});

test("quoted CSV quotes and an empty file", () => {
  assert.deepEqual(parseCsvLine('"say ""hi""",/pricing,2026-10-01'), ['say "hi"', "/pricing", "2026-10-01"]);
  const empty = parseLog("   \n# just a comment\n");
  assert.equal(empty.hits.length, 0);
  assert.equal(empty.format, "empty");
});

test("every documented signature matches its own example and not a normal browser", () => {
  const browser =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  assert.equal(classifyUa(browser).role, "human");
  assert.equal(classifyUa("CHATGPT-USER").id, "chatgpt-user");
  for (const sig of SIGNATURES) {
    const hit = classifyUa(sig.example);
    assert.equal(hit.id, sig.id, sig.example);
  }
});

test("longer tokens win, and a phone brand is not a crawler", () => {
  assert.equal(classifyUa("Mozilla/5.0 (compatible; Applebot-Extended/1.0)").id, "applebot-extended");
  assert.equal(
    classifyUa(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
    ).id,
    "applebot",
  );
  assert.equal(classifyUa("Googlebot-Image/1.0").id, "googlebot-image");
  assert.equal(classifyUa("Mozilla/5.0 (compatible; Google-Extended/1.0)").id, "google-extended");
  assert.notEqual(classifyUa(SIGNATURES.find((sig) => sig.id === "googlebot").example).id, "google-extended");
  const cubot =
    "Mozilla/5.0 (Linux; Android 11; CUBOT NOTE 20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36";
  assert.equal(classifyUa(cubot).role, "human");
  assert.equal(
    classifyUa("Mozilla/5.0 (compatible; MadeUpBot/1.0; +https://example.com/robot)").name,
    "MadeUpBot",
  );
  assert.equal(classifyUa("curl/8.7.1").role, "tool");
  assert.equal(
    classifyUa(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
    ).id,
    "tool:headlesschrome",
  );
});

test("page types do not confuse service areas with services", () => {
  assert.equal(pageType("/service-areas/hyde-park").id, "areas");
  assert.equal(pageType("/services/ac-repair").id, "services");
  assert.equal(pageType("/llms.txt").id, "llms");
  assert.equal(pageType("/robots.txt").id, "robots");
  assert.equal(pageType("/sitemap.xml").id, "sitemap");
  assert.equal(pageType("/").id, "home");
  assert.equal(pageType("/wp-login.php").id, "other");
});

test("apache timestamps with a bad month fail closed", () => {
  assert.equal(parseApacheTime("32/Foo/2026:10:00:00 +0000"), null);
  assert.ok(parseApacheTime("25/Oct/2026:09:15:42 +0000"));
});

test("the sample log is labeled synthetic and tells the Queen City Coil story", () => {
  assert.match(SAMPLE_LOG, /Synthetic/);
  assert.match(SAMPLE_LOG, /Queen City Coil/);
  assert.match(SAMPLE_LOG, /NOT A LOG LINE/);
  const parsed = parseLog(SAMPLE_LOG);
  assert.equal(parsed.comments.sample, true);
  assert.equal(parsed.comments.business, "Queen City Coil");
  assert.equal(parsed.skipped.length, 3);
  const chatgptPricing = parsed.hits.filter(
    (hit) => hit.agent.id === "chatgpt-user" && hit.pageType === "pricing",
  );
  assert.equal(chatgptPricing.length, 14);
  const report = analyze(parsed);
  assert.match(
    report.takeaways[0],
    /ChatGPT-User fetched your pricing page 14 times: real people are asking ChatGPT about your prices/,
  );
  assert.match(report.takeaways.join("\n"), /Claude-User fetched your pricing page 6 times/);
  assert.match(report.takeaways.join("\n"), /Perplexity-User fetched your AC repair page 5 times/);
  assert.match(report.takeaways.join("\n"), /Training crawlers in this log: GPTBot \(11\)/);
  assert.match(report.takeaways.join("\n"), /CCBot fetched 4 URLs/);
  assert.match(report.takeaways.join("\n"), /\/wp-login\.php \(3\)/);
  assert.match(report.takeaways.join("\n"), /llms\.txt was fetched 3 times/);
  assert.match(report.spoofing, /reverse DNS/);
  assert.equal(report.totals.user > 0, true);
  assert.equal(report.totals.human > 0, true);
  assert.equal(report.agents.some((agent) => agent.id === "google-extended"), false);
  assert.equal(report.agents.some((agent) => agent.id === "bytespider"), true);
  assert.equal(report.agents.find((agent) => agent.id === "bytespider").role, "search");
  assert.match(report.robots, /User-agent: GPTBot\nDisallow: \//);
  assert.match(report.robots, /User-agent: ChatGPT-User\nAllow: \//);
  assert.match(report.robots, /User-agent: meta-externalagent\nDisallow: \//);
  assert.match(report.robots, /Not seen as their own crawler/);
  assert.match(report.robots, /User-agent: Google-Extended\nDisallow: \//);
  assert.match(report.robots, /User-agent: Applebot-Extended\nDisallow: \//);
  assert.doesNotMatch(report.robots, /Google-Extended fetched/);
  assert.match(report.llms, /^# Queen City Coil\n/);
  assert.match(report.llms, /Fictional/);
  assert.match(report.llms, /https:\/\/queencitycoil\.example\/pricing/);
  assert.match(report.llms, /https:\/\/llmstxt\.org\//);
  assert.equal(report.site.site, "https://queencitycoil.example");
  assert.equal(report.timeline.unit, "day");
  assert.ok(report.timeline.buckets.length >= 5);
});

test("a literal Google-Extended user agent is not counted as Googlebot", () => {
  const text = combined({
    ua: "Mozilla/5.0 (compatible; Google-Extended/1.0)",
    request: "GET /pricing HTTP/1.1",
  });
  const report = analyze(parseLog(text));
  assert.equal(report.agents[0].id, "google-extended");
  assert.match(report.takeaways.join("\n"), /Google-Extended/);
  assert.match(report.robots, /A robots\.txt control token showed up/);
  assert.doesNotMatch(report.robots, /Not seen as their own crawler[\s\S]*Google-Extended/);
});

test("the site hostname can come from a referrer when the log has no comment", () => {
  const text = combined({
    referrer: "https://millcreek.example/pricing",
    request: "GET /contact HTTP/1.1",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const report = analyze(parseLog(text));
  assert.equal(report.site.site, "https://millcreek.example");
  assert.match(report.llms, /https:\/\/millcreek\.example\/contact/);
  assert.doesNotMatch(report.llms, /The log did not include a hostname/);
});

test("one user-triggered fetch uses the singular", () => {
  const text = combined({
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  });
  const report = analyze(parseLog(text));
  assert.match(
    report.takeaways[0],
    /ChatGPT-User fetched your pricing page 1 time: real people are asking ChatGPT about your prices/,
  );
});
