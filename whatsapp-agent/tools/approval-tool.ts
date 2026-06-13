import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Gerencia aprovação de ações pendentes do WhatsApp: listar, aprovar, rejeitar",
  inputSchema: z.object({
    action: z.enum(["list-pending", "approve", "reject", "check-status"]),
    id: z.string().uuid().optional().describe("ID da ação pendente"),
    user_phone: z.string().optional().describe("Telefone do usuário"),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      switch (input.action) {
        case "list-pending": {
          let query = supabase
            .from("pending_actions")
            .select("*")
            .eq("status", "pending_confirmation")
            .order("created_at", { ascending: false });
          if (input.user_phone) query = query.eq("user_phone", input.user_phone);
          const { data, error } = await query.range((input.page - 1) * input.limit, input.page * input.limit - 1);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "approve": {
          if (!input.id) throw new Error("id é obrigatório");
          const { data: action, error: fetchError } = await supabase
            .from("pending_actions")
            .select("*")
            .eq("id", input.id)
            .single();
          if (fetchError || !action) throw new Error("Ação não encontrada");

          if (action.action_type === "CREATE_OS") {
            const osData = action.action_data as Record<string, any>;
            const { error: insertError } = await supabase.from("service_orders").insert({
              ...osData,
              status: "pending",
            });
            if (insertError) throw insertError;
          } else if (action.action_type === "CREATE_SCHEDULE") {
            const schedData = action.action_data as Record<string, any>;
            const { error: insertError } = await supabase.from("schedules").insert(schedData);
            if (insertError) throw insertError;
          }

          await supabase.from("pending_actions").update({ status: "approved" }).eq("id", input.id);
          return { success: true, message: "✅ Ação aprovada e executada!", action_type: action.action_type };
        }
        case "reject": {
          if (!input.id) throw new Error("id é obrigatório");
          await supabase.from("pending_actions").update({ status: "rejected" }).eq("id", input.id);
          return { success: true, message: "❌ Ação rejeitada." };
        }
        case "check-status": {
          if (!input.user_phone) throw new Error("user_phone é obrigatório");
          const { data, error } = await supabase
            .from("pending_actions")
            .select("*")
            .eq("user_phone", input.user_phone)
            .order("created_at", { ascending: false })
            .limit(5);
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
