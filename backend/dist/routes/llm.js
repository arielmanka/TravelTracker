"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const llmService_1 = require("../services/llmService");
const router = (0, express_1.Router)();
// POST query LLM with data context
router.post('/query', async (req, res) => {
    try {
        const { message, history, model } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message content is required' });
        }
        // Default to local Ollama llama3 if no model is provided
        const selectedModel = model || 'ollama/llama3';
        const response = await (0, llmService_1.queryLLM)(message, history || [], selectedModel);
        res.json({ response });
    }
    catch (error) {
        console.error('LLM query route failure:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
