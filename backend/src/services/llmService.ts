import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb } from '../db';
import { Message } from '../types';

/**
 * Compiles database records (trips, stays, and limit configurations) into a structured markdown context string.
 */
async function getTravelTrackerContext(): Promise<string> {
  try {
    const db = await getDb();
    
    // Fetch all journey entries
    const entries = await db.all('SELECT * FROM journey_entries ORDER BY entry_time ASC');
    
    // Fetch all limit settings
    const limits = await db.all('SELECT * FROM limit_settings');
    
    // Calculate stays by country for reference
    const todayStr = new Date().toISOString().split('T')[0];
    const countryDays: Record<string, number> = {};
    const formattedSegments = [];
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const country = entry.country.trim();
      
      const startStr = entry.entry_time.substring(0, 10);
      let endStr = todayStr;
      const hasNext = i < entries.length - 1;
      if (hasNext) {
        endStr = entries[i + 1].entry_time.substring(0, 10);
      }
      
      const dStart = new Date(startStr + 'T00:00:00');
      const dEnd = new Date(endStr + 'T00:00:00');
      
      let durationDays = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));
      if (!hasNext) {
        durationDays += 1;
      }
      if (durationDays < 0) durationDays = 0;
      
      countryDays[country] = (countryDays[country] || 0) + durationDays;
      
      formattedSegments.push({
        ...entry,
        startDate: startStr,
        endDate: endStr,
        durationDays
      });
    }

    const context = `
You are the TravelTracker AI Assistant. You have real-time access to the user's travel logs, entries, stays, and country day limits.
Here is the current TravelTracker database state:

### Configured Country Stay Limits
${limits.length === 0 ? 'No limits configured.' : limits.map(l => `- **${l.country}**: Max ${l.max_days} days in a rolling ${l.rolling_period_days}-day period.`).join('\n')}

### Calculated Stays (Total Days)
${Object.entries(countryDays).length === 0 ? 'No countries visited yet.' : Object.entries(countryDays).map(([c, d]) => `- **${c}**: Total of ${d} days spent.`).join('\n')}

### Travel Timeline Entries
${entries.length === 0 ? 'No journey entries logged.' : formattedSegments.map(s => {
  return `- **Stay**: ${s.city}, ${s.country}
  Date: ${s.startDate}
  Calculated Duration: ${s.durationDays} day(s) (from ${s.startDate} to ${s.endDate})
  Receipt Image: ${s.file_name || 'None attached'}
  Notes: ${s.notes || 'None'}`;
}).join('\n\n')}

Use the above database context to answer any user questions about their travels, stays, or limit warnings. If they ask about country limits, match it with the stay durations above. Be concise and precise.
`;
    return context;
  } catch (error) {
    console.error('Error compiling travel context:', error);
    return 'Context error: Could not retrieve database records.';
  }
}

/**
 * Handles communication with local Ollama or cloud providers (OpenAI, Anthropic, Gemini).
 */
export async function queryLLM(prompt: string, history: Message[], modelType: string): Promise<string> {
  const systemContext = await getTravelTrackerContext();
  
  // Format message history
  const formattedHistory = (history || []).map(msg => ({
    role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
    content: msg.content
  }));

  // Append new prompt
  const messages = [
    { role: 'user' as const, content: `${systemContext}\n\nUser Question: ${prompt}` },
    ...formattedHistory
  ];

  // 1. OLLAMA (Local)
  if (modelType.startsWith('ollama/')) {
    const ollamaUrl = process.env.OLLAMA_API_URL || 'http://host.docker.internal:11434';
    const modelName = modelType.replace('ollama/', '') || 'llama3';
    
    try {
      console.log(`Connecting to local Ollama at ${ollamaUrl}/api/chat with model ${modelName}...`);
      
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: messages,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama responded with ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      return data.message?.content || 'No response content returned from Ollama.';
    } catch (error: any) {
      console.error('Ollama connection failed:', error);
      throw new Error(`Local Ollama service error: ${error.message}. Make sure Ollama is running on your host machine and you have run 'ollama run ${modelName}'.`);
    }
  }

  // 2. OPENAI
  if (modelType === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not configured.');
    
    try {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.2
      });
      return completion.choices[0]?.message?.content || 'No response returned from OpenAI.';
    } catch (error: any) {
      console.error('OpenAI API call failed:', error);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  // 3. ANTHROPIC (Claude)
  if (modelType === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not configured.');
    
    try {
      const anthropic = new Anthropic({ apiKey });
      const systemPrompt = systemContext;
      const userMessages = formattedHistory.map(m => ({
        role: m.role,
        content: m.content
      }));
      
      userMessages.push({ role: 'user', content: prompt });
      
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        system: systemPrompt,
        messages: userMessages,
        temperature: 0.2
      });
      
      // Parse block response
      const block = response.content[0];
      return block && 'text' in block ? block.text : 'No text response returned from Claude.';
    } catch (error: any) {
      console.error('Anthropic API call failed:', error);
      throw new Error(`Anthropic Claude API error: ${error.message}`);
    }
  }

  // 4. GEMINI
  if (modelType === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not configured.');
    
    try {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      // Compile prompt with context and history
      const formattedHistoryGemini = history.map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n');
      
      const fullPrompt = `${systemContext}\n\n${formattedHistoryGemini}\nUser: ${prompt}\nAssistant:`;
      
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text() || 'No response returned from Gemini.';
    } catch (error: any) {
      console.error('Gemini API call failed:', error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  throw new Error(`Unsupported model selection type: ${modelType}`);
}
