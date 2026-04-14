const CACHE_NAME = 'notes-app-shell-v3';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v1';

const ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/content/home.html',
    '/content/about.html',
    '/icons/_previmg.ico',
    '/icons/spirit.ico',
    '/icons/spirit2.ico'
];

// Установка Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Активация Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Перехват запросов
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Пропускаем внешние запросы (CDN)
    if (url.origin !== location.origin) return;
    
    // Динамические страницы (/content/*) → Network First
    if (url.pathname.startsWith('/content/')) {
        event.respondWith(
            fetch(event.request)
                .then(networkRes => {
                    const resClone = networkRes.clone();
                    caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, resClone);
                    });
                    return networkRes;
                })
                .catch(() => 
                    caches.match(event.request)
                        .then(cached => cached || caches.match('/content/home.html'))
                )
        );
        return;
    }
    
    // Статические ресурсы → Cache First
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});

// 🔔 ОБРАБОТЧИК PUSH-УВЕДОМЛЕНИЙ
self.addEventListener('push', event => {
    console.log('[SW] Получено push-уведомление');
    
    let data = { title: 'Новое уведомление', body: '' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: '/icons/spirit2.ico',
        badge: '/icons/spirit.ico',
        vibrate: [200, 100, 200],
        tag: 'notes-app-notification',
        requireInteraction: false
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
    console.log('[SW] Клик по уведомлению');
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});