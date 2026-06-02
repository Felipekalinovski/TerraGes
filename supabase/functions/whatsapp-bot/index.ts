import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? ""; // Para OCR e embeddings
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: string;
  phone: string;
  role: 'operator' | 'manager' | 'admin';
  name: string;
}

interface TriageResult {
  category: 'fleet' | 'machine_hours' | 'rdo' | 'finance' | 'schedule' | 'service_order' | 'delete_record' | 'historical_query' | 'off_scope';
  confidence: number;
  context?: Record<string, any>;
}

interface ConversationState {
  currentAction: string;
  pendingFields: string[];
  context: Record<string, any>;
}

interface EmbeddingRecord {
  id: string;
  record_type: 'rdo' | 'service_order' | 'machine_hours';
  record_id: string;
  embedding: number[];
  content: string;
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

// ─── Authentication Middleware ──────────────────────────────────────────────────

async function authenticateUser(phone: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, phone, role, name')
      .eq('phone', phone)
      .single();
    
    if (error) return null;
    return {
      id: data.id,
      phone: data.phone,
      role: data.role as 'operator' | 'manager' | 'admin',
      name: data.name || ''
    };
  } catch {
    return null;
  }
}

// ─── Processamento Multimodal ───────────────────────────────────────────────────

async function processMedia(message: EvogoPayload): Promise<string> {
  if (!message.data?.Info.ID || !message.data?.Info.Chat) return extractText(message) || '';

  const info = message.data.Info;
  const msg = message.data.Message;

  if (info.Type === 'image' && msg.imageMessage) {
    // Se houver legenda, usá-la junto com o OCR
    const caption = msg.imageMessage.caption || '';
    
    // Fazer OCR na imagem
    const imageUrl = await getImageUrl(info.Chat, info.ID, message.instanceToken || EVOLUTION_API_KEY);
    if (imageUrl) {
      const ocrText = await performOCR(imageUrl);
      return `${caption}\n[Texto identificado na imagem: ${ocrText}]`;
    }
    return caption;
  }

  return extractText(message) || '';
}

async function getImageUrl(chatJid: string, msgId: string, token: string): Promise<string | null> {
  // Obter imagem do Evolution API
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
      console.error(`[Image] Falha: ${res.status}: ${err}`);
      return null;
    }

    const data = await res.json();
    return data.url || null;
  } catch (e) {
    console.error(`[Image] Erro: ${e}`);
    return null;
  }
}

async function performOCR(imageUrl: string): Promise<string> {
  // Implementação com Gemini Vision
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Extraia todo o texto visível na imagem. Se houver valores monetários, datas ou números de documentos, destaque-os especialmente." },
            { 
              inline_data: {
                mime_type: "image/jpeg", // ajustar conforme necessário
                data: imageUrl.split(',')[1] // extrai base64 da URL data:image/jpeg;base64,...
              }
            }
          ]
        }]
      })
    });

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || 'Texto não identificado';
  } catch (e) {
    console.error('[OCR] Erro:', e);
    return 'Falha na leitura da imagem';
  }
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

// ─── Sistema de Triage ──────────────────────────────────────────────────────────

async function classifyMessage(text: string, userRole: string): Promise<TriageResult> {
  const prompt = `
  Classifique a mensagem do usuário em uma categoria:
  
  Categorias disponíveis:
  - fleet: gestão de frota (máquinas, manutenção)
  - machine_hours: registro de horas-máquina
  - rdo: relatório diário de operações
  - finance: finanças e relatórios financeiros
  - schedule: agendamentos e planejamento
  - service_order: ordens de serviço
  - delete_record: exclusão de registros
  - historical_query: análise de dados históricos (últimos X dias, relatórios longos)
  - off_scope: fora do escopo do sistema
  
  Usuário é: ${userRole}
  
  Mensagem: "${text}"
  
  Responda apenas com a categoria e confiança (0-1) no formato JSON:
  {
    "category": "categoria",
    "confidence": número,
    "context": {}
  }
  `;
  
  try {
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
        temperature: 0.1
      }),
    });
    
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const d = await res.json();
    const result = d.choices?.[0]?.message?.content;
    
    return JSON.parse(result);
  } catch (e) {
    console.error("[Triage] Erro:", e);
    // Categoria padrão se falhar
    return { category: 'off_scope', confidence: 0.5, context: {} };
  }
}

