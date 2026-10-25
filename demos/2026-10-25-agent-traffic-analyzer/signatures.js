// Vendor-documented agents and a few other clients that should not be
// counted as people. Match tokens are case-insensitive. Longer tokens are
// tried first so Applebot-Extended is not read as Applebot.

export const ROLES = {
  user: {
    id: "user",
    label: "Person using an assistant",
    legend: "Assistant, live",
    hint: "A person triggered this fetch",
  },
  training: {
    id: "training",
    label: "Training crawler",
    legend: "Training",
    hint: "Vendor says the crawl may train a model",
  },
  corpus: {
    id: "corpus",
    label: "Public crawl corpus",
    legend: "Corpus",
    hint: "Open crawl archive, not a chat product",
  },
  "ai-search": {
    id: "ai-search",
    label: "AI search crawler",
    legend: "AI search",
    hint: "Builds answers or an AI search index",
  },
  search: {
    id: "search",
    label: "Search engine",
    legend: "Search",
    hint: "Ordinary search index",
  },
  ads: {
    id: "ads",
    label: "Ads crawler",
    legend: "Ads",
    hint: "Checks pages tied to ads",
  },
  preview: {
    id: "preview",
    label: "Link preview",
    legend: "Preview",
    hint: "Builds a share card",
  },
  seo: {
    id: "seo",
    label: "SEO crawler",
    legend: "SEO",
    hint: "A rank-tracking tool",
  },
  token: {
    id: "token",
    label: "robots.txt control",
    legend: "robots.txt token",
    hint: "Documented as a control, not a crawler that fetches pages",
  },
  tool: {
    id: "tool",
    label: "Script or library",
    legend: "Script",
    hint: "curl, a library, or a headless browser",
  },
  other: {
    id: "other",
    label: "Other crawler",
    legend: "Other crawler",
    hint: "Looks automated, and it is not in the vendor list",
  },
  human: {
    id: "human",
    label: "Likely person",
    legend: "Person",
    hint: "Looks like a normal browser",
  },
  unknown: {
    id: "unknown",
    label: "Unrecognized",
    legend: "Unrecognized",
    hint: "No signature and not a normal browser",
  },
};

