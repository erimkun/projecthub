const CACHE_NAME = 'ph-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// A dummy fetch handler to satisfy Chrome's PWA criteria
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    // Just a placeholder to ensure the SW is considered "active"
  }
});