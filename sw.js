// Streak Lab service worker: lets the installed app open offline.
// Pages load network-first so updates arrive; everything else is served from cache when possible.
const V='streaklab-v10';
const SHELL=['./','index.html','portals.html','pulse.html','flow.html','living.js','living.css','engine.js','worker.js','manifest.webmanifest','icons/favicon.svg','icons/favicon-32.png','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png'];
const CDN=/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net\/npm\/(@mediapipe\/|heic2any@)|storage\.googleapis\.com\/mediapipe-models\/)/;
const put=(req,res)=>caches.open(V).then(c=>c.put(req,res)).catch(()=>{});
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    if(r.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('.html')){
      e.respondWith(fetch(r).then(res=>{if(res.ok)put(r,res.clone());return res})
        .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./'))));
      return}
    e.respondWith(caches.match(r).then(m=>{const net=fetch(r).then(res=>{if(res.ok)put(r,res.clone());return res}).catch(()=>m);return m||net}));
    return}
  if(CDN.test(r.url))e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok||res.type==='opaque')put(r,res.clone());return res})));
});
