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
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('action_status', 'pending');

    if (error) return 0;
    return count ?? 0;
  },

  /**
   * Aprova um rascunho pendente e executa a ação real
   * (Cria o agendamento ou OS no banco baseado nos action_data)
   */
  async approveDraftAction(messageId: string, message: WhatsAppMessage): Promise<void> {
    if (!message.action_data || message.action_status !== 'pending') return;

    let error: unknown = null;

    if (message.action_type === 'schedule') {
      const { error: e } = await supabase
        .from('schedules')
        .insert([message.action_data as Record<string, unknown>]);
      error = e;
    } else if (message.action_type === 'service_order') {
      const { error: e } = await supabase
        .from('service_orders')
        .insert([{ ...(message.action_data as Record<string, unknown>), status: 'pending' }]);
      error = e;
    }

    const newStatus = error ? 'failed' : 'completed';
    await supabase
      .from('whatsapp_messages')
      .update({ action_status: newStatus })
      .eq('id', messageId);

    if (error) throw new Error('Falha ao executar ação do rascunho');
  },

  /** Rejeita/descarta um rascunho pendente */
  async rejectDraftAction(messageId: string): Promise<void> {
    await supabase
      .from('whatsapp_messages')
      .update({ action_status: 'failed' })
      .eq('id', messageId);
  },

  /**
   * Configura o webhook da Evolution API para apontar para o Supabase.
   * Deve ser chamado após conectar o WhatsApp nas Configurações.
   */
  async configureWebhook(evolutionBaseUrl: string, evolutionApiKey: string, instanceName: string): Promise<void> {
    const webhookUrl = `https://gwusywstresijdjzkujn.supabase.co/functions/v1/whatsapp-bot`;

    const res = await fetch(`${evolutionBaseUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        webhookUrl,
        webhookByEvents: true,
        events: ['MESSAGES_UPSERT'],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Falha ao configurar webhook: ${txt}`);
    }
  },
};
