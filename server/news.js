const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { SOURCES, leanLabelFor } = require("./sources");
const { parseFeed } = require("./rss");
const { analyzeSentiment, analyzeLoaded } = require("./sentiment");
const { analyzeBias, leanLabel, LEFT, RIGHT } = require("./bias");
const { classify } = require("./topics");
const { clusterArticles } = require("./cluster");
const { createLeanModel } = require("./lean-model");
const { createImageFinder } = require("./images");

const TTL = 5 * 60 * 1000;
const MAX_AGE = 72 * 36e5;
const PER_FEED = 25;
const CONCURRENCY = 16;
// How long the first response waits for article page images. The rest keep loading in the
// background and show up in the cached result as they arrive.
const IMAGE_WAIT = 2500;
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

// Rated outlets keep their published lean. Unrated outlets take the model estimate when there is one.
function describeSource(source, estimate) {
  const estimated = source.lean == null && estimate != null;
  const lean = estimated ? estimate.lean : source.lean;
  const label = source.nonpolitical ? "Nonpolitical" : estimated ? `${leanLabel(lean / 2)} (est.)` : leanLabelFor(source.lean);
  const ratedBy = source.lean != null ? source.ratedBy || "AllSides" : estimated ? "Phrase model" : null;
  return { id: source.id, name: source.name, lean, rated: source.lean != null, ratedBy, estimated, nonpolitical: !!source.nonpolitical, label, region: source.region, kind: source.kind };
}

const phraseWeight = (found, dict) => found.reduce((s, p) => s + dict[p], 0);

function analyze(item, source) {
  const text = `${item.title}. ${item.summary}`;
  return {
    id: crypto.createHash("sha1").update(item.link).digest("hex").slice(0, 12),
    source: describeSource(source, null),
    title: item.title,
    summary: item.summary,
    link: item.link,
    image: item.image,
    published: item.published,
    topic: classify(text, item.categories),
    sentiment: analyzeSentiment(text),
    loaded: analyzeLoaded(text),
    bias: null
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

const delay = (ms) => new Promise((r) => setTimeout(r, ms).unref?.());

async function buildNews(fetcher, now = Date.now(), { images = null, leanModel = createLeanModel(), onProgress = () => {} } = {}) {
  const seen = new Set();
  const collected = [];
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
          collected.push({ item, source, article: analyze(item, source) });
          t.count++;
        }
      } catch (err) {
        t.errors.push(err.message);
      }
    })
  );
  let done = 0;
  const total = jobs.length;
  onProgress({ phase: "feeds", done, total });
  await pool(jobs.map((job) => () => job().finally(() => onProgress({ phase: "feeds", done: ++done, total }))), CONCURRENCY);
  onProgress({ phase: "analyzing", done, total });

  // Add this cycle's framing phrases to the outlet evidence, then score every article.
  const texts = collected.map(({ item }) => `${item.title}. ${item.summary} ${item.body}`);
  const evidence = collected
    .map(({ source, article }, i) => {
      const { framing } = analyzeBias(texts[i], null);
      return { id: article.id, outlet: source.id, left: phraseWeight(framing.left, LEFT), right: phraseWeight(framing.right, RIGHT), nonpolitical: source.nonpolitical };
    })
    .filter((e) => !e.nonpolitical);
  const model = leanModel.update(evidence, SOURCES.filter((s) => !s.nonpolitical));
  collected.forEach(({ source, article }, i) => {
    article.source = describeSource(source, model.outlets.get(source.id));
    article.bias = analyzeBias(texts[i], article.source.lean, article.source.estimated);
  });
  const articles = collected.map((c) => c.article);

  const status = SOURCES.map((s) => {
    const { count, errors } = tally.get(s.id);
    const info = describeSource(s, model.outlets.get(s.id));
    return { ...info, ok: count > 0, count, error: count ? null : errors[0] || "empty feed" };
  });
  const clusters = clusterArticles(articles, now);
  const news = {
    updated: new Date(now).toISOString(),
    sample: false,
    sources: status,
    articleCount: articles.length,
    model: {
      ready: model.ready,
      trainedOn: model.trainedOn,
      evidence: model.evidence,
      estimated: model.outlets.size,
      validation: model.validation
    },
    imagesPending: 0,
    clusters
  };

  if (images) {
    // Top ranked stories first, so what shows on screen fills in before the long tail.
    const owner = new Map();
    clusters.forEach((c) => c.articles.forEach((a) => owner.set(a, c)));
    const queue = clusters.flatMap((c) => c.articles).filter((a) => !a.image && a.link);
    news.imagesPending = queue.length;
    onProgress({ phase: "images", done: 0, total: queue.length });
    const fill = images.fill(queue, (a) => {
      news.imagesPending--;
      const c = owner.get(a);
      if (a.image && c && !c.image) c.image = a.image;
    });
    await Promise.race([fill, delay(IMAGE_WAIT)]);
  }
  onProgress({ phase: "ready", done: total, total });
  return news;
}

function createNewsService({
  fetcher = process.env.PARALLAX_FIXTURES ? fixtureFetcher(process.env.PARALLAX_FIXTURES) : fetchText,
  images = process.env.PARALLAX_FIXTURES ? null : createImageFinder(),
  dataDir = process.env.PARALLAX_DATA || null,
  ttl = TTL
} = {}) {
  const leanModel = createLeanModel({ dataDir });
  let cache = null;
  let pending = null;
  let progress = { phase: "idle", done: 0, total: 0 };
  async function getNews() {
    if (cache && Date.now() - cache.at < ttl) return cache.data;
    if (!pending) {
      pending = buildNews(fetcher, Date.now(), { images, leanModel, onProgress: (p) => (progress = p) })
        .then((data) => {
          // Keep serving the last good result when every feed fails.
          if (data.articleCount || !cache) cache = { data, at: Date.now() };
          return cache.data;
        })
        .finally(() => (pending = null));
    }
    return pending;
  }
  // Load progress for the startup screen. Once a result is cached it reports ready.
  getNews.progress = () => (cache && !pending ? { phase: "ready", done: 1, total: 1, sources: SOURCES.length } : { ...progress, sources: SOURCES.length });
  return getNews;
}

module.exports = { createNewsService, buildNews, fixtureFetcher };
