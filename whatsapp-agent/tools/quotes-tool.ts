import { defineTool } from "wa-agent/tools/types";
import { z } from "zod";
import { getSupabase } from "./supabase-client";

export default defineTool({
  description: "Gerencia orçamentos: criar, listar, consultar status",
  inputSchema: z.object({
    action: z.enum(["create", "list", "get", "stats"]),
    id: z.string().uuid().optional(),
    client_name: z.string().optional(),
    client_phone: z.string().optional(),
    client_email: z.string().optional(),
    client_address: z.string().optional(),
    service_type: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    hourly_rate: z.number().optional(),
    estimated_hours: z.number().optional(),
    total_value: z.number().optional(),
    discount: z.number().optional(),
    notes: z.string().optional(),
    valid_until: z.string().optional(),
    status: z.enum(["draft", "sent", "approved", "rejected"]).optional(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
  }),
  execute: async (input, ctx) => {
    const supabase = getSupabase();
    try {
      switch (input.action) {
        case "stats": {
          const { data, error } = await supabase.from("orcamentos").select("status, total_value");
          if (error) throw error;
          const approved = data?.filter(o => o.status === "approved") || [];
          const totalApproved = approved.reduce((s, o) => s + (o.total_value || 0), 0);
          return {
            success: true,
            data: {
              total: data?.length || 0,
              draft: data?.filter(o => o.status === "draft").length || 0,
              sent: data?.filter(o => o.status === "sent").length || 0,
              approved: approved.length,
              rejected: data?.filter(o => o.status === "rejected").length || 0,
              totalApproved,
            },
          };
        }
        case "list": {
          let query = supabase.from("orcamentos").select("*").order("created_at", { ascending: false });
          if (input.status) query = query.eq("status", input.status);
          const { data, error } = await query.range((input.page - 1) * input.limit, input.page * input.limit - 1);
          if (error) throw error;
          return { success: true, data, count: data?.length || 0 };
        }
        case "get": {
          if (!input.id) throw new Error("id é obrigatório");
          const { data, error } = await supabase.from("orcamentos").select("*").eq("id", input.id).single();
          if (error) throw error;
          return { success: true, data };
        }
        case "create": {
          const { data, error } = await supabase.from("orcamentos").insert({
            client_name: input.client_name,
            client_phone: input.client_phone,
            client_email: input.client_email,
            client_address: input.client_address,
            service_type: input.service_type,
            location: input.location,
            description: input.description,
            hourly_rate: input.hourly_rate,
            estimated_hours: input.estimated_hours,
            total_value: input.total_value || (input.hourly_rate && input.estimated_hours ? input.hourly_rate * input.estimated_hours : 0),
            discount: input.discount || 0,
            notes: input.notes,
            valid_until: input.valid_until,
            status: "draft",
          }).select().single();
          if (error) throw error;
          return { success: true, data, message: "✅ Orçamento criado como rascunho!" };
        }
        default:
          throw new Error(`Ação desconhecida: ${input.action}`);
      }
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
