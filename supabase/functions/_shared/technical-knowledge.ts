export type TechnicalRisk = 'general' | 'caution' | 'critical';

export type TechnicalSource = {
  source_key: string;
  authority: string;
  title: string;
  document_code?: string | null;
  edition?: string | null;
  url: string;
  verified_on: string;
};

export type TechnicalKnowledge = {
  knowledge_key: string;
  domain: string;
  topic: string;
  title: string;
  summary: string;
  guidance: string[];
  applicability: Record<string, unknown>;
  risk_level: TechnicalRisk;
  requires_model_manual: boolean;
  requires_professional: boolean;
  tags: string[];
  revision: number;
  sources: TechnicalSource[];
};

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{data: unknown; error?: unknown}>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSource(value: unknown): value is TechnicalSource {
  return isRecord(value)
    && typeof value.source_key === 'string'
    && typeof value.authority === 'string'
    && typeof value.title === 'string'
    && typeof value.url === 'string'
    && value.url.startsWith('https://')
    && typeof value.verified_on === 'string';
}

function isKnowledge(value: unknown): value is TechnicalKnowledge {
  if (!isRecord(value)) return false;
  return typeof value.knowledge_key === 'string'
    && typeof value.domain === 'string'
    && typeof value.topic === 'string'
    && typeof value.title === 'string'
    && typeof value.summary === 'string'
    && Array.isArray(value.guidance)
    && value.guidance.every(item => typeof item === 'string')
    && isRecord(value.applicability)
    && ['general','caution','critical'].includes(String(value.risk_level))
    && typeof value.requires_model_manual === 'boolean'
    && typeof value.requires_professional === 'boolean'
    && Array.isArray(value.tags)
    && Array.isArray(value.sources)
    && value.sources.length > 0
    && value.sources.every(isSource);
}

export async function searchTechnicalKnowledge(
  db: RpcClient,
  query: string,
  domains?: string[],
  limit = 8,
): Promise<TechnicalKnowledge[]> {
  const normalized = query.trim().slice(0, 500);
  const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? Math.trunc(limit) : 8, 20));
  const {data, error} = await db.rpc('search_agent_technical_knowledge', {
    p_query: normalized || null,
    p_domains: domains?.length ? [...new Set(domains)] : null,
    p_limit: safeLimit,
  });
  if (error || !Array.isArray(data) || !data.every(isKnowledge)) {
    throw new Error('technical_knowledge_unavailable');
  }
  return data;
}

export function buildTechnicalKnowledgeContext(entries: TechnicalKnowledge[]): string {
  return JSON.stringify({
    instruction: 'Use as fontes e os limites de aplicação. Não transforme orientação geral em especificação de modelo.',
    response_policy: {
      critical: 'Priorize parada segura, isolamento da área e avaliação do responsável aplicável.',
      model_manual: 'Peça fabricante, modelo, número de série e manual aplicável antes de informar valores ou procedimentos específicos.',
      professional: 'Identifique a decisão que depende de engenheiro, técnico, operador autorizado ou contador.',
      citation: 'Informe título, órgão e URL das fontes usadas.',
    },
    entries,
  });
}
