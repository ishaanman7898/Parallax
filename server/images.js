// Finds a lead image for articles whose feed item has none, by reading the og:image or
// twitter:image tag from the top of the article page. Results are cached by link, so each
// article page is only fetched once across feed refreshes.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAX_BYTES = 300 * 1024;
const CONCURRENCY = 12;
const MAX_CACHE = 6000;

const NAMED = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", "#39": "'", "#x27": "'", "#038": "&", "#38": "&" };
const decode = (s) => s.replace(/&(#?x?[0-9a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);

// Feed and page images are often http or protocol relative. The page CSP only allows https.
function normalizeImage(raw, base) {
  if (!raw) return null;
  try {
    const url = new URL(decode(raw.trim()), base);
    if (url.protocol === "http:") url.protocol = "https:";
    if (url.protocol !== "https:" || /pixel|tracking|spacer|blank\.gif|logo|placeholder|default[-_]?(image|share|og)/i.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

const META = [
  /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["'][^>]*>/gi,
  /<meta[^>]+itemprop=["']image["'][^>]*>/gi,
  /<link[^>]+rel=["']image_src["'][^>]*>/gi
];

function extractImage(html, base) {
  for (const re of META) {
    for (const [tag] of html.matchAll(re)) {
      const value = tag.match(/(?:content|href)=["']([^"']+)["']/i)?.[1];
      const url = normalizeImage(value, base);
      if (url) return url;
    }
  }
  return null;
}

// Reads only the start of the page, stopping once </head> arrives. Redirects are followed by
// hand so every hop gets the same public host check as the original link.
async function fetchHead(link) {
  let url = link;
  let res;
  for (let hops = 0; ; hops++) {
    if (hops > 4 || !isPublicUrl(url)) throw new Error("blocked redirect");
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
      redirect: "manual",
      signal: AbortSignal.timeout(7000)
    });
    const next = res.status >= 300 && res.status < 400 && res.headers.get("location");
    if (!next) break;
    res.body?.cancel().catch(() => {});
    url = new URL(next, url).href;
  }
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  try {
    while (html.length < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return { html, url };
}

// Article links come from third party feeds, so only public web hosts are fetched. This keeps
// a feed from pointing the server at itself, the local network or a cloud metadata address.
function isPublicUrl(link) {
  try {
    const { protocol, hostname } = new URL(link);
    if (!/^https?:$/.test(protocol)) return false;
    const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !host.includes(":")) return false;
    if (host.includes(":")) return !/^(::1?|fc|fd|fe80)/.test(host) && !host.startsWith("::ffff:");
    const ip = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!ip) return true;
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    return !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224);
  } catch {
    return false;
  }
}

function createImageFinder({ fetchPage = fetchHead } = {}) {
  const cache = new Map();

  async function find(link) {
    if (cache.has(link)) return cache.get(link);
    if (!isPublicUrl(link)) return null;
    let image = null;
    try {
      const { html, url } = await fetchPage(link);
      image = extractImage(html, url);
    } catch {
      image = null;
    }
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(link, image);
    return image;
  }

  // Fills article.image in place, in the order given, and calls onImage after each find.
  // Resolves when every article is done; callers that cannot wait race it with a timer.
  async function fill(articles, onImage = () => {}) {
    const queue = articles.filter((a) => !a.image && a.link);
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const a = queue[next++];
        a.image = await find(a.link);
        onImage(a);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  }

  return { find, fill, cached: (link) => cache.get(link) };
}

module.exports = { createImageFinder, extractImage, normalizeImage, isPublicUrl };
