import { supabase } from './supabaseClient';
import { generateAIResponse } from './aiService';

export interface RDOAnalysis {
    classification: 'atividade produtiva' | 'parada' | 'falha' | 'clima' | 'risco operacional';
    occurrence_type: string;
    severity: 'baixa' | 'média' | 'alta' | 'crítica';
    impacted_machines: Array<{
        id: string;
        hours_added: number;
        risk_increase: number;
        notes: string;
    }>;
    tags: string[];
    hidden_costs: number;
    future_impact: string;
    preventive_alert: string;
}

export const intelligenceService = {
    async analyzeRDO(rdoId: string) {
        try {
            // 1. Fetch RDO data
            const { data: rdo, error: rdoError } = await supabase
                .from('rdos')
                .select('*')
                .eq('id', rdoId)
                .single();

            if (rdoError || !rdo) throw new Error('RDO não encontrado');

            // 2. Prepare prompt for AI
            const prompt = `
                Analise o seguinte Relatório Diário de Obra (RDO) e extraia informações estruturadas.
                
                RDO:
                Atividades: ${rdo.activities}
                Ocorrências: ${rdo.occurrences || 'Nenhuma'}
                Máquinas: ${JSON.stringify(rdo.machines || [])}
                Clima: ${rdo.weather || 'Não informado'}

                Retorne APENAS um JSON no seguinte formato:
                {
                    "classification": "atividade produtiva" | "parada" | "falha" | "clima" | "risco operacional",
                    "occurrence_type": "string",
                    "severity": "baixa" | "média" | "alta" | "crítica",
                    "impacted_machines": [
                        { "id": "uuid da máquina", "hours_added": número, "risk_increase": número, "notes": "string" }
                    ],
                    "tags": ["tag1", "tag2"],
                    "hidden_costs": número (estimativa em R$),
                    "future_impact": "string",
                    "preventive_alert": "string"
                }

                Regras:
                - Use as máquinas listadas no RDO: ${JSON.stringify(rdo.machines || [])}.
                - Se não houver máquinas impactadas, retorne array vazio.
                - Seja realista na severidade e riscos.
            `;

            const aiResponse = await generateAIResponse(prompt, "Você é um especialista em análise de obras e frota pesada.");

            // Extract JSON from AI response (handle potential markdown formatting)
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('Resposta da IA não contém JSON válido');

            const analysis: RDOAnalysis = JSON.parse(jsonMatch[0]);

            // 3. Save Analysis
            await supabase.from('rdo_ai_analysis').insert({
                rdo_id: rdoId,
                classification: analysis.classification,
                occurrence_type: analysis.occurrence_type,
                severity: analysis.severity,
                impacted_machines: analysis.impacted_machines,
                hidden_costs: analysis.hidden_costs,
                future_impact: analysis.future_impact,
                preventive_alert: analysis.preventive_alert
            });

            // 4. Save Tags
            if (analysis.tags && analysis.tags.length > 0) {
                const tagsToInsert = analysis.tags.map(tag => ({ rdo_id: rdoId, tag }));
                await supabase.from('rdo_tags').insert(tagsToInsert);
            }

            // 5. Process Machine Impacts
            for (const impact of analysis.impacted_machines) {
                await supabase.from('machine_impact').insert({
                    machine_id: impact.id,
                    rdo_id: rdoId,
                    hours_added: impact.hours_added,
                    risk_increase: impact.risk_increase,
                    notes: impact.notes
                });

                // Update machine health and hours
                await this.updateMachineHealth(impact.id, impact.hours_added, impact.risk_increase, 'RDO Analysis');
            }

            // 6. Generate Insight if severity is high
            if (analysis.severity === 'alta' || analysis.severity === 'crítica') {
                await supabase.from('insights').insert({
                    project_id: rdo.project_id,
                    type: 'ALERTA_OPERACIONAL',
                    content: `Alerta Crítico no RDO de ${rdo.date}: ${analysis.preventive_alert}`,
                    status: 'active'
                });
            }

            return analysis;
        } catch (error) {
            console.error('Erro na análise de inteligência do RDO:', error);
            throw error;
        }
    },

    async updateMachineHealth(machineId: string, hoursToAdd: number, riskIncrease: number, source: string) {
        const { data: machine } = await supabase
            .from('machines')
            .select('*')
            .eq('id', machineId)
            .single();

        if (!machine) return;

        const newHours = (machine.hours || 0) + hoursToAdd;
        let newScore = (machine.health_score || 100) - riskIncrease;
        if (newScore < 0) newScore = 0;
        if (newScore > 100) newScore = 100;

        let status: 'normal' | 'atenção' | 'crítico' = 'normal';
        if (newScore < 40) status = 'crítico';
        else if (newScore < 75) status = 'atenção';

        await supabase.from('machines').update({
            hours: newHours,
            health_score: newScore,
            health_status: status,
            health_reason: `Atualizado via ${source}: +${hoursToAdd}h, +${riskIncrease}% risco.`,
            health_data_source: source
        }).eq('id', machineId);
    },

    async restoreMachineHealth(machineId: string, healthBoost: number, source: string) {
        const { data: machine } = await supabase
            .from('machines')
            .select('*')
            .eq('id', machineId)
            .single();

        if (!machine) return;

        let newScore = (machine.health_score || 0) + healthBoost;
        if (newScore > 100) newScore = 100;

        let status: 'normal' | 'atenção' | 'crítico' = 'normal';
        if (newScore < 40) status = 'crítico';
        else if (newScore < 75) status = 'atenção';

        await supabase.from('machines').update({
            health_score: newScore,
            health_status: status,
            health_reason: `Saúde restaurada via ${source}: +${healthBoost}% saúde.`,
            health_data_source: source,
            last_maintenance: new Date().toISOString().split('T')[0]
        }).eq('id', machineId);
    },

    async getDynamicChatContext(projectId?: string) {
        // Fetch company info
        const { data: company } = await supabase.from('company_info').select('*').limit(1).single();

        // Fetch fleet status
        const { data: machines } = await supabase.from('machines').select('*');
        const activeMachines = machines?.filter(m => m.status === 'active').length || 0;
        const maintenanceMachines = machines?.filter(m => m.status === 'maintenance').length || 0;

        // Fetch recent RDOs
        const { data: recentRDOs } = await supabase
            .from('rdos')
            .select('*, rdo_ai_analysis(*)')
            .order('date', { ascending: false })
            .limit(5);

        // Fetch financial summary (mock or real if transactions table exists)
        const { data: transactions } = await supabase.from('transactions').select('amount, type');
        const balance = transactions?.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0) || 0;

        // Fetch active insights
        const { data: activeInsights } = await supabase
            .from('insights')
            .select('*')
            .eq('status', 'active')
            .limit(3);

        // Fetch upcoming schedules
        const today = new Date().toISOString();
        const { data: upcomingSchedules } = await supabase
            .from('schedules')
            .select('*')
            .gte('start_time', today)
            .order('start_time', { ascending: true })
            .limit(5);

        return `
            Você é o assistente inteligente do TerraGes.
            
            Dados Reais do Sistema:
            - Empresa: ${company?.name || 'TerraGes Cliente'}
            - Frota: ${machines?.length || 0} totais (${activeMachines} ativas, ${maintenanceMachines} em manutenção)
            - Saldo Financeiro Atual: R$ ${balance.toLocaleString('pt-BR')}
            - Últimos RDOs: ${recentRDOs?.length || 0} registros recentes.
            - Alertas Ativos: ${activeInsights?.length || 0}
            - Próximos Agendamentos: ${upcomingSchedules?.length || 0} serviços planejados.
            
            Resumo dos Alertas:
            ${activeInsights?.map(i => `- ${i.content}`).join('\n') || 'Nenhum alerta crítico no momento.'}

            Próximos Agendamentos:
            ${upcomingSchedules?.map(s => `- ${s.title} (${s.type}) em ${new Date(s.start_time).toLocaleDateString('pt-BR')} às ${new Date(s.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`).join('\n') || 'Nenhum serviço agendado para os próximos dias.'}

            Regras de Comportamento:
            1. Nunca invente dados. Se não souber, diga que não tem acesso a essa informação específica.
            2. Sempre justifique alertas com base nos dados (ex: "A máquina X está com health score baixo devido ao último RDO").
            3. Nunca execute ações críticas (ex: deletar registros).
            4. Sugira melhorias operacionais com base nos insights.
            5. Use linguagem técnica de gestor de obra/frota, mas de forma clara.
            6. Seja CONCISO: Limite suas respostas a no máximo 3-4 parágrafos curtos. Vá direto ao ponto.
            7. FORMATAÇÃO: Cada parágrafo deve ter no máximo 150 caracteres. Se precisar escrever mais, quebre em múltiplos parágrafos curtos separados por linha em branco.
            8. AGENDAMENTO: Se o usuário quiser agendar algo, você DEVE sugerir a criação adicionando no FINAL da sua resposta (após o texto) um bloco JSON EXATAMENTE assim:
               [[CREATE_SCHEDULE:{"title": "...", "type": "excavation|transport|maintenance|other", "start_time": "ISO_DATE", "priority": "low|medium|high|urgent", "notes": "..."}]]
               Importante: Hoje é ${new Date().toLocaleDateString('pt-BR')}. Use datas no futuro.
        `;
    },

    async generateWeeklyReport() {
        // Fetch all data from the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: rdos } = await supabase.from('rdos').select('*, rdo_ai_analysis(*)').gte('date', sevenDaysAgo.toISOString());
        const { data: maintenances } = await supabase.from('maintenance_records').select('*').gte('date', sevenDaysAgo.toISOString());
        const { data: transactions } = await supabase.from('transactions').select('*').gte('created_at', sevenDaysAgo.toISOString());

        const prompt = `
            Gere um Resumo Executivo Semanal para o gestor da TerraGes.
            
            Dados da Semana:
            - RDOs: ${JSON.stringify(rdos)}
            - Manutenções: ${JSON.stringify(maintenances)}
            - Transações: ${JSON.stringify(transactions)}

            O relatório deve conter:
            1. Resumo operacional (produtividade vs paradas).
            2. Destaques financeiros (principais gastos e receitas).
            3. Alertas de frota (máquinas que precisam de atenção).
            4. Próximos passos sugeridos.

            Use linguagem executiva, markdown e seja direto.
        `;

        return await generateAIResponse(prompt, "Você é um consultor sênior de gestão de obras.");
    }
};
