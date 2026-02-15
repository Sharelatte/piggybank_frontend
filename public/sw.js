// サービスワーカー(PWAアプリとして動かすためのコード)

// TODO: 更新のたびにバージョンを上げること（古いキャッシュを捨てる)
const CACHE_NAME = "piggybank-v3";

// キャッシュするファイル
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// fetch
self.addEventListener("fetch", (event) => {

  const req = event.request;
  const url = new URL(event.request.url);

  // APIは Service Worker で触らない
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }
  
  // ★HTML(ナビゲーション)はネット優先
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }
  
  // それ以外はキャッシュ優先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(req);
    })
  );
});