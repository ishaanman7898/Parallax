// Data layer: the Parallax API when a server is running, sample data otherwise,
// and Hyperliquid straight from the browser (public, keyless, CORS enabled).
(function () {
  const HL_INFO = "https://api.hyperliquid.xyz/info";
  const HL_WS = "wss://api.hyperliquid.xyz/ws";

  async function getJson(url, options) {
    const res = await fetch(url, { cache: "no-store", ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  const hlPost = (body) => getJson(HL_INFO, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  async function loadNews() {
    try {
      const data = await getJson("api/news");
      if (!data.clusters?.length) throw new Error("empty");
      return data;
    } catch {
      return window.PARALLAX_SAMPLE.news;
    }
  }

  async function loadMarkets() {
    try {
      return await getJson("api/markets");
    } catch {
      return window.PARALLAX_SAMPLE.markets;
    }
  }

  // Feed loading progress for the startup screen, and app info. Both are null without a server.
  const loadProgress = () => getJson("api/progress").catch(() => null);
  const loadInfo = () => getJson("api/info").catch(() => null);

  // Settings saved by the server in its data folder. Null when the server does not keep them,
  // as with the plain website, where the browser's local storage is used instead.
  async function loadPrefs() {
    try {
      const res = await fetch("api/prefs", { cache: "no-store" });
      return res.status === 200 ? await res.json() : null;
    } catch {
      return null;
    }
  }

  const savePrefs = (prefs) =>
    fetch("api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) }).catch(() => {});

  // Server-sent events from the Parallax server: unnamed events are live Yahoo Finance
  // prices, "news" events announce a new news edition.
  function openStream({ onQuote, onNews }) {
    if (!("EventSource" in window)) return;
    const source = new EventSource("api/stream");
    const parse = (fn) => (event) => {
      try {
        fn(JSON.parse(event.data));
      } catch {
        // Ignore malformed events.
      }
    };
    source.onmessage = parse(onQuote);
    source.addEventListener("news", parse(onNews));
  }

  const coins = new Map();
  const listeners = new Set();
  const candleListeners = new Set();
  const candleCoins = new Set();
  let socket = null;
  let retry = 1000;
  let notifyTimer = null;

  const list = () => [...coins.values()].sort((a, b) => b.volume - a.volume);

  async function loadHyperliquid() {
    const [meta, ctxs] = await hlPost({ type: "metaAndAssetCtxs" });
    meta.universe.forEach((u, i) => {
      const c = ctxs[i];
      if (!c || u.isDelisted) return;
      const price = Number(c.midPx ?? c.markPx);
      coins.set(u.name, {
        coin: u.name,
        price,
        prev: Number(c.prevDayPx),
        funding: Number(c.funding),
        openInterest: Number(c.openInterest) * Number(c.markPx),
        volume: Number(c.dayNtlVlm)
      });
    });
    return list();
  }

  async function candles(coin, hours = 24) {
    const endTime = Date.now();
    const rows = await hlPost({ type: "candleSnapshot", req: { coin, interval: "15m", startTime: endTime - hours * 36e5, endTime } });
    return rows.map((r) => ({ t: r.t, open: Number(r.o), close: Number(r.c) }));
  }

  // Batches websocket ticks into at most two UI updates per second.
  function notify() {
    if (notifyTimer) return;
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      listeners.forEach((fn) => fn(list()));
    }, 500);
  }

  function connect() {
    if (socket || !("WebSocket" in window)) return;
    socket = new WebSocket(HL_WS);
    let ping = null;
    socket.onopen = () => {
      retry = 1000;
      socket.send(JSON.stringify({ method: "subscribe", subscription: { type: "allMids" } }));
      candleCoins.forEach((coin) => socket.send(JSON.stringify({ method: "subscribe", subscription: { type: "candle", coin, interval: "15m" } })));
      ping = setInterval(() => socket.readyState === 1 && socket.send(JSON.stringify({ method: "ping" })), 50000);
    };
    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.channel === "candle") {
        const c = msg.data;
        candleListeners.forEach((fn) => fn({ coin: c.s, t: c.t, open: Number(c.o), close: Number(c.c) }));
        return;
      }
      if (msg.channel !== "allMids") return;
      for (const [coin, mid] of Object.entries(msg.data.mids)) {
        const c = coins.get(coin);
        if (c) c.price = Number(mid);
      }
      notify();
    };
    socket.onclose = () => {
      clearInterval(ping);
      socket = null;
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 60000);
    };
    socket.onerror = () => socket && socket.close();
  }

  // Streams 15 minute candles for a coin over the same socket.
  function watchCandles(coin, fn) {
    candleCoins.add(coin);
    candleListeners.add(fn);
    if (socket?.readyState === 1) socket.send(JSON.stringify({ method: "subscribe", subscription: { type: "candle", coin, interval: "15m" } }));
  }

  window.ParallaxData = {
    loadNews,
    loadMarkets,
    loadProgress,
    loadInfo,
    loadPrefs,
    savePrefs,
    openStream,
    hyperliquid: { load: loadHyperliquid, list, candles, connect, watchCandles, onUpdate: (fn) => listeners.add(fn) }
  };
})();
