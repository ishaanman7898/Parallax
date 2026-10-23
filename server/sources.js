// Outlets with their region, kind and source-level lean on a -2 (left) to +2 (right) scale.
// Lean follows the published AllSides Media Bias Chart at the time of writing. It is null
// for outlets without a rating we could confirm, which covers most non-US outlets since
// the US left-right scale maps poorly onto other countries' politics. Unrated outlets
// still count as coverage, and only get a lean estimate when partisan phrases appear.
// Ratings change, so check https://www.allsides.com/media-bias/ratings and edit here.
const SOURCES = [
  // US outlets with ratings
  { id: "npr", name: "NPR", lean: -1, region: "US", feeds: ["https://feeds.npr.org/1001/rss.xml", "https://feeds.npr.org/1004/rss.xml"] },
  { id: "nyt", name: "The New York Times", lean: -1, region: "US", feeds: ["https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"] },
  { id: "vox", name: "Vox", lean: -2, region: "US", feeds: ["https://www.vox.com/rss/index.xml"] },
  { id: "nbc", name: "NBC News", lean: -1, region: "US", feeds: ["https://feeds.nbcnews.com/nbcnews/public/news"] },
  { id: "latimes", name: "Los Angeles Times", lean: -1, region: "US", feeds: ["https://www.latimes.com/world-nation/rss2.0.xml"] },
  { id: "politico", name: "Politico", lean: -1, region: "US", feeds: ["https://www.politico.com/rss/politicopicks.xml"] },
  { id: "thehill", name: "The Hill", lean: 0, region: "US", feeds: ["https://thehill.com/feed/"] },
  { id: "csm", name: "Christian Science Monitor", lean: 0, region: "US", feeds: ["https://rss.csmonitor.com/feeds/all"] },
  { id: "fox", name: "Fox News", lean: 2, region: "US", feeds: ["https://moxie.foxnews.com/google-publisher/latest.xml"] },
  { id: "nypost", name: "New York Post", lean: 1, region: "US", feeds: ["https://nypost.com/feed/"] },
  { id: "examiner", name: "Washington Examiner", lean: 1, region: "US", feeds: ["https://www.washingtonexaminer.com/feed"] },

  // International broadcasters and wires
  {
    id: "bbc",
    name: "BBC News",
    lean: 0,
    region: "UK",
    feeds: ["https://feeds.bbci.co.uk/news/world/rss.xml", "https://feeds.bbci.co.uk/news/business/rss.xml", "https://feeds.bbci.co.uk/news/technology/rss.xml"]
  },
  { id: "aljazeera", name: "Al Jazeera", lean: -1, region: "Middle East", feeds: ["https://www.aljazeera.com/xml/rss/all.xml"] },
  { id: "dw", name: "DW", lean: null, region: "Europe", feeds: ["https://rss.dw.com/rdf/rss-en-top"] },
  { id: "france24", name: "France 24", lean: null, region: "Europe", feeds: ["https://www.france24.com/en/rss"] },
  { id: "euronews", name: "Euronews", lean: null, region: "Europe", feeds: ["https://www.euronews.com/rss"] },
  { id: "rfi", name: "RFI", lean: null, region: "Europe", feeds: ["https://www.rfi.fr/en/international/rss"] },
  { id: "sky", name: "Sky News", lean: null, region: "UK", feeds: ["https://feeds.skynews.com/feeds/rss/world.xml"] },
  { id: "upi", name: "UPI", lean: null, region: "US", feeds: ["https://rss.upi.com/news/tn_int.rss"] },

  // UK and Europe
  { id: "guardian", name: "The Guardian", lean: null, region: "UK", feeds: ["https://www.theguardian.com/world/rss"] },
  { id: "independent", name: "The Independent", lean: null, region: "UK", feeds: ["https://www.independent.co.uk/news/world/rss"] },
  { id: "ft", name: "Financial Times", lean: null, region: "UK", feeds: ["https://www.ft.com/world?format=rss"] },
  { id: "lemonde", name: "Le Monde", lean: null, region: "Europe", feeds: ["https://www.lemonde.fr/en/international/rss_full.xml"] },
  { id: "euractiv", name: "Euractiv", lean: null, region: "Europe", feeds: ["https://www.euractiv.com/feed"] },
  { id: "euobserver", name: "EUobserver", lean: null, region: "Europe", feeds: ["https://euobserver.com/feed/"] },
  { id: "balkaninsight", name: "Balkan Insight", lean: null, region: "Europe", feeds: ["https://balkaninsight.com/feed/"] },

  // Canada
  { id: "cbc", name: "CBC News", lean: null, region: "Canada", feeds: ["https://www.cbc.ca/webfeed/rss/rss-world"] },
  { id: "globeandmail", name: "The Globe and Mail", lean: null, region: "Canada", feeds: ["https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/"] },
  { id: "globalnews", name: "Global News", lean: null, region: "Canada", feeds: ["https://globalnews.ca/world/feed/"] },
  { id: "nationalpost", name: "National Post", lean: null, region: "Canada", feeds: ["https://nationalpost.com/category/news/world/feed.xml"] },

  // Asia-Pacific
  { id: "scmp", name: "South China Morning Post", lean: null, region: "Asia-Pacific", feeds: ["https://www.scmp.com/rss/91/feed/"] },
  { id: "smh", name: "The Sydney Morning Herald", lean: null, region: "Asia-Pacific", feeds: ["https://www.smh.com.au/rss/world.xml"] },
  { id: "sbs", name: "SBS News", lean: null, region: "Asia-Pacific", feeds: ["https://www.sbs.com.au/news/topic/world/feed"] },
  { id: "asiatimes", name: "Asia Times", lean: null, region: "Asia-Pacific", feeds: ["https://asiatimes.com/category/world/feed/"] },
  { id: "japantimes", name: "The Japan Times", lean: null, region: "Asia-Pacific", feeds: ["https://www.japantimes.co.jp/feed/"] },

  // Market news
  { id: "marketwatch", name: "MarketWatch", lean: null, region: "US", kind: "markets", feeds: ["https://feeds.content.dowjones.io/public/rss/mw_topstories"] },
  { id: "cnbc", name: "CNBC", lean: null, region: "US", kind: "markets", feeds: ["https://www.cnbc.com/id/20409666/device/rss/rss.html"] },
  { id: "investing", name: "Investing.com", lean: null, region: "US", kind: "markets", feeds: ["https://www.investing.com/rss/news_25.rss"] }
].map((s) => ({ kind: "news", ...s }));

const LEAN_LABELS = { "-2": "Left", "-1": "Lean left", "0": "Center", "1": "Lean right", "2": "Right" };
const leanLabelFor = (lean) => (lean == null ? "Unrated" : LEAN_LABELS[lean]);

const REGIONS = ["US", "UK", "Europe", "Canada", "Asia-Pacific", "Middle East"];

module.exports = { SOURCES, LEAN_LABELS, leanLabelFor, REGIONS };
