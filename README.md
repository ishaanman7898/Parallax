# Parallax

Parallax is a news reader that shows how the same story is covered across the political spectrum and around the world. It pulls live headlines from 88 outlets in the US, UK, Europe, Canada, Asia-Pacific, South Asia, the Middle East, Africa and Latin America, groups articles about the same event, and scores each one for lean, tone and loaded language. A live market panel streams stock and index prices from Yahoo Finance and crypto perpetuals from Hyperliquid. The same code runs as a website and as an Electron desktop app.

**Website:** [parallax.ishman.workers.dev](https://parallax.ishman.workers.dev)

Lean and tone are automated estimates, not fact checks. Nothing here is financial advice.

## Features

The layout follows Google News on a black background. A short startup animation plays over falling streaks of light while the first feeds load, with a progress bar showing how many feeds have arrived, then opens the news. A tab row links every section and topic, the live market ticker runs under it, all three stay pinned to the top as you scroll, and the search bar in the header searches every story as you type. The question mark icon in the header opens the page that explains how bias is measured.

The home page opens with Top stories. Each story shows its lead article with a photo and up to three other outlets, picked so the other sides of the spectrum show up first. A summary row gives the left, center and right coverage split and the story's tone mix as bars, with the counts on hover, and a button opens the full comparison. Every article across the site has a sentiment bar under it that shows its tone from −1 to +1. The right column has Market pulse, a chart you can switch between the S&P 500, NASDAQ, DOW, gold, oil and the BTC, ETH, SOL and HYPE perps, with a tooltip that shows the price, time and move from the open as you hover over it. Under it, On the radar is a slideshow that cycles through the biggest movers, big tech, more stocks, rates and commodities, and crypto. The column also has a Latest feed you can filter by lean, and average tone by topic. Below that come For you and Your topics.

Opening a story puts every outlet's version side by side in left, center and right columns, with unrated and nonpolitical outlets below, and shows the framing phrases and loaded words found in each. It also flags blindspots where one side is missing. Latest lists every article by time with a lean filter. World collects international coverage with region filters, and each topic tab lists its stories. Markets has equities, rates, gold and oil with prices that flash as they tick, a live Hyperliquid perps table with funding and open interest, the Crypto Fear and Greed Index, market headlines with their tone, and a chart of news tone by topic. The bias page explains the method and shows every outlet's rating, who rated it and whether its feed is online.

## For you and settings

For you starts as a shuffle that changes once a day. Every article or story you open is recorded in a reading profile, which adds weight to that article's topic, its outlet and the words in its headline. Older reads fade a little each time you read something new, so the feed follows what you read lately. Ranking adds those weights to a freshness score, pushes articles you already opened to the bottom and shows at most one article per story and two per outlet. The code is in `src/prefs.js` and the tests are in `test/prefs.test.js`.

The settings page, opened from the gear icon, lets you pick the topics and regions that get a column under Your topics, change text size and the start page, turn the startup animation, ticker and article images on or off, switch the sentiment bar between a diverging bar and a spectrum, pause learning, see your top topics and outlets, and reset your history. It also shows how many outlets are online and who rated them. In the desktop app it adds the window mode on launch, a button that opens the settings folder and the update controls described under Updates. The website saves the profile in your browser's local storage. The desktop app also saves it to `prefs.json` in its settings folder, `%APPDATA%\Parallax` on Windows, because its page runs on a new local port every launch and local storage is tied to the port. Neither copy leaves your device.

**Live news.** The server checks every feed in the background every three minutes and sends a `news` event over the same stream as the live prices when a new edition is ready. Near the top of the page the new stories swap straight in. Further down, a pill offers them instead, so the page never shifts while you are reading.

[MDN localStorage docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

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
| US headlines | NPR, The New York Times, Vox, NBC News, CBS News, ABC News, Los Angeles Times, Politico, Axios, Business Insider, Time, Mother Jones, The Intercept, Slate, The Hill, Christian Science Monitor, Newsweek, Reason, Fox News, New York Post, Washington Examiner, National Review, Breitbart, Newsmax, Daily Caller, The Federalist, The Washington Times, The Daily Wire, The Dispatch, The Free Press, The Atlantic, PBS News, Semafor, UPI | Server, every 5 minutes by default |
| International headlines | BBC News, Al Jazeera, DW, France 24, Euronews, RFI, Sky News, The Guardian, The Independent, Daily Mail, The Telegraph, Financial Times, Le Monde, The Irish Times, The Kyiv Independent, EUobserver, Balkan Insight, CBC News, The Globe and Mail, Global News, National Post, South China Morning Post, The Sydney Morning Herald, SBS News, Asia Times, The Japan Times, The Straits Times, Yonhap, The Korea Herald, The Times of India, The Hindu, NDTV, The Times of Israel, The Jerusalem Post, Arab News, Africanews, MercoPress, Buenos Aires Times, Mexico News Daily | Server, every 5 minutes by default |
| Technology, health, sports and culture | The Verge, Ars Technica, TechCrunch, STAT, ESPN, BBC Sport, Variety | Server, every 5 minutes by default |
| Market headlines | MarketWatch, The Wall Street Journal, Bloomberg, CNBC, Fortune, Investing.com, CoinDesk, Cointelegraph | Server, every 5 minutes by default |
| Article images missing from a feed | The article page's `og:image` or `twitter:image` tag | Server, once per article |
| Stocks, indices, rates, gold and oil | Yahoo Finance chart API, plus the Yahoo Finance streamer for live ticks while markets are open | Server, charts every minute, ticks streamed to the page |
| Crypto Fear and Greed | alternative.me | Server, every minute |
| Crypto perpetuals | Hyperliquid public info API and websocket | Browser, streaming |

Feeds, regions and outlet ratings live in `server/sources.js`, and the parser reads RSS 2.0, RSS 1.0 and Atom. The server fetches sixteen feeds at a time and keeps the newest 25 items per feed from the last 72 hours. If a feed fails, the rest keep working and the bias page marks it offline.

Many feeds leave out images or only carry tiny thumbnails. For those articles the server reads the top of the article page for its `og:image` tag, top stories first, and caches the result by link. The first response waits about two and a half seconds for this, then the rest keep arriving in the background and the page picks them up on a quick follow up refresh.

Live prices reach the page as server-sent events from `GET /api/stream`. The server holds one websocket to the Yahoo Finance streamer, which sends a small protobuf message per trade, and relays each price to every open page. Yahoo's chart and streamer endpoints are unofficial and can change without notice. The international list started from the Feedspot world news feed directory, and English language feeds were kept because the tone model only reads English.

[Feedspot world news RSS feeds](https://rss.feedspot.com/world_news_rss_feeds/), [Hyperliquid API docs](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api) and [alternative.me Fear and Greed API](https://alternative.me/crypto/fear-and-greed-index/)

## How the analysis works

**Lean.** Each outlet starts from a published five point rating. Parallax uses the AllSides Media Bias Chart where AllSides rates the outlet, and otherwise the outlet's Media Bias/Fact Check page, with Left, Left-Center, Least Biased, Right-Center and Right mapped onto the same scale. Every source records which service rated it, and the app shows it. Both services are US centric, so treat ratings of non-US outlets as a rough guide. The server then scans each headline, summary and available article text for about 150 partisan coded phrases, such as "undocumented immigrants" against "illegal aliens". Phrase matches can move an article up to halfway from its outlet's rating. The phrase lists are in `server/bias.js`.

**Nonpolitical and unrated outlets.** Outlets on a single nonpolitical beat, such as sports, technology, entertainment or crypto, are marked nonpolitical rather than given a left-right rating. The few outlets neither service rates are marked unrated. Both still count as coverage. Unrated articles only get a lean when their text carries strong partisan phrases, a combined phrase weight of at least 2, so one weak phrase never implies a rating.

**Estimates for unrated outlets.** `server/lean-model.js` keeps a running tally of framing phrases per outlet across feed cycles, keyed by article so repeats never count twice. The desktop app saves it with its other data, so it keeps growing between launches. The same tally for rated outlets is the check: a line is fitted from phrase evidence to published rating, each rated outlet is predicted from a line fitted on all the others, and estimates only appear once those held out predictions correlate at 0.6 or better with the published ratings. Estimates are labeled "(est.)". On a single day of headlines the check scores about 0.3, so expect estimates only after evidence builds up. Learned vocabulary models, naive Bayes and nearest neighbor over outlet word profiles, were also tested with the same held out check and scored at or below zero, so they are not used.

**Tone.** Sentiment uses VADER, a model built for short text. VADER misses market vocabulary, so `server/sentiment.js` adds terms like "rally", "plunge" and "recession", skipping any word VADER already scores. Their weights are folded into VADER's raw score before its normal scaling. Scores run from −1 to +1.

**Loaded language.** A list of sensational words such as "slams" and "bombshell", plus all caps words and exclamation marks.

**Clustering.** Articles are compared with TF-IDF cosine similarity on their headline and summary, and each one joins the most similar existing story above a threshold or starts a new one. Stories are ranked by the number of outlets covering them, then by recency.

Outlet ratings change over time, so check current ratings before relying on them.

[AllSides ratings](https://www.allsides.com/media-bias/ratings), [Media Bias/Fact Check](https://mediabiasfactcheck.com), [VADER paper](https://ojs.aaai.org/index.php/ICWSM/article/view/14550) and [Gentzkow and Shapiro on media slant](https://web.stanford.edu/~gentzkow/research/biasmeas.pdf)

## Desktop builds

The desktop app starts the same server on a random local port and loads it, so it gets live feeds with no extra setup. The server runs in its own background process, so analyzing a news edition never freezes the window. It opens maximized by default, or full screen or windowed if you pick that in settings, and F11 toggles full screen. Article links open in your default browser. Installers are built with electron-builder and written to `dist`.

```bash
npm run dist:win     # Windows installer
npm run dist:mac     # macOS disk image
npm run dist:linux   # Linux AppImage
```

macOS builds need to run on a Mac. The app icon lives in `build/icon.png`, a 1024 pixel render of the logo in `src/assets/icon.svg`. The logo shows two overlapping lenses, left in blue and right in red, with the shared story where they meet. The same file is the site favicon and header mark.

[Electron docs](https://www.electronjs.org/docs/latest) and [electron-builder docs](https://www.electron.build)

## Hosting the website

The live site runs on Cloudflare Workers at [parallax.ishman.workers.dev](https://parallax.ishman.workers.dev). `worker/index.js` serves the `src` folder, fetches market quotes live and hands out the latest news edition from Workers KV. Analyzing an edition takes a few seconds of CPU, more than a free Worker may use, so `scripts/publish-news.js` builds it with the same code as the server and writes it to KV. The News workflow in `.github/workflows/news.yml` runs that script every 15 minutes. There is no price stream on the website, so stock prices refresh every minute instead of ticking.

```bash
npm run deploy:web     # deploy the Worker and the site with wrangler
npm run publish:news   # build and publish a news edition, needs CLOUDFLARE_API_TOKEN
```

The workflow needs a `CLOUDFLARE_API_TOKEN` repository secret with Workers KV Storage edit access. Set it with `gh secret set CLOUDFLARE_API_TOKEN`.

The Node server also runs on any host that runs Node, such as Render, Railway or Fly.io, with `npm run web` as the start command and `HOST=0.0.0.0`. The `src` folder on its own works as a static site that shows sample stories, with live Hyperliquid crypto prices because the browser fetches them directly.

[Cloudflare Workers docs](https://developers.cloudflare.com/workers/), [Workers KV docs](https://developers.cloudflare.com/kv/) and [Render Node deploy guide](https://render.com/docs/deploy-node-express-app)

## Project structure

```
server/
  index.js      HTTP server for the site and the JSON API
  sources.js    outlets, regions, feeds and ratings
  rss.js        RSS and Atom parsing
  sentiment.js  VADER tone plus news lexicon, loaded language
  bias.js       framing phrase lists and lean scoring
  topics.js     keyword topic classifier
  cluster.js    TF-IDF story clustering and coverage stats
  lean-model.js phrase evidence lean estimates for unrated outlets
  images.js     article page images for feeds without them
  news.js       fetch, analyze, cluster and cache
  markets.js    Yahoo Finance and Fear and Greed
  stream.js     Yahoo Finance live price stream
src/
  index.html    page shell and startup screen
  styles.css    theme and layout
  live.js       API client, sample fallback, price stream and Hyperliquid
  app.js        routing, rendering, live prices and settings
  lightfall.js  WebGL light streaks behind the startup screen
  data.js       sample data used without a server
electron/       desktop main process, server process and preload bridge
scripts/        server launcher and news publisher
worker/         Cloudflare Worker for the website
test/           unit tests and saved feed fixtures
```

`GET /api/news` returns story clusters with every analyzed article, per source status and the lean model's validation. `GET /api/markets` returns quotes and the Fear and Greed reading. `GET /api/stream` is the server-sent event stream of live prices and `news` events. `GET /api/prefs` and `PUT /api/prefs` read and save settings when the server has a data folder, as the desktop app does. `GET /api/progress` reports feed loading progress for the startup screen, and `GET /api/info` returns the version and outlet count.

[Node test runner docs](https://nodejs.org/api/test.html)

## Security

The desktop window runs with context isolation and the sandbox on, and Node integration off. Its preload script exposes only app info, the two desktop settings and the update actions. The page's Content Security Policy only allows scripts from the app itself and network requests to the app and Hyperliquid. All feed text is escaped before it is rendered, and only http and https article links become clickable. Users can't make the server request arbitrary URLs. Besides the fixed feed list, it fetches article links that appear in those feeds to find images, and only when the link and every redirect point at a public host, never localhost, a private network or a link local address.

[Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Parallax is released under the [MIT License](LICENSE). VADER is used under its own license through the `vader-sentiment` package.

## Updates

The desktop app checks GitHub Releases on launch and every six hours. By default it downloads a newer version in the background, shows a prompt in the corner when it is ready and installs it when you restart. The Desktop app section in settings shows the current version and update status, checks on demand, downloads and installs, and can turn automatic downloads off. To ship one, raise `version` in `package.json`, commit, then push a matching tag such as `v2.1.1`. The workflow in `.github/workflows/release.yml` builds the Windows installer and publishes it with `latest.yml`, which the app reads. The app reads releases without signing in, so the repository has to stay public for updates to reach installed copies.

[electron-updater docs](https://www.electron.build/auto-update)
