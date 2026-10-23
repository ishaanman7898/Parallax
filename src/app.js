(function () {
  const { loadNews, loadMarkets, hyperliquid } = window.ParallaxData;
  const Prefs = window.ParallaxPrefs;
  const { esc, compact, fmt, pct, signed, dir, plural, side, sourceSide, toneClass, ago, icons, sentimentBar, coverageBar, toneMix, sourceRow, media, articleLink, meta, feedItem } = window.ParallaxUI;
  const app = document.getElementById("app");
  const profile = Prefs.load();
  const state = { news: null, markets: null, articles: [], byId: new Map(), coins: [], btc: null, pulse: "spx", asideSide: "all", side: "all", region: "All", pageN: 1 };

  const clusters = () => state.news?.clusters || [];
  const quote = (sym) => state.markets?.quotes?.find((q) => q.symbol === sym || q.label === sym);
  const coinChange = (c) => (c.prev ? ((c.price - c.prev) / c.prev) * 100 : 0);
  const byNewest = (a, b) => (b.published || "").localeCompare(a.published || "");
  const style = () => profile.barStyle;
  const chip = (action, value, label, active) => `<button class="chip" data-action="${action}" data-value="${esc(value)}" aria-pressed="${active}">${label}</button>`;
  const moreButton = (shown, total) => (total > shown ? `<button class="more-btn" data-action="more">Show more (${total - shown} left)</button>` : "");
  const panelTitle = (href, text, tag = "h2") => `<${tag} class="panel-title"><a href="${href}">${text} ›</a></${tag}>`;

  // Links every article back to its story and indexes it so clicks can be learned from.
  function indexNews(news) {
    news.clusters.forEach((c) => c.articles.forEach((a) => (a.cluster = c)));
    state.articles = news.clusters.flatMap((c) => c.articles);
    state.byId = new Map(state.articles.map((a) => [a.id, a]));
  }

  function updateStatus() {
    const n = state.news;
    const el = document.getElementById("feed-status");
    if (!n) el.textContent = "Loading live feeds…";
    else if (n.sample) el.textContent = "Showing sample stories. Run the Parallax server or desktop app for live feeds.";
    else el.textContent = `Live from ${n.sources.filter((s) => s.ok).length} of ${n.sources.length} sources · ${n.articleCount} articles · updated ${ago(n.updated).toLowerCase()}`;
  }

  // ---------- ticker ----------
  function tickerItems() {
    const items = (state.markets?.quotes || []).map((q) => ({ key: q.symbol, label: q.label, price: q.price, change: q.changePct }));
    for (const sym of ["BTC", "ETH", "SOL", "HYPE"]) {
      const c = state.coins.find((x) => x.coin === sym);
      if (c) items.push({ key: "hl-" + sym, label: sym, price: c.price, change: coinChange(c) });
    }
    return items;
  }

  function renderTicker() {
    const note = state.markets?.sample ? "SAMPLE PRICES" : "LIVE · YAHOO FINANCE · HYPERLIQUID";
    const html =
      tickerItems().map((t) => `<span class="tick ${t.change < 0 ? "down" : ""}" data-key="${esc(t.key)}"><span>${esc(t.label)}</span><b>${fmt(t.price)}</b><span class="chg">${pct(t.change)}</span></span>`).join("") +
      `<span class="tick-note">/ ${note}</span>`;
    document.getElementById("ticker").innerHTML = html + html;
  }

  // Updates crypto prices in place so the scrolling animation is not reset.
  function updateTickerPrices() {
    for (const c of state.coins.slice(0, 50)) {
      document.querySelectorAll(`.tick[data-key="hl-${CSS.escape(c.coin)}"]`).forEach((el) => {
        const change = coinChange(c);
        el.classList.toggle("down", change < 0);
        el.querySelector("b").textContent = fmt(c.price);
        el.querySelector(".chg").textContent = pct(change);
      });
    }
  }

  // ---------- shared blocks ----------
  // Up to three other outlets, preferring sides of the spectrum the lead does not cover.
  function otherTakes(c) {
    const lead = c.articles[0];
    const sources = new Set([lead.source.name]);
    const sides = new Set([sourceSide(lead.source.lean)]);
    const fresh = [];
    const repeat = [];
    for (const a of c.articles.slice(1)) {
      if (sources.has(a.source.name)) continue;
      sources.add(a.source.name);
      const s = sourceSide(a.source.lean);
      (sides.has(s) ? repeat : fresh).push(a);
      sides.add(s);
    }
    return [...fresh, ...repeat].slice(0, 3);
  }

  function clusterBlock(c) {
    const lead = c.articles[0];
    const others = otherTakes(c);
    const storyHref = `#/story/${esc(c.id)}`;
    return `
      <section class="cluster">
        <h2 class="cluster-title"><a href="${storyHref}" data-aid="${esc(lead.id)}">${esc(c.title)} ›</a></h2>
        <div class="cluster-sum">
          <span>${esc(c.topic)} · ${plural(c.sourceCount, "source")}</span>
          <span class="sum-part">Coverage ${coverageBar(c.coverage)}</span>
          <span class="sum-part">Tone mix ${toneMix(c.articles)}</span>
          ${c.blindspot ? `<span class="warn-text">Blindspot</span>` : ""}
        </div>
        <div class="cluster-body">
          <article class="lead">
            ${c.image || lead.image ? media(c.image || lead.image, c.topic, "lead-media") : ""}
            ${sourceRow(lead.source)}
            <h3>${articleLink(lead, esc(lead.title))}</h3>
            ${meta(lead)}
            ${sentimentBar(lead.sentiment.compound, style())}
          </article>
          ${others.length ? `<div class="others">${others.map((a) => feedItem(a, style(), { thumb: false, compare: false })).join("")}</div>` : ""}
        </div>
        ${c.articles.length > 1 ? `<a class="pill-btn" href="${storyHref}" data-aid="${esc(lead.id)}">${icons.compare} Compare all ${c.articles.length} perspectives</a>` : ""}
      </section>`;
  }

  function clusterList(list, base = 8) {
    const shown = list.slice(0, base * state.pageN);
    return shown.length
      ? `<div class="panel clusters">${shown.map(clusterBlock).join("")}</div>${moreButton(shown.length, list.length)}`
      : `<p class="empty">No stories match.</p>`;
  }

  function pulseCard() {
    const spx = quote("^GSPC");
    const opts = [];
    if (spx?.series?.length) opts.push("spx");
    if (state.btc?.length) opts.push("btc");
    const head = panelTitle("#/markets", "Market pulse");
    if (!opts.length) return `<section class="panel pulse">${head}<p class="empty">Market data unavailable.</p></section>`;
    const key = opts.includes(state.pulse) ? state.pulse : opts[0];
    let price, change, changePct, series, open, label, note, radar;
    if (key === "spx") {
      ({ price, change, changePct, series, open } = spx);
      label = "S&P 500";
      note = state.markets.sample ? "Illustrative snapshot · not live" : `Intraday · 5 min bars · ${ago(spx.time).toLowerCase() || "today"}`;
      radar = ["NVDA", "TSLA", "MSFT"].map(quote).filter(Boolean).map((q) => ({ sym: q.label, price: q.price, change: q.changePct }));
    } else {
      const c = state.coins.find((x) => x.coin === "BTC");
      series = state.btc.map((r) => r.close);
      open = state.btc[0].open;
      price = c?.price ?? series[series.length - 1];
      change = price - open;
      changePct = (change / open) * 100;
      label = "BTC perp";
      note = "Hyperliquid · 24h · 15 min bars";
      radar = ["ETH", "SOL", "HYPE"].map((s) => state.coins.find((x) => x.coin === s)).filter(Boolean).map((x) => ({ sym: x.coin, price: x.price, change: coinChange(x) }));
    }
    const bars = series.slice(-36);
    const min = Math.min(...bars);
    const max = Math.max(...bars);
    const barHtml = bars.map((v) => `<span style="height:${max === min ? 50 : 12 + ((v - min) / (max - min)) * 88}%"></span>`).join("");
    const chips = opts.length > 1 ? `<div class="chips">${opts.map((k) => chip("pulse", k, k === "spx" ? "S&amp;P 500" : "BTC perp", k === key)).join("")}</div>` : "";
    return `
      <section class="panel pulse">
        ${head}
        ${chips}
        <div class="pulse-body">
          <div class="muted small">${esc(note)}</div>
          <div class="pulse-price">${fmt(price)}</div>
          <div class="pulse-change ${dir(change)}">${esc(label)} ${signed(change)} (${pct(changePct)})</div>
          <div class="bars ${dir(change)}" aria-hidden="true">${barHtml}</div>
          <div class="oc"><span>OPEN<b>${fmt(open)}</b></span><span class="close">LAST<b>${fmt(price)}</b></span></div>
        </div>
        ${radar.length ? `<div class="radar"><div class="muted small">On the radar</div>${radar.map((r) => `<div class="radar-row ${r.change < 0 ? "down" : ""}"><span class="sym">${esc(r.sym)}</span><span>${fmt(r.price)}</span><span class="chg">${pct(r.change)}</span></div>`).join("")}</div>` : ""}
      </section>`;
  }

  const SIDES = [["all", "All"], ["left", "Left"], ["center", "Center"], ["right", "Right"], ["unrated", "Unrated"]];
  const bySide = (key) => state.articles.filter((a) => key === "all" || sourceSide(a.source.lean) === key).sort(byNewest);

  function latestCard() {
    const items = bySide(state.asideSide).slice(0, 4);
    return `
      <section class="panel side-card">
        ${panelTitle("#/latest", "Latest")}
        <div class="chips">${SIDES.slice(0, 4).map(([k, n]) => chip("aside-side", k, n, state.asideSide === k)).join("")}</div>
        <div class="stack">${items.map((a) => feedItem(a, style(), { thumb: false })).join("") || `<p class="empty">No articles from this side right now.</p>`}</div>
      </section>`;
  }

  function toneByTopic() {
    const by = {};
    state.articles.forEach((a) => (by[a.topic] ||= []).push(a.sentiment.compound));
    const rows = Object.entries(by).filter(([, xs]) => xs.length >= 2).map(([t, xs]) => [t, xs.reduce((s, x) => s + x, 0) / xs.length, xs.length]).sort((a, b) => a[1] - b[1]);
    if (!rows.length) return `<p class="empty">Not enough articles yet.</p>`;
    return `<div class="diverging">${rows.map(([t, v, n]) => `
      <div class="div-row"><a class="div-label" href="#/topic/${encodeURIComponent(t)}">${esc(t)} <i>${n}</i></a>
        <div class="div-track"><span class="div-bar fill-${toneClass(v)}" style="${v < 0 ? `right:50%;width:${Math.abs(v) * 50}%` : `left:50%;width:${v * 50}%`}"></span></div>
        <span class="div-val tone-${toneClass(v)}">${signed(v)}</span></div>`).join("")}</div>`;
  }

  const toneCard = () => `<section class="panel side-card"><h2 class="panel-title plain">Tone by topic</h2><p class="muted small">Average article sentiment, −1 to +1</p>${toneByTopic()}</section>`;

  const explainer = `
    <section class="panel explainer">
      <p>Perspective describes how a story is framed, not whether it is true. Each article gets a lean estimate from its outlet’s published rating, adjusted by partisan phrases found in its text, plus a sentiment score for tone. Outlets without a confirmed rating, including most international ones, are marked unrated. These are automated estimates. <a href="#/bias">Read the method</a>.</p>
      <div class="spectrum"><div class="l">LEFT</div><div class="c">CENTER</div><div class="r">RIGHT</div></div>
    </section>`;

  // ---------- personalization ----------
  function forYouItems(n, exclude = new Set()) {
    return Prefs.forYou(profile, state.articles.filter((a) => !exclude.has(a.cluster.id)), n);
  }

  function forYouNote() {
    return profile.reads
      ? `Ranked from ${plural(profile.reads, "article")} you opened`
      : "Shuffled for now. Open a few articles and this learns what you like to read";
  }

  const feedGrid = (items) => (items.length ? `<div class="panel feed-grid">${items.map((a) => feedItem(a, style())).join("")}</div>` : `<p class="empty">No articles yet.</p>`);

  function topicItems(key, n) {
    const stories = new Set();
    return state.articles
      .filter((a) => Prefs.topicMatches(key, a))
      .sort((a, b) => b.cluster.rank - a.cluster.rank || byNewest(a, b))
      .filter((a) => !stories.has(a.cluster.id) && stories.add(a.cluster.id))
      .slice(0, n);
  }

  const topicHref = (key) => (key.startsWith("region:") ? `#/region/${encodeURIComponent(key.slice(7))}` : `#/topic/${encodeURIComponent(key.slice(6))}`);

  function yourTopics() {
    if (!profile.topics.length) return "";
    const cols = profile.topics.map((key) => {
      const items = topicItems(key, 3);
      return `<section class="panel topic-col">${panelTitle(topicHref(key), esc(Prefs.topicLabel(key)), "h3")}
        <div class="stack">${items.map((a) => feedItem(a, style())).join("") || `<p class="empty">Nothing in this cycle.</p>`}</div></section>`;
    });
    return `
      <section class="section">
        <div class="section-head">
          <div><h2 class="section-title">Your topics</h2><p class="section-sub">Recommended based on your interests <a class="help" href="#/settings" aria-label="Choose your topics">${icons.help}</a></p></div>
          <a class="outline-btn" href="#/settings">${icons.tune} Customize</a>
        </div>
        <div class="topic-cols">${cols.join("")}</div>
      </section>`;
  }

  // ---------- views ----------
  function home() {
    const list = clusters();
    if (!list.length) {
      app.innerHTML = `<p class="empty">Loading live feeds…</p>`;
      return;
    }
    const top = list.slice(0, 3);
    app.innerHTML = `
      <div class="home-top">
        <section class="panel top-stories">
          ${panelTitle("#/headlines", "Top stories", "h1")}
          ${top.map(clusterBlock).join("")}
        </section>
        <aside class="side">${pulseCard()}${latestCard()}${toneCard()}</aside>
      </div>
      <section class="section">
        <h2 class="section-title"><a href="#/foryou">For you ›</a></h2>
        <p class="section-sub">${forYouNote()} <a class="help" href="#/settings" aria-label="How For you works">${icons.help}</a></p>
        ${feedGrid(forYouItems(8, new Set(top.map((c) => c.id))))}
      </section>
      ${yourTopics()}`;
  }

  function forYouPage() {
    app.innerHTML = `
      <div class="page-head"><div><h1>For you</h1><p class="section-sub">${forYouNote()}. <a href="#/settings">Manage</a></p></div></div>
      ${feedGrid(forYouItems(24 * state.pageN))}
      ${moreButton(24 * state.pageN, state.articles.length)}`;
  }

  function listPage(title, list, sub = "") {
    app.innerHTML = `
      <div class="page-head"><div><h1>${title}</h1>${sub ? `<p class="section-sub">${sub}</p>` : ""}</div></div>
      ${clusterList(list)}
      ${explainer}`;
  }

  function search(q) {
    const needle = q.toLowerCase();
    const hits = clusters().filter((c) => c.articles.some((a) => (a.title + " " + a.summary + " " + a.source.name).toLowerCase().includes(needle)));
    listPage(`Results for “${esc(q)}”`, hits, plural(hits.length, "story"));
  }

  function articleRow(a) {
    const framing = [...a.bias.framing.left.map((p) => `<span class="phrase phrase-left">${esc(p)}</span>`), ...a.bias.framing.right.map((p) => `<span class="phrase phrase-right">${esc(p)}</span>`)].join("");
    const loaded = a.loaded.words.map((w) => `<span class="phrase phrase-loaded">${esc(w)}</span>`).join("");
    return `
      <article class="coverage-item">
        ${sourceRow(a.source)}
        <h3>${articleLink(a, esc(a.title))}</h3>
        <p>${esc(a.summary)}</p>
        <div class="meta">${ago(a.published)} · <span class="lean-${side(a.bias.score)}" title="Article lean estimate">${esc(a.bias.label)}</span></div>
        ${sentimentBar(a.sentiment.compound, style())}
        ${framing ? `<div class="phrases"><span class="phrase-label">Framing phrases</span>${framing}</div>` : ""}
        ${loaded ? `<div class="phrases"><span class="phrase-label">Loaded words</span>${loaded}</div>` : ""}
      </article>`;
  }

  function story(id) {
    const c = clusters().find((x) => x.id === id);
    if (!c) return notFound();
    const groups = { left: [], center: [], right: [], unrated: [] };
    c.articles.forEach((a) => groups[sourceSide(a.source.lean)].push(a));
    const avgTone = (xs) => (xs.length ? xs.reduce((s, a) => s + a.sentiment.compound, 0) / xs.length : null);
    const lt = avgTone(groups.left);
    const rt = avgTone(groups.right);
    const toneCompare = lt != null && rt != null
      ? `<p class="small">Left rated outlets averaged ${signed(lt)}, right rated outlets ${signed(rt)}. ${Math.abs(lt - rt) >= 0.3 ? "That is a notable difference in tone." : "Their tone is broadly similar."}</p>`
      : `<p class="small">Tone comparison needs coverage from both sides.</p>`;
    const marker = c.lean.score == null ? null : Math.round(((c.lean.score + 1) / 2) * 100);
    const column = (key, name) => `
      <section class="side-col">
        <h2 class="side-head side-${key}">${name} <span>${groups[key].length}</span></h2>
        ${groups[key].length ? groups[key].map(articleRow).join("") : `<p class="empty">No coverage from ${name.toLowerCase()} rated sources in this cycle.</p>`}
      </section>`;
    app.innerHTML = `
      <article class="article wide">
        <a class="back" href="#/">← Back to top stories</a>
        <div class="muted small">${esc(c.topic)} · ${plural(c.sourceCount, "source")} · ${plural(c.articles.length, "article")}</div>
        <h1>${esc(c.title)}</h1>
        <p class="dek">${esc(c.summary)}</p>
        ${c.image ? `<img class="story-img" src="${esc(c.image)}" alt="" referrerpolicy="no-referrer">` : ""}
        <div class="analysis">
          <div class="panel stat">
            <div class="stat-label">Coverage</div>
            ${coverageBar(c.coverage)}
            <p class="small">${c.blindspot ? `<b class="warn-text">Blindspot.</b> ${esc(c.blindspot)}.` : `${plural(c.sourceCount, "outlet")} covered this story.`}</p>
          </div>
          <div class="panel stat">
            <div class="stat-label">Average tone</div>
            <div class="stat-big tone-${toneClass(c.sentiment)}">${signed(c.sentiment)}</div>
            ${toneMix(c.articles)}
            ${toneCompare}
          </div>
          <div class="panel stat">
            <div class="stat-label">Coverage lean</div>
            <div class="stat-big lean-${side(c.lean.score)}">${esc(c.lean.label)}</div>
            ${marker == null ? `<p class="small">Not enough rated coverage or partisan phrases to estimate a lean.</p>` : `<div class="scale"><span class="scale-marker" style="left:${marker}%"></span></div>
            <p class="small">Average of article estimates, from left (−1) to right (+1).</p>`}
          </div>
        </div>
        ${groups.left.length + groups.center.length + groups.right.length ? `<div class="sides">${column("left", "Left")}${column("center", "Center")}${column("right", "Right")}</div>` : ""}
        ${groups.unrated.length ? `<section class="unrated-block">
          <h2 class="side-head side-unrated">International and unrated outlets <span>${groups.unrated.length}</span></h2>
          <div class="unrated-grid">${groups.unrated.map(articleRow).join("")}</div>
        </section>` : ""}
        <p class="small method-note">Lean and tone are automated estimates. <a href="#/bias">How Parallax measures them</a>.</p>
      </article>`;
  }

  function latest() {
    const items = bySide(state.side);
    const shown = items.slice(0, 40 * state.pageN);
    app.innerHTML = `
      <div class="page-head"><h1>Latest news</h1>
        <div class="chips">${SIDES.map(([k, n]) => chip("side", k, n, state.side === k)).join("")}</div>
      </div>
      ${shown.length ? `<div class="panel list">${shown.map((a) => feedItem(a, style())).join("")}</div>` : `<p class="empty">No articles from this side right now.</p>`}
      ${moreButton(shown.length, items.length)}`;
  }

  function hlRows() {
    if (!state.coins.length) return `<tr><td colspan="6" class="empty">Connecting to Hyperliquid…</td></tr>`;
    return state.coins.slice(0, 15).map((c) => {
      const ch = coinChange(c);
      return `<tr><td>${esc(c.coin)}</td><td class="num">${fmt(c.price)}</td><td class="num ${dir(ch)}">${pct(ch)}</td>
        <td class="num ${dir(c.funding)}">${(c.funding * 100).toFixed(4)}%</td><td class="num">$${compact.format(c.openInterest)}</td><td class="num">$${compact.format(c.volume)}</td></tr>`;
    }).join("");
  }

  function fearGreedCard() {
    const fg = state.markets?.fearGreed;
    if (!fg) return `<div class="panel stat"><div class="stat-label">Crypto Fear and Greed</div><p class="empty">Unavailable.</p></div>`;
    return `<div class="panel stat"><div class="stat-label">Crypto Fear and Greed · alternative.me</div>
      <div class="stat-big ${fg.value >= 50 ? "up" : "down"}">${fg.value} <small>${esc(fg.label)}</small></div>
      <div class="fg-track"><span class="scale-marker" style="left:${fg.value}%"></span></div>
      <div class="cov-labels spread"><span>Extreme fear</span><span>Extreme greed</span></div></div>`;
  }

  function marketHeadlines() {
    const items = state.articles.filter((a) => a.source.kind === "markets").sort(byNewest);
    if (!items.length) return "";
    const day = items.filter((a) => a.published && Date.now() - Date.parse(a.published) < 864e5);
    const tone = day.length ? day.reduce((s, a) => s + a.sentiment.compound, 0) / day.length : null;
    return `
      <div class="two-col reverse">
        <div class="panel stat"><div class="stat-label">Market headlines · ${[...new Set(items.map((a) => a.source.name))].map(esc).join(", ")}</div>
          <div class="stack">${items.slice(0, 8).map((a) => feedItem(a, style(), { thumb: false })).join("")}</div></div>
        <div class="panel stat"><div class="stat-label">Market news tone · 24h</div>
          ${tone == null ? `<p class="empty">Not enough headlines.</p>` : `<div class="stat-big tone-${toneClass(tone)}">${signed(tone)}</div>
          <div class="scale tone-scale"><span class="scale-marker" style="left:${Math.round(((tone + 1) / 2) * 100)}%"></span></div>
          <p class="small">Average tone of ${plural(day.length, "market headline")}. Tone measures wording, not where prices go next.</p>`}</div>
      </div>`;
  }

  function markets() {
    const quotes = state.markets?.quotes || [];
    const rows = quotes.map((q) => `<tr><td>${esc(q.label)}</td><td class="num">${fmt(q.price)}</td><td class="num ${dir(q.change)}">${signed(q.change)}</td><td class="num ${dir(q.changePct)}">${pct(q.changePct)}</td></tr>`).join("");
    const related = clusters().filter((c) => c.topic === "Markets" || c.topic === "Business").slice(0, 4);
    app.innerHTML = `
      <div class="page-head"><h1>Markets</h1></div>
      <div class="home-top">
        <div class="panel table-card"><table class="table">
          <thead><tr><th>Index or stock</th><th class="num">Last</th><th class="num">Change</th><th class="num">%</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" class="empty">Equity data unavailable.</td></tr>`}</tbody>
        </table>
        <p class="table-note">${state.markets?.sample ? "Sample prices." : "Yahoo Finance, delayed. Updates every minute."}</p></div>
        <aside class="side">${pulseCard()}</aside>
      </div>
      <h2 class="section-label"><span class="dot live"></span> Crypto perpetuals on Hyperliquid</h2>
      <div class="panel scroll-x"><table class="table">
        <thead><tr><th>Coin</th><th class="num">Mid</th><th class="num">24h</th><th class="num">Funding 1h</th><th class="num">Open interest</th><th class="num">24h volume</th></tr></thead>
        <tbody id="hl-body">${hlRows()}</tbody>
      </table><p class="table-note">Streaming from the Hyperliquid public API. Top 15 by 24 hour volume.</p></div>
      <div class="two-col">
        ${fearGreedCard()}
        <div class="panel stat"><div class="stat-label">News tone by topic · ${state.news?.sample ? "sample" : "live feeds"}</div>${toneByTopic()}</div>
      </div>
      ${marketHeadlines()}
      <h2 class="section-label">Markets and business coverage</h2>
      ${related.length ? `<div class="panel clusters">${related.map(clusterBlock).join("")}</div>` : `<p class="empty">No market stories right now.</p>`}`;
  }

  function world() {
    const intl = clusters().filter((c) => (c.regions || []).some((r) => r !== "US") || c.topic === "World");
    const counts = {};
    intl.forEach((c) => (c.regions || []).forEach((r) => r !== "US" && (counts[r] = (counts[r] || 0) + 1)));
    const regions = ["All", ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])];
    if (!regions.includes(state.region)) state.region = "All";
    const list = state.region === "All" ? intl : intl.filter((c) => c.regions.includes(state.region));
    app.innerHTML = `
      <div class="page-head"><h1>World news</h1>
        <div class="chips">${regions.map((r) => chip("region", r, `${esc(r)}${counts[r] ? ` <i>${counts[r]}</i>` : ""}`, state.region === r)).join("")}</div>
      </div>
      ${list.length ? clusterList(list) : `<p class="empty">No international stories in this cycle.</p>`}`;
  }

  function bias() {
    const sources = state.news?.sources || [];
    const srcRows = sources.map((s) => `<tr><td>${esc(s.name)}${s.kind === "markets" ? ` <span class="tag">markets</span>` : ""}</td><td>${esc(s.region)}</td><td class="lean-${sourceSide(s.lean)}">${esc(s.label)}</td><td class="num">${s.ok ? s.count : `<span class="down">offline</span>`}</td></tr>`).join("");
    app.innerHTML = `
      <div class="page-head"><h1>Understanding bias</h1></div>
      <div class="prose">
        <p>Every story involves choices. Which fact goes first, whose quote gets the most space and which words describe a policy all shape how a reader sees an event, even when every sentence is accurate. Parallax groups coverage of the same event from outlets across the spectrum so you can compare those choices side by side.</p>
        <h2>Source ratings</h2>
        <p>Each outlet starts from a published rating on a five point scale from left to right. The ratings follow the AllSides Media Bias Chart at the time they were added and can be changed in <code>server/sources.js</code>. Check <a href="https://www.allsides.com/media-bias/ratings" target="_blank" rel="noopener noreferrer">allsides.com</a> for current ratings.</p>
        <p>Outlets without a rating we could confirm are marked unrated. That covers most international outlets, because the US left to right scale maps poorly onto politics elsewhere. Their articles still count as coverage and appear on every story page. They only get a lean estimate when their text contains strong partisan phrases, never from a single weak one.</p>
        ${srcRows ? `<div class="panel scroll-x"><table class="table"><thead><tr><th>Source</th><th>Region</th><th>Rating</th><th class="num">Articles now</th></tr></thead><tbody>${srcRows}</tbody></table></div>` : `<p class="small">Source status appears here when live feeds are running.</p>`}
        <h2>Framing phrases</h2>
        <p>Some phrases are used far more by one side than the other, such as “undocumented immigrants” versus “illegal aliens” or “estate tax” versus “death tax”. Parallax scans each headline, summary and available article text for about seventy such phrases, an approach based on Gentzkow and Shapiro’s research on media slant. Matches can move an article up to halfway away from its outlet’s rating, and the phrases found are shown on every story page.</p>
        <h2>Tone</h2>
        <p>Tone uses VADER, a sentiment model built for short text, extended with market and news terms such as “rally”, “plunge” and “recession” that general models miss. Scores run from −1 to +1, and the sentiment bar under each article shows where it falls. Negative tone is not a sign of bias. A story about an earthquake should read as negative.</p>
        <h2>Loaded language</h2>
        <p>Words like “slams”, “bombshell” or “meltdown” signal emotive framing. They are listed under each article so you can see where coverage leans on them.</p>
        <h2>Limits</h2>
        <p>These are automated estimates built from headlines and short summaries. A label is not a fact check, and a lean left article can be accurate while a center article contains mistakes. Use the comparison to read more widely, not to decide what is true.</p>
      </div>
      ${explainer}`;
  }

  function settings() {
    const ins = Prefs.insights(profile);
    const topicChip = (key) => chip("toggle-topic", key, esc(Prefs.topicLabel(key)), profile.topics.includes(key));
    const shares = (rows) => rows.length
      ? rows.map((r) => `<div class="share-row"><span>${esc(r.name)}</span><span class="share-track"><i style="width:${Math.round(r.share * 100)}%"></i></span><span class="share-val">${Math.round(r.share * 100)}%</span></div>`).join("")
      : `<p class="empty">Nothing yet.</p>`;
    const styleChoice = (key, label) => `
      <button class="choice" data-action="bar-style" data-value="${key}" aria-pressed="${profile.barStyle === key}">
        <span class="choice-title">${label}</span>${sentimentBar(-0.42, key)}${sentimentBar(0.36, key)}
      </button>`;
    app.innerHTML = `
      <div class="page-head"><h1>Settings</h1></div>
      <div class="settings">
        <section class="panel settings-block">
          <h2>Your topics</h2>
          <p class="muted">Each one gets its own column under Your topics on the home page, in the order you turn them on.</p>
          <h3 class="group-label">Topics</h3>
          <div class="chips">${Prefs.TOPICS.map((t) => topicChip("topic:" + t)).join("")}</div>
          <h3 class="group-label">Regions</h3>
          <div class="chips">${Prefs.REGIONS.map((r) => topicChip("region:" + r)).join("")}</div>
          <p class="muted small">Showing ${profile.topics.length ? esc(profile.topics.map(Prefs.topicLabel).join(", ")) : "nothing, so Your topics is hidden"}.</p>
        </section>
        <section class="panel settings-block">
          <h2>Sentiment bar</h2>
          <p class="muted">How tone shows under each article.</p>
          <div class="choice-row">${styleChoice("diverging", "Diverging")}${styleChoice("spectrum", "Spectrum")}</div>
        </section>
        <section class="panel settings-block">
          <h2>For you</h2>
          <p class="muted">Parallax keeps a reading profile in this browser only. Each article or story you open adds weight to its topic, its outlet and the words in its headline, and older reads fade as you read more. Articles you already opened sink to the bottom. Until you open something, For you is shuffled once a day.</p>
          <div class="setting-row">
            <div><b>Learn from what I read</b><div class="muted small">${plural(ins.reads, "article")} read so far</div></div>
            <button class="switch" data-action="learn" role="switch" aria-checked="${profile.learn}" aria-label="Learn from what I read"><span></span></button>
          </div>
          <div class="two-col even">
            <div><h3 class="group-label">Top topics</h3>${shares(ins.topics)}</div>
            <div><h3 class="group-label">Top outlets</h3>${shares(ins.sources)}</div>
          </div>
          <button class="outline-btn danger" data-action="reset-history">Reset reading history</button>
        </section>
      </div>`;
  }

  function notFound() {
    app.innerHTML = `<div class="page-head"><h1>Page not found</h1></div><p class="empty">The story may have dropped out of the latest feed cycle. <a href="#/">Return to top stories</a></p>`;
  }

  // ---------- routing and events ----------
  const routes = {
    "": home,
    foryou: forYouPage,
    headlines: () => listPage("Top stories", clusters()),
    latest,
    world,
    markets,
    bias,
    settings,
    topic: (t) => listPage(esc(t), clusters().filter((c) => c.topic === t)),
    region: (r) => listPage(r === "US" ? "U.S." : esc(r), clusters().filter((c) => (c.regions || []).includes(r))),
    search,
    story
  };
  const parseHash = () => {
    const [name, ...rest] = location.hash.replace(/^#\/?/, "").split("/");
    return [name, decodeURIComponent(rest.join("/"))];
  };

  function render() {
    const [name, param] = parseHash();
    const active = name === "topic" ? `topic/${param}` : name || "home";
    document.querySelectorAll(".tabs a").forEach((a) => (a.dataset.route === active ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    const input = document.getElementById("search");
    if (name !== "search" && document.activeElement !== input) input.value = "";
    (routes[name] || notFound)(param);
  }

  // Re-renders in place, keeping the scroll position.
  function rerender() {
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  const actions = {
    pulse: (v) => (state.pulse = v),
    "aside-side": (v) => (state.asideSide = v),
    side: (v) => ((state.side = v), (state.pageN = 1)),
    region: (v) => ((state.region = v), (state.pageN = 1)),
    more: () => state.pageN++,
    "toggle-topic": (v) => (Prefs.toggleTopic(profile, v), Prefs.save(profile)),
    "bar-style": (v) => ((profile.barStyle = v), Prefs.save(profile)),
    learn: () => ((profile.learn = !profile.learn), Prefs.save(profile)),
    "reset-history": () => {
      if (!confirm("Clear your reading history? For you goes back to a shuffle.")) return;
      Prefs.resetHistory(profile);
      Prefs.save(profile);
    }
  };

  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || !actions[el.dataset.action]) return;
    actions[el.dataset.action](el.dataset.value);
    rerender();
  });

  // Opening an article or story teaches the For you ranking. Middle clicks count too.
  const learn = (e) => {
    const el = e.target.closest("[data-aid]");
    const a = el && state.byId.get(el.dataset.aid);
    if (a && Prefs.recordRead(profile, a)) Prefs.save(profile);
  };
  document.addEventListener("click", learn, true);
  document.addEventListener("auxclick", learn, true);

  const searchInput = document.getElementById("search");
  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = searchInput.value.trim();
      const target = q ? `#/search/${encodeURIComponent(q)}` : "#/";
      if (parseHash()[0] === "search") {
        history.replaceState(null, "", target);
        render();
      } else location.hash = target;
    }, 250);
  });
  document.getElementById("search-form").addEventListener("submit", (e) => e.preventDefault());

  window.addEventListener("hashchange", () => {
    state.pageN = 1;
    render();
    window.scrollTo(0, 0);
  });

  // Broken remote images are hidden. Inline handlers are blocked by the CSP.
  document.addEventListener("error", (e) => e.target.tagName === "IMG" && e.target.classList.add("broken"), true);

  async function refreshNews() {
    state.news = await loadNews();
    indexNews(state.news);
    updateStatus();
    rerender();
  }

  async function refreshMarkets() {
    state.markets = await loadMarkets();
    renderTicker();
    if (["", "markets"].includes(parseHash()[0])) rerender();
  }

  async function startHyperliquid() {
    try {
      state.coins = await hyperliquid.load();
      state.btc = await hyperliquid.candles("BTC").catch(() => null);
      renderTicker();
      rerender();
      hyperliquid.onUpdate((coins) => {
        state.coins = coins;
        updateTickerPrices();
        const body = document.getElementById("hl-body");
        if (body) body.innerHTML = hlRows();
      });
      hyperliquid.connect();
    } catch {
      state.coins = [];
    }
  }

  updateStatus();
  render();
  Promise.all([refreshNews(), refreshMarkets()]).then(startHyperliquid);
  setInterval(refreshNews, 5 * 60 * 1000);
  setInterval(refreshMarkets, 60 * 1000);
  setInterval(() => hyperliquid.load().then((c) => (state.coins = c)).catch(() => {}), 5 * 60 * 1000);
})();
