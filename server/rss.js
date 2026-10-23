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

// Upgrades http and protocol relative URLs, since the page only loads https images, and
// skips trackers and tiny thumbnails (60x60 and similar) so the article page is tried instead.
function validImage(raw) {
  const url = String(raw || "").trim().replace(/^\/\//, "https://").replace(/^http:\/\//, "https://");
  if (!/^https:\/\//.test(url) || /pixel|tracking|undefined|spacer|feedburner/i.test(url)) return null;
  const size = url.match(/[/_-](\d{2,3})x(\d{2,3})[/._-]/);
  if (size && +size[1] < 200 && +size[2] < 200) return null;
  return url;
}

const IMAGE_FILE = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

function findImage(item) {
  const groups = toArray(item["media:group"]);
  const media = [item, ...groups].flatMap((g) => [...toArray(g["media:content"]), ...toArray(g["media:thumbnail"])]);
  // Prefer the largest declared media image.
  const sized = media
    .filter((m) => (!m["@medium"] || m["@medium"] === "image") && (!m["@type"] || /^image\//.test(m["@type"])))
    .sort((a, b) => (Number(b["@width"]) || 0) - (Number(a["@width"]) || 0));
  for (const m of sized) {
    const url = validImage(decode(m["@url"] || ""));
    if (url) return url;
  }
  for (const e of toArray(item.enclosure)) {
    const raw = decode(e["@url"] || "");
    const url = validImage(raw);
    if (url && (/^image\//.test(e["@type"] || "") || (!e["@type"] && IMAGE_FILE.test(raw)))) return url;
  }
  for (const i of [...toArray(item.image), ...toArray(item["itunes:image"])]) {
    const url = validImage(decode(typeof i === "object" ? i["@href"] || i.url || text(i) : String(i)));
    if (url) return url;
  }
  const html = decode(text(item["content:encoded"]) + text(item.content) + text(item.description) + text(item.summary));
  for (const [, raw] of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const url = validImage(decode(raw));
    if (url) return url;
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
