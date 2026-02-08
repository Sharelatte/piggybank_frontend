// サービスワーカー(PWAアプリとして動かすためのコード)
const CACHE_NAME = "piggybank-v1";

// キャッシュするファイル
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// インストール
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// 有効化
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
});

// fetch
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // APIは Service Worker で触らない
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});