import express from 'express';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDB } from './mongoConnect.js';

const router = express.Router();

const publicUser = (user) => ({
  id: user._id,
  fname: user.fname,
  lname: user.lname,
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
  verified: user.verified,
});

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedPassword) => {
  if (!storedPassword) return false;
  if (!storedPassword.includes(':')) return password === storedPassword;

  const [salt, originalHash] = storedPassword.split(':');
  const candidate = hashPassword(password, salt).split(':')[1];

  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(originalHash));
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
      mockOtp: code,
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

    const newUser = {
      fname: fname || '',
      lname: lname || '',
      name: displayName,
      email: normalizedEmail,
      phone: phone || null,
      password: hashPassword(password),
      role: role || 'customer',
      verified: false,
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

    res.json({
      success: true,
      message: 'Login successful',
      userId: user._id,
      user: publicUser(user),
    });
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

export default router;
