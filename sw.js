// Service worker: app chạy hoàn toàn offline (wifi tắt). Chỉ cần mạng khi muốn lấy bản mới.
// - Trang app: thử mạng tối đa NET_WAIT ms; có bản mới (200) thì dùng + lưu đè vào cache.
//   Mất mạng / mạng treo / GitHub trả lỗi -> dùng bản đã lưu trong máy, không hiện trang lỗi.
// - Bản lưu luôn nằm ở 1 khoá duy nhất (SHELL) nên offline luôn mở đúng bản mới nhất đã tải.
const CACHE = 'fam-v2';
const SHELL = './index.html';
const PRECACHE = ['./', './index.html', './manifest.webmanifest'];
const NET_WAIT = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(PRECACHE.map((u) =>
      fetch(new Request(u, { cache: 'reload' })).then((r) => {
        if (!r.ok) throw new Error('precache ' + u + ' ' + r.status);   // thiếu bản lưu -> không cài, giữ SW cũ
        return cache.put(u, r);
      })
    ))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.searchParams.has('__build')) return;   // app hỏi "có bản mới không" -> đi thẳng mạng

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req).then((r) => {
        if (r && r.ok && r.type === 'basic') cache.put(SHELL, r.clone());
        return r;
      }).catch(() => null);
      const first = await Promise.race([net, new Promise((res) => setTimeout(res, NET_WAIT, null))]);
      if (first && first.ok) return first;
      const saved = (await cache.match(SHELL)) || (await cache.match(req, { ignoreSearch: true }));
      if (saved) return saved;
      return (await net) || Response.error();   // máy chưa có bản lưu (lần đầu) -> chờ mạng
    })());
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok && r.type === 'basic') { const c = r.clone(); caches.open(CACHE).then((cache) => cache.put(req, c)); }
      return r;
    }))
  );
});
