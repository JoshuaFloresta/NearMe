import { services, providers, reviews } from './data/seedData.js';

export const seedDatabase = async (db) => {
  const servicesCollection = db.collection('services');
  const providersCollection = db.collection('providers');
  const reviewsCollection = db.collection('reviews');

  if (await servicesCollection.countDocuments() === 0) {
    await servicesCollection.insertMany(services.map((service) => ({
      ...service,
      createdAt: new Date(),
      updatedAt: new Date(),
    })));
  }

  if (await providersCollection.countDocuments() === 0) {
    await providersCollection.insertMany(providers.map((provider) => ({
      ...provider,
      createdAt: new Date(),
      updatedAt: new Date(),
    })));
  }

  if (await reviewsCollection.countDocuments() === 0) {
    await reviewsCollection.insertMany(reviews.map((review) => ({
      ...review,
      createdAt: new Date(),
      updatedAt: new Date(),
    })));
  }
};
