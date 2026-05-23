import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../mongoConnect.js';
import { emitAlert } from '../realtime.js';
import { requireAuth } from '../security.js';

const router = express.Router();

router.get('/bookings', async (req, res) => {
  try {
    const query = {};
    if (req.query.email) query.customerEmail = req.query.email.toLowerCase();
    if (req.query.providerId) query.providerKey = String(req.query.providerId);

    const bookings = await getDB().collection('bookings').find(query).sort({ createdAt: -1 }).toArray();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bookings', requireAuth, async (req, res) => {
  try {
    const { providerId, customerName, customerEmail, scheduledAt, address, note, paymentMethod } = req.body;

    if (!providerId || !scheduledAt || !address) {
      return res.status(400).json({ error: 'providerId, scheduledAt, and address are required' });
    }

    const providerQuery = Number.isInteger(Number(providerId))
      ? { id: Number(providerId) }
      : ObjectId.isValid(providerId) ? { _id: new ObjectId(providerId) } : null;
    if (!providerQuery) return res.status(400).json({ error: 'Invalid provider ID' });

    const provider = await getDB().collection('providers').findOne(providerQuery);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const booking = {
      providerId: provider.id ?? null,
      providerKey: String(provider.id || provider._id),
      providerObjectId: provider._id ? String(provider._id) : null,
      providerName: provider.name || '',
      providerUserId: provider.userId || null,
      customerUserId: String(req.user._id),
      customerName: customerName || req.user.name || '',
      customerEmail: customerEmail?.toLowerCase() || req.user.email || '',
      scheduledAt: new Date(scheduledAt),
      address,
      note: note || '',
      service: provider.service || '',
      rate: Number(provider.rate || 0),
      status: 'requested',
      workflow: [
        { status: 'requested', at: new Date(), by: 'customer' },
      ],
      payment: {
        method: paymentMethod === 'cash_on_service' ? 'cash_on_service' : 'cash_on_service',
        status: 'pay_on_completion',
        referenceNumber: '',
        paidAt: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getDB().collection('bookings').insertOne(booking);
    const createdBooking = { ...booking, _id: result.insertedId };

    const participantIds = [...new Set([String(req.user._id), provider.userId ? String(provider.userId) : null].filter(Boolean))];
    await getDB().collection('conversations').updateOne(
      { providerKey: booking.providerKey, participantIds: { $all: participantIds } },
      {
        $setOnInsert: {
          providerKey: booking.providerKey,
          providerId: booking.providerId,
          providerObjectId: booking.providerObjectId,
          providerUserId: provider.userId || null,
          customerUserId: String(req.user._id),
          participantIds,
          customer: {
            id: String(req.user._id),
            name: req.user.name || '',
            email: req.user.email || '',
            avatar: req.user.avatar || '',
          },
          provider: {
            id: booking.providerKey,
            name: provider.name || 'Provider',
            avatar: provider.avatar || '',
            service: provider.service || 'Service',
            available: Boolean(provider.available),
          },
          status: 'Active Job',
          createdAt: new Date(),
        },
        $set: {
          lastMessage: `Booking requested for ${new Date(scheduledAt).toLocaleString()}`,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
          unreadBy: provider.userId ? [String(provider.userId)] : [],
        },
      },
      { upsert: true }
    );

    emitAlert('booking:created', createdBooking);
    res.status(201).json(createdBooking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/bookings/:id/status', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const allowedStatuses = ['requested', 'provider_accepted', 'customer_confirmed', 'in_progress', 'completed', 'reviewed', 'cancelled'];
    if (!allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid booking status' });
    }

    const result = await getDB().collection('bookings').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      {
        $set: { status: req.body.status, updatedAt: new Date() },
        $push: {
          workflow: {
            status: req.body.status,
            by: req.body.by || 'system',
            note: req.body.note || '',
            at: new Date(),
          },
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'Booking not found' });
    emitAlert('booking:status-updated', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
