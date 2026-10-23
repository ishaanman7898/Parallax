// Reading profile behind For you and Your topics. It lives in localStorage, so it stays
// on this device and never leaves it. Also loads under Node so the tests can use it.
(function (root) {
  const KEY = "parallax.profile.v1";
  const DECAY = 0.97;
  const MAX_WORDS = 400;
  const MAX_READ = 300;
  const TOPICS = ["Politics", "World", "Markets", "Business", "Technology", "Health", "Climate", "Sports", "Culture"];
  const REGIONS = ["US", "UK", "Europe", "Canada", "Asia-Pacific", "Middle East"];
  const DEFAULT_TOPICS = ["region:US", "topic:World", "topic:Markets"];
  const STOP = new Set(
    "about after again also amid back been before being could does down during from have here into just keep last like made make many more most much must news next only other over said says should some still than that their them then there these they this those through under until upon very want were what when where which while will with would year years your".split(" ")
  );

  const fresh = () => ({
    v: 1,
    topics: DEFAULT_TOPICS.slice(),
    barStyle: "diverging",
    learn: true,
    seed: Math.floor(Math.random() * 2 ** 31),
    reads: 0,
    weights: { topic: {}, source: {}, word: {} },
    read: []
  });

  function normalize(p) {
    const base = fresh();
    if (!p || p.v !== 1) return base;
    return { ...base, ...p, weights: { ...base.weights, ...p.weights } };
  }

  function load(storage = root.localStorage) {
    try {
      return normalize(JSON.parse(storage.getItem(KEY)));
    } catch {
      return fresh();
    }
  }

  function save(p, storage = root.localStorage) {
    try {
      storage.setItem(KEY, JSON.stringify(p));
    } catch {
      // Private windows and blocked storage still get a working, unsaved profile.
    }
  }

  const keywords = (text) => [...new Set(String(text || "").toLowerCase().match(/[a-z][a-z']{3,}/g) || [])].filter((w) => !STOP.has(w));

  // Stable pseudo random number in [0, 1) for a seed and an article id.
  function rand(seed, id) {
    let h = 2166136261;
    for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    let t = (seed ^ h) + 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Older interests fade a little with every new read so the feed follows what you read now.
  function recordRead(p, a) {
    if (!p.learn || !a?.id || p.read.includes(a.id)) return false;
    const w = p.weights;
    for (const map of [w.topic, w.source, w.word]) for (const k in map) map[k] *= DECAY;
    if (a.topic) w.topic[a.topic] = (w.topic[a.topic] || 0) + 1;
    if (a.source?.name) w.source[a.source.name] = (w.source[a.source.name] || 0) + 1;
    keywords(a.title).forEach((k) => (w.word[k] = (w.word[k] || 0) + 0.5));
    const words = Object.entries(w.word);
    if (words.length > MAX_WORDS) w.word = Object.fromEntries(words.sort((x, y) => y[1] - x[1]).slice(0, MAX_WORDS));
    p.read = [a.id, ...p.read].slice(0, MAX_READ);
    p.reads++;
    return true;
  }

  const maxOf = (m) => Math.max(1e-9, ...Object.values(m));

  // Ranks articles by learned topic, outlet and headline word affinity plus freshness.
  // With no reading history the order is a shuffle that changes once a day.
  function rank(p, articles, now = Date.now()) {
    const day = Math.floor(now / 864e5);
    const w = p.weights;
    const max = { topic: maxOf(w.topic), source: maxOf(w.source), word: maxOf(w.word) };
    const read = new Set(p.read);
    const score = (a) => {
      const noise = rand(p.seed + day, a.id);
      const seen = read.has(a.id) ? 3 : 0;
      if (!p.reads) return noise - seen;
      const topic = (w.topic[a.topic] || 0) / max.topic;
      const source = (w.source[a.source?.name] || 0) / max.source;
      const words = Math.min(2, keywords(a.title).reduce((s, k) => s + (w.word[k] || 0), 0) / max.word);
      const hours = a.published ? Math.max(0, (now - Date.parse(a.published)) / 36e5) : 48;
      return 3 * topic + 1.5 * source + words + Math.exp(-hours / 24) + 0.6 * noise - seen;
    };
    return articles.map((a) => [a, score(a)]).sort((x, y) => y[1] - x[1]).map((x) => x[0]);
  }

  // Top n ranked articles, at most one per story and two per outlet.
  function forYou(p, articles, n, now) {
    const stories = new Set();
    const outlets = {};
    const picked = [];
    for (const a of rank(p, articles, now)) {
      const story = a.cluster?.id || a.id;
      const outlet = a.source?.name;
      if (stories.has(story) || (outlets[outlet] || 0) >= 2) continue;
      stories.add(story);
      outlets[outlet] = (outlets[outlet] || 0) + 1;
      picked.push(a);
      if (picked.length === n) break;
    }
    return picked;
  }

  function top(map, n) {
    const total = Object.values(map).reduce((s, x) => s + x, 0) || 1;
    return Object.entries(map).sort((x, y) => y[1] - x[1]).slice(0, n).map(([name, v]) => ({ name, share: v / total }));
  }

  const insights = (p) => ({ reads: p.reads, topics: top(p.weights.topic, 6), sources: top(p.weights.source, 6) });

  function toggleTopic(p, key) {
    p.topics = p.topics.includes(key) ? p.topics.filter((k) => k !== key) : [...p.topics, key];
  }

  function resetHistory(p) {
    Object.assign(p, { reads: 0, weights: { topic: {}, source: {}, word: {} }, read: [] });
  }

  const topicLabel = (key) => (key === "region:US" ? "U.S." : key.split(":")[1]);
  const topicMatches = (key, a) => {
    const [kind, value] = key.split(":");
    return kind === "region" ? a.source?.region === value : a.topic === value;
  };

  const api = { TOPICS, REGIONS, DEFAULT_TOPICS, fresh, load, save, keywords, rand, recordRead, rank, forYou, insights, toggleTopic, resetHistory, topicLabel, topicMatches };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ParallaxPrefs = api;
})(typeof window !== "undefined" ? window : globalThis);
