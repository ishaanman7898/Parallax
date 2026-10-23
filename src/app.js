(function () {
  const { ticker, pulse, stories } = window.PARALLAX_DATA;
  const app = document.getElementById("app");
  const LEANS = { left: "Lean left", center: "Center", right: "Lean right" };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2) + "%";
  const quote = (sym) => ticker.find((t) => t.symbol === sym);
  const meta = (s) => `${esc(s.desk)} · ${s.minutes} min read`;
  const lean = (s) => (s.lean ? `<div class="lean lean-${s.lean}">${LEANS[s.lean]} · demo</div>` : "");

  function renderTicker() {
    const items = ticker
      .map((t) => `<span class="tick${t.change < 0 ? " down" : ""}"><span>${esc(t.symbol)}</span><b>${fmt(t.price)}</b><span class="chg">${pct(t.change)}</span></span>`)
      .join("") + `<span class="tick-note">/ SAMPLE PRICES</span>`;
    // Doubled so the CSS loop at -50% is seamless.
    document.getElementById("ticker").innerHTML = items + items;
  }

  const storyCard = (s) => `
    <a class="card story" href="#/story/${s.id}">
      <div class="eyebrow">${esc(s.category)}</div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.summary)}</p>
      ${lean(s)}
      <div class="meta">${meta(s)}</div>
    </a>`;

  function pulseCard() {
    const max = Math.max(...pulse.series);
    const bars = pulse.series.map((v) => `<span style="height:${Math.round((v / max) * 100)}%"></span>`).join("");
    const radar = pulse.radar.map(quote).filter(Boolean).map((q) => `
      <li class="${q.change < 0 ? "down" : ""}"><span class="sym">${esc(q.symbol)}</span><span>${fmt(q.price)}</span><span class="chg">${pct(q.change)}</span></li>`).join("");
    const sign = pulse.change >= 0 ? "+" : "−";
    return `
      <aside class="card pulse">
        <div class="pulse-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>
          Market pulse
        </div>
        <div class="eyebrow">Illustrative snapshot · not live</div>
        <div class="pulse-price">${fmt(pulse.price)}</div>
        <div class="pulse-change${pulse.change < 0 ? " down" : ""}">${esc(pulse.symbol)} &nbsp;${sign}${fmt(Math.abs(pulse.change))} (${pct(pulse.changePct)})</div>
        <div class="bars">${bars}</div>
        <div class="oc"><span>OPEN<b>${fmt(pulse.open)}</b></span><span class="close">CLOSE<b>${fmt(pulse.price)}</b></span></div>
        <div class="eyebrow">On the radar</div>
        <ul class="radar">${radar}</ul>
      </aside>`;
  }

  const explainer = `
    <section class="card explainer">
      <p>Perspective describes how a story is framed, not whether it is true. Left, center and right labels here are illustrative editorial examples, not automated analysis or verified source ratings. Open any story to see the framing note.</p>
      <div class="spectrum"><div class="l">LEAN LEFT</div><div class="c">CENTER</div><div class="r">LEAN RIGHT</div></div>
    </section>`;

  function home() {
    const [top, ...rest] = stories;
    app.innerHTML = `
      <div class="page-head">
        <h1>Your daily perspective</h1>
        <input class="search" id="search" type="search" placeholder="Search headlines..." aria-label="Search headlines">
      </div>
      <div class="top">
        <a class="card hero" href="#/story/${top.id}">
          ${top.image ? `<img src="${esc(top.image)}" alt="">` : ""}
          <div class="hero-body">
            <div class="eyebrow">Top story</div>
            <h2>${esc(top.title)}</h2>
            <p>${esc(top.summary)}</p>
            <div class="meta">${meta(top)}</div>
          </div>
        </a>
        ${pulseCard()}
      </div>
      <h2 class="section-label" id="wire-label">Across the wire</h2>
      <div class="grid" id="grid">${rest.map(storyCard).join("")}</div>
      ${explainer}`;

    const grid = document.getElementById("grid");
    const label = document.getElementById("wire-label");
    document.getElementById("search").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      // Search covers every story, including the top one, so results never hide a match.
      const hits = q ? stories.filter((s) => (s.title + " " + s.summary + " " + s.category).toLowerCase().includes(q)) : rest;
      label.textContent = q ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : "Across the wire";
      grid.innerHTML = hits.length ? hits.map(storyCard).join("") : `<p class="empty">No headlines match “${esc(q)}”.</p>`;
    });
  }

  function latest() {
    const sorted = [...stories].sort((a, b) => b.published.localeCompare(a.published));
    const when = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    app.innerHTML = `
      <div class="page-head"><h1>Latest news</h1></div>
      <div class="list">${sorted.map((s) => `
        <a class="card row" href="#/story/${s.id}">
          <time datetime="${s.published}">${when(s.published)}</time>
          <div>
            <div class="eyebrow">${esc(s.category)}</div>
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.summary)}</p>
            <div class="meta">${meta(s)}</div>
          </div>
        </a>`).join("")}
      </div>`;
  }

  function markets() {
    const rows = ticker.map((t) => `
      <tr><td>${esc(t.symbol)}</td><td class="num">${fmt(t.price)}</td><td class="num ${t.change < 0 ? "down" : "up"}">${pct(t.change)}</td></tr>`).join("");
    const related = stories.filter((s) => s.category === "Markets");
    app.innerHTML = `
      <div class="page-head"><h1>Markets</h1></div>
      <div class="top">
        <div class="card"><table class="table">
          <thead><tr><th>Symbol</th><th class="num">Price</th><th class="num">Change</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        ${pulseCard()}
      </div>
      <h2 class="section-label">Markets coverage</h2>
      <div class="grid">${related.map(storyCard).join("")}</div>`;
  }

  function bias() {
    app.innerHTML = `
      <div class="page-head"><h1>Understanding bias</h1></div>
      <div class="prose">
        <p>Every story involves choices. Which fact goes first, whose quote gets the most space and which word describes a policy all shape how a reader sees an event, even when every sentence is accurate.</p>
        <h2>What the labels mean</h2>
        <p><span class="lean-left">Lean left</span> stories emphasize angles more common in left leaning outlets, such as public programs, workers and consumers. <span class="lean-right">Lean right</span> stories emphasize angles more common in right leaning outlets, such as costs, markets and regulation. <span class="lean-center">Center</span> stories present competing views with roughly equal weight.</p>
        <h2>What they do not mean</h2>
        <p>A label is not a fact check. A lean left story can be accurate and a center story can contain mistakes. The labels on Parallax are illustrative editorial examples written for this demo, not ratings produced by an algorithm or an outside organization.</p>
        <h2>How to use them</h2>
        <p>Open a story and read its framing note. It explains what the piece chose to lead with and how the same events might look from another angle.</p>
      </div>
      ${explainer}`;
  }

  function article(id) {
    const s = stories.find((x) => x.id === id);
    if (!s) return notFound();
    app.innerHTML = `
      <article class="article">
        <a class="back" href="#/">← Back to top stories</a>
        <div class="eyebrow">${esc(s.category)}</div>
        <h1>${esc(s.title)}</h1>
        <p class="dek">${esc(s.summary)}</p>
        ${lean(s)}
        <div class="meta">${meta(s)}</div>
        ${s.image ? `<img src="${esc(s.image)}" alt="">` : ""}
        <div class="article-body">${s.body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        <section class="card framing"><h2>Framing note</h2><p>${esc(s.framing)}</p></section>
      </article>`;
  }

  function notFound() {
    app.innerHTML = `<div class="page-head"><h1>Story not found</h1></div><p class="empty"><a href="#/">Return to top stories</a></p>`;
  }

  const routes = { "": home, latest, markets, bias };

  function route() {
    const [name, param] = location.hash.replace(/^#\/?/, "").split("/");
    const active = name || "home";
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === active));
    if (name === "story") article(param);
    else (routes[name] || notFound)();
    window.scrollTo(0, 0);
  }

  renderTicker();
  window.addEventListener("hashchange", route);
  route();
})();
