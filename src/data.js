// Sample data in the same shape as the API. Used when the Parallax server is not
// running, for example when the src folder is hosted as a plain static site.
window.PARALLAX_SAMPLE = (function () {
  const source = { id: "sample", name: "Parallax sample", lean: 0, label: "Sample" };
  const leanLabel = (s) => (s <= -0.6 ? "Left" : s <= -0.2 ? "Lean left" : s < 0.2 ? "Center" : s < 0.6 ? "Lean right" : "Right");
  const toneLabel = (c) => (c >= 0.05 ? "positive" : c <= -0.05 ? "negative" : "neutral");

  const stories = [
    ["spending-fight", "Politics", "Washington’s next spending fight puts the economy in focus", "Lawmakers weigh competing priorities as investors watch the implications for public spending, borrowing and growth.", 0, -0.2, "assets/capitol.svg"],
    ["ai-energy", "Technology", "The AI buildout is reshaping the energy debate", "New data centers bring investment and jobs, alongside difficult questions about power demand and who pays.", -0.4, 0.1],
    ["bond-yields", "Markets", "Why bond yields still have Wall Street’s attention", "The direction of borrowing costs matters for everything from mortgage rates to the next corporate earnings cycle.", 0, 0],
    ["regulation", "Business", "Businesses press for a lighter regulatory touch", "Industry groups argue that simpler rules could unlock investment. Consumer advocates see a different set of risks.", 0.4, 0.3],
    ["commute", "World", "Cities rethink the future of the daily commute", "Transport planners are balancing housing growth, changing work patterns and the cost of expanding public transit.", -0.4, 0.2],
    ["chip-race", "Technology", "The next chapter of the global chip race", "Governments and manufacturers are making long term bets on supply chains, domestic production and advanced computing.", 0, 0.1],
    ["rate-path", "Markets", "Traders reset expectations for the rate path", "Futures markets now price fewer cuts next year as inflation proves sticky in services.", 0, -0.3]
  ];

  const clusters = stories.map(([id, topic, title, summary, lean, tone, image], i) => {
    const published = new Date(Date.now() - (i + 1) * 3 * 36e5).toISOString();
    const article = {
      id, source, title, summary, link: null, image: image || null, published, topic,
      sentiment: { compound: tone, label: toneLabel(tone) },
      loaded: { ratio: 0, words: [] },
      bias: { score: lean, label: leanLabel(lean), framing: { score: 0, left: [], right: [] } }
    };
    return {
      id, title, summary, image: image || null, topic, published, sourceCount: 1,
      coverage: { left: 0, center: 1, right: 0 }, blindspot: null,
      lean: { score: lean, label: leanLabel(lean) }, sentiment: tone, articles: [article]
    };
  });

  const series = [41, 44, 43, 47, 45, 50, 49, 47, 53, 51, 49, 55, 57, 54, 59, 62, 58, 64, 61, 66, 63, 65, 62, 68].map((x) => 5790 + x);
  const quote = (symbol, label, price, changePct) => ({ symbol, label, price, prevClose: price / (1 + changePct / 100), open: price, change: price - price / (1 + changePct / 100), changePct, series: [] });

  return {
    news: { sample: true, updated: new Date().toISOString(), sources: [], articleCount: clusters.length, clusters },
    markets: {
      sample: true,
      quotes: [
        { ...quote("^GSPC", "S&P 500", 5842.47, 0.82), open: 5794.95, series },
        quote("^IXIC", "NASDAQ", 18392.1, 1.24),
        quote("^DJI", "DOW", 42863.86, -0.16),
        quote("NVDA", "NVDA", 138.07, 2.31),
        quote("TSLA", "TSLA", 218.42, -1.08),
        quote("MSFT", "MSFT", 428.76, 0.56)
      ],
      fearGreed: null
    }
  };
})();
