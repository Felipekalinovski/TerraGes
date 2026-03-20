import React, { useState, useRef, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Send, Sparkles, User, Bot, Loader2, Info } from 'lucide-react';
import { generateAIResponse } from '../services/aiService';

import { intelligenceService } from '../services/intelligenceService';
import { scheduleService } from '../services/scheduleService';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "Resumo financeiro do mês",
  "Status da frota ativa",
  "Próximos serviços agendados",
  "Ocorrências no RDO"
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
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadProfile = async () => {
      const { userService } = await import('../services/userService');
      const profile = await userService.getCurrentProfile();
      if (profile?.avatar_url) setUserAvatar(profile.avatar_url);
    };
    loadProfile();


  }, []);

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
      // Get dynamic context from the system
      const systemContext = await intelligenceService.getDynamicChatContext();

      const responseText = await generateAIResponse(text, systemContext);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

      // Check for actions in the AI response
      if (responseText.includes('[[CREATE_SCHEDULE:')) {
        try {
          const actionMatch = responseText.match(/\[\[CREATE_SCHEDULE:(.*?)\]\]/);
          if (actionMatch && actionMatch[1]) {
            const scheduleData = JSON.parse(actionMatch[1]);
            await scheduleService.create(scheduleData);

            // Add a confirmation message
            const confirmationMessage: Message = {
              id: (Date.now() + 2).toString(),
              role: 'ai',
              text: `✅ Agendamento "${scheduleData.title}" criado com sucesso para o dia ${new Date(scheduleData.start_time).toLocaleDateString('pt-BR')}!`,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, confirmationMessage]);
          }
        } catch (e) {
          console.error("Erro ao processar ação da IA:", e);
        }
      }
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
    <Layout>
      <Layout.Header 
        title="Assistente IA" 
        subTitle="Análise preditiva e automação por voz/texto"
      />

      <Layout.Content>
        <div className="flex flex-col h-[calc(100vh-12rem)] relative">
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-8 space-y-8 no-scrollbar scroll-smooth">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'ai' && (
                  <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-neon-sm self-end mb-4">
                    <Sparkles size={18} className="text-primary" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] p-5 rounded-[28px] text-sm leading-relaxed relative group transition-all ${msg.role === 'user'
                    ? 'bg-primary text-black font-bold rounded-br-none shadow-neon'
                    : 'bg-surface-dark/40 backdrop-blur-md text-gray-200 rounded-bl-none border border-white/5 shadow-glass'
                    }`}
                >
                  {msg.text.replace(/\[\[CREATE_SCHEDULE:.*?\]\]/g, '').trim()}
                  
                  <div className={`text-[9px] mt-3 font-black uppercase tracking-widest opacity-40 ${msg.role === 'user' ? 'text-black/60' : 'text-gray-500'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  {/* Bubble Tail Replacement (Stylized) */}
                  <div className={`absolute bottom-0 size-4 ${msg.role === 'user' ? '-right-1 bg-primary' : '-left-1 bg-surface-dark/40 border-l border-b border-white/5'} transform rotate-45 -z-10`} />
                </div>

                {msg.role === 'user' && (
                  <div
                    className="size-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 bg-cover bg-center self-end mb-4 shadow-glass"
                    style={{ backgroundImage: `url('${userAvatar || 'https://ui-avatars.com/api/?name=U&background=00E599&color=000'}')` }}
                  />
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4 justify-start">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 animate-pulse">
                  <Sparkles size={18} className="text-primary" />
                </div>
                <div className="bg-surface-dark/40 backdrop-blur-md border border-white/5 px-6 py-4 rounded-[28px] rounded-bl-none flex items-center gap-3 shadow-glass">
                  <div className="flex gap-1">
                    <span className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="size-1.5 bg-primary rounded-full animate-bounce" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Processando Inteligência...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* Input Area (Sticky-ish) */}
          <div className="p-4 bg-transparent mt-auto">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Suggestions */}
              {messages.length < 3 && (
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-2">
                  {SUGGESTIONS.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(suggestion)}
                      className="whitespace-nowrap px-4 py-2 rounded-xl bg-surface-dark/60 backdrop-blur-md border border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-primary/40 hover:text-primary transition-all duration-300 active:scale-95 shadow-glass"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative flex items-center group">
                {/* Glow behind input */}
                <div className="absolute inset-0 bg-primary/5 blur-xl rounded-[32px] group-focus-within:bg-primary/10 transition-all duration-500" />
                
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Comando para o TerraGes..."
                  className="w-full h-16 bg-surface-dark/80 backdrop-blur-xl text-white placeholder:text-gray-600 rounded-[32px] pl-8 pr-20 text-sm border border-white/5 focus:outline-none focus:border-primary/30 transition-all shadow-glass relative z-10 font-medium"
                  disabled={isLoading}
                />
                
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  className="absolute right-3 size-12 bg-primary text-black rounded-2xl flex items-center justify-center hover:bg-primary-hover disabled:opacity-20 disabled:grayscale transition-all shadow-neon active:scale-90 z-20"
                >
                  <Send size={20} strokeWidth={3} />
                </button>
              </div>
              
              <div className="flex items-center justify-center gap-2 px-4 opacity-30">
                <Info size={10} className="text-gray-500" />
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                  IA em Beta: Análise de dados reais sujeita a variações
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};