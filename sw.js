/* SYLAJ-Evidenca 2.0 – service worker
   Online-first: never cache private Supabase data.
   Version bump forces clients to take control of the new SW.
*/
const SW_VERSION = '2026.11.27.5';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Drop any old caches from previous experiments
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  // Pass-through only. Do not cache API or HTML with private data.
  // Browser network stack handles the request.
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.source && event.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
  }
});
self.addEventListener('push',e=>{let p={};try{p=e.data.json()}catch{}e.waitUntil(self.registration.showNotification('SYLAJ – Plan dela',{body:'Keni një plan pune. Hapeni dhe konfirmoni leximin.',data:{id:p.id},tag:'sylaj-plan-'+p.id}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL('./?plan=1',self.registration.scope).href;e.waitUntil(clients.openWindow(url));});
