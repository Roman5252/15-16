// ==================== ПОДКЛЮЧЕНИЕ К WEBSOCKET ====================
const socket = io('http://localhost:3001');

// ==================== ЭЛЕМЕНТЫ DOM ====================
const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');
const enableBtn = document.getElementById('enable-push');
const disableBtn = document.getElementById('disable-push');

// ==================== НАВИГАЦИЯ ====================
function setActiveButton(activeId) {
    [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

async function loadContent(page) {
    try {
        const response = await fetch(`/content/${page}.html`);
        if (!response.ok) throw new Error('Файл не найден');
        const html = await response.text();
        contentDiv.innerHTML = html;
        
        // Инициализируем заметки ТОЛЬКО для главной страницы
        if (page === 'home') {
            setTimeout(initNotes, 100); // Небольшая задержка для гарантии загрузки DOM
        }
    } catch (err) {
        console.error('Ошибка загрузки контента:', err);
        contentDiv.innerHTML = `<p class="is-center text-error">Ошибка загрузки страницы</p>`;
    }
}

// Обработчики кнопок навигации
if (homeBtn) {
    homeBtn.addEventListener('click', () => {
        setActiveButton('home-btn');
        loadContent('home');
    });
}

if (aboutBtn) {
    aboutBtn.addEventListener('click', () => {
        setActiveButton('about-btn');
        loadContent('about');
    });
}

// Загружаем главную страницу при старте
loadContent('home');

// ==================== ФУНКЦИОНАЛ ЗАМЕТОК ====================
function initNotes() {
    const form = document.getElementById('note-form');
    const input = document.getElementById('note-input');
    const list = document.getElementById('notes-list');
    
    // Если формы нет, выходим
    if (!form || !input || !list) {
        console.log('Элементы формы не найдены');
        return;
    }
    
    function loadNotes() {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        if (notes.length === 0) {
            list.innerHTML = '<li class="is-muted is-center card">Заметок пока нет</li>';
        } else {
            list.innerHTML = notes.map(note => `
                <li class="card" style="margin-bottom: 0.5rem; padding: 0.8rem;">
                    ${note.text || note}
                </li>
            `).join('');
        }
    }
    
    function addNote(text) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        notes.push({ text, timestamp: Date.now() });
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        
        // Отправляем через WebSocket
        socket.emit('newTask', { text, timestamp: Date.now() });
    }
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
            addNote(text);
            input.value = '';
        }
    });
    
    loadNotes();
    console.log('Заметки инициализированы');
}

// ==================== WEBSOCKET ====================
socket.on('taskAdded', (task) => {
    console.log('Получено от сервера:', task);
    
    // Показываем всплывающее уведомление
    const notification = document.createElement('div');
    notification.textContent = `Новая задача: ${task.text}`;
    notification.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #4285f4;
        color: white;
        padding: 1rem;
        border-radius: 5px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
    
    // Обновляем список, если мы на главной
    if (document.querySelector('#notes-list')) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const exists = notes.some(n => n.timestamp === task.timestamp);
        if (!exists) {
            notes.push(task);
            localStorage.setItem('notes', JSON.stringify(notes));
            initNotes();
        }
    }
});

// ==================== PUSH NOTIFICATIONS ====================
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function subscribeToPush() {
    // 🔑
    const VAPID_PUBLIC_KEY = 'BO2hLT8tqI-mI1jRm_dqGaga3gTqmjw1kHUriYrBx3DPeuIHqcXhyXSEp_xwNe5-wBksB5VInt-iinFJe9q0AZI';
    
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    await fetch('http://localhost:3001/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
    });
    console.log('✅ Подписка отправлена');
}

async function unsubscribeFromPush() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
        await fetch('http://localhost:3001/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
        console.log('✅ Отписка выполнена');
    }
}

// ==================== РЕГИСТРАЦИЯ SW И КНОПОК ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ SW зарегистрирован');
            
            if (enableBtn && disableBtn) {
                const subscription = await reg.pushManager.getSubscription();
                
                if (subscription) {
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                }
                
                enableBtn.addEventListener('click', async () => {
                    if (Notification.permission === 'denied') {
                        alert('Уведомления запрещены в настройках');
                        return;
                    }
                    if (Notification.permission === 'default') {
                        const permission = await Notification.requestPermission();
                        if (permission !== 'granted') {
                            alert('Нужно разрешить уведомления');
                            return;
                        }
                    }
                    await subscribeToPush();
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                });
                
                disableBtn.addEventListener('click', async () => {
                    await unsubscribeFromPush();
                    disableBtn.style.display = 'none';
                    enableBtn.style.display = 'inline-block';
                });
            }
        } catch (err) {
            console.error('❌ Ошибка SW:', err);
        }
    });
}