import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Gerencia manutenções: criar, listar, consultar por máquina",
  inputSchema: z.object({
    action: z.enum(["create", "list", "get", "machine-maintenances"]),
    id: z.string().uuid().optional(),
    machine_id: z.string().uuid().optional().describe("UUID da máquina"),
    date: z.string().optional().describe("Data da manutenção (YYYY-MM-DD)"),
    type: z.enum(["preventive", "corrective", "predictive"]).optional().describe("Tipo"),
    hour_meter: z.number().optional().describe("Horímetro no momento"),
    description: z.string().optional().describe("Descrição do serviço"),
    technician: z.string().optional().describe("Técnico responsável"),
    cost: z.number().optional().describe("Custo da manutenção"),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      switch (input.action) {
        case "list": {
          const { data, error } = await supabase
            .from("maintenances")
            .select("*, machines(name)")
            .order("date", { ascending: false })
            .range((input.page - 1) * input.limit, input.page * input.limit - 1);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "get": {
          if (!input.id) throw new Error("id é obrigatório");
          const { data, error } = await supabase.from("maintenances").select("*, machines(name)").eq("id", input.id).single();
          if (error) throw error;
          return { success: true, data };
        }
        case "machine-maintenances": {
          if (!input.machine_id) throw new Error("machine_id é obrigatório");
          const { data, error } = await supabase
            .from("maintenances")
            .select("*")
            .eq("machine_id", input.machine_id)
            .order("date", { ascending: false })
            .limit(input.limit);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "create": {
          const { data, error } = await supabase.from("maintenances").insert({
            machine_id: input.machine_id,
            date: input.date,
            type: input.type || "corrective",
            hour_meter: input.hour_meter,
            description: input.description,
            technician: input.technician,
            cost: input.cost,
          }).select().single();
          if (error) throw error;
          return { success: true, data, message: "✅ Manutenção registrada!" };
        }
        default:
          throw new Error(`Ação desconhecida: ${input.action}`);
      }
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
