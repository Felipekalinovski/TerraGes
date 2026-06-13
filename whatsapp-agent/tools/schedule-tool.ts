import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Gerencia agendamentos: criar, listar, atualizar, deletar",
  inputSchema: z.object({
    action: z.enum(["create", "list", "get", "update", "delete"]),
    id: z.string().uuid().optional().describe("UUID do agendamento"),
    title: z.string().optional().describe("Título do agendamento"),
    type: z.enum(["excavation", "transport", "maintenance", "other"]).optional().describe("Tipo"),
    start_time: z.string().optional().describe("ISO datetime início"),
    end_time: z.string().optional().describe("ISO datetime fim"),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    notes: z.string().optional().describe("Observações"),
    operator_id: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      switch (input.action) {
        case "list": {
          let query = supabase.from("schedules").select("*").order("start_time", { ascending: true });
          if (input.userId) query = query.eq("operator_id", input.userId);
          const { data, error } = await query.range((input.page - 1) * input.limit, input.page * input.limit - 1);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "get": {
          if (!input.id) throw new Error("id é obrigatório");
          const { data, error } = await supabase.from("schedules").select("*").eq("id", input.id).single();
          if (error) throw error;
          return { success: true, data };
        }
        case "create": {
          const { data, error } = await supabase.from("schedules").insert({
            title: input.title,
            type: input.type || "other",
            start_time: input.start_time,
            end_time: input.end_time,
            priority: input.priority || "medium",
            notes: input.notes,
            operator_id: input.operator_id,
          }).select().single();
          if (error) throw error;
          return { success: true, data, message: "✅ Agendamento criado!" };
        }
        case "update": {
          if (!input.id) throw new Error("id é obrigatório");
          const { data, error } = await supabase.from("schedules").update({
            title: input.title,
            type: input.type,
            start_time: input.start_time,
            end_time: input.end_time,
            priority: input.priority,
            notes: input.notes,
          }).eq("id", input.id).select().single();
          if (error) throw error;
          return { success: true, data, message: "✅ Agendamento atualizado!" };
        }
        case "delete": {
          if (!input.id) throw new Error("id é obrigatório");
          const { error } = await supabase.from("schedules").delete().eq("id", input.id);
          if (error) throw error;
          return { success: true, message: "✅ Agendamento removido!" };
        }
        default:
          throw new Error(`Ação desconhecida: ${input.action}`);
      }
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
