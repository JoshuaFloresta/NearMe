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

router.post('/otp/send', async (req, res) => {
  try {
    const { email, phone, purpose = 'signup' } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail && !phone) {
      return res.status(400).json({ error: 'Email or phone is required' });
    }

    const code = createOtp();
    const identifier = normalizedEmail || phone;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

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
      message: 'OTP sent successfully',
      expiresAt,
      devOtp: process.env.NODE_ENV === 'production' ? undefined : code,
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

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { fname, lname, name, email, phone, password, role, otpVerified } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const displayName = name || [fname, lname].filter(Boolean).join(' ').trim();

    if (!normalizedEmail || !password || !displayName) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (!otpVerified) {
      return res.status(400).json({ error: 'OTP verification is required' });
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

router.patch('/users/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
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
    const users = await getDB().collection('users')
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
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

    const result = await getDB().collection('users').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
