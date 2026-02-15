// サービスワーカー(PWAアプリとして動かすためのコード)

// TODO: 更新のたびにバージョンを上げること（古いキャッシュを捨てる)
const CACHE_NAME = "piggybank-v2";

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