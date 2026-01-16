const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const getApiKey = () => {
    return (import.meta.env?.VITE_OPENROUTER_API_KEY) || null;
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
        throw new Error("OpenRouter API Key not configured. Please add VITE_OPENROUTER_API_KEY to your .env.local file.");
    }

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://terrages.app", // Optional
                "X-Title": "TerraGes", // Optional
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: getModel(type),
                messages: messages,
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Error calling OpenRouter API");
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    } catch (error: any) {
        console.error("OpenRouter Error:", error);
        throw error;
    }
};
