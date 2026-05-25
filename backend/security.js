import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDB } from './mongoConnect.js';

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const base64UrlEncode = (value) => Buffer
  .from(typeof value === 'string' ? value : JSON.stringify(value))
  .toString('base64url');

const base64UrlDecode = (value) => Buffer.from(value, 'base64url').toString('utf8');

const jwtSecret = () => {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return 'nearme-dev-secret-change-me';
};

export const normalizeRole = (role = '') => role.toString().trim().toLowerCase().replace(/\s+/g, '_');

export const isAdminRole = (role) => ['admin', 'super_admin'].includes(normalizeRole(role));

export const publicUser = (user) => ({
  id: String(user._id),
  fname: user.fname,
  lname: user.lname,
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
  status: user.status || 'active',
  isDeleted: user.isDeleted === true,
  deletedAt: user.deletedAt,
  archivedAt: user.archivedAt,
  archivedBy: user.archivedBy,
  verified: user.verified,
  providerStatus: user.providerStatus,
  kycSubmittedAt: user.kycSubmittedAt,
  kycReviewedAt: user.kycReviewedAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password, storedPassword) => {
  if (!storedPassword) return false;
  if (!storedPassword.includes(':')) return password === storedPassword;

  const [salt, originalHash] = storedPassword.split(':');
  const candidate = hashPassword(password, salt).split(':')[1];

  try {
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(originalHash));
  } catch {
    return false;
  }
};

export const signToken = (user) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user._id),
    role: normalizeRole(user.role),
    email: user.email,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const unsigned = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
  const signature = crypto.createHmac('sha256', jwtSecret()).update(unsigned).digest('base64url');

  return `${unsigned}.${signature}`;
};

export const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = crypto.createHmac('sha256', jwtSecret()).update(unsigned).digest('base64url');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

const bearerToken = (req) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : null;
};

export const requireAuth = async (req, res, next) => {
  try {
    const payload = verifyToken(bearerToken(req));
    if (!payload?.sub || !ObjectId.isValid(payload.sub)) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const user = await getDB().collection('users').findOne({ _id: new ObjectId(payload.sub) });
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (['suspended', 'disabled'].includes(user.status)) {
      return res.status(403).json({ success: false, error: 'This account is not active' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const requireAdmin = async (req, res, next) => {
  await requireAuth(req, res, () => {
    if (!isAdminRole(req.user?.role)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    next();
  });
};
