import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Gerencia RDO (Relatório Diário de Operações): criar, listar",
  inputSchema: z.object({
    action: z.enum(["create", "list", "get", "stats"]),
    id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional().describe("UUID do projeto"),
    operator_id: z.string().uuid().optional().describe("UUID do operador"),
    date: z.string().optional().describe("Data ISO"),
    weather: z.enum(["sunny", "cloudy", "rainy", "storm"]).optional().describe("Clima"),
    team_size: z.number().optional().describe("Tamanho da equipe"),
    activities: z.string().optional().describe("Atividades realizadas"),
    machines: z.array(z.string()).optional().describe("Nomes das máquinas usadas"),
    occurrences: z.string().optional().describe("Ocorrências/observações"),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      switch (input.action) {
        case "stats": {
          const { data, error } = await supabase.from("rdo").select("id, date, weather");
          if (error) throw error;
          const sunny = data?.filter(r => r.weather === "sunny").length || 0;
          const rainy = data?.filter(r => r.weather === "rainy").length || 0;
          return { success: true, data: { total: data?.length || 0, sunny, rainy, other: (data?.length || 0) - sunny - rainy } };
        }
        case "list": {
          let query = supabase.from("rdo").select("*, projects(name)").order("date", { ascending: false });
          if (input.operator_id) query = query.eq("operator_id", input.operator_id);
          const { data, error } = await query.range((input.page - 1) * input.limit, input.page * input.limit - 1);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "get": {
          if (!input.id) throw new Error("id é obrigatório");
          const { data, error } = await supabase.from("rdo").select("*, projects(name)").eq("id", input.id).single();
          if (error) throw error;
          return { success: true, data };
        }
        case "create": {
          const { data, error } = await supabase.from("rdo").insert({
            project_id: input.project_id,
            operator_id: input.operator_id,
            date: input.date || new Date().toISOString(),
            weather: input.weather || "sunny",
            team_size: input.team_size,
            activities: input.activities,
            machines: input.machines || [],
            occurrences: input.occurrences,
          }).select().single();
          if (error) throw error;
          return { success: true, data, message: "✅ RDO registrado!" };
        }
        default:
          throw new Error(`Ação desconhecida: ${input.action}`);
      }
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
