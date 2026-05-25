import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../mongoConnect.js';
import { addGeoLocation } from '../geo.js';
import { emitAlert } from '../realtime.js';
import { requireAdmin, publicUser } from '../security.js';

const router = express.Router();

router.use(requireAdmin);

const parseId = (id) => {
  const numericId = Number(id);
  if (Number.isInteger(numericId)) return { id: numericId };
  if (ObjectId.isValid(id)) return { _id: new ObjectId(id) };
  return null;
};

const toArray = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const money = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH')}`;

const allowedBookingStatuses = [
  'requested',
  'provider_accepted',
  'customer_confirmed',
  'in_progress',
  'completed',
  'reviewed',
  'cancelled',
];

const normalizeProviderUpdate = (body) => {
  const update = {};

  if (body.name !== undefined) update.name = String(body.name).trim();
  if (body.avatar !== undefined) update.avatar = body.avatar || '';
  if (body.service !== undefined) update.service = String(body.service).trim();
  if (body.serviceId !== undefined) update.serviceId = String(body.serviceId || 'other').trim();
  if (body.rate !== undefined) update.rate = Number(body.rate) || 0;
  if (body.location !== undefined) update.location = String(body.location).trim();
  if (body.bio !== undefined) update.bio = String(body.bio).trim();
  if (body.tags !== undefined) update.tags = toArray(body.tags);
  if (body.serviceArea !== undefined) update.serviceArea = String(body.serviceArea).trim();
  if (body.certifications !== undefined) update.certifications = toArray(body.certifications);
  if (body.gallery !== undefined) update.gallery = toArray(body.gallery);
  if (body.available !== undefined) update.available = Boolean(body.available);
  if (body.verified !== undefined) update.verified = Boolean(body.verified);
  if (body.coordinates !== undefined) {
    update.coordinates = body.coordinates && Number.isFinite(Number(body.coordinates.lat)) && Number.isFinite(Number(body.coordinates.lng))
      ? { lat: Number(body.coordinates.lat), lng: Number(body.coordinates.lng) }
      : null;
    update.geoLocation = addGeoLocation({ coordinates: update.coordinates }).geoLocation;
  }

  update.updatedAt = new Date();
  return update;
};

