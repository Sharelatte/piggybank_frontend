// サービスワーカー(PWAアプリとして動かすためのコード)

// TODO: 更新のたびにバージョンを上げること（古いキャッシュを捨てる)

const CACHE_NAME = "piggybank-v4";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(STATIC_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // APIはSWで触らない
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  // HTMLはネット優先（成功したらキャッシュ更新）
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req, { cache: "no-store" }); // ブラウザHTTPキャッシュも避ける
          const cache = await caches.open(CACHE_NAME);
          cache.put("/index.html", res.clone());
          return res;
        } catch {
          return (await caches.match("/index.html")) || Response.error();
        }
      })()
    );
    return;
  }

  // それ以外はキャッシュ優先（なければ取りに行って、ついでに保存）
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      const res = await fetch(req);
      // 200の同一オリジンだけキャッシュ（雑にやると壊れやすいので最低限）
      if (res.ok && url.origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    })()
  );
});