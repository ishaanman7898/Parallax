const { XMLParser } = require("fast-xml-parser");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  processEntities: false
});

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v) => (v == null ? "" : typeof v === "object" ? String(v["#text"] ?? "") : String(v));

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (m, n) => (+n <= 0x10ffff ? String.fromCodePoint(+n) : m))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => (parseInt(n, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(n, 16)) : m))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

// Turns feed HTML into plain text. Decodes twice because some feeds escape their HTML.
function clean(html) {
  return decode(decode(String(html)).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function validImage(url) {
  return /^https:\/\//.test(url || "") && !/pixel|tracking|undefined/i.test(url);
}

function findImage(item) {
  const media = [...toArray(item["media:content"]), ...toArray(item["media:thumbnail"])];
  for (const m of media) {
    const url = decode(m["@url"] || "");
    if (validImage(url) && (!m["@medium"] || m["@medium"] === "image")) return url;
  }
  for (const e of toArray(item.enclosure)) {
    const url = decode(e["@url"] || "");
    if (/^image\//.test(e["@type"] || "") && validImage(url)) return url;
  }
  const html = decode(text(item["content:encoded"]) + text(item.content) + text(item.description) + text(item.summary));
  for (const [, raw] of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const url = decode(raw);
    if (validImage(url)) return url;
  }
  return null;
}

function atomLink(link) {
  const links = toArray(link);
  const alt = links.find((l) => !l["@rel"] || l["@rel"] === "alternate") || links[0];
  return decode(alt ? alt["@href"] || text(alt) : "");
}

// Parses RSS 2.0, RSS 1.0 (RDF) or Atom into a flat list of items.
function parseFeed(xml) {
  const doc = parser.parse(xml);
  const isAtom = !!doc.feed;
  const raw = isAtom ? toArray(doc.feed.entry) : toArray(doc.rss?.channel?.item ?? doc["rdf:RDF"]?.item);
  return raw
    .map((item) => {
      const body = item["content:encoded"] ?? item.content;
      const summary = clean(text(item.description ?? item.summary));
      const date = new Date(text(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]));
      return {
        title: clean(text(item.title)),
        link: isAtom ? atomLink(item.link) : decode(text(item.link).trim()),
        summary: summary.length > 320 ? summary.slice(0, 317).replace(/\s\S*$/, "") + "…" : summary,
        body: clean(text(body)).slice(0, 2000),
        categories: toArray(item.category).map((c) => (typeof c === "object" ? c["@term"] || text(c) : String(c))).filter(Boolean),
        image: findImage(item),
        published: isNaN(date) ? null : date.toISOString()
      };
    })
    .filter((i) => i.title && /^https?:\/\//.test(i.link));
}

module.exports = { parseFeed, clean };
