'use strict';

const CACHE = 'srv-v1';

const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './css/fonts.css',
    './js/app.js',
    './manifest.webmanifest',
    './fonts/mitr-400-thai.woff2',
    './fonts/mitr-400-latin.woff2',
    './fonts/mitr-500-thai.woff2',
    './fonts/mitr-500-latin.woff2',
    './fonts/mitr-600-thai.woff2',
    './fonts/mitr-600-latin.woff2',
    './fonts/mitr-700-thai.woff2',
    './fonts/mitr-700-latin.woff2',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Cache-first: เปิดใช้งานออฟไลน์ได้เต็มรูปแบบ ของใหม่ค่อยอัปเดตตอนเปลี่ยนเวอร์ชันแคช
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(
            (cached) =>
                cached ||
                fetch(event.request).then((res) => {
                    if (res.ok && new URL(event.request.url).origin === self.location.origin) {
                        const copy = res.clone();
                        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
                    }
                    return res;
                })
        )
    );
});
