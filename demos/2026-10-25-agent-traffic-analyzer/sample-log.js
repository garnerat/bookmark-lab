// Synthetic combined log for Queen City Coil, a fictional Cincinnati HVAC shop.
// Addresses are from the documentation ranges in RFC 5737 and RFC 3849.
// Nothing here was captured from a real server.

const UA = {
  chatgpt:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  gptbot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot",
  gptbotRobots:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; robots.txt; +https://openai.com/gptbot",
  oaiSearch:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot",
  claudeBot: "Mozilla/5.0 (compatible; ClaudeBot/1.0)",
  claudeUser: "Mozilla/5.0 (compatible; Claude-User/1.0)",
  claudeSearch: "Mozilla/5.0 (compatible; Claude-SearchBot/1.0)",
  pplxBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  pplxUser:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
  googlebot:
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.69 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingbot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/131.0.0.0 Safari/537.36",
  applebot:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
  bytespider:
    "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
  ccbot: "CCBot/2.0 (https://commoncrawl.org/faq/)",
  amazonbot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1) Chrome/131.0.0.0 Safari/537.36",
  amznSearch:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-SearchBot/0.1) Chrome/131.0.0.0 Safari/537.36",
  amznUser:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-User/0.1) Chrome/131.0.0.0 Safari/537.36",
  metaAgent:
    "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/web-crawlers)",
  metaFetch:
    "meta-externalfetcher/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  ahrefs: "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot)",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  firefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0",
  safari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
  curl: "curl/8.7.1",
};

const SITE = "https://queencitycoil.example";

