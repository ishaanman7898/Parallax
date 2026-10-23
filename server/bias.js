// Partisan-coded phrases, in the spirit of Gentzkow and Shapiro (2010), "What Drives Media Slant?".
// Each phrase carries a weight. Matches nudge an article away from its source rating.
const LEFT = {
  "undocumented immigrant": 2, "undocumented immigrants": 2, "undocumented": 1, "climate crisis": 2, "climate emergency": 2,
  "gun violence": 1, "gun safety": 2, "reproductive rights": 2, "abortion rights": 1, "anti abortion": 1, "pro choice": 2,
  "tax cuts for the wealthy": 2, "tax breaks for the rich": 2, "voter suppression": 2, "far right": 1, "maga extremists": 2,
  "extremist republicans": 2, "income inequality": 1, "living wage": 1, "racial justice": 1, "systemic racism": 2,
  "assault weapons": 1, "corporate greed": 2, "price gouging": 1, "book bans": 2, "gender affirming care": 2, "dark money": 1,
  "insurrection": 1, "election denier": 2, "election deniers": 2, "authoritarian": 1, "white nationalist": 1, "billionaire class": 2,
  "insurrectionists": 2, "climate denier": 2, "climate deniers": 2, "voting rights": 1, "medicare for all": 2, "wealth tax": 1,
  "tax the rich": 2, "union busting": 2, "big oil": 1, "fossil fuel industry": 1, "abortion ban": 1, "abortion bans": 1,
  "forced birth": 2, "anti trans": 2, "trans youth": 1, "lgbtq rights": 1, "white supremacy": 1, "white supremacist": 1,
  "police brutality": 2, "mass incarceration": 2, "racial equity": 1, "threat to democracy": 1, "assault on democracy": 2,
  "christian nationalism": 2, "christian nationalist": 2, "project 2025": 1, "student debt relief": 1, "corporate landlords": 2,
  "gun lobby": 2, "anti immigrant": 1, "migrant children": 1, "asylum seekers": 1, "far right extremists": 2, "trumpism": 1,
  "climate justice": 2, "environmental justice": 1, "reproductive freedom": 2, "bodily autonomy": 2, "wage theft": 2
};

const RIGHT = {
  "illegal aliens": 2, "illegal alien": 2, "illegal immigrants": 1, "illegals": 2, "border crisis": 1, "open borders": 2,
  "pro life": 2, "unborn": 2, "abortion on demand": 2, "death tax": 2, "tax relief": 1, "job creators": 2, "radical left": 2,
  "far left": 1, "woke": 2, "leftist": 2, "leftists": 2, "socialist": 1, "government overreach": 2, "big government": 2,
  "second amendment rights": 1, "gun rights": 1, "law abiding gun owners": 2, "parental rights": 1, "gender ideology": 2,
  "biological male": 2, "election integrity": 1, "weaponization": 1, "deep state": 2, "mainstream media": 1, "legacy media": 2,
  "crime wave": 1, "soft on crime": 2, "cancel culture": 2, "globalist": 2, "globalists": 2, "lawfare": 2,
  "illegal immigration": 1, "criminal illegal aliens": 2, "migrant crime": 2, "sanctuary cities": 1, "border invasion": 2,
  "chain migration": 2, "anchor babies": 2, "radical democrats": 2, "democrat party": 2, "democrat led": 1, "woke mind virus": 2,
  "critical race theory": 1, "transgender ideology": 2, "biological men": 2, "biological women": 1, "groomers": 2,
  "late term abortion": 2, "abortion industry": 2, "school choice": 1, "religious liberty": 1,
  "weaponized": 1, "two tiered justice": 2, "two tier justice": 2, "witch hunt": 1, "voter fraud": 1, "election fraud": 1,
  "climate alarmists": 2, "climate alarmism": 2, "green new scam": 2, "energy independence": 1, "gun grabbers": 2,
  "constitutional carry": 2, "nanny state": 2, "corporate media": 1, "fake news": 1, "america first": 1, "antifa": 1,
  "communist china": 2, "chinese communist party": 1, "diversity equity and inclusion": 1, "uniparty": 2,
  "bidenomics": 1, "pro family": 1, "taxpayer funded": 1, "unelected bureaucrats": 2, "medical freedom": 2
};

const normalize = (t) => " " + t.toLowerCase().replace(/[‘’']/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " ";

function matches(text, dict) {
  const found = [];
  let weight = 0;
  for (const [phrase, w] of Object.entries(dict)) {
    if (text.includes(" " + phrase + " ")) {
      found.push(phrase);
      weight += w;
    }
  }
  return { found, weight };
}

function leanLabel(score) {
  if (score <= -0.6) return "Left";
  if (score <= -0.2) return "Lean left";
  if (score < 0.2) return "Center";
  if (score < 0.6) return "Lean right";
  return "Right";
}

// Blends the outlet's lean (-2..2) with phrase evidence. Phrases can shift at most half the score.
// The lean is a published rating, or an estimate from the vocabulary model when `estimated`
// is set. Outlets with neither (null) get a score only from phrases, and only when the phrase
// weight is at least 2, so a single weak phrase never implies a rating the outlet does not have.
// `method` says which evidence the score rests on: "rating", "model" or "phrases".
function analyzeBias(input, sourceLean, estimated = false) {
  const text = normalize(input);
  const left = matches(text, LEFT);
  const right = matches(text, RIGHT);
  const total = left.weight + right.weight;
  const framing = total ? (right.weight - left.weight) / total : 0;
  const influence = Math.min(1, total / 4) * 0.5;
  const phrases = { score: Math.round(framing * 100) / 100, left: left.found, right: right.found };
  if (sourceLean == null) {
    if (total < 2) return { score: null, label: "Unrated", framing: phrases, method: null };
    const score = Math.round(framing * influence * 100) / 100;
    return { score, label: leanLabel(score), framing: phrases, method: "phrases" };
  }
  const score = Math.round(((sourceLean / 2) * (1 - influence) + framing * influence) * 100) / 100;
  return { score, label: leanLabel(score), framing: phrases, method: estimated ? "model" : "rating" };
}

module.exports = { analyzeBias, leanLabel, LEFT, RIGHT };
