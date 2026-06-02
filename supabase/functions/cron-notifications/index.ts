import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "https://evolution.kalinovski.online").replace(/\/$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendScheduledNotifications() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date().toISOString();
  
  try {
    // Buscar notificações agendadas para o momento atual
    const { data: notifications } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('scheduled_time', now)
      .eq('sent', false);
    
    if (!notifications || notifications.length === 0) {
      console.log('Nenhuma notificação agendada para este momento.');
      return;
    }
    
    for (const notification of notifications) {
      // Buscar usuários do target_role
      const { data: users } = await supabase
        .from('profiles')
        .select('phone')
        .eq('role', notification.target_role);
      
      if (!users || users.length === 0) {
        console.log(`Nenhum usuário encontrado para o papel: ${notification.target_role}`);
        continue;
      }
      
      // Enviar notificações via WhatsApp
      for (const user of users) {
        try {
          await sendMessage(user.phone, notification.message, EVOLUTION_API_KEY);
          console.log(`Notificação enviada para: ${user.phone}`);
        } catch (error) {
          console.error(`Erro ao enviar notificação para ${user.phone}:`, error);
        }
      }
      
      // Marcar como enviada
      await supabase
        .from('scheduled_notifications')
        .update({ sent: true })
        .eq('id', notification.id);
        
      console.log(`Notificação marcada como enviada: ${notification.id}`);
    }
  } catch (error) {
    console.error('Erro ao enviar notificações agendadas:', error);
    throw error;
  }
}

async function sendMessage(to: string, text: string, token: string): Promise<void> {
  // Formatar número: adicionar @s.whatsapp.net se necessário
  const number = to.includes('@s.whatsapp.net') ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;

  // Endpoint Evolution Go conforme documentação
  const url = `${EVOLUTION_API_URL}/send/text`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": token,
      },
      body: JSON.stringify({
        number: number,
        text: text,
        delay: -1, // Envia imediatamente
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[WA] Erro ao enviar para ${to}: ${res.status}: ${err}`);
      throw new Error(`Failed to send message: ${res.status}: ${err}`);
    }

    console.log(`[WA] Enviado para ${to} via ${url}`);
  } catch (e) {
    console.error(`[WA] Erro na requisição para ${to}: ${e}`);
    throw e;
  }
}

// Handler para execução manual ou via cron
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }
  
  if (req.method === "GET") {
    // Permitir execução manual via GET para testes
    try {
      await sendScheduledNotifications();
      return new Response(JSON.stringify({ success: true, message: "Notificações enviadas com sucesso!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    } catch (error) {
      console.error("Erro no handler de GET:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }
  }
  
  if (req.method === "POST") {
    // Para integração com cron jobs
    try {
      await sendScheduledNotifications();
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    } catch (error) {
      console.error("Erro no handler de POST:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }
  }
  
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});