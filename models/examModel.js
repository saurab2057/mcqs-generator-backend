import mongoose from 'mongoose';

const examSchema = new mongoose.Schema({
  setId: { type: Number, required: true },
  title: { type: String, required: true },
  duration: { type: Number, required: true },
  sections: [{
    name: { type: String, required: true },
    questions: [{
      id: { type: Number, required: true },
      text: { type: String, required: true },
      choices: [{
        option: { type: String, required: true },
        text: { type: String, required: true }
      }],
      answer: { type: String, required: true }
    }]
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Exam', examSchema);
