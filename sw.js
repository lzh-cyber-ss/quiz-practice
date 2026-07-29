const CACHE_NAME = "software-quiz-faithful50";
const ASSETS = [
  "./",
  "./index.html?v=faithful50",
  "./styles.css?v=faithful50",
  "./data.js?v=faithful50",
  "./hardware-data.js?v=faithful50",
  "./security-data.js?v=faithful50",
  "./moodle-security-data.js?v=faithful50",
  "./app.js?v=faithful50",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/security/security-02-q03-1.png",
  "./assets/security/security-03-q07-1.png",
  "./assets/security/security-05-q09-1.png",
  "./assets/security/security-07-q02-1.png",
  "./assets/security/security-07-q04-1.png",
  "./assets/security/security-10-q04-1.png",
  "./assets/security/security-10-q07-1.png",
  "./assets/security/security-16-q02-1.png",
  "./assets/security/security-17-q01-1.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
