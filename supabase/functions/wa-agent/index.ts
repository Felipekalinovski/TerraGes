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
  const url = evoUrl("message/sendText");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": token },
    body: JSON.stringify({ number, text, delay: -1 }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[WA] Erro ao enviar para ${to}: ${res.status}: ${err}`);
    throw new Error(`Failed to send message: ${res.status}: ${err}`);
  }
}

// ─── Triage / Classificação ────────────────────────────────

interface TriageResult {
  category: "fleet" | "machine_hours" | "rdo" | "finance" | "schedule" | "service_order" | "delete_record" | "historical_query" | "off_scope";
  confidence: number;
  context?: Record<string, any>;
}

async function classifyMessage(text: string, userRole: string): Promise<TriageResult> {
  const prompt = `
  Classifique a mensagem do usuário em uma categoria:

  Categorias disponíveis:
  - schedule: agendamentos, calendário, planejamento de operações
  - maintenance: manutenção de máquinas, reparos, revisões
  - employee: dados de colaboradores, equipe, RH, certificações
  - rdo: relatório diário de operações
  - finance: finanças, receitas, despesas, saldo, pagamentos
  - fleet: frota, máquinas, equipamentos, status
  - machine_hours: horas-máquina, horímetro, horas trabalhadas
  - quotes: orçamentos, propostas, cotações
  - service_order: ordens de serviço, OS
  - reports: relatórios gerenciais, análises, indicadores
  - approval: aprovação de ações pendentes
  - off_scope: fora do escopo do sistema

  Usuário é: ${userRole}

  Mensagem: "${text}"

  Responda APENAS com JSON puro sem markdown:
  {"category":"categoria","confidence":0.9,"context":{}}
  `;

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
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const d = await res.json();
  const result = d.choices?.[0]?.message?.content || "";
  const stripped = result.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(stripped);
}

// ─── Autenticação ──────────────────────────────────────────

async function authenticateUser(phone: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, phone, role, name")
    .eq("phone", phone)
    .single();
  if (error) return null;
  return {
    id: data.id,
    phone: data.phone,
    role: data.role,
    name: data.name || "",
  };
}

// ─── Mapa de agentes especialistas ─────────────────────────

interface AgentHandler {
  name: string;
  category: string;
  system_prompt: string;
}

const AGENT_MAP: Record<string, AgentHandler> = {
  schedule: {
    name: "schedule-bot",
    category: "schedule",
    system_prompt: `Você é o especialista em Agendamentos do TerraGes. Ajude a criar, consultar ou modificar agendamentos.
Tipos: excavation (escavação), transport (transporte), maintenance (manutenção), other (outros).
Prioridades: low, medium, high, urgent.
Pergunte título, tipo, data/hora início, data/hora fim e prioridade.`,
  },
  maintenance: {
    name: "maintenance-bot",
    category: "maintenance",
    system_prompt: `Você é o especialista em Manutenção do TerraGes.
Tipos: preventive (preventiva), corrective (corretiva), predictive (preditiva).
Pergunte máquina, tipo, data, horímetro, descrição e técnico.`,
  },
  employee: {
    name: "employee-bot",
    category: "employee",
    system_prompt: `Você é o especialista em Equipes do TerraGes. Apenas consulta.
Informe nome, cargo, status, certificações e contato do colaborador.`,
  },
  rdo: {
    name: "rdo-bot",
    category: "rdo",
    system_prompt: `Você é o especialista em RDO do TerraGes.
Informações: projeto, data, clima (sunny/cloudy/rainy/storm), equipe, atividades, máquinas, ocorrências.`,
  },
  finance: {
    name: "finance-bot",
    category: "finance",
    system_prompt: `Você é o especialista em Finanças do TerraGes.
AJUDA: saldo, receitas, despesas, criar transações, contas pendentes.
Apenas admins/gestores veem dados financeiros completos.`,
  },
  fleet: {
    name: "fleet-bot",
    category: "fleet",
    system_prompt: `Você é o especialista em Frota do TerraGes.
Informe status, health score, horas e próxima manutenção das máquinas.`,
  },
  machine_hours: {
    name: "machine-hours-bot",
    category: "machine_hours",
    system_prompt: `Você é o especialista em Horas-Máquina do TerraGes.
Registre horas: máquina, operador, projeto, cliente, data, início, fim, intervalo, valor hora.`,
  },
  quotes: {
    name: "quotes-bot",
    category: "quotes",
    system_prompt: `Você é o especialista em Orçamentos do TerraGes.
Colete: cliente (nome, tel, email), tipo serviço, máquinas, valor hora, desconto, validade.`,
  },
  service_order: {
    name: "service-order-bot",
    category: "service_order",
    system_prompt: `Você é o especialista em Ordens de Serviço do TerraGes.
Crie OS com: data, cliente, máquina, operador, hora início/fim, valor hora, pagamento.
Use a tag [[CREATE_OS:{"client":"...","date":"...","start_hour":0,"end_hour":0,"hourly_rate":0,"payment_method":"Pix"}]]
para registrar no sistema. Confirme com o usuário antes.`,
  },
  reports: {
    name: "reports-bot",
    category: "reports",
    system_prompt: `Você é o especialista em Relatórios do TerraGes.
Gere resumos financeiros, de frota, horas-máquina e OS.
Use dados do sistema para insights.`,
  },
  approval: {
    name: "approval-bot",
    category: "approval",
    system_prompt: `Você é o especialista em Aprovações do TerraGes.
Ações pendentes: ordens de serviço, agendamentos.
Apenas admin pode aprovar.`,
  },
};

async function routeToSpecialist(
  category: string,
  userText: string,
  user: any,
): Promise<string> {
  const handler = AGENT_MAP[category];
  if (!handler) {
    return `Olá! Recebi: "${userText.slice(0, 100)}". Como posso ajudar? Posso auxiliar com agendamentos, manutenção, RDO, finanças, frota, horas-máquina, orçamentos e ordens de serviço.`;
  }

  const messages = [
    { role: "system" as const, content: handler.system_prompt },
    { role: "system" as const, content: `Usuário: ${user.name || user.phone} (${user.role})` },
    { role: "user" as const, content: userText },
  ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://terrages.app",
      "X-Title": `TerraGes ${handler.name}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "Desculpe, não consegui processar.";
}

