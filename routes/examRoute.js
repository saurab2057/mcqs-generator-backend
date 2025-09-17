// examRoute.js
import express from 'express';
import Exam from '../models/examModel.js';
import Result from '../models/resultModel.js';

const router = express.Router();

// Get list of available set IDs
router.get('/', async (req, res) => {
  try {
    const exams = await Exam.find({}, 'setId').sort({ setId: 1 });
    const setIds = exams.map(exam => exam.setId);
    res.json(setIds);
  } catch (err) {
    console.error('Error fetching sets:', err.message);
    res.status(500).json({ error: 'Server error while fetching exam sets' });
  }
});

// Get specific exam set by ID
router.get('/:setId', async (req, res) => {
  const setId = parseInt(req.params.setId, 10);

  if (isNaN(setId) || setId < 1) {
    return res.status(400).json({ error: 'Invalid exam set ID. Must be a positive integer.' });
  }

  try {
    // ✅ Removed 'examData.' prefix
    const exam = await Exam.findOne({ setId }).select('-_id -__v -createdAt');
    if (!exam) {
      return res.status(404).json({ error: 'Exam set not found' });
    }
    // ✅ Now sending exam directly — no .examData needed
    res.json(exam);
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: 'Server error while loading exam' });
  }
});

// Submit exam results
router.post('/submit-exam', async (req, res) => {
  const { setId, answers, timeUsed } = req.body;

  console.log('Received payload:', JSON.stringify({ setId, answers: answers.slice(0, 5), timeUsed }, null, 2));

  if (!setId || !Array.isArray(answers) || timeUsed === undefined || typeof timeUsed !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }

  // Enhanced validation with logging
  let invalidAnswer = null;
  for (let i = 0; i < answers.length; i++) {
    const ans = answers[i];
    console.log(`Validating answer ${i + 1}:`, JSON.stringify(ans));
    if (typeof ans.questionId !== 'number') {
      invalidAnswer = { index: i + 1, reason: 'questionId is not a number', entry: ans };
      break;
    }
    const selectedOption = ans.selectedOption;
    if (selectedOption !== null && selectedOption !== undefined) {
      if (typeof selectedOption !== 'string') {
        invalidAnswer = { index: i + 1, reason: 'selectedOption is not a string', entry: ans };
        break;
      }
      if (!['A', 'B', 'C', 'D'].includes(selectedOption)) {
        invalidAnswer = { index: i + 1, reason: 'selectedOption is not A/B/C/D', entry: ans };
        break;
      }
    } else {
      console.log(`  Question ${ans.questionId} is unanswered (null/undefined): OK`);
    }
  }

  if (invalidAnswer) {
    console.error('Invalid answer found:', invalidAnswer);
    return res.status(400).json({ 
      error: `Invalid answer format at question ${invalidAnswer.index}: ${invalidAnswer.reason}. Entry: ${JSON.stringify(invalidAnswer.entry)}` 
    });
  }

  try {
    // ✅ Simplified query — no 'examData.'
    const exam = await Exam.findOne({ setId });
    if (!exam) {
      return res.status(404).json({ error: 'Exam set not found' });
    }

    // ✅ Removed .examData from all accesses
    const sectionA = exam.sections.find(s => s.name === 'Section A')?.questions || [];
    const sectionB = exam.sections.find(s => s.name === 'Section B')?.questions || [];

    let score = 0;
    answers.forEach(({ questionId, selectedOption }) => {
      const sectionAQuestion = sectionA.find(q => q.id === questionId);
      if (sectionAQuestion && selectedOption === sectionAQuestion.answer) {
        score += 1;
      }
      const sectionBQuestion = sectionB.find(q => q.id === questionId);
      if (sectionBQuestion && selectedOption === sectionBQuestion.answer) {
        score += 2;
      }
    });

    console.log('Calculated score:', score);

    const result = new Result({
      setId,
      answers,
      score,
      timeUsed,
      studentId: '12345', // Replace with authenticated user ID
      submittedAt: new Date()
    });
    await result.save();
    res.json({ success: true, resultId: result._id });
  } catch (err) {
    console.error('Error saving result:', err.message);
    res.status(500).json({ error: 'Server error while submitting exam' });
  }
});

