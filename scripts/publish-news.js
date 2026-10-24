// Builds a news edition and publishes it to the website's Workers KV store. Analyzing an
// edition takes seconds of CPU, more than a free Cloudflare Worker may use, so this runs on
// a schedule in GitHub Actions (.github/workflows/news.yml) and the Worker only serves it.
// Needs CLOUDFLARE_API_TOKEN with Workers KV Storage edit access.
const fs = require("fs");
const path = require("path");
const { buildNews, fetchText } = require("../server/news");
const { createLeanModel } = require("../server/lean-model");
const { createImageFinder } = require("../server/images");

// Article pages read per run for missing images. Found images are kept between runs.
const IMAGE_FETCHES = 400;
const MAX_IMAGES = 6000;

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, ""));
const account = process.env.CLOUDFLARE_ACCOUNT_ID || config.account_id;
const namespace = config.kv_namespaces.find((k) => k.binding === "NEWS").id;
const token = process.env.CLOUDFLARE_API_TOKEN;
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}/values/`;
const auth = { Authorization: `Bearer ${token}` };

async function getJson(key) {
  const res = await fetch(base + key, { headers: auth });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV get ${key}: HTTP ${res.status}`);
  return res.json();
}

async function put(key, text) {
  const res = await fetch(base + key, { method: "PUT", headers: { ...auth, "Content-Type": "application/json" }, body: text });
  if (!res.ok) throw new Error(`KV put ${key}: HTTP ${res.status} ${await res.text()}`);
}

// Fills images for articles that have none, ranked stories first, then gives each story the
// first image among its articles.
async function fillImages(news, finder) {
  const owner = new Map();
  news.clusters.forEach((c) => c.articles.forEach((a) => owner.set(a, c)));
  const missing = news.clusters.flatMap((c) => c.articles).filter((a) => !a.image && a.link);
  const known = missing.filter((a) => finder.cached(a.link) !== undefined);
  const unknown = missing.filter((a) => finder.cached(a.link) === undefined).slice(0, IMAGE_FETCHES);
  await finder.fill([...known, ...unknown], (a) => {
    const c = owner.get(a);
    if (a.image && c && !c.image) c.image = a.image;
  });
  news.imagesPending = 0;
}

async function main() {
  if (!token || !account) throw new Error("set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID");
  // Lean evidence and found images share one key, keeping each run to three KV writes, so a
  // run every 5 minutes stays inside the free plan's 1,000 writes a day.
  const saved = (await getJson("state")) || {};
  const leanModel = createLeanModel({ saved: saved.evidence });
  const finder = createImageFinder({ saved: saved.images });
  const news = await buildNews(fetchText, Date.now(), { leanModel });
  await fillImages(news, finder);
  // Keep the last good edition when every feed fails.
  if (!news.articleCount) throw new Error("no articles, keeping the previous edition");
  await put("news", JSON.stringify(news));
  // The small record pages poll to learn a new edition is out.
  await put("edition", JSON.stringify({ updated: news.updated, articleCount: news.articleCount }));
  await put("state", JSON.stringify({ evidence: leanModel.entries(), images: finder.entries().slice(-MAX_IMAGES) }));
  const online = news.sources.filter((s) => s.ok).length;
  console.log(`Published ${news.articleCount} articles in ${news.clusters.length} stories from ${online} of ${news.sources.length} sources`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
