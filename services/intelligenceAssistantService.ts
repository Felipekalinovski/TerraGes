import { supabase } from './supabaseClient';
import { generateAIResponse } from './aiService';

export const intelligenceAssistantService = {
    /**
     * Virtual Tutor for maintenance best practices and system usage.
     */
    async askTutor(question: string) {
        const prompt = `
            Você é o Tutor de Suporte 24/7 do TerraGes, especialista em gestão de frotas e manutenção industrial.
            Responda à seguinte pergunta técnica ou de suporte:
            
            Pergunta: ${question}
            
            Regras de Resposta:
            1. Seja técnico, porém didático.
            2. Se a pergunta for sobre procedimentos de manutenção (ex: 'como trocar óleo da retroescavadeira'), cite normas gerais de segurança.
            3. Se for sobre o sistema TerraGes, oriente o usuário a procurar as abas correspondentes (Frota, Manutenção, RDO).
            4. Responda em Português do Brasil.
        `;

        return await generateAIResponse(prompt, "Assistente Tutor Especializado em Manutenção.");
    },

    /**
     * Smart SQL Generator (Natural Language to JSON data).
     * This simulates a safe query builder.
     */
    async generateReportData(description: string) {
        const prompt = `
            Transforme o seguinte pedido do usuário em uma descrição de busca de dados estruturada.
            
            Pedido: ${description}
            
            O sistema possui as seguintes entidades principais:
            - machines (id, name, type, status, health_score, hours)
            - maintenance_records (id, machine_id, date, type, cost)
            - rdos (id, date, project_id, status)
            - transactions (id, amount, type, date)
            
            Retorne APENAS um JSON com o plano de ação:
            {
                "entity": "machines" | "maintenance_records" | "rdos" | "transactions",
                "filters": { "field": "op", "value": "val" },
                "summary": "O que os dados representam",
                "ai_insight_request": "O que a IA deve analisar nessa lista"
            }
        `;

        const response = await generateAIResponse(prompt, "Analista de Dados do TerraGes.");
        
        let plan;
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            plan = JSON.parse(jsonMatch ? jsonMatch[0] : response);
        } catch (e) {
            console.error("Erro ao processar plano de relatório:", e);
            throw new Error("Não foi possível entender o pedido do relatório.");
        }

        // Execute dynamic query via Supabase (restricted for safety)
        const { data, error } = await supabase
            .from(plan.entity)
            .select('*')
            .limit(10); // Simple limit for demonstration

        if (error) throw error;

        // Generate AI Insight based on the fetched data and the original request
        const insightPrompt = `
            Analise estes dados de ${plan.entity} para responder a: "${description}"
            Dados: ${JSON.stringify(data)}
            Insight Desejado: ${plan.ai_insight_request}
            
            Resuma em 2 frases os principais pontos e tendências.
        `;

        const insight = await generateAIResponse(insightPrompt, "Consultor Estratégico TerraGes.");

        return {
            data,
            plan,
            insight
        };
    }
};
