const CACHE_NAME = 'notes-cache-v2';

const ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json', 
    
    // Иконки 
    'icons/_previmg.ico',
    'icons/spirit.ico',
    'icons/spirit2.ico'
];

// 1. Установка 
// Кэшируем все указанные файлы при первой установке SW
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Кэширование ресурсов:', ASSETS);
                return cache.addAll(ASSETS);
            })
            // Заставляем новый Service Worker активироваться сразу, не дожидаясь закрытия вкладок
            .then(() => self.skipWaiting())
    );
});

// 2. Активация 
// Удаляем старые кэши , чтобы не занимать место
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME) // Оставляем только текущий кэш
                    .map(key => {
                        console.log('Удаление старого кэша:', key);
                        return caches.delete(key);
                    })
            );
        })
    );
});

// 3. Перехват запросов (Fetch)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response; // Возвращаем из кэша
                }
                return fetch(event.request); 
            })
    );
});