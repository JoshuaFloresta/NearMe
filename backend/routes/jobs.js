import express from 'express';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { getDB } from '../mongoConnect.js';
import { emitAlertToRole, emitAlertToUsers } from '../realtime.js';
import { isAdminRole, requireAuth } from '../security.js';

const router = express.Router();

const STATES = {
  INQUIRY: 'Inquiry',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In Progress',
  PENDING_PAYMENT: 'Pending Payment',
  PENDING_VERIFICATION: 'Pending Verification',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
};

const PLATFORM_FEE_RATE = 0.1;
const WALLET_HIDE_THRESHOLD = -500;

const parseObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const toCentavos = (value) => Math.round(Number(value || 0) * 100);
const bookedStates = [STATES.ACCEPTED, STATES.IN_PROGRESS, STATES.PENDING_PAYMENT, STATES.PENDING_VERIFICATION];
const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const payMongoCheckoutMethods = () => {
  const configured = String(process.env.PAYMONGO_PAYMENT_METHOD_TYPES || 'qrph,gcash,paymaya,card')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  // QR Ph is PayMongo's baseline online option; keep checkout usable on accounts without approved e-wallet/card channels.
  return [...new Set(['qrph', ...configured])];
};
const parseHHMMToMinutes = (value, fallback) => {
  const [h, m] = String(value || fallback || '00:00').split(':').map((item) => Number(item || 0));
  return (h * 60) + m;
};

const isProviderActor = (job, user) => String(job.providerUserId || '') === String(user._id);
const isClientActor = (job, user) => String(job.clientUserId || '') === String(user._id);
const isParticipantOrAdmin = (job, user) => isProviderActor(job, user) || isClientActor(job, user) || isAdminRole(user.role);
const isProviderRole = (role = '') => String(role).toLowerCase() === 'provider';

const canTransition = (current, next) => {
  const transitions = new Map([
    [STATES.INQUIRY, [STATES.ACCEPTED]],
    [STATES.ACCEPTED, [STATES.IN_PROGRESS, STATES.INQUIRY, STATES.DISPUTED]],
    [STATES.IN_PROGRESS, [STATES.PENDING_PAYMENT, STATES.DISPUTED]],
    [STATES.PENDING_PAYMENT, [STATES.PENDING_VERIFICATION, STATES.COMPLETED, STATES.DISPUTED]],
    [STATES.PENDING_VERIFICATION, [STATES.COMPLETED, STATES.PENDING_PAYMENT, STATES.DISPUTED]],
    [STATES.DISPUTED, [STATES.PENDING_PAYMENT, STATES.COMPLETED]],
  ]);
  return transitions.get(current)?.includes(next) || false;
};

const addJobEvent = (events, status, actorId, role, note = '') => [
  ...(Array.isArray(events) ? events : []),
  {
    status,
    at: new Date(),
    actorId: String(actorId || ''),
    role: role || 'system',
    note: String(note || ''),
  },
];

const updateProviderWalletForCash = async (provider, jobId, feeAmount) => {
  const db = getDB();
  const currentBalance = toNumber(provider.walletBalance, 0);
  const nextBalance = round2(currentBalance - feeAmount);
  const discoverable = nextBalance > WALLET_HIDE_THRESHOLD;

  await db.collection('provider_wallet_ledger').insertOne({
    providerId: provider.id ?? null,
    providerObjectId: String(provider._id),
    jobId: String(jobId),
    type: 'commission_debit',
    delta: -round2(feeAmount),
    balanceBefore: currentBalance,
    balanceAfter: nextBalance,
    currency: 'PHP',
    createdAt: new Date(),
  });

  await db.collection('providers').updateOne(
    { _id: provider._id },
    {
      $set: {
        walletBalance: nextBalance,
        discoverable,
        updatedAt: new Date(),
      },
    }
  );
};

const finalizeCompletion = async ({ job, paymentMethod, verifiedByAdminId = null }) => {
  const db = getDB();
  const gross = round2(job.financials?.grossPrice || job.quote?.grossPrice || 0);
  const platformFee = round2(gross * PLATFORM_FEE_RATE);
  const providerNet = round2(gross - platformFee);

  const now = new Date();
  const jobUpdate = {
    status: STATES.COMPLETED,
    updatedAt: now,
    completedAt: now,
    financials: {
      currency: 'PHP',
      grossPrice: gross,
      platformFeeRate: PLATFORM_FEE_RATE,
      platformFeeAmount: platformFee,
      providerNetPayout: providerNet,
      paymentMethod,
      paymentStatus: paymentMethod === 'qr'
        ? 'verified'
        : paymentMethod === 'cashless'
          ? 'paid'
          : 'confirmed_cash',
    },
    payment: {
      ...(job.payment || {}),
      method: paymentMethod,
      verifiedByAdminId: verifiedByAdminId ? String(verifiedByAdminId) : null,
      verifiedAt: paymentMethod === 'qr' ? now : null,
    },
    workflow: addJobEvent(job.workflow, STATES.COMPLETED, verifiedByAdminId || 'system', paymentMethod === 'qr' ? 'admin' : 'system', `${paymentMethod} completion`),
  };

  const completionUpdate = await db.collection('jobs_ledger').updateOne(
    { _id: job._id, status: job.status },
    { $set: jobUpdate }
  );
  if (completionUpdate.modifiedCount !== 1) return false;

  await db.collection('providers').updateOne(
    { userId: String(job.providerUserId) },
    { $inc: { jobs: 1, finished_jobs: 1 }, $set: { updatedAt: now } }
  );

  await db.collection('transaction_receipts').insertOne({
    jobId: String(job._id),
    jobNumber: job.jobNumber,
    clientUserId: job.clientUserId,
    clientEmail: job.clientEmail || '',
    providerUserId: job.providerUserId,
    paymentMethod,
    grossPrice: gross,
    platformFee,
    providerNet,
    status: 'queued',
    createdAt: now,
  });

  await db.collection('platform_metrics_daily').updateOne(
    { date: now.toISOString().slice(0, 10) },
    {
      $inc: {
        grossVolume: gross,
        platformRevenue: platformFee,
        completedJobs: 1,
      },
      $setOnInsert: { createdAt: now },
      $set: { updatedAt: now },
    },
    { upsert: true }
  );

  return true;
};

