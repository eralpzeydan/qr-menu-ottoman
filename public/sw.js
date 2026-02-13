const APP_CACHE = 'qrmenu-v1';
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(APP_CACHE).then(c=>c.addAll(['/','/manifest.json'])));
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  const isMenuApi = url.pathname.startsWith('/api/venue/') || (url.pathname==='/api/products' && e.request.method==='GET');
  if (isMenuApi) {
    e.respondWith(
      fetch(e.request)
        .then(res=>{ const clone = res.clone(); caches.open(APP_CACHE).then(c=>c.put(e.request, clone)); return res; })
        .catch(()=> caches.match(e.request))
    );
  }
});
