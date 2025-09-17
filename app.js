//app.js

import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from './middleware/corsMiddleware.js';
import examRoutes from './routes/examRoute.js';
import chatRoutes from './routes/chatbotRoute.js';

// Load env variables
dotenv.config();
console.log('Environment variables:', {
  HF_TOKEN: process.env.HF_TOKEN ? 'Present' : 'Missing',
  MONGO_URI: process.env.MONGO_URI ? 'Present' : 'Missing',
  PORT: process.env.PORT || 'Default 5000',
});

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());  // Parse JSON bodies
app.use(cors);  // Apply your CORS middleware

// Routes
app.use('/api/exams', examRoutes); // Mount examRoutes under /api/exams
app.use('/api/chat', chatRoutes); // Mount chatRoutes under /api/chat

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);;
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});