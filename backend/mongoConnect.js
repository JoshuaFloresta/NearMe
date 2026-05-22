import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let client;
let db;

export const connectDB = async () => {
  if (db) return db;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from backend/.env');
  }

  client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    db = client.db(process.env.MONGODB_DB || 'NearMe');
    console.log('MongoDB connected');
    return db;
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

export const getDB = () => {
  if (!db) {
    throw new Error('Database is not connected yet');
  }

  return db;
};

export const closeDB = async () => {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
};
