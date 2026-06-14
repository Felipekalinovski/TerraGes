import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const OPENROUTER_MODEL = Deno.env.get("AI_MODEL_TEXT") ?? "openrouter/free";
const VISION_MODEL = Deno.env.get("AI_MODEL_VISION") ?? "google/gemma-4-31b-it:free";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
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

// ─── Mídia (Áudio/Imagem) ──────────────────────────────────

async function getMediaBase64(msgId: string, chatJid: string, token: string): Promise<{ base64: string; mimetype: string } | null> {
  const res = await fetch(evoUrl("chat/getBase64FromMediaMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": token },
    body: JSON.stringify({ message: { key: { id: msgId, remoteJid: chatJid } } }),
  });
  if (!res.ok) { console.error(`[Media] Falha: ${res.status}`); return null; }
  const data = await res.json();
  return { base64: data.base64 ?? data.data?.base64, mimetype: data.mimetype ?? data.data?.mimetype ?? "audio/ogg" };
}

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
      method: "POST", headers: { "Authorization": `Bearer ${GROQ_API_KEY}` }, body: form,
    });
    if (!res.ok) { console.error("[Whisper] Erro:", await res.text()); return null; }
    return (await res.text()).trim();
  } catch (e) { console.error("[Whisper] Erro:", e); return null; }
}

async function ocrImage(base64: string): Promise<string> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://terrages.app",
        "X-Title": "TerraGes OCR",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Extraia todo o texto visível na imagem. Se houver valores, datas ou números, destaque-os." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        }],
        max_tokens: 300,
      }),
    });
    if (!res.ok) { console.error("[OCR] Erro:", await res.text()); return ""; }
    const d = await res.json();
    return d.choices?.[0]?.message?.content || "";
  } catch (e) { console.error("[OCR] Erro:", e); return ""; }
}

function detectMsgType(payload: any): "text" | "audio" | "image" | "unsupported" {
  const v2type = payload.data?.messageType;
  if (typeof v2type === "string") {
    const t = v2type.toLowerCase();
    if (t === "audiomessage") return "audio";
    if (t === "imagemessage") return "image";
    if (["conversation", "extendedtextmessage"].includes(t)) return "text";
  }
  const v2msg = payload.data?.message;
  if (v2msg?.audioMessage) return "audio";
  if (v2msg?.imageMessage) return "image";
  if (v2msg?.conversation || v2msg?.extendedTextMessage?.text) return "text";
  const v1msg = payload.data?.Message || payload.Message;
  if (!v1msg) return "unsupported";
  const type = v1msg.Type?.toLowerCase?.() || "";
  const mediaType = v1msg.MediaType?.toLowerCase?.() || "";
  if (type === "audio" || mediaType === "audio") return "audio";
  if (type === "image" || mediaType === "image") return "image";
  if (v1msg.conversation || v1msg.extendedTextMessage?.text) return "text";
  return "unsupported";
}

