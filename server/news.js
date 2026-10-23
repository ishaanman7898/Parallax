const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { SOURCES, leanLabelFor } = require("./sources");
const { parseFeed } = require("./rss");
const { analyzeSentiment, analyzeLoaded } = require("./sentiment");
const { analyzeBias } = require("./bias");
const { classify } = require("./topics");
const { clusterArticles } = require("./cluster");

const TTL = 5 * 60 * 1000;
const MAX_AGE = 72 * 36e5;
const PER_FEED = 25;
const CONCURRENCY = 8;
const UA = "Mozilla/5.0 (compatible; ParallaxReader/2.0)";

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Offline mode for development and tests: reads <dir>/<source id>.xml for the first feed of each source.
function fixtureFetcher(dir) {
  return async (url) => {
    const source = SOURCES.find((s) => s.feeds[0] === url);
    if (!source) throw new Error("no fixture");
    return fs.readFile(path.join(dir, `${source.id}.xml`), "utf8");
  };
}

function analyze(item, source) {
  const text = `${item.title}. ${item.summary}`;
  const fullText = `${text} ${item.body}`;
  return {
    id: crypto.createHash("sha1").update(item.link).digest("hex").slice(0, 12),
    source: { id: source.id, name: source.name, lean: source.lean, label: leanLabelFor(source.lean), region: source.region, kind: source.kind },
    title: item.title,
    summary: item.summary,
    link: item.link,
    image: item.image,
    published: item.published,
    topic: classify(text, item.categories),
    sentiment: analyzeSentiment(text),
    loaded: analyzeLoaded(text),
    bias: analyzeBias(fullText, source.lean)
  };
}

// Runs async jobs with at most `limit` in flight.
async function pool(jobs, limit) {
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) await jobs[next++]();
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
}

async function buildNews(fetcher, now = Date.now()) {
  const seen = new Set();
  const articles = [];
  const tally = new Map(SOURCES.map((s) => [s.id, { count: 0, errors: [] }]));
  const jobs = SOURCES.flatMap((source) =>
    source.feeds.map((url) => async () => {
      const t = tally.get(source.id);
      try {
        const items = parseFeed(await fetcher(url))
          .filter((i) => !i.published || now - Date.parse(i.published) < MAX_AGE)
          .slice(0, PER_FEED);
        for (const item of items) {
          if (seen.has(item.link)) continue;
          seen.add(item.link);
          articles.push(analyze(item, source));
          t.count++;
        }
      } catch (err) {
        t.errors.push(err.message);
      }
    })
  );
  await pool(jobs, CONCURRENCY);
  const status = SOURCES.map((s) => {
    const { count, errors } = tally.get(s.id);
    return { id: s.id, name: s.name, lean: s.lean, label: leanLabelFor(s.lean), region: s.region, kind: s.kind, ok: count > 0, count, error: count ? null : errors[0] || "empty feed" };
  });
  return { updated: new Date(now).toISOString(), sample: false, sources: status, articleCount: articles.length, clusters: clusterArticles(articles, now) };
}

function createNewsService({ fetcher = process.env.PARALLAX_FIXTURES ? fixtureFetcher(process.env.PARALLAX_FIXTURES) : fetchText, ttl = TTL } = {}) {
  let cache = null;
  let pending = null;
  return async function getNews() {
    if (cache && Date.now() - cache.at < ttl) return cache.data;
    if (!pending) {
      pending = buildNews(fetcher)
        .then((data) => {
          // Keep serving the last good result when every feed fails.
          if (data.articleCount || !cache) cache = { data, at: Date.now() };
          return cache.data;
        })
        .finally(() => (pending = null));
    }
    return pending;
  };
}

module.exports = { createNewsService, buildNews, fixtureFetcher };
