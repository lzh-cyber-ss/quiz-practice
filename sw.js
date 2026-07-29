const NOT_FOUND_HTML = "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>404</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#fff;color:#222;font:700 56px/1 -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif}</style><main>404</main>";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(Promise.resolve(new Response(NOT_FOUND_HTML, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate" } })));
    return;
  }
  event.respondWith(Promise.resolve(new Response("", { status: 404, headers: { "Cache-Control": "no-store" } })));
});