/** @type {Array<Signature>} */
export const SIGNATURES = [
  {
    id: "gptbot",
    token: "GPTBot",
    robotsToken: "GPTBot",
    name: "GPTBot",
    vendor: "OpenAI",
    role: "training",
    robots: "disallow",
    summary: "Crawls pages that may be used to train OpenAI’s foundation models.",
    clause: "OpenAI says GPTBot crawls pages that may be used to train its models.",
    robotsNote: "OpenAI’s documented opt-out for training.",
    doc: "https://developers.openai.com/api/docs/bots",
    docLabel: "OpenAI crawlers",
    example:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot",
  },
  {
    id: "oai-searchbot",
    token: "OAI-SearchBot",
    robotsToken: "OAI-SearchBot",
    name: "OAI-SearchBot",
    vendor: "OpenAI",
    role: "ai-search",
    robots: "allow",
    summary:
      "Surfaces pages in ChatGPT search. OpenAI says this setting is separate from GPTBot, and that a disallow keeps the site out of ChatGPT search answers.",
    clause: "OpenAI says OAI-SearchBot is for ChatGPT search, not for training.",
    robotsNote: "Disallow this one, not ChatGPT-User, to opt out of ChatGPT search.",
    doc: "https://developers.openai.com/api/docs/bots",
    docLabel: "OpenAI crawlers",
    example:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot",
  },
  {
    id: "chatgpt-user",
    token: "ChatGPT-User",
    robotsToken: "ChatGPT-User",
    name: "ChatGPT-User",
    vendor: "OpenAI",
    role: "user",
    askAs: "ChatGPT",
    robots: "allow",
    summary:
      "Fetches a page because someone using ChatGPT or a Custom GPT asked. OpenAI says it is not an automatic crawl, and that robots.txt may not apply.",
    clause: "OpenAI says ChatGPT-User is a person using ChatGPT, not the training crawler.",
    robotsNote: "OpenAI says robots.txt may not apply, because a person triggered the fetch.",
    doc: "https://developers.openai.com/api/docs/bots",
    docLabel: "OpenAI crawlers",
    example:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  },
  {
    id: "oai-adsbot",
    token: "OAI-AdsBot",
    robotsToken: "OAI-AdsBot",
    name: "OAI-AdsBot",
    vendor: "OpenAI",
    role: "ads",
    robots: "allow",
    summary:
      "Visits landing pages submitted as ads on ChatGPT. OpenAI says this data is not used to train foundation models.",
    clause: "OpenAI says OAI-AdsBot checks ad landing pages and is not a training crawl.",
    robotsNote: "Only fetches pages submitted as ads.",
    doc: "https://developers.openai.com/api/docs/bots",
    docLabel: "OpenAI crawlers",
    example:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-AdsBot/1.0; +https://openai.com/adsbot",
  },
  {
    id: "claudebot",
    token: "ClaudeBot",
    robotsToken: "ClaudeBot",
    name: "ClaudeBot",
    vendor: "Anthropic",
    role: "training",
    robots: "disallow",
    summary:
      "Collects pages Anthropic says could contribute to model training. A disallow is how they say to keep future material out of training sets.",
    clause: "Anthropic says ClaudeBot collects pages that could contribute to training.",
    robotsNote: "Anthropic’s documented opt-out for training.",
    doc: "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    docLabel: "Anthropic crawlers",
    example: "Mozilla/5.0 (compatible; ClaudeBot/1.0)",
  },
  {
    id: "claude-searchbot",
    token: "Claude-SearchBot",
    robotsToken: "Claude-SearchBot",
    name: "Claude-SearchBot",
    vendor: "Anthropic",
    role: "ai-search",
    robots: "allow",
    summary:
      "Indexes pages to improve Claude search. Anthropic says a disallow can reduce how accurately the site shows up in search answers.",
    clause: "Anthropic says Claude-SearchBot improves search results, separate from ClaudeBot.",
    robotsNote: "Search index. Separate from ClaudeBot.",
    doc: "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    docLabel: "Anthropic crawlers",
    example: "Mozilla/5.0 (compatible; Claude-SearchBot/1.0)",
  },
  {
    id: "claude-user",
    token: "Claude-User",
    robotsToken: "Claude-User",
    name: "Claude-User",
    vendor: "Anthropic",
    role: "user",
    askAs: "Claude",
    robots: "allow",
    summary:
      "Fetches a page when someone asks Claude a question. Anthropic says a disallow stops those user-triggered fetches.",
    clause: "Anthropic says Claude-User fetches pages for people using Claude.",
    robotsNote: "User-triggered fetches.",
    doc: "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    docLabel: "Anthropic crawlers",
    example: "Mozilla/5.0 (compatible; Claude-User/1.0)",
  },
  {
    id: "perplexitybot",
    token: "PerplexityBot",
    robotsToken: "PerplexityBot",
    name: "PerplexityBot",
    vendor: "Perplexity",
    role: "ai-search",
    robots: "allow",
    summary:
      "Indexes pages so they can appear in Perplexity search. Perplexity says it is not used to train foundation models, and that it follows robots.txt.",
    clause: "Perplexity says PerplexityBot is their search index, not a training crawl.",
    robotsNote: "Search index. Perplexity says this one follows robots.txt.",
    doc: "https://docs.perplexity.ai/docs/resources/perplexity-crawlers",
    docLabel: "Perplexity crawlers",
    example:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  },
  {
    id: "perplexity-user",
    token: "Perplexity-User",
    robotsToken: "Perplexity-User",
    name: "Perplexity-User",
    vendor: "Perplexity",
    role: "user",
    askAs: "Perplexity",
    robots: "allow",
    summary:
      "Fetches a page when someone asks Perplexity a question. Perplexity says this fetcher generally ignores robots.txt, because a person requested it.",
    clause: "Perplexity says Perplexity-User fetches a page for someone asking a question.",
    robotsNote: "Perplexity says this fetcher generally ignores robots.txt.",
    doc: "https://docs.perplexity.ai/docs/resources/perplexity-crawlers",
    docLabel: "Perplexity crawlers",
    example:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
  },
  {
    id: "google-extended",
    token: "Google-Extended",
    robotsToken: "Google-Extended",
    name: "Google-Extended",
    vendor: "Google",
    role: "token",
    robots: "disallow",
    expectsInLogs: false,
    summary:
      "A robots.txt control for whether crawled content may help train Gemini models. Google says using it does not affect inclusion in Search. It is not the crawler user agent; Googlebot does the fetching.",
    clause:
      "Google documents Google-Extended as a robots.txt control for Gemini training, not as the crawler that fetches pages. A log line carrying this token is unexpected.",
    robotsNote: "Not seen as its own crawler. Disallow opts out of Gemini training use and does not, by itself, remove the site from Search.",
    doc: "https://developers.google.com/crawling/docs/about-crawling",
    docLabel: "Google on Google-Extended",
    example: "Mozilla/5.0 (compatible; Google-Extended/1.0)",
  },
  {
    id: "googlebot-image",
    token: "Googlebot-Image",
    robotsToken: "Googlebot-Image",
    name: "Googlebot-Image",
    vendor: "Google",
    role: "search",
    robots: "allow",
    summary: "Google’s image crawler. Google documents a separate user agent, Googlebot-Image/1.0.",
    clause: "Googlebot-Image is Google’s image crawler.",
    robotsNote: "Image indexing. Googlebot rules also apply.",
    doc: "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers",
    docLabel: "Google’s common crawlers",
    example: "Googlebot-Image/1.0",
  },
  {
    id: "googlebot-video",
    token: "Googlebot-Video",
    robotsToken: "Googlebot-Video",
    name: "Googlebot-Video",
    vendor: "Google",
    role: "search",
    robots: "allow",
    summary: "Google’s video crawler.",
    clause: "Googlebot-Video is Google’s video crawler.",
    robotsNote: "Video indexing.",
    doc: "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers",
    docLabel: "Google’s common crawlers",
    example: "Googlebot-Video/1.0",
  },
  {
    id: "google-inspection",
    token: "Google-InspectionTool",
    robotsToken: "Google-InspectionTool",
    name: "Google-InspectionTool",
    vendor: "Google",
    role: "search",
    robots: "allow",
    summary:
      "Used by Search Console URL inspection and the Rich Results test. It is not a training crawler.",
    clause: "Google-InspectionTool is a Search testing fetcher.",
    robotsNote: "Search testing tools.",
    doc: "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers",
    docLabel: "Google’s common crawlers",
    example: "Mozilla/5.0 (compatible; Google-InspectionTool/1.0)",
  },
  {
    id: "storebot-google",
    token: "Storebot-Google",
    robotsToken: "Storebot-Google",
    name: "Storebot-Google",
    vendor: "Google",
    role: "search",
    robots: "allow",
    summary: "Crawls pages for Google Shopping surfaces.",
    clause: "Storebot-Google crawls for Google Shopping.",
    robotsNote: "Shopping surfaces.",
    doc: "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers",
    docLabel: "Google’s common crawlers",
    example:
      "Mozilla/5.0 (X11; Linux x86_64; Storebot-Google/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
  {
    id: "googlebot",
    token: "Googlebot",
    robotsToken: "Googlebot",
    name: "Googlebot",
    vendor: "Google",
    role: "search",
    robots: "allow",
    summary:
      "Google Search’s crawler (the smartphone string and the desktop string both use this token). Search ranking is separate from the Google-Extended training control.",
    clause: "Googlebot is Google Search’s crawler.",
    robotsNote: "Search. Blocking Googlebot is not the Gemini opt-out; that token is Google-Extended.",
    doc: "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers",
    docLabel: "Google’s common crawlers",
    example:
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.69 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  },
  {
    id: "bingbot",
    token: "bingbot",
    robotsToken: "bingbot",
    name: "Bingbot",
    vendor: "Microsoft",
    role: "search",
    robots: "allow",
    summary: "Bing’s main crawler. Microsoft documents desktop and mobile strings, and says the string alone is not proof.",
    clause: "Bingbot is Bing’s search crawler.",
    robotsNote: "Bing Search.",
    doc: "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0",
    docLabel: "Bing crawlers",
    example:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/131.0.0.0 Safari/537.36",
  },
  {
    id: "applebot-extended",
    token: "Applebot-Extended",
    robotsToken: "Applebot-Extended",
    name: "Applebot-Extended",
    vendor: "Apple",
    role: "token",
    robots: "disallow",
    expectsInLogs: false,
    summary:
      "Apple says Applebot-Extended does not crawl webpages. It is a robots.txt control for whether content already crawled by Applebot may train Apple’s foundation models. A disallow still leaves the page available to Applebot for Search, Siri, and Spotlight.",
    clause:
      "Apple says Applebot-Extended does not crawl pages. It only controls training use of what Applebot already fetched. A log line with this token is unexpected.",
    robotsNote: "Not a crawler. Disallow opts out of Apple foundation-model training and does not, by itself, stop Applebot.",
    doc: "https://support.apple.com/en-us/119829",
    docLabel: "About Applebot",
    example: "Mozilla/5.0 (compatible; Applebot-Extended/1.0)",
  },
  {
    id: "applebot",
    token: "Applebot",
    robotsToken: "Applebot",
    name: "Applebot",
    vendor: "Apple",
    role: "search",
    robots: "allow",
    summary:
      "Apple’s search crawler. Apple says the user agent contains “Applebot”. Training use is controlled separately with Applebot-Extended.",
    clause: "Applebot is Apple’s search crawler.",
    robotsNote: "Search, Siri, and Spotlight. Training opt-out is Applebot-Extended.",
    doc: "https://support.apple.com/en-us/119829",
    docLabel: "About Applebot",
    example:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
  },
  {
    id: "bytespider",
    token: "Bytespider",
    robotsToken: "Bytespider",
    name: "Bytespider",
    vendor: "ByteDance",
    role: "search",
    robots: "allow",
    summary:
      "The crawler token ByteDance publishes for Toutiao Search. Strings in the wild append https://zhanzhang.toutiao.com/ or spider-feedback@bytedance.com. This page files it as that search crawler. It does not file it as a training crawler, because ByteDance’s search docs describe indexing, not model training.",
    clause: "Bytespider is the token ByteDance publishes for Toutiao Search.",
    robotsNote: "Toutiao Search. Disallow it here if you do not want that index. ByteDance’s own page is the source for what the token means.",
    doc: "https://zhanzhang.toutiao.com/page/outer/docs/26899",
    docLabel: "Toutiao Search webmaster docs",
    example:
      "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; https://zhanzhang.toutiao.com/)",
  },
  {
    id: "ccbot",
    token: "CCBot",
    robotsToken: "CCBot",
    name: "CCBot",
    vendor: "Common Crawl",
    role: "corpus",
    robots: "disallow",
    summary:
      "Common Crawl’s crawler. They publish an open corpus of the web. Common Crawl is not a chat product; other projects build training sets from the corpus. They warn that some clients fake this user agent.",
    clause: "CCBot is Common Crawl’s crawler for its public web corpus.",
    robotsNote: "Opt out of the public corpus. Common Crawl says to verify the IP, because the name is copied.",
    doc: "https://commoncrawl.org/ccbot",
    docLabel: "CCBot",
    example: "CCBot/2.0 (https://commoncrawl.org/faq/)",
  },
  {
    id: "amazonbot",
    token: "Amazonbot",
    robotsToken: "Amazonbot",
    name: "Amazonbot",
    vendor: "Amazon",
    role: "training",
    robots: "disallow",
    summary:
      "Amazon says Amazonbot improves products and services and may be used to train Amazon AI models.",
    clause: "Amazon says Amazonbot may be used to train Amazon AI models.",
    robotsNote: "Amazon’s documented training crawler. Amzn-SearchBot and Amzn-User are separate.",
    doc: "https://developer.amazon.com/amazonbot",
    docLabel: "About Amazonbot",
    example:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1) Chrome/131.0.0.0 Safari/537.36",
  },
  {
    id: "amzn-searchbot",
    token: "Amzn-SearchBot",
    robotsToken: "Amzn-SearchBot",
    name: "Amzn-SearchBot",
    vendor: "Amazon",
    role: "ai-search",
    robots: "allow",
    summary:
      "Amazon says this bot improves search in products such as Alexa, and that it does not crawl content for generative AI training.",
    clause: "Amazon says Amzn-SearchBot is for search products such as Alexa, not for training.",
    robotsNote: "Search. Amazon says this is not the training crawler.",
    doc: "https://developer.amazon.com/amazonbot",
    docLabel: "About Amazonbot",
    example:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-SearchBot/0.1) Chrome/131.0.0.0 Safari/537.36",
  },
  {
    id: "amzn-user",
    token: "Amzn-User",
    robotsToken: "Amzn-User",
    name: "Amzn-User",
    vendor: "Amazon",
    role: "user",
    askAs: "Alexa",
    robots: "allow",
    summary:
      "Amazon says Amzn-User fetches live pages for a person’s request, such as an Alexa question, and that it does not crawl for model training. Because a person can trigger it, it may not follow every robots.txt rule.",
    clause: "Amazon says Amzn-User fetches a page for a person’s request.",
    robotsNote: "User-triggered. Amazon says it may not follow every robots.txt rule.",
    doc: "https://developer.amazon.com/amazonbot",
    docLabel: "About Amazonbot",
    example:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-User/0.1) Chrome/131.0.0.0 Safari/537.36",
  },
  {
    id: "meta-externalagent",
    token: "meta-externalagent",
    robotsToken: "meta-externalagent",
    name: "Meta-ExternalAgent",
    vendor: "Meta",
    role: "training",
    robots: "disallow",
    summary:
      "Meta says this crawler trains foundation models or improves products by indexing content directly. The log string looks like meta-externalagent/1.1.",
    clause: "Meta says Meta-ExternalAgent trains foundation models or indexes content for its products.",
    robotsNote: "Meta’s documented token for this crawler is meta-externalagent.",
    doc: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/",
    docLabel: "Meta web crawlers",
    example:
      "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/web-crawlers)",
  },
  {
    id: "meta-externalfetcher",
    token: "meta-externalfetcher",
    robotsToken: "meta-externalfetcher",
    name: "Meta-ExternalFetcher",
    vendor: "Meta",
    role: "user",
    askAs: "Meta AI",
    robots: "allow",
    summary:
      "Meta says this crawler fetches individual links a person asked for, including agent-style tasks, and that it may bypass robots.txt because the fetch was user-initiated.",
    clause: "Meta says Meta-ExternalFetcher fetches a link a person asked for.",
    robotsNote: "User-triggered. Meta says it may bypass robots.txt.",
    doc: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/",
    docLabel: "Meta web crawlers",
    example:
      "meta-externalfetcher/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  },
  {
    id: "meta-webindexer",
    token: "meta-webindexer",
    robotsToken: "meta-webindexer",
    name: "Meta-WebIndexer",
    vendor: "Meta",
    role: "ai-search",
    robots: "allow",
    summary:
      "Meta says this crawler improves Meta AI search quality, and that allowing it helps them cite your pages.",
    clause: "Meta says Meta-WebIndexer is for Meta AI search.",
    robotsNote: "Meta AI search citations.",
    doc: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/",
    docLabel: "Meta web crawlers",
    example: "meta-webindexer/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/web-crawlers)",
  },
  {
    id: "meta-externalads",
    token: "meta-externalads",
    robotsToken: "meta-externalads",
    name: "Meta-ExternalAds",
    vendor: "Meta",
    role: "ads",
    robots: "allow",
    summary: "Meta says this crawler is for advertising and other business products, not the training crawler.",
    clause: "Meta says Meta-ExternalAds is for ads and business products.",
    robotsNote: "Ads crawler.",
    doc: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/",
    docLabel: "Meta web crawlers",
    example: "meta-externalads/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/web-crawlers)",
  },
  {
    id: "facebookexternalhit",
    token: "facebookexternalhit",
    robotsToken: "facebookexternalhit",
    name: "facebookexternalhit",
    vendor: "Meta",
    role: "preview",
    robots: "allow",
    summary:
      "Builds the title, description, and thumbnail when someone shares a link on Facebook, Instagram, or Messenger. This is not Meta-ExternalAgent and not a person browsing.",
    clause: "facebookexternalhit builds a share card. It is not the training crawler.",
    robotsNote: "Link previews. Meta says it can bypass robots.txt for safety checks.",
    doc: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/",
    docLabel: "Meta web crawlers",
    example: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  },
  {
    id: "ahrefsbot",
    token: "AhrefsBot",
    robotsToken: "AhrefsBot",
    name: "AhrefsBot",
    vendor: "Ahrefs",
    role: "seo",
    robots: "omit",
    summary: "Ahrefs’s SEO crawler. Included so it is not counted as a person or as an AI assistant.",
    clause: "AhrefsBot is an SEO crawler, not an assistant.",
    robotsNote: "",
    doc: "https://ahrefs.com/robot",
    docLabel: "AhrefsBot",
    example: "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot)",
  },
  {
    id: "semrushbot",
    token: "SemrushBot",
    robotsToken: "SemrushBot",
    name: "SemrushBot",
    vendor: "Semrush",
    role: "seo",
    robots: "omit",
    summary: "Semrush’s SEO crawler. Included so it is not counted as a person.",
    clause: "SemrushBot is an SEO crawler, not an assistant.",
    robotsNote: "",
    doc: "https://www.semrush.com/bot/",
    docLabel: "SemrushBot",
    example: "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
  },
];

