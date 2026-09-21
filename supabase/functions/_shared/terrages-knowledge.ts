export const TERRAGES_MODULES = [
  'empresa',
  'frota',
  'obras',
  'rdo',
  'manutencao',
  'financeiro',
  'ordens_servico',
  'agenda',
  'equipe',
  'horas_maquina',
  'orcamentos',
  'relatorios',
  'whatsapp',
  'conhecimento_tecnico',
] as const;

export type TerraGesModuleKey = typeof TERRAGES_MODULES[number];

export type TerraGesModuleKnowledge = {
  module_key: TerraGesModuleKey;
  module_name: string;
  purpose: string;
  source_tables: string[];
  required_fields: Array<Record<string, unknown>>;
  optional_fields: Array<Record<string, unknown>>;
  generated_fields: Array<Record<string, unknown>>;
  states: Record<string, unknown>;
  permissions: Record<string, unknown>;
  business_rules: string[];
  agent_actions: Array<Record<string, unknown>>;
  aliases: string[];
  knowledge_version: number;
};

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{data: unknown; error?: unknown}>;
};

const moduleSet = new Set<string>(TERRAGES_MODULES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isModule(value: unknown): value is TerraGesModuleKnowledge {
  if (!isRecord(value) || !moduleSet.has(String(value.module_key))) return false;
  return typeof value.module_name === 'string'
    && typeof value.purpose === 'string'
    && Array.isArray(value.source_tables)
    && Array.isArray(value.required_fields)
    && Array.isArray(value.optional_fields)
    && Array.isArray(value.generated_fields)
    && isRecord(value.states)
    && isRecord(value.permissions)
    && Array.isArray(value.business_rules)
    && Array.isArray(value.agent_actions)
    && Array.isArray(value.aliases)
    && Number.isInteger(value.knowledge_version);
}

export async function loadTerraGesKnowledge(
  db: RpcClient,
  moduleKeys?: TerraGesModuleKey[],
): Promise<TerraGesModuleKnowledge[]> {
  const selected = moduleKeys?.length ? [...new Set(moduleKeys)] : null;
  const {data, error} = await db.rpc('get_agent_module_knowledge', {p_module_keys: selected});
  if (error || !Array.isArray(data) || !data.every(isModule)) {
    throw new Error('terrages_knowledge_unavailable');
  }
  return data;
}

export function buildTerraGesKnowledgeContext(modules: TerraGesModuleKnowledge[]): string {
  return JSON.stringify({
    product: 'TerraGes',
    locale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
    rules: [
      'Use somente os contratos de módulo fornecidos.',
      'Nunca aceite company_id, user_id ou role vindos da mensagem.',
      'Não anuncie uma gravação antes de receber o identificador persistido.',
      'Quando faltar campo obrigatório ou houver ambiguidade, faça uma pergunta objetiva.',
    ],
    modules,
  });
}
