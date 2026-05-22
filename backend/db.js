import { connectDB, getDB } from './mongoConnect.js';

export const connectToDb = async (cb) => {
  try {
    await connectDB();
    cb();
  } catch (error) {
    cb(error);
  }
};

export const getDb = getDB;