async function extractMediaText(payload: any, rawPhone: string, msgId: string, instanceToken: string): Promise<string | null> {
  const msgType = detectMsgType(payload);

  if (msgType === "text") return extractText(payload);

  if (msgType === "audio") {
    const media = await getMediaBase64(msgId, rawPhone, instanceToken);
    if (!media?.base64) return null;
    return transcribeAudio(media.base64, media.mimetype);
  }

  if (msgType === "image") {
    const caption = extractText(payload) || "";
    const media = await getMediaBase64(msgId, rawPhone, instanceToken);
    if (media?.base64) {
      const ocrResult = await ocrImage(media.base64);
      if (ocrResult) return `${caption}\n[Texto da imagem: ${ocrResult}]`.trim();
    }
    return caption || null;
  }

  return extractText(payload);
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

// ─── Estado de Conversa (Sessions) ─────────────────────────

interface Session {
  phone: string;
  role: string;
  state: string;
  context: Record<string, any>;
}

async function getSession(phone: string, role: string): Promise<Session> {
  const { data } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("user_phone", phone)
    .maybeSingle();

  if (data) {
    if (data.user_role !== role) {
      await supabase.from("conversation_sessions")
        .update({ user_role: role }).eq("user_phone", phone);
    }
    return {
      phone: data.user_phone,
      role: data.user_role,
      state: data.current_state || "idle",
      context: (data.context as Record<string, any>) || {},
    };
  }

  await supabase.from("conversation_sessions").insert([{
    user_phone: phone, user_role: role, current_state: "idle", context: {},
  }]);

  return { phone, role, state: "idle", context: {} };
}

async function setSessionState(phone: string, state: string, context: Record<string, any> = {}): Promise<void> {
  await supabase.from("conversation_sessions")
    .update({ current_state: state, context, updated_at: new Date().toISOString() })
    .eq("user_phone", phone);
}

async function resetSession(phone: string): Promise<void> {
  await supabase.from("conversation_sessions")
    .update({ current_state: "idle", context: {}, updated_at: new Date().toISOString() })
    .eq("user_phone", phone);
}

// ─── Wizards ────────────────────────────────────────────────

const OS_STEPS = ["client", "machine", "date", "start_hour", "end_hour", "hourly_rate", "payment_method"];
const OS_STEP_LABELS: Record<string, string> = {
  client: "👤 Qual o nome do cliente?",
  machine: "🔧 Qual máquina será usada? (ou digite 'nenhuma')",
  date: "📅 Qual a data? (DD/MM/AAAA)",
  start_hour: "⏰ Hora de início? (ex: 8)",
  end_hour: "⏰ Hora de fim? (ex: 17)",
  hourly_rate: "💰 Valor da hora? (ex: 150)",
  payment_method: "💳 Forma de pagamento? (Pix, Cartao, Boleto, Faturado, Dinheiro, Cheque)",
};

const HOURS_STEPS = ["machine_name", "operator_name", "project_name", "date", "start_time", "end_time", "hourly_rate"];
const HOURS_STEP_LABELS: Record<string, string> = {
  machine_name: "🔧 Qual o nome da máquina?",
  operator_name: "👤 Nome do operador?",
  project_name: "🏗️ Nome do projeto?",
  date: "📅 Data? (DD/MM/AAAA)",
  start_time: "⏰ Hora início? (HH:MM)",
  end_time: "⏰ Hora fim? (HH:MM)",
  hourly_rate: "💰 Valor da hora? (ex: 150)",
};

function parseStepValue(value: string, step: string): any {
  if (step === "date" || step === "start_time" || step === "end_time") return value;
  if (step === "start_hour" || step === "end_hour" || step === "hourly_rate" || step === "break_minutes") {
    const num = parseFloat(value.replace(",", "."));
    return isNaN(num) ? value : num;
  }
  return value;
}

async function processWizard(
  userText: string,
  session: Session,
  phone: string,
  instanceToken: string,
  userId: string,
): Promise<boolean> {
  const wizardMatch = session.state.match(/^wizard:(\w+):(\w+)$/);
  if (!wizardMatch) return false;

  const wizardType = wizardMatch[1]; // "os" or "hours"
  const currentStep = wizardMatch[2];

  if (userText.toLowerCase() === "cancelar") {
    await resetSession(phone);
    await sendMessage(phone, "❌ Criação cancelada.", instanceToken);
    return true;
  }

  const ctx = { ...session.context };
  ctx[currentStep] = parseStepValue(userText, currentStep);

  if (wizardType === "os") {
    const idx = OS_STEPS.indexOf(currentStep);
    if (idx < 0 || idx >= OS_STEPS.length - 1) {
      // All data collected — generate CREATE_OS tag
      const sh = Number(ctx.start_hour) || 8;
      const eh = Number(ctx.end_hour) || 17;
      const total_hours = Math.max(0, eh - sh);
      const osData = {
        client: ctx.client || "",
        date: ctx.date ? ctx.date.split("/").reverse().join("-") : new Date().toISOString().slice(0, 10),
        start_hour: sh,
        end_hour: eh,
        total_hours,
        hourly_rate: Number(ctx.hourly_rate) || 0,
        total_value: total_hours * (Number(ctx.hourly_rate) || 0),
        payment_method: ctx.payment_method || "Pix",
      };
      await resetSession(phone);

      // Save as pending action
      await supabase.from("pending_actions").update({ status: "cancelled" })
        .eq("user_phone", phone).eq("status", "pending_confirmation");
      await supabase.from("pending_actions").insert([{
        user_phone: phone, action_type: "CREATE_OS", action_data: osData, status: "pending_confirmation",
      }]);

      const summary = `📋 *Nova OS*\n\nCliente: ${osData.client}\nData: ${osData.date}\nHorário: ${osData.start_hour}h às ${osData.end_hour}h\nValor: R$ ${osData.hourly_rate}/h\nPagamento: ${osData.payment_method}\n\nConfirma? (Sim/Não)`;
      await sendMessage(phone, summary, instanceToken);
      return true;
    }

    const nextStep = OS_STEPS[idx + 1];
    await setSessionState(phone, `wizard:os:${nextStep}`, ctx);
    await sendMessage(phone, OS_STEP_LABELS[nextStep], instanceToken);
    return true;
  }

  if (wizardType === "hours") {
    const idx = HOURS_STEPS.indexOf(currentStep);
    if (idx < 0 || idx >= HOURS_STEPS.length - 1) {
      const calcTH = (s: string, e: string) => {
        const [sh, sm] = (s || "08:00").split(":").map(Number);
        const [eh, em] = (e || "17:00").split(":").map(Number);
        return Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 100) / 100;
      };
      const total_hours = calcTH(ctx.start_time, ctx.end_time);
      const hoursData = {
        machine_name: ctx.machine_name || "",
        operator_name: ctx.operator_name || "",
        project_name: ctx.project_name || "",
        date: ctx.date ? ctx.date.split("/").reverse().join("-") : new Date().toISOString().slice(0, 10),
        start_time: ctx.start_time || "08:00",
        end_time: ctx.end_time || "17:00",
        hourly_rate: Number(ctx.hourly_rate) || 0,
        total_hours,
        total_value: total_hours * (Number(ctx.hourly_rate) || 0),
      };
      await resetSession(phone);

      await supabase.from("pending_actions").update({ status: "cancelled" })
        .eq("user_phone", phone).eq("status", "pending_confirmation");
      await supabase.from("pending_actions").insert([{
        user_phone: phone, action_type: "CREATE_HOURS", action_data: hoursData, status: "pending_confirmation",
      }]);

      const summary = `⏱️ *Registro de Horas*\n\nMáquina: ${hoursData.machine_name}\nOperador: ${hoursData.operator_name}\nProjeto: ${hoursData.project_name}\nData: ${hoursData.date}\nHorário: ${hoursData.start_time} às ${hoursData.end_time}\nValor: R$ ${hoursData.hourly_rate}/h\n\nConfirma? (Sim/Não)`;
      await sendMessage(phone, summary, instanceToken);
      return true;
    }

    const nextStep = HOURS_STEPS[idx + 1];
    await setSessionState(phone, `wizard:hours:${nextStep}`, ctx);
    await sendMessage(phone, HOURS_STEP_LABELS[nextStep], instanceToken);
    return true;
  }

  return false;
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
Para consultar dados reais das máquinas, use a tag no final da resposta:
[[QUERY_FLEET:{"machine":"nome ou vazio para todas","status":"active|maintenance|inactive"}]]
Sempre use QUERY_FLEET quando perguntarem sobre máquinas, status, horas ou manutenção.
Informe status, health score, horas e próxima manutenção com os dados retornados.`,
  },
  machine_hours: {
    name: "machine-hours-bot",
    prompt: `Você é o especialista em Horas-Máquina do TerraGes.
Para consultar: [[QUERY_HOURS:{"machine":"nome","days":30}]]
Para registrar horas, responda com [[START_WIZARD:hours]] e uma breve confirmação.
NÃO peça dados manualmente — o wizard coleta automaticamente.`,
  },
  quotes: {
    name: "quotes-bot",
    prompt: `Você é o especialista em Orçamentos do TerraGes.
Após coletar todos os dados, use:
[[CREATE_QUOTE:{"client_name":"...","client_phone":"...","client_email":"...","service_type":"...","hourly_rate":0,"estimated_hours":0,"discount":0,"valid_until":"YYYY-MM-DD","notes":"..."}]]
Campos: cliente (nome, tel, email), tipo serviço, valor hora, horas estimadas, desconto, validade.
Confirme com o usuário antes de criar.`,
  },
  service_order: {
    name: "service-order-bot",
    prompt: `Você é o especialista em Ordens de Serviço do TerraGes.
Para consultar: [[QUERY_OS:{"status":"pending","days":30}]]
Para criar nova OS, responda com [[START_WIZARD:os]] e uma breve confirmação.
NÃO peça dados manualmente — o wizard coleta automaticamente.`,
  },
  reports: {
    name: "reports-bot",
    prompt: `Você é o especialista em Relatórios do TerraGes.
Use tags de consulta para dados reais:
- [[QUERY_FINANCE:{"days":30}]] para finanças
- [[QUERY_HOURS:{"days":30}]] para horas-máquina
- [[QUERY_OS:{"days":30}]] para OS
- [[QUERY_FLEET:{}]] para frota
Sempre use as tags de consulta em vez de inventar dados.`,
  },
  approval: {
    name: "approval-bot",
    prompt: `Você é o especialista em Aprovações do TerraGes.
Consulte OS pendentes com [[QUERY_OS:{"status":"pending"}]]
Apenas admin pode aprovar.`,
  },
  finance: {
    name: "finance-bot",
    prompt: `Você é o especialista em Finanças do TerraGes.
Para consultar dados reais, use no final da resposta:
[[QUERY_FINANCE:{"days":30,"type":"income|expense"}]]
Sempre use QUERY_FINANCE quando perguntarem sobre saldo, receitas, despesas ou transações.
Apenas admins/gestores veem dados financeiros completos.`,
  },
  maintenance: {
    name: "maintenance-bot",
    prompt: `Você é o especialista em Manutenção do TerraGes.
Para consultar: [[QUERY_MAINTENANCE:{"machine":"nome","days":30}]]
Para registrar manutenção, após coletar dados use:
[[CREATE_MAINTENANCE:{"machine_id":"","date":"YYYY-MM-DD","type":"preventive|corrective|predictive","description":"...","cost":0,"technician":"...","hour_meter":0}]]
Tipos: preventive, corrective, predictive.
Confirme antes de criar.`,
  },
  employee: {
    name: "employee-bot",
    prompt: `Você é o especialista em Equipes do TerraGes.
Para consultar dados reais, use no final:
[[QUERY_EMPLOYEES:{"status":"active|vacation|leave","name":"nome opcional"}]]
Sempre use QUERY_EMPLOYEES quando perguntarem sobre colaboradores.
Informe nome, cargo, status, certificações e contato.`,
  },
};

// ─── Processamento de Ações ────────────────────────────────

const ACTION_REGEX = /\[\[(CREATE_\w+):(.*?)\]\]/s;

async function savePendingAction(phone: string, actionType: string, data: any) {
  await supabase.from("pending_actions").update({ status: "cancelled" })
    .eq("user_phone", phone).eq("status", "pending_confirmation");
  return supabase.from("pending_actions").insert([{
    user_phone: phone, action_type: actionType, action_data: data, status: "pending_confirmation",
  }]);
}

async function executeAction(actionType: string, data: any, userId: string): Promise<string | null> {
  try {
    switch (actionType) {
      case "CREATE_OS": {
        const sh = Number(data.start_hour) || 0;
        const eh = Number(data.end_hour) || 0;
        const total_hours = Math.max(0, eh - sh);
        const total_value = total_hours * (Number(data.hourly_rate) || 0);
        const { error } = await supabase.from("service_orders").insert([{
          ...data, user_id: userId, status: "pending",
          total_hours, total_value,
        }]);
        return error ? "⚠️ Erro ao criar OS." : null;
      }
      case "CREATE_SCHEDULE": {
        const { error } = await supabase.from("schedules").insert(data);
        return error ? "⚠️ Erro ao criar agendamento." : null;
      }
      case "CREATE_HOURS": {
        const calcTotalHours = (s: string, e: string): number => {
          const [sh, sm] = s.split(":").map(Number);
          const [eh, em] = e.split(":").map(Number);
          return Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 100) / 100;
        };
        const total_hours = calcTotalHours(data.start_time || "00:00", data.end_time || "00:00");
        const total_value = total_hours * (Number(data.hourly_rate) || 0);
        const { error } = await supabase.from("hora_maquina").insert([{
          ...data, user_id: userId, total_hours, total_value,
        }]);
        return error ? "⚠️ Erro ao registrar horas." : null;
      }
      case "CREATE_MAINTENANCE": {
        const { error } = await supabase.from("maintenance_records").insert([{ ...data, user_id: userId }]);
        return error ? "⚠️ Erro ao registrar manutenção." : null;
      }
      case "CREATE_QUOTE": {
        const { error } = await supabase.from("orcamentos").insert([{ ...data, user_id: userId, status: "rascunho" }]);
        return error ? "⚠️ Erro ao criar orçamento." : null;
      }
      default:
        return "⚠️ Tipo de ação desconhecido.";
    }
  } catch (e) {
    console.error(`[Action] ${actionType}:`, e);
    return "⚠️ Erro ao executar ação.";
  }
}

function actionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    CREATE_OS: "Ordem de Serviço",
    CREATE_SCHEDULE: "Agendamento",
    CREATE_HOURS: "Registro de Horas",
    CREATE_MAINTENANCE: "Manutenção",
    CREATE_QUOTE: "Orçamento",
  };
  return labels[actionType] || "Ação";
}

const ADMIN_ONLY_ACTIONS = new Set(["CREATE_SCHEDULE"]);
const ALL_ACTIONS = new Set(["CREATE_OS", "CREATE_SCHEDULE", "CREATE_HOURS", "CREATE_MAINTENANCE", "CREATE_QUOTE"]);

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
  const match = aiResponse.match(ACTION_REGEX);

  if (!match) return { cleanText, actionType, actionData, actionStatus };

  const tag = match[0];
  const rawType = match[1];
  const rawJson = match[2];

  if (!ALL_ACTIONS.has(rawType)) {
    cleanText = aiResponse.replace(/\[\[CREATE_.*?\]\]/gs, "").trim();
    return { cleanText, actionType, actionData, actionStatus };
  }

  cleanText = aiResponse.replace(tag, "").trim();
  let parsed: any;

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    cleanText += "\n\n⚠️ Erro ao processar dados da ação.";
    return { cleanText, actionType, actionData, actionStatus: "failed" };
  }

  const { save, ...actionPayload } = parsed;

  if (!isAdmin && ADMIN_ONLY_ACTIONS.has(rawType)) {
    cleanText += "\n\n⚠️ Apenas administradores podem criar esta ação via WhatsApp.";
    return { cleanText, actionType, actionData, actionStatus: "failed" };
  }

  // Não-admin: salva em pending_actions para confirmação
  if (!isAdmin) {
    const { error } = await savePendingAction(phone, rawType, actionPayload);
    if (error) {
      cleanText += "\n\n⚠️ Erro ao preparar confirmação.";
      actionStatus = "failed";
    } else {
      actionType = rawType;
      actionData = actionPayload;
      actionStatus = "pending_confirmation";
    }
    cleanText = cleanText.replace(/\[\[CREATE_.*?\]\]/gs, "").trim();
    return { cleanText, actionType, actionData, actionStatus };
  }

  // Admin: executa direto
  if (save === "draft") {
    actionType = rawType;
    actionData = actionPayload;
    actionStatus = "pending";
    cleanText += "\n_(Rascunho salvo)_";
  } else {
    const err = await executeAction(rawType, actionPayload, user.id);
    actionType = rawType;
    actionData = actionPayload;
    actionStatus = err ? "failed" : "completed";
    if (err) cleanText += `\n\n${err}`;
  }

  return { cleanText, actionType, actionData, actionStatus };
}

// ─── Query Tools ───────────────────────────────────────────

function fmtDate(d: string): string {
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

function fmtCurrency(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function periodFilter(days: number): string {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function execQueries(text: string): Promise<string> {
  let result = text;
  const qMatch = text.match(/\[\[QUERY_FLEET:(.*?)\]\]/s);
  if (qMatch) {
    try {
      const p = JSON.parse(qMatch[1]);
      let q = supabase.from("machines").select("name, type, status, hours, next_maintenance, health_status");
      if (p.machine) q = q.ilike("name", `%${p.machine}%`);
      if (p.status) q = q.eq("status", p.status);
      const { data } = await q.limit(10).order("name");
      if (!data?.length) result = result.replace(qMatch[0], "Nenhuma máquina encontrada.");
      else result = result.replace(qMatch[0], data.map((m: any) =>
        `🔧 ${m.name} (${m.type || "—"}) — ${m.status}\n   Horas: ${m.hours || 0} | Health: ${m.health_status || "—"}\n   Próxima manutenção: ${m.next_maintenance ? fmtDate(m.next_maintenance) : "—"}`
      ).join("\n\n"));
    } catch { result = result.replace(qMatch[0], "Erro ao consultar frota."); }
  }
  const hMatch = text.match(/\[\[QUERY_HOURS:(.*?)\]\]/s);
  if (hMatch) {
    try {
      const p = JSON.parse(hMatch[1]);
      let q = supabase.from("hora_maquina").select("machine_name, operator_name, project_name, date, total_hours, total_value");
      if (p.machine) q = q.ilike("machine_name", `%${p.machine}%`);
      if (p.days) q = q.gte("created_at", periodFilter(p.days));
      const { data } = await q.limit(15).order("date", { ascending: false });
      if (!data?.length) result = result.replace(hMatch[0], "Nenhum registro de horas encontrado.");
      else {
        const total = data.reduce((s: number, r: any) => s + Number(r.total_hours || 0), 0);
        const valor = data.reduce((s: number, r: any) => s + Number(r.total_value || 0), 0);
        result = result.replace(hMatch[0], data.map((r: any) =>
          `📅 ${fmtDate(r.date)} — ${r.machine_name}\n   Operador: ${r.operator_name || "—"} | Projeto: ${r.project_name || "—"}\n   Horas: ${r.total_hours}h | Valor: ${fmtCurrency(r.total_value || 0)}`
        ).join("\n\n") + `\n\n📊 Total: ${total}h — ${fmtCurrency(valor)}`);
      }
    } catch { result = result.replace(hMatch[0], "Erro ao consultar horas."); }
  }
  const fMatch = text.match(/\[\[QUERY_FINANCE:(.*?)\]\]/s);
  if (fMatch) {
    try {
      const p = JSON.parse(fMatch[1]);
      let q = supabase.from("transactions").select("title, type, amount, category, date, status");
      if (p.days) q = q.gte("created_at", periodFilter(p.days));
      if (p.type) q = q.eq("type", p.type);
      const { data } = await q.limit(20).order("date", { ascending: false });
      if (!data?.length) result = result.replace(fMatch[0], "Nenhuma transação encontrada.");
      else {
        const income = data.filter((r: any) => r.type === "income").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        const expense = data.filter((r: any) => r.type === "expense").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        result = result.replace(fMatch[0], data.map((r: any) =>
          `${r.type === "income" ? "💰" : "💸"} ${r.title} — ${fmtCurrency(r.amount || 0)} (${r.category || "—"}) ${r.status === "paid" ? "✅" : "⏳"}`
        ).join("\n") + `\n\n📊 Receitas: ${fmtCurrency(income)} | Despesas: ${fmtCurrency(expense)} | Saldo: ${fmtCurrency(income - expense)}`);
      }
    } catch { result = result.replace(fMatch[0], "Erro ao consultar finanças."); }
  }
  const osMatch = text.match(/\[\[QUERY_OS:(.*?)\]\]/s);
  if (osMatch) {
    try {
      const p = JSON.parse(osMatch[1]);
      let q = supabase.from("service_orders").select("client, date, machine_id, start_hour, end_hour, total_value, status, payment_method");
      if (p.status) q = q.eq("status", p.status);
      if (p.days) q = q.gte("created_at", periodFilter(p.days));
      const { data } = await q.limit(15).order("date", { ascending: false });
      if (!data?.length) result = result.replace(osMatch[0], "Nenhuma OS encontrada.");
      else {
        const total = data.reduce((s: number, r: any) => s + Number(r.total_value || 0), 0);
        result = result.replace(osMatch[0], data.map((r: any) =>
          `📋 OS — ${r.client} — ${fmtDate(r.date)}\n   Horário: ${r.start_hour}h-${r.end_hour}h | ${fmtCurrency(r.total_value || 0)}\n   Pagamento: ${r.payment_method || "—"} | Status: ${r.status === "completed" ? "✅" : r.status === "pending" ? "⏳" : "❌"}`
        ).join("\n\n") + `\n\n📊 Total: ${fmtCurrency(total)}`);
      }
    } catch { result = result.replace(osMatch[0], "Erro ao consultar OS."); }
  }
  const mMatch = text.match(/\[\[QUERY_MAINTENANCE:(.*?)\]\]/s);
  if (mMatch) {
    try {
      const p = JSON.parse(mMatch[1]);
      let q = supabase.from("maintenance_records").select("machine_id, date, type, description, cost, technician");
      if (p.machine) q = q.ilike("machine_id", `%${p.machine}%`);
      if (p.days) q = q.gte("created_at", periodFilter(p.days));
      const { data } = await q.limit(10).order("date", { ascending: false });
      if (!data?.length) result = result.replace(mMatch[0], "Nenhuma manutenção encontrada.");
      else result = result.replace(mMatch[0], data.map((r: any) =>
        `🔧 ${fmtDate(r.date)} — ${r.type}\n   ${r.description || "—"} | Técnico: ${r.technician || "—"}${r.cost ? ` | Custo: ${fmtCurrency(r.cost)}` : ""}`
      ).join("\n\n"));
    } catch { result = result.replace(mMatch[0], "Erro ao consultar manutenções."); }
  }
  const eMatch = text.match(/\[\[QUERY_EMPLOYEES:(.*?)\]\]/s);
  if (eMatch) {
    try {
      const p = JSON.parse(eMatch[1]);
      let q = supabase.from("employees").select("name, role, status, contact, certifications");
      if (p.status) q = q.eq("status", p.status);
      if (p.name) q = q.ilike("name", `%${p.name}%`);
      const { data } = await q.limit(15).order("name");
      if (!data?.length) result = result.replace(eMatch[0], "Nenhum colaborador encontrado.");
      else result = result.replace(eMatch[0], data.map((e: any) =>
        `👤 ${e.name} — ${e.role || "—"} (${e.status})\n   Contato: ${e.contact || "—"}${e.certifications?.length ? ` | Certificações: ${e.certifications.join(", ")}` : ""}`
      ).join("\n\n"));
    } catch { result = result.replace(eMatch[0], "Erro ao consultar colaboradores."); }
  }
  return result;
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
  const msgType = detectMsgType(payload);

  if (msgType === "audio") {
    await sendMessage(phone, "🎙️ Processando áudio...", instanceToken);
  } else if (msgType === "image") {
    await sendMessage(phone, "📸 Processando imagem...", instanceToken);
  }

  const userText = await extractMediaText(payload, rawPhone, msgId!, instanceToken);
  if (!userText) {
    if (msgType === "audio" || msgType === "image") {
      await sendMessage(phone, "⚠️ Não consegui processar. Pode digitar?", instanceToken);
    }
    return;
  }

  console.log(`[WA] ${phone}: ${userText.slice(0, 100)}`);

  const user = await authenticateUser(phone);
  if (!user) {
    await sendMessage(phone, `Sou OperaAI, assistente do TerraGes.\nCadastre-se em https://terrages.vercel.app/login`, instanceToken);
    return;
  }

  const isAdmin = user.role === "admin";

  // ── Session (Estado de Conversa) ──
  const session = await getSession(phone, user.role);

  // ── Pending action confirmation check ──
  const { data: pendingAction } = await supabase.from("pending_actions")
    .select("*").eq("user_phone", phone).eq("status", "pending_confirmation").maybeSingle();

  if (pendingAction) {
    await resetSession(phone);
    const clean = userText.trim().toLowerCase();
    const isYes = ["sim", "s", "confirmo", "ok", "yes", "y"].includes(clean);
    const isNo = ["não", "nao", "n", "cancelar", "no"].includes(clean);

    if (isYes) {
      const err = await executeAction(pendingAction.action_type, pendingAction.action_data, user.id);
      await supabase.from("pending_actions").update({ status: "executed" }).eq("id", pendingAction.id);
      const msg = err ? `❌ ${err}` : `✅ ${actionLabel(pendingAction.action_type)} criada com sucesso!`;
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

  // ── Wizard (coleta passo a passo) ──
  if (session.state.startsWith("wizard:")) {
    const handled = await processWizard(userText, session, phone, instanceToken, user.id);
    if (handled) return;
    await resetSession(phone);
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

  // ── Process queries (se não houve ação, tenta queries) ──
  let finalText = actionType ? cleanText : await execQueries(cleanText);

  // ── Fallback: se AI não seguiu o prompt, auto-dispara wizard ──
  const createIntents = ["criar", "nova", "novo", "cadastrar", "registrar", "abrir", "fazer uma os", "fazer um"];
  const userWantsCreate = createIntents.some(kw => userText.toLowerCase().includes(kw));
  if (!finalText.includes("[[START_WIZARD") && !finalText.includes("[[QUERY_") && !finalText.includes("[[CREATE_") && userWantsCreate) {
    if (classification.category === "service_order") {
      finalText = `[[START_WIZARD:os]] ${finalText}`;
    } else if (classification.category === "machine_hours") {
      finalText = `[[START_WIZARD:hours]] ${finalText}`;
    }
  }

  // ── Wizard trigger ──
  const wizardMatch = finalText.match(/\[\[START_WIZARD:(\w+)\]\]/);
  if (wizardMatch) {
    const wtype = wizardMatch[1];
    const cleanResp = finalText.replace(/\[\[START_WIZARD:\w+\]\]/, "").trim();
    await sendMessage(phone, cleanResp || "OK! Vou te ajudar com isso.", instanceToken);

    if (wtype === "os") {
      await setSessionState(phone, "wizard:os:client", {});
      await sendMessage(phone, OS_STEP_LABELS.client, instanceToken);
    } else if (wtype === "hours") {
      await setSessionState(phone, "wizard:hours:machine_name", {});
      await sendMessage(phone, HOURS_STEP_LABELS.machine_name, instanceToken);
    }

    await supabase.from("whatsapp_messages").insert([{
      conversation_id: conversationId, role: "assistant",
      content: cleanResp || `Iniciando wizard ${wtype}`,
    }]);
    return;
  }

  // ── Save assistant message ──
  await supabase.from("whatsapp_messages").insert([{
    conversation_id: conversationId, role: "assistant", content: finalText,
    action_type: actionType, action_data: actionData, action_status: actionStatus,
  }]);

  // ── Send response ──
  await sendMessage(phone, finalText, instanceToken);
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
