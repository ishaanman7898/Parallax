// Outlets with their region, kind and source-level lean on a -2 (left) to +2 (right) scale.
// Lean follows the published AllSides Media Bias Chart where AllSides rates the outlet, and
// otherwise the outlet's Media Bias/Fact Check page (ratedBy: "MBFC"), mapped Left -2,
// Left-Center -1, Least Biased 0, Right-Center 1, Right 2. Both were last checked October 2026.
// Both scales are US centric, so read ratings of non-US outlets loosely. Lean is null when
// neither rates the outlet. Unrated outlets still count as coverage, and get an estimated lean
// from the phrase evidence model in lean-model.js once its validation is good enough.
// Ratings change, so check https://www.allsides.com/media-bias/ratings and
// https://mediabiasfactcheck.com and edit here.
const SOURCES = [
  // US, left and lean left
  { id: "npr", name: "NPR", lean: -1, region: "US", feeds: ["https://feeds.npr.org/1001/rss.xml", "https://feeds.npr.org/1004/rss.xml", "https://feeds.npr.org/1014/rss.xml"] },
  { id: "nyt", name: "The New York Times", lean: -1, region: "US", feeds: ["https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"] },
  { id: "vox", name: "Vox", lean: -2, region: "US", feeds: ["https://www.vox.com/rss/index.xml"] },
  { id: "nbc", name: "NBC News", lean: -1, region: "US", feeds: ["https://feeds.nbcnews.com/nbcnews/public/news"] },
  { id: "cbs", name: "CBS News", lean: -1, region: "US", feeds: ["https://www.cbsnews.com/latest/rss/main"] },
  { id: "abc", name: "ABC News", lean: -1, region: "US", feeds: ["https://abcnews.go.com/abcnews/topstories"] },
  { id: "latimes", name: "Los Angeles Times", lean: -1, region: "US", feeds: ["https://www.latimes.com/world-nation/rss2.0.xml"] },
  { id: "politico", name: "Politico", lean: -1, region: "US", feeds: ["https://rss.politico.com/politics-news.xml"] },
  { id: "axios", name: "Axios", lean: -1, region: "US", feeds: ["https://api.axios.com/feed/"] },
  { id: "businessinsider", name: "Business Insider", lean: -1, region: "US", feeds: ["https://feeds.businessinsider.com/custom/all"] },
  { id: "time", name: "Time", lean: -1, region: "US", feeds: ["https://time.com/feed/"] },
  { id: "motherjones", name: "Mother Jones", lean: -2, region: "US", feeds: ["https://www.motherjones.com/feed/"] },
  { id: "intercept", name: "The Intercept", lean: -2, region: "US", feeds: ["https://theintercept.com/feed/?lang=en"] },
  { id: "slate", name: "Slate", lean: -2, region: "US", feeds: ["https://slate.com/feeds/all.rss"] },

  // US, center
  { id: "thehill", name: "The Hill", lean: 0, region: "US", feeds: ["https://thehill.com/feed/"] },
  { id: "csm", name: "Christian Science Monitor", lean: 0, region: "US", feeds: ["https://rss.csmonitor.com/feeds/all"] },
  { id: "newsweek", name: "Newsweek", lean: 0, region: "US", feeds: ["https://www.newsweek.com/rss"] },
  { id: "reason", name: "Reason", lean: 0, region: "US", feeds: ["https://reason.com/feed/"] },

  // US, lean right and right
  { id: "fox", name: "Fox News", lean: 2, region: "US", feeds: ["https://moxie.foxnews.com/google-publisher/latest.xml", "https://moxie.foxnews.com/google-publisher/politics.xml"] },
  { id: "nypost", name: "New York Post", lean: 2, region: "US", feeds: ["https://nypost.com/feed/"] },
  { id: "examiner", name: "Washington Examiner", lean: 1, region: "US", feeds: ["https://www.washingtonexaminer.com/feed"] },
  { id: "nationalreview", name: "National Review", lean: 1, region: "US", feeds: ["https://www.nationalreview.com/feed/"] },
  { id: "breitbart", name: "Breitbart", lean: 2, region: "US", feeds: ["https://feeds.feedburner.com/breitbart"] },
  { id: "newsmax", name: "Newsmax", lean: 2, region: "US", feeds: ["https://www.newsmax.com/rss/Newsfront/16/"] },
  // Not on the current AllSides chart, so rated from Media Bias/Fact Check.
  { id: "dailycaller", name: "Daily Caller", lean: 2, ratedBy: "MBFC", region: "US", feeds: ["https://dailycaller.com/feed/"] },
  { id: "federalist", name: "The Federalist", lean: 2, ratedBy: "MBFC", region: "US", feeds: ["https://thefederalist.com/feed/"] },
  { id: "washtimes", name: "The Washington Times", lean: 1, ratedBy: "MBFC", region: "US", feeds: ["https://www.washingtontimes.com/rss/headlines/news/"] },
  { id: "dailywire", name: "The Daily Wire", lean: 2, ratedBy: "MBFC", region: "US", feeds: ["https://www.dailywire.com/feeds/rss.xml"] },
  { id: "dispatch", name: "The Dispatch", lean: 1, ratedBy: "MBFC", region: "US", feeds: ["https://thedispatch.com/feed/"] },
  { id: "freepress", name: "The Free Press", lean: 1, ratedBy: "MBFC", region: "US", feeds: ["https://www.thefp.com/feed"] },
  { id: "atlantic", name: "The Atlantic", lean: -1, ratedBy: "MBFC", region: "US", feeds: ["https://www.theatlantic.com/feed/all/"] },
  { id: "pbs", name: "PBS News", lean: -1, ratedBy: "MBFC", region: "US", feeds: ["https://www.pbs.org/newshour/feeds/rss/headlines"] },
  { id: "semafor", name: "Semafor", lean: 0, ratedBy: "MBFC", region: "US", feeds: ["https://www.semafor.com/rss.xml"] },

  // International broadcasters and wires
  {
    id: "bbc",
    name: "BBC News",
    lean: 0,
    region: "UK",
    feeds: ["https://feeds.bbci.co.uk/news/world/rss.xml", "https://feeds.bbci.co.uk/news/business/rss.xml", "https://feeds.bbci.co.uk/news/technology/rss.xml"]
  },
  { id: "aljazeera", name: "Al Jazeera", lean: -1, region: "Middle East", feeds: ["https://www.aljazeera.com/xml/rss/all.xml"] },
  { id: "dw", name: "DW", lean: -1, ratedBy: "MBFC", region: "Europe", feeds: ["https://rss.dw.com/rdf/rss-en-top"] },
  { id: "france24", name: "France 24", lean: 0, ratedBy: "MBFC", region: "Europe", feeds: ["https://www.france24.com/en/rss"] },
  { id: "euronews", name: "Euronews", lean: -1, ratedBy: "MBFC", region: "Europe", feeds: ["https://www.euronews.com/rss"] },
  { id: "rfi", name: "RFI", lean: 0, ratedBy: "MBFC", region: "Europe", feeds: ["https://www.rfi.fr/en/international/rss"] },
  { id: "sky", name: "Sky News", lean: 0, ratedBy: "MBFC", region: "UK", feeds: ["https://feeds.skynews.com/feeds/rss/world.xml"] },
  { id: "upi", name: "UPI", lean: 0, ratedBy: "MBFC", region: "US", feeds: ["https://rss.upi.com/news/tn_int.rss"] },

  // UK and Europe
  { id: "guardian", name: "The Guardian", lean: -1, ratedBy: "MBFC", region: "UK", feeds: ["https://www.theguardian.com/world/rss", "https://www.theguardian.com/us-news/rss"] },
  { id: "independent", name: "The Independent", lean: -1, ratedBy: "MBFC", region: "UK", feeds: ["https://www.independent.co.uk/news/world/rss"] },
  { id: "dailymail", name: "Daily Mail", lean: 1, region: "UK", feeds: ["https://www.dailymail.co.uk/news/index.rss"] },
  { id: "telegraph", name: "The Telegraph", lean: 2, ratedBy: "MBFC", region: "UK", feeds: ["https://www.telegraph.co.uk/rss.xml"] },
  { id: "ft", name: "Financial Times", lean: 0, ratedBy: "MBFC", region: "UK", feeds: ["https://www.ft.com/world?format=rss"] },
  { id: "lemonde", name: "Le Monde", lean: -1, ratedBy: "MBFC", region: "Europe", feeds: ["https://www.lemonde.fr/en/international/rss_full.xml"] },
  { id: "irishtimes", name: "The Irish Times", lean: -1, ratedBy: "MBFC", region: "Europe", feeds: ["https://www.irishtimes.com/arc/outboundfeeds/feed-world/?outputType=xml"] },
  { id: "kyivindependent", name: "The Kyiv Independent", lean: -1, ratedBy: "MBFC", region: "Europe", feeds: ["https://kyivindependent.com/news-archive/rss/"] },
  { id: "euobserver", name: "EUobserver", lean: null, region: "Europe", feeds: ["https://euobserver.com/feed/"] },
  { id: "balkaninsight", name: "Balkan Insight", lean: -1, ratedBy: "MBFC", region: "Europe", feeds: ["https://balkaninsight.com/feed/"] },

  // Canada
  { id: "cbc", name: "CBC News", lean: -1, ratedBy: "MBFC", region: "Canada", feeds: ["https://www.cbc.ca/webfeed/rss/rss-world", "https://www.cbc.ca/webfeed/rss/rss-topstories"] },
  { id: "globeandmail", name: "The Globe and Mail", lean: 1, ratedBy: "MBFC", region: "Canada", feeds: ["https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/"] },
  { id: "globalnews", name: "Global News", lean: -1, ratedBy: "MBFC", region: "Canada", feeds: ["https://globalnews.ca/world/feed/"] },
  { id: "nationalpost", name: "National Post", lean: 1, ratedBy: "MBFC", region: "Canada", feeds: ["https://nationalpost.com/category/news/world/feed.xml"] },

  // Asia-Pacific
  { id: "scmp", name: "South China Morning Post", lean: -1, ratedBy: "MBFC", region: "Asia-Pacific", feeds: ["https://www.scmp.com/rss/91/feed/"] },
  { id: "smh", name: "The Sydney Morning Herald", lean: -1, ratedBy: "MBFC", region: "Asia-Pacific", feeds: ["https://www.smh.com.au/rss/world.xml"] },
  { id: "sbs", name: "SBS News", lean: -1, ratedBy: "MBFC", region: "Asia-Pacific", feeds: ["https://www.sbs.com.au/news/topic/world/feed"] },
  { id: "asiatimes", name: "Asia Times", lean: 0, ratedBy: "MBFC", region: "Asia-Pacific", feeds: ["https://asiatimes.com/category/world/feed/"] },
  { id: "japantimes", name: "The Japan Times", lean: 0, ratedBy: "MBFC", region: "Asia-Pacific", feeds: ["https://www.japantimes.co.jp/feed/"] },
  { id: "straitstimes", name: "The Straits Times", lean: null, region: "Asia-Pacific", feeds: ["https://www.straitstimes.com/news/world/rss.xml"] },
  { id: "yonhap", name: "Yonhap", lean: 1, ratedBy: "MBFC", region: "Asia-Pacific", feeds: ["https://en.yna.co.kr/RSS/news.xml"] },
  { id: "koreaherald", name: "The Korea Herald", lean: null, region: "Asia-Pacific", feeds: ["https://www.koreaherald.com/rss/newsAll"] },

  // South Asia
  { id: "timesofindia", name: "The Times of India", lean: 1, ratedBy: "MBFC", region: "South Asia", feeds: ["https://timesofindia.indiatimes.com/rssfeedstopstories.cms"] },
  { id: "thehindu", name: "The Hindu", lean: -1, ratedBy: "MBFC", region: "South Asia", feeds: ["https://www.thehindu.com/news/international/feeder/default.rss"] },
  { id: "ndtv", name: "NDTV", lean: 1, ratedBy: "MBFC", region: "South Asia", feeds: ["https://feeds.feedburner.com/ndtvnews-world-news"] },

  // Middle East
  { id: "timesofisrael", name: "The Times of Israel", lean: -1, ratedBy: "MBFC", region: "Middle East", feeds: ["https://www.timesofisrael.com/feed/"] },
  { id: "jpost", name: "The Jerusalem Post", lean: 1, ratedBy: "MBFC", region: "Middle East", feeds: ["https://www.jpost.com/rss/rssfeedsfrontpage.aspx"] },
  { id: "arabnews", name: "Arab News", lean: 1, ratedBy: "MBFC", region: "Middle East", feeds: ["https://www.arabnews.com/rss.xml"] },

  // Africa and Latin America
  { id: "africanews", name: "Africanews", lean: null, region: "Africa", feeds: ["https://www.africanews.com/feed/rss"] },
  { id: "mercopress", name: "MercoPress", lean: -1, ratedBy: "MBFC", region: "Latin America", feeds: ["https://en.mercopress.com/rss/"] },
  { id: "batimes", name: "Buenos Aires Times", lean: 1, ratedBy: "MBFC", region: "Latin America", feeds: ["https://www.batimes.com.ar/feed"] },
  { id: "mexiconews", name: "Mexico News Daily", lean: null, region: "Latin America", feeds: ["https://mexiconewsdaily.com/feed/"] },

  // Technology, science, sports and entertainment. A left-right lean means little for these
  // beats, so they show as nonpolitical rather than unrated and never get an estimate.
  { id: "verge", nonpolitical: true, name: "The Verge", lean: null, region: "US", feeds: ["https://www.theverge.com/rss/index.xml"] },
  { id: "arstechnica", nonpolitical: true, name: "Ars Technica", lean: null, region: "US", feeds: ["https://feeds.arstechnica.com/arstechnica/index"] },
  { id: "techcrunch", nonpolitical: true, name: "TechCrunch", lean: null, region: "US", feeds: ["https://techcrunch.com/feed/"] },
  { id: "statnews", nonpolitical: true, name: "STAT", lean: null, region: "US", feeds: ["https://www.statnews.com/feed/"] },
  { id: "espn", nonpolitical: true, name: "ESPN", lean: null, region: "US", feeds: ["https://www.espn.com/espn/rss/news"] },
  { id: "bbcsport", nonpolitical: true, name: "BBC Sport", lean: null, region: "UK", feeds: ["https://feeds.bbci.co.uk/sport/rss.xml"] },
  { id: "variety", nonpolitical: true, name: "Variety", lean: null, region: "US", feeds: ["https://variety.com/feed/"] },

  // Market news
  { id: "marketwatch", name: "MarketWatch", lean: 0, region: "US", kind: "markets", feeds: ["https://feeds.content.dowjones.io/public/rss/mw_topstories"] },
  { id: "wsj", name: "The Wall Street Journal", lean: 1, ratedBy: "MBFC", region: "US", kind: "markets", feeds: ["https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", "https://feeds.content.dowjones.io/public/rss/RSSWorldNews"] },
  { id: "bloomberg", name: "Bloomberg", lean: 0, region: "US", kind: "markets", feeds: ["https://feeds.bloomberg.com/markets/news.rss"] },
  { id: "cnbc", name: "CNBC", lean: -1, region: "US", kind: "markets", feeds: ["https://www.cnbc.com/id/20409666/device/rss/rss.html", "https://www.cnbc.com/id/100727362/device/rss/rss.html"] },
  { id: "fortune", name: "Fortune", lean: 1, ratedBy: "MBFC", region: "US", kind: "markets", feeds: ["https://fortune.com/feed/"] },
  { id: "investing", nonpolitical: true, name: "Investing.com", lean: null, region: "US", kind: "markets", feeds: ["https://www.investing.com/rss/news_25.rss"] },
  { id: "coindesk", nonpolitical: true, name: "CoinDesk", lean: null, region: "US", kind: "markets", feeds: ["https://www.coindesk.com/arc/outboundfeeds/rss/"] },
  { id: "cointelegraph", nonpolitical: true, name: "Cointelegraph", lean: null, region: "US", kind: "markets", feeds: ["https://cointelegraph.com/rss"] }
].map((s) => ({ kind: "news", ...s }));

const LEAN_LABELS = { "-2": "Left", "-1": "Lean left", "0": "Center", "1": "Lean right", "2": "Right" };
const leanLabelFor = (lean) => (lean == null ? "Unrated" : LEAN_LABELS[lean]);

const REGIONS = ["US", "UK", "Europe", "Canada", "Asia-Pacific", "South Asia", "Middle East", "Africa", "Latin America"];

module.exports = { SOURCES, LEAN_LABELS, leanLabelFor, REGIONS };
