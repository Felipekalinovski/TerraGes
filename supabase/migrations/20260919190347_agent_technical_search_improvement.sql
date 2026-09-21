-- Treat natural multiword WhatsApp queries as a ranked union of their terms.
-- websearch_to_tsquery still handles punctuation safely after inserting OR operators.
CREATE OR REPLACE FUNCTION public.search_agent_technical_knowledge(
  p_query text DEFAULT NULL,
  p_domains text[] DEFAULT NULL,
  p_limit integer DEFAULT 8
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH input AS (
    SELECT nullif(trim(p_query),'') AS query,
      greatest(1,least(coalesce(p_limit,8),20)) AS result_limit
  ), parsed AS (
    SELECT i.*,
      CASE WHEN i.query IS NULL THEN NULL ELSE
        websearch_to_tsquery('portuguese',regexp_replace(i.query,'\s+',' OR ','g'))
      END AS terms
    FROM input i
  ), ranked AS (
    SELECT k.*,
      CASE WHEN i.terms IS NULL THEN 0::real ELSE
        ts_rank_cd(to_tsvector('portuguese',k.title || ' ' || k.summary),i.terms)
      END AS rank
    FROM public.agent_technical_knowledge k CROSS JOIN parsed i
    WHERE k.active
      AND (p_domains IS NULL OR k.domain = ANY(p_domains))
      AND (i.terms IS NULL OR
        to_tsvector('portuguese',k.title || ' ' || k.summary) @@ i.terms
        OR array_to_string(k.tags,' ') ILIKE '%' || i.query || '%')
    ORDER BY rank DESC,k.knowledge_key
    LIMIT (SELECT result_limit FROM parsed)
  )
  SELECT coalesce(jsonb_agg(
    (to_jsonb(r) - 'rank') || jsonb_build_object('sources',(
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'source_key',s.source_key,'authority',s.authority,'title',s.title,
        'document_code',s.document_code,'edition',s.edition,'url',s.source_url,
        'verified_on',s.verified_on
      ) ORDER BY s.source_key),'[]'::jsonb)
      FROM public.agent_technical_knowledge_sources l
      JOIN public.agent_knowledge_sources s ON s.source_key=l.source_key AND s.active
      WHERE l.knowledge_key=r.knowledge_key
    )) ORDER BY r.rank DESC,r.knowledge_key
  ),'[]'::jsonb)
  FROM ranked r;
$$;

REVOKE ALL ON FUNCTION public.search_agent_technical_knowledge(text,text[],integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_agent_technical_knowledge(text,text[],integer)
  TO service_role;
