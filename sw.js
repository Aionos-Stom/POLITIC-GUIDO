/* =========================================================
   GUIDO — Service Worker
   Versión: 1.0 · Gestión Territorial República Dominicana
   ========================================================= */

const CACHE_NAME = 'guido-v7-deteccion-acceso';
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');

const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/styles.css',
  BASE + '/globe.css',
  BASE + '/globe.js',
  BASE + '/territory-core.js',
  BASE + '/territory-map.js',
  BASE + '/data-api-client.js?v=7',
  BASE + '/protected-auth.js',
  BASE + '/script.js',
  BASE + '/audit.js',
  BASE + '/ui.js',
  BASE + '/exportXLS_plantilla.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon.svg',
  BASE + '/assets/fonts/manrope-variable.ttf',
  BASE + '/assets/data/mundo.json',
  BASE + '/assets/data/provincias.json',
];

// Instalación: pre-cachear todos los assets
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

// Activación: eliminar versiones de cache antiguas
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.startsWith('guido-') && k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// Fetch: Network-first para HTML, Cache-first para assets
self.addEventListener('fetch', function (e) {
  var req = e.request;

  // Solo manejar peticiones GET del mismo origin
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE + '/')) return;

  // HTML: network-first (para recibir actualizaciones)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .catch(function () {
          return caches.match(BASE + '/index.html');
        })
    );
    return;
  }

  // Assets: cache-first (carga instantánea)
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (response) {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
        return response;
      });
    })
  );
});
