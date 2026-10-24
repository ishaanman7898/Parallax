// Cloudflare Worker for the Parallax website. The page and its assets are served straight
// from src/. News editions are built by scripts/publish-news.js on a schedule and stored in
// Workers KV, so this only hands out the latest one. Markets are fetched live.
import { buildMarkets, fetchJson } from "../server/markets.js";
import { SOURCES } from "../server/sources.js";
import { version } from "../package.json";

const MARKETS_TTL = 60 * 1000;
const HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

// Reused for a minute inside this isolate, so busy pages do not refetch every quote.
let markets = null;
async function getMarkets() {
  if (markets && Date.now() - markets.at < MARKETS_TTL) return markets.data;
  const data = await buildMarkets(fetchJson);
  if (data.quotes.length || !markets) markets = { data, at: Date.now() };
  return markets.data;
}

export default {
  async fetch(request, env) {
    switch (new URL(request.url).pathname) {
      case "/api/news": {
        // Streamed straight from KV. Without an edition yet the page shows its sample stories.
        const news = await env.NEWS.get("news", "stream");
        return news ? new Response(news, { headers: HEADERS }) : json({ error: "no edition yet" }, 503);
      }
      case "/api/edition":
        return new Response((await env.NEWS.get("edition")) || "{}", { headers: HEADERS });
      case "/api/markets":
        try {
          return json(await getMarkets());
        } catch (err) {
          return json({ error: err.message }, 502);
        }
      case "/api/progress":
        return json({ phase: "ready", done: 1, total: 1, sources: SOURCES.length });
      case "/api/info":
        return json({ version, sources: SOURCES.length, desktop: false });
      // Settings stay in the browser. Without a server stream the page streams Yahoo prices
      // itself and polls /api/edition for new news.
      case "/api/prefs":
      case "/api/stream":
        return new Response(null, { status: 204 });
      default:
        return env.ASSETS.fetch(request);
    }
  }
};
