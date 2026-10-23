// Partisan-coded phrases, in the spirit of Gentzkow and Shapiro (2010), "What Drives Media Slant?".
// Each phrase carries a weight. Matches nudge an article away from its source rating.
const LEFT = {
  "undocumented immigrant": 2, "undocumented immigrants": 2, "undocumented": 1, "climate crisis": 2, "climate emergency": 2,
  "gun violence": 1, "gun safety": 2, "reproductive rights": 2, "abortion rights": 1, "anti abortion": 1, "pro choice": 2,
  "tax cuts for the wealthy": 2, "tax breaks for the rich": 2, "voter suppression": 2, "far right": 1, "maga extremists": 2,
  "extremist republicans": 2, "income inequality": 1, "living wage": 1, "racial justice": 1, "systemic racism": 2,
  "assault weapons": 1, "corporate greed": 2, "price gouging": 1, "book bans": 2, "gender affirming care": 2, "dark money": 1,
  "insurrection": 1, "election denier": 2, "election deniers": 2, "authoritarian": 1, "white nationalist": 1, "billionaire class": 2
};

const RIGHT = {
  "illegal aliens": 2, "illegal alien": 2, "illegal immigrants": 1, "illegals": 2, "border crisis": 1, "open borders": 2,
  "pro life": 2, "unborn": 2, "abortion on demand": 2, "death tax": 2, "tax relief": 1, "job creators": 2, "radical left": 2,
  "far left": 1, "woke": 2, "leftist": 2, "leftists": 2, "socialist": 1, "government overreach": 2, "big government": 2,
  "second amendment rights": 1, "gun rights": 1, "law abiding gun owners": 2, "parental rights": 1, "gender ideology": 2,
  "biological male": 2, "election integrity": 1, "weaponization": 1, "deep state": 2, "mainstream media": 1, "legacy media": 2,
  "crime wave": 1, "soft on crime": 2, "cancel culture": 2, "globalist": 2, "globalists": 2, "lawfare": 2
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

// Blends the outlet's rating (-2..2) with phrase evidence. Phrases can shift at most half the score.
function analyzeBias(input, sourceLean) {
  const text = normalize(input);
  const left = matches(text, LEFT);
  const right = matches(text, RIGHT);
  const total = left.weight + right.weight;
  const framing = total ? (right.weight - left.weight) / total : 0;
  const influence = Math.min(1, total / 4) * 0.5;
  const score = Math.round(((sourceLean / 2) * (1 - influence) + framing * influence) * 100) / 100;
  return { score, label: leanLabel(score), framing: { score: Math.round(framing * 100) / 100, left: left.found, right: right.found } };
}

module.exports = { analyzeBias, leanLabel, LEFT, RIGHT };
