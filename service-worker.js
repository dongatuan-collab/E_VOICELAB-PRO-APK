/**
 * VOICE LAB — Service Worker
 * --------------------------
 * QUAN TRỌNG: mỗi khi cập nhật app.html (thêm tính năng, sửa nội dung...),
 * hãy TĂNG số phiên bản CACHE_VERSION bên dưới lên 1 đơn vị, rồi upload lại
 * file này cùng lúc với file HTML mới. Nếu không tăng version, máy của SV/GV
 * đã cài PWA sẽ tiếp tục dùng bản CŨ đã lưu trong cache, không thấy được
 * bản cập nhật cho tới khi họ tự gỡ cài đặt.
 */
const CACHE_VERSION = 'v4';
const CACHE_NAME = 'voicelab-cache-' + CACHE_VERSION;

// Đường dẫn app shell cần cache để chạy được khi mất mạng.
// Nếu đổi tên file HTML chính khi triển khai (vd. đổi thành index.html),
// hãy sửa lại đường dẫn tương ứng trong danh sách này.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll sẽ thất bại toàn bộ nếu 1 đường dẫn lỗi 404 -> dùng từng cái,
      // bỏ qua đường dẫn nào không tồn tại thay vì làm hỏng cả cài đặt.
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch(() => {
            /* bỏ qua nếu file này không tồn tại ở vị trí đó, không chặn cài đặt */
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith('voicelab-cache-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Không cache các lệnh gọi tới Google Apps Script (log điểm, dashboard, xác thực MSSV)
  // — những dữ liệu này luôn cần lấy mới, không được phục vụ từ cache offline.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return; // để trình duyệt tự xử lý bình thường (network)
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached); // mất mạng -> dùng bản đã cache nếu có

      // Ưu tiên trả cache ngay (nhanh, chạy được offline), đồng thời âm thầm
      // cập nhật cache mới ở nền cho lần mở sau.
      return cached || network;
    })
  );
});
