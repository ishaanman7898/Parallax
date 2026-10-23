const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createLeanModel } = require("../server/lean-model");
const { extractImage, normalizeImage, createImageFinder, isPublicUrl } = require("../server/images");
const { decodePricing } = require("../server/stream");
const { parseFeed } = require("../server/rss");
const Prefs = require("../src/prefs");

// Outlets whose phrase use lines up with their rating, plus unrated ones.
function sources() {
  const rated = [-2, -2, -1, -1, -1, 0, 0, 1, 1, 2, 2].map((lean, i) => ({ id: `r${i}`, lean }));
  return [...rated, { id: "u-left", lean: null }, { id: "u-right", lean: null }, { id: "u-quiet", lean: null }];
}

function evidenceFor(srcs, signal) {
  const out = [];
  for (const s of srcs) {
    const lean = s.lean ?? (s.id === "u-left" ? -2 : s.id === "u-right" ? 2 : 0);
    const n = s.id === "u-quiet" ? 1 : 12;
    for (let i = 0; i < n; i++) {
      const tilt = signal(lean, i);
      out.push({ id: `${s.id}-${i}`, outlet: s.id, left: tilt < 0 ? 1 : 0, right: tilt > 0 ? 1 : 0 });
    }
  }
  return out;
}

test("lean model estimates unrated outlets once validation passes", () => {
  const srcs = sources();
  // Each outlet uses phrases from its own side in proportion to its lean.
  const model = createLeanModel().update(evidenceFor(srcs, (lean, i) => (i < Math.abs(lean) * 4 ? Math.sign(lean) : 0)), srcs);
  assert.equal(model.ready, true);
  assert.ok(model.validation.correlation >= 0.6, model.validation.correlation);
  assert.ok(model.outlets.get("u-left").lean < -0.5);
  assert.ok(model.outlets.get("u-right").lean > 0.5);
  assert.equal(model.outlets.has("u-quiet"), false, "too few phrases for an estimate");
  assert.equal(model.outlets.has("r0"), false, "rated outlets keep their rating");
});

test("lean model stays unrated when phrases do not track ratings", () => {
  const srcs = sources();
  const model = createLeanModel().update(evidenceFor(srcs, (lean, i) => (i % 2 ? 1 : -1)), srcs);
  assert.equal(model.ready, false);
  assert.equal(model.outlets.size, 0);
});

