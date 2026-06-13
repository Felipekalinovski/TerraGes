import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const OPENROUTER_MODEL = Deno.env.get("AI_MODEL_TEXT") ?? "openrouter/free";
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "";
const EVOLUTION_API_VERSION = Deno.env.get("EVOLUTION_API_VERSION") ?? "v2";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// ─── Helpers ───────────────────────────────────────────────

function normalizePhone(jid: string): string {
  return (jid ?? "").replace(/@s\.whatsapp\.net|@g\.us/g, "").split(":")[0].replace(/\D/g, "");
}

function getChatJid(payload: any): string | null {
  return payload.data?.key?.remoteJid || payload.data?.Info?.Chat || null;
}

function getMsgId(payload: any): string | null {
  return payload.data?.key?.id || payload.data?.Info?.ID || null;
}

function getFromMe(payload: any): boolean {
  return Boolean(payload.data?.key?.fromMe ?? payload.data?.Info?.IsFromMe ?? false);
}

function getIsGroup(payload: any): boolean {
  if (payload.data?.Info?.IsGroup) return true;
  const jid = getChatJid(payload);
  return Boolean(jid?.endsWith("@g.us"));
}

function getPushName(payload: any): string | null {
  return payload.data?.pushName ?? payload.data?.Info?.PushName ?? null;
}

function getInstanceToken(payload: any): string {
  return payload.token || payload.instanceToken || EVOLUTION_API_KEY;
}

function extractText(payload: any): string | null {
  const v2msg = payload.data?.message;
  if (v2msg && typeof v2msg === "object") {
    const t =
      v2msg.conversation ||
      v2msg.extendedTextMessage?.text ||
      v2msg.text ||
      v2msg.content ||
      v2msg.imageMessage?.caption ||
      null;
    if (t) return t;
  }
  const v1msg = payload.data?.Message || payload.Message || payload;
  return (
    v1msg?.conversation ||
    v1msg?.extendedTextMessage?.text ||
    v1msg?.text ||
    v1msg?.content ||
    null
  );
}

