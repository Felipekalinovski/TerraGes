-- ═══════════════════════════════════════════════════════════════
-- TerraGes — PARTE 2: Triggers RAG + RLS para tabelas do WhatsApp/Bot
-- Rode isto DEPOIS da PARTE 1 ter funcionado
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Função de trigger: chama generate-embedding via pg_net ──────────────
CREATE OR REPLACE FUNCTION public.trigger_generate_embedding()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_url TEXT;
  v_body JSONB;
  v_request_id BIGINT;
BEGIN
  v_url := current_setting('app.edge_function_url', true);
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://gwusywstresijdjzkujn.supabase.co/functions/v1/generate-embedding';
  END IF;

  v_body := jsonb_build_object(
    'record_type', TG_ARGV[0],
    'record_id', NEW.id::text
  );

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', current_setting('app.internal_secret', true)
    ),
    body := v_body
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[trigger_generate_embedding] %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Triggers nos 3 tipos de registro
DROP TRIGGER IF EXISTS rdos_generate_embedding ON public.rdos;
CREATE TRIGGER rdos_generate_embedding
  AFTER INSERT ON public.rdos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_embedding('rdo');

DROP TRIGGER IF EXISTS service_orders_generate_embedding ON public.service_orders;
CREATE TRIGGER service_orders_generate_embedding
  AFTER INSERT ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_embedding('service_order');

DROP TRIGGER IF EXISTS hora_maquina_generate_embedding ON public.hora_maquina;
CREATE TRIGGER hora_maquina_generate_embedding
  AFTER INSERT ON public.hora_maquina
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_embedding('machine_hours');

-- ─── 2. RLS para tabelas do WhatsApp/Bot ──────────────────────

-- whatsapp_conversations
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own whatsapp_conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Users can insert own whatsapp_conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Users can update own whatsapp_conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Users can delete own whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Users can view own whatsapp_conversations" ON public.whatsapp_conversations
  FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own whatsapp_conversations" ON public.whatsapp_conversations
  FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update own whatsapp_conversations" ON public.whatsapp_conversations
  FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Users can delete own whatsapp_conversations" ON public.whatsapp_conversations
  FOR DELETE USING (auth.uid() = profile_id);

-- whatsapp_messages
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can insert own whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can update own whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can delete own whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Users can view own whatsapp_messages" ON public.whatsapp_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.whatsapp_conversations wc WHERE wc.id = conversation_id AND wc.profile_id = auth.uid())
  );
CREATE POLICY "Users can insert own whatsapp_messages" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.whatsapp_conversations wc WHERE wc.id = conversation_id AND wc.profile_id = auth.uid())
  );
CREATE POLICY "Users can update own whatsapp_messages" ON public.whatsapp_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.whatsapp_conversations wc WHERE wc.id = conversation_id AND wc.profile_id = auth.uid())
  );
CREATE POLICY "Users can delete own whatsapp_messages" ON public.whatsapp_messages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.whatsapp_conversations wc WHERE wc.id = conversation_id AND wc.profile_id = auth.uid())
  );

-- Coluna input_type (estava faltando)
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS input_type TEXT DEFAULT 'text'
  CHECK (input_type IN ('text', 'audio', 'image'));

-- pending_actions
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own pending_actions" ON public.pending_actions;
DROP POLICY IF EXISTS "Users can update own pending_actions" ON public.pending_actions;
CREATE POLICY "Users can view own pending_actions" ON public.pending_actions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own pending_actions" ON public.pending_actions
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- conversation_sessions
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view conversation_sessions" ON public.conversation_sessions;
CREATE POLICY "Users can view conversation_sessions" ON public.conversation_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- scheduled_notifications
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view scheduled_notifications" ON public.scheduled_notifications;
CREATE POLICY "Users can view scheduled_notifications" ON public.scheduled_notifications
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- operational_embeddings (cross-user para RAG)
ALTER TABLE public.operational_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read operational_embeddings" ON public.operational_embeddings;
CREATE POLICY "Authenticated can read operational_embeddings" ON public.operational_embeddings
  FOR SELECT USING (auth.uid() IS NOT NULL);
