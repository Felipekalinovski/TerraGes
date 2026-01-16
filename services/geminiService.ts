import { callOpenRouter } from './openRouterService';

/**
 * Esse serviço foi refatorado para usar OpenRouter (Llama 3.3 70B)
 * Mantemos o nome original para evitar quebra de compatibilidade no app.
 */

export const generateAIResponse = async (prompt: string, context?: string) => {
    try {
        console.log("🔍 Conectando ao OpenRouter (Llama 3.3 70B)...");

        const messages = [
            ...(context ? [{ role: "system", content: context }] : []),
            { role: "user", content: prompt }
        ];

        const text = await callOpenRouter(messages, 'text');
        console.log("✅ Resposta recebida do OpenRouter!");
        return text || "Sem resposta da IA.";
    } catch (error: any) {
        console.error("❌ Erro no OpenRouter:", error);
        return `Erro: ${error.message}`;
    }
};

export const generateReport = async (data: any, type: 'financial' | 'general' = 'general') => {
    try {
        console.log("📊 Gerando relatório via OpenRouter...");

        const systemInstruction = type === 'financial'
            ? "Atue como um CFO experiente. Gere um relatório executivo curto e direto sobre os dados financeiros fornecidos."
            : "Analise os dados fornecidos e gere um insight estratégico curto e direto.";

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
                    { type: "text", text: "Analise esta imagem de documento financeiro e extraia: tipo de documento, data, valor total e emissor. Responda de forma direta." },
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