test("lean evidence accumulates across cycles without double counting and persists", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parallax-"));
  try {
    const srcs = sources();
    const ev = evidenceFor(srcs, (lean, i) => (i < Math.abs(lean) * 4 ? Math.sign(lean) : 0));
    const model = createLeanModel({ dataDir: dir });
    model.update(ev.slice(0, 50), srcs);
    model.update(ev.slice(0, 50), srcs);
    assert.equal(model.size(), 50);
    model.update(ev, srcs);
    const reloaded = createLeanModel({ dataDir: dir });
    assert.equal(reloaded.size(), ev.length);
    assert.equal(reloaded.estimate(srcs).ready, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("article images come from og and twitter tags", () => {
  const base = "https://example.com/news/story";
  assert.equal(extractImage(`<meta property="og:image" content="https://cdn.example.com/a.jpg?w=1200&amp;h=630">`, base), "https://cdn.example.com/a.jpg?w=1200&h=630");
  assert.equal(extractImage(`<meta content="/img/b.png" name="twitter:image">`, base), "https://example.com/img/b.png");
  assert.equal(extractImage(`<meta property="og:image" content="http://cdn.example.com/c.jpg">`, base), "https://cdn.example.com/c.jpg");
  assert.equal(extractImage(`<meta property="og:image" content="https://example.com/static/logo.png">`, base), null);
  assert.equal(normalizeImage("javascript:alert(1)", base), null);
});

test("image finder fills missing images in place and caches pages", async () => {
  let fetches = 0;
  const finder = createImageFinder({
    fetchPage: async (url) => {
      fetches++;
      return { url, html: url.includes("none") ? "<title>x</title>" : `<meta property="og:image" content="https://img.example.com${new URL(url).pathname}.jpg">` };
    }
  });
  const articles = [
    { link: "https://a.com/one", image: null },
    { link: "https://a.com/none", image: null },
    { link: "https://a.com/two", image: "https://keep.com/x.jpg" }
  ];
  let seen = 0;
  await finder.fill(articles, () => seen++);
  assert.equal(articles[0].image, "https://img.example.com/one.jpg");
  assert.equal(articles[1].image, null);
  assert.equal(articles[2].image, "https://keep.com/x.jpg");
  assert.equal(seen, 2);
  await finder.fill([{ link: "https://a.com/one", image: null }]);
  assert.equal(fetches, 2);
});

test("article pages are only fetched from public hosts", async () => {
  for (const ok of ["https://www.bbc.com/news/x", "http://8.8.8.8/a"]) assert.equal(isPublicUrl(ok), true, ok);
  for (const bad of ["http://localhost:5173/api/news", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://172.20.0.1/", "http://[::1]/", "http://intranet/", "file:///etc/passwd", "ftp://x.com/"]) {
    assert.equal(isPublicUrl(bad), false, bad);
  }
  let fetched = false;
  const finder = createImageFinder({ fetchPage: async () => ((fetched = true), { url: "", html: "" }) });
  assert.equal(await finder.find("http://127.0.0.1:5173/"), null);
  assert.equal(fetched, false);
});

test("decodes Yahoo streamer pricing messages", () => {
  const q = decodePricing("CgROVkRBFbjeU0MYwMPnoa1oKgNOTVMwCDgBRccSJL5I9NelMWUAFq6+sAHIAdgBBPUCABauvv0CxxIkvg==");
  assert.equal(q.id, "NVDA");
  assert.equal(Math.round(q.price * 100) / 100, 211.87);
  assert.equal(q.time, 1792781644000);
  assert.ok(q.changePct < 0 && q.change < 0);
  assert.equal(decodePricing(""), null);
});

test("feed images: bare image tags, http upgrade and tiny thumbnails", () => {
  const rss = (item) => `<rss><channel><item><title>T</title><link>https://x.com/a</link>${item}</item></channel></rss>`;
  assert.equal(parseFeed(rss("<image>http://img.x.com/big.jpg</image>"))[0].image, "https://img.x.com/big.jpg");
  assert.equal(parseFeed(rss("<image>https://img.x.com/thumbnail/60x60/a.jpg</image>"))[0].image, null);
  assert.equal(parseFeed(rss(`<enclosure url="https://img.x.com/c.webp"/>`))[0].image, "https://img.x.com/c.webp");
  const group = `<media:group><media:content url="https://img.x.com/s.jpg" width="200"/><media:content url="https://img.x.com/l.jpg" width="1200"/></media:group>`;
  assert.equal(parseFeed(rss(group))[0].image, "https://img.x.com/l.jpg");
});

test("old profiles gain the new display settings", () => {
  const store = new Map([["parallax.profile.v1", JSON.stringify({ v: 1, topics: ["topic:World"], reads: 3 })]]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const p = Prefs.load(storage);
  assert.deepEqual(p.topics, ["topic:World"]);
  assert.equal(p.splash, true);
  assert.equal(p.startPage, "home");
  p.textSize = "large";
  Prefs.resetDisplay(p);
  assert.equal(p.textSize, "default");
  assert.equal(p.reads, 3);
});

test("settings save to the data folder and only through a JSON PUT", async () => {
  const { createServer } = require("../server");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parallax-"));
  const server = createServer({ getNews: async () => ({}), getMarkets: async () => ({}), dataDir: dir });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/api/prefs`;
  try {
    assert.equal((await fetch(url)).status, 204, "nothing saved yet");
    const put = (body, type = "application/json") => fetch(url, { method: "PUT", headers: { "Content-Type": type }, body });
    assert.equal((await put(JSON.stringify({ v: 1, textSize: "large" }))).status, 204);
    assert.deepEqual(await (await fetch(url)).json(), { v: 1, textSize: "large" });
    assert.ok(fs.existsSync(path.join(dir, "prefs.json")));
    assert.equal((await put("{}", "text/plain")).status, 405, "simple requests from other sites are refused");
    assert.equal((await put("[1,2]")).status, 400);
    assert.equal((await put("not json")).status, 400);
    fs.writeFileSync(path.join(dir, "prefs.json"), "{broken");
    assert.equal((await fetch(url)).status, 204, "a corrupt file is ignored rather than crashing the server");
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("live news answers from cache and announces each new edition", async () => {
  const { createNewsService, fixtureFetcher } = require("../server/news");
  const getNews = createNewsService({ fetcher: fixtureFetcher(path.join(__dirname, "fixtures")), images: null, live: false, ttl: 0 });
  const editions = [];
  getNews.onUpdate((n) => editions.push(n));
  const first = await getNews();
  assert.equal(editions.length, 1);
  assert.equal(getNews.progress().phase, "ready");
  const second = await getNews();
  assert.equal(second, first, "a stale cache is served at once while it rebuilds");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(editions.length, 2, "the background rebuild announced a new edition");
});