// ─── Sistema de Memória Conversacional ──────────────────────────────────────────

async function updateConversationState(phone: string, state: ConversationState): Promise<void> {
  await supabase
    .from('conversation_sessions')
    .upsert({
      user_phone: phone,
      current_state: state.currentAction,
      context: state.context,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_phone'
    });
}

async function getConversationState(phone: string): Promise<ConversationState | null> {
  const { data } = await supabase
    .from('conversation_sessions')
    .select('current_state, context')
    .eq('user_phone', phone)
    .single();
  
  return data ? {
    currentAction: data.current_state,
    pendingFields: [], // Simplificação - os campos pendentes podem ser inferidos do contexto
    context: data.context || {}
  } : null;
}

// ─── Sistema de Embeddings e RAG ────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-ada-002'  // modelo padrão para embeddings
      })
    });

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.error('[Embedding] Erro:', e);
    return null;
  }
}

async function searchSimilarRecords(query: string, limit: number = 5): Promise<EmbeddingRecord[]> {
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) return [];

  // Chamada para função RPC do Supabase que faz a busca semântica
  const { data, error } = await supabase.rpc('search_embeddings', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit
  });

  if (error) {
    console.error('[Search] Erro:', error);
    return [];
  }

  return data || [];
}

async function historicalQuery(question: string, userRole: string): Promise<string> {
  // Buscar registros similares no pgvector
  const similarRecords = await searchSimilarRecords(question);
  
  // Construir contexto
  const context = similarRecords.map(record => ({
    type: record.record_type,
    id: record.record_id,
    content: record.content,
    relevance: 1 // Para simplificação, assumimos alta relevância
  }));
  
  // Gerar resposta com contexto
  const prompt = `
  Usuário (${userRole}) está perguntando: "${question}"
  
  Contexto relevante do histórico:
  ${JSON.stringify(context, null, 2)}
  
  Baseado nesse contexto, forneça uma resposta detalhada e precisa.
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
      temperature: 0.3
    }),
  });
  
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "Não foi possível encontrar informações relevantes no histórico.";
}

// ─── Sistema de Rascunhos vs Efetivação ───────────────────────────────────────────

async function createActionWithConfirmation(action: string, data: any, userRole: string): Promise<string> {
  if (userRole === 'admin') {
    // Admin pode efetivar diretamente
    return await executeAction(action, data);
  }
  
  // Outros usuários precisam de confirmação
  const confirmationMessage = `Vou ${action} com os seguintes dados:\n${JSON.stringify(data, null, 2)}\n\nConfirma (Sim/Não)?`;
  
  // Armazenar ação pendente de confirmação
  await supabase
    .from('pending_actions')
    .insert({
      user_phone: data.phone,
      action_type: action,
      action_data: data,
      status: 'pending_confirmation'
    });
  
  return confirmationMessage;
}

async function handleUserConfirmation(phone: string, confirmed: boolean): Promise<string> {
  const { data: pendingAction } = await supabase
    .from('pending_actions')
    .select('*')
    .eq('user_phone', phone)
    .eq('status', 'pending_confirmation')
    .single();
  
  if (!pendingAction) return 'Nenhuma ação pendente encontrada.';
  
  if (confirmed) {
    // Executar ação
    await supabase
      .from('pending_actions')
      .update({ status: 'executed' })
      .eq('id', pendingAction.id);
    
    return await executeAction(pendingAction.action_type, pendingAction.action_data);
  } else {
    // Cancelar ação
    await supabase
      .from('pending_actions')
      .update({ status: 'cancelled' })
      .eq('id', pendingAction.id);
    
    return 'Ação cancelada.';
  }
}

async function executeAction(action: string, data: any): Promise<string> {
  // Função que executa a ação real no banco de dados
  if (action.startsWith('CREATE_OS')) {
    // Criar ordem de serviço com novos campos
    const { error } = await supabase.from('service_orders').insert([{
      ...data,
      client_cpf: data.client_cpf,
      client_contact: data.client_contact,
      location: data.location,
      payment_method: data.payment_method
    }]);
    
    if (error) {
      return `Erro ao criar ordem de serviço: ${error.message}`;
    }
    
    return `Ordem de serviço criada com sucesso! ID: ${data.id || 'novo'}`;
  } else if (action.startsWith('CREATE_SCHEDULE')) {
    // Criar agendamento
    const { error } = await supabase.from('schedules').insert([data]);
    
    if (error) {
      return `Erro ao criar agendamento: ${error.message}`;
    }
    
    return `Agendamento criado com sucesso!`;
  }
  
  return 'Ação realizada com sucesso!';
}

// ─── Sistema de Notificações Proativas ───────────────────────────────────────────

async function scheduleEndOfShiftNotifications() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0); // 18:00
  
  await supabase
    .from('scheduled_notifications')
    .insert({
      type: 'end_of_shift',
      target_role: 'operator',
      message: 'Lembrete: Fechar a máquina e registrar horas trabalhadas.',
      scheduled_time: tomorrow.toISOString()
    });
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
Você atende via WhatsApp e usa português simples.

ATENÇÃO: Você está conversando com um OPERADOR de campo. Ele NÃO tem acesso direto a relatórios ou informações financeiras da empresa.

No entanto, o operador PODE e DEVE registrar novas Ordens de Serviço (OS) diretamente por aqui.
Se o operador passar dados para criar uma nova Ordem de Serviço (OS), você DEVE extrair as informações e gerar a tag [[CREATE_OS:...]] no formato abaixo:
[[CREATE_OS:{"client":"Nome do Cliente","client_cpf":"CPF se informado","client_contact":"Telefone de contato se informado","date":"Data da OS YYYY-MM-DD","start_hour":0,"end_hour":0,"hourly_rate":0,"payment_method":"Pix","location":"Localização se informada","description":"Breve descrição se informada","save":"draft"}]]

ATENÇÃO: Quando você gerar a tag [[CREATE_OS:...]] para o operador, escreva também uma resposta resumindo os dados que você identificou e perguntando explicitamente se ele confirma a criação da OS com "Sim" ou "Não". Exemplo de resposta:
"Entendi, os dados da OS são:
- Cliente: Roberto Silva
- Horas: 8h
- Pagamento: Pix
Confirma a criação desta Ordem de Serviço (Sim/Não)?"

Se o operador pedir informações sobre:
- Frota: "Apenas gestores têm acesso a informações da frota."
- Financeiro: "Apenas gestores têm acesso ao financeiro."
- Relatórios: "Peça ao gestor para gerar o relatório no app."
- Agenda: "Peça ao gestor para verificar a agenda."
- Máquinas: "Peça ao gestor para verificar as máquinas."

IMPORTANTE: Fora a criação de OS, nunca revele dados financeiros, de frotas, agenda ou qualquer informação confidencial da empresa.`;
  }

  // ADMIN CONTEXT - buscar dados reais
  const ago30 = new Date(today);
  ago30.setDate(ago30.getDate() - 30);

  const [{ data: machines }, { data: transactions }, { data: schedules }, { data: serviceOrders }] =
    await Promise.all([
      supabase.from("machines").select("name, type, status, health_score, health_status").eq("user_id", userId),
      supabase.from("transactions").select("amount, type, category, status, date").eq("user_id", userId).gte("date", ago30.toISOString().split("T")[0]),
      supabase.from("schedules").select("title, type, start_time, priority").gte("start_time", today.toISOString()).order("start_time", { ascending: true }).limit(5),
      supabase.from("service_orders").select("client, status, date, total_value").eq("user_id", userId).order("date", { ascending: false }).limit(5),
    ]);

  // Separar transações pagas e pendentes
  const paidTransactions = transactions?.filter(t => t.status === 'paid') || [];
  const pendingTransactions = transactions?.filter(t => t.status === 'pending') || [];
  
  const income = paidTransactions.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0) ?? 0;
  const expense = paidTransactions.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0) ?? 0;
  
  const pendingIncome = pendingTransactions.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0) ?? 0;
  const pendingExpense = pendingTransactions.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0) ?? 0;
  
  const machinesList = machines?.map((m) => `- ${m.name} (${m.type}): ${m.health_status} – saúde ${m.health_score}%`).join("\n") || "Nenhuma máquina cadastrada.";
  const scheduleList = schedules?.map((s) => `- ${s.title} | ${new Date(s.start_time).toLocaleDateString("pt-BR")} | Prioridade: ${s.priority}`).join("\n") || "Nenhum agendamento futuro.";
  const osList = serviceOrders?.map((o) => `- Cliente: ${o.client} | Status: ${o.status} | Data: ${o.date} | Valor: R$ ${Number(o.total_value ?? 0).toFixed(2)}`).join("\n") || "Nenhuma OS recente.";

  // Gerar insights financeiros
  const profitMargin = income > 0 ? ((income - expense) / income) * 100 : 0;
  
  // Identificar pendências de cobrança
  const pendingPaymentsList = pendingTransactions.map(t => 
    `- ${t.title} | R$ ${Number(t.amount).toFixed(2)} | Vence: ${t.date}`
  ).join("\n") || "Nenhuma pendência";

  return `Você é o OperaAI, assistente inteligente do TerraGes.
Atende via WhatsApp. Seja direto, cordial e use português simples.
NUNCA invente dados. Use APENAS as informações abaixo.
Hoje é ${today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}.

=== FROTA ===
${machinesList}

=== FINANCEIRO (últimos 30 dias) ===
- Receitas: R$ ${income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Custo/Despesas: R$ ${expense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Margem/Saldo: R$ ${(income - expense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${profitMargin.toFixed(2)}%)
- Total de OS: ${serviceOrders?.length ?? 0} recentes

=== PENDÊNCIAS DE COBRANÇA ===
⚠️ Pendências de Cobrança:
${pendingPaymentsList}

Receitas Pendentes: R$ ${pendingIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
Despesas Pendentes: R$ ${pendingExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

=== PRÓXIMOS AGENDAMENTOS ===
${scheduleList}

=== ORDENS DE SERVIÇO RECENTES ===
${osList}

=== INSTRUÇÕES DE AÇÕES (ADMIN) ===
Se o usuário passar infos soltas (ex: "Escavadeira, 8h, João, terraplanagem, CPF 123.456.789-00, contato (11) 98888-1111, localização Av Paulista 1000, forma de pagamento Cheque"), crie uma OS:
[[CREATE_OS:{"client":"...","client_cpf":"...","client_contact":"...","date":"YYYY-MM-DD","start_hour":0,"end_hour":0,"hourly_rate":0,"payment_method":"Cheque","location":"...","description":"...","save":"draft"}]]

Para AGENDAR:
[[CREATE_SCHEDULE:{"title":"...","type":"...","start_time":"YYYY-MM-DDTHH:mm:ss","priority":"high","notes":"...","save":"draft"}]]

Para RELATÓRIO FINANCEIRO:
📊 RELATÓRIO - MÊS VIGENTE
💰 Receita: R$ [Valor]
💸 Custo: R$ [Valor]
✅ Margem: R$ [Valor] (XX%)
⚠️ Pendências: [Listar pendências]

IMPORTANTE: Respostas curtas, sem asteriscos. Tag [[CREATE...]] apenas se for ADMIN.`;
}

