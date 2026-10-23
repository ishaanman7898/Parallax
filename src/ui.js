// Formatting helpers and shared HTML pieces used by every view.
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
  const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const fmt = (n) => {
    if (n == null || isNaN(n)) return "—";
    const digits = n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
    return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };
  const pct = (n) => (n == null || isNaN(n) ? "—" : (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2) + "%");
  const signed = (n, d = 2) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(d);
  const dir = (n) => (n < 0 ? "down" : "up");
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const side = (score) => (score == null ? "unrated" : score <= -0.2 ? "left" : score >= 0.2 ? "right" : "center");
  const sourceSide = (lean) => (lean == null ? "unrated" : side(lean / 2));
  const toneWord = (c) => (c >= 0.05 ? "Positive" : c <= -0.05 ? "Negative" : "Neutral");
  const toneClass = (c) => (c >= 0.05 ? "pos" : c <= -0.05 ? "neg" : "neu");

  function ago(iso) {
    if (!iso) return "";
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${plural(mins, "minute")} ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${plural(hrs, "hour")} ago`;
    const days = Math.round(hrs / 24);
    return days === 1 ? "Yesterday" : `${days} days ago`;
  }

  const icons = {
    compare: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/></svg>`,
    help: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14"/><path d="M12 17.5v.01"/></svg>`,
    tune: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>`
  };

  // Diverging bar from a center line, or a marker on a negative to positive spectrum.
  function sentimentBar(score, style = "diverging") {
    const s = Math.max(-1, Math.min(1, Number(score) || 0));
    const cls = toneClass(s);
    const label = `${toneWord(s)} ${signed(s)}`;
    const track =
      style === "spectrum"
        ? `<span class="sbar spectrum"><i style="left:${(s + 1) * 50}%"></i></span>`
        : `<span class="sbar"><i class="fill-${cls}" style="left:${s < 0 ? 50 + s * 50 : 50}%;width:${Math.max(Math.abs(s) * 50, 1)}%"></i></span>`;
    return `<span class="sent" role="img" aria-label="Sentiment ${label}">${track}<span class="sent-label tone-${cls}">${label}</span></span>`;
  }

  function coverageBar(cov, withLabels = true) {
    const unrated = cov.unrated || 0;
    const total = cov.left + cov.center + cov.right + unrated || 1;
    const seg = (k) => (cov[k] ? `<span class="seg-${k}" style="width:${(cov[k] / total) * 100}%"></span>` : "");
    return `<span class="cov"><span class="cov-bar">${seg("left")}${seg("center")}${seg("right")}${seg("unrated")}</span>${
      withLabels ? `<span class="cov-labels">L ${cov.left} · C ${cov.center} · R ${cov.right}${unrated ? ` · Unrated ${unrated}` : ""}</span>` : ""
    }</span>`;
  }

  // Share of a story's articles that read negative, neutral and positive, plus the average.
  function toneMix(articles) {
    const scores = articles.map((a) => a.sentiment.compound);
    const n = scores.length || 1;
    const share = (cls) => (scores.filter((s) => toneClass(s) === cls).length / n) * 100;
    const avg = scores.reduce((s, x) => s + x, 0) / n;
    const seg = (cls) => (share(cls) ? `<span class="fill-${cls}" style="width:${share(cls)}%"></span>` : "");
    return `<span class="cov"><span class="cov-bar" role="img" aria-label="Tone mix">${seg("neg")}${seg("neu")}${seg("pos")}</span><span class="tone-${toneClass(avg)}">avg ${signed(avg)}</span></span>`;
  }

  const sourceRow = (source) =>
    `<div class="src"><span class="src-badge" aria-hidden="true">${esc(initial(source.name))}</span><span>${esc(source.name)}</span></div>`;

  const initial = (name) => String(name || "?").replace(/^The /, "")[0];

  // The fallback tile, tinted by topic with the outlet's initial, shows when there is no
  // image or the image fails to load.
  const media = (image, topic, cls, sourceName) =>
    `<div class="${cls}" data-topic="${esc(topic)}">${image ? `<img src="${esc(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}<span class="media-fallback">${sourceName ? `<b>${esc(initial(sourceName))}</b>` : ""}${esc(topic)}</span></div>`;

  // Opens the publisher's page when there is a link, otherwise the story comparison.
  function articleLink(a, text) {
    const link = safeUrl(a.link);
    const href = link || `#/story/${encodeURIComponent(a.cluster?.id || a.id)}`;
    const ext = link ? ` target="_blank" rel="noopener noreferrer"` : "";
    return `<a href="${esc(href)}"${ext} data-aid="${esc(a.id)}">${text}</a>`;
  }

  const ratedTitle = (s) => (s.nonpolitical ? "Covers a nonpolitical beat, so it has no left-right rating" : s.ratedBy ? `Outlet rating from ${s.ratedBy}` : "No published rating for this outlet");
  const meta = (a) => `<div class="meta">${ago(a.published)} · <span class="lean-${sourceSide(a.source.lean)}" title="${esc(ratedTitle(a.source))}">${esc(a.source.label)}</span></div>`;

  function compareButton(a) {
    const n = a.cluster?.articles.length || 1;
    if (n < 2) return "";
    const label = `Compare ${n} perspectives`;
    return `<a class="icon-btn filled" href="#/story/${esc(a.cluster.id)}" data-aid="${esc(a.id)}" aria-label="${label}" title="${label}">${icons.compare}</a>`;
  }

  function feedItem(a, style, { thumb = true, compare = true } = {}) {
    return `
      <article class="item">
        <div class="item-body">
          ${sourceRow(a.source)}
          <h3>${articleLink(a, esc(a.title))}</h3>
          ${meta(a)}
          ${sentimentBar(a.sentiment.compound, style)}
        </div>
        <div class="item-side">
          ${thumb ? media(a.image, a.topic, "thumb", a.source.name) : ""}
          ${compare ? compareButton(a) : ""}
        </div>
      </article>`;
  }

  window.ParallaxUI = {
    esc, safeUrl, compact, fmt, pct, signed, dir, plural, side, sourceSide, toneWord, toneClass, ago, icons,
    sentimentBar, coverageBar, toneMix, sourceRow, media, articleLink, meta, ratedTitle, compareButton, feedItem
  };
})();
