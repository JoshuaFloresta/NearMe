import express from 'express';
import dotenv from 'dotenv';
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
import { normalizeProviderGeoLocations } from './geo.js';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const app = express();
const isDeployedRuntime = process.env.NODE_ENV === 'production'
  || Boolean(process.env.VERCEL)
  || Boolean(process.env.RAILWAY_ENVIRONMENT_ID);
const normalizeOrigin = (origin = '') => origin.trim().replace(/\/+$/, '');
export const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(/[\s,]+/)
  .map(normalizeOrigin)
  .filter(Boolean);
const isLocalDevOrigin = (origin = '') => /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/i.test(origin);
export const isAllowedOrigin = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);

  return (
    !normalizedOrigin
    || allowedOrigins.includes('*')
    || allowedOrigins.includes(normalizedOrigin)
    || (!isDeployedRuntime && isLocalDevOrigin(normalizedOrigin))
  );
};

let initializationPromise;

const initializeDatabase = async () => {
  const db = await connectDB();
  await db.collection('services').createIndex({ id: 1 }, { unique: true });
  await seedDatabase(db);
  await normalizeProviderGeoLocations(db);
  await Promise.all([
    db.collection('providers').createIndex({ geoLocation: '2dsphere' }, { sparse: true }),
    db.collection('providers').createIndex({ discoverable: 1, rating: -1, jobs: -1 }),
    db.collection('providers').createIndex({ isDeleted: 1, archivedAt: -1 }),
    db.collection('services').createIndex({ isArchived: 1, archivedAt: -1 }),
    db.collection('users').createIndex({ isDeleted: 1, archivedAt: -1 }),
    db.collection('password_reset_tokens').createIndex({ email: 1, consumed: 1, expiresAt: -1 }),
    db.collection('password_reset_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('otp_verifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('jobs_ledger').createIndex({ status: 1, createdAt: -1 }),
    db.collection('jobs_ledger').createIndex({ clientUserId: 1, providerUserId: 1, createdAt: -1 }),
    db.collection('provider_wallet_ledger').createIndex({ providerObjectId: 1, createdAt: -1 }),
    db.collection('provider_payout_requests').createIndex({ providerUserId: 1, status: 1, createdAt: -1 }),
    db.collection('reports').createIndex({ providerObjectId: 1, status: 1, createdAt: -1 }),
    db.collection('custom_packages').createIndex({ providerId: 1, serviceId: 1, active: 1 }),
    db.collection('provider_services').createIndex({ providerUserId: 1, active: 1, createdAt: -1 }),
  ]);
  return db;
};

export const ensureInitialized = () => {
  if (!initializationPromise) {
    initializationPromise = initializeDatabase().catch((error) => {
      initializationPromise = undefined;
      throw error;
    });
  }

  return initializationPromise;
};

app.use((req, res, next) => {
  const requestOrigin = normalizeOrigin(req.headers.origin);
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

app.use(async (req, res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (error) {
    console.error('API initialization failed:', error);
    res.status(503).json({ error: 'API database initialization failed' });
  }
});

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

export default app;
