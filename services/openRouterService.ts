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

            // FunctionsHttpError contém a resposta do servidor
            if (error.context && typeof error.context === 'object' && 'json' in error.context) {
                try {
                    const errorBody = await (error.context as Response).json();
                    throw new Error(errorBody.error || error.message);
                } catch (parseErr) {
                    // Se não conseguir parsear, usa a mensagem original
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
