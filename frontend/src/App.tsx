import { useState, useCallback } from 'react';
import ChatWindow from './components/ChatWindow';
import { sendMessage, ChatResponse } from './api';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'answer' | 'escalation';
  confidence?: number;
  reasoning?: string;
  retrievedArticles?: string[];
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm the TaskFlow support assistant. Ask me anything about getting started, billing, integrations, team permissions, or troubleshooting.",
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(async (question: string) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const data: ChatResponse = await sendMessage(question);
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          type: data.type,
          confidence: data.confidence,
          reasoning: data.reasoning,
          retrievedArticles: data.retrievedArticles,
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Something went wrong on our end. A human agent will follow up shortly.',
          type: 'escalation',
          confidence: 0,
          reasoning: 'Client-side network or API error.',
          retrievedArticles: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold tracking-tight">TF</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900">TaskFlow Support</h1>
          <p className="text-xs text-gray-500">AI assistant · answers or escalates to a human</p>
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-2xl mx-auto">
          <ChatWindow messages={messages} isLoading={isLoading} onSend={handleSend} />
        </div>
      </main>
    </div>
  );
}
