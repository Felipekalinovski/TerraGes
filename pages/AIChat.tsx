import React, { useState, useRef, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Send, Sparkles, User, Bot, Loader2, Info } from 'lucide-react';
import { generateAIResponse } from '../services/geminiService';
import { intelligenceService } from '../services/intelligenceService';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "Resumo financeiro do mês",
  "Status da frota ativa",
  "Últimas ocorrências no RDO",
  "Previsão de gastos"
];

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      text: 'Olá! Sou o assistente inteligente do TerraGes. Analiso dados reais da sua obra, frota e financeiro em tempo real. Como posso ajudar?',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text: string = inputText) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const systemContext = await intelligenceService.getDynamicChatContext();
      const responseText = await generateAIResponse(text, systemContext);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Erro no chat:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: 'Desculpe, tive um problema ao processar sua solicitação. Tente novamente.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout title="Assistente IA" hideNav={false}>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'ai' && (
                <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                  <Sparkles size={14} className="text-primary" />
                </div>
              )}

              <div
                className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                  ? 'bg-primary text-white rounded-tr-none'
                  : 'bg-surface-dark text-gray-200 rounded-tl-none border border-white/5'
                  }`}
              >
                {msg.text}
                <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="size-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0 bg-cover bg-center border border-white/10" style={{ backgroundImage: "url('https://picsum.photos/200')" }}>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start animate-pulse">
              <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                <Sparkles size={14} className="text-primary" />
              </div>
              <div className="bg-surface-dark border border-white/5 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-xs text-gray-400">Analisando dados...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-background-dark border-t border-white/5">
          {messages.length < 3 && (
            <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar mb-1">
              {SUGGESTIONS.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(suggestion)}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full bg-surface-dark border border-white/10 text-xs text-gray-300 hover:border-primary/50 hover:text-primary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Digite sua mensagem..."
              className="w-full bg-surface-dark text-white placeholder:text-gray-500 rounded-xl py-3.5 pl-4 pr-12 text-sm border border-white/10 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-lg"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              className="absolute right-2 p-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-2">
            A IA pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </div>
    </Layout>
  );
};
