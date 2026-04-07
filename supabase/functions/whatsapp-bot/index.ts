import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Configurações ───────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "https://api.kalinovski.online";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "";
const OPENROUTER_MODEL = Deno.env.get("AI_MODEL_TEXT") ?? "qwen/qwen3.6-plus:free";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
    };
    pushName?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normaliza o número do WhatsApp para o formato 5511999999999
 */
function normalizePhone(remoteJid: string): string {
  return remoteJid.replace(/@s\.whatsapp\.net|@g\.us/g, "").replace(/\D/g, "");
}

/**
 * Extrai o texto da mensagem do payload da Evolution API
 */
function extractMessageText(data: EvolutionWebhookPayload["data"]): string | null {
  return (
    data.message?.conversation ??
    data.message?.extendedTextMessage?.text ??
    null
  );
}

/**
 * Envia uma mensagem de texto via Evolution API
 */
async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
  const payload = {
    number: to,
    text,
    options: { delay: 500, presence: "composing" },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[WhatsApp] Erro ao enviar mensagem:", err);
  }
}

/**
 * Chama a OpenRouter com o contexto completo e retorna a resposta da IA
 */
async function callAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://terrages.app",
      "X-Title": "TerraGes WhatsApp Bot",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Busca o contexto dinâmico do sistema para um usuário específico
 */
async function buildSystemContext(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [{ data: machines }, { data: transactions }, { data: schedules }, { data: serviceOrders }] =
    await Promise.all([
      supabase.from("machines").select("name, type, status, health_score, health_status").eq("user_id", userId),
      supabase.from("transactions").select("amount, type, category").eq("user_id", userId).gte("date", thirtyDaysAgo.toISOString().split("T")[0]),
      supabase.from("schedules").select("title, type, start_time, priority").gte("start_time", today.toISOString()).order("start_time", { ascending: true }).limit(5),
      supabase.from("service_orders").select("client, status, date, total_value").eq("user_id", userId).order("date", { ascending: false }).limit(5),
    ]);

  const income = transactions?.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0) ?? 0;
  const expense = transactions?.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0) ?? 0;

  const machinesList = machines?.map((m) => `- ${m.name} (${m.type}): ${m.health_status} – saúde ${m.health_score}%`).join("\n") || "Nenhuma máquina cadastrada.";
  const scheduleList = schedules?.map((s) => `- ${s.title} | ${new Date(s.start_time).toLocaleDateString("pt-BR")} | Prioridade: ${s.priority}`).join("\n") || "Nenhum agendamento futuro.";
  const osList = serviceOrders?.map((o) => `- Cliente: ${o.client} | Status: ${o.status} | Data: ${o.date} | Valor: R$ ${Number(o.total_value ?? 0).toFixed(2)}`).join("\n") || "Nenhuma OS recente.";

  return `Você é o assistente do TerraGes — sistema de gestão para empresas de terraplanagem e obras.
Atende via WhatsApp. Seja direto, cordial e use linguagem simples em português do Brasil.
NUNCA invente dados. Use apenas as informações abaixo.
IMPORTANTE: Os números de telefone são armazenados no formato internacional completo (DDI + DDD + Número), ex: 5511999999999.
Caso precise exibir ou coletar telefones, use o formato amigável como +55 (11) 99999-9999.

Hoje é ${today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}.

=== FROTA ===
${machinesList}

=== FINANCEIRO (últimos 30 dias) ===
- Receitas: R$ ${income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Despesas: R$ ${expense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Saldo: R$ ${(income - expense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

=== PRÓXIMOS AGENDAMENTOS ===
${scheduleList}

=== ORDENS DE SERVIÇO RECENTES ===
${osList}

=== INSTRUÇÕES DE AÇÕES ===
Se o usuário quiser AGENDAR um serviço, colete: título, tipo (excavation/transport/maintenance/other), data/hora e prioridade.
Depois use exatamente este formato na sua resposta (pode ser junto com texto normal):
[[CREATE_SCHEDULE:{"title":"...","type":"...","start_time":"YYYY-MM-DDTHH:mm:ss","priority":"high","notes":"...","save":"draft"}]]
Use "save":"direct" para salvar direto, ou "save":"draft" para deixar como rascunho pendente no app.

Se o usuário quiser criar uma ORDEM DE SERVIÇO, colete: cliente, data, máquina, operador, horas (início/fim), valor/hora, forma de pagamento.
Depois use exatamente este formato:
[[CREATE_OS:{"client":"...","date":"YYYY-MM-DD","start_hour":0,"end_hour":0,"hourly_rate":0,"payment_method":"Pix","description":"...","save":"draft"}]]

Se o usuário pedir RELATÓRIO FINANCEIRO, responda com os dados de financeiro acima.
Se o usuário pedir STATUS DA FROTA, responda com os dados de frota acima.
Se o usuário pedir PRÓXIMOS SERVIÇOS, responda com os agendamentos acima.

IMPORTANTE: Mantenha respostas curtas (até 5 linhas). Não use markdown (asteriscos, #) pois vai ser exibido no WhatsApp.`;
}

/**
 * Processa e executa as ações da IA (schedule, OS)
 */
