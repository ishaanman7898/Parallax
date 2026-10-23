const test = require("node:test");
const assert = require("node:assert");
const Prefs = require("../src/prefs");

const NOW = Date.parse("2026-10-23T12:00:00Z");
const art = (id, topic, source, title, hoursAgo = 1) => ({
  id, topic, title, source: { name: source }, cluster: { id: "c-" + id },
  published: new Date(NOW - hoursAgo * 36e5).toISOString()
});
const pool = [
  art("a", "Sports", "Fox News", "Yankees win the pennant"),
  art("b", "Technology", "Vox", "New chips power the next AI models"),
  art("c", "Politics", "NPR", "Senate passes a funding bill"),
  art("d", "Technology", "BBC News", "Startups race to build AI chips"),
  art("e", "Health", "NBC News", "Flu season starts early")
];

function memory() {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v) };
}

test("a new profile shuffles the same way for the same seed and day", () => {
  const p = { ...Prefs.fresh(), seed: 42 };
  const first = Prefs.rank(p, pool, NOW).map((a) => a.id);
  assert.deepEqual(Prefs.rank(p, pool, NOW).map((a) => a.id), first);
  assert.equal(first.length, pool.length);
});

test("reading technology pushes technology to the top", () => {
  const p = { ...Prefs.fresh(), seed: 7 };
  Prefs.recordRead(p, art("x", "Technology", "Vox", "AI chips are getting cheaper"));
  Prefs.recordRead(p, art("y", "Technology", "BBC News", "Chip makers expand AI factories"));
  const ranked = Prefs.rank(p, pool, NOW).map((a) => a.id);
  assert.deepEqual(ranked.slice(0, 2).sort(), ["b", "d"]);
  assert.equal(p.reads, 2);
});

test("articles already read sink and are only counted once", () => {
  const p = { ...Prefs.fresh(), seed: 7 };
  assert.ok(Prefs.recordRead(p, pool[1]));
  assert.ok(!Prefs.recordRead(p, pool[1]));
  assert.equal(p.reads, 1);
  assert.notEqual(Prefs.rank(p, pool, NOW)[0].id, "b");
});

test("learning can be paused and reset", () => {
  const p = Prefs.fresh();
  p.learn = false;
  assert.ok(!Prefs.recordRead(p, pool[0]));
  p.learn = true;
  Prefs.recordRead(p, pool[0]);
  Prefs.resetHistory(p);
  assert.equal(p.reads, 0);
  assert.deepEqual(p.weights.topic, {});
});

test("for you keeps one article per story and two per outlet", () => {
  const p = { ...Prefs.fresh(), seed: 1 };
  const many = [1, 2, 3, 4].map((i) => art("v" + i, "Technology", "Vox", "AI story " + i));
  const picked = Prefs.forYou(p, [...many, ...pool], 10, NOW);
  assert.ok(picked.filter((a) => a.source.name === "Vox").length <= 2);
  assert.equal(new Set(picked.map((a) => a.cluster.id)).size, picked.length);
});

test("profiles save, load and fall back when storage is broken", () => {
  const store = memory();
  const p = Prefs.fresh();
  Prefs.toggleTopic(p, "topic:Sports");
  Prefs.recordRead(p, pool[0]);
  Prefs.save(p, store);
  const back = Prefs.load(store);
  assert.ok(back.topics.includes("topic:Sports"));
  assert.equal(back.reads, 1);
  assert.deepEqual(Prefs.load({ getItem: () => "{oops" }).topics, Prefs.DEFAULT_TOPICS);
});

test("topic keys match by topic or by outlet region", () => {
  assert.ok(Prefs.topicMatches("topic:Health", pool[4]));
  assert.ok(Prefs.topicMatches("region:UK", { source: { region: "UK" } }));
  assert.equal(Prefs.topicLabel("region:US"), "U.S.");
});
