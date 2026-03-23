import { supabase } from './supabaseClient';

/**
 * Proxy seguro para a OpenRouter API via Supabase Edge Function.
 * A API key fica armazenada como secret no servidor — nunca exposta no frontend.
 */
export const callOpenRouter = async (messages: any[], type: 'text' | 'vision' = 'text') => {
    try {
        console.log(`🚀 Chamando Edge Function ai-proxy... Tipo: ${type}`);

        const { data, error } = await supabase.functions.invoke('ai-proxy', {
            body: { messages, type },
        });

        if (error) {
            console.error("❌ Erro na Edge Function:", error);
            let errorMessage = error.message;
            const status = (error as any).status || error.name === 'FunctionsHttpError' ? 429 : null; // Fallback se não detectar status

            try {
                // Tenta buscar o contexto (Response) e extrair o JSON do erro
                const response = (error as any).context;
                if (response && typeof response.json === 'function') {
                    const errorBody = await response.json();
                    if (errorBody && (errorBody.error || errorBody.message)) {
                        errorMessage = errorBody.error || errorBody.message;
                    }
                }
            } catch (parseErr) {
                console.warn("⚠️ Não foi possível processar o corpo do erro da função:", parseErr);
            }

            // Dica de Rate Limit baseada na mensagem ou status
            if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests") || status === 429) {
                errorMessage = "Limite de requisições da IA atingido. Por favor, aguarde alguns instantes (30-60s) ou adicione créditos à sua conta OpenRouter para usar modelos pagos.";
            }

            throw new Error(errorMessage || "Erro ao chamar o serviço de IA.");
        }

        if (!data || !data.content) {
            throw new Error("A IA não retornou conteúdo.");
        }

        return data.content;
    } catch (error: any) {
        console.error("❌ Erro fatal ao chamar IA:", error);
        throw error;
    }
};