async function processActions(
  supabase: ReturnType<typeof createClient>,
  aiResponse: string,
  userId: string,
  phone: string,
  isAdmin: boolean = false
): Promise<{ cleanText: string; actionType: string | null; actionData: unknown; actionStatus: string }> {
  let cleanText = aiResponse;
  let actionType: string | null = null;
  let actionData: unknown = null;
  let actionStatus = "none";

  // Se não é admin, verifica se há uma tag CREATE_OS para criar uma ação pendente de confirmação
  if (!isAdmin) {
    const osMatch = aiResponse.match(/\[\[CREATE_OS:(.*?)\]\]/s);
    if (osMatch) {
      cleanText = aiResponse.replace(/\[\[CREATE_OS:.*?\]\]/s, "").trim();
      try {
        const parsed = JSON.parse(osMatch[1]);
        const { save, ...osData } = parsed;
        
        // Limpar qualquer ação pendente anterior deste usuário para evitar conflitos
        await supabase
          .from("pending_actions")
          .update({ status: "cancelled" })
          .eq("user_phone", phone)
          .eq("status", "pending_confirmation");

        // Salvar em pending_actions
        const { error } = await supabase
          .from("pending_actions")
          .insert([{
            user_phone: phone,
            action_type: "CREATE_OS",
            action_data: osData,
            status: "pending_confirmation"
          }]);
        
        if (error) {
          console.error("[Action] Erro ao salvar ação pendente:", error);
          cleanText += "\n\n⚠️ Ocorreu um erro ao preparar a confirmação da OS. Tente pelo app.";
          actionStatus = "failed";
        } else {
          actionType = "service_order";
          actionData = osData;
          actionStatus = "pending_confirmation";
        }
      } catch (e) {
        console.error("[Action] Falha ao analisar JSON de OS:", e);
        actionStatus = "failed";
      }
      
      // Limpar quaisquer outras tags de agendamento ou relatórios não autorizados
      cleanText = cleanText.replace(/\[\[CREATE_.*?\]\]/gs, "").trim();
      return { cleanText, actionType, actionData, actionStatus };
    }
    
    // Se for outra ação (SCHEDULE, REPORT)
    const hasActionRequest = /\[\[CREATE_(SCHEDULE|REPORT):/.test(aiResponse);
    cleanText = aiResponse.replace(/\[\[CREATE_.*?\]\]/gs, "").trim();
    if (hasActionRequest) {
      cleanText += "\n\n⚠️ Apenas administradores podem criar agendamentos ou relatórios via WhatsApp.";
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
        const { error } = await supabase.from("schedules").insert(scheduleData);
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
      // Processar imagem com OCR
      userText = await processMedia(payload);
      if (!userText || userText.includes('Texto não identificado')) {
        await sendMessage(phone, "📸 Foto recebida! Estou lendo o conteúdo da imagem...", instanceToken);
        // Aguardar OCR e continuar com o texto extraído
      }
    }

    if (!userText) {
      console.log("[WA] Falha ao extrair texto do payload:", JSON.stringify(payload).substring(0, 500));
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_text" }), { headers: corsHeaders });
    }

    // 1. Autenticação do usuário
    const user = await authenticateUser(phone);
    if (!user) {
      await sendMessage(phone, `Bem-vindo! 👋 Sou OperaAI, assistente do TerraGes.\nPosso ajudar com: registrar horas, orçamentos, relatórios e sua frota.\n\nPara começar, cadastre seu número (${phone}) nas Configurações do app!`, instanceToken);
      return new Response(JSON.stringify({ ok: true, reason: "user_not_found" }), { headers: corsHeaders });
    }

    const userId = user.id;
    const userRole = user.role;
    const isAdminUser = userRole === 'admin';

    // ─── Verificação de Ação Pendente de Confirmação ───────────────────────────────
    const { data: pendingAction } = await supabase
      .from("pending_actions")
      .select("*")
      .eq("user_phone", phone)
      .eq("status", "pending_confirmation")
      .maybeSingle();

    if (pendingAction) {
      const cleanUserText = userText.trim().toLowerCase();
      const isYes = ["sim", "s", "confirmo", "confirmar", "ok", "yes", "y"].includes(cleanUserText);
      const isNo = ["não", "nao", "n", "cancelar", "cancela", "no"].includes(cleanUserText);

      if (isYes) {
        // Efetivar a ação: Salvar a OS diretamente na tabela service_orders
        const osData = pendingAction.action_data as Record<string, any>;
        
        const { error } = await supabase
          .from("service_orders")
          .insert([{
            ...osData,
            user_id: userId,
            status: "pending" // Status inicial para OS criada por operador
          }]);

        if (error) {
          console.error("[Confirmation] Erro ao criar OS:", error);
          await sendMessage(phone, "⚠️ Ocorreu um erro ao salvar a Ordem de Serviço no banco de dados. Tente novamente pelo aplicativo.", instanceToken);
        } else {
          // Atualizar status da ação para executado
          await supabase
            .from("pending_actions")
            .update({ status: "executed" })
            .eq("id", pendingAction.id);

          await sendMessage(phone, "✅ Confirmação recebida! Ordem de Serviço criada com sucesso no sistema.", instanceToken);
        }
        
        return new Response(JSON.stringify({ ok: true, action: "executed" }), { headers: corsHeaders });
      } else if (isNo) {
        // Cancelar a ação
        await supabase
          .from("pending_actions")
          .update({ status: "cancelled" })
          .eq("id", pendingAction.id);

        await sendMessage(phone, "❌ Entendido. Criação da Ordem de Serviço cancelada.", instanceToken);
        return new Response(JSON.stringify({ ok: true, action: "cancelled" }), { headers: corsHeaders });
      } else {
        // Resposta inválida para confirmação
        await sendMessage(phone, `⚠️ Você tem uma criação de Ordem de Serviço pendente.\n\nPor favor, responda com *Sim* para confirmar ou *Não* para cancelar.`, instanceToken);
        return new Response(JSON.stringify({ ok: true, action: "waiting_valid_response" }), { headers: corsHeaders });
      }
    }

    // 2. Classificação da intenção (Triage)
    const classification = await classifyMessage(userText, userRole);
    
    // 3. Se for uma consulta histórica, usar RAG
    if (classification.category === 'historical_query') {
      const historicalResponse = await historicalQuery(userText, userRole);
      await sendMessage(phone, historicalResponse, instanceToken);
      return new Response(JSON.stringify({ ok: true, reason: "historical_query_processed" }), { headers: corsHeaders });
    }

    // 4. Busca ou cria conversa
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

    // 5. Salva mensagem do usuário
    await supabase.from("whatsapp_messages").insert([{
      conversation_id: conversationId, role: "user", content: userText,
      whatsapp_msg_id: msgId, input_type: inputType,
    }]);

    // 6. Histórico (últimas 10 mensagens)
    const { data: history } = await supabase
      .from("whatsapp_messages").select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }).limit(10);

    const historyMessages = (history ?? []).reverse().map((m) => ({
      role: m.role as "user" | "assistant", content: m.content,
    }));

    // 7. Chama a IA (com contexto aprimorado)
    const systemContext = await buildSystemContext(supabase, userId, inputType, isAdminUser);
    const aiResponse = await callAI([{ role: "system", content: systemContext }, ...historyMessages]);

    // 8. Processa ações (com sistema de confirmação)
    const { cleanText, actionType, actionData, actionStatus } = await processActions(supabase, aiResponse, userId, phone, isAdminUser);

    // 9. Salva resposta do assistente
    await supabase.from("whatsapp_messages").insert([{
      conversation_id: conversationId, role: "assistant", content: cleanText,
      action_type: actionType, action_data: actionData as never, action_status: actionStatus,
    }]);

    // 10. Envia resposta
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

