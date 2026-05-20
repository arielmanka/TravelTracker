import React from 'react';
import { Send, Bot, User, Sparkles, Loader } from 'lucide-react';
import { Message } from '../types';

interface LLMAssistantProps {
  onQueryLLM: (message: string, history: Message[], model: string) => Promise<string>;
}

export const LLMAssistant: React.FC<LLMAssistantProps> = ({ onQueryLLM }) => {
  const [model, setModel] = React.useState('ollama/llama3');
  const [input, setInput] = React.useState('');
  const [history, setHistory] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const suggestionPrompts = [
    "Summarize all my travels logged in the database.",
    "Which country did I spend the most time in?",
    "Calculate my rolling stays and tell me if I am close to exceeding limits.",
    "Give me a chronological timeline breakdown of all destination stays."
  ];

  // Auto-scroll chat to the bottom on new messages
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    setError(null);
    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setHistory(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send message along with existing chat history
      const responseText = await onQueryLLM(userMessage.content, history, model);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setHistory(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to get response from the chosen LLM.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    handleSend(prompt);
  };

  return (
    <div className="glass-card chat-window">
      {/* Header & Model Selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1rem', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles color="var(--color-primary)" size={20} />
          <h3 style={{ fontSize: '1.2rem' }}>AI Travel Assistant</h3>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Model Endpoint:</span>
          <select 
            className="form-control" 
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', minWidth: '180px' }}
            value={model} 
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="ollama/llama3">Local Ollama (Llama 3)</option>
            <option value="ollama/mistral">Local Ollama (Mistral)</option>
            <option value="ollama/gemma">Local Ollama (Gemma)</option>
            <option value="openai">OpenAI (GPT-4o)</option>
            <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
            <option value="gemini">Google (Gemini 1.5 Flash)</option>
          </select>
        </div>
      </div>

      {/* Suggestion Chips (when chat history is empty) */}
      {history.length === 0 && (
        <div style={{ padding: '0 0.5rem 1rem 0.5rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Quick Queries:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {suggestionPrompts.map((prompt, idx) => (
              <button 
                key={idx} 
                className="btn btn-secondary" 
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', borderRadius: '20px' }}
                onClick={() => handleSuggestionClick(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message history */}
      <div className="chat-history">
        {history.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '0.5rem' }}>
            <Bot size={40} style={{ opacity: 0.5 }} />
            <p style={{ fontSize: '0.9rem' }}>Ask a question about your logged trips or stay warnings.</p>
            <p style={{ fontSize: '0.78rem' }}>The database contents are automatically injected as context.</p>
          </div>
        )}
        
        {history.map((msg, index) => (
          <div 
            key={index} 
            className={`chat-bubble ${msg.role}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.78rem', marginBottom: '0.25rem', opacity: 0.8 }}>
              {msg.role === 'user' ? (
                <>
                  <User size={12} /> <span>You</span>
                </>
              ) : (
                <>
                  <Bot size={12} /> <span>TravelTracker AI</span>
                </>
              )}
            </div>
            
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
            
            <span style={{ display: 'block', textAlign: 'right', fontSize: '0.7rem', color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', marginTop: '0.25rem' }}>
              {msg.timestamp}
            </span>
          </div>
        ))}
        
        {isLoading && (
          <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start' }}>
            <Loader size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.85rem' }}>Thinking...</span>
          </div>
        )}

        {error && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', borderLeft: '3px solid var(--color-danger)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.85rem', alignSelf: 'stretch' }}>
            {error}
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Chat entry form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="chat-input-area">
        <input 
          type="text" 
          className="form-control" 
          placeholder="e.g., How many days have I spent in the UK?" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          style={{ flexGrow: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={isLoading || !input.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

// Simple spin animation stylesheet hook (in case index.css doesn't cover spin keyframes)
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
