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
                user_id: rdo.user_id,
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
                const tagsToInsert = analysis.tags.map(tag => ({ rdo_id: rdoId, user_id: rdo.user_id, tag }));
                await supabase.from('rdo_tags').insert(tagsToInsert);
            }

            // 5. Process Machine Impacts
            for (const impact of analysis.impacted_machines) {
                await supabase.from('machine_impact').insert({
                    machine_id: impact.id,
                    rdo_id: rdoId,
                    user_id: rdo.user_id,
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
                    user_id: rdo.user_id,
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
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const [
                { data: company },
                { data: machines },
                { data: recentMaintenance },
                { data: transactions },
                { data: activeInsights },
                { data: upcomingSchedules },
                { data: rdosThisMonth },
                { data: serviceOrders }
            ] = await Promise.all([
                supabase.from('company_info').select('name').limit(1).single(),

                supabase.from('machines').select('id, name, status, type, health_score, health_status'),

                supabase.from('maintenance_records')
                    .select('*, machines(name)')
                    .order('date', { ascending: false })
                    .limit(5),

                supabase.from('transactions').select('amount, type, category'),

                supabase.from('insights').select('content, type').eq('status', 'active').limit(5),

                supabase.from('schedules').select('title, type, start_time, status')
                    .gte('start_time', today.toISOString())
                    .order('start_time', { ascending: true })
                    .limit(5),

                supabase.from('rdos').select('date, status')
                    .gte('date', thirtyDaysAgo.toISOString()),

                supabase.from('service_orders').select('status, type')
                    .limit(10)
            ]);

            const activeMachines = machines?.filter(m => m.status === 'active').length || 0;
            const maintenanceMachines = machines?.filter(m => m.status === 'maintenance').length || 0;
            const machinesTotal = machines?.length || 0;
            
            const income = transactions?.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.amount || 0), 0) || 0;
            const expense = transactions?.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0) || 0;
            const balance = income - expense;

            const rdosCount = rdosThisMonth?.length || 0;
            const completedSO = serviceOrders?.filter(s => s.status === 'completed').length || 0;

            const machinesList = machines?.map(m => 
                `- ${m.name} (${m.type || 'tipo não definido'}) - Status: ${m.health_status || 'normal'} - Saúde: ${m.health_score || 100}%`
            ).join('\n') || 'Nenhuma máquina cadastrada';

            const maintenanceList = recentMaintenance?.map(m => 
                `- ${m.machines?.name || 'Máquina'} - ${m.type} em ${new Date(m.date).toLocaleDateString('pt-BR')} - R$ ${(m.cost || 0).toFixed(2)}`
            ).join('\n') || 'Nenhuma manutenção recente';

            const transactionsSummary = `
            - Receitas: R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            - Despesas: R$ ${expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            - Saldo: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

            return `
Você é o assistente inteligente do TerraGes, um sistema de gestão para empresas de terraplanagem, construção pesada e serviços de máquinas pesadas.

IMPORTANTE - Regras de Ouro:
1. NUNCA invente dados. Use apenas as informações fornecidas abaixo.
2. Se você não souber algo, diga "Não tenho essa informação baseada nos dados atuais."
3. Responda de forma direta e em português do Brasil.
4. Datas devem seguir o formato brasileiro (dd/MM/yyyy).
5. Valores em reais (R$) com vírgula como separador decimal.

=== DADOS REAIS DO SISTEMA ===

Empresa: ${company?.name || 'TerraGes Cliente'}

FROTA (${machinesTotal} máquinas):
${machinesList}

Status da Frota:
- Ativas: ${activeMachines}
- Em Manutenção: ${maintenanceMachines}

FINANCEIRO (Últimos 30 dias):
${transactionsSummary}

MANUTENÇÕES RECENTES:
${maintenanceList}

RDOs deste mês: ${rdosCount}

Ordens de Serviço Concluídas: ${completedSO}

AGENDA PRÓXIMA:
${upcomingSchedules?.map(s => `- ${s.title} (${s.type}) em ${new Date(s.start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`).join('\n') || 'Nada agendado.'}

ALERTAS ATIVOS:
${activeInsights?.map(i => `- [${i.type}] ${i.content}`).join('\n') || 'Nenhum alerta.'}

=== INSTRUÇÕES ===
- Hoje é ${today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}.
- Forneça apenas informações baseadas nos dados acima.
- Se perguntarem sobre algo que não está nos dados, seja honesto.
- Mantenha respostas curtas (máx 3 parágrafos).
- Para agendar algo, use: [[CREATE_SCHEDULE:{"title":"...","type":"...","start_time":"YYYY-MM-DDTHH:MM:SS","priority":"...","notes":"..."}]]
`;
        } catch (error) {
            console.error("Erro ao gerar contexto do chat:", error);
            return `Você é o assistente do TerraGes. 
IMPORTANTANTE: Responda apenas com informações gerais. Em caso de dúvida sobre dados específicos, diga que não tem acesso aos dados no momento.
Hoje é ${new Date().toLocaleDateString('pt-BR')}.`;
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
                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from('insights').insert({
                    project_id: null, // Global or machine specific
                    user_id: user?.id,
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
