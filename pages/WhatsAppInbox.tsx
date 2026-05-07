import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout';
import {
  MessageCircle, User, Bot, Loader2, Check, X, Clock,
  ChevronRight, Phone, Calendar, ClipboardList, AlertCircle, RefreshCw
} from 'lucide-react';
import { whatsappService, WhatsAppConversation, WhatsAppMessage } from '../services/whatsappService';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../services/roleService';

// ─── Badge de Status da Ação ────────────────────────────────────────────────
const ActionBadge: React.FC<{ type: string | null; status: string }> = ({ type, status }) => {
  if (!type || status === 'none') return null;

  const icons: Record<string, React.ReactNode> = {
    schedule: <Calendar size={10} />,
    service_order: <ClipboardList size={10} />,
    report: <AlertCircle size={10} />,
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    completed: 'bg-green-500/20 text-green-300 border-green-500/30',
    failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Rascunho pendente',
    completed: 'Executado',
    failed: 'Falhou',
  };

  const typeLabels: Record<string, string> = {
    schedule: 'Agendamento',
    service_order: 'Ordem de Serviço',
    report: 'Relatório',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest mt-2 ${statusColors[status] ?? 'bg-white/10'}`}>
      {icons[type]}
      <span>{typeLabels[type] ?? type}</span>
      <span className="opacity-60">·</span>
      <span>{statusLabels[status] ?? status}</span>
    </div>
  );
};

// ─── Componente de Aprovação de Rascunho ────────────────────────────────────
const DraftApprovalCard: React.FC<{
  message: WhatsAppMessage;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
}> = ({ message, onApprove, onReject, loading }) => {
  const typeLabel = message.action_type === 'schedule' ? 'Agendamento' : 'Ordem de Serviço';
  const data = message.action_data ?? {};

  return (
    <div className="mt-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
      <p className="text-[9px] font-black uppercase tracking-widest text-yellow-400 mb-2">
        📋 {typeLabel} — Aguardando aprovação
      </p>
      <div className="space-y-0.5 mb-3">
        {Object.entries(data).slice(0, 5).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-[10px]">
            <span className="text-gray-500 font-bold capitalize min-w-[80px]">{k}:</span>
            <span className="text-gray-300">{String(v)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 bg-primary text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Confirmar
        </button>
        <button
          onClick={onReject}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 bg-white/5 text-gray-300 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
        >
          <X size={12} />
          Descartar
        </button>
      </div>
    </div>
  );
};

// ─── Página Principal ────────────────────────────────────────────────────────
export const WhatsAppInbox: React.FC = () => {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Role do usuário logado
  const { profile } = useAuth();
  const userRole = (profile?.role ?? '').toLowerCase();
  const isAdmin = ['admin', 'gerente', 'proprietario', 'dono'].includes(userRole);

  // Carrega conversas
  const loadConversations = async () => {
    setIsLoadingConvs(true);
    try {
      const data = await whatsappService.getConversations();
      setConversations(data);
    } catch (e) {
      console.error('Erro ao carregar conversas:', e);
    } finally {
      setIsLoadingConvs(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Carrega mensagens ao selecionar uma conversa
  useEffect(() => {
    if (!selectedConv) return;
    setIsLoadingMsgs(true);
    whatsappService.getMessages(selectedConv.id).then((data) => {
      setMessages(data);
      setIsLoadingMsgs(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, [selectedConv]);

  // Aprova rascunho
  const handleApprove = async (msg: WhatsAppMessage) => {
    setPendingActions((prev) => ({ ...prev, [msg.id]: true }));
    try {
      await whatsappService.approveDraftAction(msg.id, msg);
      // Atualiza estado local
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, action_status: 'completed' } : m))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setPendingActions((prev) => ({ ...prev, [msg.id]: false }));
    }
  };

  // Rejeita rascunho
  const handleReject = async (msg: WhatsAppMessage) => {
    setPendingActions((prev) => ({ ...prev, [msg.id]: true }));
    try {
      await whatsappService.rejectDraftAction(msg.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, action_status: 'failed' } : m))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setPendingActions((prev) => ({ ...prev, [msg.id]: false }));
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  return (
    <Layout>
      <Layout.Header
        title="WhatsApp"
        subTitle="Conversas via Bot IA"
        actions={
          <button
            onClick={loadConversations}
            className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/30 transition-all"
          >
            <RefreshCw size={16} />
          </button>
        }
      />

      <Layout.Content>
        <div className="flex h-[calc(100vh-5rem)] overflow-hidden">

          {/* ─── Lista de Conversas ─── */}
          <div className={`${selectedConv ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r border-white/5 bg-surface-dark/30`}>
            <div className="p-4 border-b border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {conversations.length} conversa(s)
              </p>
            </div>

            {isLoadingConvs ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={32} className="text-primary animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="size-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <MessageCircle size={28} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-white font-bold">Nenhuma conversa ainda</p>
                  <p className="text-gray-500 text-xs mt-1">
                    Configure o WhatsApp nas Integrações e envie uma mensagem para o número conectado.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={`w-full p-4 flex items-start gap-3 border-b border-white/5 transition-all hover:bg-white/5 text-left ${selectedConv?.id === conv.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                  >
                    <div className="size-10 rounded-2xl bg-green-500/15 border border-green-500/20 flex items-center justify-center shrink-0">
                      <Phone size={16} className="text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-white font-bold text-sm truncate">
                          {conv.contact_name || conv.phone_number}
                        </p>
                        <span className="text-[9px] text-gray-500 shrink-0">{formatDate(conv.last_message_at)}</span>
                      </div>
                      {conv.contact_name && (
                        <p className="text-[9px] text-gray-600 font-mono">{conv.phone_number}</p>
                      )}
                      <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message ?? '...'}</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-600 shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── Mensagens da Conversa ─── */}
          <div className={`${selectedConv ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
            {!selectedConv ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="size-20 rounded-[32px] bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <MessageCircle size={36} className="text-green-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-lg">Selecione uma conversa</p>
                  <p className="text-gray-500 text-sm mt-1">Escolha uma conversa na lista ao lado para ver as mensagens.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header da conversa */}
                <div className="p-4 border-b border-white/5 bg-surface-dark/50 flex items-center gap-3">
                  <button onClick={() => setSelectedConv(null)} className="md:hidden p-1 text-gray-400 hover:text-white">
                    <ChevronRight size={20} className="rotate-180" />
                  </button>
                  <div className="size-9 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center shrink-0">
                    <Phone size={16} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{selectedConv.contact_name || selectedConv.phone_number}</p>
                    {selectedConv.contact_name && (
                      <p className="text-[9px] text-gray-500 font-mono">{selectedConv.phone_number}</p>
                    )}
                  </div>
                </div>

                {/* Mensagens */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isLoadingMsgs ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 size={28} className="text-primary animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-8">Nenhuma mensagem.</div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex gap-3 animate-in fade-in duration-300 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                        {msg.role === 'assistant' && (
                          <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 self-end">
                            <Bot size={14} className="text-primary" />
                          </div>
                        )}

                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div className={`p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                            ? 'bg-green-600/20 text-green-100 border border-green-600/20 rounded-br-none'
                            : 'bg-surface-dark border border-white/5 text-gray-200 rounded-bl-none'
                          }`}>
                            {msg.content}
                          </div>

                          <ActionBadge type={msg.action_type} status={msg.action_status} />

                          {/* Apenas ADMIN pode aprovar/rejeitar rascunhos */}
                          {msg.role === 'assistant' && msg.action_status === 'pending' && msg.action_data && isAdmin && (
                            <DraftApprovalCard
                              message={msg}
                              onApprove={() => handleApprove(msg)}
                              onReject={() => handleReject(msg)}
                              loading={pendingActions[msg.id] ?? false}
                            />
                          )}

                          {/* Operador vê mensagens de rascunho mas não pode agir */}
                          {msg.role === 'assistant' && msg.action_status === 'pending' && msg.action_data && !isAdmin && (
                            <div className="mt-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                              <p className="text-[9px] font-black uppercase tracking-widest text-yellow-400 mb-1">
                                📋 Rascunho pendente — hanya untuk admin
                              </p>
                              <p className="text-[10px] text-gray-500">
                                Solicite ao gestor para confirmar no app.
                              </p>
                            </div>
                          )}

                          <span className="text-[9px] text-gray-600 mt-1 px-1">{formatTime(msg.created_at)}</span>
                        </div>

                        {msg.role === 'user' && (
                          <div className="size-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 self-end">
                            <User size={14} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </>
            )}
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};
