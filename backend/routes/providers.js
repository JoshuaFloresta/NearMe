import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../mongoConnect.js';
import { addGeoLocation } from '../geo.js';
import { isAdminRole, normalizeRole, requireAuth } from '../security.js';

const router = express.Router();

const parseProviderId = (id) => {
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

const numericOrDefault = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const toWeekdayList = (value) => {
  const raw = toArray(value).map((item) => String(item).toLowerCase());
  const allowed = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return raw.filter((item) => allowed.includes(item));
};
const sanitizeAvailabilityOverrides = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).forEach(([dateKey, entry]) => {
    const isDateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey));
    if (!isDateKey || !entry || typeof entry !== 'object') return;
    const start = String(entry.start || '').trim();
    const end = String(entry.end || '').trim();
    result[dateKey] = {
      available: entry.available !== false,
      start: start || '08:00',
      end: end || '18:00',
    };
  });
  return result;
};

const publicProviderUpdate = (body) => {
  const update = {};

  if (body.name !== undefined) update.name = String(body.name).trim();
  if (body.avatar !== undefined) update.avatar = body.avatar || '';
  if (body.service !== undefined) update.service = String(body.service).trim();
  if (body.serviceId !== undefined) update.serviceId = String(body.serviceId || 'other').trim();
  if (body.rate !== undefined) update.rate = numericOrDefault(body.rate);
  if (body.location !== undefined) update.location = String(body.location).trim();
  if (body.bio !== undefined) update.bio = String(body.bio).trim();
  if (body.tags !== undefined) update.tags = toArray(body.tags);
  if (body.serviceArea !== undefined) update.serviceArea = String(body.serviceArea).trim();
  if (body.certifications !== undefined) update.certifications = toArray(body.certifications);
  if (body.gallery !== undefined) update.gallery = toArray(body.gallery);
  if (body.available !== undefined) update.available = Boolean(body.available);
  if (body.availabilityDays !== undefined) update.availabilityDays = toWeekdayList(body.availabilityDays);
  if (body.workingHours !== undefined) {
    const start = String(body.workingHours?.start || '').trim();
    const end = String(body.workingHours?.end || '').trim();
    update.workingHours = (start && end) ? { start, end } : null;
  }
  if (body.availabilityOverrides !== undefined) {
    update.availabilityOverrides = sanitizeAvailabilityOverrides(body.availabilityOverrides);
  }
  if (body.coordinates !== undefined) {
    update.coordinates = body.coordinates && Number.isFinite(Number(body.coordinates.lat)) && Number.isFinite(Number(body.coordinates.lng))
      ? { lat: Number(body.coordinates.lat), lng: Number(body.coordinates.lng) }
      : null;
    update.geoLocation = addGeoLocation({ coordinates: update.coordinates }).geoLocation;
  }

  update.updatedAt = new Date();
  return update;
};

const nextProviderId = async () => {
  const latest = await getDB().collection('providers').find({ id: { $type: 'number' } }).sort({ id: -1 }).limit(1).next();
  return (latest?.id || 0) + 1;
};
const getStartingRateMap = async (providers = []) => {
  const providerUserIds = Array.from(new Set(
    providers.map((provider) => String(provider?.userId || '').trim()).filter(Boolean)
  ));
  if (providerUserIds.length === 0) return new Map();

  const rows = await getDB().collection('provider_services').aggregate([
    {
      $match: {
        providerUserId: { $in: providerUserIds },
        active: { $ne: false },
      },
    },
    {
      $project: {
        providerUserId: 1,
        normalizedPrice: {
          $convert: { input: '$price', to: 'double', onError: null, onNull: null },
        },
      },
    },
    { $match: { normalizedPrice: { $gt: 0 } } },
    {
      $group: {
        _id: '$providerUserId',
        minPrice: { $min: '$normalizedPrice' },
      },
    },
  ]).toArray();

  const map = new Map();
  rows.forEach((row) => {
    map.set(String(row._id), Math.round(Number(row.minPrice || 0) * 100) / 100);
  });
  return map;
};
const withStartingRate = (provider, startingRateMap) => {
  const key = String(provider?.userId || '').trim();
  const baseRate = numericOrDefault(provider?.rate, 0);
  const startingRate = key && startingRateMap.has(key) ? numericOrDefault(startingRateMap.get(key), baseRate) : baseRate;
  return { ...provider, startingRate };
};
const providerReviewIdCandidates = (provider) => {
  const values = [
    provider?.id,
    String(provider?.id || '').trim(),
    String(provider?._id || '').trim(),
  ].filter((value) => value !== null && value !== undefined && String(value).trim());
  return Array.from(new Set(values));
};
const recalculateProviderReviewStats = async (provider) => {
  const candidates = providerReviewIdCandidates(provider);
  if (candidates.length === 0) return { count: 0, rating: 0 };

  const reviews = await getDB().collection('reviews').find({
    providerId: { $in: candidates },
    status: { $ne: 'deleted' },
  }).toArray();

  const ratings = reviews
    .map((review) => Number(review?.rating || 0))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
  if (ratings.length === 0) return { count: 0, rating: 0 };

  const sum = ratings.reduce((total, value) => total + value, 0);
  const avg = Math.round((sum / ratings.length) * 10) / 10;
  return { count: ratings.length, rating: avg };
};

