import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../mongoConnect.js';
import { emitAlert } from '../realtime.js';
import { requireAuth } from '../security.js';

const router = express.Router();
const bookedJobStates = ['Accepted', 'In Progress', 'Pending Payment', 'Pending Verification'];
const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const parseHHMMToMinutes = (value, fallback) => {
  const [hour, minute] = String(value || fallback || '00:00').split(':').map((item) => Number(item || 0));
  return (hour * 60) + minute;
};

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

    const provider = await getDB().collection('providers').findOne({
      ...providerQuery,
      isDeleted: { $ne: true },
      archivedAt: { $exists: false },
    });
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const appointmentTime = new Date(scheduledAt);
    if (Number.isNaN(appointmentTime.getTime())) {
      return res.status(400).json({ error: 'Please select a valid booking date and time.' });
    }
    const dateKey = `${appointmentTime.getFullYear()}-${String(appointmentTime.getMonth() + 1).padStart(2, '0')}-${String(appointmentTime.getDate()).padStart(2, '0')}`;
    const dayOverride = provider.availabilityOverrides?.[dateKey] || null;
    const availableDays = Array.isArray(provider.availabilityDays) && provider.availabilityDays.length > 0
      ? provider.availabilityDays
      : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const availableByDay = dayOverride ? dayOverride.available !== false : availableDays.includes(weekdayKeys[appointmentTime.getDay()]);
    if (!availableByDay) {
      return res.status(409).json({ error: 'This provider is off on your selected date. Please choose an available day.' });
    }
    const startTime = dayOverride?.start || provider.workingHours?.start || '08:00';
    const endTime = dayOverride?.end || provider.workingHours?.end || '18:00';
    const minutes = (appointmentTime.getHours() * 60) + appointmentTime.getMinutes();
    if (minutes < parseHHMMToMinutes(startTime, '08:00') || minutes > parseHHMMToMinutes(endTime, '18:00')) {
      return res.status(409).json({ error: `Please choose a time within the provider's working hours (${startTime}-${endTime}).` });
    }
    const conflictingJob = await getDB().collection('jobs_ledger').findOne({
      providerUserId: String(provider.userId || ''),
      status: { $in: bookedJobStates },
      scheduledAt: appointmentTime,
    });
    if (conflictingJob) {
      return res.status(409).json({ error: 'This provider is already booked at the selected time. Please choose another time.' });
    }

    const booking = {
      providerId: provider.id ?? null,
      providerKey: String(provider.id || provider._id),
      providerObjectId: provider._id ? String(provider._id) : null,
      providerName: provider.name || '',
      providerUserId: provider.userId || null,
      customerUserId: String(req.user._id),
      customerName: customerName || req.user.name || '',
      customerEmail: customerEmail?.toLowerCase() || req.user.email || '',
      scheduledAt: appointmentTime,
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
