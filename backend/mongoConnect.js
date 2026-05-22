import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({path:"../.env"});

let db;

export const connectDB = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    db = client.db('NearMe');
    console.log('✓ MongoDB connected');
    return db;
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

export const getDB = () => db;
