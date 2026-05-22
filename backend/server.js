import express from 'express';
import cors from 'cors';
import { connectDB, getDB } from './mongoConnect.js';
import authRoutes from './auth.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Auth routes
app.use('/api/auth', authRoutes);

// Test route to check MongoDB connection
app.get('/api/test', async (req, res) => {
  try {
    const db = getDB();
    const testInsert = await db.collection('test').insertOne({ 
      message: 'Connection successful!',
      timestamp: new Date()
    });
    res.json({ 
      success: true, 
      message: 'MongoDB is working!',
      insertedId: testInsert.insertedId 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`✓ Server running on http://localhost:${PORT}`));
});
