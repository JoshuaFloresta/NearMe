import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

let client;
let db;

export const connectDB = async () => {
  if (db) return db;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from the backend environment variables');
  }

  client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    db = client.db(process.env.MONGODB_DB || 'NearMe');
    console.log('MongoDB connected');
    return db;
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    console.error('Check that your MongoDB Atlas cluster allows your current IP address and that port 27017 is not blocked by your network/firewall.');
    throw error;
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
