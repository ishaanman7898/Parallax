const crypto = require("crypto");
const { leanLabel } = require("./bias");

const STOP = new Set(("the a an and or but of to in on at for from by with as is are was were be been has have had it its this that these those " +
  "after over into about amid says said say will would could can may new more than not his her their they he she we you who what " +
  "why how when where which while up out off down just also first last year years week day days time back one two three us news " +
  "live video watch update latest report reports").split(" "));

const THRESHOLD = 0.32;

// Tokens with light plural stemming, title counted twice.
function terms(article) {
  const words = (article.title + " " + article.title + " " + article.summary).toLowerCase().match(/[a-z0-9]+/g) || [];
  return words.filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

function tfidf(docs) {
  const df = new Map();
  docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  return docs.map((d) => {
    const v = new Map();
    d.forEach((t) => v.set(t, (v.get(t) || 0) + 1));
    for (const [t, n] of v) v.set(t, n * Math.log(1 + docs.length / df.get(t)));
    return normalize(v);
  });
}

function normalize(v) {
  let norm = 0;
  for (const x of v.values()) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (const [t, x] of v) v.set(t, x / norm);
  return v;
}

function cosine(a, b) {
  let dot = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const [t, x] of small) dot += x * (big.get(t) || 0);
  return dot;
}

const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
// Estimated leans are fractional, so the cut points sit between center (0) and lean left or right (±1).
const bucket = (lean) => (lean == null ? "unrated" : lean <= -0.4 ? "left" : lean >= 0.4 ? "right" : "center");
const byScore = (a, b) => (a.bias.score ?? Infinity) - (b.bias.score ?? Infinity);
const mode = (xs) => Object.entries(xs.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1])[0]?.[0];

function summarize(members, now) {
  const articles = members.map((m) => m.article).sort(byScore);
  const coverage = { left: 0, center: 0, right: 0, unrated: 0 };
  const sources = new Set();
  for (const a of articles) {
    if (!sources.has(a.source.id)) coverage[bucket(a.source.lean)]++;
    sources.add(a.source.id);
  }
  // Lead with an article that has an image, preferring rated outlets closest to center.
  const distance = (a) => (a.source.lean == null ? 1.5 : Math.abs(a.source.lean));
  const lead = [...articles].sort((a, b) => !!b.image - !!a.image || distance(a) - distance(b))[0];
  const latest = articles.reduce((t, a) => (a.published > t ? a.published : t), "");
  const scored = articles.filter((a) => a.bias.score != null);
  const lean = scored.length ? avg(scored.map((a) => a.bias.score)) : null;
  const hours = latest ? (now - Date.parse(latest)) / 36e5 : 48;
  const rated = coverage.left + coverage.center + coverage.right;
  let blindspot = null;
  if (rated >= 3 && (coverage.left === 0) !== (coverage.right === 0)) {
    blindspot = coverage.left === 0 ? "Little coverage from left leaning sources" : "Little coverage from right leaning sources";
  }
  return {
    id: crypto.createHash("sha1").update(lead.link).digest("hex").slice(0, 10),
    title: lead.title,
    summary: lead.summary,
    image: lead.image || articles.find((a) => a.image)?.image || null,
    topic: mode(articles.map((a) => a.topic)),
    published: latest,
    sourceCount: sources.size,
    regions: [...new Set(articles.map((a) => a.source.region))],
    coverage,
    blindspot,
    lean: lean == null ? { score: null, label: "Unrated" } : { score: Math.round(lean * 100) / 100, label: leanLabel(lean) },
    sentiment: Math.round(avg(articles.map((a) => a.sentiment.compound)) * 1000) / 1000,
    rank: sources.size * 3 + articles.length + Math.max(0, 24 - hours) / 6,
    articles
  };
}

// Greedy single-pass clustering against running centroids, newest articles first.
function clusterArticles(articles, now = Date.now()) {
  const sorted = [...articles].sort((a, b) => (b.published || "").localeCompare(a.published || ""));
  const vectors = tfidf(sorted.map(terms));
  const clusters = [];
  sorted.forEach((article, i) => {
    let best = null;
    let bestSim = THRESHOLD;
    for (const c of clusters) {
      const sim = cosine(vectors[i], c.centroid);
      if (sim > bestSim) {
        best = c;
        bestSim = sim;
      }
    }
    if (best) {
      best.members.push({ article, vector: vectors[i] });
      const sum = new Map();
      best.members.forEach((m) => m.vector.forEach((x, t) => sum.set(t, (sum.get(t) || 0) + x)));
      best.centroid = normalize(sum);
    } else {
      clusters.push({ members: [{ article, vector: vectors[i] }], centroid: new Map(vectors[i]) });
    }
  });
  return clusters.map((c) => summarize(c.members, now)).sort((a, b) => b.rank - a.rank);
}

module.exports = { clusterArticles, cosine, terms, tfidf };
