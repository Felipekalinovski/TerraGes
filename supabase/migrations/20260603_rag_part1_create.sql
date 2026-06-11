-- ═══════════════════════════════════════════════════════════════
-- TerraGes — PARTE 1: Criar estrutura base do RAG
-- Rode isto PRIMEIRO (cria tabela que estava faltando)
-- ═══════════════════════════════════════════════════════════════

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Tabela de embeddings (não existia no banco!)
CREATE TABLE IF NOT EXISTS public.operational_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN ('rdo', 'service_order', 'machine_hours')),
  record_id UUID NOT NULL,
  embedding VECTOR(768) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice ivfflat (precisa de dados para treinar; se vazio, use HNSW que é mais robusto)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
  ON public.operational_embeddings
  USING hnsw (embedding vector_cosine_distance);

-- Função RPC de busca semântica (768 dims, Gemini)
CREATE OR REPLACE FUNCTION search_embeddings (
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  record_type TEXT,
  record_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    oe.id,
    oe.record_type,
    oe.record_id,
    oe.content,
    1 - (oe.embedding <=> query_embedding) AS similarity
  FROM operational_embeddings oe
  WHERE 1 - (oe.embedding <=> query_embedding) > match_threshold
  ORDER BY oe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
