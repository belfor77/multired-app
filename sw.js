const CACHE_NAME = 'multired-v1';
const urlsToCache = [
  './index.html',
  './styles.css',
  './app.js',
  './apple-touch-icon.jpg'
];

// Instala la app y guarda los archivos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Intercepta las peticiones (hace que cargue más rápido o sin internet)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});