async function processActions(
  supabase: ReturnType<typeof createClient>,
  aiResponse: string,
  userId: string,
  conversationId: string
): Promise<{ cleanText: string; actionType: string | null; actionData: unknown | null; actionStatus: string }> {
  let cleanText = aiResponse;
  let actionType: string | null = null;
  let actionData: unknown = null;
  let actionStatus = "none";

  // Detecta CREATE_SCHEDULE
  const scheduleMatch = aiResponse.match(/\[\[CREATE_SCHEDULE:(.*?)\]\]/s);
  if (scheduleMatch) {
    cleanText = aiResponse.replace(/\[\[CREATE_SCHEDULE:.*?\]\]/s, "").trim();
    try {
      const parsed = JSON.parse(scheduleMatch[1]);
      const isDraft = parsed.save === "draft";
      const { save: _save, ...scheduleData } = parsed;

      actionType = "schedule";
      actionData = scheduleData;

      if (!isDraft) {
        const { error } = await supabase.from("schedules").insert([scheduleData]);
        actionStatus = error ? "failed" : "completed";
        if (!error) {
          cleanText += "\n\n✅ Agendamento criado com sucesso no sistema!";
        } else {
          cleanText += "\n\n⚠️ Não consegui salvar o agendamento. Tente pelo app.";
        }
      } else {
        // Salva como rascunho via whatsapp_messages — o admin aprova no app
        actionStatus = "pending";
        cleanText += "\n\n📋 Agendamento salvo como rascunho. Acesse o app para confirmar.";
      }
    } catch (e) {
      console.error("[Action] Erro ao processar CREATE_SCHEDULE:", e);
      actionStatus = "failed";
    }
  }

  // Detecta CREATE_OS
  const osMatch = aiResponse.match(/\[\[CREATE_OS:(.*?)\]\]/s);
  if (osMatch) {
    cleanText = aiResponse.replace(/\[\[CREATE_OS:.*?\]\]/s, "").trim();
    try {
      const parsed = JSON.parse(osMatch[1]);
      const isDraft = parsed.save === "draft";
      const { save: _save, ...osData } = parsed;

      actionType = "service_order";
      actionData = osData;

      if (!isDraft) {
        const { error } = await supabase.from("service_orders").insert([{ ...osData, user_id: userId, status: "pending" }]);
        actionStatus = error ? "failed" : "completed";
        if (!error) {
          cleanText += "\n\n✅ Ordem de Serviço criada! Acesse o app para finalizar.";
        } else {
          cleanText += "\n\n⚠️ Não consegui criar a OS. Tente pelo app.";
        }
      } else {
        actionStatus = "pending";
        cleanText += "\n\n📋 OS salva como rascunho. Acesse o app para confirmar.";
      }
    } catch (e) {
      console.error("[Action] Erro ao processar CREATE_OS:", e);
      actionStatus = "failed";
    }
  }

  return { cleanText, actionType, actionData, actionStatus };
}

// ─── Handler Principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Supabase com Service Role (bypass RLS) — usado APENAS nesta function server-side
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload: EvolutionWebhookPayload = await req.json();

    // Só processa mensagens recebidas (não enviadas pelo bot)
    if (payload.event !== "messages.upsert" || payload.data?.key?.fromMe) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawPhone = payload.data.key.remoteJid;
    const whatsappMsgId = payload.data.key.id;
    const contactName = payload.data.pushName ?? null;
    const phone = normalizePhone(rawPhone);
    const userText = extractMessageText(payload.data);

    if (!userText || !phone) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[WhatsApp] Mensagem de ${phone}: ${userText.substring(0, 80)}`);

    // 1. Identifica o usuário pelo telefone
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (profileError) console.error("[DB] Erro ao buscar perfil:", profileError);

    if (!profile) {
      // Número não cadastrado → responde orientando
      await sendWhatsAppMessage(phone, `Olá! 👋 Não encontrei sua conta no TerraGes.\n\nCadastre seu número de WhatsApp (${phone}) nas Configurações do app para usar o assistente.`);
      return new Response(JSON.stringify({ ok: true, reason: "user_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = profile.id;

    // 2. Busca ou cria a conversa
    let conversationId: string;

    const { data: existingConv } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("phone_number", phone)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
      // Atualiza last_message e contact_name
      await supabase.from("whatsapp_conversations").update({
        last_message: userText.substring(0, 200),
        last_message_at: new Date().toISOString(),
        contact_name: contactName ?? undefined,
      }).eq("id", conversationId);
    } else {
      const { data: newConv, error: convError } = await supabase
        .from("whatsapp_conversations")
        .insert([{ profile_id: userId, phone_number: phone, contact_name: contactName, last_message: userText.substring(0, 200) }])
        .select("id")
        .single();

      if (convError || !newConv) {
        console.error("[DB] Erro ao criar conversa:", convError);
        throw new Error("Falha ao criar conversa");
      }
      conversationId = newConv.id;
    }

    // 3. Salva a mensagem do usuário
    await supabase.from("whatsapp_messages").insert([{
      conversation_id: conversationId,
      role: "user",
      content: userText,
      whatsapp_msg_id: whatsappMsgId,
    }]);

    // 4. Busca histórico recente (últimas 10 mensagens)
    const { data: history } = await supabase
      .from("whatsapp_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    const historyMessages = (history ?? []).reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 5. Monta o contexto e chama a IA
    const systemContext = await buildSystemContext(supabase, userId);

    const aiResponse = await callAI([
      { role: "system", content: systemContext },
      ...historyMessages,
    ]);

    // 6. Processa ações da IA e limpa o texto
    const { cleanText, actionType, actionData, actionStatus } = await processActions(
      supabase,
      aiResponse,
      userId,
      conversationId
    );

    // 7. Salva a resposta do assistente
    await supabase.from("whatsapp_messages").insert([{
      conversation_id: conversationId,
      role: "assistant",
      content: cleanText,
      action_type: actionType,
      action_data: actionData as never,
      action_status: actionStatus,
    }]);

    // 8. Envia a resposta ao WhatsApp
    await sendWhatsAppMessage(phone, cleanText);

    console.log(`[WhatsApp] Resposta enviada para ${phone}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WhatsApp Bot] Erro fatal:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
