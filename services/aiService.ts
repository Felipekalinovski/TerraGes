import { callOpenRouter } from './openRouterService';

/**
 * TerraGes AI Service
 * ──────────────────────────────────────────────────────────
 * Centraliza todas as chamadas de IA via OpenRouter (Llama 3.3 / 3.2 Vision).
 * A chave de API fica armazenada como secret na Supabase Edge Function — nunca
 * exposta no frontend.
 *
 * Melhorias v2:
 *  - Retry com backoff exponencial para erros de rate limit (429)
 *  - Timeout configurável por chamada
 *  - Mensagens de erro amigáveis em pt-BR
 *  - Funções tipadas e documentadas
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiTextModel = 'text';
export type AiVisionModel = 'vision';

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

// ─── Internal retry helper ────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 2000 }: RetryOptions = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      const isRateLimit =
        err?.message?.includes('429') ||
        err?.message?.toLowerCase().includes('rate') ||
        err?.message?.toLowerCase().includes('limite') ||
        err?.message?.toLowerCase().includes('too many');

      // Só faz retry em rate limit ou erros de rede
      const shouldRetry = isRateLimit || err?.message?.includes('network');

      console.warn(
        `⚠️ Tentativa ${attempt}/${maxAttempts} falhou${shouldRetry ? ' (retry em breve)' : ''}:`,
        err?.message,
      );

      if (!shouldRetry || attempt === maxAttempts) break;

      // Backoff exponencial: 2s, 4s, 8s…
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(res => setTimeout(res, delay));
    }
  }

  throw lastError;
}

function friendlyError(err: any): string {
  const msg: string = err?.message ?? '';

  if (msg.includes('429') || msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limite')) {
    return 'Limite de requisições da IA atingido. Aguarde cerca de 30 segundos e tente novamente.';
  }
  if (msg.includes('401') || msg.toLowerCase().includes('autoriza')) {
    return 'Chave de API inválida. Verifique as configurações do servidor.';
  }
  if (msg.includes('402') || msg.toLowerCase().includes('crédito')) {
    return 'Créditos insuficientes na OpenRouter. Adicione créditos para continuar.';
  }
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
    return 'Sem conexão com o servidor de IA. Verifique sua internet.';
  }

  return `Erro ao processar solicitação: ${msg || 'desconhecido'}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Gera uma resposta de texto livre para um prompt qualquer.
 * Útil para o chat e para análises avulsas.
 */
export const generateAIResponse = async (
  prompt: string,
  systemContext?: string,
  retryOptions?: RetryOptions,
): Promise<string> => {
  try {
    const messages = [
      ...(systemContext ? [{ role: 'system', content: systemContext }] : []),
      { role: 'user', content: prompt },
    ];

    const text = await withRetry(
      () => callOpenRouter(messages, 'text'),
      retryOptions,
    );

    return text || 'A IA não retornou conteúdo.';
  } catch (error: any) {
    console.error('❌ generateAIResponse falhou:', error?.message);
    throw new Error(friendlyError(error));
  }
};

/**
 * Gera um relatório executivo ou insight estratégico com base nos dados do dashboard.
 *
 * ⚠️  NÃO chame esta função automaticamente no mount do componente —
 *     isso causa erros de rate limit nos modelos gratuitos da OpenRouter.
 *     Dispare apenas mediante ação explícita do usuário (botão "Analisar").
 */
export const generateReport = async (
  data: Record<string, any>,
  type: 'financial' | 'general' = 'general',
  retryOptions?: RetryOptions,
): Promise<string> => {
  console.log('📊 Gerando relatório via OpenRouter...');

  const systemInstruction =
    type === 'financial'
      ? [
          'Você é um CFO experiente especializado no setor de terraplanagem e construção pesada no Brasil.',
          'Gere um relatório executivo curto (máximo 3 parágrafos) e direto sobre os dados financeiros.',
          'Destaque pontos de atenção, tendências e uma recomendação prática.',
          'Use português do Brasil. Seja objetivo e acionável.',
        ].join(' ')
      : [
          'Você é um consultor estratégico especializado no setor de máquinas pesadas, terraplanagem e obras no Brasil.',
          'Analise os dados operacionais e gere um insight estratégico curto (máximo 2 parágrafos).',
          'Foque em riscos operacionais, eficiência de frota e oportunidades de redução de custo.',
          'Use português do Brasil. Seja direto e prático.',
        ].join(' ');

  try {
    const messages = [
      { role: 'system', content: systemInstruction },
      {
        role: 'user',
        content: `Dados operacionais atuais:\n${JSON.stringify(data, null, 2)}`,
      },
    ];

    const text = await withRetry(
      () => callOpenRouter(messages, 'text'),
      { maxAttempts: 3, baseDelayMs: 2000, ...retryOptions },
    );

    return text || 'Não foi possível gerar o relatório.';
  } catch (error: any) {
    console.error('❌ generateReport falhou:', error?.message);
    throw new Error(friendlyError(error));
  }
};

/**
 * Analisa uma imagem de documento financeiro (nota fiscal, recibo, etc.)
 * e extrai tipo, data, valor total e emissor.
 */
export const analyzeDocument = async (
  base64Image: string,
  mimeType: string,
  retryOptions?: RetryOptions,
): Promise<string> => {
  console.log('📷 Analisando documento via OpenRouter Vision...');

  try {
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analise esta imagem de documento financeiro e extraia: tipo de documento, data, valor total e emissor. Responda de forma direta em português do Brasil.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
        ],
      },
    ];

    const text = await withRetry(
      () => callOpenRouter(messages, 'vision'),
      retryOptions,
    );

    return text || 'Erro na análise do documento.';
  } catch (error: any) {
    console.error('❌ analyzeDocument falhou:', error?.message);
    throw new Error(friendlyError(error));
  }
};

/**
 * Analisa uma imagem de Ordem de Serviço ou recibo e retorna dados estruturados em JSON.
 * Retorna null em caso de falha no parse do JSON da IA.
 */
export const analyzeReceipt = async (
  imageUrl: string,
  retryOptions?: RetryOptions,
): Promise<{
  client: string | null;
  date: string | null;
  start_hour: number | null;
  end_hour: number | null;
  total_hours: number | null;
  hourly_rate: number | null;
} | null> => {
  console.log('📷 Analisando recibo de serviço via OpenRouter Vision...');

  try {
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Analise esta imagem de Ordem de Serviço ou Recibo.',
              'Extraia os dados em formato JSON estrito com as chaves:',
              '"client" (nome do cliente),',
              '"date" (formato YYYY-MM-DD),',
              '"start_hour" (número),',
              '"end_hour" (número),',
              '"total_hours" (número),',
              '"hourly_rate" (número, se houver).',
              'Se não encontrar algum dado, use null.',
              'NÃO explique nada, apenas retorne o JSON puro.',
            ].join(' '),
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
        ],
      },
    ];

    const raw = await withRetry(
      () => callOpenRouter(messages, 'vision'),
      retryOptions,
    );

    // Limpa markdown se a IA devolver ```json ... ```
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    return JSON.parse(cleaned);
  } catch (error: any) {
    console.error('❌ analyzeReceipt falhou:', error?.message);
    return null;
  }
};