const TOOLS = [
  { token: "python-requests", name: "python-requests" },
  { token: "Go-http-client", name: "Go-http-client" },
  { token: "HeadlessChrome", name: "HeadlessChrome" },
  { token: "curl/", name: "curl" },
  { token: "Wget", name: "Wget" },
  { token: "Scrapy", name: "Scrapy" },
];

const MATCHES = [...SIGNATURES].sort(
  (a, b) => b.token.length - a.token.length || a.token.localeCompare(b.token),
);

const BROWSER = /Mozilla\/5\.0/i;
const ENGINE = /(Chrome|Chromium|Firefox|Safari|Edg|OPR|SamsungBrowser|CriOS|FxiOS|Trident|MSIE)/i;
const IGNORE_FALLBACK = new Set(["cubot", "robot"]);

function hasToken(ua, token) {
  const hay = ua.toLowerCase();
  const needle = token.toLowerCase();
  let from = 0;
  while (from <= hay.length - needle.length) {
    const i = hay.indexOf(needle, from);
    if (i < 0) return false;
    const before = i === 0 ? "" : hay[i - 1];
    const after = i + needle.length >= hay.length ? "" : hay[i + needle.length];
    const word = (c) => /[a-z0-9]/i.test(c);
    if (!word(before) && !word(after)) return true;
    from = i + 1;
  }
  return false;
}

