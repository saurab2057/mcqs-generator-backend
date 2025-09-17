// backend/routes/chatbotRoute.js

import express from 'express';
import { InferenceClient } from '@huggingface/inference';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Initialize the client once for this module
const hfClient = new InferenceClient(process.env.HF_TOKEN);

// --- HUGGING FACE CHAT ENDPOINT ---
// Handles POST requests to /api/chat/
router.post('/', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Make the call to the Hugging Face Inference API
    const chatCompletion = await hfClient.chatCompletion({
        provider: "novita",
        model: "mistralai/Mistral-7B-Instruct-v0.3",
        messages: [{ role: "user", content: message }],
        // Add other parameters if you need them
        // max_tokens: 200,
    });

    // Extract the reply and send a success response
    const reply = chatCompletion.choices?.[0]?.message?.content || 'No reply received.';
    res.json({ reply });

  } catch (err) {
    // --- [RESTORED] Your detailed error handling logic ---
    console.error('Error communicating with Hugging Face via Client:', err.message);

    // This checks if the error object contains a 'response' from an underlying HTTP client
    // which is common for API-related errors.
    if (err.response) {
         console.error('Hugging Face Client API response status:', err.response.status);
         console.error('Hugging Face Client API response data:', err.response.data);

         if (err.response.status === 401 || err.response.status === 403) {
             return res.status(err.response.status).json({ error: 'Authentication error with AI model. Check API token.' });
         } else if (err.response.status === 404) {
             return res.status(err.response.status).json({ error: 'AI model not found or provider issue.' });
         } else if (err.response.status >= 400 && err.response.status < 500) {
              return res.status(err.response.status).json({ error: err.response.data?.error?.message || 'AI model request failed.' });
         }
         else {
            return res.status(500).json({ error: 'Failed to get response from AI model due to a server-side issue at the provider.' });
         }
    } else {
       // This handles network errors or other issues where there's no API response
       return res.status(500).json({ error: 'Network error or failed to get response from AI model.' });
    }
  }
});

export default router;