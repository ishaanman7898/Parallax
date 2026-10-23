// Sample content. Swap these objects for a real feed without touching the rendering code.
window.PARALLAX_DATA = {
  ticker: [
    { symbol: "S&P 500", price: 5842.47, change: 0.82 },
    { symbol: "NASDAQ", price: 18392.1, change: 1.24 },
    { symbol: "DOW", price: 42863.86, change: -0.16 },
    { symbol: "AAPL", price: 232.15, change: 0.64 },
    { symbol: "NVDA", price: 138.07, change: 2.31 },
    { symbol: "BTC", price: 67421.8, change: -0.92 },
    { symbol: "TSLA", price: 218.42, change: -1.08 },
    { symbol: "MSFT", price: 428.76, change: 0.56 }
  ],

  pulse: {
    symbol: "S&P 500",
    price: 5842.47,
    change: 47.52,
    changePct: 0.82,
    open: 5794.95,
    series: [41, 44, 43, 47, 45, 50, 49, 47, 53, 51, 49, 55, 57, 54, 59, 62, 58, 64, 61, 66, 63, 65, 62, 68],
    radar: ["NVDA", "TSLA", "MSFT"]
  },

  stories: [
    {
      id: "spending-fight",
      category: "Politics",
      title: "Washington’s next spending fight puts the economy in focus",
      summary: "Lawmakers weigh competing priorities as investors watch the implications for public spending, borrowing and growth.",
      desk: "Parallax briefing",
      minutes: 6,
      lean: null,
      published: "2026-10-23T07:30:00",
      image: "assets/capitol.svg",
      body: [
        "Congress returns this week with a familiar deadline on the calendar and very little agreement on how to meet it. Appropriators in both chambers have drafted bills that differ by tens of billions of dollars, and leadership on each side has signaled it is willing to wait for the other to move first.",
        "For markets the question is less about the shutdown risk itself and more about what a final deal says about borrowing. Treasury issuance has climbed steadily this year, and traders are watching whether any agreement includes caps that would slow it.",
        "Budget analysts note that most of the disagreement sits in a narrow band of discretionary programs. Mandatory spending and interest costs, which make up the bulk of federal outlays, are largely outside the current talks."
      ],
      framing: "This briefing is written to describe the process and the stakes without endorsing either side’s spending numbers. Coverage that leans left tends to focus on program cuts, while coverage that leans right tends to focus on deficit totals."
    },
    {
      id: "ai-energy",
      category: "Technology",
      title: "The AI buildout is reshaping the energy debate",
      summary: "New data centers bring investment and jobs, alongside difficult questions about power demand and who pays.",
      desk: "Technology desk",
      minutes: 4,
      lean: "left",
      published: "2026-10-23T06:10:00",
      body: [
        "Utilities in several states have revised their long term demand forecasts upward for the first time in a decade, citing requests from data center developers that dwarf anything they planned for.",
        "Local officials welcome the tax base, but consumer groups worry that the cost of new transmission lines and generation will land on household bills rather than on the companies driving the demand.",
        "Some developers are signing direct deals for nuclear and geothermal power, which could ease grid strain while raising questions about who gets priority when supply is tight."
      ],
      framing: "This version leads with ratepayer impact and community concerns, an emphasis more common in left leaning outlets. A right leaning frame would more often lead with investment, jobs and permitting delays."
    },
    {
      id: "bond-yields",
      category: "Markets",
      title: "Why bond yields still have Wall Street’s attention",
      summary: "The direction of borrowing costs matters for everything from mortgage rates to the next corporate earnings cycle.",
      desk: "Markets desk",
      minutes: 3,
      lean: "center",
      published: "2026-10-22T18:45:00",
      body: [
        "The ten year Treasury yield has moved in a tight range for most of the month, but investors are reluctant to call it stable. Each new inflation reading has produced a sharp move before yields settle back.",
        "Higher yields feed into mortgage rates, corporate borrowing costs and the discount rates analysts use to value stocks. That makes the bond market a quiet driver of decisions far outside fixed income.",
        "Strategists are split on direction. Some expect slowing growth to pull yields lower, while others point to heavy issuance as a reason they could stay elevated."
      ],
      framing: "This piece sticks to market mechanics and presents competing forecasts side by side, which is why it is labeled center in this demo."
    },
    {
      id: "regulation",
      category: "Business",
      title: "Businesses press for a lighter regulatory touch",
      summary: "Industry groups argue that simpler rules could unlock investment. Consumer advocates see a different set of risks.",
      desk: "Business desk",
      minutes: 5,
      lean: "right",
      published: "2026-10-22T15:20:00",
      body: [
        "Trade associations representing manufacturers, banks and energy producers have submitted a joint letter asking regulators to consolidate overlapping reporting rules.",
        "Their argument is that compliance costs fall hardest on smaller firms and slow down projects that would otherwise create jobs. Several governors have echoed the request.",
        "Consumer advocates counter that many of the rules were written after specific failures, and that loosening them could shift risk back onto customers and investors."
      ],
      framing: "This version gives the industry case more space and leads with compliance costs, an emphasis more common in right leaning coverage. A left leaning frame would more often lead with the failures that prompted the rules."
    },
    {
      id: "commute",
      category: "World",
      title: "Cities rethink the future of the daily commute",
      summary: "Transport planners are balancing housing growth, changing work patterns and the cost of expanding public transit.",
      desk: "World desk",
      minutes: 4,
      lean: "left",
      published: "2026-10-22T11:05:00",
      body: [
        "From Toronto to Melbourne, transit agencies are redrawing routes around where people now live and work, rather than around a single downtown core.",
        "Ridership has recovered unevenly. Weekday peaks are lower than before, but weekend and off peak trips have grown, which changes how agencies plan service and budgets.",
        "Planners say the biggest constraint is housing. New lines only pay off if enough homes are built near stations, and zoning fights often take longer than construction."
      ],
      framing: "This piece frames transit as public infrastructure worth expanding, a framing more common in left leaning outlets. A right leaning frame would more often focus on cost overruns and ridership per dollar."
    },
    {
      id: "chip-race",
      category: "Technology",
      title: "The next chapter of the global chip race",
      summary: "Governments and manufacturers are making long term bets on supply chains, domestic production and advanced computing.",
      desk: "Technology desk",
      minutes: 5,
      lean: "center",
      published: "2026-10-21T20:30:00",
      body: [
        "New fabrication plants announced over the past three years are starting to come online, though most will not reach full output until later in the decade.",
        "Subsidy programs in the United States, Europe, Japan and South Korea have created a crowded field. Analysts expect some projects to be delayed or scaled back as demand settles.",
        "The most advanced chips remain concentrated in a handful of facilities, which keeps supply chain risk near the top of policy agendas."
      ],
      framing: "This piece reports timelines and policy positions from several governments without favoring one approach, which is why it is labeled center in this demo."
    },
    {
      id: "rate-path",
      category: "Markets",
      title: "Traders reset expectations for the rate path",
      summary: "Futures markets now price fewer cuts next year as inflation proves sticky in services.",
      desk: "Markets desk",
      minutes: 3,
      lean: "center",
      published: "2026-10-21T14:00:00",
      body: [
        "Fed funds futures shifted this week after a stronger than expected services inflation print, trimming the number of cuts traders expect over the next twelve months.",
        "Goods prices have cooled, but shelter and services costs have been slower to follow. Policymakers have said they want to see that gap close before easing further.",
        "Equity markets took the repricing in stride, with gains concentrated in large technology names that are less sensitive to short term rates."
      ],
      framing: "This piece describes market pricing and official statements without predicting policy, which is why it is labeled center in this demo."
    }
  ]
};