function evoUrl(path: string): string {
  const cleanPath = path.replace(/^\//, "");
  if (EVOLUTION_API_VERSION === "v2" && EVOLUTION_INSTANCE) {
    return `${EVOLUTION_API_URL}/${cleanPath}/${EVOLUTION_INSTANCE}`;
  }
  return `${EVOLUTION_API_URL}/${cleanPath}`;
}

async function sendMessage(to: string, text: string, token: string): Promise<void> {
  const number = to.includes('@s.whatsapp.net') ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;

  const res = await fetch(evoUrl("message/sendText"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": token },
    body: JSON.stringify({ number, text, delay: -1 }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[WA] Erro ao enviar para ${to}: ${res.status}: ${err}`);
  }
}

// ─── Autenticação ──────────────────────────────────────────

async function authenticateUser(phone: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, phone, role, name")
    .eq("phone", phone)
    .single();
  if (error) return null;
  return { id: data.id, phone: data.phone, role: data.role, name: data.name || "" };
}

// ─── Triage ────────────────────────────────────────────────

interface TriageResult {
  category: string;
  confidence: number;
  context?: Record<string, any>;
}

async function classifyMessage(text: string, userRole: string): Promise<TriageResult> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://terrages.app",
      "X-Title": "TerraGes OperaAI",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{
        role: "user",
        content: `Classifique a mensagem em uma categoria:
Categorias: schedule (agendamentos), maintenance (manutenção), employee (colaboradores), rdo (RDO), finance (finanças), fleet (frota), machine_hours (horas-máquina), quotes (orçamentos), service_order (OS), reports (relatórios), approval (aprovações), off_scope (fora do escopo).

Usuário é: ${userRole}
Mensagem: "${text}"

Responda APENAS JSON: {"category":"categoria","confidence":0.9}`,
      }],
      temperature: 0.1,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const d = await res.json();
  const result = d.choices?.[0]?.message?.content || "";
  const stripped = result.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(stripped);
}

// ─── Agentes Especialistas ─────────────────────────────────

const AGENT_MAP: Record<string, { name: string; prompt: string }> = {
  schedule: {
    name: "schedule-bot",
    prompt: `Você é o especialista em Agendamentos do TerraGes.
Tipos: excavation, transport, maintenance, other. Prioridades: low, medium, high, urgent.
Para criar, use no final: [[CREATE_SCHEDULE:{"title":"...","type":"...","start_time":"...","priority":"...","notes":"..."}]]
Não use markdown. Seja direto.`,
  },
  maintenance: {
    name: "maintenance-bot",
    prompt: `Você é o especialista em Manutenção do TerraGes.
Tipos: preventive, corrective, predictive.
Pergunte máquina, tipo, data, horímetro, descrição e técnico.`,
  },
  employee: {
    name: "employee-bot",
    prompt: `Você é o especialista em Equipes do TerraGes. Apenas consulta.
Informe nome, cargo, status, certificações e contato.`,
  },
  rdo: {
    name: "rdo-bot",
    prompt: `Você é o especialista em RDO do TerraGes.
Projeto, data, clima (sunny/cloudy/rainy/storm), equipe, atividades, máquinas, ocorrências.`,
  },
  finance: {
    name: "finance-bot",
    prompt: `Você é o especialista em Finanças do TerraGes.
Apenas admins/gestores veem dados financeiros completos.`,
  },
  fleet: {
    name: "fleet-bot",
    prompt: `Você é o especialista em Frota do TerraGes.
Informe status, health score, horas e próxima manutenção.`,
  },
  machine_hours: {
    name: "machine-hours-bot",
    prompt: `Você é o especialista em Horas-Máquina do TerraGes.
Registre horas: máquina, operador, projeto, cliente, data, início, fim, intervalo, valor hora.`,
  },
  quotes: {
    name: "quotes-bot",
    prompt: `Você é o especialista em Orçamentos do TerraGes.
Colete: cliente, tipo serviço, máquinas, valor hora, desconto, validade.`,
  },
  service_order: {
    name: "service-order-bot",
    prompt: `Você é o especialista em Ordens de Serviço do TerraGes.
Crie OS com: cliente, máquina, operador, data, hora início, hora fim, valor hora, forma de pagamento.
Antes de criar, pergunte os dados que faltam. Quando tiver tudo, use a tag no final:
[[CREATE_OS:{"client":"nome","client_cpf":"","client_contact":"","date":"YYYY-MM-DD","start_hour":8,"end_hour":17,"hourly_rate":0,"payment_method":"Pix","location":"","description":""}]]
Depois da tag, escreva um resumo e pergunte: "Confirma a criação? (Sim/Não)"`,
  },
  reports: {
    name: "reports-bot",
    prompt: `Você é o especialista em Relatórios do TerraGes.
Gere resumos de dados do sistema.`,
  },
  approval: {
    name: "approval-bot",
    prompt: `Você é o especialista em Aprovações do TerraGes.
Apenas admin pode aprovar. Ações: ordens de serviço, agendamentos.`,
  },
};

// ─── Processamento de Ações ────────────────────────────────

async function processActions(
  aiResponse: string,
  user: any,
  phone: string,
): Promise<{ cleanText: string; actionType: string | null; actionData: any; actionStatus: string }> {
  let cleanText = aiResponse;
  let actionType: string | null = null;
  let actionData: any = null;
  let actionStatus = "none";

  const isAdmin = user.role === "admin";

  if (!isAdmin) {
    const osMatch = aiResponse.match(/\[\[CREATE_OS:(.*?)\]\]/s);
    if (osMatch) {
      cleanText = aiResponse.replace(/\[\[CREATE_OS:.*?\]\]/s, "").trim();
      try {
        const parsed = JSON.parse(osMatch[1]);
        const { save, ...osData } = parsed;

        await supabase.from("pending_actions").update({ status: "cancelled" })
          .eq("user_phone", phone).eq("status", "pending_confirmation");

        const { error } = await supabase.from("pending_actions").insert([{
          user_phone: phone, action_type: "CREATE_OS", action_data: osData, status: "pending_confirmation",
        }]);

        if (error) {
          cleanText += "\n\n⚠️ Erro ao preparar confirmação.";
          actionStatus = "failed";
        } else {
          actionType = "service_order";
          actionData = osData;
          actionStatus = "pending_confirmation";
        }
      } catch (e) {
        console.error("[Action] OS parse error:", e);
        actionStatus = "failed";
      }
      cleanText = cleanText.replace(/\[\[CREATE_.*?\]\]/gs, "").trim();
      return { cleanText, actionType, actionData, actionStatus };
    }

    const hasAction = /\[\[CREATE_(SCHEDULE|REPORT):/.test(aiResponse);
    cleanText = aiResponse.replace(/\[\[CREATE_.*?\]\]/gs, "").trim();
    if (hasAction) {
      cleanText += "\n\n⚠️ Apenas administradores podem criar agendamentos ou relatórios via WhatsApp.";
    }
    return { cleanText, actionType, actionData, actionStatus };
  }

  const scheduleMatch = aiResponse.match(/\[\[CREATE_SCHEDULE:(.*?)\]\]/s);
  if (scheduleMatch) {
    cleanText = aiResponse.replace(/\[\[CREATE_SCHEDULE:.*?\]\]/s, "").trim();
    try {
      const parsed = JSON.parse(scheduleMatch[1]);
      const { save, ...data } = parsed;
      actionType = "schedule";
      actionData = data;
      if (save !== "draft") {
        const { error } = await supabase.from("schedules").insert(data);
        actionStatus = error ? "failed" : "completed";
        if (error) cleanText += "\n\n⚠️ Erro ao salvar agendamento.";
      } else {
        actionStatus = "pending";
        cleanText += "\n_(Rascunho salvo)_";
      }
    } catch (e) {
      console.error("[Action] Schedule:", e);
      actionStatus = "failed";
    }
  }

  const osMatch = aiResponse.match(/\[\[CREATE_OS:(.*?)\]\]/s);
  if (osMatch) {
    cleanText = aiResponse.replace(/\[\[CREATE_OS:.*?\]\]/s, "").trim();
    try {
      const parsed = JSON.parse(osMatch[1]);
      const { save, ...osData } = parsed;
      actionType = "service_order";
      actionData = osData;
      if (save !== "draft") {
        const { error } = await supabase.from("service_orders").insert([{ ...osData, user_id: user.id, status: "pending" }]);
        actionStatus = error ? "failed" : "completed";
        if (error) cleanText += "\n\n⚠️ Erro ao criar OS.";
      } else {
        actionStatus = "pending";
        cleanText += "\n_(Rascunho salvo)_";
      }
    } catch (e) {
      console.error("[Action] OS:", e);
      actionStatus = "failed";
    }
  }

  return { cleanText, actionType, actionData, actionStatus };
}

// ─── AI Call ───────────────────────────────────────────────

async function callAI(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://terrages.app",
      "X-Title": "TerraGes OperaAI",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages, temperature: 0.3, max_tokens: 600 }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

// ─── Processamento Principal ───────────────────────────────

async function processMessage(payload: any): Promise<void> {
  const rawPhone = getChatJid(payload);
  const fromMe = getFromMe(payload);
  const isGroup = getIsGroup(payload);
  const contactName = getPushName(payload);
  const instanceToken = getInstanceToken(payload);
  const msgId = getMsgId(payload);

  if (!rawPhone || fromMe || isGroup) return;

  const phone = normalizePhone(rawPhone);
  const userText = extractText(payload);
  if (!userText) return;

  console.log(`[WA] ${phone}: ${userText.slice(0, 100)}`);

  const user = await authenticateUser(phone);
  if (!user) {
    await sendMessage(phone, `Sou OperaAI, assistente do TerraGes.\nCadastre-se em https://terrages.vercel.app/login`, instanceToken);
    return;
  }

  const isAdmin = user.role === "admin";

  // ── Pending action confirmation check ──
  const { data: pendingAction } = await supabase.from("pending_actions")
    .select("*").eq("user_phone", phone).eq("status", "pending_confirmation").maybeSingle();

  if (pendingAction) {
    const clean = userText.trim().toLowerCase();
    const isYes = ["sim", "s", "confirmo", "ok", "yes", "y"].includes(clean);
    const isNo = ["não", "nao", "n", "cancelar", "no"].includes(clean);

    if (isYes && pendingAction.action_type === "CREATE_OS") {
      const { error } = await supabase.from("service_orders").insert([{
        ...pendingAction.action_data, user_id: user.id, status: "pending",
      }]);
      await supabase.from("pending_actions").update({ status: "executed" }).eq("id", pendingAction.id);
      const msg = error
        ? "❌ Erro ao criar OS."
        : "✅ Ordem de Serviço criada com sucesso!";
      await sendMessage(phone, msg, instanceToken);
      return;
    }

    if (isNo) {
      await supabase.from("pending_actions").update({ status: "cancelled" }).eq("id", pendingAction.id);
      await sendMessage(phone, "❌ Ação cancelada.", instanceToken);
      return;
    }

    await sendMessage(phone, "⚠️ Responda *Sim* para confirmar ou *Não* para cancelar.", instanceToken);
    return;
  }

  // ── Get/Create conversation ──
  let conversationId: string;
  const { data: existingConv } = await supabase.from("whatsapp_conversations")
    .select("id").eq("phone_number", phone).maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
    await supabase.from("whatsapp_conversations").update({
      last_message: userText.substring(0, 200),
      last_message_at: new Date().toISOString(),
      contact_name: contactName ?? undefined,
    }).eq("id", conversationId);
  } else {
    const { data: newConv } = await supabase.from("whatsapp_conversations")
      .insert([{
        profile_id: user.id, phone_number: phone,
        contact_name: contactName, last_message: userText.substring(0, 200),
      }]).select("id").single();
    conversationId = newConv!.id;
  }

  // ── Save user message ──
  await supabase.from("whatsapp_messages").insert([{
    conversation_id: conversationId, role: "user", content: userText, whatsapp_msg_id: msgId,
  }]);

  // ── Triage ──
  const classification = await classifyMessage(userText, user.role);
  console.log(`[WA] → ${classification.category} (${classification.confidence})`);

  // ── Load history ──
  const { data: history } = await supabase.from("whatsapp_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  const historyMessages = (history ?? []).reverse().map((m: any) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // ── Build system context ──
  const handler = AGENT_MAP[classification.category];
  const systemContext = handler
    ? `Você é ${handler.name}, especialista do TerraGes.\n${handler.prompt}\n\nUsuário: ${user.name} (${user.role})`
    : `Você é OperaAI, assistente do TerraGes.\nUsuário: ${user.name} (${user.role})`;

  // ── AI call ──
  let aiResponse = "";
  try {
    aiResponse = await callAI([
      { role: "system", content: systemContext },
      ...historyMessages,
      { role: "user", content: userText },
    ]);
  } catch (e) {
    console.error("[WA] AI error:", e);
    aiResponse = "Desculpe, não consegui processar sua mensagem agora.";
  }

  // ── Process actions ──
  const { cleanText, actionType, actionData, actionStatus } = await processActions(aiResponse, user, phone);

  // ── Save assistant message ──
  await supabase.from("whatsapp_messages").insert([{
    conversation_id: conversationId, role: "assistant", content: cleanText,
    action_type: actionType, action_data: actionData, action_status: actionStatus,
  }]);

  // ── Send response ──
  await sendMessage(phone, cleanText, instanceToken);
  console.log(`[WA] Resposta enviada para ${phone}`);
}

// ─── Handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");

  if (req.method === "GET" && (path.endsWith("/health") || path === "" || path === "/")) {
    return new Response(JSON.stringify({ status: "ok", service: "wa-agent-terrages", timestamp: new Date().toISOString() }), { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: corsHeaders });
  }

  if (path.endsWith("/triage")) {
    const { text, userRole } = body;
    if (!text) return new Response(JSON.stringify({ error: "Campo 'text' é obrigatório" }), { status: 400, headers: corsHeaders });
    try {
      const classification = await classifyMessage(text, userRole || "operator");
      return new Response(JSON.stringify(classification), { headers: corsHeaders });
    } catch (err) {
      console.error("[Triage] Erro:", err);
      return new Response(JSON.stringify({ error: "Falha na classificação" }), { status: 500, headers: corsHeaders });
    }
  }

  if (path.endsWith("/webhook") || body.event || body.data) {
    const allowedEvents = ["Message", "MESSAGES_UPSERT", "messages.upsert", "message"];
    if (body.event && !allowedEvents.includes(body.event)) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders });
    }
    processMessage(body).catch((err) => console.error("[WA] Erro:", err));
    return new Response(JSON.stringify({ ok: true, received: true }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: "Rota não encontrada" }), { status: 404, headers: corsHeaders });
});
