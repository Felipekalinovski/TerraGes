-- Função RPC para busca semântica em pgvector
CREATE OR REPLACE FUNCTION search_embeddings (
  query_embedding VECTOR(1536),
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
