import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../mongoConnect.js';
import { emitAlert } from '../realtime.js';

const router = express.Router();

router.get('/bookings', async (req, res) => {
  try {
    const query = {};
    if (req.query.email) query.customerEmail = req.query.email.toLowerCase();
    if (req.query.providerId) query.providerId = Number(req.query.providerId);

    const bookings = await getDB().collection('bookings').find(query).sort({ createdAt: -1 }).toArray();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bookings', async (req, res) => {
  try {
    const { providerId, customerName, customerEmail, scheduledAt, address, note, paymentMethod } = req.body;

    if (!providerId || !scheduledAt || !address) {
      return res.status(400).json({ error: 'providerId, scheduledAt, and address are required' });
    }

    const booking = {
      providerId: Number(providerId),
      customerName: customerName || '',
      customerEmail: customerEmail?.toLowerCase() || '',
      scheduledAt: new Date(scheduledAt),
      address,
      note: note || '',
      status: 'requested',
      workflow: [
        { status: 'requested', at: new Date(), by: 'customer' },
      ],
      payment: {
        method: paymentMethod === 'gcash_mock' ? 'gcash_mock' : 'cash_on_service',
        status: paymentMethod === 'gcash_mock' ? 'awaiting_mock_payment' : 'pay_on_completion',
        referenceNumber: '',
        paidAt: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getDB().collection('bookings').insertOne(booking);
    const createdBooking = { ...booking, _id: result.insertedId };
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

router.post('/bookings/:id/payments/mock-gcash', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const referenceNumber = req.body.referenceNumber || `GCASH-${Date.now()}`;
    const result = await getDB().collection('bookings').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          payment: {
            method: 'gcash_mock',
            status: 'paid',
            referenceNumber,
            paidAt: new Date(),
          },
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'Booking not found' });
    emitAlert('payment:mock-gcash-paid', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
