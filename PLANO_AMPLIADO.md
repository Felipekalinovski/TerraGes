# Plano de Implementação Ampliado - Arquitetura de Agente Modular para WhatsApp (OperaAI)

## Visão Geral
O WhatsApp será o cérebro do projeto, recebendo toda a interação com o usuário e resolvendo todas as necessidades via mensagem, com processamento multimodal, memória conversacional e sistema de notificações proativas.

## [Database Changes]

### [NEW] [20260601_activate_pgvector.sql (Migration)]
Ativação da extensão pgvector para busca semântica:
```sql
-- Ativação da extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela para armazenar embeddings de registros operacionais
CREATE TABLE IF NOT EXISTS operational_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN ('rdo', 'service_order', 'machine_hours')),
  record_id UUID NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca de similaridade
CREATE INDEX IF NOT EXISTS idx_embeddings_vector 
  ON operational_embeddings (embedding vector_cosine_distance(1536));

-- Função para gerar embeddings (exemplo com OpenAI)
CREATE OR REPLACE FUNCTION generate_embedding(content TEXT) 
RETURNS VECTOR(1536) AS $$
-- Implementação real dependerá da API de embedding utilizada
SELECT '[0.1, 0.2, ...]'::VECTOR(1536);
$$ LANGUAGE SQL IMMUTABLE;
```

### [NEW] [20260601_conversational_memory.sql (Migration)]
Tabela para memória conversacional:
```sql
CREATE TABLE IF NOT EXISTS conversation_sessions (
  session_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('operator', 'manager', 'admin')),
  current_state TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_phone 
  ON conversation_sessions (user_phone);

CREATE INDEX IF NOT EXISTS idx_sessions_created_at 
  ON conversation_sessions (created_at);
```

## [Backend Edge Functions]

### [MODIFY] [index.ts (Edge Function) - Estrutura Ampliada]

#### 1. Middleware de Autenticação Rápida (Início do arquivo)
```typescript
interface User {
  phone: string;
  role: 'operator' | 'manager' | 'admin';
  name: string;
}

async function authenticateUser(phone: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('phone, role, name')
      .eq('phone', phone)
      .single();
    
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// Uso no início da função principal
const user = await authenticateUser(req.body.sender);
if (!user) {
  return new Response('Usuário não autorizado', { status: 401 });
}

// Injetar role no prompt do classificador
const systemPrompt = `Você é um assistente de gestão de operações. Seu papel é: ${
  user.role === 'admin' ? 'administrador total do sistema' :
  user.role === 'manager' ? 'gestor com acesso a relatórios e finanças' :
  'operador de campo, responsável por registrar atividades'
}.`;
```

