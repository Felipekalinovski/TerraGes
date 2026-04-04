import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
    messages: Array<{ role: string; content: string | Array<any> }>;
    type?: "text" | "vision";
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const apiKey = Deno.env.get("OPENROUTER_API_KEY");
        if (!apiKey) {
            console.error("OPENROUTER_API_KEY not found in secrets");
            return new Response(
                JSON.stringify({ error: "AI service not configured on server" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const body: RequestBody = await req.json();
        const { messages, type = "text" } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(
                JSON.stringify({ error: "Messages array is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Select model based on type
        const model = type === "vision"
            ? (Deno.env.get("AI_MODEL_VISION") || "anthropic/claude-3-haiku:free")
            : (Deno.env.get("AI_MODEL_TEXT") || "anthropic/claude-3-haiku:free");

        console.log(`Proxying to OpenRouter | Model: ${model} | Messages: ${messages.length}`);

        const openRouterResponse = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://terrages.app",
                "X-Title": "TerraGes",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ model, messages }),
        });

        if (!openRouterResponse.ok) {
            const errorData = await openRouterResponse.json().catch(() => ({}));
            console.error("OpenRouter API error:", JSON.stringify(errorData));

            const statusMessages: Record<number, string> = {
                401: "Chave de API inválida ou não autorizada.",
                402: "Créditos insuficientes na OpenRouter.",
                429: "Limite de requisições excedido. Tente novamente em instantes.",
            };

            const message = statusMessages[openRouterResponse.status]
                || errorData?.error?.message
                || `Erro OpenRouter: ${openRouterResponse.status}`;

            return new Response(
                JSON.stringify({ error: message }),
                { status: openRouterResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const data = await openRouterResponse.json();

        if (!data.choices || data.choices.length === 0) {
            return new Response(
                JSON.stringify({ error: "A API retornou uma resposta vazia." }),
                { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const content = data.choices[0]?.message?.content || "";

        return new Response(
            JSON.stringify({ content }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Edge Function error:", error);
        return new Response(
            JSON.stringify({ error: "Erro interno no servidor de IA." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
