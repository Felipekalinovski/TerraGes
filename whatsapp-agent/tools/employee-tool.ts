import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Consulta dados de colaboradores: listar, buscar por nome ou ID",
  inputSchema: z.object({
    action: z.enum(["list", "get", "search", "stats"]),
    id: z.string().uuid().optional(),
    name: z.string().optional().describe("Nome para busca"),
    status: z.enum(["active", "vacation", "inactive", "leave"]).optional(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      switch (input.action) {
        case "stats": {
          const { data, error } = await supabase.from("employees").select("status");
          if (error) throw error;
          const stats = {
            total: data?.length || 0,
            active: data?.filter(e => e.status === "active").length || 0,
            vacation: data?.filter(e => e.status === "vacation").length || 0,
            leave: data?.filter(e => e.status === "leave").length || 0,
            inactive: data?.filter(e => e.status === "inactive").length || 0,
          };
          return { success: true, data: stats };
        }
        case "list": {
          let query = supabase.from("employees").select("*").order("name", { ascending: true });
          if (input.status) query = query.eq("status", input.status);
          const { data, error } = await query.range((input.page - 1) * input.limit, input.page * input.limit - 1);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "get": {
          if (!input.id) throw new Error("id é obrigatório");
          const { data, error } = await supabase.from("employees").select("*").eq("id", input.id).single();
          if (error) throw error;
          return { success: true, data };
        }
        case "search": {
          if (!input.name) throw new Error("name é obrigatório");
          const { data, error } = await supabase
            .from("employees")
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
