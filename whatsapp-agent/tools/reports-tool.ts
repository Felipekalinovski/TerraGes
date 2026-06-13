import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Gera relatórios e análises gerenciais (financeiro, frota, horas, OS)",
  inputSchema: z.object({
    action: z.enum(["executive-summary", "client-report", "fleet-performance", "financial-report"]),
    client_name: z.string().optional().describe("Nome do cliente para relatório"),
    days: z.number().optional().default(30).describe("Período em dias"),
    project_name: z.string().optional(),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - input.days);

      switch (input.action) {
        case "executive-summary": {
          const [tx, os, machines, horas] = await Promise.all([
            supabase.from("transactions").select("type, amount").gte("date", fromDate.toISOString().split("T")[0]),
            supabase.from("service_orders").select("status, total_value"),
            supabase.from("machines").select("status, health_score"),
            supabase.from("hora_maquina").select("total_hours, total_value").gte("date", fromDate.toISOString().split("T")[0]),
          ]);
          const receita = tx.data?.filter(t => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0) || 0;
          const despesa = tx.data?.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0) || 0;
          const osPendentes = os.data?.filter(o => o.status === "pending").length || 0;
          const osCompletadas = os.data?.filter(o => o.status === "completed").length || 0;
          const maqsAtivas = machines.data?.filter(m => m.status === "active").length || 0;
          const totalHoras = horas.data?.reduce((s, h) => s + (h.total_hours || 0), 0) || 0;
          return {
            success: true,
            data: {
              periodo: `${input.days} dias`,
              financeiro: { receita, despesa, saldo: receita - despesa, margem: receita > 0 ? `${((receita - despesa) / receita * 100).toFixed(1)}%` : "0%" },
              operacional: { osPendentes, osCompletadas, maquinasAtivas: maqsAtivas, totalHoras: totalHoras.toFixed(1) },
            },
          };
        }
        case "client-report": {
          if (!input.client_name) throw new Error("client_name é obrigatório");
          const [horas, os] = await Promise.all([
            supabase.from("hora_maquina").select("*").eq("client_name", input.client_name).order("date", { ascending: false }),
            supabase.from("service_orders").select("*").ilike("client", `%${input.client_name}%`).order("date", { ascending: false }),
          ]);
          const horasTotal = horas.data?.reduce((s, h) => s + (h.total_hours || 0), 0) || 0;
          const horasValue = horas.data?.reduce((s, h) => s + (h.total_value || 0), 0) || 0;
          return {
            success: true,
            data: {
              cliente: input.client_name,
              horasMaquina: { registros: horas.data?.length || 0, totalHoras: horasTotal.toFixed(1), totalValue: horasValue.toFixed(2) },
              ordensServico: { total: os.data?.length || 0, pendentes: os.data?.filter(o => o.status === "pending").length || 0 },
            },
          };
        }
        case "fleet-performance": {
          const { data: machines } = await supabase.from("machines").select("name, type, status, health_score, hours");
          const { data: maintenances } = await supabase.from("maintenances").select("machine_id, cost").gte("date", fromDate.toISOString().split("T")[0]);
          const machinesData = machines?.map(m => ({
            name: m.name,
            status: m.status,
            healthScore: m.health_score,
            hours: m.hours,
            custoManutencao: maintenances?.filter(mt => mt.machine_id === m.id).reduce((s, mt) => s + (mt.cost || 0), 0) || 0,
          })) || [];
          return { success: true, data: { maquinas: machinesData } };
        }
        case "financial-report": {
          const [tx, orcamentos] = await Promise.all([
            supabase.from("transactions").select("type, amount, status, category, date").gte("date", fromDate.toISOString().split("T")[0]),
            supabase.from("orcamentos").select("status, total_value"),
          ]);
          const receitas = tx.data?.filter(t => t.type === "income") || [];
          const despesas = tx.data?.filter(t => t.type === "expense") || [];
          const categorias: Record<string, number> = {};
          despesas.forEach(d => { categorias[d.category || "outros"] = (categorias[d.category || "outros"] || 0) + (d.amount || 0); });
          const orcamentosAprovados = orcamentos.data?.filter(o => o.status === "approved") || [];
          return {
            success: true,
            data: {
              periodo: `${input.days} dias`,
              receitas: { total: receitas.reduce((s, r) => s + (r.amount || 0), 0), qtd: receitas.length },
              despesas: { total: despesas.reduce((s, d) => s + (d.amount || 0), 0), qtd: despesas.length, porCategoria: categorias },
              orcamentos: { total: orcamentos.data?.length || 0, aprovados: orcamentosAprovados.length, valorAprovado: orcamentosAprovados.reduce((s, o) => s + (o.total_value || 0), 0) },
            },
          };
        }
        default:
          throw new Error(`Ação desconhecida: ${input.action}`);
      }
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
