const CACHE_NAME = 'consulta-preco-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './logo-icon.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './favicon-16.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', (event) => {
  // Cada arquivo é guardado separadamente: se um faltar no repositório,
  // os outros continuam sendo guardados para uso offline.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {}))))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Resumo do livro (Google Books) é dinâmico: sempre tenta a rede primeiro.
  if (req.url.includes('googleapis.com')) {
    event.respondWith(
      fetch(req).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Remessas (remessa.json … remessa10.json), guia de resumos e qualquer outro
  // .json publicado no GitHub mudam com frequência: rede primeiro, cache só como
  // reserva se o celular estiver offline. Arquivo que nunca existiu devolve 404.
  const ehDados = (/\.json(\?|#|$)/i.test(req.url) && !/manifest\.json/i.test(req.url))
    || req.url.includes('api.github.com')
    || req.url.includes('githubusercontent.com');
  if (ehDados) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return resp;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || new Response('', { status: 404 }))
        )
    );
    return;
  }

  // App shell e biblioteca de leitura: cache-first, atualizando em segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
