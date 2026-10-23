const test = require("node:test");
const assert = require("node:assert");
const { analyzeSentiment, analyzeLoaded } = require("../server/sentiment");
const { analyzeBias } = require("../server/bias");
const { classify } = require("../server/topics");

test("sentiment reads clear positive and negative headlines", () => {
  assert.equal(analyzeSentiment("Markets rally as stocks soar to a record").label, "positive");
  assert.equal(analyzeSentiment("Stocks plunge as recession fears grow").label, "negative");
  assert.equal(analyzeSentiment("Council meets on Tuesday").label, "neutral");
});

test("news lexicon respects negation", () => {
  const plain = analyzeSentiment("Shares plunged after the report").compound;
  const negated = analyzeSentiment("Shares never plunged after the report").compound;
  assert.ok(plain < 0);
  assert.ok(negated > plain);
});

test("hyphenated compounds are scored word by word", () => {
  assert.equal(analyzeSentiment("Shares slide on a weaker-than-expected forecast").label, "negative");
});

test("loaded language finds sensational words", () => {
  const r = analyzeLoaded("Senator SLAMS bombshell report in heated hearing!");
  assert.deepEqual(r.words.sort(), ["bombshell", "heated", "slams"]);
  assert.ok(r.ratio > 0);
});

test("bias starts from the source rating", () => {
  assert.equal(analyzeBias("Council meets on Tuesday", 0).label, "Center");
  assert.equal(analyzeBias("Council meets on Tuesday", -1).label, "Lean left");
  assert.equal(analyzeBias("Council meets on Tuesday", 2).label, "Right");
});

test("framing phrases shift a center source", () => {
  const right = analyzeBias("The radical left wants open borders and more illegal aliens", 0);
  assert.ok(right.score > 0.2, right.score);
  assert.deepEqual(right.framing.right.sort(), ["illegal aliens", "open borders", "radical left"]);
  const left = analyzeBias("Advocates for undocumented immigrants decry voter suppression and the climate crisis", 0);
  assert.ok(left.score < -0.2, left.score);
});

test("unrated outlets only get a lean from phrases", () => {
  assert.deepEqual(analyzeBias("Council meets on Tuesday", null), { score: null, label: "Unrated", framing: { score: 0, left: [], right: [] }, method: null });
  assert.equal(analyzeBias("Thousands demand abortion rights", null).label, "Unrated");
  const r = analyzeBias("The radical left wants open borders", null);
  assert.equal(r.label, "Lean right");
  assert.ok(r.score <= 0.5);
});

test("phrase matching ignores partial words and handles hyphens", () => {
  assert.deepEqual(analyzeBias("The wokeness debate", 0).framing.right, []);
  assert.deepEqual(analyzeBias("A pro-life rally", 0).framing.right, ["pro life"]);
});

test("topic classifier", () => {
  assert.equal(classify("Fed signals interest rates will stay high as bond yields climb"), "Markets");
  assert.equal(classify("Senate Republicans unveil election plan"), "Politics");
  assert.equal(classify("Brewers and Rays meet in the World Series"), "Sports");
  assert.equal(classify("A quiet afternoon"), "General");
  assert.notEqual(classify("A wind farm in New Mexico"), "World");
});
