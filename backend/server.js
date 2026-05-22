import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB, getDB } from './mongoConnect.js';
import authRoutes from './auth.js';
import providerRoutes from './routes/providers.js';
import bookingRoutes from './routes/bookings.js';
import messageRoutes from './routes/messages.js';
import kycRoutes from './routes/kyc.js';
import { seedDatabase } from './seed.js';
import { attachRealtime } from './realtime.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH'],
  },
});

attachRealtime(io);

io.on('connection', (socket) => {
  socket.on('join:user', (userId) => {
    if (userId) socket.join(`user:${userId}`);
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

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CLIENT_ORIGIN || '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'NearMe API' });
});

app.use('/api/auth', authRoutes);
app.use('/api', providerRoutes);
app.use('/api', bookingRoutes);
app.use('/api', messageRoutes);
app.use('/api', kycRoutes);

app.get('/api/test', async (req, res) => {
  try {
    const db = getDB();
    res.json({
      success: true,
      message: 'MongoDB is working!',
      database: db.databaseName,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async (db) => {
    await seedDatabase(db);
    await db.collection('providers').createIndex({ coordinates: '2dsphere' }, { sparse: true });
    httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