function fromSignature(sig) {
  return {
    id: sig.id,
    name: sig.name,
    vendor: sig.vendor,
    role: sig.role,
    askAs: sig.askAs || null,
    summary: sig.summary,
    clause: sig.clause,
    robots: sig.robots,
    robotsToken: sig.robotsToken,
    robotsNote: sig.robotsNote,
    expectsInLogs: sig.expectsInLogs !== false,
    doc: sig.doc,
    docLabel: sig.docLabel,
  };
}

function toolHit(name) {
  return {
    id: "tool:" + name.toLowerCase(),
    name,
    vendor: "",
    role: "tool",
    askAs: null,
    summary: "A command-line tool, an HTTP library, or a headless browser. Not one of the vendor agents above.",
    clause: name + " is a script or library, not a documented assistant.",
    robots: "omit",
    robotsToken: "",
    robotsNote: "",
    expectsInLogs: true,
    doc: "",
    docLabel: "",
  };
}

function otherCrawler(name) {
  return {
    id: "other:" + name.toLowerCase(),
    name,
    vendor: "",
    role: "other",
    askAs: null,
    summary: "The user agent looks automated, and it is not in the vendor list on this page. That list is not every crawler on the web.",
    clause: name + " looks like a crawler this page does not have a vendor page for.",
    robots: "omit",
    robotsToken: "",
    robotsNote: "",
    expectsInLogs: true,
    doc: "",
    docLabel: "",
  };
}

