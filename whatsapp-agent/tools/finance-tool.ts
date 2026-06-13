import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Gerencia finanças: saldo, receitas, despesas, criar transações",
  inputSchema: z.object({
    action: z.enum(["balance", "list", "create", "stats"]),
    id: z.string().uuid().optional(),
    title: z.string().optional().describe("Título da transação"),
    amount: z.number().optional().describe("Valor"),
    type: z.enum(["income", "expense"]).optional().describe("Tipo: receita/despesa"),
    status: z.enum(["paid", "pending"]).optional().describe("Status: pago/pendente"),
    category: z.string().optional().describe("Categoria"),
    date: z.string().optional().describe("Data YYYY-MM-DD"),
    userId: z.string().uuid().optional(),
    days: z.number().optional().default(30).describe("Período em dias"),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      switch (input.action) {
        case "balance": {
          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - input.days);
          const { data, error } = await supabase
            .from("transactions")
            .select("type, amount, status")
            .gte("date", fromDate.toISOString().split("T")[0]);
          if (error) throw error;
          const income = data?.filter(t => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0) || 0;
          const expense = data?.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0) || 0;
          const pending = data?.filter(t => t.status === "pending").reduce((s, t) => s + (t.amount || 0), 0) || 0;
          return {
            success: true,
            data: {
              receitas: income,
              despesas: expense,
              saldo: income - expense,
              pendente: pending,
              margem: income > 0 ? ((income - expense) / income * 100).toFixed(1) : "0.0",
            },
          };
        }
        case "stats": {
          const { data, error } = await supabase.from("transactions").select("type, amount, status, category, date");
          if (error) throw error;
          const totalReceita = data?.filter(t => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0) || 0;
          const totalDespesa = data?.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0) || 0;
          const porCategoria: Record<string, number> = {};
          data?.filter(t => t.type === "expense").forEach(t => {
            porCategoria[t.category || "outros"] = (porCategoria[t.category || "outros"] || 0) + (t.amount || 0);
          });
          return { success: true, data: { totalReceita, totalDespesa, saldo: totalReceita - totalDespesa, porCategoria } };
        }
        case "list": {
          let query = supabase.from("transactions").select("*").order("date", { ascending: false });
          if (input.userId) query = query.eq("user_id", input.userId);
          if (input.type) query = query.eq("type", input.type);
          if (input.status) query = query.eq("status", input.status);
          const { data, error } = await query.range((input.page - 1) * input.limit, input.page * input.limit - 1);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "create": {
          const { data, error } = await supabase.from("transactions").insert({
            title: input.title,
            amount: input.amount,
            type: input.type || "income",
            status: input.status || "pending",
            category: input.category,
            date: input.date || new Date().toISOString().split("T")[0],
            user_id: input.userId,
          }).select().single();
          if (error) throw error;
          return { success: true, data, message: `✅ ${input.type === "income" ? "Receita" : "Despesa"} registrada!` };
        }
        default:
          throw new Error(`Ação desconhecida: ${input.action}`);
      }
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
