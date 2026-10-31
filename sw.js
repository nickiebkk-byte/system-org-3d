// Keeps the app usable offline after the first visit.
const CACHE='flexi-organize-3d-v4';
const SHELL=['./','./index.html','./theme-blue-workspace.css','./manifest.webmanifest','./favicon.ico',
  './icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png',
  ...['basket-s','basket-d','peg','wire','flat','mel','slide-1','slide-2','br-2','br-1','brh-2','brh-1','rack','rod','track','rail'].map(n=>'./photos/'+n+'.jpg')];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url);
  const lib=/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if(url.origin!==location.origin && !lib) return;
  // pages: network first so updates show up; libraries & icons: cache first
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));return r}).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok||r.type==='opaque'){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c))}return r})));
});
