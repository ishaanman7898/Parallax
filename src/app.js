(function () {
  const { loadNews, loadMarkets, hyperliquid } = window.ParallaxData;
  const app = document.getElementById("app");
  const state = { news: null, markets: null, coins: [], btc: null, query: "", topic: "All", side: "all", gridLimit: 12, latestLimit: 40 };

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
  const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const fmt = (n) => {
    if (n == null || isNaN(n)) return "—";
    const digits = n >= 1000 ? 2 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
    return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };
  const pct = (n) => (n == null || isNaN(n) ? "—" : (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2) + "%");
  const signed = (n, d = 2) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(d);
  const dir = (n) => (n < 0 ? "down" : "up");
  const side = (score) => (score <= -0.2 ? "left" : score >= 0.2 ? "right" : "center");
  const toneWord = (c) => (c >= 0.05 ? "Positive" : c <= -0.05 ? "Negative" : "Neutral");
  const toneClass = (c) => (c >= 0.05 ? "pos" : c <= -0.05 ? "neg" : "neu");
  const coinChange = (c) => (c.prev ? ((c.price - c.prev) / c.prev) * 100 : 0);

  function ago(iso) {
    if (!iso) return "";
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
  }

  const clusters = () => state.news?.clusters || [];
  const allArticles = () => clusters().flatMap((c) => c.articles.map((a) => ({ ...a, cluster: c })));
  const quote = (sym) => state.markets?.quotes?.find((q) => q.symbol === sym || q.label === sym);

  // ---------- shared pieces ----------
  const leanTag = (label, score) => `<span class="lean lean-${side(score)}">${esc(label)}</span>`;
  const toneTag = (c) => `<span class="tone tone-${toneClass(c)}">${toneWord(c)} tone ${signed(c)}</span>`;

  function coverageBar(cov, withLabels = true) {
    const total = cov.left + cov.center + cov.right || 1;
    const seg = (k) => (cov[k] ? `<span class="seg-${k}" style="width:${(cov[k] / total) * 100}%"></span>` : "");
    return `<div class="cov"><div class="cov-bar">${seg("left")}${seg("center")}${seg("right")}</div>${
      withLabels ? `<div class="cov-labels"><span>L ${cov.left}</span><span>C ${cov.center}</span><span>R ${cov.right}</span></div>` : ""
    }</div>`;
  }

  function storyCard(c) {
    const lead = c.articles[0];
    return `
      <a class="card story" href="#/story/${esc(c.id)}">
        <div class="eyebrow">${esc(c.topic)} · ${c.sourceCount} source${c.sourceCount === 1 ? "" : "s"}</div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.summary)}</p>
        <div class="chips">${leanTag(c.lean.label, c.lean.score)}${toneTag(c.sentiment)}</div>
        ${coverageBar(c.coverage)}
        <div class="meta">${esc(c.articles.length > 1 ? `${c.articles.length} articles` : lead.source.name)} · ${ago(c.published)}</div>
      </a>`;
  }

  function statusLine() {
    const n = state.news;
    if (!n) return `<div class="status">Loading live feeds…</div>`;
    if (n.sample) return `<div class="status warn"><span class="dot"></span>Showing sample stories. Run the Parallax server or desktop app for live feeds.</div>`;
    const ok = n.sources.filter((s) => s.ok).length;
    return `<div class="status"><span class="dot live"></span>Live from ${ok} of ${n.sources.length} sources · ${n.articleCount} articles · updated ${ago(n.updated)}</div>`;
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
    const items = tickerItems();
    const note = state.markets?.sample ? "SAMPLE PRICES" : "LIVE · YAHOO FINANCE · HYPERLIQUID";
    const html =
      items.map((t) => `<span class="tick ${t.change < 0 ? "down" : ""}" data-key="${esc(t.key)}"><span>${esc(t.label)}</span><b>${fmt(t.price)}</b><span class="chg">${pct(t.change)}</span></span>`).join("") +
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

  // ---------- market pulse ----------
  function pulseCard() {
    const spx = quote("^GSPC");
    let title, price, change, changePct, series, open, label, note;
    if (spx?.series?.length) {
      ({ price, change, changePct, series, open } = spx);
      label = "S&P 500";
      note = state.markets.sample ? "Illustrative snapshot · not live" : `Intraday · 5 min bars · ${ago(spx.time) || "today"}`;
    } else if (state.btc) {
      const c = state.coins.find((x) => x.coin === "BTC");
      series = state.btc.map((r) => r.close);
      open = state.btc[0]?.open;
      price = c?.price ?? series[series.length - 1];
      change = price - open;
      changePct = (change / open) * 100;
      label = "BTC perp";
      note = "Hyperliquid · 24h · 15 min bars";
    } else {
      return `<aside class="card pulse"><div class="pulse-title">Market pulse</div><p class="empty">Market data unavailable.</p></aside>`;
    }
    title = "Market pulse";
    const bars = series.slice(-36);
    const min = Math.min(...bars);
    const max = Math.max(...bars);
    const barHtml = bars.map((v) => `<span style="height:${max === min ? 50 : 12 + ((v - min) / (max - min)) * 88}%"></span>`).join("");
    const radarSyms = ["NVDA", "TSLA", "MSFT"].map(quote).filter(Boolean);
    const radar = radarSyms.length
      ? radarSyms.map((q) => ({ sym: q.label, price: q.price, change: q.changePct }))
      : state.coins.slice(0, 3).map((c) => ({ sym: c.coin, price: c.price, change: coinChange(c) }));
    return `
      <aside class="card pulse">
        <div class="pulse-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>
          ${title}
        </div>
        <div class="eyebrow">${esc(note)}</div>
        <div class="pulse-price">${fmt(price)}</div>
        <div class="pulse-change ${dir(change)}">${esc(label)} &nbsp;${signed(change)} (${pct(changePct)})</div>
        <div class="bars ${dir(change)}">${barHtml}</div>
        <div class="oc"><span>OPEN<b>${fmt(open)}</b></span><span class="close">LAST<b>${fmt(price)}</b></span></div>
        <div class="eyebrow">On the radar</div>
        <ul class="radar">${radar.map((r) => `<li class="${r.change < 0 ? "down" : ""}"><span class="sym">${esc(r.sym)}</span><span>${fmt(r.price)}</span><span class="chg">${pct(r.change)}</span></li>`).join("")}</ul>
      </aside>`;
  }

  const explainer = `
    <section class="card explainer">
      <p>Perspective describes how a story is framed, not whether it is true. Each article gets a lean estimate from its outlet’s published rating, adjusted by partisan phrases found in its text, plus a sentiment score for tone. These are automated estimates. <a href="#/bias">Read the method</a>.</p>
      <div class="spectrum"><div class="l">LEFT</div><div class="c">CENTER</div><div class="r">RIGHT</div></div>
    </section>`;

  // ---------- views ----------
  function heroCard(c) {
    // The fallback shows when there is no image or the image fails to load.
    const img = (c.image ? `<img src="${esc(c.image)}" alt="" referrerpolicy="no-referrer">` : "") + `<div class="hero-fallback"><span>${esc(c.topic)}</span></div>`;
    return `
      <a class="card hero" href="#/story/${esc(c.id)}">
        ${img}
        <div class="hero-body">
          <div class="eyebrow">Top story · ${c.sourceCount} source${c.sourceCount === 1 ? "" : "s"}</div>
          <h2>${esc(c.title)}</h2>
          <p>${esc(c.summary)}</p>
          <div class="chips">${leanTag(c.lean.label, c.lean.score)}${toneTag(c.sentiment)}</div>
          <div class="meta">${esc(c.articles.map((a) => a.source.name).filter((n, i, xs) => xs.indexOf(n) === i).join(", "))} · ${ago(c.published)}</div>
        </div>
      </a>`;
  }

  function filteredClusters(list) {
    const q = state.query.toLowerCase();
    return list.filter((c) => {
      if (state.topic !== "All" && c.topic !== state.topic) return false;
      if (!q) return true;
      return c.articles.some((a) => (a.title + " " + a.summary + " " + a.source.name).toLowerCase().includes(q));
    });
  }

  function renderGrid() {
    const rest = clusters().slice(1);
    const searching = state.query || state.topic !== "All";
    const matched = filteredClusters(searching ? clusters() : rest);
    const hits = matched.slice(0, state.gridLimit);
    document.getElementById("wire-label").textContent = searching ? `${matched.length} stor${matched.length === 1 ? "y" : "ies"}` : "Across the wire";
    document.getElementById("grid").innerHTML = hits.length ? hits.map(storyCard).join("") : `<p class="empty">No stories match.</p>`;
    document.getElementById("more-stories").hidden = matched.length <= hits.length;
    document.querySelectorAll(".topic-chip").forEach((b) => b.classList.toggle("active", b.dataset.topic === state.topic));
  }

  function home() {
    const list = clusters();
    if (!list.length) {
      app.innerHTML = `<div class="page-head"><h1>Your daily perspective</h1></div>${statusLine()}`;
      return;
    }
    const topics = ["All", ...new Set(list.map((c) => c.topic))];
    app.innerHTML = `
      <div class="page-head">
        <h1>Your daily perspective</h1>
        <input class="search" id="search" type="search" placeholder="Search headlines..." aria-label="Search headlines" value="${esc(state.query)}">
      </div>
      ${statusLine()}
      <div class="top">${heroCard(list[0])}${pulseCard()}</div>
      <div class="wire-head">
        <h2 class="section-label" id="wire-label">Across the wire</h2>
        <div class="topic-chips">${topics.map((t) => `<button class="topic-chip" data-topic="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      </div>
      <div class="grid" id="grid"></div>
      <button class="more-btn" id="more-stories" hidden>More stories</button>
      ${explainer}`;
    renderGrid();
    document.getElementById("more-stories").addEventListener("click", () => {
      state.gridLimit += 12;
      renderGrid();
    });
    document.getElementById("search").addEventListener("input", (e) => {
      state.query = e.target.value.trim();
      renderGrid();
    });
    app.querySelector(".topic-chips").addEventListener("click", (e) => {
      const t = e.target.closest(".topic-chip");
      if (!t) return;
      state.topic = t.dataset.topic;
      renderGrid();
    });
  }

  function articleRow(a) {
    const link = safeUrl(a.link);
    const title = link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>` : esc(a.title);
    const framing = [...a.bias.framing.left.map((p) => `<span class="phrase phrase-left">${esc(p)}</span>`), ...a.bias.framing.right.map((p) => `<span class="phrase phrase-right">${esc(p)}</span>`)].join("");
    const loaded = a.loaded.words.map((w) => `<span class="phrase phrase-loaded">${esc(w)}</span>`).join("");
    return `
      <article class="coverage-item">
        <div class="meta"><b class="lean-${side(a.source.lean / 2)}">${esc(a.source.name)}</b> · ${esc(a.source.label)} · ${ago(a.published)}</div>
        <h3>${title}</h3>
        <p>${esc(a.summary)}</p>
        <div class="chips">${leanTag(a.bias.label, a.bias.score)}${toneTag(a.sentiment.compound)}</div>
        ${framing ? `<div class="phrases"><span class="phrase-label">Framing phrases</span>${framing}</div>` : ""}
        ${loaded ? `<div class="phrases"><span class="phrase-label">Loaded words</span>${loaded}</div>` : ""}
      </article>`;
  }

  function story(id) {
    const c = clusters().find((x) => x.id === id);
    if (!c) return notFound();
    const groups = { left: [], center: [], right: [] };
    c.articles.forEach((a) => groups[side(a.source.lean / 2)].push(a));
    const avgTone = (xs) => (xs.length ? xs.reduce((s, a) => s + a.sentiment.compound, 0) / xs.length : null);
    const lt = avgTone(groups.left);
    const rt = avgTone(groups.right);
    const toneCompare = lt != null && rt != null
      ? `<p class="small">Left rated outlets averaged ${signed(lt)}, right rated outlets ${signed(rt)}. ${Math.abs(lt - rt) >= 0.3 ? "That is a notable difference in tone." : "Their tone is broadly similar."}</p>`
      : `<p class="small">Tone comparison needs coverage from both sides.</p>`;
    const marker = Math.round(((c.lean.score + 1) / 2) * 100);
    const column = (key, name) => `
      <section class="side-col">
        <h2 class="side-head side-${key}">${name} <span>${groups[key].length}</span></h2>
        ${groups[key].length ? groups[key].map(articleRow).join("") : `<p class="empty">No coverage from ${name.toLowerCase()} rated sources in this cycle.</p>`}
      </section>`;
    app.innerHTML = `
      <article class="article wide">
        <a class="back" href="#/">← Back to top stories</a>
        <div class="eyebrow">${esc(c.topic)} · ${c.sourceCount} source${c.sourceCount === 1 ? "" : "s"} · ${c.articles.length} article${c.articles.length === 1 ? "" : "s"}</div>
        <h1>${esc(c.title)}</h1>
        <p class="dek">${esc(c.summary)}</p>
        ${c.image ? `<img class="story-img" src="${esc(c.image)}" alt="" referrerpolicy="no-referrer">` : ""}
        <div class="analysis">
          <div class="card stat">
            <div class="eyebrow">Coverage</div>
            ${coverageBar(c.coverage)}
            <p class="small">${c.blindspot ? `<b class="warn-text">Blindspot.</b> ${esc(c.blindspot)}.` : `${c.sourceCount} outlet${c.sourceCount === 1 ? "" : "s"} covered this story.`}</p>
          </div>
          <div class="card stat">
            <div class="eyebrow">Average tone</div>
            <div class="stat-big tone-${toneClass(c.sentiment)}">${signed(c.sentiment)}</div>
            ${toneCompare}
          </div>
          <div class="card stat">
            <div class="eyebrow">Coverage lean</div>
            <div class="stat-big lean-${side(c.lean.score)}">${esc(c.lean.label)}</div>
            <div class="scale"><span class="scale-marker" style="left:${marker}%"></span></div>
            <p class="small">Average of article estimates, from left (−1) to right (+1).</p>
          </div>
        </div>
        <div class="sides">${column("left", "Left")}${column("center", "Center")}${column("right", "Right")}</div>
        <p class="small method-note">Lean and tone are automated estimates. <a href="#/bias">How Parallax measures them</a>.</p>
      </article>`;
  }

  function latest() {
    const items = allArticles()
      .filter((a) => state.side === "all" || side(a.source.lean / 2) === state.side)
      .sort((a, b) => (b.published || "").localeCompare(a.published || ""));
    const shown = items.slice(0, state.latestLimit);
    const sides = [["all", "All"], ["left", "Left"], ["center", "Center"], ["right", "Right"]];
    app.innerHTML = `
      <div class="page-head"><h1>Latest news</h1>
        <div class="topic-chips">${sides.map(([k, n]) => `<button class="topic-chip ${state.side === k ? "active" : ""}" data-side="${k}">${n}</button>`).join("")}</div>
      </div>
      ${statusLine()}
      <div class="list">${shown.map((a) => {
        const link = safeUrl(a.link);
        return `
        <div class="card row">
          <time datetime="${esc(a.published)}">${ago(a.published)}</time>
          <div>
            <div class="eyebrow"><b class="lean-${side(a.source.lean / 2)}">${esc(a.source.name)}</b> · ${esc(a.topic)}</div>
            <h3>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>` : esc(a.title)}</h3>
            <p>${esc(a.summary)}</p>
            <div class="chips">${leanTag(a.bias.label, a.bias.score)}${toneTag(a.sentiment.compound)}
              ${a.cluster.articles.length > 1 ? `<a class="more" href="#/story/${esc(a.cluster.id)}">Compare ${a.cluster.articles.length} articles →</a>` : ""}</div>
          </div>
        </div>`;
      }).join("")}</div>
      ${items.length > shown.length ? `<button class="more-btn" id="more-latest">Show more (${items.length - shown.length} left)</button>` : ""}`;
    app.querySelector(".topic-chips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-side]");
      if (!b) return;
      state.side = b.dataset.side;
      state.latestLimit = 40;
      latest();
    });
    document.getElementById("more-latest")?.addEventListener("click", () => {
      state.latestLimit += 40;
      const y = window.scrollY;
      latest();
      window.scrollTo(0, y);
    });
  }

  function hlRows() {
    if (!state.coins.length) return `<tr><td colspan="6" class="empty">Connecting to Hyperliquid…</td></tr>`;
    return state.coins.slice(0, 15).map((c) => {
      const ch = coinChange(c);
      return `<tr><td>${esc(c.coin)}</td><td class="num">${fmt(c.price)}</td><td class="num ${dir(ch)}">${pct(ch)}</td>
        <td class="num ${dir(c.funding)}">${(c.funding * 100).toFixed(4)}%</td><td class="num">$${compact.format(c.openInterest)}</td><td class="num">$${compact.format(c.volume)}</td></tr>`;
    }).join("");
  }

  function toneByTopic() {
    const by = {};
    allArticles().forEach((a) => (by[a.topic] ||= []).push(a.sentiment.compound));
    const rows = Object.entries(by).filter(([, xs]) => xs.length >= 2).map(([t, xs]) => [t, xs.reduce((s, x) => s + x, 0) / xs.length, xs.length]).sort((a, b) => a[1] - b[1]);
    if (!rows.length) return `<p class="empty">Not enough articles yet.</p>`;
    return `<div class="diverging">${rows.map(([t, v, n]) => `
      <div class="div-row"><span class="div-label">${esc(t)} <i>${n}</i></span>
        <div class="div-track"><span class="div-bar ${dir(v)}" style="${v < 0 ? `right:50%;width:${Math.abs(v) * 50}%` : `left:50%;width:${v * 50}%`}"></span></div>
        <span class="div-val ${dir(v)}">${signed(v)}</span></div>`).join("")}</div>`;
  }

  function fearGreedCard() {
    const fg = state.markets?.fearGreed;
    if (!fg) return `<div class="card stat"><div class="eyebrow">Crypto Fear and Greed</div><p class="empty">Unavailable.</p></div>`;
    return `<div class="card stat"><div class="eyebrow">Crypto Fear and Greed · alternative.me</div>
      <div class="stat-big ${fg.value >= 50 ? "up" : "down"}">${fg.value} <small>${esc(fg.label)}</small></div>
      <div class="fg-track"><span class="scale-marker" style="left:${fg.value}%"></span></div>
      <div class="cov-labels"><span>Extreme fear</span><span>Extreme greed</span></div></div>`;
  }

  function markets() {
    const quotes = state.markets?.quotes || [];
    const rows = quotes.map((q) => `<tr><td>${esc(q.label)}</td><td class="num">${fmt(q.price)}</td><td class="num ${dir(q.change)}">${signed(q.change)}</td><td class="num ${dir(q.changePct)}">${pct(q.changePct)}</td></tr>`).join("");
    const related = clusters().filter((c) => c.topic === "Markets" || c.topic === "Business").slice(0, 6);
    app.innerHTML = `
      <div class="page-head"><h1>Markets</h1></div>
      <div class="top">
        <div class="card table-card"><table class="table">
          <thead><tr><th>Index or stock</th><th class="num">Last</th><th class="num">Change</th><th class="num">%</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" class="empty">Equity data unavailable.</td></tr>`}</tbody>
        </table>
        <p class="table-note">${state.markets?.sample ? "Sample prices." : "Yahoo Finance, delayed. Updates every minute."}</p></div>
        ${pulseCard()}
      </div>
      <h2 class="section-label"><span class="dot live"></span> Crypto perpetuals on Hyperliquid</h2>
      <div class="card scroll-x"><table class="table">
        <thead><tr><th>Coin</th><th class="num">Mid</th><th class="num">24h</th><th class="num">Funding 1h</th><th class="num">Open interest</th><th class="num">24h volume</th></tr></thead>
        <tbody id="hl-body">${hlRows()}</tbody>
      </table><p class="table-note">Streaming from the Hyperliquid public API. Top 15 by 24 hour volume.</p></div>
      <div class="two-col">
        ${fearGreedCard()}
        <div class="card stat"><div class="eyebrow">News tone by topic · ${state.news?.sample ? "sample" : "live feeds"}</div>${toneByTopic()}</div>
      </div>
      <h2 class="section-label">Markets and business coverage</h2>
      <div class="grid">${related.map(storyCard).join("") || `<p class="empty">No market stories right now.</p>`}</div>`;
  }

  function bias() {
    const sources = state.news?.sources || [];
    const srcRows = sources.map((s) => `<tr><td>${esc(s.name)}</td><td class="lean-${side(s.lean / 2)}">${esc(s.label)}</td><td class="num">${s.ok ? s.count : `<span class="down">offline</span>`}</td></tr>`).join("");
    app.innerHTML = `
      <div class="page-head"><h1>Understanding bias</h1></div>
      <div class="prose">
        <p>Every story involves choices. Which fact goes first, whose quote gets the most space and which words describe a policy all shape how a reader sees an event, even when every sentence is accurate. Parallax groups coverage of the same event from outlets across the spectrum so you can compare those choices side by side.</p>
        <h2>Source ratings</h2>
        <p>Each outlet starts from a published rating on a five point scale from left to right. The ratings follow the AllSides Media Bias Chart at the time they were added and can be changed in <code>server/sources.js</code>. Check <a href="https://www.allsides.com/media-bias/ratings" target="_blank" rel="noopener noreferrer">allsides.com</a> for current ratings.</p>
        ${srcRows ? `<div class="card"><table class="table"><thead><tr><th>Source</th><th>Rating</th><th class="num">Articles now</th></tr></thead><tbody>${srcRows}</tbody></table></div>` : `<p class="small">Source status appears here when live feeds are running.</p>`}
        <h2>Framing phrases</h2>
        <p>Some phrases are used far more by one side than the other, such as “undocumented immigrants” versus “illegal aliens” or “estate tax” versus “death tax”. Parallax scans each headline, summary and available article text for about seventy such phrases, an approach based on Gentzkow and Shapiro’s research on media slant. Matches can move an article up to halfway away from its outlet’s rating, and the phrases found are shown on every story page.</p>
        <h2>Tone</h2>
        <p>Tone uses VADER, a sentiment model built for short text, extended with market and news terms such as “rally”, “plunge” and “recession” that general models miss. Scores run from −1 to +1. Negative tone is not a sign of bias. A story about an earthquake should read as negative.</p>
        <h2>Loaded language</h2>
        <p>Words like “slams”, “bombshell” or “meltdown” signal emotive framing. They are listed under each article so you can see where coverage leans on them.</p>
        <h2>Limits</h2>
        <p>These are automated estimates built from headlines and short summaries. A label is not a fact check, and a lean left article can be accurate while a center article contains mistakes. Use the comparison to read more widely, not to decide what is true.</p>
      </div>
      ${explainer}`;
  }

  function notFound() {
    app.innerHTML = `<div class="page-head"><h1>Story not found</h1></div><p class="empty">It may have dropped out of the latest feed cycle. <a href="#/">Return to top stories</a></p>`;
  }

  // ---------- routing and refresh ----------
  const routes = { "": home, latest, markets, bias };
  const parseHash = () => location.hash.replace(/^#\/?/, "").split("/");

  function render() {
    const [name, param] = parseHash();
    const active = name || "home";
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === active));
    if (name === "story") story(decodeURIComponent(param || ""));
    else (routes[name] || notFound)();
  }

  window.addEventListener("hashchange", () => {
    render();
    window.scrollTo(0, 0);
  });

  // Broken remote images are hidden. Inline handlers are blocked by the CSP.
  document.addEventListener("error", (e) => e.target.tagName === "IMG" && e.target.classList.add("broken"), true);

  async function refreshNews() {
    state.news = await loadNews();
    if (!document.activeElement || document.activeElement.id !== "search") render();
  }

  async function refreshMarkets() {
    state.markets = await loadMarkets();
    renderTicker();
    if (parseHash()[0] === "markets") render();
  }

  async function startHyperliquid() {
    try {
      state.coins = await hyperliquid.load();
      if (!quote("^GSPC")?.series?.length) state.btc = await hyperliquid.candles("BTC");
      renderTicker();
      render();
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

  render();
  Promise.all([refreshNews(), refreshMarkets()]).then(startHyperliquid);
  setInterval(refreshNews, 5 * 60 * 1000);
  setInterval(refreshMarkets, 60 * 1000);
  setInterval(() => hyperliquid.load().then((c) => (state.coins = c)).catch(() => {}), 5 * 60 * 1000);
})();