router.get('/stats', async (req, res) => {
  try {
    const db = getDB();
    const [
      totalUsers,
      totalProviders,
      activeProviders,
      pendingKyc,
      openBookings,
      completedBookings,
      reviewsCount,
      openReports,
    ] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('providers').countDocuments(),
      db.collection('providers').countDocuments({ available: true }),
      db.collection('provider_kyc').countDocuments({ status: 'pending' }),
      db.collection('bookings').countDocuments({ status: { $in: ['requested', 'provider_accepted', 'customer_confirmed', 'in_progress'] } }),
      db.collection('bookings').countDocuments({ status: { $in: ['completed', 'reviewed'] } }),
      db.collection('reviews').countDocuments(),
      db.collection('reports').countDocuments({ status: { $in: ['open', 'investigating', 'escalated'] } }).catch(() => 0),
    ]);

    const bookings = await db.collection('bookings').find().project({ payment: 1 }).toArray();
    const grossVolume = bookings.reduce((sum, booking) => sum + Number(booking.totalAmount || booking.amount || booking.rate || 0), 0);
    const platformFee = Math.round(grossVolume * 0.15);
    const monthlyBookings = await db.collection('bookings').aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
          gross: { $sum: { $ifNull: ['$rate', 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]).toArray();

    res.json({
      cards: [
        { label: 'Total Users', value: String(totalUsers), change: 'Live count', color: 'bg-bauhaus-blue' },
        { label: 'Providers', value: String(totalProviders), change: `${activeProviders} active`, color: 'bg-bauhaus-red' },
        { label: 'Open Bookings', value: String(openBookings), change: `${completedBookings} completed`, color: 'bg-bauhaus-yellow' },
        { label: 'Pending KYC', value: String(pendingKyc), change: 'Awaiting review', color: 'bg-bauhaus-red' },
        { label: 'Reviews', value: String(reviewsCount), change: 'Published/flagged', color: 'bg-bauhaus-blue' },
        { label: 'Open Reports', value: String(openReports), change: 'Support queue', color: 'bg-bauhaus-yellow' },
      ],
      health: [
        ['API uptime', 'Online', 'yellow'],
        ['Database', db.databaseName, 'blue'],
        ['Admin API', 'Protected', 'red'],
      ],
      earnings: {
        grossVolume,
        platformFee,
        providerPayout: Math.max(0, grossVolume - platformFee),
        refundExposure: 0,
      },
      bookingTrend: monthlyBookings.map((item) => item.count),
      earningTrend: monthlyBookings.map((item) => Math.round(Number(item.gross || 0) * 0.15)),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/providers', async (req, res) => {
  try {
    const db = getDB();
    const providers = await db.collection('providers').find().sort({ createdAt: -1, rating: -1 }).toArray();
    const linkedUserIds = [...new Set(
      providers
        .map((provider) => String(provider?.userId || '').trim())
        .filter(Boolean)
    )];
    const linkedObjectIds = linkedUserIds
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const activeUsers = linkedObjectIds.length > 0
      ? await db.collection('users').find(
        {
          _id: { $in: linkedObjectIds },
          isDeleted: { $ne: true },
          deletedAt: { $exists: false },
        },
        { projection: { _id: 1 } }
      ).toArray()
      : [];
    const activeUserIdSet = new Set(activeUsers.map((user) => String(user._id)));

    const visibleProviders = providers.filter((provider) => {
      if (provider.isDeleted === true) return false;
      if (provider.deletedAt) return false;
      const providerUserId = String(provider?.userId || '').trim();
      if (!providerUserId) return true;
      return activeUserIdSet.has(providerUserId);
    });

    res.json(visibleProviders);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/providers/:id', async (req, res) => {
  try {
    const query = parseId(req.params.id);
    if (!query) return res.status(400).json({ success: false, error: 'Invalid provider ID' });

    const result = await getDB().collection('providers').findOneAndUpdate(
      query,
      { $set: normalizeProviderUpdate(req.body) },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ success: false, error: 'Provider not found' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/bookings', async (req, res) => {
  try {
    const bookings = await getDB().collection('bookings').find().sort({ createdAt: -1 }).toArray();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/bookings/:id/status', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid booking ID' });
    }

    if (!allowedBookingStatuses.includes(req.body.status)) {
      return res.status(400).json({ success: false, error: 'Invalid booking status' });
    }

    const result = await getDB().collection('bookings').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      {
        $set: { status: req.body.status, updatedAt: new Date() },
        $push: {
          workflow: {
            status: req.body.status,
            by: publicUser(req.user).id,
            note: req.body.note || 'Updated by admin',
            at: new Date(),
          },
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ success: false, error: 'Booking not found' });
    emitAlert('booking:status-updated', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const bookings = await getDB().collection('bookings').find().sort({ createdAt: -1 }).limit(50).toArray();
    const transactions = bookings.map((booking) => {
      const gross = Number(booking.totalAmount || booking.amount || booking.rate || 0);
      const fee = Math.round(gross * 0.15);
      const bookingId = String(booking._id).slice(-6).toUpperCase();
      return {
        id: `TX-${bookingId}`,
        booking: `BK-${bookingId}`,
        gross: money(gross),
        fee: money(fee),
        payout: money(Math.max(0, gross - fee)),
        status: booking.payment?.status || (booking.status === 'cancelled' ? 'Refund Review' : 'Pending'),
      };
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const reviews = await getDB().collection('reviews').find().sort({ createdAt: -1 }).toArray();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/reviews/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid review ID' });
    }

    const allowedStatuses = ['published', 'flagged', 'hidden'];
    if (req.body.status && !allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ success: false, error: 'Invalid review status' });
    }

    const result = await getDB().collection('reviews').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: req.body.status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ success: false, error: 'Review not found' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/services', async (req, res) => {
  try {
    const services = await getDB().collection('services').find().sort({ label: 1 }).toArray();
    res.json(services);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/services', async (req, res) => {
  try {
    const id = String(req.body.id || req.body.label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const label = String(req.body.label || '').trim();

    if (!id || !label) return res.status(400).json({ success: false, error: 'Service id and label are required' });

    const service = {
      id,
      label,
      icon: req.body.icon || 'settings',
      color: req.body.color || 'bg-bauhaus-ink',
      active: req.body.active !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await getDB().collection('services').insertOne(service);
    res.status(201).json(service);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, error: 'Service already exists' });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/services/:id', async (req, res) => {
  try {
    const update = { updatedAt: new Date() };
    if (req.body.label !== undefined) update.label = String(req.body.label).trim();
    if (req.body.icon !== undefined) update.icon = req.body.icon || 'settings';
    if (req.body.color !== undefined) update.color = req.body.color || 'bg-bauhaus-ink';
    if (req.body.active !== undefined) update.active = Boolean(req.body.active);

    const result = await getDB().collection('services').findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ success: false, error: 'Service not found' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/services/:id', async (req, res) => {
  try {
    const result = await getDB().collection('services').deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Service not found' });
    res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const reports = await getDB().collection('reports').find().sort({ createdAt: -1 }).toArray();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const logs = await getDB().collection('system_logs').find().sort({ createdAt: -1 }).limit(25).toArray();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
