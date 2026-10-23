// Live prices from the Yahoo Finance streamer, relayed to browsers as server-sent events.
// The same event stream also carries named events such as "news" when a new edition is ready.
// The streamer is a public websocket that sends base64 protobuf PricingData messages, one per
// trade, while a market is open. Outside trading hours it is quiet and the page keeps the
// last price from the chart API.
const WebSocketImpl = globalThis.WebSocket || require("ws");

const URL = "wss://streamer.finance.yahoo.com/?version=2";

// Minimal protobuf reader for the PricingData fields we use:
// 1 id (string), 2 price (float), 3 time (sint64 ms), 8 changePercent (float), 12 change (float).
function decodePricing(b64) {
  const buf = Buffer.from(b64, "base64");
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
      if (field === 1) out.id = buf.toString("utf8", i, i + len);
      i += len;
    } else if (wire === 5) {
      const v = buf.readFloatLE(i);
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

function createQuoteStream(symbols, { connect = (url) => new WebSocketImpl(url) } = {}) {
  const clients = new Set();
  const latest = new Map();
  let socket = null;
  let retry = 2000;
  let started = false;

  function broadcast(quote) {
    const line = `data: ${JSON.stringify(quote)}\n\n`;
    for (const res of clients) res.write(line);
  }

  function open() {
    socket = connect(URL);
    socket.onopen = () => {
      retry = 2000;
      socket.send(JSON.stringify({ subscribe: symbols }));
    };
    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const quote = msg.type === "pricing" && msg.message ? decodePricing(msg.message) : null;
      if (!quote) return;
      latest.set(quote.id, quote);
      broadcast(quote);
    };
    socket.onclose = () => {
      socket = null;
      setTimeout(open, retry).unref?.();
      retry = Math.min(retry * 2, 60000);
    };
    socket.onerror = () => socket?.close();
  }

  // Handles GET /api/stream. Sends the latest known prices first, then every update.
  function handle(req, res) {
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write("retry: 5000\n\n");
    for (const q of latest.values()) res.write(`data: ${JSON.stringify(q)}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => {
      clearInterval(ping);
      clients.delete(res);
    });
    if (!started) {
      started = true;
      open();
    }
  }

  // Named events for other live updates, such as a new news edition.
  function send(event, data) {
    const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(line);
  }

  return { handle, send, latest: () => [...latest.values()] };
}

module.exports = { createQuoteStream, decodePricing };
