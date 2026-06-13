import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Gerencia frota/máquinas: listar, consultar status, health score",
  inputSchema: z.object({
    action: z.enum(["list", "get", "stats", "search"]),
    id: z.string().uuid().optional(),
    name: z.string().optional().describe("Nome da máquina"),
    status: z.enum(["active", "maintenance", "inactive"]).optional(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      switch (input.action) {
        case "stats": {
          const { data, error } = await supabase.from("machines").select("status, health_score");
          if (error) throw error;
          const active = data?.filter(m => m.status === "active").length || 0;
          const maintenance = data?.filter(m => m.status === "maintenance").length || 0;
          const avgHealth = data?.reduce((s, m) => s + (m.health_score || 0), 0) / (data?.length || 1);
          return { success: true, data: { total: data?.length || 0, active, maintenance, inactive: (data?.length || 0) - active - maintenance, avgHealth: avgHealth.toFixed(1) } };
        }
        case "list": {
          let query = supabase.from("machines").select("*").order("name");
          if (input.status) query = query.eq("status", input.status);
          const { data, error } = await query.range((input.page - 1) * input.limit, input.page * input.limit - 1);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "get": {
          if (!input.id) throw new Error("id é obrigatório");
          const { data, error } = await supabase.from("machines").select("*").eq("id", input.id).single();
          if (error) throw error;
          return { success: true, data };
        }
        case "search": {
          if (!input.name) throw new Error("name é obrigatório");
          const { data, error } = await supabase
            .from("machines")
            .select("*")
            .ilike("name", `%${input.name}%`)
            .order("name")
            .limit(input.limit);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        default:
          throw new Error(`Ação desconhecida: ${input.action}`);
      }
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
