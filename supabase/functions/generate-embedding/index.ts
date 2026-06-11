import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "terrages-internal";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

// ─── Monta o texto a ser embeddado a partir do registro ──────────────────────

async function fetchRecordText(recordType: string, recordId: string): Promise<string | null> {
  if (recordType === "rdo") {
    const { data, error } = await supabase
      .from("rdos")
      .select("date, weather, activities, observations, project_id, machine_id, operator_id")
      .eq("id", recordId)
      .single();
    if (error || !data) return null;
    return [
      `RDO em ${data.date}`,
      data.weather ? `Clima: ${data.weather}` : null,
      data.activities ? `Atividades: ${data.activities}` : null,
      data.observations ? `Observações: ${data.observations}` : null,
    ].filter(Boolean).join("\n");
  }

  if (recordType === "service_order") {
    const { data, error } = await supabase
      .from("service_orders")
      .select("date, client, client_cpf, client_contact, location, description, payment_method, start_hour, end_hour, hourly_rate, total_value, status")
      .eq("id", recordId)
      .single();
    if (error || !data) return null;
    return [
      `OS em ${data.date} para cliente ${data.client}`,
      data.location ? `Local: ${data.location}` : null,
      data.description ? `Descrição: ${data.description}` : null,
      data.payment_method ? `Pagamento: ${data.payment_method}` : null,
      data.start_hour != null && data.end_hour != null
        ? `Horas: ${data.start_hour} às ${data.end_hour} (R$ ${data.hourly_rate}/h)`
        : null,
      data.total_value != null ? `Total: R$ ${data.total_value}` : null,
      data.status ? `Status: ${data.status}` : null,
    ].filter(Boolean).join("\n");
  }

  if (recordType === "machine_hours") {
    const { data, error } = await supabase
      .from("hora_maquina")
      .select("date, machine_name, operator_name, project_name, client_name, service_type, observations, start_time, end_time, total_hours, hourly_rate, total_value")
      .eq("id", recordId)
      .single();
    if (error || !data) return null;
    return [
      `Registro de horas em ${data.date}`,
      `Máquina: ${data.machine_name}`,
      data.operator_name ? `Operador: ${data.operator_name}` : null,
      `Projeto: ${data.project_name}`,
      data.client_name ? `Cliente: ${data.client_name}` : null,
      data.service_type ? `Serviço: ${data.service_type}` : null,
      data.start_time && data.end_time ? `Horário: ${data.start_time} às ${data.end_time}` : null,
      data.total_hours ? `Total horas: ${data.total_hours}` : null,
      data.total_value ? `Total: R$ ${data.total_value}` : null,
      data.observations ? `Observações: ${data.observations}` : null,
    ].filter(Boolean).join("\n");
  }

  return null;
}

// ─── Chama Gemini text-embedding-004 (768 dims) ──────────────────────────────

async function generateGeminiEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: text.slice(0, 8000) }] },
          taskType: "RETRIEVAL_DOCUMENT",
        }),
      }
    );
    if (!res.ok) {
      console.error("[Embedding] Gemini erro:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    return data.embedding?.values || null;
  } catch (e) {
    console.error("[Embedding] Exceção:", e);
    return null;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Aceita chamadas internas (do trigger) e chamadas manuais autenticadas
  const internalSecret = req.headers.get("X-Internal-Secret");
  const isInternal = internalSecret === INTERNAL_SECRET;
  const authHeader = req.headers.get("Authorization");

  try {
    const body = await req.json().catch(() => ({}));
    const { record_type, record_id, content: rawContent, backfill: backfillIds } = body as {
      record_type?: string;
      record_id?: string;
      content?: string;
      backfill?: Array<{ record_type: string; record_id: string }>;
    };

    // Modo backfill: processa vários registros
    if (Array.isArray(backfillIds)) {
      const results: any[] = [];
      for (const item of backfillIds) {
        const r = await processOne(item.record_type, item.record_id);
        results.push({ ...item, ...r });
      }
      return new Response(JSON.stringify({ ok: true, results }), { headers: corsHeaders });
    }

    if (!record_type || !record_id) {
      return new Response(JSON.stringify({ error: "record_type and record_id required" }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Se veio de trigger (interno) ou do bot (autenticado), processa
    if (!isInternal && !authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const result = await processOne(record_type, record_id, rawContent);
    return new Response(JSON.stringify({ ok: true, ...result }), { headers: corsHeaders });
  } catch (e: any) {
    console.error("[generate-embedding] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: corsHeaders,
    });
  }
});

async function processOne(recordType: string, recordId: string, rawContent?: string) {
  const content = rawContent || (await fetchRecordText(recordType, recordId));
  if (!content) return { status: "skipped", reason: "no_content" };

  // Evita duplicar embedding para o mesmo registro
  const { data: existing } = await supabase
    .from("operational_embeddings")
    .select("id")
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .maybeSingle();

  const embedding = await generateGeminiEmbedding(content);
  if (!embedding) return { status: "failed", reason: "embedding_api_failed" };

  if (existing) {
    await supabase
      .from("operational_embeddings")
      .update({ embedding, content })
      .eq("id", existing.id);
    return { status: "updated", id: existing.id, chars: content.length };
  } else {
    const { data, error } = await supabase
      .from("operational_embeddings")
      .insert([{ record_type: recordType, record_id: recordId, embedding, content }])
      .select("id")
      .single();
    if (error) {
      console.error("[generate-embedding] insert error:", error);
      return { status: "failed", reason: error.message };
    }
    return { status: "created", id: data?.id, chars: content.length };
  }
}
