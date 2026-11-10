// Service Worker des Ausbildungsportals.
// Er speichert bewusst KEINE Inhalte der Anwendung (keine Berichte, keine Pläne) – alles kommt frisch vom Server.
// Einzige Aufgabe: ohne Verbindung eine verständliche Seite zeigen, statt der Fehlermeldung des Browsers.
const SPEICHER = 'ausbildungsportal-offline-1';
const DATEIEN = ['/offline.html', '/offline.css', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SPEICHER).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== SPEICHER).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  // nur Seitenaufrufe; API und Dateien gehen unverändert ans Netz
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).catch(() => caches.match('/offline.html')));
  } else if (DATEIEN.includes(new URL(r.url).pathname)) {
    e.respondWith(fetch(r).catch(() => caches.match(r)));
  }
});
