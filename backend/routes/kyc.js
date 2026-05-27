import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../mongoConnect.js';
import { emitAlert } from '../realtime.js';
import { isAdminRole, requireAdmin, requireAuth } from '../security.js';

const router = express.Router();
const MAX_KYC_IMAGE_DATA_URL_LENGTH = 1_250_000;

router.post('/provider-kyc', requireAuth, async (req, res) => {
  try {
    const { userId, providerId, fullName, idType, idNumber, address, documents } = req.body;

    if (!userId || !fullName || !idType || !idNumber || !address) {
      return res.status(400).json({ error: 'userId, fullName, idType, idNumber, and address are required' });
    }

    if (!isAdminRole(req.user.role) && String(req.user._id) !== String(userId)) {
      return res.status(403).json({ error: 'You can only submit KYC for your own account' });
    }

    const submittedDocuments = Array.isArray(documents) ? documents : [];
    const requiredSlots = ['frontId', 'backId', 'selfie'];
    const missingSlots = requiredSlots.filter((slot) => !submittedDocuments.some((doc) => doc.slot === slot && doc.dataUrl));

    if (missingSlots.length > 0) {
      return res.status(400).json({ error: 'Front ID, Back ID, and Selfie photos are required' });
    }
    if (submittedDocuments.some((doc) => typeof doc.dataUrl !== 'string' || !doc.dataUrl.startsWith('data:image/'))) {
      return res.status(400).json({ error: 'KYC documents must be image files' });
    }
    if (submittedDocuments.some((doc) => doc.dataUrl.length > MAX_KYC_IMAGE_DATA_URL_LENGTH)) {
      return res.status(400).json({ error: 'Each KYC image must be under 900 KB' });
    }

    const submission = {
      userId,
      providerId: providerId || null,
      fullName,
      idType,
      idNumber,
      address,
      documents: submittedDocuments,
      status: 'pending',
      reviewedBy: null,
      reviewNote: '',
      submittedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getDB().collection('provider_kyc').insertOne(submission);
    const created = { ...submission, _id: result.insertedId };

    if (ObjectId.isValid(userId)) {
      await getDB().collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            providerStatus: 'kyc_submitted',
            kycSubmittedAt: submission.submittedAt,
            updatedAt: new Date(),
          },
        }
      );
    }

    emitAlert('kyc:submitted', created);
    res.status(201).json({
      ...created,
      user: {
        providerStatus: 'kyc_submitted',
        kycSubmittedAt: submission.submittedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/provider-kyc', requireAdmin, async (req, res) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;

    const submissions = await getDB().collection('provider_kyc').find(query).sort({ submittedAt: -1 }).toArray();
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/admin/provider-kyc/:id', requireAdmin, async (req, res) => {
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

    if (ObjectId.isValid(result.userId)) {
      await getDB().collection('users').updateOne(
        { _id: new ObjectId(result.userId) },
        {
          $set: {
            providerStatus: status,
            verified: status === 'approved',
            kycReviewedAt: result.reviewedAt,
            updatedAt: new Date(),
          },
        }
      );
    }

    emitAlert('kyc:reviewed', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
