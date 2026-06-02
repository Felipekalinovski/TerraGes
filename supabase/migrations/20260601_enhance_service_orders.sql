-- Ativação da extensão pgvector para busca semântica
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

-- Adiciona novas colunas à tabela service_orders
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS client_cpf TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS client_contact TEXT;

-- Atualiza a constraint para incluir 'Cheque'
ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_payment_method_check;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_payment_method_check 
  CHECK (payment_method IN ('Pix', 'Cartão', 'Boleto', 'Faturado', 'Dinheiro', 'Cheque'));

-- Tabela para memória conversacional
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

-- Adiciona colunas para gerenciamento de estado e rascunhos
CREATE TABLE IF NOT EXISTS pending_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL,
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_phone 
  ON pending_actions (user_phone);

-- Tabela para notificações agendadas
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('end_of_shift', 'daily_report', 'pending_payments', 'machine_maintenance')),
  target_role TEXT NOT NULL CHECK (target_role IN ('operator', 'manager', 'admin')),
  message TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_time 
  ON scheduled_notifications (scheduled_time) WHERE sent = FALSE;