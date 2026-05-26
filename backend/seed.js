import { hashPassword } from './security.js';

const defaultServices = [
  { id: 'plumbing', label: 'Plumbing', icon: 'tool', color: 'bg-bauhaus-blue' },
  { id: 'cleaning', label: 'House Cleaning', icon: 'sparkles', color: 'bg-bauhaus-red' },
  { id: 'electrical', label: 'Electrical', icon: 'zap', color: 'bg-bauhaus-yellow' },
  { id: 'mechanic', label: 'Mechanic', icon: 'car', color: 'bg-bauhaus-blue' },
  { id: 'carpentry', label: 'Carpentry', icon: 'hammer', color: 'bg-bauhaus-red' },
  { id: 'delivery', label: 'Delivery', icon: 'package', color: 'bg-bauhaus-yellow' },
  { id: 'painting', label: 'Painting', icon: 'palette', color: 'bg-bauhaus-blue' },
  { id: 'gardening', label: 'Gardening', icon: 'leaf', color: 'bg-bauhaus-red' },
  { id: 'appliance', label: 'Appliance Repair', icon: 'plug', color: 'bg-bauhaus-yellow' },
  { id: 'other', label: 'Other', icon: 'settings', color: 'bg-bauhaus-ink' },
];

export const seedDatabase = async (db) => {
  const servicesCollection = db.collection('services');
  const usersCollection = db.collection('users');

  if (await servicesCollection.countDocuments() === 0) {
    await servicesCollection.insertMany(defaultServices.map((service) => ({
      ...service,
      createdAt: new Date(),
      updatedAt: new Date(),
    })));
  }

  if (await usersCollection.countDocuments({ role: { $in: ['admin', 'super_admin'] } }) === 0) {
    const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    const email = process.env.SEED_ADMIN_EMAIL || (isProduction ? '' : 'admin@nearme.local');
    const password = process.env.SEED_ADMIN_PASSWORD || (isProduction ? '' : 'Admin12345');

    if (!email || !password) {
      console.warn('No admin account was seeded. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in production.');
      return;
    }

    await usersCollection.updateOne(
      { email },
      {
        $setOnInsert: {
          fname: 'NearMe',
          lname: 'Admin',
          name: 'NearMe Admin',
          email,
          phone: null,
          password: hashPassword(password),
          role: 'admin',
          status: 'active',
          verified: true,
          providerStatus: null,
          emailVerified: true,
          phoneVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
};
