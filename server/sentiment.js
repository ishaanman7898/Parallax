const vader = require("vader-sentiment");
const { lexicon } = require("vader-sentiment/src/vader_lexicon.js");

// VADER handles general language well but misses market vocabulary, so these
// news and finance terms (VADER -4..4 scale) are folded into its raw score.
const NEWS_LEXICON = {
  rally: 1.8, rallies: 1.8, rallied: 1.8, surge: 1.6, surges: 1.6, surged: 1.6, soar: 2, soars: 2, soared: 2,
  jump: 1, jumps: 1, jumped: 1, climb: 1, climbs: 1, climbed: 1, rebound: 1.5, rebounds: 1.5, rebounded: 1.5,
  outperform: 1.8, outperforms: 1.8, upgrade: 1.5, upgrades: 1.5, upgraded: 1.5, bullish: 2, boom: 0.8, booming: 1.2,
  cools: 0.6, eases: 0.8, easing: 0.6, beats: 0.4, ceasefire: 1.5, breakthrough: 2,
  plunge: -2, plunges: -2, plunged: -2, plummet: -2.2, plummets: -2.2, plummeted: -2.2, tumble: -1.8, tumbles: -1.8,
  tumbled: -1.8, slump: -1.8, slumps: -1.8, slumped: -1.8, sink: -1.2, sinks: -1.2, sank: -1.2, slide: -1, slides: -1,
  slid: -1, drop: -1, drops: -1, dropped: -1, fell: -1, falls: -1, selloff: -2, downgrade: -1.5, downgrades: -1.5,
  downgraded: -1.5, bearish: -2, recession: -2.2, layoffs: -2, layoff: -2, bankruptcy: -2.5, shutdown: -1.5,
  volatility: -0.8, underperform: -1.5, tariffs: -0.6, deficit: -1, strikes: -1.2, airstrike: -2.5,
  airstrikes: -2.5, riots: -2.2, shooting: -2.5, earthquake: -2, flooding: -1.8, outbreak: -2,
  spooked: -1.5, rattled: -1.5, whiplash: -1, squeeze: -0.8, selloffs: -2
};

const NEGATIONS = new Set(["not", "no", "never", "isn't", "aren't", "wasn't", "weren't", "don't", "doesn't", "didn't", "won't", "can't", "cannot", "without", "nor"]);

// Sensational verbs and adjectives that signal opinionated or emotive framing.
const LOADED = new Set([
  "slams", "slammed", "blasts", "blasted", "rips", "ripped", "destroys", "destroyed", "torches", "eviscerates",
  "shocking", "shocked", "bombshell", "chaos", "chaotic", "meltdown", "disaster", "disastrous", "outrage", "outraged",
  "furious", "fury", "scathing", "brutal", "explosive", "devastating", "stunning", "stunned", "humiliating", "humiliated",
  "unhinged", "insane", "crazy", "radical", "extremist", "extreme", "dangerous", "terrifying", "horrifying", "nightmare",
  "catastrophic", "catastrophe", "slaughter", "massacre", "regime", "propaganda", "disgraceful",
  "despicable", "shameful", "absurd", "ridiculous", "pathetic", "spectacular", "epic", "historic", "unprecedented",
  "staggering", "alarming", "blistering", "fiery", "heated", "rant", "tirade", "smear", "hoax", "scandal", "embarrassing"
]);

const VADER_WORDS = new Set(Object.keys(lexicon));

const tokenize = (t) => t.toLowerCase().replace(/[‘’]/g, "'").match(/[a-z][a-z']*/g) || [];
// Splits hyphenated compounds like "weaker-than-expected" so each word is scored.
const splitHyphens = (t) => t.replace(/([A-Za-z])-(?=[A-Za-z])/g, "$1 ");
const round = (n) => Math.round(n * 1000) / 1000;

// Recovers VADER's raw valence sum from its normalized compound score.
function rawSum(compound) {
  const c = Math.max(-0.9999, Math.min(0.9999, compound));
  return c * Math.sqrt(15 / (1 - c * c));
}

function analyzeSentiment(raw) {
  const input = splitHyphens(raw);
  const v = vader.SentimentIntensityAnalyzer.polarity_scores(input);
  const tokens = tokenize(input);
  let sum = rawSum(v.compound);
  tokens.forEach((tok, i) => {
    const val = NEWS_LEXICON[tok];
    if (val === undefined || VADER_WORDS.has(tok)) return;
    const negated = tokens.slice(Math.max(0, i - 3), i).some((t) => NEGATIONS.has(t));
    sum += negated ? val * -0.74 : val;
  });
  const compound = sum / Math.sqrt(sum * sum + 15);
  const label = compound >= 0.05 ? "positive" : compound <= -0.05 ? "negative" : "neutral";
  return { compound: round(compound), label };
}

function analyzeLoaded(input) {
  const tokens = tokenize(input);
  const words = [...new Set(tokens.filter((t) => LOADED.has(t)))];
  const caps = (input.match(/\b[A-Z]{4,}\b/g) || []).length;
  const hits = tokens.filter((t) => LOADED.has(t)).length + caps + (input.match(/!/g) || []).length;
  return { ratio: tokens.length ? round(hits / tokens.length) : 0, words };
}

module.exports = { analyzeSentiment, analyzeLoaded, tokenize };
