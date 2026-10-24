(function () {
  const { loadNews, loadMarkets, loadProgress, loadInfo, loadPrefs, savePrefs, openStream, hyperliquid } = window.ParallaxData;
  const Prefs = window.ParallaxPrefs;
  const { esc, compact, fmt, pct, signed, dir, plural, side, sourceSide, toneClass, ago, icons, sentimentBar, coverageBar, toneMix, sourceRow, media, articleLink, meta, feedItem } = window.ParallaxUI;
  const app = document.getElementById("app");
  const desktop = window.parallaxDesktop || null;
  const profile = Prefs.load();

  // Settings save to this browser's local storage and, when the server keeps a data folder
  // (the desktop app always does), to prefs.json there as well. The desktop page gets a new
  // origin each launch, so the file is what makes its settings stick.
  let prefsTimer = null;
  function saveProfile() {
    Prefs.save(profile);
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(() => savePrefs(profile), 300);
  }
  const state = {
    news: null, markets: null, articles: [], byId: new Map(), coins: [], coinMap: new Map(), candles: new Map(),
    radarSlide: 0, chart: null, chartHover: false,
    pulse: "spx", asideSide: "all", side: "all", region: "All", pageN: 1,
    info: null, desktop: null, update: null, toastFor: null
  };
  const TICKER_COINS = ["BTC", "ETH", "SOL", "HYPE", "XRP", "DOGE"];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Display settings that live on the html and body elements.
  function applyPrefs() {
    document.documentElement.dataset.text = profile.textSize;
    document.body.classList.toggle("no-ticker", !profile.ticker);
    document.body.classList.toggle("no-thumbs", !profile.thumbs);
  }

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

  // ---------- ticker and live prices ----------
  // Live keys are Yahoo symbols ("^GSPC") or Hyperliquid coins prefixed with "hl-".
  function liveValue(key) {
    if (key.startsWith("hl-")) {
      const c = state.coinMap.get(key.slice(3));
      return c && { price: c.price, change: c.price - c.prev, changePct: coinChange(c) };
    }
    const q = quote(key);
    return q && { price: q.price, change: q.change, changePct: q.changePct };
  }

  function tickerItems() {
    const items = (state.markets?.quotes || []).map((q) => ({ key: q.symbol, label: q.label }));
    for (const sym of TICKER_COINS) if (state.coinMap.has(sym)) items.push({ key: "hl-" + sym, label: sym });
    return items;
  }

  let tickerKeys = "";
  function renderTicker() {
    const items = tickerItems();
    const keys = items.map((t) => t.key).join();
    // Same instruments as before: update in place so the scroll does not jump back.
    if (keys === tickerKeys) return patchLive();
    tickerKeys = keys;
    const note = state.markets?.sample ? "/ SAMPLE PRICES" : `<span class="dot live"></span> LIVE · YAHOO FINANCE · HYPERLIQUID`;
    const html =
      items.map((t) => {
        const v = liveValue(t.key) || {};
        return `<span class="tick ${v.changePct < 0 ? "down" : ""}" data-live="${esc(t.key)}" data-p="${v.price ?? ""}"><span>${esc(t.label)}</span><b class="lv-price">${fmt(v.price)}</b><span class="chg lv-pct">${pct(v.changePct)}</span></span>`;
      }).join("") + `<span class="tick-note">${note}</span>`;
    document.getElementById("ticker").innerHTML = html + html;
  }

  // Flashes are Web Animations rather than CSS classes, so restarting one never forces a
  // layout. Forcing layout per element froze the Markets page under a stream of ticks.
  const FLASH = { up: "rgba(129, 201, 149, 0.28)", down: "rgba(242, 139, 130, 0.28)" };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const flash = (el, up) => !reduceMotion.matches && el.animate?.([{ backgroundColor: up ? FLASH.up : FLASH.down }, { backgroundColor: "transparent" }], { duration: 900, easing: "ease-out" });

  // Writes the latest prices into every element tagged data-live, flashing the ones that moved.
  function patchLive() {
    document.querySelectorAll("[data-live]").forEach((el) => {
      const v = liveValue(el.dataset.live);
      if (!v || v.price == null || isNaN(v.price)) return;
      const prev = el.dataset.p === "" || el.dataset.p == null ? null : Number(el.dataset.p);
      if (prev === v.price) return;
      if (prev != null) flash(el, v.price > prev);
      el.dataset.p = v.price;
      // Ticker chips and radar rows color their change from a "down" class on the row itself.
      if (el.matches(".tick, .radar-row")) el.classList.toggle("down", v.changePct < 0);
      const set = (sel, text) => el.querySelectorAll(sel).forEach((x) => x.textContent !== text && (x.textContent = text));
      set(".lv-price", fmt(v.price));
      set(".lv-chg", signed(v.change));
      set(".lv-pct", pct(v.changePct));
      el.querySelectorAll(".lv-dir").forEach((x) => {
        x.classList.toggle("up", v.change >= 0);
        x.classList.toggle("down", v.change < 0);
      });
    });
  }

  // Batches live ticks: prices at most every 400 ms, the pulse chart at most every 5 s.
  let liveTimer = null;
  let pulseTimer = null;
  let pulseAt = 0;
  function scheduleLive() {
    if (document.hidden) return;
    if (!liveTimer) liveTimer = setTimeout(() => ((liveTimer = null), patchLive()), 400);
    if (!pulseTimer) pulseTimer = setTimeout(() => ((pulseTimer = null), refreshPulse()), Math.max(0, 5000 - (Date.now() - pulseAt)));
  }

  function refreshPulse() {
    // Leave the chart alone while someone is hovering it, so the tooltip does not vanish.
    if (state.chartHover) return;
    pulseAt = Date.now();
    const el = document.querySelector(".pulse");
    if (el) el.outerHTML = pulseCard();
    fitPulseChips();
  }

  // Keeps the chosen instrument chip in view after a re-render, and drops the edge fade once
  // the row is scrolled to its end.
  function fitPulseChips(scroll = true) {
    const row = document.querySelector(".pulse-chips");
    if (!row) return;
    const active = row.querySelector('[aria-pressed="true"]');
    if (scroll && active) row.scrollLeft = active.offsetLeft - row.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
    row.classList.toggle("at-end", row.scrollLeft + row.clientWidth >= row.scrollWidth - 2);
  }
  document.addEventListener("scroll", (e) => e.target.classList?.contains("pulse-chips") && fitPulseChips(false), true);

  // Live ticks are skipped while the window is hidden or minimized, then caught up on return.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    patchLive();
    refreshPulse();
  });

  function onQuote(q) {
    const target = !state.markets?.sample && state.markets?.quotes?.find((x) => x.symbol === q.id);
    if (!target) return;
    target.price = q.price;
    if (q.change != null) target.change = q.change;
    if (q.changePct != null) target.changePct = q.changePct;
    if (target.series?.length) target.series[target.series.length - 1] = q.price;
    if (q.time) target.time = new Date(q.time).toISOString();
    scheduleLive();
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
            ${c.image || lead.image ? media(c.image || lead.image, c.topic, "lead-media", lead.source.name) : ""}
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

  // Instruments the pulse chart can show. Yahoo ones use the server's 5 minute intraday bars,
  // Hyperliquid ones use 15 minute candles over the last day, streamed live.
  const PULSE = [
    { key: "spx", label: "S&P 500", yahoo: "^GSPC" },
    { key: "ndx", label: "NASDAQ", yahoo: "^IXIC" },
    { key: "dow", label: "DOW", yahoo: "^DJI" },
    { key: "gold", label: "Gold", yahoo: "GC=F" },
    { key: "oil", label: "Oil", yahoo: "CL=F" },
    { key: "btc", label: "BTC perp", coin: "BTC" },
    { key: "eth", label: "ETH perp", coin: "ETH" },
    { key: "sol", label: "SOL perp", coin: "SOL" },
    { key: "hype", label: "HYPE perp", coin: "HYPE" }
  ];
  const PULSE_COINS = PULSE.filter((p) => p.coin).map((p) => p.coin);
  const MAX_BARS = 60;

  // Chart data for one instrument: values, their times, and the live price key.
  function pulseData(p) {
    if (p.yahoo) {
      const q = quote(p.yahoo);
      if (!q?.series?.length) return null;
      return {
        values: q.series, times: q.times || [], open: q.open, price: q.price, change: q.change, changePct: q.changePct, liveKey: q.symbol,
        note: state.markets.sample ? "Illustrative snapshot · not live" : `Intraday · 5 min bars · ${ago(q.time).toLowerCase() || "today"}`
      };
    }
    const rows = state.candles.get(p.coin);
    if (!rows?.length) return null;
    const c = state.coinMap.get(p.coin);
    const values = rows.map((r) => r.close);
    const price = c?.price ?? values[values.length - 1];
    values[values.length - 1] = price;
    const open = rows[0].open;
    return {
      values, times: rows.map((r) => r.t), open, price, liveKey: "hl-" + p.coin,
      change: c ? c.price - c.prev : price - open, changePct: c ? coinChange(c) : ((price - open) / open) * 100,
      note: "Hyperliquid · live · 24h of 15 min bars"
    };
  }

  // Evenly samples a long series down to at most n points, always keeping the latest one.
  function sample(values, times, n) {
    if (values.length <= n) return { values, times };
    const idx = Array.from({ length: n }, (_, i) => Math.round((i * (values.length - 1)) / (n - 1)));
    return { values: idx.map((i) => values[i]), times: idx.map((i) => times[i]) };
  }

  // "On the radar" slides: a fixed set of groups plus the day's biggest movers.
  function radarSlides() {
    const item = (key) => {
      const v = liveValue(key);
      if (!v || v.price == null) return null;
      const label = key.startsWith("hl-") ? key.slice(3) : quote(key)?.label || key;
      return { key, label, price: v.price, change: v.changePct };
    };
    const group = (title, keys) => ({ title, items: keys.map(item).filter(Boolean) });
    const quotes = (state.markets?.quotes || []).filter((q) => q.changePct != null);
    const movers = [...quotes].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 4).map((q) => q.symbol);
    return [
      group("Biggest movers", movers),
      group("Big tech", ["NVDA", "AAPL", "MSFT", "GOOGL"]),
      group("More stocks", ["TSLA", "AMZN", "META"]),
      group("Rates and commodities", ["^TNX", "^VIX", "GC=F", "CL=F"]),
      group("Crypto perps", ["hl-ETH", "hl-SOL", "hl-HYPE", "hl-XRP"])
    ].filter((s) => s.items.length);
  }

  function radarCard() {
    const slides = radarSlides();
    if (!slides.length) return "";
    state.radarSlide %= slides.length;
    const row = (r) => `<div class="radar-row ${r.change < 0 ? "down" : ""}" data-live="${esc(r.key)}" data-p="${r.price}"><span class="sym">${esc(r.label)}</span><span class="lv-price">${fmt(r.price)}</span><span class="chg lv-pct">${pct(r.change)}</span></div>`;
    return `
      <div class="radar" data-slides="${slides.length}">
        <div class="radar-head"><span class="muted small">On the radar · <span class="radar-title">${esc(slides[state.radarSlide].title)}</span></span>
          <span class="radar-dots">${slides.map((s, i) => `<button class="radar-dot" data-radar="${i}" data-title="${esc(s.title)}" aria-label="${esc(s.title)}" aria-current="${i === state.radarSlide}"></button>`).join("")}</span></div>
        <div class="radar-window"><div class="radar-track" style="transform:translateX(-${state.radarSlide * 100}%)">
          ${slides.map((s) => `<div class="radar-slide">${s.items.map(row).join("")}</div>`).join("")}
        </div></div>
      </div>`;
  }

  // Moves the slideshow without re-rendering the card, so prices keep streaming in place.
  function showRadarSlide(i) {
    const radar = document.querySelector(".radar");
    if (!radar) return;
    const n = Number(radar.dataset.slides);
    state.radarSlide = ((i % n) + n) % n;
    radar.querySelector(".radar-track").style.transform = `translateX(-${state.radarSlide * 100}%)`;
    radar.querySelectorAll(".radar-dot").forEach((d, j) => {
      d.setAttribute("aria-current", j === state.radarSlide);
      if (j === state.radarSlide) radar.querySelector(".radar-title").textContent = d.dataset.title;
    });
  }

  function pulseCard() {
    const head = panelTitle("#/markets", "Market pulse");
    const available = PULSE.filter((p) => pulseData(p));
    if (!available.length) return `<section class="panel pulse">${head}<p class="empty">Market data unavailable.</p></section>`;
    const p = available.find((x) => x.key === state.pulse) || available[0];
    const d = pulseData(p);
    const { values, times } = sample(d.values, d.times, MAX_BARS);
    const min = Math.min(...values);
    const max = Math.max(...values);
    state.chart = { values, times, open: d.open, label: p.label, crypto: !!p.coin };
    const barHtml = values.map((v) => `<span style="height:${max === min ? 50 : 12 + ((v - min) / (max - min)) * 88}%"></span>`).join("");
    const chips = available.length > 1 ? `<div class="chips pulse-chips">${available.map((x) => chip("pulse", x.key, esc(x.label), x === p)).join("")}</div>` : "";
    return `
      <section class="panel pulse">
        ${head}
        ${chips}
        <div class="pulse-body">
          <div class="muted small">${esc(d.note)}</div>
          <div class="pulse-live" data-live="${esc(d.liveKey)}" data-p="${d.price}">
            <div class="pulse-price lv-price">${fmt(d.price)}</div>
            <div class="pulse-change lv-dir ${dir(d.change)}">${esc(p.label)} <span class="lv-chg">${signed(d.change)}</span> (<span class="lv-pct">${pct(d.changePct)}</span>)</div>
          </div>
          <div class="chart" data-chart>
            <div class="bars ${dir(d.change)}" aria-hidden="true">${barHtml}</div>
            <div class="chart-tip" hidden></div>
          </div>
          <div class="oc"><span>OPEN<b>${fmt(d.open)}</b></span><span class="close">LAST<b>${fmt(d.price)}</b></span></div>
        </div>
        ${radarCard()}
      </section>`;
  }

  // Hovering the chart highlights a bar and shows its price, time and move from the open.
  function chartTime(t, crypto) {
    if (!t) return "";
    const d = new Date(t);
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return crypto || d.toDateString() !== new Date().toDateString() ? `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}` : time;
  }

  function onChartMove(e) {
    const chart = e.target.closest("[data-chart]");
    const c = state.chart;
    if (!chart || !c) return;
    const bars = chart.querySelectorAll(".bars span");
    const rect = chart.getBoundingClientRect();
    const i = Math.max(0, Math.min(bars.length - 1, Math.floor(((e.clientX - rect.left) / rect.width) * bars.length)));
    bars.forEach((b, j) => b.classList.toggle("hot", j === i));
    const v = c.values[i];
    const move = c.open ? ((v - c.open) / c.open) * 100 : 0;
    const tip = chart.querySelector(".chart-tip");
    tip.innerHTML = `<b>${fmt(v)}</b><span>${esc(chartTime(c.times[i], c.crypto))}</span><span class="${dir(move)}">${pct(move)} from open</span>`;
    tip.hidden = false;
    const x = ((i + 0.5) / bars.length) * rect.width;
    tip.style.left = `${Math.max(tip.offsetWidth / 2, Math.min(rect.width - tip.offsetWidth / 2, x))}px`;
    state.chartHover = true;
  }

  function onChartLeave(e) {
    const chart = e.target.closest?.("[data-chart]");
    if (!chart || chart.contains(e.relatedTarget)) return;
    chart.querySelectorAll(".bars span.hot").forEach((b) => b.classList.remove("hot"));
    chart.querySelector(".chart-tip").hidden = true;
    state.chartHover = false;
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
      <p>Perspective describes how a story is framed, not whether it is true. Each article gets a lean estimate from its outlet’s published rating, from AllSides or Media Bias/Fact Check, adjusted by partisan phrases found in its text, plus a sentiment score for tone. Outlets on nonpolitical beats such as sports are marked nonpolitical. These are automated estimates. <a href="#/bias">Read the method</a>.</p>
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
        <div class="meta">${ago(a.published)} · <span class="lean-${side(a.bias.score)}" title="Article lean estimate">${esc(a.source.nonpolitical && a.bias.score == null ? "Nonpolitical" : a.bias.label)}</span> <span class="rated-by">· ${esc(methodNote(a))}</span></div>
        ${sentimentBar(a.sentiment.compound, style())}
        ${framing ? `<div class="phrases"><span class="phrase-label">Framing phrases</span>${framing}</div>` : ""}
        ${loaded ? `<div class="phrases"><span class="phrase-label">Loaded words</span>${loaded}</div>` : ""}
      </article>`;
  }

  function methodNote(a) {
    if (a.bias.method === "rating") return `outlet rated by ${a.source.ratedBy}${a.bias.framing.left.length + a.bias.framing.right.length ? ", adjusted by phrases" : ""}`;
    if (a.bias.method === "model") return "outlet lean estimated from phrase evidence";
    if (a.bias.method === "phrases") return "from framing phrases only";
    return a.source.nonpolitical ? "no left-right rating for this beat" : "no published rating";
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
        ${c.image ? media(c.image, c.topic, "lead-media story-media", c.articles[0].source.name) : ""}
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
          <h2 class="side-head side-unrated">Unrated and nonpolitical outlets <span>${groups.unrated.length}</span></h2>
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
      return `<tr data-live="hl-${esc(c.coin)}" data-p="${c.price}"><td>${esc(c.coin)}</td><td class="num lv-price">${fmt(c.price)}</td><td class="num lv-dir lv-pct ${dir(ch)}">${pct(ch)}</td>
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
    const rows = quotes.map((q) => `<tr data-live="${esc(q.symbol)}" data-p="${q.price}"><td>${esc(q.label)}</td><td class="num lv-price">${fmt(q.price)}</td><td class="num lv-dir lv-chg ${dir(q.change)}">${signed(q.change)}</td><td class="num lv-dir lv-pct ${dir(q.changePct)}">${pct(q.changePct)}</td></tr>`).join("");
    const related = clusters().filter((c) => c.topic === "Markets" || c.topic === "Business").slice(0, 4);
    app.innerHTML = `
      <div class="page-head"><h1>Markets</h1></div>
      <div class="home-top">
        <div class="panel table-card"><table class="table">
          <thead><tr><th>Index or stock</th><th class="num">Last</th><th class="num">Change</th><th class="num">%</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" class="empty">Equity data unavailable.</td></tr>`}</tbody>
        </table>
        <p class="table-note">${state.markets?.sample ? "Sample prices." : "Live from the Yahoo Finance stream while markets are open. Charts refresh every minute."}</p></div>
        <aside class="side">${pulseCard()}</aside>
      </div>
      <h2 class="section-label"><span class="dot live"></span> Crypto perpetuals on Hyperliquid</h2>
      <div class="panel scroll-x"><table class="table">
        <thead><tr><th>Coin</th><th class="num">Mid</th><th class="num">24h</th><th class="num">Funding 1h</th><th class="num">Open interest</th><th class="num">24h volume</th></tr></thead>
        <tbody id="hl-body">${hlRows()}</tbody>
      </table><p class="table-note">Streaming live from the Hyperliquid public API. Top 15 by 24 hour volume. Funding, open interest and volume refresh every minute.</p></div>
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

  function modelStatus() {
    const m = state.news?.model;
    if (!m) return "";
    if (m.ready) {
      const v = m.validation;
      return `<p>Right now the model passes its check. Predicting each of ${v.outlets} rated outlets from the others, its estimates correlate ${v.correlation.toFixed(2)} with the published ratings and land on the same side ${Math.round(v.sideAccuracy * 100)}% of the time. It is estimating ${plural(m.estimated, "outlet")}, marked “(est.)”.</p>`;
    }
    const last = m.validation ? ` Its last check scored ${m.validation.correlation.toFixed(2)}, below the 0.60 needed to publish.` : "";
    return `<p>Right now the model is still collecting evidence, with ${m.evidence.toLocaleString()} articles scanned so far.${last} Until it passes, outlets without a published rating stay unrated.</p>`;
  }

  function bias() {
    const sources = state.news?.sources || [];
    const rater = (s) => (s.nonpolitical ? "—" : s.ratedBy ? esc(s.ratedBy) : "—");
    const srcRows = sources.map((s) => `<tr><td>${esc(s.name)}${s.kind === "markets" ? ` <span class="tag">markets</span>` : ""}</td><td>${esc(s.region)}</td><td class="lean-${sourceSide(s.lean)}">${esc(s.label)}</td><td>${rater(s)}</td><td class="num">${s.ok ? s.count : `<span class="down">offline</span>`}</td></tr>`).join("");
    app.innerHTML = `
      <div class="page-head"><h1>Understanding bias</h1></div>
      <div class="prose">
        <p>Every story involves choices. Which fact goes first, whose quote gets the most space and which words describe a policy all shape how a reader sees an event, even when every sentence is accurate. Parallax groups coverage of the same event from outlets across the spectrum so you can compare those choices side by side.</p>
        <h2>Source ratings</h2>
        <p>Each outlet starts from a published rating on a five point scale from left to right. Parallax uses the AllSides Media Bias Chart where AllSides rates the outlet, and otherwise the outlet’s Media Bias/Fact Check rating, mapped Left, Left-Center, Least Biased, Right-Center and Right onto the same scale. Both were last checked in October 2026 and can be changed in <code>server/sources.js</code>. Check <a href="https://www.allsides.com/media-bias/ratings" target="_blank" rel="noopener noreferrer">allsides.com</a> and <a href="https://mediabiasfactcheck.com" target="_blank" rel="noopener noreferrer">mediabiasfactcheck.com</a> for current ratings.</p>
        <p>Both scales are built around US politics, so treat ratings of non-US outlets as a rough guide. Outlets that cover a single nonpolitical beat, such as sports, technology or entertainment, are marked nonpolitical instead of getting a left-right rating. The few outlets neither service rates are marked unrated. Their articles still count as coverage and appear on every story page.</p>
        ${srcRows ? `<div class="panel scroll-x"><table class="table"><thead><tr><th>Source</th><th>Region</th><th>Rating</th><th>Rated by</th><th class="num">Articles now</th></tr></thead><tbody>${srcRows}</tbody></table></div>` : `<p class="small">Source status appears here when live feeds are running.</p>`}
        <h2>Framing phrases</h2>
        <p>Some phrases are used far more by one side than the other, such as “undocumented immigrants” versus “illegal aliens” or “estate tax” versus “death tax”. Parallax scans each headline, summary and available article text for about 150 such phrases, an approach based on Gentzkow and Shapiro’s research on media slant. Matches can move an article up to halfway away from its outlet’s rating, and the phrases found are shown on every story page.</p>
        <h2>Estimates for unrated outlets</h2>
        <p>For outlets without a published rating, Parallax keeps a running tally of the framing phrases in their articles across feed cycles. To check that the tally means something, it computes the same tally for rated outlets and predicts each rated outlet from a line fitted on all the others. Estimates only appear when those predictions track the published ratings closely, and they are always marked as estimates. Models that learn from ordinary vocabulary were also tested and did no better than chance on a day of headlines, so they are not used.</p>
        ${modelStatus()}
        <h2>Tone</h2>
        <p>Tone uses VADER, a sentiment model built for short text, extended with market and news terms such as “rally”, “plunge” and “recession” that general models miss. Scores run from −1 to +1, and the sentiment bar under each article shows where it falls. Negative tone is not a sign of bias. A story about an earthquake should read as negative.</p>
        <h2>Loaded language</h2>
        <p>Words like “slams”, “bombshell” or “meltdown” signal emotive framing. They are listed under each article so you can see where coverage leans on them.</p>
        <h2>Limits</h2>
        <p>These are automated estimates built from outlet ratings, headlines and short summaries. A label is not a fact check, and a lean left article can be accurate while a center article contains mistakes. Use the comparison to read more widely, not to decide what is true.</p>
      </div>
      ${explainer}`;
  }

  // ---------- settings ----------
  const choiceChips = (action, current, options) => `<div class="chips">${options.map(([v, label]) => chip(action, v, label, String(current) === String(v))).join("")}</div>`;
  const switchRow = (title, sub, action, value, on) => `
    <div class="setting-row">
      <div><b>${title}</b>${sub ? `<div class="muted small">${sub}</div>` : ""}</div>
      <button class="switch" data-action="${action}" data-value="${value}" role="switch" aria-checked="${on}" aria-label="${title}"><span></span></button>
    </div>`;
  const pickRow = (title, sub, chipsHtml) => `
    <div class="setting-row">
      <div><b>${title}</b>${sub ? `<div class="muted small">${sub}</div>` : ""}</div>
      ${chipsHtml}
    </div>`;

  function updateBlock() {
    const u = state.update || state.desktop?.update || { status: "idle" };
    const version = u.version ? `version ${esc(u.version)}` : "a new version";
    const checked = u.checkedAt ? ` · checked ${ago(u.checkedAt).toLowerCase()}` : "";
    const lines = {
      dev: [`<span class="dot"></span><span>Updates arrive in the installed app. This copy runs from source.</span>`, ""],
      idle: [`<span class="dot"></span><span>Waiting to check for updates</span>`, `<button class="outline-btn" data-action="check-update">Check for updates</button>`],
      checking: [`<span class="dot live"></span><span>Checking GitHub for updates…</span>`, ""],
      current: [`<span class="dot live"></span><span><b>You’re up to date</b>${checked}</span>`, `<button class="outline-btn" data-action="check-update">Check again</button>`],
      available: [`<span class="dot"></span><span><b>${version} is available</b></span>`, `<button class="filled-btn" data-action="download-update">Download update</button>`],
      downloading: [`<span class="dot live"></span><span>Downloading ${version}… ${u.progress || 0}%</span>`, ""],
      ready: [`<span class="dot live"></span><span><b>${version} is ready to install</b></span>`, `<button class="filled-btn" data-action="install-update">Restart and update</button>`],
      error: [`<span class="dot" style="background:var(--down)"></span><span>Update check failed. ${esc(u.error || "")}</span>`, `<button class="outline-btn" data-action="check-update">Try again</button>`]
    };
    const [status, button] = lines[u.status] || lines.idle;
    return `
      <div class="update-status">${status}</div>
      ${u.status === "downloading" ? `<div class="progress"><i style="width:${u.progress || 0}%"></i></div>` : ""}
      ${button ? `<div class="btn-row">${button}</div>` : ""}`;
  }

  function desktopBlock() {
    if (!desktop) {
      return `
        <section class="panel settings-block">
          <h2>Desktop app</h2>
          <p class="muted">The Windows app opens full screen, keeps live prices streaming and updates itself over the air from GitHub.</p>
          <div class="btn-row"><a class="outline-btn" href="https://github.com/ishaanman7898/Parallax/releases/latest" target="_blank" rel="noopener noreferrer">Download for Windows</a></div>
        </section>`;
    }
    const d = state.desktop;
    if (!d) return "";
    return `
      <section class="panel settings-block">
        <h2>Desktop app</h2>
        <p class="muted">Parallax ${esc(d.version)}. Press F11 to toggle full screen at any time.</p>
        ${pickRow("Window on launch", "How the window opens next time. Changes apply now too.", choiceChips("window-mode", d.settings.windowMode, [["maximized", "Maximized"], ["fullscreen", "Full screen"], ["windowed", "Windowed"]]))}
        <div class="setting-row">
          <div><b>Settings folder</b><div class="muted small">${esc(d.dataDir || "")}</div><div class="muted small">Your settings, reading history and lean evidence are saved here.</div></div>
          <button class="outline-btn" data-action="open-data">Open folder</button>
        </div>
        <h3 class="group-label">Updates</h3>
        ${switchRow("Download updates automatically", "New releases download in the background and install when you restart.", "auto-update", "", d.settings.autoUpdate)}
        ${updateBlock()}
      </section>`;
  }

  function sourcesBlock() {
    const n = state.news;
    if (!n || n.sample) {
      return `<section class="panel settings-block"><h2>Sources</h2><p class="muted">Live source details appear when the Parallax server or desktop app is running.</p></section>`;
    }
    const count = (f) => n.sources.filter(f).length;
    return `
      <section class="panel settings-block">
        <h2>Sources</h2>
        <p class="muted">Updated ${ago(n.updated).toLowerCase()}.</p>
        <div class="kv">
          <div><b>${count((s) => s.ok)} / ${n.sources.length}</b><span>Outlets online</span></div>
          <div><b>${n.articleCount.toLocaleString()}</b><span>Articles in this cycle</span></div>
          <div><b>${count((s) => s.ratedBy === "AllSides")}</b><span>Rated by AllSides</span></div>
          <div><b>${count((s) => s.ratedBy === "MBFC")}</b><span>Rated by Media Bias/Fact Check</span></div>
          <div><b>${count((s) => s.estimated)}</b><span>Estimated by the model</span></div>
          <div><b>${count((s) => s.nonpolitical)}</b><span>Nonpolitical beats</span></div>
        </div>
        <div class="setting-row"><div><b><span class="dot live"></span> Live updates</b><div class="muted small">The server checks every outlet every few minutes and new stories appear as soon as they are in.</div></div></div>
        <div class="btn-row">
          <button class="outline-btn" data-action="refresh-now">Refresh now</button>
          <a class="outline-btn" href="#/bias">See every outlet and rating</a>
        </div>
      </section>`;
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
    const version = state.desktop?.version || state.info?.version;
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
          <h2>Appearance</h2>
          ${pickRow("Text size", "", choiceChips("text-size", profile.textSize, [["small", "Small"], ["default", "Default"], ["large", "Large"]]))}
          ${pickRow("Start page", "Where Parallax opens.", choiceChips("start-page", profile.startPage, [["home", "Home"], ["foryou", "For you"], ["latest", "Latest"], ["world", "World"], ["markets", "Markets"]]))}
          ${switchRow("Startup animation", "Plays while the first feeds load, then opens the news.", "toggle-pref", "splash", profile.splash)}
          ${switchRow("Market ticker", "Live prices scrolling under the section tabs.", "toggle-pref", "ticker", profile.ticker)}
          ${switchRow("Article images", "Thumbnails beside headlines and lead images on stories.", "toggle-pref", "thumbs", profile.thumbs)}
          <h3 class="group-label">Sentiment bar</h3>
          <div class="choice-row">${styleChoice("diverging", "Diverging")}${styleChoice("spectrum", "Spectrum")}</div>
        </section>
        <section class="panel settings-block">
          <h2>For you</h2>
          <p class="muted">Parallax keeps a reading profile in this browser only. Each article or story you open adds weight to its topic, its outlet and the words in its headline, and older reads fade as you read more. Articles you already opened sink to the bottom. Until you open something, For you is shuffled once a day.</p>
          ${switchRow("Learn from what I read", `${plural(ins.reads, "article")} read so far`, "learn", "", profile.learn)}
          <div class="two-col even">
            <div><h3 class="group-label">Top topics</h3>${shares(ins.topics)}</div>
            <div><h3 class="group-label">Top outlets</h3>${shares(ins.sources)}</div>
          </div>
          <button class="outline-btn danger" data-action="reset-history">Reset reading history</button>
        </section>
        ${sourcesBlock()}
        ${desktopBlock()}
        <section class="panel settings-block">
          <h2>About</h2>
          <p class="muted">Parallax${version ? ` ${esc(version)}` : ""}. A perspective aware news reader. Open source under the MIT license.</p>
          <div class="btn-row">
            <a class="outline-btn" href="https://github.com/ishaanman7898/Parallax" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a class="outline-btn" href="#/bias">How ratings work</a>
            <button class="outline-btn danger" data-action="reset-display">Reset display settings</button>
          </div>
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
    renderRoute();
    fitPulseChips();
  }

  function renderRoute() {
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

  const setPref = (key, value) => {
    profile[key] = value;
    saveProfile();
    applyPrefs();
  };
  const setDesktop = (key, value) => desktop?.set(key, value).then((s) => ((state.desktop.settings = s), rerender()));

  const actions = {
    pulse: (v) => (state.pulse = v),
    "aside-side": (v) => (state.asideSide = v),
    side: (v) => ((state.side = v), (state.pageN = 1)),
    region: (v) => ((state.region = v), (state.pageN = 1)),
    more: () => state.pageN++,
    "toggle-topic": (v) => (Prefs.toggleTopic(profile, v), saveProfile()),
    "bar-style": (v) => ((profile.barStyle = v), saveProfile()),
    learn: () => ((profile.learn = !profile.learn), saveProfile()),
    "reset-history": () => {
      if (!confirm("Clear your reading history? For you goes back to a shuffle.")) return;
      Prefs.resetHistory(profile);
      saveProfile();
    },
    "text-size": (v) => setPref("textSize", v),
    "start-page": (v) => setPref("startPage", v),
    "toggle-pref": (v) => setPref(v, !profile[v]),
    "refresh-now": () => (refreshNews(), refreshMarkets()),
    "reset-display": () => {
      if (!confirm("Reset text size, start page, ticker, images and the startup animation to their defaults?")) return;
      Prefs.resetDisplay(profile);
      saveProfile();
      applyPrefs();
    },
    "window-mode": (v) => setDesktop("windowMode", v),
    "auto-update": () => setDesktop("autoUpdate", !state.desktop.settings.autoUpdate),
    "check-update": () => desktop?.checkForUpdates(),
    "download-update": () => desktop?.downloadUpdate(),
    "install-update": () => desktop?.installUpdate(),
    "open-data": () => desktop?.openDataFolder()
  };

  app.addEventListener("mousemove", onChartMove);
  app.addEventListener("mouseout", onChartLeave);

  // Radar dots jump to a slide. The slideshow advances on its own unless the pointer is on it.
  app.addEventListener("click", (e) => {
    const dot = e.target.closest("[data-radar]");
    if (dot) showRadarSlide(Number(dot.dataset.radar));
  });
  setInterval(() => !document.hidden && !document.querySelector(".radar:hover") && showRadarSlide(state.radarSlide + 1), 5000);

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
    if (a && Prefs.recordRead(profile, a)) saveProfile();
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

  // ---------- data refresh ----------
  // The server keeps finding article images after its first response, so while some are
  // still pending the news is fetched again shortly to pick them up.
  let imageTimer = null;
  function applyNews(news) {
    state.news = news;
    indexNews(news);
    updateStatus();
    rerender();
    document.querySelector(".news-pill")?.remove();
    if (news.imagesPending > 0 && !imageTimer) imageTimer = setTimeout(() => ((imageTimer = null), refreshNews()), 10000);
  }

  async function refreshNews() {
    applyNews(await loadNews());
  }

  // A new edition arrived from the server. Near the top of the page it swaps in straight away.
  // Further down, a pill offers the new stories instead of moving the page under the reader.
  async function onNews() {
    const before = new Set(clusters().map((c) => c.id));
    const news = await loadNews();
    if (news.sample) return;
    const fresh = news.clusters.filter((c) => !before.has(c.id)).length;
    if (window.scrollY < 400 || !fresh) return applyNews(news);
    let pill = document.querySelector(".news-pill");
    if (!pill) {
      pill = document.createElement("button");
      pill.className = "news-pill";
      pill.addEventListener("click", () => {
        applyNews(pill.news);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      document.body.appendChild(pill);
    }
    pill.news = news;
    pill.textContent = `↑ ${fresh} new ${fresh === 1 ? "story" : "stories"}`;
  }

  async function refreshMarkets() {
    state.markets = await loadMarkets();
    renderTicker();
    if (parseHash()[0] === "markets") rerender();
    else refreshPulse();
  }

  const setCoins = (coins) => {
    state.coins = coins;
    state.coinMap = new Map(coins.map((c) => [c.coin, c]));
  };

  async function startHyperliquid() {
    try {
      setCoins(await hyperliquid.load());
      const rows = await Promise.all(PULSE_COINS.map((coin) => hyperliquid.candles(coin).catch(() => null)));
      PULSE_COINS.forEach((coin, i) => rows[i]?.length && state.candles.set(coin, rows[i]));
      renderTicker();
      rerender();
      hyperliquid.onUpdate((coins) => {
        setCoins(coins);
        scheduleLive();
      });
      // Keeps each coin chart's latest bar moving and adds a bar every 15 minutes.
      const onCandle = (c) => {
        const list = state.candles.get(c.coin);
        if (!list?.length) return;
        const last = list[list.length - 1];
        if (last.t === c.t) Object.assign(last, c);
        else if (c.t > last.t) {
          list.push(c);
          if (list.length > 96) list.shift();
        }
        scheduleLive();
      };
      PULSE_COINS.forEach((coin) => hyperliquid.watchCandles(coin, onCandle));
      hyperliquid.connect();
      // Funding, open interest, volume and the 24 hour reference price change slowly.
      setInterval(() => hyperliquid.load().then((coins) => {
        setCoins(coins);
        const body = document.getElementById("hl-body");
        if (body) body.innerHTML = hlRows();
        renderTicker();
      }).catch(() => {}), 60 * 1000);
    } catch {
      setCoins([]);
    }
  }

  // ---------- desktop app and updates ----------
  function showUpdateToast(u) {
    if (u.status !== "ready" || state.toastFor === u.version) return;
    state.toastFor = u.version;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `<span>Parallax ${esc(u.version)} is ready to install.</span><button class="filled-btn">Restart now</button><button class="close" aria-label="Dismiss">×</button>`;
    toast.querySelector(".filled-btn").addEventListener("click", () => desktop.installUpdate());
    toast.querySelector(".close").addEventListener("click", () => toast.remove());
    document.body.appendChild(toast);
  }

  async function startDesktop() {
    if (!desktop) return;
    state.desktop = await desktop.info();
    state.update = state.desktop.update;
    showUpdateToast(state.update);
    desktop.onUpdate((u) => {
      state.update = u;
      showUpdateToast(u);
      if (parseHash()[0] === "settings") rerender();
    });
    if (parseHash()[0] === "settings") rerender();
  }

  // ---------- startup ----------
  // The startup screen stays up until the first live news arrives, showing feed progress
  // from the server, then hands over to the page. It plays at least once through.
  const splash = document.getElementById("splash");
  const splashStart = performance.now();
  let splashDone = !profile.splash;
  // Falling light in the logo's blue and red, white-hot at the tips. It starts with the page,
  // before saved settings load, so it is already arriving when the logo slides in.
  let splashLight = window.ParallaxLightfall?.mount(document.getElementById("splash-light"), {
    colors: ["#8ab4f8", "#a8c7fa", "#f28b82", "#ffffff"],
    backgroundColor: "#a8c7fa",
    streakCount: 3,
    backgroundGlow: 0.12,
    glow: 0.8,
    // One pixel per CSS pixel: a quarter of the shading work on a 2x screen, barely visible on soft streaks.
    dpr: 1,
    mouseInteraction: true,
    holdToWarp: true,
    intro: true
  });

  function stopSplashLight() {
    splashLight?.destroy();
    splashLight = null;
  }

  function setSplash(fraction, text) {
    document.getElementById("splash-progress").style.width = `${Math.round(Math.max(0.04, Math.min(1, fraction)) * 100)}%`;
    document.getElementById("splash-status").textContent = text;
  }

  async function watchProgress() {
    while (!splashDone) {
      const p = await loadProgress();
      if (splashDone) return;
      if (p?.phase === "feeds" && p.total) setSplash(0.05 + 0.8 * (p.done / p.total), `Reading ${p.done} of ${p.total} feeds from ${p.sources} outlets`);
      else if (p?.phase === "analyzing") setSplash(0.88, "Comparing perspectives");
      else if (p?.phase === "images") setSplash(0.94, "Finding images");
      await sleep(250);
    }
  }

  function finishSplash() {
    if (splashDone) return;
    splashDone = true;
    setSplash(1, "Ready");
    setTimeout(() => {
      splash.classList.add("done");
      document.body.classList.remove("loading");
      setTimeout(() => {
        splash.classList.add("off");
        stopSplashLight();
      }, 1000);
    }, Math.max(0, 2800 - (performance.now() - splashStart)));
  }

  async function start() {
    // Saved settings from the data folder win over this browser's copy.
    const saved = await loadPrefs();
    if (saved) {
      Object.assign(profile, Prefs.normalize(saved));
      Prefs.save(profile);
    }
    applyPrefs();
    splashDone = !profile.splash;
    if (profile.splash) {
      document.body.classList.add("loading");
      watchProgress();
      setTimeout(finishSplash, 45000);
    } else {
      splash.classList.add("off");
      stopSplashLight();
    }
    if (!location.hash && profile.startPage !== "home" && Prefs.START_PAGES.includes(profile.startPage)) history.replaceState(null, "", `#/${profile.startPage}`);

    updateStatus();
    render();
    refreshNews().finally(finishSplash);
    refreshMarkets().then(() => {
      if (state.markets && !state.markets.sample) openStream({ onQuote, onNews, symbols: state.markets.quotes.map((q) => q.symbol) });
      startHyperliquid();
    });
    loadInfo().then((info) => (state.info = info));
    startDesktop();
    // Live news arrives over the event stream. This slow poll is only a fallback.
    setInterval(refreshNews, 10 * 60 * 1000);
    setInterval(refreshMarkets, 60 * 1000);
  }

  start();
})();
