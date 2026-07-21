self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Minimal fetch listener required by Chrome to trigger "Add to Home Screen" prompt
  // In a real PWA, you'd implement caching strategies here.
});
