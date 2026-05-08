import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "https://evolution.kalinovski.online").replace(/\/$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "";
const OPENROUTER_MODEL = Deno.env.get("AI_MODEL_TEXT") ?? "qwen/qwen3-4b:free";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Schema Evogo ─────────────────────────────────────────────────────────────
interface EvogoPayload {
  event: string;
  instanceName: string;
  instanceToken?: string;
  data: {
    Info: {
      Chat: string;       // número do remetente: "555592149709@s.whatsapp.net"
      Sender: string;     // JID completo do sender
      ID: string;         // ID da mensagem
      IsFromMe: boolean;
      IsGroup: boolean;
      PushName: string;
      Type: string;       // "text" | "audio" | "image" | ...
      MediaType: string;
      Timestamp: string;
    };
    Message: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      audioMessage?: { mimetype: string; seconds?: number };
      imageMessage?: { mimetype: string; caption?: string };
    };
    IsBotInvoke: boolean;
    IsEdit: boolean;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net|@g\.us/g, "").split(":")[0].replace(/\D/g, "");
}

function extractText(payload: any): string | null {
  // Tenta extrair de várias estruturas possíveis (Evolution v1, v2, v3 e Go)
  const msg = payload.data?.Message || payload.Message || payload;
  return (
    msg?.conversation || 
    msg?.extendedTextMessage?.text || 
    msg?.text ||
    msg?.content ||
    payload.data?.message?.text ||
    null
  );
}

function detectType(info: EvogoPayload["data"]["Info"]): "text" | "audio" | "image" | "unsupported" {
  const t = (info.Type ?? "").toLowerCase();
  const mt = (info.MediaType ?? "").toLowerCase();
  if (t === "text") return "text";
  if (t === "audio" || mt === "audio") return "audio";
  if (t === "image" || mt === "image") return "image";
  return "unsupported";
}

// ─── Evolution API ────────────────────────────────────────────────────────────

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
        // Campos opcionais conforme documentação (podem ser removidos se não forem necessários)
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