#### 2. Processamento Multimodal
```typescript
async function processMedia(message: any): Promise<string> {
  if (!message.media_url) return message.text;
  
  const mediaType = message.media_type;
  
  if (mediaType === 'audio' || mediaType === 'voice_note') {
    // Transcrever áudio com Whisper/Gemini
    const audioText = await transcribeAudio(message.media_url);
    return `${message.text}\n[Áudio transcrito: ${audioText}]`;
  }
  
  if (mediaType === 'image') {
    // OCR para leitura de imagens
    if (message.text.includes('nota') || message.text.includes('comprovante')) {
      const ocrText = await performOCR(message.media_url);
      return `${message.text}\n[Imagem processada: ${ocrText}]`;
    }
  }
  
  return message.text;
}

async function transcribeAudio(audioUrl: string): Promise<string> {
  // Implementação com OpenAI Whisper ou Gemini
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ file: audioUrl, model: 'whisper-1' })
  });
  return response.json().then(data => data.text);
}

async function performOCR(imageUrl: string): Promise<string> {
  // Implementação com Gemini Vision ou similar
  const response = await fetch('https://api.gemini.com/v1/vision/ocr', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}` },
    body: JSON.stringify({ image: imageUrl })
  });
  return response.json().then(data => data.text);
}
```

#### 3. Sistema de Triage Ampliado
```typescript
interface TriageResult {
  category: 'fleet' | 'machine_hours' | 'rdo' | 'finance' | 'schedule' | 'service_order' | 'delete_record' | 'historical_query' | 'off_scope';
  confidence: number;
  context?: Record<string, any>;
}

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
  
  Responda apenas com a categoria e confiança (0-1).
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1
  });
  
  const result = response.choices[0].message.content;
  return parseClassification(result);
}
```

#### 4. Skill 'Historical_Query' com RAG
```typescript
async function historicalQuery(question: string, userRole: string): Promise<string> {
  // 1. Gerar embedding da pergunta
  const questionEmbedding = await generateEmbedding(question);
  
  // 2. Buscar registros similares no pgvector
  const { data: similarRecords } = await supabase.rpc('search_embeddings', {
    query_embedding: questionEmbedding,
    match_threshold: 0.7,
    match_count: 10
  });
  
  // 3. Construir contexto
  const context = similarRecords.map(record => ({
    type: record.record_type,
    id: record.record_id,
    content: record.content,
    relevance: record.similarity
  }));
  
  // 4. Gerar resposta com contexto
  const prompt = `
  Usuário (${userRole}) está perguntando: "${question}"
  
  Contexto relevante do histórico:
  ${JSON.stringify(context, null, 2)}
  
  Baseado nesse contexto, forneça uma resposta detalhada e precisa.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  });
  
  return response.choices[0].message.content;
}
```

#### 5. Memória Conversacional
```typescript
interface ConversationState {
  currentAction: string;
  pendingFields: string[];
  context: Record<string, any>;
}

async function updateConversationState(phone: string, state: ConversationState): Promise<void> {
  await supabase
    .from('conversation_sessions')
    .upsert({
      user_phone: phone,
      current_state: state.currentAction,
      context: state.context,
      updated_at: new Date().toISOString()
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
    pendingFields: data.pending_fields || [],
    context: data.context || {}
  } : null;
}

// Exemplo de uso com estado pendente
async function handleCreateMachineHours(message: string, phone: string) {
  const state = await getConversationState(phone);
  
  if (state?.currentAction === 'awaiting_machine') {
    // Machine foi fornecido, continuar com o resto
    await updateConversationState(phone, {
      currentAction: 'creating_machine_hours',
      pendingFields: [],
      context: { ...state.context, machine: message }
    });
    
    return await completeMachineHoursCreation(phone, state.context);
  }
  
  // Pedir machine faltante
  await updateConversationState(phone, {
    currentAction: 'awaiting_machine',
    pendingFields: ['machine'],
    context: {}
  });
  
  return 'Qual foi a máquina operada?';
}
```

#### 6. Sistema de Rascunhos vs Efetivação
```typescript
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
```

### [NEW] [cron-notifications.ts (Edge Function)]
Função separada para notificações proativas:
```typescript
interface ScheduledNotification {
  type: 'end_of_shift' | 'daily_report' | 'pending_payments' | 'machine_maintenance';
  target_role: 'operator' | 'manager' | 'admin';
  message: string;
  scheduled_time: string;
}

async function sendScheduledNotifications() {
  const now = new Date().toISOString();
  
  // Buscar notificações agendadas para o momento atual
  const { data: notifications } = await supabase
    .from('scheduled_notifications')
    .select('*')
    .eq('scheduled_time', now)
    .eq('sent', false);
  
  for (const notification of notifications) {
    // Buscar usuários do target_role
    const { data: users } = await supabase
      .from('users')
      .select('phone')
      .eq('role', notification.target_role);
    
    // Enviar notificações via WhatsApp
    for (const user of users) {
      await sendWhatsAppMessage(user.phone, notification.message);
    }
    
    // Marcar como enviada
    await supabase
      .from('scheduled_notifications')
      .update({ sent: true })
      .eq('id', notification.id);
  }
}

// Exemplo de agendamento
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
      scheduled_time: tomorrow.toISOString(),
      sent: false
    });
}
```

## [Integração de Memórias]

### [NEW] [memory-manager.ts (Módulo separado)]
```typescript
class MemoryManager {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }
  
  async setImmediateContext(phone: string, context: any): Promise<void> {
    await this.redis.setex(`immediate_context:${phone}`, 3600, JSON.stringify(context));
  }
  
  async getImmediateContext(phone: string): Promise<any> {
    const context = await this.redis.get(`immediate_context:${phone}`);
    return context ? JSON.parse(context) : null;
  }
  
  async setHistoricalMemory(phone: string, memory: any): Promise<void> {
    const key = `historical_memory:${phone}`;
    const existing = await this.redis.get(key);
    const memories = existing ? JSON.parse(existing) : [];
    
    memories.push({
      ...memory,
      timestamp: new Date().toISOString()
    });
    
    // Manter apenas últimas 100 memórias
    if (memories.length > 100) {
      memories.splice(0, memories.length - 100);
    }
    
    await this.redis.setex(key, 86400, JSON.stringify(memories)); // 24 horas
  }
  
  async getHistoricalMemory(phone: string): Promise<any[]> {
    const context = await this.redis.get(`historical_memory:${phone}`);
    return context ? JSON.parse(context) : [];
  }
}

// Uso na Edge Function
const memoryManager = new MemoryManager();

// Contexto imediato
await memoryManager.setImmediateContext(phone, { currentAction: 'creating_service_order' });

// Memória de longo prazo
await memoryManager.setHistoricalMemory(phone, {
  action: 'created_service_order',
  orderId: generatedOrderId,
  data: serviceOrderData
});
```

## [Fluxo Completo do Agente]

```typescript
export default async function handler(req: Request) {
  // 1. Autenticação rápida
  const user = await authenticateUser(req.body.sender);
  if (!user) return new Response('Unauthorized', { status: 401 });
  
  // 2. Processamento multimodal
  const processedMessage = await processMedia(req.body.message);
  
  // 3. Memória conversacional
  const conversationState = await getConversationState(user.phone);
  
  // 4. Classificação de intenção
  const classification = await classifyMessage(processedMessage, user.role);
  
  // 5. Roteamento para skills
  let response: string;
  
  switch (classification.category) {
    case 'historical_query':
      response = await historicalQuery(processedMessage, user.role);
      break;
      
    case 'service_order':
      response = await handleServiceOrder(processedMessage, user, conversationState);
      break;
      
    case 'machine_hours':
      response = await handleMachineHours(processedMessage, user, conversationState);
      break;
      
    // ... outras categorias
      
    default:
      response = 'Não entendi. Por favor, tente novamente.';
  }
  
  // 6. Atualizar memória
  await memoryManager.setHistoricalMemory(user.phone, {
    input: processedMessage,
    output: response,
    classification: classification.category
  });
  
  return new Response(JSON.stringify({ response }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## [Verificação Ampliada]

### Testes Manuais
1. **Autenticação e Roles**: Testar acesso por diferentes níveis de permissão
2. **Processamento Multimodal**: 
   - Enviar áudio e verificar transcrição
   - Enviar foto de nota fiscal e verificar OCR
3. **Busca Semântica**: 
   - Perguntar "como foram as operações na obra X nos últimos 15 dias?"
   - Verificar se o sistema retorna registros relevantes
4. **Memória Conversacional**: 
   - Começar ação incompleta, verificar se o sistema lembra o contexto
5. **Notificações Proativas**: 
   - Verificar envios automáticos de fim de turno
6. **Sistema de Confirmação**: 
   - Testar fluxo de rascunhos vs efetivação

### Regras de Negócio
- Operadores só podem registrar atividades, não acessar finanças
- Gestores podem ver relatórios e pendências
- Admins podem efetivar ações sem confirmação
- Toda ação não-administrativa requer dupla checagem
- Sistema deve lembrar contexto entre mensagens na mesma conversa