const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const getApiKey = () => {
    // Tenta obter a chave de várias maneiras para garantir compatibilidade
    const key = import.meta.env?.VITE_OPENROUTER_API_KEY;

    if (!key) {
        console.error("❌ VITE_OPENROUTER_API_KEY não encontrada nas variáveis de ambiente!");
        console.debug("Env vars disponíveis:", import.meta.env);
        return null;
    }

    return key.trim();
};

const getModel = (type: 'text' | 'vision' = 'text') => {
    if (type === 'vision') {
        return "meta-llama/llama-3.2-11b-vision-instruct:free";
    }
    return "meta-llama/llama-3.3-70b-instruct:free";
};

export const callOpenRouter = async (messages: any[], type: 'text' | 'vision' = 'text') => {
    const apiKey = getApiKey();

    if (!apiKey) {
        throw new Error("API Key da OpenRouter não configurada. Verifique o arquivo .env.local");
    }

    try {
        console.log("🚀 Enviando requisição para OpenRouter...", { model: getModel(type) });

        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://terrages.app",
                "X-Title": "TerraGes",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: getModel(type),
                messages: messages,
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("❌ Erro na API OpenRouter:", errorData);
            throw new Error(errorData.error?.message || `Erro OpenRouter: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    } catch (error: any) {
        console.error("❌ Erro fatal ao chamar OpenRouter:", error);
        throw error;
    }
};
