const CACHE = 'alerta-urbana-v1';
const ARCHIVOS = ['./', './index.html', './style.css', './script.js', './manifest.json', './icon.svg'];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('alerta-urbana-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).catch(error => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        throw error;
    })));
});