async function getMediaBase64(msgId: string, chatJid: string, token: string): Promise<{ base64: string; mimetype: string } | null> {
  // Formatação correta para Evolution Go
  const url = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage`;
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": token,
      },
      body: JSON.stringify({ 
        message: { 
          key: { 
            id: msgId, 
            remoteJid: chatJid 
          } 
        } 
      }),
    });
    
    if (!res.ok) { 
      const err = await res.text();
      console.error(`[Media] Falha: ${res.status}: ${err}`); 
      return null; 
    }
    
    const data = await res.json();
    // Evolution Go pode retornar o base64 em diferentes campos
    return { 
      base64: data.base64 ?? data.data?.base64, 
      mimetype: data.mimetype ?? data.data?.mimetype ?? "audio/ogg" 
    };
  } catch (e) { 
    console.error(`[Media] Erro: ${e}`); 
    return null; 
  }
}

// ─── Groq Whisper ─────────────────────────────────────────────────────────────

async function transcribeAudio(base64: string, mimetype: string): Promise<string | null> {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const ext = mimetype.includes("ogg") ? "ogg" : "mp4";
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimetype }), `audio.${ext}`);
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "pt");
    form.append("response_format", "text");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: form,
    });
    if (!res.ok) { console.error("[Whisper] Erro:", await res.text()); return null; }
    return (await res.text()).trim();
  } catch (e) { console.error("[Whisper] Erro:", e); return null; }
}

// ─── IA ───────────────────────────────────────────────────────────────────────

async function callAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://terrages.app",
      "X-Title": "TerraGes OperaAI",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content ?? "";
}

async function buildSystemContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  inputType?: string,
  isAdmin: boolean = false
): Promise<string> {
  const today = new Date();
  
  // Se não é admin, retorna contexto LIMITADO (apenas confirmações)
  if (!isAdmin) {
    return `Você é o OperaAI, assistente do TerraGes.

ATENÇÃO: Você é OPERADOR e NÃO tem acesso aos dados da empresa.
Seu trabalho é confirmar o recebimento de informações e orientar o gestor.

Se o operador pedir informações sobre:
- Frota: "Apenas gestores têm acesso a informações da frota."
- Financeiro: "Apenas gestores têm acesso ao financeiro."
- Relatórios: "Peça ao gestor para gerar o relatório no app."
- Agenda: "Peça ao gestor para verificar a agenda."
- Máquinas: "Peça ao gestor para verificar as máquinas."

Se o operador informar dados para registro (horas, OS, etc):
- Responda: "Dados recebidos! Seu gestor vai confirmar e registrar no sistema."
- Não crie nenhum registro, apenas confirme o recebimento.

IMPORTANTE: Nunca revele dados financeiros, de frotas, agenda ou qualquer informação da empresa.`;
  }

  // ADMIN CONTEXT - buscar dados reais
  const ago30 = new Date(today);
  ago30.setDate(ago30.getDate() - 30);

  const [{ data: machines }, { data: transactions }, { data: schedules }, { data: serviceOrders }] =
    await Promise.all([
      supabase.from("machines").select("name, type, status, health_score, health_status").eq("user_id", userId),
      supabase.from("transactions").select("amount, type, category").eq("user_id", userId).gte("date", ago30.toISOString().split("T")[0]),
      supabase.from("schedules").select("title, type, start_time, priority").gte("start_time", today.toISOString()).order("start_time", { ascending: true }).limit(5),
      supabase.from("service_orders").select("client, status, date, total_value").eq("user_id", userId).order("date", { ascending: false }).limit(5),
    ]);

  const income = transactions?.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0) ?? 0;
  const expense = transactions?.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0) ?? 0;
  const machinesList = machines?.map((m) => `- ${m.name} (${m.type}): ${m.health_status} – saúde ${m.health_score}%`).join("\n") || "Nenhuma máquina cadastrada.";
  const scheduleList = schedules?.map((s) => `- ${s.title} | ${new Date(s.start_time).toLocaleDateString("pt-BR")} | Prioridade: ${s.priority}`).join("\n") || "Nenhum agendamento futuro.";
  const osList = serviceOrders?.map((o) => `- Cliente: ${o.client} | Status: ${o.status} | Data: ${o.date} | Valor: R$ ${Number(o.total_value ?? 0).toFixed(2)}`).join("\n") || "Nenhuma OS recente.";

  return `Você é o OperaAI, assistente inteligente do TerraGes.
Atende via WhatsApp. Seja direto, cordial e use português simples.
NUNCA invente dados. Use APENAS as informações abaixo.
Hoje é ${today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}.

=== FROTA ===
${machinesList}

=== FINANCEIRO (últimos 30 dias) ===
- Receitas: R$ ${income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Custo/Despesas: R$ ${expense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Margem/Saldo: R$ ${(income - expense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Total de OS: ${serviceOrders?.length ?? 0} recentes

=== PRÓXIMOS AGENDAMENTOS ===
${scheduleList}

=== ORDENS DE SERVIÇO RECENTES ===
${osList}

=== INSTRUÇÕES DE AÇÕES (ADMIN) ===
Se o usuário passar infos soltas (ex: "Escavadeira, 8h, João, terraplanagem"), crie uma OS:
[[CREATE_OS:{"client":"...","date":"YYYY-MM-DD","start_hour":0,"end_hour":0,"hourly_rate":0,"payment_method":"Pix","description":"...","save":"draft"}]]

Para AGENDAR:
[[CREATE_SCHEDULE:{"title":"...","type":"...","start_time":"YYYY-MM-DDTHH:mm:ss","priority":"high","notes":"...","save":"draft"}]]

Para RELATÓRIO FINANCEIRO:
📊 RELATÓRIO - MÊS VIGENTE
💰 Receita: R$ [Valor]
💸 Custo: R$ [Valor]
✅ Margem: R$ [Valor] (XX%)

IMPORTANTE: Respostas curtas, sem asteriscos. Tag [[CREATE...]] apenas se for ADMIN.`;
}

async function processActions(
  supabase: ReturnType<typeof createClient>,
  aiResponse: string,
  userId: string,
  isAdmin: boolean = false
): Promise<{ cleanText: string; actionType: string | null; actionData: unknown; actionStatus: string }> {
  let cleanText = aiResponse;
  let actionType: string | null = null;
  let actionData: unknown = null;
  let actionStatus = "none";

  // Se não é admin, remove todas as tags de ação e informa o operador
  if (!isAdmin) {
    const hasActionRequest = /\[\[CREATE_(OS|SCHEDULE|REPORT):/.test(aiResponse);
    cleanText = aiResponse.replace(/\[\[CREATE_.*?\]\]/gs, "").trim();
    if (hasActionRequest) {
      cleanText += "\n\n⚠️ Apenas administradores podem criar registros. Peça ao gestor para confirmar no app.";
    }
    return { cleanText, actionType, actionData, actionStatus };
  }

  const scheduleMatch = aiResponse.match(/\[\[CREATE_SCHEDULE:(.*?)\]\]/s);
  if (scheduleMatch) {
    cleanText = aiResponse.replace(/\[\[CREATE_SCHEDULE:.*?\]\]/s, "").trim();
    try {
      const parsed = JSON.parse(scheduleMatch[1]);
      const { save, ...scheduleData } = parsed;
      actionType = "schedule"; actionData = scheduleData;
      if (save !== "draft") {
        const { error } = await supabase.from("schedules").insert([scheduleData]);
        actionStatus = error ? "failed" : "completed";
        if (error) cleanText += "\n\n⚠️ Erro ao salvar agendamento. Tente pelo app.";
      } else {
        actionStatus = "pending";
        cleanText += "\n_(Salvo como rascunho — confirme no app)_";
      }
    } catch (e) { console.error("[Action] Schedule:", e); actionStatus = "failed"; }
  }

  const osMatch = aiResponse.match(/\[\[CREATE_OS:(.*?)\]\]/s);
  if (osMatch) {
    cleanText = aiResponse.replace(/\[\[CREATE_OS:.*?\]\]/s, "").trim();
    try {
      const parsed = JSON.parse(osMatch[1]);
      const { save, ...osData } = parsed;
      actionType = "service_order"; actionData = osData;
      if (save !== "draft") {
        const { error } = await supabase.from("service_orders").insert([{ ...osData, user_id: userId, status: "pending" }]);
        actionStatus = error ? "failed" : "completed";
        if (error) cleanText += "\n\n⚠️ Erro ao criar OS. Tente pelo app.";
      } else {
        actionStatus = "pending";
        cleanText += "\n_(OS salva como rascunho — confirme no app)_";
      }
    } catch (e) { console.error("[Action] OS:", e); actionStatus = "failed"; }
  }

  return { cleanText, actionType, actionData, actionStatus };
}

// ─── Handler Principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS" || req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "OperaAI" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const bodyText = await req.text();
    if (!bodyText?.trim()) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders });
    }

    let payload: EvogoPayload;
    try { payload = JSON.parse(bodyText); }
    catch { return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400, headers: corsHeaders }); }

    // Ignora eventos que não são mensagens
    if (payload.event !== "Message") {
      return new Response(JSON.stringify({ ok: true, skipped: true, event: payload.event }), { headers: corsHeaders });
    }

    const info = payload.data?.Info;
    const msg = payload.data?.Message;

    // Ignora mensagens enviadas pelo bot, grupos e edições
    if (!info || info.IsFromMe || info.IsGroup || payload.data?.IsEdit) {
      console.log(`[Skip] fromMe:${info?.IsFromMe} | group:${info?.IsGroup} | edit:${payload.data?.IsEdit}`);
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders });
    }

    const rawPhone = info.Chat;
    const phone = normalizePhone(rawPhone);
    const msgId = info.ID;
    const contactName = info.PushName ?? null;
    const msgTypeStr = detectType(info);
    const instanceToken = payload.instanceToken ?? EVOLUTION_API_KEY;

    console.log(`[WA] Mensagem de ${phone} (${contactName}) — tipo: ${msgTypeStr}`);

    if (msgTypeStr === "unsupported") {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "unsupported_type" }), { headers: corsHeaders });
    }

    // ── Extrai texto ou transcreve áudio ──────────────────────────────────────
    let userText: string | null = null;
    const inputType = msgTypeStr;

    if (msgTypeStr === "text") {
      userText = extractText(payload);
    } else if (msgTypeStr === "audio") {
      await sendMessage(phone, "🎙️ Ouvi seu áudio! Processando...", instanceToken);
      const media = await getMediaBase64(msgId, rawPhone, instanceToken);
      if (media?.base64) {
        userText = await transcribeAudio(media.base64, media.mimetype);
        if (!userText) {
          await sendMessage(phone, "⚠️ Não consegui entender o áudio. Pode digitar?", instanceToken);
          return new Response(JSON.stringify({ ok: true, reason: "transcription_failed" }), { headers: corsHeaders });
        }
        console.log(`[Whisper] "${userText.substring(0, 100)}"`);
      } else {
        await sendMessage(phone, "⚠️ Não consegui baixar o áudio. Pode digitar?", instanceToken);
        return new Response(JSON.stringify({ ok: true, reason: "media_failed" }), { headers: corsHeaders });
      }
    } else if (msgTypeStr === "image") {
      userText = msg?.imageMessage?.caption ?? null;
      if (!userText) {
        await sendMessage(phone, "📸 Foto recebida! Em breve vou conseguir ler imagens. Por enquanto, descreva o que está na foto.", instanceToken);
        return new Response(JSON.stringify({ ok: true, reason: "image_pending" }), { headers: corsHeaders });
      }
    }

    if (!userText) {
      console.log("[WA] Falha ao extrair texto do payload:", JSON.stringify(payload).substring(0, 500));
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_text" }), { headers: corsHeaders });
    }

    // 1. Identifica o usuário e role
    const { data: profile } = await supabase.from("profiles").select("id,role").eq("phone", phone).maybeSingle();

    if (!profile) {
      await sendMessage(phone, `Bem-vindo! 👋 Sou OperaAI, assistente do TerraGes.\nPosso ajudar com: registrar horas, orçamentos, relatórios e sua frota.\n\nPara começar, cadastre seu número (${phone}) nas Configurações do app!`, instanceToken);
      return new Response(JSON.stringify({ ok: true, reason: "user_not_found" }), { headers: corsHeaders });
    }

    const userId = profile.id;
    const userRole = (profile.role ?? "operador").toLowerCase();
    const isAdminUser = ["admin", "gerente", "proprietario", "dono"].includes(userRole);

    // 2. Busca ou cria conversa
    let conversationId: string;
    const { data: existingConv } = await supabase.from("whatsapp_conversations").select("id").eq("phone_number", phone).maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
      await supabase.from("whatsapp_conversations").update({
        last_message: userText.substring(0, 200),
        last_message_at: new Date().toISOString(),
        contact_name: contactName ?? undefined,
      }).eq("id", conversationId);
    } else {
      const { data: newConv, error: convError } = await supabase
        .from("whatsapp_conversations")
        .insert([{ profile_id: userId, phone_number: phone, contact_name: contactName, last_message: userText.substring(0, 200) }])
        .select("id").single();
      if (convError || !newConv) throw new Error("Falha ao criar conversa");
      conversationId = newConv.id;
    }

    // 3. Salva mensagem do usuário
    await supabase.from("whatsapp_messages").insert([{
      conversation_id: conversationId, role: "user", content: userText,
      whatsapp_msg_id: msgId, input_type: inputType,
    }]);

    // 4. Histórico (últimas 10 mensagens)
    const { data: history } = await supabase
      .from("whatsapp_messages").select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }).limit(10);

    const historyMessages = (history ?? []).reverse().map((m) => ({
      role: m.role as "user" | "assistant", content: m.content,
    }));

    // 5. Chama a IA (apenas admin pode gerar relatórios)
    const systemContext = await buildSystemContext(supabase, userId, inputType, isAdminUser);
    const aiResponse = await callAI([{ role: "system", content: systemContext }, ...historyMessages]);

    // 6. Processa ações (APENAS admin pode criar OS e agendamentos diretamente)
    const { cleanText, actionType, actionData, actionStatus } = await processActions(supabase, aiResponse, userId, isAdminUser);

    // 7. Salva resposta do assistente
    await supabase.from("whatsapp_messages").insert([{
      conversation_id: conversationId, role: "assistant", content: cleanText,
      action_type: actionType, action_data: actionData as never, action_status: actionStatus,
    }]);

    // 8. Envia resposta
    await sendMessage(phone, cleanText, instanceToken);
    console.log(`[WA] Resposta processada para ${phone}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Bot] Erro fatal:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