function human() {
  return {
    id: "human",
    name: "Likely person",
    vendor: "",
    role: "human",
    askAs: null,
    summary: "A normal browser string, with none of the agent tokens above.",
    clause: "",
    robots: "omit",
    robotsToken: "",
    robotsNote: "",
    expectsInLogs: true,
    doc: "",
    docLabel: "",
  };
}

function unknown() {
  return {
    id: "unknown",
    name: "Unrecognized",
    vendor: "",
    role: "unknown",
    askAs: null,
    summary: "No documented agent token, and it does not look like a current browser.",
    clause: "",
    robots: "omit",
    robotsToken: "",
    robotsNote: "",
    expectsInLogs: true,
    doc: "",
    docLabel: "",
  };
}

function fallbackBotName(ua) {
  const re = /([A-Za-z][\w.+~-]*?(?:bot|spider|crawler))/gi;
  const found = [];
  let match;
  while ((match = re.exec(ua))) {
    const token = match[1];
    if (IGNORE_FALLBACK.has(token.toLowerCase())) continue;
    if (token.length < 5) continue;
    const after = ua[match.index + token.length] || "";
    const before = ua.slice(Math.max(0, match.index - 14), match.index).toLowerCase();
    let score = 0;
    if (before.includes("compatible")) score += 5;
    if (after === "/" || after === ";") score += 3;
    if (/[A-Z]/.test(token.slice(1)) || token.includes("-")) score += 1;
    found.push({ token, score, index: match.index });
  }
  if (!found.length) return "";
  found.sort((a, b) => b.score - a.score || a.index - b.index);
  return found[0].token;
}

export function classifyUa(ua) {
  const raw = ua == null ? "" : String(ua).trim();
  if (!raw || raw === "-") return unknown();
  for (const sig of MATCHES) {
    if (hasToken(raw, sig.token)) return fromSignature(sig);
  }
  const lower = raw.toLowerCase();
  for (const tool of TOOLS) {
    if (lower.includes(tool.token.toLowerCase())) return toolHit(tool.name);
  }
  const guessed = fallbackBotName(raw);
  if (guessed) return otherCrawler(guessed);
  if (BROWSER.test(raw) && ENGINE.test(raw)) return human();
  return unknown();
}

export function signatureById(id) {
  return SIGNATURES.find((sig) => sig.id === id) || null;
}

/**
 * @typedef {object} Signature
 * @property {string} id
 * @property {string} token
 * @property {string} robotsToken
 * @property {string} name
 * @property {string} vendor
 * @property {string} role
 * @property {string} [askAs]
 * @property {string} summary
 * @property {string} clause
 * @property {'allow'|'disallow'|'omit'} robots
 * @property {string} robotsNote
 * @property {boolean} [expectsInLogs]
 * @property {string} doc
 * @property {string} docLabel
 * @property {string} example
 */
