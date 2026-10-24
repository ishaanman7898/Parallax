// Data layer: the Parallax API when a server is running, sample data otherwise,
// and Hyperliquid straight from the browser (public, keyless, CORS enabled).
(function () {
  const HL_INFO = "https://api.hyperliquid.xyz/info";
  const HL_WS = "wss://api.hyperliquid.xyz/ws";
  const YAHOO_WS = "wss://streamer.finance.yahoo.com/?version=2";

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
  // prices, "news" events announce a new news edition. The website has no server stream, so
  // there the page opens the Yahoo streamer itself and checks for new editions every minute.
  function openStream({ onQuote, onNews, symbols }) {
    let direct = false;
    const goDirect = () => {
      if (direct) return;
      direct = true;
      yahooStream(symbols, onQuote);
      watchEditions(onNews);
    };
    if (!("EventSource" in window)) return goDirect();
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
    // A refused stream closes for good, while a dropped one keeps reconnecting by itself.
    source.onerror = () => source.readyState === EventSource.CLOSED && goDirect();
  }

  // The Yahoo Finance streamer sends base64 protobuf PricingData messages. Same reader as
  // server/stream.js, on browser types: 1 id, 2 price, 3 time (sint64 ms), 8 change %, 12 change.
  function decodePricing(b64) {
    const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const view = new DataView(buf.buffer);
    let i = 0;
    const varint = () => {
      let result = 0n;
      let shift = 0n;
      let byte;
      do {
        byte = buf[i++];
        result |= BigInt(byte & 0x7f) << shift;
        shift += 7n;
      } while (byte & 0x80 && i < buf.length);
      return result;
    };
    const out = {};
    while (i < buf.length) {
      const key = Number(varint());
      const field = key >> 3;
      const wire = key & 7;
      if (wire === 0) {
        const v = varint();
        if (field === 3) out.time = Number((v >> 1n) ^ -(v & 1n));
      } else if (wire === 1) {
        i += 8;
      } else if (wire === 2) {
        const len = Number(varint());
        if (field === 1) out.id = new TextDecoder().decode(buf.subarray(i, i + len));
        i += len;
      } else if (wire === 5) {
        const v = view.getFloat32(i, true);
        i += 4;
        if (field === 2) out.price = v;
        else if (field === 8) out.changePct = v;
        else if (field === 12) out.change = v;
      } else {
        break;
      }
    }
    return out.id && out.price != null ? out : null;
  }

  function yahooStream(symbols, onQuote) {
    if (!symbols?.length) return;
    let retry = 2000;
    const open = () => {
      const ws = new WebSocket(YAHOO_WS);
      ws.onopen = () => {
        retry = 2000;
        ws.send(JSON.stringify({ subscribe: symbols }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const quote = msg.type === "pricing" && msg.message ? decodePricing(msg.message) : null;
          if (quote) onQuote(quote);
        } catch {
          // Ignore malformed messages.
        }
      };
      ws.onclose = () => {
        setTimeout(open, retry);
        retry = Math.min(retry * 2, 60000);
      };
      ws.onerror = () => ws.close();
    };
    open();
  }

  // Polls the small edition record and announces a newer edition, skipping hidden tabs.
  function watchEditions(onNews) {
    let last = null;
    const check = async () => {
      if (document.hidden) return;
      const edition = await getJson("api/edition").catch(() => null);
      if (!edition?.updated) return;
      if (last && edition.updated !== last) onNews(edition);
      last = edition.updated;
    };
    check();
    setInterval(check, 60 * 1000);
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
