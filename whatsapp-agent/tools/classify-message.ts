import { defineTool } from 'wa-agent/tools/types';
import { z } from 'zod';

export default defineTool({
  description: 'Classifica mensagens do usuário em categorias para roteamento',
  inputSchema: z.object({
    text: z.string().describe('Texto da mensagem a ser classificada'),
    userRole: z.string().describe('Função do usuário (operator, manager, admin)'),
  }),
  execute: async ({ text, userRole }, ctx) => {
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

  Responda APENAS com JSON puro sem markdown:
  {"category":"categoria","confidence":0.9,"context":{}}
  `;

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
    const OPENROUTER_MODEL = process.env.AI_MODEL_TEXT || 'openrouter/free';

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
        temperature: 0.1,
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const d = await res.json();
    const result = d.choices?.[0]?.message?.content || "";
    const stripped = result.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(stripped);
  },
});