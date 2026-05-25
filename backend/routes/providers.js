// Import Express to create a router and define HTTP handlers for provider-related endpoints.
import express from 'express';

// Import ObjectId so we can validate and create MongoDB ObjectId instances when needed.
import { ObjectId } from 'mongodb';

// Import a helper to access the connected MongoDB instance from other modules.
import { getDB } from '../mongoConnect.js';

// Import geolocation helper used to create geoLocation fields from coordinates or location strings.
import { addGeoLocation } from '../geo.js';
import { isAdminRole, normalizeRole, requireAuth } from '../security.js'; 

// Create an Express router instance to register specific routes for providers.
const router = express.Router();
const providerReportCategories = {
  harassment: 'Harassment',
  scam_fraud: 'Scam or Fraud',
  false_information: 'False Information',
  violence: 'Violence or Threats',
  adult_content: 'Adult Content',
  unsafe_behavior: 'Unsafe Behavior',
  discrimination: 'Discrimination',
  other: 'Other',
};

// parseProviderId: accept either a numeric provider id or a MongoDB ObjectId string.
// Returns a query object usable in MongoDB lookups, or null if the input is invalid.
const parseProviderId = (id) => {
  const numericId = Number(id);
  // If the value parses to an integer, query by numeric `id` field.
  if (Number.isInteger(numericId)) return { id: numericId };
  // If the value is a valid ObjectId string, query by `_id` field.
  if (ObjectId.isValid(id)) return { _id: new ObjectId(id) };
  // Otherwise return null so routes can return a 400 error for invalid ids.
  return null;
};

// toArray: normalize different input shapes into a trimmed array of strings.
// - If already an array, cast items to strings, trim, and remove empty values.
// - If a comma-separated string, split and trim each item.
// - Otherwise return an empty array.
const toArray = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

// numericOrDefault: coerce a value to a number, or return a fallback when invalid.
const numericOrDefault = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

// toWeekdayList: normalize weekday-like input to an array of allowed short names.
const toWeekdayList = (value) => {
  const raw = toArray(value).map((item) => String(item).toLowerCase());
  const allowed = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return raw.filter((item) => allowed.includes(item));
};

// sanitizeAvailabilityOverrides: validate and normalize an object of date->availability entries.
// Expected input shape: { 'YYYY-MM-DD': { available: boolean, start: 'HH:MM', end: 'HH:MM' } }
const sanitizeAvailabilityOverrides = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).forEach(([dateKey, entry]) => {
    // Accept only keys that look like YYYY-MM-DD to avoid unexpected properties.
    const isDateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey));
    if (!isDateKey || !entry || typeof entry !== 'object') return;
    const start = String(entry.start || '').trim();
    const end = String(entry.end || '').trim();
    result[dateKey] = {
      // Default to true unless explicitly false.
      available: entry.available !== false,
      // Provide sane defaults for start/end when missing.
      start: start || '08:00',
      end: end || '18:00',
    };
  });
  return result;
};

// publicProviderUpdate: builds a sanitized update object from a request body.
// This function intentionally whitelists fields that may be updated by providers.
const publicProviderUpdate = (body) => {
  const update = {};

  // For each allowed field, check if it exists on the incoming body and normalize it.
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

  // Normalize working hours if both start and end are provided.
  if (body.workingHours !== undefined) {
    const start = String(body.workingHours?.start || '').trim();
    const end = String(body.workingHours?.end || '').trim();
    update.workingHours = (start && end) ? { start, end } : null;
  }

  // Normalize availability overrides into an object keyed by dates.
  if (body.availabilityOverrides !== undefined) {
    update.availabilityOverrides = sanitizeAvailabilityOverrides(body.availabilityOverrides);
  }

  // If coordinates are provided, validate numeric lat/lng and compute geoLocation for DB queries.
  if (body.coordinates !== undefined) {
    update.coordinates = body.coordinates && Number.isFinite(Number(body.coordinates.lat)) && Number.isFinite(Number(body.coordinates.lng))
      ? { lat: Number(body.coordinates.lat), lng: Number(body.coordinates.lng) }
      : null;
    // addGeoLocation enriches the provider with a `geoLocation` object used for geospatial queries.
    update.geoLocation = addGeoLocation({ coordinates: update.coordinates }).geoLocation;
  }

  // Track updated timestamp for auditing and sorting.
  update.updatedAt = new Date();
  return update;
};

