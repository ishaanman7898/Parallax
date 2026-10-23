// Sample data in the same shape as the API. Used when the Parallax server is not
// running, for example when the src folder is hosted as a plain static site.
window.PARALLAX_SAMPLE = (function () {
  const outlets = {
    npr: ["NPR", -1, "US"], vox: ["Vox", -2, "US"], nbc: ["NBC News", -1, "US"], politico: ["Politico", -1, "US"],
    thehill: ["The Hill", 0, "US"], csm: ["Christian Science Monitor", 0, "US"], fox: ["Fox News", 2, "US"],
    nypost: ["New York Post", 1, "US"], examiner: ["Washington Examiner", 1, "US"], bbc: ["BBC News", 0, "UK"],
    guardian: ["The Guardian", null, "UK"], dw: ["DW", null, "Europe"], scmp: ["South China Morning Post", null, "Asia-Pacific"],
    cbc: ["CBC News", null, "Canada"], cnbc: ["CNBC", null, "US", "markets"], marketwatch: ["MarketWatch", null, "US", "markets"]
  };
  const labels = { "-2": "Left", "-1": "Lean left", 0: "Center", 1: "Lean right", 2: "Right" };
  const leanLabel = (s) => (s <= -0.6 ? "Left" : s <= -0.2 ? "Lean left" : s < 0.2 ? "Center" : s < 0.6 ? "Lean right" : "Right");
  const toneLabel = (c) => (c >= 0.05 ? "positive" : c <= -0.05 ? "negative" : "neutral");
  const sourceOf = (id) => {
    const [name, lean, region, kind = "news"] = outlets[id];
    return { id, name, lean, rated: lean != null, ratedBy: lean == null ? null : "AllSides", estimated: false, label: lean == null ? "Unrated" : labels[lean], region, kind };
  };

  // [cluster id, topic, summary, image, [[outlet, headline, tone], ...]]
  const stories = [
    ["spending-fight", "Politics", "Lawmakers weigh competing priorities as investors watch the implications for public spending, borrowing and growth.", "assets/capitol.svg", [
      ["npr", "Spending talks stall as the deadline to fund the government nears", -0.31],
      ["fox", "Lawmakers trade blame as shutdown deadline looms", -0.52],
      ["thehill", "Bipartisan group floats a stopgap deal to avoid a shutdown", 0.34],
      ["csm", "What is at stake in the latest budget standoff", -0.02]
    ]],
    ["ai-energy", "Technology", "New data centers bring investment and jobs, alongside difficult questions about power demand and who pays.", null, [
      ["vox", "The AI buildout is straining the power grid", -0.28],
      ["examiner", "Data center surge brings jobs to rural counties", 0.46],
      ["bbc", "Tech giants turn to nuclear power to run new data centers", 0.08]
    ]],
    ["bond-yields", "Markets", "The direction of borrowing costs matters for everything from mortgage rates to the next corporate earnings cycle.", null, [
      ["cnbc", "Treasury yields climb as traders scale back rate cut bets", -0.18],
      ["nypost", "Mortgage rates jump again, squeezing first time buyers", -0.44],
      ["marketwatch", "Why the 10 year yield still matters for your mortgage", 0.02]
    ]],
    ["climate-targets", "World", "European governments disagree on how fast to cut emissions as energy costs stay high.", null, [
      ["dw", "EU leaders split over new climate targets", -0.31],
      ["guardian", "Climate deal hangs on a late night compromise in Brussels", -0.12]
    ]],
    ["flu-season", "Health", "Doctors expect an early start to flu season and urge people to get vaccinated.", null, [
      ["nbc", "Hospitals brace for an early start to flu season", -0.29],
      ["cbc", "Flu shots open early as clinics prepare for a busy winter", 0.21]
    ]],
    ["chip-race", "Technology", "Governments and manufacturers are making long term bets on supply chains and domestic production.", null, [
      ["politico", "The next chapter of the global chip race", 0.1],
      ["scmp", "Chipmakers in Asia expand as demand for AI hardware grows", 0.38]
    ]],
    ["typhoon", "Climate", "A strong storm is bringing heavy rain and wind to southern China and nearby islands.", null, [
      ["scmp", "Typhoon brings heavy rain to southern China", -0.47],
      ["bbc", "Thousands evacuated as typhoon nears the coast", -0.4]
    ]],
    ["rate-path", "Markets", "Futures markets now price fewer cuts next year as inflation proves sticky in services.", null, [
      ["cnbc", "Traders reset expectations for the rate path", -0.3],
      ["marketwatch", "Bank earnings beat forecasts as trading revenue jumps", 0.48]
    ]]
  ];

  let n = 0;
  const clusters = stories.map(([id, topic, summary, image, takes], i) => {
    const articles = takes.map(([src, title, tone], j) => {
      const source = sourceOf(src);
      const lean = source.lean == null ? null : source.lean / 2;
      const published = new Date(Date.now() - (i * 3 + j + 1) * 47 * 6e4).toISOString();
      return {
        id: `${id}-${++n}`, source, title, summary, link: null, image: j === 0 ? image : null, published, topic,
        sentiment: { compound: tone, label: toneLabel(tone) },
        loaded: { ratio: 0, words: [] },
        bias: { score: lean, label: lean == null ? "Unrated" : leanLabel(lean), framing: { score: 0, left: [], right: [] } }
      };
    });
    const coverage = { left: 0, center: 0, right: 0, unrated: 0 };
    articles.forEach((a) => {
      const l = a.source.lean;
      coverage[l == null ? "unrated" : l < 0 ? "left" : l > 0 ? "right" : "center"]++;
    });
    const rated = articles.filter((a) => a.bias.score != null);
    const lean = rated.length ? rated.reduce((s, a) => s + a.bias.score, 0) / rated.length : null;
    return {
      id, title: articles[0].title, summary, image, topic, published: articles[0].published,
      sourceCount: articles.length, regions: [...new Set(articles.map((a) => a.source.region))], coverage, blindspot: null,
      lean: lean == null ? { score: null, label: "Unrated" } : { score: lean, label: leanLabel(lean) },
      sentiment: articles.reduce((s, a) => s + a.sentiment.compound, 0) / articles.length,
      rank: stories.length - i, articles
    };
  });

  const series = [41, 44, 43, 47, 45, 50, 49, 47, 53, 51, 49, 55, 57, 54, 59, 62, 58, 64, 61, 66, 63, 65, 62, 68].map((x) => 5790 + x);
  const quote = (symbol, label, price, changePct) => ({ symbol, label, price, prevClose: price / (1 + changePct / 100), open: price, change: price - price / (1 + changePct / 100), changePct, series: [] });

  return {
    news: { sample: true, updated: new Date().toISOString(), sources: [], articleCount: n, clusters },
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
