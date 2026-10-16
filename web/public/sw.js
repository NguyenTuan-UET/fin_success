// Service worker tối giản: chỉ lưu vỏ ứng dụng (tệp tĩnh của Next) để mở nhanh và báo "đang ngoại tuyến" khi mất mạng.
// KHÔNG lưu /api và /v1: dữ liệu doanh nghiệp luôn lấy mới từ máy chủ, không nằm trong bộ nhớ đệm của trình duyệt.
const CACHE = "fcc-shell-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add("/offline.html")));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/v1/")) return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (u.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) ?? fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })));
  }
});
