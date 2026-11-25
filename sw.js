// Mon Budget — service worker : fonctionnement hors ligne
const V = 'mon-budget-v11';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(V).then(c => c.put(req, cp)); } return res; };
const isHtml = res => res && res.ok && (res.headers.get('content-type') || '').includes('text/html');

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  // Page de l'application uniquement (pas les autres fichiers ouverts directement)
  if (r.mode === 'navigate') {
    const scope = new URL(self.registration.scope);
    const isApp = u.origin === scope.origin && (u.pathname === scope.pathname || u.pathname === scope.pathname + 'index.html');
    if (!isApp) return;
    e.respondWith((async () => {
      const cached = await caches.match('./index.html');
      const net = fetch(r.url, { cache: 'no-cache' }).then(res => { if (isHtml(res)) put('./index.html', res); return res; });
      if (!cached) return net;
      return Promise.race([net.catch(() => cached), new Promise(ok => setTimeout(() => ok(cached), 2500))]);
    })());
    return;
  }

  // Fichiers de l'application, polices et bibliothèque Firebase : cache d'abord
  if (u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname) || (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/'))) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => put(r, res))));
  }
});
