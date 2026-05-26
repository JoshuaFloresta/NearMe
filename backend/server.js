import { createServer } from 'http';
import { Server } from 'socket.io';
import app, { ensureInitialized, isAllowedOrigin } from './app.js';
import { attachRealtime } from './realtime.js';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

attachRealtime(io);

io.on('connection', (socket) => {
  socket.on('join:user', (userId) => {
    if (userId) socket.join(`user:${userId}`);
  });
  socket.on('join:role', (role) => {
    if (role) socket.join(`role:${String(role).toLowerCase()}`);
  });

  socket.on('join:conversation', (conversationId) => {
    if (conversationId) socket.join(`conversation:${conversationId}`);
  });

  socket.on('typing', (payload) => {
    if (payload?.conversationId) {
      socket.to(`conversation:${payload.conversationId}`).emit('typing', payload);
    }
  });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing backend process or set PORT to another value.`);
    process.exit(1);
  }

  console.error('Server failed to listen:', error);
  process.exit(1);
});

ensureInitialized()
  .then(() => {
    httpServer.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));
  })
  .catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