router.get('/v1/jobs', requireAuth, async (req, res) => {
  try {
    const query = {};
    if (!isAdminRole(req.user.role)) {
      query.$or = [{ clientUserId: String(req.user._id) }, { providerUserId: String(req.user._id) }];
    }
    if (req.query.status) query.status = req.query.status;
    const jobs = await getDB().collection('jobs_ledger').find(query).sort({ createdAt: -1 }).toArray();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/v1/jobs', requireAuth, async (req, res) => {
  try {
    const { providerId, serviceId, packageId = null, quotedGrossPrice, notes = '' } = req.body;
    if (!providerId || !serviceId || !Number.isFinite(Number(quotedGrossPrice))) {
      return res.status(400).json({ error: 'providerId, serviceId, and quotedGrossPrice are required' });
    }

    const providerQuery = Number.isInteger(Number(providerId))
      ? { id: Number(providerId) }
      : parseObjectId(providerId) ? { _id: parseObjectId(providerId) } : null;
    if (!providerQuery) return res.status(400).json({ error: 'Invalid providerId' });

    const provider = await getDB().collection('providers').findOne(providerQuery);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    if (provider.discoverable === false) return res.status(409).json({ error: 'Provider is temporarily unavailable' });

    const now = new Date();
    const jobNumber = `NM-${now.getUTCFullYear()}-${Math.floor(Date.now() / 1000).toString().slice(-8)}`;
    const grossPrice = round2(quotedGrossPrice);

    const resolvedProviderUserId = String(provider.userId || req.user._id || '').trim();
    const job = {
      jobNumber,
      serviceId: String(serviceId),
      packageId: packageId ? String(packageId) : null,
      clientUserId: String(req.user._id),
      clientEmail: req.user.email || '',
      providerId: provider.id ?? null,
      providerObjectId: String(provider._id),
      providerUserId: resolvedProviderUserId,
      status: STATES.INQUIRY,
      stateFlags: {
        cancelLocked: false,
        disputeOpen: false,
      },
      quote: {
        grossPrice,
        currency: 'PHP',
      },
      financials: {
        currency: 'PHP',
        grossPrice,
        platformFeeRate: PLATFORM_FEE_RATE,
        platformFeeAmount: round2(grossPrice * PLATFORM_FEE_RATE),
        providerNetPayout: round2(grossPrice * (1 - PLATFORM_FEE_RATE)),
        paymentMethod: null,
        paymentStatus: 'unpaid',
      },
      payment: {
        method: null,
        proofUrl: null,
        uploadedAt: null,
        verifiedByAdminId: null,
        verifiedAt: null,
        verificationNote: null,
      },
      notes: String(notes || ''),
      workflow: addJobEvent([], STATES.INQUIRY, req.user._id, 'client', 'job created'),
      createdAt: now,
      updatedAt: now,
    };

    const result = await getDB().collection('jobs_ledger').insertOne(job);
    const created = { ...job, _id: result.insertedId };
    emitAlertToUsers([created.providerUserId], 'job:created', created);
    emitAlertToRole('admin', 'job:created', created);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const acceptInquiryHandler = async (req, res) => {
  try {
    const {
      clientUserId,
      providerId,
      serviceCategory,
      bookingDate,
      bookingTime,
      address,
      notes = '',
      conversationId = null,
      inquiryMessageId = null,
      inquiryPayload = null,
      quotedPrice = null,
      quoteBreakdown = '',
      quoteInclusions = [],
      quoteDescription = '',
    } = req.body || {};

    if (!providerId || !bookingDate || !bookingTime || !address) {
      return res.status(400).json({ error: 'providerId, bookingDate, bookingTime, and address are required' });
    }

    const providerQuery = Number.isInteger(Number(providerId))
      ? { id: Number(providerId) }
      : parseObjectId(providerId) ? { _id: parseObjectId(providerId) } : { _id: providerId };
    const provider = await getDB().collection('providers').findOne(providerQuery);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const providerOwnerMatch = String(provider.userId || '') === String(req.user._id)
      || (provider.email && req.user.email && String(provider.email).toLowerCase() === String(req.user.email).toLowerCase());
    if (!providerOwnerMatch && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Only the assigned provider can accept this inquiry' });
    }

    let resolvedClientUserId = clientUserId ? String(clientUserId) : '';
    if (!resolvedClientUserId && conversationId && ObjectId.isValid(conversationId)) {
      const convo = await getDB().collection('conversations').findOne({ _id: new ObjectId(conversationId) });
      resolvedClientUserId = String(convo?.customerUserId || convo?.customer?.id || '').trim();
    }
    if (!resolvedClientUserId) {
      return res.status(400).json({ error: 'clientUserId is required (or a valid conversationId with customer reference)' });
    }

    const scheduledAt = new Date(`${bookingDate}T${bookingTime}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ error: 'Invalid booking date/time' });
    }

    const dateKey = scheduledAt.toISOString().slice(0, 10);
    const dayKey = weekdayKeys[scheduledAt.getDay()];
    const overrides = provider.availabilityOverrides && typeof provider.availabilityOverrides === 'object'
      ? provider.availabilityOverrides
      : {};
    const dayOverride = overrides[dateKey] || null;
    const defaultAvailableDays = Array.isArray(provider.availabilityDays) && provider.availabilityDays.length > 0
      ? provider.availabilityDays
      : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const availableByDay = dayOverride ? dayOverride.available !== false : defaultAvailableDays.includes(dayKey);
    if (!availableByDay) {
      return res.status(409).json({
        error: 'OUTSIDE_PROVIDER_AVAILABILITY',
        message: 'Selected date is outside the provider availability.',
      });
    }
    const startTime = dayOverride?.start || provider.workingHours?.start || '08:00';
    const endTime = dayOverride?.end || provider.workingHours?.end || '18:00';
    const minutes = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
    const startMinutes = parseHHMMToMinutes(startTime, '08:00');
    const endMinutes = parseHHMMToMinutes(endTime, '18:00');
    if (minutes < startMinutes || minutes > endMinutes) {
      return res.status(409).json({
        error: 'OUTSIDE_PROVIDER_WORKING_HOURS',
        message: `Selected time is outside provider working hours (${startTime}-${endTime}).`,
      });
    }

    const collision = await getDB().collection('jobs_ledger').findOne({
      providerUserId: String(provider.userId || ''),
      status: { $in: bookedStates },
      scheduledAt,
    });
    if (collision) {
      return res.status(409).json({
        error: 'COLLISION_DETECTED',
        message: 'Another appointment already exists at the same date and time. Please adjust to a different schedule.',
        collisionJobId: String(collision._id),
      });
    }

    const derivedInquiryId = String(
      inquiryMessageId
      || inquiryPayload?.inquiryId
      || ''
    ).trim();
    const duplicateInquiry = derivedInquiryId
      ? await getDB().collection('jobs_ledger').findOne({
        providerUserId: String(provider.userId || req.user._id || '').trim(),
        status: { $in: bookedStates },
        inquiryMessageId: derivedInquiryId,
      })
      : null;
    if (duplicateInquiry) {
      return res.status(409).json({
        error: 'DUPLICATE_INQUIRY_ACCEPT',
        message: 'This inquiry has already been accepted.',
        jobId: String(duplicateInquiry._id),
      });
    }

    const clientObjectId = parseObjectId(resolvedClientUserId);
    const client = clientObjectId
      ? await getDB().collection('users').findOne({ _id: clientObjectId })
      : null;
    const clientName = String(
      client?.name
      || [client?.fname, client?.lname].filter(Boolean).join(' ')
      || ''
    ).trim();

    const now = new Date();
    const normalizedQuotedPrice = Number.isFinite(Number(quotedPrice)) && Number(quotedPrice) > 0
      ? round2(quotedPrice)
      : null;
    const grossPrice = normalizedQuotedPrice ?? round2(provider.rate || 0);
    const normalizedInclusions = Array.isArray(quoteInclusions)
      ? quoteInclusions.map((line) => String(line || '').trim()).filter(Boolean)
      : [];
    const normalizedBreakdown = String(quoteBreakdown || '').trim();
    const normalizedQuoteDescription = String(quoteDescription || '').trim();
    const jobNumber = `NM-${now.getUTCFullYear()}-${Math.floor(Date.now() / 1000).toString().slice(-8)}`;
    const resolvedProviderUserId = String(provider.userId || req.user._id || '').trim();
    const createdJob = {
      jobNumber,
      serviceId: String(serviceCategory || provider.serviceId || 'other'),
      packageId: null,
      clientUserId: String(resolvedClientUserId),
      clientName: clientName || 'Customer',
      clientEmail: client?.email || '',
      providerId: provider.id ?? null,
      providerObjectId: String(provider._id),
      providerUserId: resolvedProviderUserId,
      status: STATES.ACCEPTED,
      stateFlags: {
        cancelLocked: false,
        disputeOpen: false,
      },
      scheduledAt,
      appointment: {
        bookingDate: String(bookingDate),
        bookingTime: String(bookingTime),
        address: String(address),
        notes: String(notes || ''),
      },
      inquiryPayload: inquiryPayload || null,
      inquiryMessageId: derivedInquiryId || null,
      conversationId: conversationId ? String(conversationId) : null,
      quote: {
        grossPrice,
        currency: 'PHP',
        source: normalizedQuotedPrice ? 'custom' : 'default',
        breakdown: normalizedBreakdown || '',
        inclusions: normalizedInclusions,
        description: normalizedQuoteDescription || '',
      },
      financials: {
        currency: 'PHP',
        grossPrice,
        platformFeeRate: PLATFORM_FEE_RATE,
        platformFeeAmount: round2(grossPrice * PLATFORM_FEE_RATE),
        providerNetPayout: round2(grossPrice * (1 - PLATFORM_FEE_RATE)),
        paymentMethod: null,
        paymentStatus: 'unpaid',
      },
      payment: {
        method: null,
        proofUrl: null,
        uploadedAt: null,
        verifiedByAdminId: null,
        verifiedAt: null,
        verificationNote: null,
      },
      notes: String(notes || ''),
      workflow: [
        { status: STATES.INQUIRY, at: now, actorId: String(resolvedClientUserId), role: 'client', note: 'inquiry received' },
        { status: STATES.ACCEPTED, at: now, actorId: String(req.user._id), role: 'provider', note: 'inquiry accepted and scheduled' },
      ],
      createdAt: now,
      updatedAt: now,
      acceptedAt: now,
    };

    const result = await getDB().collection('jobs_ledger').insertOne(createdJob);
    const inserted = { ...createdJob, _id: result.insertedId };
    emitAlertToUsers([inserted.clientUserId, inserted.providerUserId], 'job:accepted', inserted);
    emitAlertToRole('admin', 'job:accepted', inserted);
    res.status(201).json(inserted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

router.post('/v1/jobs/accept-inquiry', requireAuth, acceptInquiryHandler);
router.post('/jobs/accept-inquiry', requireAuth, acceptInquiryHandler);

router.patch('/v1/jobs/:id/accept', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });
    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isProviderActor(job, req.user)) return res.status(403).json({ error: 'Only assigned provider can accept' });
    if (!canTransition(job.status, STATES.ACCEPTED)) return res.status(409).json({ error: `Invalid transition from ${job.status}` });

    const updated = await getDB().collection('jobs_ledger').findOneAndUpdate(
      { _id: id, status: job.status },
      {
        $set: { status: STATES.ACCEPTED, updatedAt: new Date(), acceptedAt: new Date() },
        $setOnInsert: {},
        $push: { workflow: { status: STATES.ACCEPTED, at: new Date(), actorId: String(req.user._id), role: 'provider', note: String(req.body?.providerNote || '') } },
      },
      { returnDocument: 'after' }
    );
    emitAlertToUsers([updated.clientUserId, updated.providerUserId], 'job:accepted', updated);
    emitAlertToRole('admin', 'job:accepted', updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/v1/jobs/:id/start-work', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });
    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isProviderActor(job, req.user)) return res.status(403).json({ error: 'Only assigned provider can start work' });
    if (!canTransition(job.status, STATES.IN_PROGRESS)) return res.status(409).json({ error: `Invalid transition from ${job.status}` });

    const updated = await getDB().collection('jobs_ledger').findOneAndUpdate(
      { _id: id, status: job.status },
      {
        $set: {
          status: STATES.IN_PROGRESS,
          updatedAt: new Date(),
          startedAt: new Date(),
          'stateFlags.cancelLocked': true,
        },
        $push: { workflow: { status: STATES.IN_PROGRESS, at: new Date(), actorId: String(req.user._id), role: 'provider', note: 'work started' } },
      },
      { returnDocument: 'after' }
    );
    emitAlertToUsers([updated.clientUserId, updated.providerUserId], 'job:started', updated);
    emitAlertToRole('admin', 'job:started', updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/v1/jobs/:id/cancel', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });
    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isParticipantOrAdmin(job, req.user)) return res.status(403).json({ error: 'Access denied' });
    if (job.stateFlags?.cancelLocked || job.status === STATES.IN_PROGRESS) {
      return res.status(409).json({ error: 'CANCELLATION_LOCKED' });
    }
    if (![STATES.ACCEPTED, STATES.INQUIRY].includes(job.status)) {
      return res.status(409).json({ error: `Cannot cancel from ${job.status}` });
    }

    const updated = await getDB().collection('jobs_ledger').findOneAndUpdate(
      { _id: id, status: job.status },
      {
        $set: { status: STATES.INQUIRY, updatedAt: new Date() },
        $push: { workflow: { status: STATES.INQUIRY, at: new Date(), actorId: String(req.user._id), role: req.user.role || 'user', note: String(req.body?.reason || 'cancelled') } },
      },
      { returnDocument: 'after' }
    );
    emitAlertToUsers([updated.clientUserId, updated.providerUserId], 'job:cancelled-to-inquiry', updated);
    emitAlertToRole('admin', 'job:cancelled-to-inquiry', updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/v1/jobs/:id/request-payment', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });
    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isProviderActor(job, req.user)) return res.status(403).json({ error: 'Only provider can request payment' });
    if (!canTransition(job.status, STATES.PENDING_PAYMENT)) return res.status(409).json({ error: `Invalid transition from ${job.status}` });

    const gross = Number.isFinite(Number(req.body?.finalGrossPrice)) ? round2(req.body.finalGrossPrice) : round2(job.financials?.grossPrice || 0);
    const platformFee = round2(gross * PLATFORM_FEE_RATE);
    const providerNet = round2(gross - platformFee);

    const updated = await getDB().collection('jobs_ledger').findOneAndUpdate(
      { _id: id, status: job.status },
      {
        $set: {
          status: STATES.PENDING_PAYMENT,
          updatedAt: new Date(),
          pendingPaymentAt: new Date(),
          financials: {
            currency: 'PHP',
            grossPrice: gross,
            platformFeeRate: PLATFORM_FEE_RATE,
            platformFeeAmount: platformFee,
            providerNetPayout: providerNet,
            paymentMethod: null,
            paymentStatus: 'awaiting_payment',
          },
          workSummary: String(req.body?.workSummary || ''),
        },
        $push: { workflow: { status: STATES.PENDING_PAYMENT, at: new Date(), actorId: String(req.user._id), role: 'provider', note: 'payment requested' } },
      },
      { returnDocument: 'after' }
    );
    emitAlertToUsers([updated.clientUserId], 'job:pending-payment', updated);
    emitAlertToRole('admin', 'job:pending-payment', updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/v1/jobs/:id/payment/qr-proof', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });
    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isClientActor(job, req.user)) return res.status(403).json({ error: 'Only client can upload payment proof' });
    if (!canTransition(job.status, STATES.PENDING_VERIFICATION)) return res.status(409).json({ error: `Invalid transition from ${job.status}` });

    const proofUrl = String(req.body?.proofUrl || '').trim();
    if (!proofUrl) return res.status(400).json({ error: 'proofUrl is required' });
    const declaredAmount = round2(req.body?.declaredAmount || 0);
    if (declaredAmount && round2(job.financials?.grossPrice || 0) !== declaredAmount) {
      return res.status(409).json({ error: 'Declared amount mismatch' });
    }

    const updated = await getDB().collection('jobs_ledger').findOneAndUpdate(
      { _id: id, status: job.status },
      {
        $set: {
          status: STATES.PENDING_VERIFICATION,
          updatedAt: new Date(),
          payment: {
            ...(job.payment || {}),
            method: 'qr',
            proofUrl,
            reference: String(req.body?.reference || ''),
            uploadedAt: new Date(),
          },
          financials: {
            ...(job.financials || {}),
            paymentMethod: 'qr',
            paymentStatus: 'proof_uploaded',
          },
        },
        $push: { workflow: { status: STATES.PENDING_VERIFICATION, at: new Date(), actorId: String(req.user._id), role: 'client', note: 'qr proof uploaded' } },
      },
      { returnDocument: 'after' }
    );

    emitAlertToUsers([updated.providerUserId], 'job:payment-verification-pending', {
      jobId: String(updated._id),
      providerUserId: updated.providerUserId,
      message: 'Payment is pending admin verification',
      flash: true,
    });
    emitAlertToRole('admin', 'job:payment-verification-pending', {
      jobId: String(updated._id),
      providerUserId: updated.providerUserId,
      message: 'Payment is pending admin verification',
      flash: true,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/v1/jobs/:id/payment/cash-confirm', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });
    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (![STATES.PENDING_PAYMENT].includes(job.status)) {
      return res.status(409).json({ error: `Invalid transition from ${job.status}` });
    }
    if (!isParticipantOrAdmin(job, req.user)) return res.status(403).json({ error: 'Access denied' });
    if (!req.body?.providerConfirm || !req.body?.clientConfirm) {
      return res.status(400).json({ error: 'Both providerConfirm and clientConfirm must be true' });
    }

    const confirmedAmount = round2(req.body?.confirmedAmount || job.financials?.grossPrice || 0);
    if (confirmedAmount !== round2(job.financials?.grossPrice || 0)) {
      return res.status(409).json({ error: 'Confirmed amount mismatch' });
    }

    const provider = await getDB().collection('providers').findOne({ userId: String(job.providerUserId) });
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const platformFee = round2(confirmedAmount * PLATFORM_FEE_RATE);
    await updateProviderWalletForCash(provider, job._id, platformFee);
    await finalizeCompletion({ job, paymentMethod: 'cash' });

    const completed = await getDB().collection('jobs_ledger').findOne({ _id: id });
    emitAlertToUsers([completed.clientUserId, completed.providerUserId], 'job:completed', completed);
    emitAlertToRole('admin', 'job:completed', completed);
    res.json(completed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/v1/jobs/:id/payment/cashless-checkout', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });
    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== STATES.PENDING_PAYMENT) {
      return res.status(409).json({ error: `Invalid transition from ${job.status}` });
    }
    if (!isClientActor(job, req.user) && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Only the client can start cashless checkout' });
    }

    const amountCentavos = toCentavos(job.financials?.grossPrice || 0);
    if (amountCentavos <= 0) return res.status(400).json({ error: 'Invalid job amount' });

    const frontendBase = String(
      process.env.FRONTEND_URL
      || process.env.CLIENT_ORIGIN?.split(',')?.[0]
      || 'http://localhost:5173'
    ).trim().replace(/\/+$/, '');
    const secretKey = String(process.env.PAYMONGO_SECRET_KEY || '').trim();
    if (!secretKey) {
      return res.status(503).json({ error: 'PAYMONGO_SECRET_KEY is required for tracked cashless payments' });
    }
    const nearmeJobId = String(job._id);
    const nearmeRef = String(job.jobNumber || job._id);
    const auth = Buffer.from(`${secretKey}:`).toString('base64');
    const checkoutPayload = {
      data: {
        attributes: {
          billing: {
            name: String(req.user?.name || req.user?.fname || req.user?.email || 'NearMe Customer'),
            email: String(req.user?.email || ''),
          },
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          description: `NearMe payment for ${nearmeRef}`,
          reference_number: nearmeRef,
          payment_method_types: payMongoCheckoutMethods(),
          currency: 'PHP',
          line_items: [
            {
              currency: 'PHP',
              amount: amountCentavos,
              name: `NearMe Service ${nearmeRef}`,
              quantity: 1,
            },
          ],
          metadata: {
            nearmeJobId,
            nearmeRef,
          },
          success_url: `${frontendBase}/my-orders?cashless=success&jobId=${encodeURIComponent(nearmeJobId)}`,
          cancel_url: `${frontendBase}/my-orders?cashless=cancel&jobId=${encodeURIComponent(nearmeJobId)}`,
        },
      },
    };

    const pmResponse = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutPayload),
    });
    const pmJson = await pmResponse.json().catch(() => ({}));
    if (!pmResponse.ok) {
      const apiError = pmJson?.errors?.[0]?.detail || pmJson?.errors?.[0]?.code || 'PayMongo checkout creation failed';
      throw new Error(apiError);
    }

    const checkoutUrl = String(pmJson?.data?.attributes?.checkout_url || '').trim();
    const checkoutSessionId = String(pmJson?.data?.id || '').trim();
    if (!checkoutUrl || !checkoutSessionId) throw new Error('PayMongo checkout session details missing');

    await getDB().collection('jobs_ledger').updateOne(
      { _id: id },
      {
        $set: {
          'payment.cashless.checkoutUrl': checkoutUrl,
          'payment.cashless.checkoutSessionId': checkoutSessionId || null,
          'payment.cashless.createdAt': new Date(),
          'payment.cashless.state': 'initiated',
          'payment.cashless.referenceNumber': nearmeRef,
        },
      }
    );

    res.json({ checkoutUrl, checkoutSessionId, mode: 'checkout_session' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/v1/payments/paymongo/webhook', async (req, res) => {
  try {
    const configuredToken = String(process.env.PAYMONGO_WEBHOOK_TOKEN || '').trim();
    if (configuredToken) {
      const headerToken = String(req.headers['x-nearme-webhook-token'] || '');
      const queryToken = String(req.query?.token || '');
      if (headerToken !== configuredToken && queryToken !== configuredToken) {
        return res.status(401).json({ error: 'Invalid webhook token' });
      }
    }

    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const eventId = String(payload?.data?.id || payload?.id || crypto.randomUUID());
    const eventType = String(payload?.data?.attributes?.type || payload?.type || '').toLowerCase();
    const eventData = payload?.data?.attributes?.data || {};
    const eventDataAttributes = eventData?.attributes || {};
    const eventDataId = String(eventData?.id || eventDataAttributes?.id || '').trim();
    const attributes = eventDataAttributes
      || payload?.data?.attributes?.attributes
      || payload?.data?.attributes
      || {};
    const metadata = attributes?.metadata || {};
    const paidAmountCentavos = Number(
      attributes?.amount
      || attributes?.amount_paid
      || attributes?.net_amount
      || eventDataAttributes?.payments?.[0]?.attributes?.amount
      || eventDataAttributes?.payments?.[0]?.attributes?.amount_paid
      || eventDataAttributes?.payments?.[0]?.attributes?.net_amount
      || 0
    );

    await getDB().collection('payment_webhook_logs').updateOne(
      { provider: 'paymongo', eventId },
      {
        $setOnInsert: {
          provider: 'paymongo',
          eventId,
          eventType,
          createdAt: new Date(),
          payload,
        },
      },
      { upsert: true }
    );

    const looksPaidEvent = [
      'payment.paid',
      'link.payment.paid',
      'checkout_session.payment.paid',
    ].includes(eventType) || eventType.endsWith('.payment.paid');
    if (!looksPaidEvent) return res.json({ received: true, skipped: true });

    const nearmeJobId = String(
      metadata?.nearmeJobId
      || attributes?.metadata?.nearmeJobId
      || eventDataAttributes?.metadata?.nearmeJobId
      || ''
    ).trim();
    let job = null;
    if (nearmeJobId && ObjectId.isValid(nearmeJobId)) {
      job = await getDB().collection('jobs_ledger').findOne({ _id: new ObjectId(nearmeJobId) });
    }
    if (!job && eventDataId) {
      job = await getDB().collection('jobs_ledger').findOne({ 'payment.cashless.checkoutSessionId': eventDataId });
    }
    if (!job && paidAmountCentavos > 0) {
      // Fallback for hosted payment links where job metadata may not be present in webhook payload.
      const fallbackCandidates = await getDB().collection('jobs_ledger').find({
        status: STATES.PENDING_PAYMENT,
        'financials.grossPrice': round2(paidAmountCentavos / 100),
        'payment.cashless.state': 'initiated',
      }).sort({ 'payment.cashless.createdAt': -1, createdAt: -1 }).limit(5).toArray();
      job = fallbackCandidates[0] || null;
    }
    if (!job) {
      return res.json({ received: true, skipped: true, reason: 'job_not_resolved' });
    }
    if (job.status === STATES.COMPLETED) return res.json({ received: true, skipped: true, reason: 'already_completed' });
    if (job.status !== STATES.PENDING_PAYMENT) return res.json({ received: true, skipped: true, reason: 'job_not_pending_payment' });

    const expectedCentavos = toCentavos(job.financials?.grossPrice || 0);
    if (paidAmountCentavos > 0 && paidAmountCentavos !== expectedCentavos) {
      return res.json({ received: true, skipped: true, reason: 'amount_mismatch' });
    }

    const completedNow = await finalizeCompletion({ job, paymentMethod: 'cashless' });
    await getDB().collection('jobs_ledger').updateOne(
      { _id: job._id },
      { $set: { 'payment.cashless.state': 'paid_webhook', 'payment.cashless.webhookEventId': eventId } }
    );
    const completed = await getDB().collection('jobs_ledger').findOne({ _id: job._id });
    emitAlertToUsers([completed.clientUserId, completed.providerUserId], 'job:completed', completed);
    emitAlertToRole('admin', 'job:completed', completed);
    return res.json({ received: true, completed: true, newlyCompleted: completedNow, jobId: nearmeJobId || String(job._id) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/v1/jobs/:id/payment/cashless-sync', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });

    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isParticipantOrAdmin(job, req.user)) return res.status(403).json({ error: 'Access denied' });

    if (job.status === STATES.COMPLETED) {
      return res.json({ synced: true, alreadyCompleted: true, job });
    }
    if (job.status !== STATES.PENDING_PAYMENT) {
      return res.status(409).json({ error: `Invalid transition from ${job.status}` });
    }

    const secretKey = String(process.env.PAYMONGO_SECRET_KEY || '').trim();
    if (!secretKey) {
      return res.status(503).json({ error: 'PAYMONGO_SECRET_KEY is not configured' });
    }

    const auth = Buffer.from(`${secretKey}:`).toString('base64');
    const checkoutSessionId = String(job?.payment?.cashless?.checkoutSessionId || '').trim();
    let isPaid = false;
    let paymentStatuses = [];
    let checkoutSessionStatus = '';
    let matchSource = '';

    if (checkoutSessionId) {
      const pmResponse = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(checkoutSessionId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      const pmJson = await pmResponse.json().catch(() => ({}));
      if (!pmResponse.ok) {
        const apiError = pmJson?.errors?.[0]?.detail || pmJson?.errors?.[0]?.code || 'PayMongo status check failed';
        return res.status(502).json({ error: apiError });
      }

      const attrs = pmJson?.data?.attributes || {};
      const payments = Array.isArray(attrs?.payments) ? attrs.payments : [];
      paymentStatuses = payments.map((item) => String(item?.attributes?.status || '').toLowerCase()).filter(Boolean);
      const paidByPayment = paymentStatuses.some((status) => ['paid', 'succeeded', 'successful'].includes(status));
      const paidBySession = ['paid', 'succeeded', 'successful'].includes(String(attrs?.payment_status || attrs?.status || '').toLowerCase());
      const paidByTimestamp = Boolean(attrs?.paid_at) || payments.some((item) => Boolean(item?.attributes?.paid_at));
      isPaid = paidByPayment || paidBySession || paidByTimestamp;
      checkoutSessionStatus = String(attrs?.payment_status || attrs?.status || '');
      if (!checkoutSessionStatus && paidByTimestamp) checkoutSessionStatus = 'paid';
      matchSource = 'checkout_session';
    } else {
      // Hosted payment-link fallback: look for a recent paid payment matching this job's amount and customer details.
      const expectedCentavos = toCentavos(job.financials?.grossPrice || 0);
      const clientEmail = String(job.clientEmail || req.user?.email || '').trim().toLowerCase();
      const startedAt = new Date(job?.payment?.cashless?.createdAt || job.pendingPaymentAt || job.updatedAt || job.createdAt || 0).getTime();
      const pmResponse = await fetch('https://api.paymongo.com/v1/payments?limit=30', {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      const pmJson = await pmResponse.json().catch(() => ({}));
      if (!pmResponse.ok) {
        const apiError = pmJson?.errors?.[0]?.detail || pmJson?.errors?.[0]?.code || 'PayMongo payments list failed';
        return res.status(502).json({ error: apiError });
      }
      const payments = Array.isArray(pmJson?.data) ? pmJson.data : [];
      const match = payments.find((item) => {
        const attrs = item?.attributes || {};
        const amount = Number(attrs?.amount || 0);
        const status = String(attrs?.status || '').toLowerCase();
        const email = String(attrs?.billing?.email || '').trim().toLowerCase();
        const paidAtMs = new Date(attrs?.paid_at || attrs?.created_at || 0).getTime();
        const withinWindow = Number.isFinite(paidAtMs) && paidAtMs >= startedAt - 10 * 60 * 1000;
        const emailMatch = clientEmail ? email === clientEmail : true;
        return amount === expectedCentavos && ['paid', 'succeeded', 'successful'].includes(status) && emailMatch && withinWindow;
      });
      if (match) {
        isPaid = true;
        paymentStatuses = [String(match?.attributes?.status || '').toLowerCase()];
        checkoutSessionStatus = 'paid';
        matchSource = 'payments_list_fallback';
      }
    }

    await getDB().collection('jobs_ledger').updateOne(
      { _id: id },
      {
        $set: {
          'payment.cashless.lastPolledAt': new Date(),
          'payment.cashless.lastPolledStatus': checkoutSessionStatus || 'unknown',
          'payment.cashless.lastMatchSource': matchSource || 'none',
        },
      }
    );

    if (!isPaid) {
      return res.json({
        synced: false,
        pending: true,
        reason: 'not_paid_yet',
        paymentStatuses,
        checkoutSessionStatus,
      });
    }

    await finalizeCompletion({ job, paymentMethod: 'cashless' });
    await getDB().collection('jobs_ledger').updateOne(
      { _id: id },
      {
        $set: {
          'payment.cashless.state': 'paid_api_poll',
          'payment.cashless.polledPaidAt': new Date(),
          'payment.cashless.polledCheckoutSessionId': checkoutSessionId,
        },
      }
    );
    const completed = await getDB().collection('jobs_ledger').findOne({ _id: id });
    emitAlertToUsers([completed.clientUserId, completed.providerUserId], 'job:completed', completed);
    emitAlertToRole('admin', 'job:completed', completed);
    return res.json({ synced: true, completed: true, job: completed });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/v1/admin/payments/paymongo/debug', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.user?.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limitRaw = Number(req.query?.limit || 20);
    const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 20));
    const eventTypeQuery = String(req.query?.eventType || '').trim().toLowerCase();
    const jobIdQuery = String(req.query?.jobId || '').trim();

    const logs = await getDB().collection('payment_webhook_logs')
      .find({ provider: 'paymongo' })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    const transformed = logs
      .map((log) => {
        const payload = log?.payload || {};
        const eventType = String(payload?.data?.attributes?.type || payload?.type || log?.eventType || '').toLowerCase();
        const eventData = payload?.data?.attributes?.data || {};
        const eventDataAttrs = eventData?.attributes || {};
        const eventDataId = String(eventData?.id || eventDataAttrs?.id || '').trim();
        const metadata = eventDataAttrs?.metadata || payload?.data?.attributes?.metadata || {};
        const nearmeJobId = String(metadata?.nearmeJobId || '').trim();
        const paidAmountCentavos = Number(
          eventDataAttrs?.amount
          || eventDataAttrs?.amount_paid
          || eventDataAttrs?.net_amount
          || eventDataAttrs?.payments?.[0]?.attributes?.amount
          || eventDataAttrs?.payments?.[0]?.attributes?.amount_paid
          || eventDataAttrs?.payments?.[0]?.attributes?.net_amount
          || 0
        );
        const paidAmountPhp = round2(paidAmountCentavos / 100);
        return {
          eventId: String(log?.eventId || ''),
          eventType,
          eventDataId,
          createdAt: log?.createdAt || null,
          nearmeJobId,
          nearmeRef: String(metadata?.nearmeRef || eventDataAttrs?.reference_number || '').trim(),
          paidAmountCentavos,
          paidAmountPhp,
        };
      })
      .filter((entry) => !eventTypeQuery || entry.eventType === eventTypeQuery)
      .filter((entry) => !jobIdQuery || entry.nearmeJobId === jobIdQuery || entry.nearmeRef === jobIdQuery)
      .slice(0, limit);

    const jobIdCandidates = [...new Set(
      transformed
        .map((entry) => entry.nearmeJobId)
        .filter((value) => ObjectId.isValid(value))
    )].map((id) => new ObjectId(id));

    const relatedJobs = jobIdCandidates.length > 0
      ? await getDB().collection('jobs_ledger').find(
        { _id: { $in: jobIdCandidates } },
        {
          projection: {
            jobNumber: 1,
            status: 1,
            updatedAt: 1,
            financials: 1,
            payment: 1,
          },
        }
      ).toArray()
      : [];

    const jobsById = new Map(relatedJobs.map((job) => [String(job._id), job]));

    const items = transformed.map((entry) => {
      const job = jobsById.get(entry.nearmeJobId);
      return {
        ...entry,
        resolvedJob: job ? {
          _id: String(job._id),
          jobNumber: job.jobNumber || null,
          status: job.status || null,
          updatedAt: job.updatedAt || null,
          grossPrice: round2(job.financials?.grossPrice || 0),
          paymentStatus: String(job.financials?.paymentStatus || ''),
          cashlessState: String(job.payment?.cashless?.state || ''),
          checkoutSessionId: String(job.payment?.cashless?.checkoutSessionId || ''),
          webhookEventId: String(job.payment?.cashless?.webhookEventId || ''),
        } : null,
      };
    });

    return res.json({
      success: true,
      provider: 'paymongo',
      filters: {
        limit,
        eventType: eventTypeQuery || null,
        jobId: jobIdQuery || null,
      },
      count: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/v1/admin/jobs/:id/verify-payment', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });
    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isAdminRole(req.user.role) && !isProviderActor(job, req.user)) {
      return res.status(403).json({ error: 'Admin or assigned provider access required' });
    }
    if (job.status !== STATES.PENDING_VERIFICATION) return res.status(409).json({ error: `Invalid transition from ${job.status}` });

    const decision = String(req.body?.decision || '').toLowerCase();
    const note = String(req.body?.note || '');
    if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be approve or reject' });

    if (decision === 'reject') {
      const reverted = await getDB().collection('jobs_ledger').findOneAndUpdate(
        { _id: id, status: job.status },
        {
          $set: {
            status: STATES.PENDING_PAYMENT,
            updatedAt: new Date(),
            'payment.verificationNote': note || 'payment proof rejected',
            'financials.paymentStatus': 'rejected',
          },
          $push: { workflow: { status: STATES.PENDING_PAYMENT, at: new Date(), actorId: String(req.user._id), role: 'admin', note: 'verification rejected' } },
        },
        { returnDocument: 'after' }
      );
      emitAlertToUsers([reverted.clientUserId, reverted.providerUserId], 'job:verification-rejected', reverted);
      emitAlertToRole('admin', 'job:verification-rejected', reverted);
      return res.json(reverted);
    }

    await finalizeCompletion({ job, paymentMethod: 'qr', verifiedByAdminId: req.user._id });
    const completed = await getDB().collection('jobs_ledger').findOne({ _id: id });
    emitAlertToUsers([completed.clientUserId, completed.providerUserId], 'job:completed', completed);
    emitAlertToRole('admin', 'job:completed', completed);
    res.json(completed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/v1/jobs/:id/dispute', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });
    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isParticipantOrAdmin(job, req.user)) return res.status(403).json({ error: 'Access denied' });
    if (![STATES.ACCEPTED, STATES.IN_PROGRESS, STATES.PENDING_PAYMENT, STATES.PENDING_VERIFICATION].includes(job.status)) {
      return res.status(409).json({ error: `Cannot dispute from ${job.status}` });
    }

    const updated = await getDB().collection('jobs_ledger').findOneAndUpdate(
      { _id: id, status: job.status },
      {
        $set: {
          status: STATES.DISPUTED,
          updatedAt: new Date(),
          'stateFlags.disputeOpen': true,
          dispute: {
            reasonCode: String(req.body?.reasonCode || 'general'),
            description: String(req.body?.description || ''),
            evidenceUrls: Array.isArray(req.body?.evidenceUrls) ? req.body.evidenceUrls.map((item) => String(item)) : [],
            openedBy: String(req.user._id),
            openedAt: new Date(),
          },
        },
        $push: { workflow: { status: STATES.DISPUTED, at: new Date(), actorId: String(req.user._id), role: req.user.role || 'user', note: 'dispute opened' } },
      },
      { returnDocument: 'after' }
    );
    emitAlertToUsers([updated.clientUserId, updated.providerUserId], 'job:disputed', updated);
    emitAlertToRole('admin', 'job:disputed', updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/v1/services', async (req, res) => {
  try {
    const services = await getDB().collection('services').find({ active: { $ne: false } }).sort({ label: 1 }).toArray();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/v1/providers/:id/offers', async (req, res) => {
  try {
    const providerId = String(req.params.id || '').trim();
    const providerQuery = Number.isInteger(Number(providerId))
      ? { id: Number(providerId) }
      : parseObjectId(providerId) ? { _id: parseObjectId(providerId) } : null;
    if (!providerQuery) return res.status(400).json({ error: 'Invalid provider id' });

    const provider = await getDB().collection('providers').findOne(providerQuery);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const providerUserId = String(provider.userId || '').trim();
    const bundleProviderIds = [...new Set([providerUserId, String(provider.id || '').trim(), String(provider._id || '').trim()].filter(Boolean))];
    const [fixedServices, customBundles] = await Promise.all([
      providerUserId
        ? getDB().collection('provider_services').find({
          providerUserId,
          active: { $ne: false },
        }).sort({ createdAt: -1 }).toArray()
        : [],
      getDB().collection('custom_packages').find({
        providerId: { $in: bundleProviderIds },
        active: { $ne: false },
      }).sort({ createdAt: -1 }).toArray(),
    ]);

    res.json({ fixedServices, customBundles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/v1/custom-packages', async (req, res) => {
  try {
    const query = { active: { $ne: false } };
    if (req.query.serviceId) query.serviceId = String(req.query.serviceId);
    if (req.query.providerId) query.providerId = String(req.query.providerId);
    const packages = await getDB().collection('custom_packages').find(query).sort({ createdAt: -1 }).toArray();
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const createCustomPackageHandler = async (req, res) => {
  try {
    if (!(isProviderRole(req.user.role) || isAdminRole(req.user.role))) {
      return res.status(403).json({ error: 'Provider or admin role required' });
    }
    const payload = {
      serviceId: String(req.body?.serviceId || ''),
      providerId: String(req.body?.providerId || req.user._id),
      title: String(req.body?.title || '').trim(),
      description: String(req.body?.description || '').trim(),
      durationWeeks: toNumber(req.body?.durationWeeks),
      visitCount: toNumber(req.body?.visitCount),
      scope: req.body?.scope || {},
      priceFixed: round2(req.body?.priceFixed || 0),
      currency: 'PHP',
      terms: req.body?.terms || {},
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!payload.serviceId || !payload.title || !payload.priceFixed) {
      return res.status(400).json({ error: 'serviceId, title, and priceFixed are required' });
    }

    const result = await getDB().collection('custom_packages').insertOne(payload);
    res.status(201).json({ ...payload, _id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
router.post('/v1/custom-packages', requireAuth, createCustomPackageHandler);
router.post('/custom-packages', requireAuth, createCustomPackageHandler);

const patchCustomPackageHandler = async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid package id' });
    const existing = await getDB().collection('custom_packages').findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: 'Package not found' });

    const isOwner = String(existing.providerId || '') === String(req.user._id);
    if (!isOwner && !isAdminRole(req.user.role)) return res.status(403).json({ error: 'Access denied' });

    const update = {};
    if (req.body.title !== undefined) update.title = String(req.body.title).trim();
    if (req.body.description !== undefined) update.description = String(req.body.description).trim();
    if (req.body.priceFixed !== undefined) update.priceFixed = round2(req.body.priceFixed);
    if (req.body.durationWeeks !== undefined) update.durationWeeks = toNumber(req.body.durationWeeks);
    if (req.body.visitCount !== undefined) update.visitCount = toNumber(req.body.visitCount);
    if (req.body.scope !== undefined) update.scope = req.body.scope || {};
    if (req.body.terms !== undefined) update.terms = req.body.terms || {};
    if (req.body.inclusions !== undefined) update.inclusions = Array.isArray(req.body.inclusions) ? req.body.inclusions.map((item) => String(item).trim()).filter(Boolean) : [];
    if (req.body.active !== undefined) update.active = Boolean(req.body.active);
    update.updatedAt = new Date();

    const updated = await getDB().collection('custom_packages').findOneAndUpdate(
      { _id: id },
      { $set: update },
      { returnDocument: 'after' }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
router.patch('/v1/custom-packages/:id', requireAuth, patchCustomPackageHandler);
router.patch('/custom-packages/:id', requireAuth, patchCustomPackageHandler);

const deleteCustomPackageHandler = async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid package id' });
    const existing = await getDB().collection('custom_packages').findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: 'Package not found' });
    const isOwner = String(existing.providerId || '') === String(req.user._id);
    if (!isOwner && !isAdminRole(req.user.role)) return res.status(403).json({ error: 'Access denied' });

    await getDB().collection('custom_packages').deleteOne({ _id: id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
router.delete('/v1/custom-packages/:id', requireAuth, deleteCustomPackageHandler);
router.delete('/custom-packages/:id', requireAuth, deleteCustomPackageHandler);

const getProviderServicesHandler = async (req, res) => {
  try {
    const providerUserId = req.query.providerUserId ? String(req.query.providerUserId) : String(req.user._id);
    if (providerUserId !== String(req.user._id) && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const services = await getDB().collection('provider_services').find({ providerUserId }).sort({ createdAt: -1 }).toArray();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
router.get('/v1/provider-services', requireAuth, getProviderServicesHandler);
router.get('/provider-services', requireAuth, getProviderServicesHandler);

const createProviderServiceHandler = async (req, res) => {
  try {
    const payload = {
      providerUserId: String(req.user._id),
      title: String(req.body?.title || '').trim(),
      category: String(req.body?.category || '').trim(),
      price: Math.round(toNumber(req.body?.price || 0)),
      durationHours: Math.max(0, toNumber(req.body?.durationHours || 0)),
      durationMinutes: Math.max(0, toNumber(req.body?.durationMinutes || 0)),
      description: String(req.body?.description || '').trim(),
      active: req.body?.active !== undefined ? Boolean(req.body.active) : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (!payload.title || !payload.category || !payload.description) {
      return res.status(400).json({ error: 'title, category, and description are required' });
    }
    if (payload.price <= 1) return res.status(400).json({ error: 'Price must be greater than PHP 1' });
    if (payload.durationHours === 0 && payload.durationMinutes === 0) {
      return res.status(400).json({ error: 'Duration cannot be zero' });
    }

    const result = await getDB().collection('provider_services').insertOne(payload);
    res.status(201).json({ ...payload, _id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
router.post('/v1/provider-services', requireAuth, createProviderServiceHandler);
router.post('/provider-services', requireAuth, createProviderServiceHandler);

const patchProviderServiceHandler = async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid service id' });
    const existing = await getDB().collection('provider_services').findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: 'Service not found' });
    if (String(existing.providerUserId || '') !== String(req.user._id) && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const update = {};
    if (req.body.title !== undefined) update.title = String(req.body.title).trim();
    if (req.body.category !== undefined) update.category = String(req.body.category).trim();
    if (req.body.price !== undefined) update.price = Math.round(toNumber(req.body.price));
    if (req.body.durationHours !== undefined) update.durationHours = Math.max(0, toNumber(req.body.durationHours));
    if (req.body.durationMinutes !== undefined) update.durationMinutes = Math.max(0, toNumber(req.body.durationMinutes));
    if (req.body.description !== undefined) update.description = String(req.body.description).trim();
    if (req.body.active !== undefined) update.active = Boolean(req.body.active);
    update.updatedAt = new Date();

    if (update.price !== undefined && update.price <= 1) return res.status(400).json({ error: 'Price must be greater than PHP 1' });
    const hours = update.durationHours !== undefined ? update.durationHours : existing.durationHours;
    const minutes = update.durationMinutes !== undefined ? update.durationMinutes : existing.durationMinutes;
    if (hours === 0 && minutes === 0) return res.status(400).json({ error: 'Duration cannot be zero' });

    const updated = await getDB().collection('provider_services').findOneAndUpdate(
      { _id: id },
      { $set: update },
      { returnDocument: 'after' }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
router.patch('/v1/provider-services/:id', requireAuth, patchProviderServiceHandler);
router.patch('/provider-services/:id', requireAuth, patchProviderServiceHandler);

const deleteProviderServiceHandler = async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid service id' });
    const existing = await getDB().collection('provider_services').findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: 'Service not found' });
    if (String(existing.providerUserId || '') !== String(req.user._id) && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await getDB().collection('provider_services').deleteOne({ _id: id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
router.delete('/v1/provider-services/:id', requireAuth, deleteProviderServiceHandler);
router.delete('/provider-services/:id', requireAuth, deleteProviderServiceHandler);

router.post('/v1/providers/:id/wallet/topup', requireAuth, async (req, res) => {
  try {
    const providerId = String(req.params.id);
    const amount = round2(req.body?.amount || 0);
    if (amount <= 0) return res.status(400).json({ error: 'amount must be greater than 0' });

    const providerQuery = Number.isInteger(Number(providerId))
      ? { id: Number(providerId) }
      : parseObjectId(providerId) ? { _id: parseObjectId(providerId) } : { userId: providerId };
    const provider = await getDB().collection('providers').findOne(providerQuery);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const isOwner = String(provider.userId || '') === String(req.user._id);
    if (!isOwner && !isAdminRole(req.user.role)) return res.status(403).json({ error: 'Access denied' });

    const currentBalance = toNumber(provider.walletBalance, 0);
    const nextBalance = round2(currentBalance + amount);
    const discoverable = nextBalance > WALLET_HIDE_THRESHOLD;

    await getDB().collection('provider_wallet_ledger').insertOne({
      providerId: provider.id ?? null,
      providerObjectId: String(provider._id),
      type: 'topup_credit',
      delta: amount,
      balanceBefore: currentBalance,
      balanceAfter: nextBalance,
      currency: 'PHP',
      paymentChannel: String(req.body?.paymentChannel || 'manual'),
      reference: String(req.body?.reference || ''),
      createdAt: new Date(),
    });

    const updated = await getDB().collection('providers').findOneAndUpdate(
      { _id: provider._id },
      { $set: { walletBalance: nextBalance, discoverable, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/v1/jobs/:id/review', requireAuth, async (req, res) => {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid job id' });
    const job = await getDB().collection('jobs_ledger').findOne({ _id: id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isClientActor(job, req.user)) return res.status(403).json({ error: 'Only the client can review this job' });
    if (job.status !== STATES.COMPLETED) return res.status(409).json({ error: 'Reviews are allowed only after completion' });

    const rating = Math.floor(toNumber(req.body?.rating));
    const text = String(req.body?.comment || '').trim();
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    if (text.length < 10 || text.length > 500) return res.status(400).json({ error: 'Comment must be 10 to 500 characters' });

    const existing = await getDB().collection('reviews').findOne({ jobId: String(job._id), customerUserId: String(req.user._id) });
    if (existing) return res.status(409).json({ error: 'Review already submitted for this job' });

    const review = {
      jobId: String(job._id),
      providerId: job.providerId ?? job.providerObjectId,
      providerUserId: String(job.providerUserId || ''),
      customerUserId: String(req.user._id),
      name: req.user.name || [req.user.fname, req.user.lname].filter(Boolean).join(' ') || 'Customer',
      rating,
      text,
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getDB().collection('reviews').insertOne(review);
    await getDB().collection('jobs_ledger').updateOne(
      { _id: job._id },
      { $set: { reviewedAt: new Date() }, $push: { workflow: { status: 'Reviewed', at: new Date(), actorId: String(req.user._id), role: 'client', note: 'review submitted' } } }
    );

    const providerQuery = Number.isInteger(Number(job.providerId))
      ? { id: Number(job.providerId) }
      : parseObjectId(job.providerObjectId) ? { _id: parseObjectId(job.providerObjectId) } : { userId: String(job.providerUserId || '') };
    const provider = await getDB().collection('providers').findOne(providerQuery);
    if (provider) {
      const nextReviews = toNumber(provider.reviews, 0) + 1;
      const nextRating = round2(((toNumber(provider.rating, 0) * toNumber(provider.reviews, 0)) + rating) / nextReviews);
      await getDB().collection('providers').updateOne(
        { _id: provider._id },
        { $set: { rating: nextRating, reviews: nextReviews, updatedAt: new Date() } }
      );
    }

    res.status(201).json({ ...review, _id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
