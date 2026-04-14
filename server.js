const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// 🔑 
const vapidKeys = {
  publicKey: 'BO2hLT8tqI-mI1jRm_dqGaga3gTqmjw1kHUriYrBx3DPeuIHqcXhyXSEp_xwNe5-wBksB5VInt-iinFJe9q0AZI',
  privateKey: '1CsOqwHBkmj__GwqVDs59_hjghihsx26bknwZUDedIM'
};

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Раздача статических файлов
app.use(express.static(path.join(__dirname)));

// Хранилище подписок
let subscriptions = [];

// Создание HTTP-сервера и Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Обработка WebSocket-подключений
io.on('connection', (socket) => {
  console.log('Клиент подключён:', socket.id);

  socket.on('newTask', (task) => {
    console.log('Новая задача:', task);
    
    // Рассылаем событие всем клиентам
    io.emit('taskAdded', task);

    // Отправляем push-уведомления
    const payload = JSON.stringify({
      title: 'Новая задача',
      body: task.text || 'Добавлена новая заметка'
    });

    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload)
        .catch(err => console.error('Push error:', err));
    });
  });

  socket.on('disconnect', () => {
    console.log('Клиент отключён:', socket.id);
  });
});

// Эндпоинты для push-подписок
app.post('/subscribe', (req, res) => {
  subscriptions.push(req.body);
  console.log('Новая подписка. Всего:', subscriptions.length);
  res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
  console.log('Подписка удалена. Осталось:', subscriptions.length);
  res.status(200).json({ message: 'Подписка удалена' });
});

// Запуск сервера
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
  console.log(`📡 WebSocket готов к работе`);
});