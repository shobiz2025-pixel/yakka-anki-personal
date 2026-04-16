const CACHE_NAME = 'yakka-v4';
const APP_SHELL = [
  './',
  './index.html',
  './dashboard.html',
  './export.html',
  './manifest.json',
  './css/style.css',
  './js/store.js',
  './js/app.js',
  './js/dashboard.js',
  './js/qa_parser.js',
  './js/word_export.js',
  './data/r08/data.js',
  './data/r08/qa_text_index.js',
  './js/qa_text_r8_01.js',
  './js/qa_text_r8_02.js',
  './js/qa_text_r8_03.js',
  './js/qa_text_r8_04.js',
  './js/qa_text_r8_05.js',
  './js/qa_text_r8_06.js',
  './js/qa_text_r8_07.js',
  './js/qa_text_r8_08.js',
  './icons/app_logo.png'
];

const SLIDE_CACHE = 'yakka-slides-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== SLIDE_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Slides: cache-first, runtime caching
  if (url.pathname.includes('/slides/')) {
    e.respondWith(
      caches.open(SLIDE_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(resp => {
            if (resp.ok) cache.put(e.request, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }

  // App shell: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
