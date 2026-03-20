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

            // Tenta obter a mensagem de erro estruturada da função
            if (error.status) {
                try {
                    // O erro de função do Supabase pode conter a resposta direta se for capturada corretamente
                    const response = (error as any).context;
                    if (response && typeof response.json === 'function') {
                        const errorBody = await response.json();
                        throw new Error(errorBody.error || error.message);
                    }
                } catch (parseErr) {
                    console.warn("⚠️ Não foi possível processar o corpo do erro da função:", parseErr);
                }
            }

            throw new Error(error.message || "Erro ao chamar o serviço de IA.");
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