// Get detailed result for a specific submission
router.get('/result/:resultId', async (req, res) => {
  try {
    const result = await Result.findById(req.params.resultId);
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // ✅ No .examData in query
    const exam = await Exam.findOne({ setId: result.setId });
    if (!exam) {
      return res.status(404).json({ error: 'Exam set not found' });
    }

    // ✅ Removed .examData
    const sectionA = exam.sections.find(s => s.name === 'Section A')?.questions || [];
    const sectionB = exam.sections.find(s => s.name === 'Section B')?.questions || [];
    const allQuestions = [...sectionA, ...sectionB];

    const detailedComparison = result.answers.map(({ questionId, selectedOption }) => {
      const question = allQuestions.find(q => q.id === questionId);
      const selectedOptionText = question
        ? question.choices.find(c => c.option === selectedOption)?.text || 'Invalid option'
        : 'No Answer';
      const isAnswered = selectedOption !== undefined && selectedOption !== null;
      const isCorrect = isAnswered && question && selectedOption === question.answer;

      return {
        questionId,
        yourAnswer: {
          questionText: question ? question.text : 'Question not found',
          option: isAnswered ? `Option ${selectedOption}` : 'No Answer',
          optionText: selectedOptionText,
          isCorrect: isCorrect
        },
        correctAnswer: {
          questionText: question ? question.text : 'Question not found',
          option: question ? `Option ${question.answer}` : 'N/A',
          optionText: question ? question.choices.find(c => c.option === question.answer)?.text : 'N/A',
          isCorrect: true
        }
      };
    });

    const answeredQuestionIds = new Set(result.answers.map(a => a.questionId));
    const unansweredQuestions = allQuestions.filter(q => !answeredQuestionIds.has(q.id)).map(q => ({
      questionId: q.id,
      yourAnswer: {
        questionText: q.text,
        option: 'No Answer',
        optionText: 'No Answer',
        isCorrect: false
      },
      correctAnswer: {
        questionText: q.text,
        option: `Option ${q.answer}`,
        optionText: q.choices.find(c => c.option === q.answer)?.text,
        isCorrect: true
      }
    }));

    const fullComparison = [...detailedComparison, ...unansweredQuestions];

    let score = 0;
    let sectionAStats = { total: sectionA.length, correct: 0, marks: 0 };
    let sectionBStats = { total: sectionB.length, correct: 0, marks: 0 };

    fullComparison.forEach(({ questionId, yourAnswer }) => {
      const question = allQuestions.find(q => q.id === questionId);
      if (question) {
        const isSectionA = sectionA.some(q => q.id === questionId);
        if (isSectionA && yourAnswer.isCorrect) {
          score += 1;
          sectionAStats.correct++;
          sectionAStats.marks += 1;
        } else if (!isSectionA && yourAnswer.isCorrect) {
          score += 2;
          sectionBStats.correct++;
          sectionBStats.marks += 2;
        }
      }
    });

    const detailedResult = {
      setId: result.setId,
      score,
      timeUsed: result.timeUsed,
      submittedAt: result.submittedAt,
      sectionAStats,
      sectionBStats,
      comparison: fullComparison
    };

    res.json(detailedResult);
  } catch (err) {
    console.error('Error fetching result:', err.message);
    res.status(500).json({ error: 'Server error while fetching result' });
  }
});

// Get performance stats for a specific result
router.get('/result/:resultId/stats', async (req, res) => {
  try {
    const result = await Result.findById(req.params.resultId);
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // ✅ No .examData
    const exam = await Exam.findOne({ setId: result.setId });
    if (!exam) {
      return res.status(404).json({ error: 'Exam set not found' });
    }

    // ✅ Removed .examData
    const sectionA = exam.sections.find(s => s.name === 'Section A')?.questions || [];
    const sectionB = exam.sections.find(s => s.name === 'Section B')?.questions || [];

    let sectionACorrect = 0, sectionAIncorrect = 0;
    let sectionBCorrect = 0, sectionBIncorrect = 0;

    result.answers.forEach(({ questionId, selectedOption }) => {
      const sectionAQuestion = sectionA.find(q => q.id === questionId);
      const sectionBQuestion = sectionB.find(q => q.id === questionId);

      if (sectionAQuestion) {
        selectedOption === sectionAQuestion.answer ? sectionACorrect++ : sectionAIncorrect++;
      } else if (sectionBQuestion) {
        selectedOption === sectionBQuestion.answer ? sectionBCorrect++ : sectionBIncorrect++;
      }
    });

    res.json({
      chart: {
        type: "bar",
        data: {
          labels: ["Section A", "Section B"],
          datasets: [
            {
              label: "Correct Answers",
              data: [sectionACorrect, sectionBCorrect],
              backgroundColor: "#4CAF50"
            },
            {
              label: "Incorrect Answers",
              data: [sectionAIncorrect, sectionBIncorrect],
              backgroundColor: "#F44336"
            }
          ]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "Number of Questions" }
            },
            x: {
              title: { display: true, text: "Section" }
            }
          },
          plugins: {
            legend: { position: "top" },
            title: { display: true, text: "Performance by Section" }
          }
        }
      }
    });
  } catch (err) {
    console.error('Error generating stats:', err.message);
    res.status(500).json({ error: 'Server error while generating stats' });
  }
});

export default router;