router.get('/services', async (req, res) => {
  try {
    const services = await getDB().collection('services').find().sort({ label: 1 }).toArray();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/providers/me', requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!isAdminRole(req.user.role) && String(req.user._id) !== String(userId)) {
      return res.status(403).json({ error: 'You can only access your own provider profile' });
    }

    const users = getDB().collection('users');
    const providers = getDB().collection('providers');
    const userQuery = ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId };
    const user = await users.findOne(userQuery);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let provider = await providers.findOne({ userId: String(user._id) });
    if (!provider) {
      provider = await providers.findOne({ email: user.email });
    }

    if (!provider) {
      const createdAt = new Date();
      const newProvider = addGeoLocation({
        id: await nextProviderId(),
        userId: String(user._id),
        email: user.email,
        name: user.name || [user.fname, user.lname].filter(Boolean).join(' ') || 'Provider',
        avatar: user.avatar || '',
        service: 'General Services',
        serviceId: 'other',
        rating: 0,
        reviews: 0,
        jobs: 0,
        finished_jobs: 0,
        walletBalance: 0,
        rate: 0,
        distance: 0,
        location: '',
        serviceArea: '',
        coordinates: null,
        verified: user.providerStatus === 'approved' || Boolean(user.verified),
        available: true,
        discoverable: true,
        availabilityDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        workingHours: { start: '08:00', end: '18:00' },
        availabilityOverrides: {},
        bio: '',
        tags: [],
        certifications: [],
        gallery: [],
        joinedYear: createdAt.getFullYear(),
        createdAt,
        updatedAt: createdAt,
      });
      const result = await providers.insertOne(newProvider);
      provider = { ...newProvider, _id: result.insertedId };
    } else if (!provider.userId) {
      await providers.updateOne({ _id: provider._id }, { $set: { userId: String(user._id), email: user.email, updatedAt: new Date() } });
      provider = { ...provider, userId: String(user._id), email: user.email };
    }

    res.json(provider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/providers', async (req, res) => {
  try {
    const { search, serviceId, available, maxRate, minRating } = req.query;
    const query = { discoverable: { $ne: false } };

    if (serviceId) query.serviceId = serviceId;
    if (available === 'true') query.available = true;
    if (maxRate) query.rate = { $lte: Number(maxRate) };
    if (minRating) query.rating = { $gte: Number(minRating) };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { service: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const providers = await getDB().collection('providers').find(query).sort({ rating: -1, jobs: -1 }).toArray();
    const startingRateMap = await getStartingRateMap(providers);
    res.json(providers.map((provider) => withStartingRate(provider, startingRateMap)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const reviews = await getDB().collection('reviews').find().sort({ createdAt: -1 }).limit(limit).toArray();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/providers/:id', async (req, res) => {
  try {
    const query = parseProviderId(req.params.id);
    if (!query) return res.status(400).json({ error: 'Invalid provider ID' });

    const provider = await getDB().collection('providers').findOne(query);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const startingRateMap = await getStartingRateMap([provider]);
    res.json(withStartingRate(provider, startingRateMap));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/providers', requireAuth, async (req, res) => {
  try {
    const { name, service, serviceId, rate, location, coordinates, bio, tags, avatar } = req.body;

    if (!name || !service || !serviceId || !rate || !location) {
      return res.status(400).json({ error: 'name, service, serviceId, rate, and location are required' });
    }

    const provider = addGeoLocation({
      name,
      userId: String(req.user._id),
      email: req.user.email,
      service,
      serviceId,
      rate: Number(rate),
      location,
      coordinates: coordinates || null,
      bio: bio || '',
      tags: Array.isArray(tags) ? tags : [],
      serviceArea: req.body.serviceArea || location,
      certifications: Array.isArray(req.body.certifications) ? req.body.certifications : [],
      gallery: Array.isArray(req.body.gallery) ? req.body.gallery : [],
      joinedYear: new Date().getFullYear(),
      avatar: avatar || '',
      rating: 0,
      reviews: 0,
      jobs: 0,
      finished_jobs: 0,
      walletBalance: 0,
      distance: 0,
      verified: false,
      available: true,
      discoverable: true,
      availabilityDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      workingHours: { start: '08:00', end: '18:00' },
      availabilityOverrides: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getDB().collection('providers').insertOne(provider);
    res.status(201).json({ ...provider, _id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/providers/:id', requireAuth, async (req, res) => {
  try {
    const query = parseProviderId(req.params.id);
    if (!query) return res.status(400).json({ error: 'Invalid provider ID' });

    const existingProvider = await getDB().collection('providers').findOne(query);
    if (!existingProvider) return res.status(404).json({ error: 'Provider not found' });

    const canUpdate = isAdminRole(req.user.role) || String(existingProvider.userId || '') === String(req.user._id);
    if (!canUpdate) {
      return res.status(403).json({ error: 'You can only update your own provider profile' });
    }

    const update = publicProviderUpdate(req.body);
    const result = await getDB().collection('providers').findOneAndUpdate(
      query,
      { $set: update },
      { returnDocument: 'after' }
    );

    if (req.body.avatar !== undefined && String(existingProvider.userId || '') === String(req.user._id)) {
      await getDB().collection('users').updateOne(
        { _id: req.user._id },
        { $set: { avatar: req.body.avatar || '', updatedAt: new Date() } }
      );
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/providers/:id/reviews', async (req, res) => {
  try {
    const numericId = Number(req.params.id);
    const providerId = Number.isInteger(numericId) ? numericId : req.params.id;
    const reviews = await getDB().collection('reviews').find({
      $or: [
        { providerId },
        { providerId: String(providerId) },
      ],
    }).sort({ createdAt: -1 }).toArray();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/providers/:id/reviews', requireAuth, async (req, res) => {
  try {
    const query = parseProviderId(req.params.id);
    if (!query) return res.status(400).json({ error: 'Invalid provider ID' });
    const actorRole = normalizeRole(req.user?.role || '');
    const isClientRole = ['client', 'customer', 'user'].includes(actorRole);
    if (!isClientRole) {
      return res.status(403).json({ error: 'Only clients can leave provider reviews' });
    }

    const provider = await getDB().collection('providers').findOne(query);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const rating = Number(req.body?.rating);
    const text = String(req.body?.text || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer from 1 to 5' });
    }
    if (text.length < 10 || text.length > 500) {
      return res.status(400).json({ error: 'Review text must be 10 to 500 characters' });
    }

    const now = new Date();
    const reviewPayload = {
      providerId: provider.id ?? String(provider._id),
      providerUserId: provider.userId ? String(provider.userId) : null,
      customerUserId: String(req.user._id),
      name: req.user.name || [req.user.fname, req.user.lname].filter(Boolean).join(' ') || 'Customer',
      rating,
      text,
      status: 'published',
      updatedAt: now,
    };
    const reviewQuery = {
      providerId: { $in: providerReviewIdCandidates(provider) },
      customerUserId: String(req.user._id),
      status: { $ne: 'deleted' },
    };
    const existing = await getDB().collection('reviews').findOne(reviewQuery);

    let savedReview;
    let created = false;
    if (existing) {
      await getDB().collection('reviews').updateOne(
        { _id: existing._id },
        { $set: reviewPayload }
      );
      savedReview = { ...existing, ...reviewPayload, _id: existing._id };
    } else {
      const review = { ...reviewPayload, createdAt: now };
      const result = await getDB().collection('reviews').insertOne(review);
      savedReview = { ...review, _id: result.insertedId };
      created = true;
    }

    const nextStats = await recalculateProviderReviewStats(provider);
    await getDB().collection('providers').updateOne(
      { _id: provider._id },
      { $set: { reviews: nextStats.count, rating: nextStats.rating, updatedAt: new Date() } }
    );

    res.status(created ? 201 : 200).json({
      review: savedReview,
      provider: {
        id: provider.id ?? String(provider._id),
        reviews: nextStats.count,
        rating: nextStats.rating,
      },
      created,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
