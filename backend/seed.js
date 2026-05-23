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
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@nearme.local';
    const password = process.env.SEED_ADMIN_PASSWORD || 'Admin12345';

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
