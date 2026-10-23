// Keyword topic classifier. The first topic in this order wins ties.
const TOPICS = {
  Sports: ["nba", "nfl", "mlb", "nhl", "game", "season", "coach", "championship", "world series", "playoffs", "olympics", "soccer", "football", "quarterback", "touchdown", "pitcher", "inning", "goalie", "giants", "lakers", "yankees", "dodgers"],
  Markets: ["stock", "stocks", "shares", "market", "markets", "dow", "nasdaq", "s&p", "investors", "bond", "bonds", "yields", "fed", "interest rate", "interest rates", "earnings", "crypto", "bitcoin", "wall street", "treasury", "futures", "inflation"],
  Business: ["company", "companies", "ceo", "deal", "merger", "layoffs", "tariff", "tariffs", "trade", "economy", "economic", "jobs", "retail", "sales", "billion", "startup", "industry", "prices", "consumers"],
  Technology: ["ai", "artificial intelligence", "tech", "chip", "chips", "software", "apple", "google", "meta", "microsoft", "nvidia", "openai", "cyber", "data center", "data centers", "spacex", "starlink", "internet", "app", "hackers", "php"],
  Politics: ["trump", "biden", "congress", "senate", "house", "republican", "republicans", "democrat", "democrats", "democratic", "gop", "election", "elections", "midterm", "midterms", "campaign", "governor", "supreme court", "white house", "voters", "lawmakers", "redistricting", "debate"],
  World: ["ukraine", "russia", "china", "israel", "gaza", "iran", "france", "europe", "european", "united nations", "war", "minister", "putin", "kyiv", "nato", "brazil", "india", "germany", "sudan", "yemen", "korea", "japan", "mexico", "canada", "britain", "uk"],
  Health: ["health", "covid", "vaccine", "virus", "medicaid", "medicare", "hospital", "hospitals", "disease", "drug", "drugs", "cancer", "patients", "fda"],
  Climate: ["climate", "storm", "earthquake", "hurricane", "flood", "flooding", "wildfire", "weather", "emissions", "heat", "drought"],
  Culture: ["film", "movie", "music", "celebrity", "tv", "album", "actor", "actress", "netflix", "hollywood", "book", "art"]
};

const ENTRIES = Object.entries(TOPICS).map(([topic, words]) => [topic, words.map((w) => new RegExp(`\\b${w.replace(/[&]/g, "\\$&")}\\b`, "i"))]);

function classify(text, categories = []) {
  const haystack = text + " " + categories.join(" ");
  let best = "General";
  let bestScore = 0;
  for (const [topic, patterns] of ENTRIES) {
    const score = patterns.reduce((n, re) => n + (re.test(haystack) ? 1 : 0), 0);
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  return best;
}

module.exports = { classify, TOPICS: Object.keys(TOPICS) };
