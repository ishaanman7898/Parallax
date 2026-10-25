const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { parseFeed } = require("../server/rss");
const { buildNews, fixtureFetcher } = require("../server/news");
const { parseChart } = require("../server/markets");
const { createServer } = require("../server");

const fixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const NOW = Date.parse("2026-10-23T01:00:00Z");

test("parses RSS with media and escaped HTML", () => {
  const items = parseFeed(fixture("fox.xml"));
  assert.ok(items.length > 10);
  for (const i of items) {
    assert.match(i.link, /^https:\/\/www\.foxnews\.com\//);
    assert.ok(!/[<>]|&lt;|&amp;/.test(i.title + i.summary), i.title);
  }
  assert.ok(items.filter((i) => i.image).length > items.length / 2);
});

test("parses Atom feeds", () => {
  const items = parseFeed(fixture("vox.xml"));
  assert.equal(items.length, 10);
  assert.match(items[0].link, /^https:\/\/www\.vox\.com\//);
  assert.ok(items[0].published);
  assert.ok(items[0].categories.length);
});

test("parses RSS 1.0 (RDF) feeds", () => {
  const items = parseFeed(fixture("dw.xml"));
  assert.equal(items.length, 3);
  assert.equal(items[1].title, "Albania's student protests are only getting bigger");
  assert.equal(items[0].published, "2026-10-22T20:52:00.000Z");
});

test("parses WordPress feeds", () => {
  for (const name of ["thehill.xml", "nypost.xml", "examiner.xml"]) {
    const items = parseFeed(fixture(name));
    assert.ok(items.length >= 10, name);
    assert.ok(items.every((i) => i.title && i.published), name);
  }
});

test("reads dates without a time zone as UTC", () => {
  const xml = `<rss><channel>
    <item><title>Bare</title><link>https://example.com/a</link><pubDate>2026-10-25 02:48:34</pubDate></item>
    <item><title>Zoned</title><link>https://example.com/b</link><pubDate>Sun, 25 Oct 2026 02:48:34 +0100</pubDate></item>
  </channel></rss>`;
  const [bare, zoned] = parseFeed(xml);
  assert.strictEqual(bare.published, "2026-10-25T02:48:34.000Z");
  assert.strictEqual(zoned.published, "2026-10-25T01:48:34.000Z");
});

test("builds clustered news from fixtures", async () => {
  const news = await buildNews(fixtureFetcher(path.join(__dirname, "fixtures")), NOW);
  assert.equal(news.sources.filter((s) => s.ok).length, 7);
  assert.ok(news.clusters.flatMap((c) => c.articles).some((a) => a.source.kind === "markets"));
  assert.ok(news.articleCount > 50);
  const multi = news.clusters.filter((c) => c.sourceCount > 1);
  assert.ok(multi.length >= 3);
  const carriage = news.clusters.find((c) => c.articles.some((a) => /carriage/i.test(a.title)));
  assert.ok(carriage.sourceCount >= 2, "carriage story should merge across outlets");
  assert.ok(carriage.articles.every((a) => /carriage/i.test(a.title)), "no unrelated articles in the cluster");
  for (const c of news.clusters) {
    assert.equal(c.coverage.left + c.coverage.center + c.coverage.right + c.coverage.unrated, c.sourceCount);
    assert.ok(c.regions.length >= 1);
  }
  const dw = news.clusters.flatMap((c) => c.articles).filter((a) => a.source.id === "dw");
  assert.equal(dw.length, 3);
  assert.ok(dw.every((a) => a.source.label === "Lean left" && a.source.ratedBy === "MBFC" && a.source.region === "Europe"));
  const fox = news.clusters.flatMap((c) => c.articles).find((a) => a.source.id === "fox");
  assert.equal(fox.source.ratedBy, "AllSides");
});

test("a dead feed is reported without breaking the rest", async () => {
  const fetcher = fixtureFetcher(path.join(__dirname, "fixtures"));
  const news = await buildNews(async (url) => (url.includes("foxnews") ? Promise.reject(new Error("HTTP 500")) : fetcher(url)), NOW);
  const fox = news.sources.find((s) => s.id === "fox");
  assert.equal(fox.ok, false);
  assert.equal(fox.error, "HTTP 500");
  assert.ok(news.articleCount > 0);
});

test("parses Yahoo chart data", () => {
  const q = parseChart(JSON.parse(fixture("yahoo-GSPC.json")), "S&P 500");
  assert.equal(q.price, 7663.43);
  assert.equal(Math.round(q.change * 100) / 100, -93.74);
  assert.equal(q.series.length, 24);
});

test("server serves the API and blocks path traversal", async () => {
  const server = createServer({ getNews: async () => ({ ok: 1 }), getMarkets: async () => { throw new Error("down"); } });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.deepEqual(await (await fetch(base + "/api/news")).json(), { ok: 1 });
    assert.equal((await fetch(base + "/api/markets")).status, 502);
    assert.equal((await fetch(base + "/")).status, 200);
    const res = await new Promise((resolve) => require("http").get({ host: "127.0.0.1", port: server.address().port, path: "/../package.json" }, resolve));
    assert.equal(res.statusCode, 403);
  } finally {
    server.close();
  }
});
