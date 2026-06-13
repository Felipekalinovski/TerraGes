import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Gerencia ordens de serviço (OS): criar, listar, consultar status",
  inputSchema: z.object({
    action: z.enum(["create", "list", "get", "stats", "update-status"]),
    id: z.string().uuid().optional(),
    date: z.string().optional(),
    client: z.string().optional().describe("Nome do cliente"),
    machine_id: z.string().uuid().optional(),
    operator_id: z.string().uuid().optional(),
    start_hour: z.number().optional().describe("Hora início (0-24)"),
    end_hour: z.number().optional().describe("Hora fim (0-24)"),
    hourly_rate: z.number().optional(),
    total_value: z.number().optional(),
    payment_method: z.string().optional().describe("Forma de pagamento"),
    status: z.enum(["pending", "completed", "cancelled"]).optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      switch (input.action) {
        case "stats": {
          const { data, error } = await supabase.from("service_orders").select("status, total_value, client");
          if (error) throw error;
          const totalPending = data?.filter(o => o.status === "pending").length || 0;
          const totalCompleted = data?.filter(o => o.status === "completed").length || 0;
          const totalValue = data?.reduce((s, o) => s + (o.total_value || 0), 0) || 0;
          return { success: true, data: { total: data?.length || 0, pending: totalPending, completed: totalCompleted, cancelled: (data?.length || 0) - totalPending - totalCompleted, totalValue } };
        }
        case "list": {
          let query = supabase.from("service_orders").select("*, machines(name), employees:operator_id(name)").order("date", { ascending: false });
          if (input.status) query = query.eq("status", input.status);
          if (input.client) query = query.ilike("client", `%${input.client}%`);
          const { data, error } = await query.range((input.page - 1) * input.limit, input.page * input.limit - 1);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "get": {
          if (!input.id) throw new Error("id é obrigatório");
          const { data, error } = await supabase.from("service_orders").select("*, machines(name), employees:operator_id(name)").eq("id", input.id).single();
          if (error) throw error;
          return { success: true, data };
        }
        case "create": {
          const totalHours = input.start_hour !== undefined && input.end_hour !== undefined ? Math.max(0, input.end_hour - input.start_hour) : 0;
          const totalVal = input.total_value || (input.hourly_rate ? totalHours * input.hourly_rate : 0);
          const { data, error } = await supabase.from("service_orders").insert({
            date: input.date || new Date().toISOString().split("T")[0],
            client: input.client,
            machine_id: input.machine_id,
            operator_id: input.operator_id,
            start_hour: input.start_hour,
            end_hour: input.end_hour,
            total_hours: totalHours,
            hourly_rate: input.hourly_rate,
            total_value: totalVal,
            payment_method: input.payment_method || "Pix",
            status: "pending",
            location: input.location,
            description: input.description,
          }).select().single();
          if (error) throw error;
          return { success: true, data, message: `✅ OS criada para ${input.client}!` };
        }
        case "update-status": {
          if (!input.id || !input.status) throw new Error("id e status são obrigatórios");
          const { data, error } = await supabase.from("service_orders").update({ status: input.status }).eq("id", input.id).select().single();
          if (error) throw error;
          return { success: true, data, message: `✅ OS atualizada para ${input.status}!` };
        }
        default:
          throw new Error(`Ação desconhecida: ${input.action}`);
      }
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