function at(day, hour, minute) {
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${dd}/Oct/2026:${hh}:${mm}:12 -0400`;
}

function bytesFor(path, status) {
  if (status >= 400) return 1411;
  if (path.endsWith(".css")) return 8044;
  if (path.endsWith(".ico")) return 1150;
  if (path.endsWith("robots.txt")) return 486;
  if (path.endsWith("sitemap.xml")) return 2204;
  if (path.endsWith("llms.txt")) return 960;
  if (path === "/") return 18440;
  return 11000 + (path.length * 173) % 8000;
}

function line(ip, day, hour, minute, path, status, referrer, ua) {
  const bytes = bytesFor(path, status);
  const ref = referrer || "-";
  return `${ip} - - [${at(day, hour, minute)}] "GET ${path} HTTP/1.1" ${status} ${bytes} "${ref}" "${ua}"`;
}

function repeat(count, ip, ua, path, status, startDay) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const day = startDay + (i % 5);
    const hour = 8 + ((i * 3) % 12);
    const minute = (i * 7) % 60;
    rows.push(line(ip, day, hour, minute, path, status, "-", ua));
  }
  return rows;
}

function build() {
  const rows = [];
  rows.push(...repeat(14, "203.0.113.10", UA.chatgpt, "/pricing", 200, 20));
  rows.push(...repeat(4, "203.0.113.10", UA.chatgpt, "/services/ac-repair", 200, 20));
  rows.push(...repeat(3, "203.0.113.10", UA.chatgpt, "/contact", 200, 21));
  rows.push(line("203.0.113.10", 24, 19, 5, "/llms.txt", 200, "-", UA.chatgpt));

  rows.push(...repeat(6, "203.0.113.11", UA.claudeUser, "/pricing", 200, 20));
  rows.push(...repeat(3, "203.0.113.11", UA.claudeUser, "/services/furnace-repair", 200, 21));
  rows.push(...repeat(2, "203.0.113.11", UA.claudeUser, "/contact", 200, 22));
  rows.push(...repeat(2, "203.0.113.11", UA.claudeUser, "/service-areas/hyde-park", 200, 22));

  rows.push(...repeat(5, "203.0.113.12", UA.pplxUser, "/services/ac-repair", 200, 20));
  rows.push(...repeat(2, "203.0.113.12", UA.pplxUser, "/pricing", 200, 23));
  rows.push(...repeat(2, "203.0.113.12", UA.pplxUser, "/blog/how-to-change-a-filter", 200, 23));

  rows.push(...repeat(2, "203.0.113.13", UA.amznUser, "/services/maintenance-plan", 200, 22));
  rows.push(line("203.0.113.13", 24, 18, 40, "/contact", 200, "-", UA.amznUser));

  rows.push(...repeat(2, "203.0.113.14", UA.metaFetch, "/pricing", 200, 21));
  rows.push(line("203.0.113.14", 23, 15, 12, "/contact", 200, "-", UA.metaFetch));

  rows.push(line("203.0.113.30", 20, 2, 10, "/robots.txt", 200, "-", UA.gptbotRobots));
  rows.push(line("203.0.113.30", 20, 2, 11, "/robots.txt", 200, "-", UA.gptbot));
  rows.push(line("203.0.113.30", 20, 2, 14, "/sitemap.xml", 200, "-", UA.gptbot));
  rows.push(line("203.0.113.30", 20, 2, 16, "/llms.txt", 200, "-", UA.gptbot));
  rows.push(line("203.0.113.30", 20, 2, 20, "/", 200, "-", UA.gptbot));
  rows.push(line("203.0.113.30", 20, 3, 1, "/blog/fall-furnace-tune-up", 200, "-", UA.gptbot));
  rows.push(line("203.0.113.30", 21, 3, 5, "/blog/fall-furnace-tune-up", 200, "-", UA.gptbot));
  rows.push(line("203.0.113.30", 21, 3, 8, "/blog/how-to-change-a-filter", 200, "-", UA.gptbot));
  rows.push(line("203.0.113.30", 22, 3, 12, "/blog/how-to-change-a-filter", 200, "-", UA.gptbot));
  rows.push(line("203.0.113.30", 22, 3, 20, "/about", 200, "-", UA.gptbot));
  rows.push(line("203.0.113.30", 22, 3, 28, "/services", 200, "-", UA.gptbot));

  rows.push(line("203.0.113.31", 21, 4, 1, "/", 200, "-", UA.oaiSearch));
  rows.push(line("203.0.113.31", 21, 4, 4, "/services", 200, "-", UA.oaiSearch));
  rows.push(line("203.0.113.31", 21, 4, 8, "/pricing", 200, "-", UA.oaiSearch));
  rows.push(line("203.0.113.31", 21, 4, 12, "/blog/fall-furnace-tune-up", 200, "-", UA.oaiSearch));
  rows.push(line("203.0.113.31", 21, 4, 16, "/sitemap.xml", 200, "-", UA.oaiSearch));

  rows.push(line("203.0.113.32", 20, 1, 2, "/robots.txt", 200, "-", UA.claudeBot));
  rows.push(line("203.0.113.32", 20, 1, 6, "/sitemap.xml", 200, "-", UA.claudeBot));
  rows.push(line("203.0.113.32", 20, 1, 20, "/blog/fall-furnace-tune-up", 200, "-", UA.claudeBot));
  rows.push(line("203.0.113.32", 21, 1, 20, "/blog/fall-furnace-tune-up", 200, "-", UA.claudeBot));
  rows.push(line("203.0.113.32", 21, 1, 40, "/blog/how-to-change-a-filter", 200, "-", UA.claudeBot));
  rows.push(line("203.0.113.32", 22, 1, 10, "/services", 200, "-", UA.claudeBot));
  rows.push(line("203.0.113.32", 22, 1, 18, "/services", 200, "-", UA.claudeBot));
  rows.push(line("203.0.113.32", 23, 1, 10, "/about", 200, "-", UA.claudeBot));
  rows.push(line("203.0.113.32", 23, 1, 22, "/old-coupons", 404, "-", UA.claudeBot));
  rows.push(line("203.0.113.32", 24, 1, 22, "/old-coupons", 404, "-", UA.claudeBot));

  rows.push(line("203.0.113.33", 22, 5, 1, "/", 200, "-", UA.claudeSearch));
  rows.push(line("203.0.113.33", 22, 5, 6, "/services", 200, "-", UA.claudeSearch));
  rows.push(line("203.0.113.33", 22, 5, 10, "/pricing", 200, "-", UA.claudeSearch));
  rows.push(line("203.0.113.33", 22, 5, 14, "/sitemap.xml", 200, "-", UA.claudeSearch));

  rows.push(line("203.0.113.34", 23, 6, 2, "/", 200, "-", UA.pplxBot));
  rows.push(line("203.0.113.34", 23, 6, 8, "/services/ac-repair", 200, "-", UA.pplxBot));
  rows.push(line("203.0.113.34", 23, 6, 14, "/pricing", 200, "-", UA.pplxBot));
  rows.push(line("203.0.113.34", 23, 6, 20, "/sitemap.xml", 200, "-", UA.pplxBot));

  const googlePaths = [
    ["/", 200],
    ["/services", 200],
    ["/services/ac-repair", 200],
    ["/services/furnace-repair", 200],
    ["/pricing", 200],
    ["/contact", 200],
    ["/blog/fall-furnace-tune-up", 200],
    ["/blog/how-to-change-a-filter", 200],
    ["/robots.txt", 200],
    ["/sitemap.xml", 200],
    ["/service-areas/oakley", 200],
    ["/", 200],
  ];
  googlePaths.forEach(([path, status], i) => {
    rows.push(line("203.0.113.40", 20 + (i % 5), 6, i * 3, path, status, "-", UA.googlebot));
  });

  for (const [path, day] of [["/", 20], ["/services", 21], ["/pricing", 22], ["/sitemap.xml", 23], ["/contact", 24]]) {
    rows.push(line("203.0.113.41", day, 7, 15, path, 200, "-", UA.bingbot));
  }

  for (const [path, day] of [["/", 20], ["/services", 21], ["/blog/fall-furnace-tune-up", 22], ["/pricing", 24]]) {
    rows.push(line("203.0.113.42", day, 9, 5, path, 200, "-", UA.applebot));
  }

  const bytePaths = [
    ["/", 200],
    ["/services", 200],
    ["/services", 200],
    ["/services/ac-repair", 200],
    ["/services/ac-repair", 200],
    ["/services/furnace-repair", 200],
    ["/pricing", 200],
    ["/pricing", 200],
    ["/blog/fall-furnace-tune-up", 200],
    ["/blog/fall-furnace-tune-up", 200],
    ["/blog/how-to-change-a-filter", 200],
    ["/blog/how-to-change-a-filter", 200],
    ["/about", 200],
    ["/contact", 200],
    ["/sitemap.xml", 200],
    ["/wp-login.php", 404],
    ["/wp-login.php", 404],
    ["/wp-login.php", 404],
    ["/admin", 404],
  ];
  bytePaths.forEach(([path, status], i) => {
    rows.push(line("203.0.113.50", 20 + (i % 5), 1 + (i % 6), (i * 4) % 60, path, status, "-", UA.bytespider));
  });

  rows.push(line("203.0.113.51", 20, 0, 30, "/", 200, "-", UA.ccbot));
  rows.push(line("203.0.113.51", 20, 0, 36, "/blog/fall-furnace-tune-up", 200, "-", UA.ccbot));
  rows.push(line("203.0.113.51", 20, 0, 42, "/blog/how-to-change-a-filter", 200, "-", UA.ccbot));
  rows.push(line("203.0.113.51", 20, 0, 48, "/sitemap.xml", 200, "-", UA.ccbot));

  for (const path of ["/", "/services", "/pricing", "/about"]) {
    rows.push(line("203.0.113.52", 21, 11, 10, path, 200, "-", UA.amazonbot));
  }
  rows.push(line("203.0.113.53", 22, 12, 10, "/services", 200, "-", UA.amznSearch));
  rows.push(line("203.0.113.53", 22, 12, 16, "/pricing", 200, "-", UA.amznSearch));

  rows.push(line("203.0.113.54", 23, 13, 5, "/blog/fall-furnace-tune-up", 200, "-", UA.metaAgent));
  rows.push(line("203.0.113.54", 23, 13, 12, "/about", 200, "-", UA.metaAgent));
  rows.push(line("203.0.113.54", 23, 13, 18, "/services", 200, "-", UA.metaAgent));
  rows.push(line("203.0.113.54", 23, 13, 24, "/llms.txt", 200, "-", UA.metaAgent));

  const phone = "198.51.100.10";
  rows.push(line(phone, 20, 9, 2, "/", 200, "https://www.google.com/", UA.iphone));
  rows.push(line(phone, 20, 9, 3, "/services", 200, `${SITE}/`, UA.iphone));
  rows.push(line(phone, 20, 9, 4, "/services/ac-repair", 200, `${SITE}/services`, UA.iphone));
  rows.push(line(phone, 20, 9, 6, "/pricing", 200, `${SITE}/services/ac-repair`, UA.iphone));
  rows.push(line(phone, 20, 9, 8, "/contact", 200, `${SITE}/pricing`, UA.iphone));
  rows.push(line(phone, 20, 9, 1, "/favicon.ico", 200, `${SITE}/`, UA.iphone));

  const desk = "198.51.100.24";
  rows.push(line(desk, 21, 13, 10, "/", 200, "https://www.google.com/", UA.chrome));
  rows.push(line(desk, 21, 13, 12, "/pricing", 200, `${SITE}/`, UA.chrome));
  rows.push(line(desk, 21, 13, 14, "/services/furnace-repair", 200, `${SITE}/pricing`, UA.chrome));
  rows.push(line(desk, 21, 13, 16, "/contact", 200, `${SITE}/services/furnace-repair`, UA.chrome));
  rows.push(line(desk, 21, 13, 11, "/assets/site.css", 200, `${SITE}/`, UA.chrome));

  const fox = "198.51.100.30";
  rows.push(line(fox, 22, 19, 5, "/blog/how-to-change-a-filter", 200, "https://www.google.com/", UA.firefox));
  rows.push(line(fox, 22, 19, 8, "/services/maintenance-plan", 200, `${SITE}/blog/how-to-change-a-filter`, UA.firefox));
  rows.push(line(fox, 22, 19, 11, "/contact", 200, `${SITE}/services/maintenance-plan`, UA.firefox));
  rows.push(line(fox, 22, 19, 14, "/coupons", 404, `${SITE}/blog/how-to-change-a-filter`, UA.firefox));

  const mac = "198.51.100.40";
  rows.push(line(mac, 24, 11, 20, "/", 200, "https://www.bing.com/", UA.safari));
  rows.push(line(mac, 24, 11, 22, "/about", 200, `${SITE}/`, UA.safari));
  rows.push(line(mac, 24, 11, 24, "/pricing", 200, `${SITE}/about`, UA.safari));
  rows.push(line(mac, 24, 11, 28, "/service-areas/oakley", 200, `${SITE}/`, UA.safari));
  rows.push(line(mac, 24, 11, 32, "/contact", 200, `${SITE}/service-areas/oakley`, UA.safari));

  rows.push(line("203.0.113.60", 20, 4, 40, "/", 200, "-", UA.ahrefs));
  rows.push(line("203.0.113.60", 20, 4, 44, "/pricing", 200, "-", UA.ahrefs));
  rows.push(line("203.0.113.60", 20, 4, 48, "/blog/fall-furnace-tune-up", 200, "-", UA.ahrefs));
  rows.push(line("192.0.2.8", 20, 0, 1, "/", 200, "-", UA.curl));
  rows.push(line("192.0.2.8", 23, 0, 1, "/", 200, "-", UA.curl));

  const header = [
    "# Sample access log. Synthetic. Not from a real server.",
    "# sample: yes",
    "# business: Queen City Coil",
    "# place: Cincinnati, Ohio",
    "# summary: Fictional heating and cooling shop in Cincinnati. Furnace repair, air-conditioning repair, and a maintenance plan for homes around the city.",
    "# site: https://queencitycoil.example",
    "# format: Apache/Nginx combined. The three lines at the bottom are intentionally broken.",
    "",
  ];
  const broken = [
    "# The next three lines are intentionally broken so the page can show that it skips them.",
    "NOT A LOG LINE",
    '203.0.113.8 - - [21/Oct/2026:11:00:00 -0400] "GET /pricing HTTP/1.1" 200',
    '203.0.113.8 - - [21/Oct/2026:11:04:00 -0400] "GET /pricing HTTP/1.1" 22 100 "-" "Mozilla/5.0"',
  ];
  return `${header.join("\n")}${rows.join("\n")}\n${broken.join("\n")}\n`;
}

export const SAMPLE_LOG = build();
