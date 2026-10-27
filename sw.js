// Centro de Control — funciona sin conexión.
// Sirve los archivos guardados y, si hay internet, se trae la versión nueva para la próxima vez.
const VERSION = 'centro-v1';
const ARCHIVOS = ['./', './index.html', './app.css', './centro.css', './base.js', './datos.js', './comun.js', './lector-excel.js', './v-inicio.js', './v-libros.js', './v-kdp.js',
  './v-ingresos.js', './v-gastos.js', './v-impuestos.js', './v-informe.js', './v-ajustes.js', './google.js', './arranque.js',
  './manifest.webmanifest', './iconos/32.png', './iconos/180.png', './iconos/192.png', './iconos/512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const guardada = await c.match(e.request, { ignoreSearch: true });
    const red = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return guardada || (await red) || c.match('./index.html');
  }));
});
