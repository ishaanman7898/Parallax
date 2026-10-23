# Parallax

Parallax is a news reader that shows how the same story is covered across the political spectrum. It pulls live headlines from nine outlets, groups articles about the same event, and scores each one for lean, tone and loaded language. A live market panel tracks stocks and indices from Yahoo Finance and crypto perpetuals streamed from Hyperliquid. The same code runs as a website and as an Electron desktop app.

Lean and tone are automated estimates, not fact checks. Nothing here is financial advice.

## Features

The home page leads with the story covered by the most outlets, followed by a grid of story clusters you can search or filter by topic. Each cluster shows how many left, center and right rated sources covered it, its average tone and a coverage lean estimate. Opening a story puts every outlet's version side by side in left, center and right columns with the framing phrases and loaded words found in each, and flags blindspots where one side is missing. Latest news lists every article by time with a lean filter. Markets has equities and rates, a live Hyperliquid perps table with funding and open interest, the Crypto Fear and Greed Index and a chart of news tone by topic. Understanding bias explains the method and shows which feeds are online.

## Getting started

You need Node.js 18 or newer.

```bash
npm install
npm run web           # website and API at http://localhost:5173
npm start             # desktop app
npm run web:offline   # uses saved feeds in test/fixtures, no network needed
npm test
```

Set `PORT` to change the port and `HOST=0.0.0.0` to accept connections from other machines.

[Node.js downloads](https://nodejs.org/en/download)

## Data sources

All sources are free and need no API keys.

| Data | Source | Fetched by |
| --- | --- | --- |
| Headlines | RSS and Atom feeds from NPR, The New York Times, Vox, BBC News, The Hill, Christian Science Monitor, Fox News, New York Post and Washington Examiner | Server, every 5 minutes |
| Stocks, indices, 10 year yield | Yahoo Finance chart API, delayed | Server, every minute |
| Crypto Fear and Greed | alternative.me | Server, every minute |
| Crypto perpetuals | Hyperliquid public info API and websocket | Browser, streaming |

Feeds and outlet ratings live in `server/sources.js`. If a feed fails, the rest keep working and the Understanding bias page marks it offline. Yahoo's chart endpoint is unofficial and can change without notice.

[Hyperliquid API docs](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api) and [alternative.me Fear and Greed API](https://alternative.me/crypto/fear-and-greed-index/)

## How the analysis works

**Lean.** Each outlet starts from a five point rating that follows the AllSides Media Bias Chart at the time it was added. The server then scans each headline, summary and available article text for about seventy partisan coded phrases, such as "undocumented immigrants" against "illegal aliens". Phrase matches can move an article up to halfway from its outlet's rating. The phrase lists are in `server/bias.js`.

**Tone.** Sentiment uses VADER, a model built for short text. VADER misses market vocabulary, so `server/sentiment.js` adds terms like "rally", "plunge" and "recession", skipping any word VADER already scores. Their weights are folded into VADER's raw score before its normal scaling. Scores run from −1 to +1.

**Loaded language.** A list of sensational words such as "slams" and "bombshell", plus all caps words and exclamation marks.

**Clustering.** Articles are compared with TF-IDF cosine similarity on their headline and summary, and each one joins the most similar existing story above a threshold or starts a new one. Stories are ranked by the number of outlets covering them, then by recency.

Outlet ratings change over time, so check current ratings before relying on them.

[AllSides ratings](https://www.allsides.com/media-bias/ratings), [VADER paper](https://ojs.aaai.org/index.php/ICWSM/article/view/14550) and [Gentzkow and Shapiro on media slant](https://web.stanford.edu/~gentzkow/research/biasmeas.pdf)

## Desktop builds

The desktop app starts the same server on a random local port and loads it, so it gets live feeds with no extra setup. Article links open in your default browser. Installers are built with electron-builder and written to `dist`.

```bash
npm run dist:win     # Windows installer
npm run dist:mac     # macOS disk image
npm run dist:linux   # Linux AppImage
```

macOS builds need to run on a Mac. The app icon lives in `build/icon.png`.

[Electron docs](https://www.electronjs.org/docs/latest) and [electron-builder docs](https://www.electron.build)

## Hosting the website

For live news, deploy the Node server to any host that runs Node, such as Render, Railway or Fly.io, with `npm run web` as the start command and `HOST=0.0.0.0`. News feeds block browser requests from other sites, so live headlines need the server.

The `src` folder also works as a plain static site on GitHub Pages or Netlify. In that mode it shows sample stories and sample stock prices, but Hyperliquid crypto prices still stream live because the browser fetches them directly.

[Render Node deploy guide](https://render.com/docs/deploy-node-express-app) and [GitHub Pages docs](https://docs.github.com/en/pages)

## Project structure

```
server/
  index.js      HTTP server for the site and the JSON API
  sources.js    outlets, feeds and ratings
  rss.js        RSS and Atom parsing
  sentiment.js  VADER tone plus news lexicon, loaded language
  bias.js       framing phrase lists and lean scoring
  topics.js     keyword topic classifier
  cluster.js    TF-IDF story clustering and coverage stats
  news.js       fetch, analyze, cluster and cache
  markets.js    Yahoo Finance and Fear and Greed
src/
  index.html    page shell
  styles.css    theme and layout
  live.js       API client, sample fallback and Hyperliquid stream
  app.js        routing and rendering
  data.js       sample data used without a server
electron/       desktop main process
scripts/        server launcher
test/           unit tests and saved feed fixtures
```

The API has two endpoints. `GET /api/news` returns story clusters with every analyzed article and per source status. `GET /api/markets` returns quotes and the Fear and Greed reading.

[Node test runner docs](https://nodejs.org/api/test.html)

## Security

The desktop window runs with context isolation and the sandbox on, and Node integration off. The page's Content Security Policy only allows scripts from the app itself and network requests to the app and Hyperliquid. All feed text is escaped before it is rendered, and only http and https article links become clickable. The server only fetches the fixed feed list, so users can't make it request arbitrary URLs.

[Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Parallax is released under the [MIT License](LICENSE). VADER is used under its own license through the `vader-sentiment` package.
