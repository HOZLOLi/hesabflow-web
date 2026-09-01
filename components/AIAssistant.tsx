import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { useDataStore } from '../store/dataStore';
import { analyzeFinances } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

export const AIAssistant: React.FC = () => {
  const transactions = useDataStore((state) => state.transactions);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'سلام. من دستیار مالی شما هستم. سوالی دارید؟'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await analyzeFinances(transactions, input);

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("AI API Error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'متاسفانه خطایی در ارتباط با سرور هوش مصنوعی رخ داد. لطفا دوباره تلاش کنید.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 pb-16 shadow-sm">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="text-primary dark:text-white" size={18} />
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">تحلیلگر هوشمند</h3>
        </div>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Gemini AI</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 dark:bg-black">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[85%] flex items-start space-x-2 space-x-reverse ${msg.role === 'user' ? 'flex-row' : 'flex-row-reverse'
                }`}
            >
              <div
                className={`w-6 h-6 flex items-center justify-center flex-shrink-0 border ${msg.role === 'user'
                    ? 'bg-primary border-primary text-white'
                    : 'bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-emerald-600 dark:text-emerald-400'
                  }`}
              >
                {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
              </div>
              <div
                className={`p-2.5 text-xs leading-relaxed border shadow-sm ${msg.role === 'user'
                    ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white border-gray-200 dark:border-neutral-800'
                    : 'bg-emerald-50 dark:bg-emerald-900/10 text-gray-900 dark:text-gray-100 border-emerald-100 dark:border-emerald-900/30'
                  }`}
              >
                <ReactMarkdown
                  components={{
                    strong: ({ node, ...props }) => <span className="font-bold text-emerald-700 dark:text-emerald-400" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 mt-1" {...props} />,
                    li: ({ node, ...props }) => <li className="text-gray-800 dark:text-gray-200" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-end">
            <div className="flex items-center space-x-2 space-x-reverse bg-white dark:bg-neutral-900 px-3 py-1.5 border border-gray-200 dark:border-neutral-800">
              <Loader2 className="animate-spin text-gray-400" size={14} />
              <span className="text-[10px] text-gray-400">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white dark:bg-surface border-t border-gray-200 dark:border-neutral-800">
        <div className="flex items-center space-x-2 space-x-reverse">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="پیام خود را بنویسید..."
            className="flex-1 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 p-2 text-xs focus:border-primary dark:focus:border-white outline-none transition-colors rounded-none text-gray-900 dark:text-white"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2 bg-primary hover:bg-slate-800 disabled:bg-gray-300 dark:disabled:bg-neutral-800 text-white transition-colors rounded-none"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};