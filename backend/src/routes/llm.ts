import { Router } from 'express';
import { queryLLM } from '../services/llmService';

const router = Router();

// POST query LLM with data context
router.post('/query', async (req, res) => {
  try {
    const { message, history, model } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Default to local Ollama llama3 if no model is provided
    const selectedModel = model || 'ollama/llama3';
    
    const response = await queryLLM(message, history || [], selectedModel);
    
    res.json({ response });
  } catch (error: any) {
    console.error('LLM query route failure:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