// ─── Processamento da mensagem ─────────────────────────────

async function processMessage(payload: any): Promise<void> {
  const rawPhone = getChatJid(payload);
  const fromMe = getFromMe(payload);
  const isGroup = getIsGroup(payload);
  const contactName = getPushName(payload);
  const instanceToken = getInstanceToken(payload);

  if (!rawPhone || fromMe || isGroup) {
    console.log(`[WA-Agent] Skip: fromMe=${fromMe} group=${isGroup} jid=${rawPhone}`);
    return;
  }

  const phone = normalizePhone(rawPhone);
  const userText = extractText(payload);

  if (!userText) {
    console.log("[WA-Agent] Sem texto extraído");
    return;
  }

  console.log(`[WA-Agent] Mensagem de ${phone} (${contactName}): ${userText.slice(0, 100)}`);

  const user = await authenticateUser(phone);
  if (!user) {
    await sendMessage(
      phone,
      `Bem-vindo! 👋 Sou OperaAI, assistente do TerraGes.\nPosso ajudar com: registrar horas, orçamentos, relatórios e sua frota.\n\nPara começar, cadastre seu número (${phone}) acessando https://terrages.vercel.app/login`,
      instanceToken,
    );
    return;
  }

  const classification = await classifyMessage(userText, user.role);
  console.log(`[WA-Agent] Classificação: ${classification.category} (${classification.confidence})`);

  const responseText = await routeToSpecialist(classification.category, userText, user);

  await sendMessage(phone, responseText, instanceToken);
  console.log(`[WA-Agent] Resposta enviada para ${phone} via ${AGENT_MAP[classification.category]?.name || "default"} (${classification.category})`);
}

// ─── Handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");

  // Health check
  if (req.method === "GET" && (path.endsWith("/health") || path === "" || path === "/")) {
    return new Response(JSON.stringify({
      status: "ok",
      service: "wa-agent-terrages",
      timestamp: new Date().toISOString(),
    }), { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: corsHeaders,
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: corsHeaders,
    });
  }

  // Triage endpoint
  if (path.endsWith("/triage")) {
    const { text, userRole } = body;
    if (!text) {
      return new Response(JSON.stringify({ error: "Campo 'text' é obrigatório" }), {
        status: 400, headers: corsHeaders,
      });
    }
    try {
      const classification = await classifyMessage(text, userRole || "operator");
      return new Response(JSON.stringify(classification), { headers: corsHeaders });
    } catch (err) {
      console.error("[Triage] Erro:", err);
      return new Response(JSON.stringify({ error: "Falha na classificação" }), {
        status: 500, headers: corsHeaders,
      });
    }
  }

  // Webhook - recebe payload da Evolution API
  if (path.endsWith("/webhook")) {
    if (!body || !body.event) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400, headers: corsHeaders,
      });
    }
    const allowedEvents = ["Message", "MESSAGES_UPSERT", "messages.upsert", "message"];
    if (!allowedEvents.includes(body.event)) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders });
    }

    // Processa sem bloquear a resposta
    processMessage(body).catch((err) => {
      console.error("[WA-Agent] Erro no processamento:", err);
    });

    return new Response(JSON.stringify({ ok: true, received: true }), { headers: corsHeaders });
  }

  // Default: processa como mensagem direta (Evolution API webhook raw)
  if (body.event || body.data) {
    processMessage(body).catch((err) => {
      console.error("[WA-Agent] Erro no processamento:", err);
    });
    return new Response(JSON.stringify({ ok: true, received: true }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: "Rota não encontrada" }), {
    status: 404, headers: corsHeaders,
  });
});
