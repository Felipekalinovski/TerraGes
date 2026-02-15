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

            // Extract JSON from AI response (handle markdown code blocks and extra text)
            let jsonString = aiResponse;

            // Remove markdown code blocks if present
            const codeBlockMatch = aiResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/) || aiResponse.match(/```\s*(\{[\s\S]*?\})\s*```/);
            if (codeBlockMatch) {
                jsonString = codeBlockMatch[1];
            } else {
                // Fallback: Try to find the first { ... } block
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonString = jsonMatch[0];
                }
            }

            let analysis: RDOAnalysis;
            try {
                analysis = JSON.parse(jsonString);
            } catch (e) {
                console.error("Erro ao fazer parse do JSON da IA:", e);
                throw new Error("Falha ao processar resposta da IA");
            }

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
        try {
            // Parallelize independent data fetches
            const [
                { data: company },
                { data: machines },
                { data: recentRDOs },
                { data: transactions },
                { data: activeInsights },
                { data: upcomingSchedules }
            ] = await Promise.all([
                // 1. Fetch company info
                supabase.from('company_info').select('name').limit(1).single(),

                // 2. Fetch fleet status
                supabase.from('machines').select('id, status'),

                // 3. Fetch recent RDOs
                supabase.from('rdos')
                    .select('date, activities, rdo_ai_analysis(severity)')
                    .order('date', { ascending: false })
                    .limit(5),

                // 4. Fetch financial summary
                supabase.from('transactions').select('amount, type'),

                // 5. Fetch active insights
                supabase.from('insights')
                    .select('content')
                    .eq('status', 'active')
                    .limit(3),

                // 6. Fetch upcoming schedules
                supabase.from('schedules')
                    .select('title, type, start_time')
                    .gte('start_time', new Date().toISOString())
                    .order('start_time', { ascending: true })
                    .limit(5)
            ]);

            // Process data locally
            const activeMachines = machines?.filter(m => m.status === 'active').length || 0;
            const maintenanceMachines = machines?.filter(m => m.status === 'maintenance').length || 0;
            const balance = transactions?.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0) || 0;

            return `
            Você é o assistente inteligente do TerraGes.
            
            Dados Reais do Sistema (Atualizado):
            - Empresa: ${company?.name || 'TerraGes Cliente'}
            - Frota: ${machines?.length || 0} máquinas (${activeMachines} ativas, ${maintenanceMachines} manutenção)
            - Saldo: R$ ${balance.toLocaleString('pt-BR')}
            - RDOs Recentes: ${recentRDOs?.length || 0}
            - Alertas: ${activeInsights?.length || 0}
            - Agenda: ${upcomingSchedules?.length || 0} futuros

            Alertas Ativos:
            ${activeInsights?.map(i => `- ${i.content}`).join('\n') || 'Nenhum alerta.'}

            Agenda Próxima:
            ${upcomingSchedules?.map(s => `- ${s.title} (${s.type}) em ${new Date(s.start_time).toLocaleDateString('pt-BR')}`).join('\n') || 'Nada agendado.'}

            Regras:
            1. Seja breve e direto. Respostas curtas (máx 2 parágrafos).
            2. Se for agendar, use JSON no final: [[CREATE_SCHEDULE:{"title":"...","type":"...","start_time":"ISO","priority":"...","notes":"..."}]]
            3. Hoje é ${new Date().toLocaleDateString('pt-BR')}.
            `;
        } catch (error) {
            console.error("Erro ao gerar contexto do chat:", error);
            return "Erro ao carregar contexto do sistema. Responda genericamente.";
        }
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
    },

    async analyzeServiceOrder(soId: string) {
        try {
            // 1. Fetch Service Order with Machine details
            const { data: so, error } = await supabase
                .from('service_orders')
                .select(`
                    *,
                    machine:machines(*)
                `)
                .eq('id', soId)
                .single();

            if (error || !so) throw new Error('Ordem de serviço não encontrada');
            if (so.status !== 'completed') return;

            const machine = so.machine;
            const currentHours = so.end_hour;

            // 2. Prepare Prompt for Predictive Analysis
            const prompt = `
                Analise a utilização da máquina e preveja a próxima manutenção.
                
                Máquina: ${machine.name} (${machine.type})
                Horímetro Atual: ${currentHours}h
                Última Manutenção: ${machine.last_maintenance || 'Não registrada'}
                
                Regras de Negócio:
                - Troca de óleo/filtros a cada 250h.
                - Manutenção preventiva pesada a cada 500h e 1000h.
                - Se faltar menos de 20h para um múltiplo de 250h, gere um alerta.
                
                Retorne APENAS um JSON:
                {
                    "needs_alert": boolean,
                    "message": "string (ex: 'Esta retroescavadeira precisa de troca de óleo em 10 horas')",
                    "severity": "baixa" | "média" | "alta",
                    "next_estimated_maintenance_hours": número,
                    "estimated_profitability": {
                        "gross_value": número,
                        "estimated_operational_cost": número,
                        "net_profit": número,
                        "margin_percent": número
                    }
                }
            `;

            const aiResponse = await generateAIResponse(prompt, "Você é um especialista em manutenção preditiva e análise financeira de frotas pesadas. Considere que o custo operacional médio (combustível, lubrificantes e reserva de manutenção) é de aproximadamente 45% do valor bruto.");

            // Extract JSON
            let jsonString = aiResponse;
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonString = jsonMatch[0];

            let result: {
                needs_alert: boolean;
                message: string;
                severity: string;
                next_estimated_maintenance_hours: number;
                estimated_profitability?: {
                    gross_value: number;
                    estimated_operational_cost: number;
                    net_profit: number;
                    margin_percent: number;
                };
            };
            try {
                result = JSON.parse(jsonString);
            } catch (e) {
                console.error("Erro ao parsear resposta da IA:", e);
                return;
            }

            // 3. Save Profitability (Optional: Could save to a new table or field)
            // For now, let's just use it in the alert or a log
            console.log("Profitability Analysis:", result.estimated_profitability);

            // 3. Create Insight if necessary
            if (result.needs_alert) {
                await supabase.from('insights').insert({
                    project_id: null, // Global or machine specific
                    type: 'MANUTENCAO_PREDITIVA',
                    content: `[Predição AI] ${machine.name}: ${result.message}`,
                    status: 'active'
                });
            }

            return result;
        } catch (error) {
            console.error('Erro na análise preditiva da O.S.:', error);
        }
    }
};
