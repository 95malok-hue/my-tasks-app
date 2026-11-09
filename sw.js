const CACHE="tasks-shell-v1";
const ASSETS=["./","./index.html","./styles.css","./config.js","./manifest.webmanifest"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const u=new URL(e.request.url);if(u.origin===location.origin)e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));});