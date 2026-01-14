import { GoogleGenerativeAI } from "@google/generative-ai";

// API Key carregada dinamicamente
const getApiKey = () => {
    const key = (import.meta.env?.VITE_GEMINI_API_KEY) ||
        (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : null) ||
        (import.meta.env?.GEMINI_API_KEY);

    if (key && !key.includes('sua_chave')) {
        return key;
    }
    return null;
};

// Inicializar o cliente Gemini
const getGenAI = () => {
    const apiKey = getApiKey();
    if (!apiKey) return null;
    return new GoogleGenerativeAI(apiKey);
};

export const generateAIResponse = async (prompt: string, context?: string) => {
    const genAI = getGenAI();
    if (!genAI) return "Erro: API Key não configurada.";

    try {
        console.log("🔍 Tentando conectar ao Gemini...");

        // Usar gemini-2.5-flash que é o modelo mais recente e rápido disponível
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemMessage = context ? `Contexto: ${context}\n\n` : "";
        const fullPrompt = `${systemMessage}Usuário: ${prompt}`;

        console.log("Modelo: gemini-1.5-flash");

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        console.log("✅ Resposta recebida com sucesso!");
        return text || "Sem resposta da IA.";
    } catch (error: any) {
        console.error("❌ Erro ao gerar resposta:", error);
        return `Erro: ${error.message}`;
    }
};

export const generateReport = async (data: any, type: 'financial' | 'general' = 'general') => {
    const genAI = getGenAI();
    if (!genAI) return "API Key ausente.";

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemInstruction = type === 'financial'
            ? "Atue como um CFO experiente. Gere um relatório executivo curto."
            : "Analise os dados e gere um insight curto e direto.";

        const prompt = `${systemInstruction}\n\nDados:\n${JSON.stringify(data, null, 2)}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text() || "Erro ao gerar relatório.";
    } catch (error: any) {
        console.error("❌ Erro ao gerar relatório:", error);
        return "Erro ao gerar o relatório.";
    }
};

export const analyzeDocument = async (base64Image: string, mimeType: string) => {
    const genAI = getGenAI();
    if (!genAI) return "API Key ausente.";

    try {
        // Para análise de imagens, usar gemini-1.5-flash que suporta multimodal
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Analise esta imagem de documento financeiro e extraia: tipo, data, valor e emissor.";

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        return response.text() || "Erro na análise.";
    } catch (error: any) {
        console.error("❌ Erro ao analisar documento:", error);
        return "Erro ao analisar documento.";
    }
};
