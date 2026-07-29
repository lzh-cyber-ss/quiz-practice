const RETIRED_HTML = "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>页面已停止使用</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7f8;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#1f292e}.card{margin:24px;padding:36px 28px;border:1px solid #dce3e6;border-radius:18px;background:white;text-align:center}h1{font-size:28px}p{color:#68757c;line-height:1.8}</style><main class=\"card\"><h1>此页面已停止使用</h1><p>原练习页面已经关闭，请不要继续使用或传播此链接。</p></main>";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(Promise.resolve(new Response(RETIRED_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })));
    return;
  }
  event.respondWith(fetch(event.request, { cache: "no-store" }));
});
