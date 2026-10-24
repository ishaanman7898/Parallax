const fs = require("fs");
const path = require("path");

// Estimates a lean for outlets without a published rating from the partisan framing phrases
// in their own articles (see bias.js). One feed cycle holds too few phrases per outlet to say
// much, so evidence accumulates across cycles, keyed by article so nothing counts twice, and
// is saved to disk when a data folder is given.
//
// The same evidence is computed for rated outlets, which gives a check: a line is fitted from
// phrase evidence to published rating, and each rated outlet is predicted from a line fitted
// without it. Estimates are only published when those held out predictions track the
// published ratings closely. Otherwise unrated outlets stay unrated.
//
// Learned vocabulary models (naive Bayes and nearest neighbor over outlet word profiles) were
// tried first and validated at or below zero correlation on a day of headlines, which is why
// this model sticks to the curated phrase list.
const KEEP_DAYS = 30;
// Rated outlets train on article count, not phrase count: a center outlet that rarely uses
// partisan phrases is exactly the evidence that anchors the middle of the scale.
const MIN_TRAIN_ARTICLES = 10;
const MIN_HITS = 6;
const MIN_TRAIN_OUTLETS = 8;
const MIN_CORRELATION = 0.6;
const SMOOTHING = 4;

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function correlation(xs, ys) {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

function fitLine(points) {
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  const vx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const b = vx ? points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / vx : 0;
  return { a: my - b * mx, b };
}

const sideOf = (x) => (x <= -0.2 ? -1 : x >= 0.2 ? 1 : 0);
const clamp = (x) => Math.max(-1, Math.min(1, x));
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

// Evidence persists to dataDir when given. Without one, `saved` seeds it and entries() hands
// it back for the caller to store, as the Cloudflare Worker does with KV.
function createLeanModel({ dataDir = null, saved = null, now = () => Date.now() } = {}) {
  const file = dataDir ? path.join(dataDir, "lean-evidence.json") : null;
  // article id -> [outlet, left weight, right weight, time]
  let evidence = new Map(saved || []);
  if (file) {
    try {
      evidence = new Map(JSON.parse(fs.readFileSync(file, "utf8")));
    } catch {
      evidence = new Map();
    }
  }

  function save() {
    if (!file) return;
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify([...evidence]));
    } catch {
      // Evidence still works in memory for this session.
    }
  }

  // articles: [{ id, outlet, left, right }] where left and right are phrase weights.
  function update(articles, sources) {
    const t = now();
    for (const a of articles) if (!evidence.has(a.id)) evidence.set(a.id, [a.outlet, a.left, a.right, t]);
    for (const [id, e] of evidence) if (t - e[3] > KEEP_DAYS * 864e5) evidence.delete(id);
    save();
    return estimate(sources);
  }

  function estimate(sources) {
    const totals = new Map();
    for (const [outlet, l, r] of evidence.values()) {
      const s = totals.get(outlet) || { left: 0, right: 0, articles: 0 };
      s.left += l;
      s.right += r;
      s.articles++;
      totals.set(outlet, s);
    }
    const raw = (s) => (s.right - s.left) / (s.right + s.left + SMOOTHING);
    const hits = (s) => s.left + s.right;

    const train = sources
      .filter((src) => src.lean != null && totals.get(src.id)?.articles >= MIN_TRAIN_ARTICLES)
      .map((src) => ({ id: src.id, x: raw(totals.get(src.id)), y: src.lean / 2 }));
    const result = { ready: false, outlets: new Map(), validation: null, trainedOn: train.length, evidence: evidence.size };
    if (train.length < MIN_TRAIN_OUTLETS) return result;

    // Leave one rated outlet out, predict it from a line fitted on the rest.
    const held = train.map((p) => {
      const { a, b } = fitLine(train.filter((q) => q !== p));
      return clamp(a + b * p.x);
    });
    const ys = train.map((p) => p.y);
    const r = correlation(held, ys);
    result.validation = {
      outlets: train.length,
      correlation: round(r),
      meanError: round(mean(held.map((h, i) => Math.abs(h - ys[i])))),
      sideAccuracy: round(held.filter((h, i) => sideOf(h) === sideOf(ys[i])).length / train.length)
    };
    const { a, b } = fitLine(train);
    result.ready = r >= MIN_CORRELATION && b > 0;
    if (!result.ready) return result;

    for (const src of sources) {
      const s = totals.get(src.id);
      if (src.lean != null || !s || hits(s) < MIN_HITS) continue;
      // Fewer phrases pull the estimate toward center.
      const shrink = hits(s) / (hits(s) + MIN_HITS);
      result.outlets.set(src.id, { lean: round(clamp(a + b * raw(s)) * shrink * 2, 1), phrases: round(hits(s), 0), articles: s.articles });
    }
    return result;
  }

  return { update, estimate, size: () => evidence.size, entries: () => [...evidence] };
}

module.exports = { createLeanModel, correlation, fitLine };
