import crypto from 'crypto';
import express from 'express';
import { requireAuth } from '../security.js';

const router = express.Router();

const parseCloudinaryUrl = () => {
  if (!process.env.CLOUDINARY_URL) return null;

  try {
    const url = new URL(process.env.CLOUDINARY_URL);
    return {
      cloudName: url.hostname,
      apiKey: url.username,
      apiSecret: url.password,
    };
  } catch {
    return null;
  }
};

const signUpload = (params, apiSecret) => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
};

const folderFor = (purpose = 'general') => {
  const safePurpose = String(purpose).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return `nearme/${safePurpose || 'general'}`;
};

router.post('/uploads/image', requireAuth, async (req, res) => {
  try {
    const cloudinary = parseCloudinaryUrl();
    if (!cloudinary?.cloudName || !cloudinary?.apiKey || !cloudinary?.apiSecret) {
      return res.status(500).json({ error: 'Cloudinary is not configured on the server' });
    }

    const { file, purpose } = req.body;
    if (!file || typeof file !== 'string' || !file.startsWith('data:image/')) {
      return res.status(400).json({ error: 'An image data URL is required' });
    }

    // Keep base64 JSON requests below Vercel Functions' 4.5 MB body limit.
    if (file.length > 4_250_000) {
      return res.status(400).json({ error: 'Image is too large. Please choose an image under 3 MB.' });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const signedParams = {
      folder: folderFor(purpose),
      timestamp,
    };
    const signature = signUpload(signedParams, cloudinary.apiSecret);
    const uploadParams = new URLSearchParams({
      file,
      api_key: cloudinary.apiKey,
      ...signedParams,
      signature,
    });

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`, {
      method: 'POST',
      body: uploadParams,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Cloudinary upload failed' });
    }

    res.status(201).json({
      url: data.secure_url,
      publicId: data.public_id,
      width: data.width,
      height: data.height,
      format: data.format,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
