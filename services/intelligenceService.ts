import { supabase } from './supabaseClient';
import { generateAIResponse } from './geminiService';

export interface RDOAnalysis {
    classification: 'atividade produtiva' | 'parada' | 'falha' | 'clima' | 'risco operacional';
    occurrence_type: string;
    severity: 'baixa' | 'média' | 'alta' | 'crítica';
    impacted_machines: Array<{ id: string; hours_added: number; risk_increase: number; notes: string; }>;
    tags: string[];
    hidden_costs: number;
    future_impact: string;
    preventive_alert: string;
}

export const intelligenceService = {
    async analyzeRDO(rdoId: string) {
        try {
            const { data: rdo, error: rdoError } = await supabase.from('rdos').select('*').eq('id', rdoId).single();
            if (rdoError || !rdo) throw new Error('RDO não encontrado');
            const prompt = `Analise o seguinte Relatório Diário de Obra (RDO) e extraia informações estruturadas. RDO: Atividades: ${rdo.activities} Ocorrências: ${rdo.occurrences || 'Nenhuma'} Máquinas: ${JSON.stringify(rdo.machines || [])} Clima: ${rdo.weather || 'Não informado'} Retorne APENAS um JSON no seguinte formato: { "classification": "atividade produtiva" | "parada" | "falha" | "clima" | "risco operacional", "occurrence_type": "string", "severity": "baixa" | "média" | "alta" | "crítica", "impacted_machines": [ { "id": "uuid da máquina", "hours_added": número, "risk_increase": número, "notes": "string" } ], "tags": ["tag1", "tag2"], "hidden_costs": número (estimativa em R$), "future_impact": "string", "preventive_alert": "string" }`;
            const aiResponse = await generateAIResponse(prompt, "Você é um especialista em análise de obras e frota pesada.");
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('Resposta da IA não contém JSON válido');
            const analysis: RDOAnalysis = JSON.parse(jsonMatch[0]);
            await supabase.from('rdo_ai_analysis').insert({ rdo_id: rdoId, classification: analysis.classification, occurrence_type: analysis.occurrence_type, severity: analysis.severity, impacted_machines: analysis.impacted_machines, hidden_costs: analysis.hidden_costs, future_impact: analysis.future_impact, preventive_alert: analysis.preventive_alert });
            if (analysis.tags && analysis.tags.length > 0) {
                const tagsToInsert = analysis.tags.map(tag => ({ rdo_id: rdoId, tag }));
                await supabase.from('rdo_tags').insert(tagsToInsert);
            }
            for (const impact of analysis.impacted_machines) {
                await supabase.from('machine_impact').insert({ machine_id: impact.id, rdo_id: rdoId, hours_added: impact.hours_added, risk_increase: impact.risk_increase, notes: impact.notes });
                await this.updateMachineHealth(impact.id, impact.hours_added, impact.risk_increase, 'RDO Analysis');
            }
            if (analysis.severity === 'alta' || analysis.severity === 'crítica') {
                await supabase.from('insights').insert({ project_id: rdo.project_id, type: 'ALERTA_OPERACIONAL', content: `Alerta Crítico no RDO de ${rdo.date}: ${analysis.preventive_alert}`, status: 'active' });
            }
            return analysis;
        } catch (error) {
            console.error('Erro na análise de inteligência do RDO:', error);
            throw error;
        }
    },

    async updateMachineHealth(machineId: string, hoursToAdd: number, riskIncrease: number, source: string) {
        const { data: machine } = await supabase.from('machines').select('*').eq('id', machineId).single();
        if (!machine) return;
        const newHours = (machine.hours || 0) + hoursToAdd;
        let newScore = (machine.health_score || 100) - riskIncrease;
        newScore = Math.max(0, Math.min(100, newScore));
        let status: 'normal' | 'atenção' | 'crítico' = 'normal';
        if (newScore < 40) status = 'crítico';
        else if (newScore < 75) status = 'atenção';
        await supabase.from('machines').update({ hours: newHours, health_score: newScore, health_status: status, health_reason: `Atualizado via ${source}: +${hoursToAdd}h, +${riskIncrease}% risco.`, health_data_source: source }).eq('id', machineId);
    },

    async restoreMachineHealth(machineId: string, healthBoost: number, source: string) {
        const { data: machine } = await supabase.from('machines').select('*').eq('id', machineId).single();
        if (!machine) return;
        let newScore = (machine.health_score || 0) + healthBoost;
        newScore = Math.min(100, newScore);
        let status: 'normal' | 'atenção' | 'crítico' = 'normal';
        if (newScore < 40) status = 'crítico';
        else if (newScore < 75) status = 'atenção';
        await supabase.from('machines').update({ health_score: newScore, health_status: status, health_reason: `Saúde restaurada via ${source}: +${healthBoost}% saúde.`, health_data_source: source, last_maintenance: new Date().toISOString().split('T')[0] }).eq('id', machineId);
    },

    async getDynamicChatContext(projectId?: string) {
        const { data: company } = await supabase.from('company_info').select('*').limit(1).single();
        const { data: machines } = await supabase.from('machines').select('*');
        const activeMachines = machines?.filter(m => m.status === 'active').length || 0;
        const maintenanceMachines = machines?.filter(m => m.status === 'maintenance').length || 0;
        const { data: recentRDOs } = await supabase.from('rdos').select('*, rdo_ai_analysis(*)').order('date', { ascending: false }).limit(5);
        const { data: transactions } = await supabase.from('transactions').select('amount, type');
        const balance = transactions?.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0) || 0;
        const { data: activeInsights } = await supabase.from('insights').select('*').eq('status', 'active').limit(3);
        return `Assistente TerraGes. Dados: ${company?.name || 'TerraGes'}, Frota: ${machines?.length || 0} (${activeMachines} ativas), Saldo: R$ ${balance.toLocaleString('pt-BR')}, Alertas: ${activeInsights?.length || 0}. Regras: Não invente dados, seja conciso, formatting: Parágrafos curtos.`;
    },

    async generateWeeklyReport() {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: rdos } = await supabase.from('rdos').select('*, rdo_ai_analysis(*)').gte('date', sevenDaysAgo.toISOString());
        const { data: maintenances } = await supabase.from('maintenance_records').select('*').gte('date', sevenDaysAgo.toISOString());
        const { data: transactions } = await supabase.from('transactions').select('*').gte('created_at', sevenDaysAgo.toISOString());
        const prompt = `Gere um Resumo Executivo Semanal. Dados: RDOs: ${JSON.stringify(rdos)} Manutenções: ${JSON.stringify(maintenances)} Transações: ${JSON.stringify(transactions)}`;
        return await generateAIResponse(prompt, "Você é um consultor sênior de gestão de obras.");
    }
};
