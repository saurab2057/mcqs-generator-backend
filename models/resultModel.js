import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  setId: {
    type: Number,
    required: true
  },
  answers: [{
    questionId: { type: Number, required: true },
    selectedOption: { type: String, required: false } // Changed to String for "A", "B", "C", "D"
  }],
  score: {
    type: Number,
    required: true
  },
  timeUsed: {
    type: Number,
    required: true
  },
  studentId: {
    type: String,
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Result', resultSchema);