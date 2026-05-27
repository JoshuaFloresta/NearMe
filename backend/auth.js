import express from 'express';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDB } from './mongoConnect.js';
import {
  hashPassword,
  normalizeRole,
  publicUser,
  requireAuth,
  requireAdmin,
  signToken,
  verifyPassword,
} from './security.js';

const router = express.Router();

const validateAvatar = (avatar) => {
  if (avatar === undefined || avatar === null || avatar === '') return null;

  if (typeof avatar !== 'string') {
    return 'Avatar must be an image URL';
  }

  const isImageDataUrl = avatar.startsWith('data:image/');
  const isRemoteImageUrl = /^https?:\/\/.+/i.test(avatar);

  if (!isImageDataUrl && !isRemoteImageUrl) {
    return 'Avatar must be an image URL';
  }

  if (isImageDataUrl && avatar.length > 2_800_000) {
    return 'Avatar image is too large';
  }

  return null;
};

const createOtp = () => String(crypto.randomInt(100000, 999999));
const PASSWORD_RESET_PURPOSE = 'password_reset';
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const resetTokenHash = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const isDeployedRuntime = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

router.post('/otp/send', async (req, res) => {
  try {
    const { email, phone, purpose = 'signup' } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail && !phone) {
      return res.status(400).json({ error: 'Email or phone is required' });
    }
    if (purpose === PASSWORD_RESET_PURPOSE) {
      if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email is required to reset a password' });
      }
      const activeUser = await getDB().collection('users').findOne({
        email: normalizedEmail,
        isDeleted: { $ne: true },
        deletedAt: { $exists: false },
      });
      if (!activeUser) {
        return res.json({
          success: true,
          message: 'If that account exists, a password reset code has been sent.',
        });
      }
    }

    const code = createOtp();
    const identifier = normalizedEmail || phone;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await getDB().collection('otp_verifications').updateMany(
      { identifier, purpose, consumed: false },
      { $set: { consumed: true, invalidatedAt: new Date() } }
    );
    await getDB().collection('otp_verifications').insertOne({
      identifier,
      email: normalizedEmail || null,
      phone: phone || null,
      purpose,
      codeHash: hashPassword(code),
      consumed: false,
      expiresAt,
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: purpose === PASSWORD_RESET_PURPOSE
        ? 'If that account exists, a password reset code has been sent.'
        : 'OTP sent successfully',
      expiresAt,
      devOtp: isDeployedRuntime ? undefined : code,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/otp/verify', async (req, res) => {
  try {
    const { email, phone, otp, purpose = 'signup' } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const identifier = normalizedEmail || phone;

    if (!identifier || !otp) {
      return res.status(400).json({ error: 'Identifier and OTP are required' });
    }

    const record = await getDB().collection('otp_verifications').findOne({
      identifier,
      purpose,
      consumed: false,
      expiresAt: { $gt: new Date() },
    }, { sort: { createdAt: -1 } });

    if (!record || !verifyPassword(otp, record.codeHash)) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    await getDB().collection('otp_verifications').updateOne(
      { _id: record._id },
      { $set: { consumed: true, verifiedAt: new Date() } }
    );

    if (purpose === PASSWORD_RESET_PURPOSE) {
      const user = await getDB().collection('users').findOne({
        email: normalizedEmail,
        isDeleted: { $ne: true },
        deletedAt: { $exists: false },
      });
      if (!user) return res.status(400).json({ error: 'Invalid or expired OTP' });

      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await getDB().collection('password_reset_tokens').updateMany(
        { email: normalizedEmail, consumed: false },
        { $set: { consumed: true, invalidatedAt: new Date() } }
      );
      await getDB().collection('password_reset_tokens').insertOne({
        email: normalizedEmail,
        userId: String(user._id),
        tokenHash: resetTokenHash(resetToken),
        consumed: false,
        expiresAt,
        createdAt: new Date(),
      });
      return res.json({ success: true, message: 'OTP verified successfully', resetToken, expiresAt });
    }

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/password/reset', async (req, res) => {
  try {
    const normalizedEmail = req.body?.email?.trim().toLowerCase();
    const token = String(req.body?.resetToken || '').trim();
    const password = String(req.body?.password || '');
    if (!normalizedEmail || !token || !password) {
      return res.status(400).json({ error: 'Email, verification token, and new password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const record = await getDB().collection('password_reset_tokens').findOne({
      email: normalizedEmail,
      tokenHash: resetTokenHash(token),
      consumed: false,
      expiresAt: { $gt: new Date() },
    }, { sort: { createdAt: -1 } });
    if (!record || !ObjectId.isValid(record.userId)) {
      return res.status(400).json({ error: 'Reset session has expired. Request a new code.' });
    }
    const userQuery = {
      _id: new ObjectId(record.userId),
      email: normalizedEmail,
      isDeleted: { $ne: true },
      deletedAt: { $exists: false },
    };
    const updated = await getDB().collection('users').updateOne(
      userQuery,
      { $set: { password: hashPassword(password), passwordChangedAt: new Date(), updatedAt: new Date() } }
    );
    if (updated.matchedCount === 0) {
      return res.status(400).json({ error: 'Reset session is no longer valid.' });
    }
    await getDB().collection('password_reset_tokens').updateOne(
      { _id: record._id },
      { $set: { consumed: true, consumedAt: new Date() } }
    );
    res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { fname, lname, name, email, phone, password, role } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const displayName = name || [fname, lname].filter(Boolean).join(' ').trim();

    if (!normalizedEmail || !password || !displayName) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const users = getDB().collection('users');

    const existingUser = await users.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (phone) {
      const existingPhone = await users.findOne({ phone });
      if (existingPhone) {
        return res.status(409).json({ error: 'Phone number already registered' });
      }
    }

    const verifiedOtp = await getDB().collection('otp_verifications').findOneAndUpdate(
      {
        identifier: normalizedEmail,
        purpose: 'signup',
        consumed: true,
        verifiedAt: { $exists: true },
        signupConsumedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      },
      { $set: { signupConsumedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!verifiedOtp) {
      return res.status(400).json({ error: 'OTP verification is required' });
    }

    const normalizedRole = normalizeRole(role || 'customer');
    const isProvider = normalizedRole === 'provider';
    const newUser = {
      fname: fname || '',
      lname: lname || '',
      name: displayName,
      email: normalizedEmail,
      phone: phone || null,
      password: hashPassword(password),
      role: normalizedRole,
      status: 'active',
      verified: false,
      providerStatus: isProvider ? 'kyc_required' : null,
      emailVerified: true,
      phoneVerified: Boolean(phone),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await users.insertOne(newUser);
    const insertedUser = { ...newUser, _id: result.insertedId };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: result.insertedId,
      user: publicUser(insertedUser),
      token: signToken(insertedUser),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const users = getDB().collection('users');
    const user = await users.findOne({ email: normalizedEmail });

    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (['suspended', 'disabled'].includes(user.status)) {
      return res.status(403).json({ error: 'This account is not active' });
    }

    res.json({
      success: true,
      message: 'Login successful',
      userId: user._id,
      user: publicUser(user),
      token: signToken(user),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users/:id', requireAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!['admin', 'super_admin'].includes(normalizeRole(req.user?.role)) && String(req.user?._id) !== req.params.id) {
      return res.status(403).json({ error: 'You can only access your own account' });
    }

    const user = await getDB().collection('users').findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/users/:id', requireAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!['admin', 'super_admin'].includes(normalizeRole(req.user?.role)) && String(req.user?._id) !== req.params.id) {
      return res.status(403).json({ error: 'You can only update your own account' });
    }

    const { fname, lname, name, email, phone, avatar } = req.body;
    const displayName = name || [fname, lname].filter(Boolean).join(' ').trim();
    const update = {
      updatedAt: new Date(),
    };

    if (fname !== undefined) update.fname = fname;
    if (lname !== undefined) update.lname = lname;
    if (displayName) update.name = displayName;
    if (phone !== undefined) update.phone = phone || null;
    const avatarError = validateAvatar(avatar);
    if (avatarError) return res.status(400).json({ error: avatarError });
    if (avatar !== undefined) update.avatar = avatar || '';

    if (email !== undefined) {
      const normalizedEmail = email?.trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const existingUser = await getDB().collection('users').findOne({
        email: normalizedEmail,
        _id: { $ne: new ObjectId(req.params.id) },
      });

      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      update.email = normalizedEmail;
    }

    const result = await getDB().collection('users').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: publicUser(result),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const activeUsersQuery = {
      $and: [
        { isDeleted: { $ne: true } },
        { deletedAt: { $exists: false } },
      ],
    };
    const users = await getDB().collection('users')
      .find(activeUsersQuery, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(users.map(publicUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/users/archived', requireAdmin, async (req, res) => {
  try {
    const users = await getDB().collection('users')
      .find({ $or: [{ isDeleted: true }, { deletedAt: { $exists: true } }] }, { projection: { password: 0 } })
      .sort({ archivedAt: -1, deletedAt: -1 })
      .toArray();
    res.json(users.map(publicUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/users', requireAdmin, async (req, res) => {
  try {
    const { fname, lname, name, email, phone, password, role = 'customer', status = 'active', avatar } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedRole = normalizeRole(role);
    const displayName = name || [fname, lname].filter(Boolean).join(' ').trim();

    if (!displayName || !normalizedEmail || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (!['customer', 'provider', 'admin', 'super_admin'].includes(normalizedRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const avatarError = validateAvatar(avatar);
    if (avatarError) return res.status(400).json({ error: avatarError });

    const users = getDB().collection('users');
    const existingUser = await users.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const isProvider = normalizedRole === 'provider';
    const newUser = {
      fname: fname || '',
      lname: lname || '',
      name: displayName,
      email: normalizedEmail,
      phone: phone || null,
      password: hashPassword(password),
      role: normalizedRole,
      status,
      avatar: avatar || '',
      verified: ['admin', 'super_admin'].includes(normalizedRole),
      providerStatus: isProvider ? 'kyc_required' : null,
      emailVerified: true,
      phoneVerified: Boolean(phone),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await users.insertOne(newUser);
    const insertedUser = { ...newUser, _id: result.insertedId };
    res.status(201).json({ success: true, user: publicUser(insertedUser), token: signToken(insertedUser) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { fname, lname, name, email, phone, role, status, password, avatar } = req.body;
    const update = { updatedAt: new Date() };

    const avatarError = validateAvatar(avatar);
    if (avatarError) return res.status(400).json({ error: avatarError });

    if (fname !== undefined) update.fname = fname;
    if (lname !== undefined) update.lname = lname;
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone || null;
    if (status !== undefined) update.status = status;
    if (password) update.password = hashPassword(password);
    if (avatar !== undefined) update.avatar = avatar || '';

    if (role !== undefined) {
      const normalizedRole = normalizeRole(role);
      if (!['customer', 'provider', 'admin', 'super_admin'].includes(normalizedRole)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      update.role = normalizedRole;
      update.providerStatus = normalizedRole === 'provider' ? 'kyc_required' : null;
      update.verified = ['admin', 'super_admin'].includes(normalizedRole);
    }

    if (email !== undefined) {
      const normalizedEmail = email?.trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const existingUser = await getDB().collection('users').findOne({
        email: normalizedEmail,
        _id: { $ne: new ObjectId(req.params.id) },
      });

      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      update.email = normalizedEmail;
    }

    const result = await getDB().collection('users').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user: publicUser(result) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    if (String(req.user._id) === String(req.params.id)) {
      return res.status(400).json({ error: 'You cannot archive your own admin account' });
    }

    const userId = new ObjectId(req.params.id);
    const user = await getDB().collection('users').findOne({ _id: userId, isDeleted: { $ne: true } });
    if (!user) return res.status(404).json({ error: 'User not found or already archived' });
    const now = new Date();
    const result = await getDB().collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
          archivedAt: now,
          archivedBy: String(req.user._id),
          statusBeforeArchive: user.status || 'active',
          status: 'disabled',
          updatedAt: now,
        },
      }
    );

    await getDB().collection('providers').updateMany(
      { userId: String(userId), isDeleted: { $ne: true } },
      [{
        $set: {
          isDeleted: true,
          archivedAt: now,
          archivedBy: String(req.user._id),
          archivedViaUserId: String(userId),
          availableBeforeArchive: { $ne: ['$available', false] },
          available: false,
          updatedAt: now,
        },
      }]
    );

    if (result.modifiedCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'User archived' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/admin/users/:id/restore', requireAdmin, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const userId = new ObjectId(req.params.id);
    const archivedUser = await getDB().collection('users').findOne({ _id: userId, isDeleted: true });
    if (!archivedUser) return res.status(404).json({ error: 'Archived user not found' });
    const restored = await getDB().collection('users').findOneAndUpdate(
      { _id: userId, isDeleted: true },
      {
        $set: {
          isDeleted: false,
          status: archivedUser.statusBeforeArchive || 'active',
          updatedAt: new Date(),
        },
        $unset: {
          deletedAt: '',
          archivedAt: '',
          archivedBy: '',
          statusBeforeArchive: '',
        },
      },
      { returnDocument: 'after' }
    );
    await getDB().collection('providers').updateMany(
      { archivedViaUserId: String(userId) },
      [{
        $set: {
          isDeleted: false,
          available: { $ne: ['$availableBeforeArchive', false] },
          updatedAt: new Date(),
        },
      }, {
        $unset: ['archivedAt', 'archivedBy', 'archivedViaUserId', 'availableBeforeArchive'],
      }]
    );
    res.json({ success: true, user: publicUser(restored) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
