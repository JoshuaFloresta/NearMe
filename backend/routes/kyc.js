import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../mongoConnect.js';
import { emitAlert } from '../realtime.js';

const router = express.Router();

router.post('/provider-kyc', async (req, res) => {
  try {
    const { userId, providerId, fullName, idType, idNumber, address, documents } = req.body;

    if (!userId || !fullName || !idType || !idNumber || !address) {
      return res.status(400).json({ error: 'userId, fullName, idType, idNumber, and address are required' });
    }

    const submission = {
      userId,
      providerId: providerId || null,
      fullName,
      idType,
      idNumber,
      address,
      documents: Array.isArray(documents) ? documents : [],
      status: 'pending',
      reviewedBy: null,
      reviewNote: '',
      submittedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getDB().collection('provider_kyc').insertOne(submission);
    const created = { ...submission, _id: result.insertedId };
    emitAlert('kyc:submitted', created);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/provider-kyc', async (req, res) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;

    const submissions = await getDB().collection('provider_kyc').find(query).sort({ submittedAt: -1 }).toArray();
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/admin/provider-kyc/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid KYC ID' });
    }

    const { status, reviewedBy, reviewNote } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const result = await getDB().collection('provider_kyc').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status,
          reviewedBy: reviewedBy || 'admin',
          reviewNote: reviewNote || '',
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'KYC submission not found' });

    if (status === 'approved' && result.providerId) {
      const providerQuery = ObjectId.isValid(result.providerId)
        ? { _id: new ObjectId(result.providerId) }
        : { id: Number(result.providerId) };
      await getDB().collection('providers').updateOne(providerQuery, { $set: { verified: true, updatedAt: new Date() } });
    }

    emitAlert('kyc:reviewed', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
