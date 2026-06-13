import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Gerencia horas-máquina: registrar, consultar por projeto/mês",
  inputSchema: z.object({
    action: z.enum(["create", "list", "month-stats", "project-report"]),
    id: z.string().uuid().optional(),
    machine_id: z.string().uuid().optional().describe("UUID da máquina"),
    machine_name: z.string().optional().describe("Nome da máquina (free text)"),
    operator_name: z.string().optional().describe("Nome do operador"),
    project_name: z.string().optional().describe("Nome do projeto"),
    client_name: z.string().optional().describe("Nome do cliente"),
    date: z.string().optional().describe("Data YYYY-MM-DD"),
    start_time: z.string().optional().describe("Hora início (HH:mm)"),
    end_time: z.string().optional().describe("Hora fim (HH:mm)"),
    break_minutes: z.number().optional().default(0).describe("Intervalo em minutos"),
    total_hours: z.number().optional().describe("Total de horas (auto-calc)"),
    hourly_rate: z.number().optional().describe("Valor hora"),
    total_value: z.number().optional().describe("Valor total (auto-calc)"),
    service_type: z.string().optional().describe("Tipo de serviço"),
    observations: z.string().optional().describe("Observações"),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      switch (input.action) {
        case "month-stats": {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
          const { data, error } = await supabase
            .from("hora_maquina")
            .select("total_hours, total_value")
            .gte("date", firstDay)
            .lte("date", lastDay);
          if (error) throw error;
          const totalHoras = data?.reduce((s, r) => s + (r.total_hours || 0), 0) || 0;
          const totalValue = data?.reduce((s, r) => s + (r.total_value || 0), 0) || 0;
          return { success: true, data: { totalHoras: totalHoras.toFixed(1), totalValue: totalValue.toFixed(2), registros: data?.length || 0 } };
        }
        case "project-report": {
          if (!input.project_name) throw new Error("project_name é obrigatório");
          const { data, error } = await supabase
            .from("hora_maquina")
            .select("*")
            .eq("project_name", input.project_name)
            .order("date", { ascending: false });
          if (error) throw error;
          const totalHoras = data?.reduce((s, r) => s + (r.total_hours || 0), 0) || 0;
          const totalValue = data?.reduce((s, r) => s + (r.total_value || 0), 0) || 0;
          return { success: true, data: { registros: data, totalHoras: totalHoras.toFixed(1), totalValue: totalValue.toFixed(2), qtd: data?.length || 0 } };
        }
        case "list": {
          let query = supabase.from("hora_maquina").select("*").order("date", { ascending: false });
          if (input.project_name) query = query.eq("project_name", input.project_name);
          if (input.machine_id) query = query.eq("machine_id", input.machine_id);
          if (input.client_name) query = query.eq("client_name", input.client_name);
          const { data, error } = await query.range((input.page - 1) * input.limit, input.page * input.limit - 1);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "create": {
          const calcHours = (s: string, e: string, b: number) => {
            const [sh, sm] = s.split(":").map(Number);
            const [eh, em] = e.split(":").map(Number);
            return Math.max(0, ((eh * 60 + em) - (sh * 60 + sm) - b) / 60);
          };
          const totalH = input.total_hours || (input.start_time && input.end_time ? calcHours(input.start_time, input.end_time, input.break_minutes || 0) : 0);
          const totalV = input.total_value || (input.hourly_rate ? totalH * input.hourly_rate : 0);
          const { data, error } = await supabase.from("hora_maquina").insert({
            machine_id: input.machine_id,
            machine_name: input.machine_name,
            operator_name: input.operator_name,
            project_name: input.project_name,
            client_name: input.client_name,
            date: input.date || new Date().toISOString().split("T")[0],
            start_time: input.start_time,
            end_time: input.end_time,
            break_minutes: input.break_minutes || 0,
            total_hours: totalH,
            hourly_rate: input.hourly_rate,
            total_value: totalV,
            service_type: input.service_type,
            observations: input.observations,
          }).select().single();
          if (error) throw error;
          return { success: true, data, message: "✅ Hora-máquina registrada!" };
        }
        default:
          throw new Error(`Ação desconhecida: ${input.action}`);
      }
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
