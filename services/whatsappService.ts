import { supabase } from './supabaseClient';

export interface WhatsAppConversation {
  id: string;
  profile_id: string;
  phone_number: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  action_type: 'schedule' | 'service_order' | 'report' | null;
  action_data: Record<string, unknown> | null;
  action_status: 'none' | 'pending' | 'completed' | 'failed';
  whatsapp_msg_id: string | null;
  created_at: string;
}

export const whatsappService = {
  /** Lista todas as conversas do usuário logado */
  async getConversations(): Promise<WhatsAppConversation[]> {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar conversas:', error);
      throw error;
    }
    return data ?? [];
  },

  /** Lista as mensagens de uma conversa */
  async getMessages(conversationId: string): Promise<WhatsAppMessage[]> {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      throw error;
    }
    return data ?? [];
  },

  /** Conta conversas com rascunhos pendentes */
  async countPendingActions(): Promise<number> {
    const { count, error } = await supabase
      .from('whatsapp_inbound_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'needs_review');

    if (error) return 0;
    return count ?? 0;
  },

  /**
   * Aprova um rascunho pendente e executa a ação real
   * (Cria o agendamento ou OS no banco baseado nos action_data)
   */
  async approveDraftAction(messageId: string, message: WhatsAppMessage): Promise<void> {
    throw new Error('Rascunhos antigos estão suspensos. Confira o envio na nova caixa de entrada.');
  },

  /** Rejeita/descarta um rascunho pendente */
  async rejectDraftAction(messageId: string): Promise<void> {
    throw new Error('Rascunhos antigos estão suspensos.');
  },

  /**
   * Configura o webhook da Evolution API para apontar para o Supabase.
   * Deve ser chamado após conectar o WhatsApp nas Configurações.
   * Formato Evolution Go: url, enabled, webhookByEvents, events
   */
  async configureWebhook(evolutionBaseUrl: string, evolutionApiKey: string, instanceName: string): Promise<void> {
    throw new Error('A conexão é configurada somente no servidor pelo responsável técnico.');
  },
};
