const http = require("http");
const fs = require("fs");
const path = require("path");
const { createNewsService } = require("./news");
const { createMarketsService, SYMBOLS } = require("./markets");
const { createQuoteStream } = require("./stream");
const { SOURCES } = require("./sources");
const { version } = require("../package.json");

const root = path.join(__dirname, "..", "src");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json"
};

// Settings saved as a file in the data folder (the desktop app's user data folder), so they
// survive restarts even though the desktop page origin uses a new port every launch.
// Only PUT with a JSON body is accepted, which browsers always preflight, so other sites
// cannot write here.
const MAX_PREFS = 512 * 1024;

function prefsHandler(dataDir) {
  const file = path.join(dataDir, "prefs.json");
  return (req, res) => {
    if (req.method === "GET") {
      return fs.readFile(file, "utf8", (err, text) => {
        let prefs = null;
        try {
          prefs = err ? null : JSON.parse(text);
        } catch {
          prefs = null;
        }
        return prefs ? sendJson(res, 200, prefs) : res.writeHead(204).end();
      });
    }
    if (req.method !== "PUT" || !/^application\/json/.test(req.headers["content-type"] || "")) return res.writeHead(405).end();
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_PREFS) req.destroy();
    });
    req.on("end", () => {
      let prefs;
      try {
        prefs = JSON.parse(body);
      } catch {
        return res.writeHead(400).end();
      }
      if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return res.writeHead(400).end();
      // Write then rename, so a crash mid write never leaves a half written file.
      fs.mkdir(dataDir, { recursive: true }, () => {
        fs.writeFile(file + ".tmp", JSON.stringify(prefs), (err) => {
          if (err) return res.writeHead(500).end();
          fs.rename(file + ".tmp", file, (err2) => res.writeHead(err2 ? 500 : 204).end());
        });
      });
    });
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(root, urlPath === "/" ? "index.html" : urlPath);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end("Not found");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    res.end(data);
  });
}

// Serves the static site plus the JSON API used by both the website and the desktop app.
function createServer(options = {}) {
  const getNews = options.getNews || createNewsService({ dataDir: options.dataDir });
  const getMarkets = options.getMarkets || createMarketsService();
  // The live stream is created on first use, and never in offline fixture mode. It carries
  // prices and a "news" event whenever a new news edition is ready.
  let stream = options.stream || null;
  getNews.onUpdate?.((news) => stream?.send("news", { updated: news.updated, articleCount: news.articleCount }));
  const prefs = options.dataDir ? prefsHandler(options.dataDir) : null;
  const api = {
    "/api/news": getNews,
    "/api/markets": getMarkets,
    "/api/progress": async () => (getNews.progress ? getNews.progress() : { phase: "ready" }),
    "/api/info": async () => ({ version, sources: SOURCES.length, desktop: !!options.desktop })
  };

  return http.createServer(async (req, res) => {
    const pathname = req.url.split("?")[0];
    if (pathname === "/api/stream") {
      if (process.env.PARALLAX_FIXTURES && !options.stream) return res.writeHead(204).end();
      stream ||= createQuoteStream(SYMBOLS.map((s) => s.symbol));
      return stream.handle(req, res);
    }
    if (pathname === "/api/prefs") return prefs ? prefs(req, res) : res.writeHead(204).end();
    const route = api[pathname];
    if (!route) return serveStatic(req, res);
    try {
      sendJson(res, 200, await route());
    } catch (err) {
      sendJson(res, 502, { error: err.message });
    }
  });
}

function start(port = 5173, host = "127.0.0.1", options) {
  return new Promise((resolve, reject) => {
    const server = createServer(options);
    server.once("error", reject);
    server.listen(port, host, () => resolve({ server, port: server.address().port }));
  });
}

module.exports = { createServer, start };
