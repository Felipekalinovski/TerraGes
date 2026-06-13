import { defineTool } from 'wa-agent/tools/types';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || "";
const EVOLUTION_API_VERSION = process.env.EVOLUTION_API_VERSION || "v2";

function evoUrl(path: string): string {
  const cleanPath = path.replace(/^\//, "");
  if (EVOLUTION_API_VERSION === "v2" && EVOLUTION_INSTANCE) {
    return `${EVOLUTION_API_URL}/${cleanPath}/${EVOLUTION_INSTANCE}`;
  }
  return `${EVOLUTION_API_URL}/${cleanPath}`;
}

async function sendMessage(to: string, text: string): Promise<void> {
  const number = to.includes('@s.whatsapp.net') ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;
  const url = evoUrl("message/sendText");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({ number, text, delay: -1 }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar: ${res.status}`);
}

export default defineTool({
  description: 'Encaminha mensagens para agentes especializados e envia resposta via Evolution API',
  inputSchema: z.object({
    message: z.string(),
    phone: z.string(),
    userRole: z.string(),
    category: z.string(),
    confidence: z.number(),
    context: z.record(z.any()).optional(),
  }),
  execute: async ({ message, phone, userRole, category, confidence, context }, ctx) => {
    let responseText = "";

    switch (category) {
      case "fleet":
      case "machine_hours":
        if (userRole === "operator") {
          responseText = "Apenas gestores têm acesso a informações da frota.";
        } else {
          responseText = "Consultando dados da frota...";
        }
        break;
      case "rdo":
        responseText = "Entendi que você precisa de um RDO. Vou preparar.";
        break;
      case "finance":
        responseText = userRole === "admin" || userRole === "manager"
          ? "Consultando dados financeiros..."
          : "Apenas gestores têm acesso ao financeiro.";
        break;
      case "schedule":
        responseText = "Entendi que você quer agendar algo.";
        break;
      case "service_order":
        responseText = "Vou preparar a Ordem de Serviço.";
        break;
      case "historical_query":
        responseText = "Consultando dados históricos...";
        break;
      case "delete_record":
        responseText = userRole === "admin"
          ? "Qual registro deseja excluir?"
          : "Apenas administradores podem excluir registros.";
        break;
      default:
        responseText = `Entendi: "${message.slice(0, 100)}". Como posso ajudar?`;
    }

    try {
      await sendMessage(phone, responseText);
      return { success: true, responseText, action: "forwarded" };
    } catch (e) {
      console.error("[Forward] Erro Evolution:", e);
      return { success: false, error: (e as Error).message, responseText };
    }
  },
});