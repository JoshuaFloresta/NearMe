import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { connectDB, getDB } from './mongoConnect.js';
import authRoutes from './auth.js';
import adminRoutes from './routes/admin.js';
import providerRoutes from './routes/providers.js';
import bookingRoutes from './routes/bookings.js';
import jobsRoutes from './routes/jobs.js';
import messageRoutes from './routes/messages.js';
import kycRoutes from './routes/kyc.js';
import uploadRoutes from './routes/uploads.js';
import { seedDatabase } from './seed.js';
import { attachRealtime } from './realtime.js';
import { normalizeProviderGeoLocations } from './geo.js';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const app = express();
const httpServer = createServer(app);
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isLocalDevOrigin = (origin = '') => /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/i.test(origin);
const isAllowedOrigin = (origin) => (
  !origin
  || allowedOrigins.includes('*')
  || allowedOrigins.includes(origin)
  || (process.env.NODE_ENV !== 'production' && isLocalDevOrigin(origin))
);

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

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const corsOrigin = isAllowedOrigin(requestOrigin) && requestOrigin
    ? requestOrigin
    : allowedOrigins[0] || '*';

  res.header('Access-Control-Allow-Origin', corsOrigin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Admin-Role, X-Admin-User-Id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'NearMe API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', providerRoutes);
app.use('/api', bookingRoutes);
app.use('/api', jobsRoutes);
app.use('/api', messageRoutes);
app.use('/api', kycRoutes);
app.use('/api', uploadRoutes);

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

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing backend process or set PORT to another value.`);
    process.exit(1);
  }

  console.error('Server failed to listen:', error);
  process.exit(1);
});

connectDB()
  .then(async (db) => {
    await seedDatabase(db);
    await normalizeProviderGeoLocations(db);
    await db.collection('providers').createIndex({ geoLocation: '2dsphere' }, { sparse: true });
    await db.collection('providers').createIndex({ discoverable: 1, rating: -1, jobs: -1 });
    await db.collection('providers').createIndex({ isDeleted: 1, archivedAt: -1 });
    await db.collection('services').createIndex({ id: 1 }, { unique: true });
    await db.collection('services').createIndex({ isArchived: 1, archivedAt: -1 });
    await db.collection('users').createIndex({ isDeleted: 1, archivedAt: -1 });
    await db.collection('password_reset_tokens').createIndex({ email: 1, consumed: 1, expiresAt: -1 });
    await db.collection('password_reset_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection('otp_verifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection('jobs_ledger').createIndex({ status: 1, createdAt: -1 });
    await db.collection('jobs_ledger').createIndex({ clientUserId: 1, providerUserId: 1, createdAt: -1 });
    await db.collection('provider_wallet_ledger').createIndex({ providerObjectId: 1, createdAt: -1 });
    await db.collection('provider_payout_requests').createIndex({ providerUserId: 1, status: 1, createdAt: -1 });
    await db.collection('reports').createIndex({ providerObjectId: 1, status: 1, createdAt: -1 });
    await db.collection('custom_packages').createIndex({ providerId: 1, serviceId: 1, active: 1 });
    await db.collection('provider_services').createIndex({ providerUserId: 1, active: 1, createdAt: -1 });
    httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
