import "dotenv/config";
import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = parseInt(process.env.PORT || "3001", 10);

// Configurações de ambiente
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.AI_MODEL_TEXT || "openrouter/free";
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || "";
const EVOLUTION_API_VERSION = process.env.EVOLUTION_API_VERSION || "v2";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

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
  const url = evoUrl("message/sendText");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": token,
      },
      body: JSON.stringify({ number, text, delay: -1 }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[WA] Erro ao enviar para ${to}: ${res.status}: ${err}`);
      throw new Error(`Failed to send message: ${res.status}: ${err}`);
    }
  } catch (e) {
    console.error(`[WA] Erro na requisição para ${to}: ${e}`);
    throw e;
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
  try {
    const { data, error } = await getSupabase()
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
  } catch {
    return null;
  }
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
  phone: string,
  instanceToken: string
): Promise<string> {
  const handler = AGENT_MAP[category];
  if (!handler) {
    return `Olá! Recebi: "${userText.slice(0, 100)}". Como posso ajudar? Posso auxiliar com agendamentos, manutenção, RDO, finanças, frota, horas-máquina, orçamentos e ordens de serviço.`;
  }

  const messages = [
    { role: "system" as const, content: handler.system_prompt },
    { role: "system" as const, content: `Usuário: ${user.name || phone} (${user.role})` },
    { role: "user" as const, content: userText },
  ];

  try {
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
  } catch (e) {
    console.error(`[${handler.name}] Erro:`, e);
    return `Entendi que você está falando sobre ${category}. Pode fornecer mais detalhes?`;
  }
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

  // Autenticação
  const user = await authenticateUser(phone);
  if (!user) {
    await sendMessage(
      phone,
      `Bem-vindo! 👋 Sou OperaAI, assistente do TerraGes.\nPosso ajudar com: registrar horas, orçamentos, relatórios e sua frota.\n\nPara começar, cadastre seu número (${phone}) acessando https://terrages.vercel.app/login`,
      instanceToken
    );
    return;
  }

  // Triage / Classificação
  const classification = await classifyMessage(userText, user.role);
  console.log(`[WA-Agent] Classificação: ${classification.category} (${classification.confidence})`);

  // Roteamento para o especialista
  const responseText = await routeToSpecialist(classification.category, userText, user, phone, instanceToken);

  await sendMessage(phone, responseText, instanceToken);
  console.log(`[WA-Agent] Resposta enviada para ${phone} via ${AGENT_MAP[classification.category]?.name || "default"} (${classification.category})`);
}

// ─── Rotas ─────────────────────────────────────────────────

// Recebe o payload completo da Evolution API (via Edge Function ou direto)
app.post("/webhook", async (req, res) => {
  const payload = req.body;

  if (!payload || !payload.event) {
    return res.status(400).json({ error: "Payload inválido" });
  }

  const allowedEvents = ["Message", "MESSAGES_UPSERT", "messages.upsert", "message"];
  if (!allowedEvents.includes(payload.event)) {
    return res.json({ ok: true, skipped: true });
  }

  // Processa sem bloquear a resposta
  processMessage(payload).catch((err) => {
    console.error("[WA-Agent] Erro no processamento:", err);
  });

  res.json({ ok: true, received: true });
});

// Endpoint de triagem (chamado pelo Edge Function para classificar mensagens)
app.post("/triage", async (req, res) => {
  const { text, userRole } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Campo 'text' é obrigatório" });
  }

  try {
    const classification = await classifyMessage(text, userRole || "operator");
    res.json(classification);
  } catch (err) {
    console.error("[Triage] Erro:", err);
    res.status(500).json({ error: "Falha na classificação" });
  }
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "wa-agent-terrages",
    timestamp: new Date().toISOString(),
  });
});

// ─── Inicialização ─────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[WA-Agent] Servidor rodando na porta ${PORT}`);
  console.log(`[WA-Agent] Webhook: POST http://localhost:${PORT}/webhook`);
  console.log(`[WA-Agent] Triage:  POST http://localhost:${PORT}/triage`);
  console.log(`[WA-Agent] Health:  GET  http://localhost:${PORT}/health`);
});
