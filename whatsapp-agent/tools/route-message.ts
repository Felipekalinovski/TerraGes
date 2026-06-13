import { defineTool } from 'wa-agent/tools/types';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default defineTool({
  description: 'Roteia mensagens para agentes especializados com base na classificação',
  inputSchema: z.object({
    category: z.string(),
    confidence: z.number(),
    phone: z.string(),
    userRole: z.string(),
    originalMessage: z.string(),
  }),
  execute: async ({ category, confidence, phone, userRole, originalMessage }, ctx) => {
    try {
      let conversationId: string;
      const { data: existingConv } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('phone_number', phone)
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
        await supabase
          .from('whatsapp_conversations')
          .update({
            last_message: originalMessage.substring(0, 200),
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conversationId);
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('whatsapp_conversations')
          .insert([{
            profile_id: phone,
            phone_number: phone,
            contact_name: null,
            last_message: originalMessage.substring(0, 200),
          }])
          .select('id')
          .single();

        if (convError || !newConv) throw new Error(`Falha ao criar conversa: ${convError?.message}`);
        conversationId = newConv.id;
      }

      await supabase
        .from('whatsapp_messages')
        .insert([{
          conversation_id: conversationId,
          role: 'user',
          content: originalMessage,
          whatsapp_msg_id: `msg_${Date.now()}`,
        }]);

      const agentMapping: Record<string, string> = {
        'fleet': 'fleet-bot',
        'machine_hours': 'fleet-bot',
        'rdo': 'rdo-bot',
        'finance': 'finance-bot',
        'schedule': 'schedule-bot',
        'service_order': 'service-order-bot',
        'historical_query': 'analytics-bot',
        'delete_record': 'admin-bot',
        'off_scope': 'default-bot',
      };
      const targetAgent = agentMapping[category] || 'default-bot';

      return {
        success: true,
        conversationId,
        targetAgent,
        category,
        confidence,
        message: `Roteado para ${targetAgent} (${(confidence * 100).toFixed(0)}%)`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        category,
        targetAgent: 'fallback-bot',
      };
    }
  },
});