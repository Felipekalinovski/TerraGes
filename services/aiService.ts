
import { callOpenRouter } from './openRouterService';

/**
 * Service for AI operations using OpenRouter (Llama 3.3/3.2)
 * Replaces the old Gemini service.
 */

export const generateAIResponse = async (prompt: string, context?: string) => {
    try {
        const messages = [
            ...(context ? [{ role: "system", content: context }] : []),
            { role: "user", content: prompt }
        ];

        const text = await callOpenRouter(messages, 'text');
        return text || "A IA não retornou conteúdo.";
    } catch (error: any) {
        console.error("❌ Falha na geração de resposta da IA:", error.message);
        return `Erro ao processar solicitação: ${error.message}`;
    }
};

export const generateReport = async (data: any, type: 'financial' | 'general' = 'general') => {
    try {
        console.log("📊 Gerando relatório via OpenRouter...");

        const systemInstruction = type === 'financial'
            ? "Atue como um CFO experiente. Gere um relatório executivo curto e direto sobre os dados financeiros fornecidos. Use português do Brasil."
            : "Analise os dados fornecidos e gere um insight estratégico curto e direto. Use português do Brasil.";

        const messages = [
            { role: "system", content: systemInstruction },
            { role: "user", content: `Dados:\n${JSON.stringify(data, null, 2)}` }
        ];

        const text = await callOpenRouter(messages, 'text');
        return text || "Erro ao gerar relatório.";
    } catch (error: any) {
        console.error("❌ Erro ao gerar relatório:", error);
        return "Erro ao gerar o relatório.";
    }
};

export const analyzeDocument = async (base64Image: string, mimeType: string) => {
    try {
        console.log("📷 Analisando documento via OpenRouter (Llama 3.2 Vision)...");

        const messages = [
            {
                role: "user",
                content: [
                    { type: "text", text: "Analise esta imagem de documento financeiro e extraia: tipo de documento, data, valor total e emissor. Responda de forma direta em português." },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${base64Image}`
                        }
                    }
                ]
            }
        ];

        const text = await callOpenRouter(messages, 'vision');
        return text || "Erro na análise.";
    } catch (error: any) {
        console.error("❌ Erro ao analisar documento:", error);
        return "Erro ao analisar documento.";
    }
};

export const analyzeReceipt = async (imageUrl: string) => {
    try {
        console.log("📷 Analisando recibo de serviço via OpenRouter...");

        const messages = [
            {
                role: "user",
                content: [
                    { type: "text", text: "Analise esta imagem de Ordem de Serviço ou Recibo. Extraia os dados em formato JSON estrito com as chaves: 'client' (nome do cliente), 'date' (formato YYYY-MM-DD), 'start_hour' (número), 'end_hour' (número), 'total_hours' (número), 'hourly_rate' (número, se houver). Se não encontrar algum dado, use null. NÃO explique nada, apenas retorne o JSON." },
                    {
                        type: "image_url",
                        image_url: {
                            url: imageUrl
                        }
                    }
                ]
            }
        ];

        const text = await callOpenRouter(messages, 'vision');

        // Tenta limpar o markdown json se houver
        const currText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(currText);
    } catch (error: any) {
        console.error("❌ Erro ao analisar recibo:", error);
        return null;
    }
};
