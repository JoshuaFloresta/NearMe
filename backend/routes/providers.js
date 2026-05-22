import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../mongoConnect.js';

const router = express.Router();

const parseProviderId = (id) => {
  const numericId = Number(id);
  if (Number.isInteger(numericId)) return { id: numericId };
  if (ObjectId.isValid(id)) return { _id: new ObjectId(id) };
  return null;
};

router.get('/services', async (req, res) => {
  try {
    const services = await getDB().collection('services').find().sort({ label: 1 }).toArray();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/providers', async (req, res) => {
  try {
    const { search, serviceId, available, maxRate, minRating } = req.query;
    const query = {};

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
    res.json(providers);
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

    res.json(provider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/providers', async (req, res) => {
  try {
    const { name, service, serviceId, rate, location, coordinates, bio, tags, avatar } = req.body;

    if (!name || !service || !serviceId || !rate || !location) {
      return res.status(400).json({ error: 'name, service, serviceId, rate, and location are required' });
    }

    const provider = {
      name,
      service,
      serviceId,
      rate: Number(rate),
      location,
      coordinates: coordinates || null,
      bio: bio || '',
      tags: Array.isArray(tags) ? tags : [],
      avatar: avatar || '',
      rating: 0,
      reviews: 0,
      jobs: 0,
      distance: 0,
      verified: false,
      available: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getDB().collection('providers').insertOne(provider);
    res.status(201).json({ ...provider, _id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/providers/:id/reviews', async (req, res) => {
  try {
    const numericId = Number(req.params.id);
    const providerId = Number.isInteger(numericId) ? numericId : req.params.id;
    const reviews = await getDB().collection('reviews').find({ providerId }).sort({ createdAt: -1 }).toArray();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