// nextProviderId: compute the next numeric provider id by finding the current max numeric `id`.
// This is used when providers use a numeric id in addition to MongoDB's _id.
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
const getCurrentlyWorkingUserIds = async (providers = []) => {
  const providerUserIds = Array.from(new Set(
    providers.map((provider) => String(provider?.userId || '').trim()).filter(Boolean)
  ));
  if (providerUserIds.length === 0) return new Set();
  const rows = await getDB().collection('jobs_ledger').find({
    providerUserId: { $in: providerUserIds },
    status: 'In Progress',
  }).project({ providerUserId: 1 }).toArray();
  return new Set(rows.map((row) => String(row.providerUserId || '').trim()).filter(Boolean));
};
const withCurrentlyWorking = (provider, currentlyWorkingUserIds) => ({
  ...provider,
  currentlyWorking: currentlyWorkingUserIds.has(String(provider?.userId || '').trim()),
});
const providerReviewIdCandidates = (provider) => {
  const values = [
    provider?.id,
    String(provider?.id || '').trim(),
    String(provider?._id || '').trim(),
  ].filter((value) => value !== null && value !== undefined && String(value).trim());
  return Array.from(new Set(values));
};
const uniqueProviderReviews = (reviews = []) => {
  const seen = new Set();
  return reviews.filter((review, index) => {
    const jobId = String(review?.jobId || '').trim();
    const customerUserId = String(review?.customerUserId || '').trim();
    const key = jobId
      ? `job:${jobId}`
      : customerUserId
        ? `standalone:${customerUserId}`
        : `record:${String(review?._id || index)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const recalculateProviderReviewStats = async (provider) => {
  const candidates = providerReviewIdCandidates(provider);
  if (candidates.length === 0) return { count: 0, rating: 0 };

  const reviews = uniqueProviderReviews(await getDB().collection('reviews').find({
    providerId: { $in: candidates },
    status: { $ne: 'deleted' },
  }).sort({ updatedAt: -1, createdAt: -1 }).toArray());

  const ratings = reviews
    .map((review) => Number(review?.rating || 0))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
  if (ratings.length === 0) return { count: 0, rating: 0 };

  const sum = ratings.reduce((total, value) => total + value, 0);
  const avg = Math.round((sum / ratings.length) * 10) / 10;
  return { count: ratings.length, rating: avg };
};

// Route: GET /services
// Returns the available service definitions used by the frontend to populate dropdowns.
router.get('/services', async (req, res) => {
  try {
    // Fetch all documents from `services` collection and sort alphabetically by label.
    const services = await getDB().collection('services').find({ isArchived: { $ne: true }, active: { $ne: false } }).sort({ label: 1 }).toArray();
    // Return the list to the frontend as JSON.
    res.json(services);
  } catch (error) {
    // Send HTTP 500 with the error message when something goes wrong.
    res.status(500).json({ error: error.message });
  }
});

// Route: GET /providers/me
// Returns the provider record associated with a given `userId` (creates one if missing).
// - Requires authentication because users request their own provider profile.
router.get('/providers/me', requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId;
    // Validate the query param exists; frontend should provide `userId`.
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    // If not admin, ensure the requesting user is the same as the requested userId.
    if (!isAdminRole(req.user.role) && String(req.user._id) !== String(userId)) {
      return res.status(403).json({ error: 'You can only access your own provider profile' });
    }

    // Shortcuts to collections used in this route.
    const users = getDB().collection('users');
    const providers = getDB().collection('providers');
    // Build a query for the user by _id; accept string or ObjectId forms.
    const userQuery = ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId };
    const user = await users.findOne(userQuery);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Attempt to find a provider linked to this user by userId or email.
    let provider = await providers.findOne({ userId: String(user._id) });
    if (!provider) {
      provider = await providers.findOne({ email: user.email });
    }

    // If no provider exists, create a default provider record and insert it.
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
        // Verified when the underlying user has providerStatus approved or a verified flag.
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
      // If an existing provider record has no linked userId, attach it now.
      await providers.updateOne({ _id: provider._id }, { $set: { userId: String(user._id), email: user.email, updatedAt: new Date() } });
      provider = { ...provider, userId: String(user._id), email: user.email };
    }

    // Return the provider document to the frontend; useful when showing "My Provider Profile".
    res.json(provider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: GET /providers
// Public endpoint to search and list providers. Supports filters like serviceId, availability, rates, and text search.
router.get('/providers', async (req, res) => {
  try {
    const { search, serviceId, available, maxRate, minRating } = req.query;
    // Base query excludes providers that have `discoverable = false` so admin-hidden ones are omitted.
    const query = { discoverable: { $ne: false }, isDeleted: { $ne: true }, deletedAt: { $exists: false } };

    // Apply simple filters based on query params; these come from the frontend search UI.
    if (serviceId) query.serviceId = serviceId;
    if (available === 'true') query.available = true;
    if (maxRate) query.rate = { $lte: Number(maxRate) };
    if (minRating) query.rating = { $gte: Number(minRating) };
    if (search) {
      // A basic text search across name, service, and location using case-insensitive regex.
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { service: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    // Sort by rating and jobs so higher-rated and busier providers surface first.
    const providers = await getDB().collection('providers').find(query).sort({ rating: -1, jobs: -1 }).toArray();
    const [startingRateMap, currentlyWorkingUserIds] = await Promise.all([
      getStartingRateMap(providers),
      getCurrentlyWorkingUserIds(providers),
    ]);
    res.json(providers.map((provider) => withCurrentlyWorking(withStartingRate(provider, startingRateMap), currentlyWorkingUserIds)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: GET /reviews
// Returns recent reviews (limited and sorted). Useful for admin/landing pages.
router.get('/reviews', async (req, res) => {
  try {
    // Limit the number of reviews returned (cap at 50 for performance).
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const reviews = await getDB().collection('reviews').find().sort({ createdAt: -1 }).limit(limit).toArray();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: GET /providers/:id
// Fetch a single provider by numeric id or MongoDB ObjectId.
router.get('/providers/:id', async (req, res) => {
  try {
    const query = parseProviderId(req.params.id);
    if (!query) return res.status(400).json({ error: 'Invalid provider ID' });

    const provider = await getDB().collection('providers').findOne({
      ...query,
      isDeleted: { $ne: true },
      archivedAt: { $exists: false },
    });
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const [startingRateMap, currentlyWorkingUserIds] = await Promise.all([
      getStartingRateMap([provider]),
      getCurrentlyWorkingUserIds([provider]),
    ]);
    res.json(withCurrentlyWorking(withStartingRate(provider, startingRateMap), currentlyWorkingUserIds));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: POST /providers
// Create a new provider record. Requires authentication since creation ties to the authenticated user.
router.post('/providers', requireAuth, async (req, res) => {
  try {
    // Destructure important fields from the request body; frontend must send these.
    const { name, service, serviceId, rate, location, coordinates, bio, tags, avatar } = req.body;

    // Validate required fields; the frontend's provider creation form should enforce these too.
    if (!name || !service || !serviceId || !rate || !location) {
      return res.status(400).json({ error: 'name, service, serviceId, rate, and location are required' });
    }

    // Build the provider object and compute geoLocation for spatial queries.
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

    // Insert the new provider into the collection and return the created document.
    const result = await getDB().collection('providers').insertOne(provider);
    res.status(201).json({ ...provider, _id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: PATCH /providers/:id
// Update a provider document. Requires authentication and either admin role or ownership.
router.patch('/providers/:id', requireAuth, async (req, res) => {
  try {
    const query = parseProviderId(req.params.id);
    if (!query) return res.status(400).json({ error: 'Invalid provider ID' });

    const existingProvider = await getDB().collection('providers').findOne(query);
    if (!existingProvider) return res.status(404).json({ error: 'Provider not found' });

    // Only admins or the provider owner (matching userId) may update.
    const canUpdate = isAdminRole(req.user.role) || String(existingProvider.userId || '') === String(req.user._id);
    if (!canUpdate) {
      return res.status(403).json({ error: 'You can only update your own provider profile' });
    }

    // Build the sanitized update object from the request body.
    const update = publicProviderUpdate(req.body);
    const result = await getDB().collection('providers').findOneAndUpdate(
      query,
      { $set: update },
      { returnDocument: 'after' }
    );

    // If the provider changed their avatar and they own the provider record, sync avatar to users collection.
    if (req.body.avatar !== undefined && String(existingProvider.userId || '') === String(req.user._id)) {
      await getDB().collection('users').updateOne(
        { _id: req.user._id },
        { $set: { avatar: req.body.avatar || '', updatedAt: new Date() } }
      );
    }

    // Return the updated provider document (wrapped by findOneAndUpdate result).
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: POST /providers/:id/reports
// Allow clients to send categorized safety complaints about a provider for admin review.
router.post('/providers/:id/reports', requireAuth, async (req, res) => {
  try {
    const actorRole = normalizeRole(req.user?.role || '');
    if (!['client', 'customer', 'user'].includes(actorRole)) {
      return res.status(403).json({ error: 'Only clients can report a provider' });
    }
    const query = parseProviderId(req.params.id);
    if (!query) return res.status(400).json({ error: 'Invalid provider ID' });
    const provider = await getDB().collection('providers').findOne({
      ...query,
      isDeleted: { $ne: true },
      deletedAt: { $exists: false },
    });
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const category = String(req.body?.category || '').trim().toLowerCase();
    const details = String(req.body?.details || '').trim();
    if (!providerReportCategories[category]) {
      return res.status(400).json({ error: 'Choose a valid report category' });
    }
    if (details.length < 20 || details.length > 1000) {
      return res.status(400).json({ error: 'Report details must be 20 to 1000 characters' });
    }

    const highPriority = ['scam_fraud', 'violence', 'adult_content'].includes(category);
    const now = new Date();
    const report = {
      type: 'Provider Complaint',
      subject: `${providerReportCategories[category]} report about ${provider.name || 'provider'}`,
      category,
      categoryLabel: providerReportCategories[category],
      details,
      providerId: provider.id ?? String(provider._id),
      providerObjectId: String(provider._id),
      providerUserId: provider.userId ? String(provider.userId) : '',
      providerName: provider.name || 'Provider',
      reporterUserId: String(req.user._id),
      reporterName: req.user.name || [req.user.fname, req.user.lname].filter(Boolean).join(' ') || 'Customer',
      priority: highPriority ? 'High' : 'Normal',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    const result = await getDB().collection('reports').insertOne(report);
    res.status(201).json({ ...report, _id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: GET /providers/:id/reviews
// Fetch reviews for a provider. Accepts either numeric id or string/ObjectId id.
router.get('/providers/:id/reviews', async (req, res) => {
  try {
    const numericId = Number(req.params.id);
    const providerId = Number.isInteger(numericId) ? numericId : req.params.id;
    // Query reviews where providerId matches either numeric or string form to support legacy data.
    const reviews = await getDB().collection('reviews').find({
      status: { $ne: 'deleted' },
      $or: [
        { providerId },
        { providerId: String(providerId) },
      ],
    }).sort({ updatedAt: -1, createdAt: -1 }).toArray();
    res.json(uniqueProviderReviews(reviews));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: POST /providers/:id/reviews
// Create a review for a provider. Requires authentication and validates rating/text.
router.post('/providers/:id/reviews', requireAuth, async (req, res) => {
  try {
    const query = parseProviderId(req.params.id);
    if (!query) return res.status(400).json({ error: 'Invalid provider ID' });
    const actorRole = normalizeRole(req.user?.role || '');
    const isClientRole = ['client', 'customer', 'user'].includes(actorRole);
    if (!isClientRole) {
      return res.status(403).json({ error: 'Only clients can leave provider reviews' });
    }

    const provider = await getDB().collection('providers').findOne({
      ...query,
      isDeleted: { $ne: true },
      archivedAt: { $exists: false },
    });
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    // Validate rating and text length to avoid spam/invalid reviews.
    const rating = Number(req.body?.rating);
    const text = String(req.body?.text || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer from 1 to 5' });
    }
    if (text.length < 10 || text.length > 500) {
      return res.status(400).json({ error: 'Review text must be 10 to 500 characters' });
    }

    const now = new Date();
    const reviewFields = {
      providerId: provider.id ?? String(provider._id),
      providerUserId: provider.userId ? String(provider.userId) : null,
      customerUserId: String(req.user._id),
      name: req.user.name || [req.user.fname, req.user.lname].filter(Boolean).join(' ') || 'Customer',
      rating,
      text,
      status: 'published',
      updatedAt: now,
    };
    const candidates = providerReviewIdCandidates(provider);
    const existing = await getDB().collection('reviews').findOne({
      providerId: { $in: candidates },
      customerUserId: String(req.user._id),
      jobId: { $exists: false },
      status: { $ne: 'deleted' },
    }, { sort: { updatedAt: -1, createdAt: -1 } });
    let savedReview;
    let created = false;

    if (existing) {
      await getDB().collection('reviews').updateOne(
        { _id: existing._id },
        { $set: reviewFields }
      );
      savedReview = { ...existing, ...reviewFields };
    } else {
      const review = { ...reviewFields, createdAt: now };
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
      created,
      provider: { reviews: nextStats.count, rating: nextStats.rating },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export the router so the main server can mount these routes under a path like `/api`.
export default router;
