const fs = require("fs/promises");
const path = require("path");

// Free, keyless sources: Yahoo Finance chart API for equities and rates,
// alternative.me for the Crypto Fear and Greed Index. Crypto prices come from
// Hyperliquid directly in the browser so they also work on static hosting.
// Live ticks between chart refreshes come from the Yahoo streamer in stream.js.
const SYMBOLS = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^DJI", label: "DOW" },
  { symbol: "^TNX", label: "US 10Y" },
  { symbol: "^VIX", label: "VIX" },
  { symbol: "GC=F", label: "GOLD" },
  { symbol: "CL=F", label: "OIL" },
  { symbol: "AAPL", label: "AAPL" },
  { symbol: "NVDA", label: "NVDA" },
  { symbol: "MSFT", label: "MSFT" },
  { symbol: "TSLA", label: "TSLA" },
  { symbol: "AMZN", label: "AMZN" },
  { symbol: "GOOGL", label: "GOOGL" },
  { symbol: "META", label: "META" }
];

const TTL = 60 * 1000;
const UA = "Mozilla/5.0 (compatible; ParallaxReader/2.0)";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function fixtureJson(dir) {
  return async (url) => {
    const name = url.includes("alternative.me") ? "fng" : "yahoo-" + decodeURIComponent(url.split("/chart/")[1].split("?")[0]).replace(/\W/g, "");
    return JSON.parse(await fs.readFile(path.join(dir, `${name}.json`), "utf8"));
  };
}

function parseChart(json, label) {
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error("no chart data");
  const q = r.indicators?.quote?.[0] || {};
  // Closes and their timestamps (ms), skipping empty bars, so the chart can label each point.
  const points = (q.close || []).map((c, i) => [c, (r.timestamp?.[i] || 0) * 1000]).filter(([c]) => c != null);
  const series = points.map(([c]) => c);
  const times = points.map(([, t]) => t);
  const price = r.meta.regularMarketPrice ?? series[series.length - 1];
  const prev = r.meta.previousClose ?? r.meta.chartPreviousClose;
  const open = (q.open || []).find((x) => x != null) ?? prev;
  return {
    symbol: r.meta.symbol,
    label,
    price,
    prevClose: prev,
    open,
    change: price - prev,
    changePct: prev ? ((price - prev) / prev) * 100 : 0,
    series,
    times,
    time: r.meta.regularMarketTime ? new Date(r.meta.regularMarketTime * 1000).toISOString() : null
  };
}

async function buildMarkets(fetcher) {
  const quotes = await Promise.all(
    SYMBOLS.map(({ symbol, label }) =>
      fetcher(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`)
        .then((json) => parseChart(json, label))
        .catch(() => null)
    )
  );
  let fearGreed = null;
  try {
    const d = (await fetcher("https://api.alternative.me/fng/?limit=1")).data[0];
    fearGreed = { value: Number(d.value), label: d.value_classification, time: new Date(Number(d.timestamp) * 1000).toISOString() };
  } catch {
    fearGreed = null;
  }
  return { updated: new Date().toISOString(), quotes: quotes.filter(Boolean), fearGreed };
}

function createMarketsService({ fetcher = process.env.PARALLAX_FIXTURES ? fixtureJson(process.env.PARALLAX_FIXTURES) : fetchJson } = {}) {
  let cache = null;
  let pending = null;
  return async function getMarkets() {
    if (cache && Date.now() - cache.at < TTL) return cache.data;
    pending ||= buildMarkets(fetcher)
      .then((data) => {
        if (data.quotes.length || !cache) cache = { data, at: Date.now() };
        return cache.data;
      })
      .finally(() => (pending = null));
    return pending;
  };
}

module.exports = { createMarketsService, buildMarkets, fetchJson, parseChart, SYMBOLS };
