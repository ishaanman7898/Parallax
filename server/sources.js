// Outlets and their source-level lean on a -2 (left) to +2 (right) scale.
// Ratings follow the published AllSides Media Bias Chart at the time of writing.
// Ratings change, so check https://www.allsides.com/media-bias/ratings and edit here.
const SOURCES = [
  { id: "npr", name: "NPR", lean: -1, feeds: ["https://feeds.npr.org/1001/rss.xml"] },
  { id: "nyt", name: "The New York Times", lean: -1, feeds: ["https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"] },
  { id: "vox", name: "Vox", lean: -2, feeds: ["https://www.vox.com/rss/index.xml"] },
  {
    id: "bbc",
    name: "BBC News",
    lean: 0,
    feeds: [
      "https://feeds.bbci.co.uk/news/world/rss.xml",
      "https://feeds.bbci.co.uk/news/business/rss.xml",
      "https://feeds.bbci.co.uk/news/technology/rss.xml"
    ]
  },
  { id: "thehill", name: "The Hill", lean: 0, feeds: ["https://thehill.com/feed/"] },
  { id: "csm", name: "Christian Science Monitor", lean: 0, feeds: ["https://rss.csmonitor.com/feeds/all"] },
  { id: "fox", name: "Fox News", lean: 2, feeds: ["https://moxie.foxnews.com/google-publisher/latest.xml"] },
  { id: "nypost", name: "New York Post", lean: 1, feeds: ["https://nypost.com/feed/"] },
  { id: "examiner", name: "Washington Examiner", lean: 1, feeds: ["https://www.washingtonexaminer.com/feed"] }
];

const LEAN_LABELS = { "-2": "Left", "-1": "Lean left", "0": "Center", "1": "Lean right", "2": "Right" };

module.exports = { SOURCES, LEAN_LABELS };
