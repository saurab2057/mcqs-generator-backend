import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars
dotenv.config();

// Import your Exam model (adjust path if needed)
import Exam from './models/examModel.js';

const dataDir = './data/exams';  // Folder with your 30 JSON files

async function seedExams() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data (optional: comment out if you want to append)
    await Exam.deleteMany({});
    console.log('Cleared existing exams');

    // Read all JSON files from the directory
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));

    console.log(`Found ${files.length} JSON files to seed`);

    for (const file of files) {
      try {
        const filePath = path.join(dataDir, file);
        const jsonData = fs.readFileSync(filePath, 'utf8');
        const examObject = JSON.parse(jsonData);

        // Insert as { examData: examObject }
        const newExam = new Exam({ examData: examObject });
        await newExam.save();

        console.log(`Seeded: ${file} (setId: ${examObject.setId})`);
      } catch (err) {
        console.error(`Error seeding ${file}:`, err.message);
      }
    }

    console.log('Seeding complete!');
  } catch (err) {
    console.error('Connection/Seeding error:', err);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
seedExams();