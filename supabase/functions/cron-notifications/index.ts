import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "http://evo-kapy4bp2jpo0hdbghy3gw5vy.137.131.236.148.sslip.io").replace(/\/$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "terrages";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function fmtCurrency(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

// ─── Geradores de mensagem ──────────────────────────────────

async function generateEndOfShift(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: os } = await supabase
    .from("service_orders")
    .select("total_hours, total_value")
    .eq("date", today)
    .neq("status", "cancelled");

  const { data: hours } = await supabase
    .from("hora_maquina")
    .select("total_hours, total_value")
    .eq("date", today);

  const totalOS = os?.reduce((s: number, r: any) => s + Number(r.total_hours || 0), 0) || 0;
  const valueOS = os?.reduce((s: number, r: any) => s + Number(r.total_value || 0), 0) || 0;
  const totalMH = hours?.reduce((s: number, r: any) => s + Number(r.total_hours || 0), 0) || 0;
  const valueMH = hours?.reduce((s: number, r: any) => s + Number(r.total_value || 0), 0) || 0;

  return `📋 *Resumo do Turno — ${today}*\n\n` +
    `🔧 Ordens de Serviço: ${os?.length || 0} (${totalOS}h — ${fmtCurrency(valueOS)})\n` +
    `⏱️ Horas-Máquina: ${hours?.length || 0} registros (${totalMH}h — ${fmtCurrency(valueMH)})`;
}

async function generatePendingPayments(): Promise<string> {
  const { data: pending } = await supabase
    .from("service_orders")
    .select("client, date, total_value, payment_method")
    .eq("status", "completed")
    .is("receipt_url", null)
    .limit(5);

  if (!pending?.length) return "✅ Nenhum pagamento pendente hoje!";

  let msg = `💳 *Pagamentos Pendentes*\n\n`;
  for (const p of pending) {
    msg += `• ${p.client} — ${fmtCurrency(p.total_value || 0)} (${p.payment_method || "—"})\n`;
  }
  msg += `\nTotal: ${pending.length} pendentes`;
  return msg;
}

async function generateMachineMaintenance(): Promise<string> {
  const { data: machines } = await supabase
    .from("machines")
    .select("name, next_maintenance, health_status, hours")
    .neq("status", "inactive");

  if (!machines?.length) return "Nenhuma máquina cadastrada.";

  const now = new Date();
  const alerts: string[] = [];
  for (const m of machines) {
    if (m.next_maintenance) {
      const diff = (new Date(m.next_maintenance).getTime() - now.getTime()) / 86400000;
      if (diff <= 7 && diff >= 0) {
        alerts.push(`⚠️ ${m.name} — vence em ${Math.ceil(diff)} dias (${m.next_maintenance})`);
      }
      if (diff < 0) {
        alerts.push(`🔴 ${m.name} — *VENCIDA* (${m.next_maintenance})`);
      }
    }
    if (m.health_status === "crítico") {
      alerts.push(`🆘 ${m.name} — health crítico`);
    }
  }

  if (!alerts.length) return "✅ Todas as máquinas em dia.";

  return `🔧 *Manutenções*\n\n` + alerts.join("\n") + `\n\nAcesse o app para mais detalhes.`;
}

async function generateDailyReport(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: osWeek } = await supabase
    .from("service_orders")
    .select("total_value")
    .gte("date", weekAgo)
    .neq("status", "cancelled");

  const { data: hoursWeek } = await supabase
    .from("hora_maquina")
    .select("total_hours")
    .gte("date", weekAgo);

  const revenue = osWeek?.reduce((s: number, r: any) => s + Number(r.total_value || 0), 0) || 0;
  const hoursTotal = hoursWeek?.reduce((s: number, r: any) => s + Number(r.total_hours || 0), 0) || 0;
  const osCount = osWeek?.length || 0;

  return `📊 *Relatório Semanal*\n\n` +
    `Período: ${weekAgo.slice(0, 10)} a ${today}\n\n` +
    `💰 Receita: ${fmtCurrency(revenue)}\n` +
    `📋 OS realizadas: ${osCount}\n` +
    `⏱️ Horas registradas: ${hoursTotal}h`;
}

const generators: Record<string, () => Promise<string>> = {
  end_of_shift: generateEndOfShift,
  pending_payments: generatePendingPayments,
  machine_maintenance: generateMachineMaintenance,
  daily_report: generateDailyReport,
};

// ─── Envio via Evolution API v2 ────────────────────────────

async function sendMessage(to: string, text: string): Promise<void> {
  const number = to.includes("@s.whatsapp.net") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({ number, text, delay: -1 }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[CRON] Erro ao enviar para ${to}: ${res.status}: ${err}`);
  }
}

// ─── Agendamento Recorrente ────────────────────────────────

function nextWeekdayTime(weekday: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  if (d <= new Date()) d.setDate(d.getDate() + 7);
  return d;
}

function nextDailyTime(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}

async function scheduleRecurring(): Promise<void> {
  const now = new Date();

  // End of shift: hoje 18:00 (dias úteis)
  const eos = nextDailyTime(18, 0);
  if (eos.getDay() >= 1 && eos.getDay() <= 5) {
    const { data: existing } = await supabase.from("scheduled_notifications")
      .select("id").eq("type", "end_of_shift").gte("scheduled_time", now.toISOString()).limit(1);
    if (!existing?.length) {
      await supabase.from("scheduled_notifications").insert([{
        type: "end_of_shift", target_role: "operator",
        message: "Resumo do turno", scheduled_time: eos.toISOString(),
      }]);
    }
  }

  // Pending payments: hoje 09:00
  const pp = nextDailyTime(9, 0);
  const { data: existingPp } = await supabase.from("scheduled_notifications")
    .select("id").eq("type", "pending_payments").gte("scheduled_time", now.toISOString()).limit(1);
  if (!existingPp?.length) {
    await supabase.from("scheduled_notifications").insert([{
      type: "pending_payments", target_role: "admin",
      message: "Pagamentos pendentes", scheduled_time: pp.toISOString(),
    }]);
  }

  // Maintenance: segunda 08:00
  const mm = nextWeekdayTime(1, 8, 0);
  const { data: existingMm } = await supabase.from("scheduled_notifications")
    .select("id").eq("type", "machine_maintenance").gte("scheduled_time", now.toISOString()).limit(1);
  if (!existingMm?.length) {
    await supabase.from("scheduled_notifications").insert([{
      type: "machine_maintenance", target_role: "manager",
      message: "Manutenções pendentes", scheduled_time: mm.toISOString(),
    }]);
  }

  // Daily report: domingo 10:00
  const dr = nextWeekdayTime(0, 10, 0);
  const { data: existingDr } = await supabase.from("scheduled_notifications")
    .select("id").eq("type", "daily_report").gte("scheduled_time", now.toISOString()).limit(1);
  if (!existingDr?.length) {
    await supabase.from("scheduled_notifications").insert([{
      type: "daily_report", target_role: "admin",
      message: "Relatório semanal", scheduled_time: dr.toISOString(),
    }]);
  }
}

// ─── Processamento Principal ───────────────────────────────

async function sendScheduledNotifications(): Promise<{ sent: number; errors: number }> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60000).toISOString();

  const { data: notifications } = await supabase
    .from("scheduled_notifications")
    .select("*")
    .eq("sent", false)
    .lte("scheduled_time", windowEnd);

  if (!notifications?.length) {
    console.log("[CRON] Nenhuma notificação pendente.");
    return { sent: 0, errors: 0 };
  }

  let sent = 0, errors = 0;

  for (const n of notifications) {
    const { data: users } = await supabase
      .from("profiles")
      .select("phone")
      .eq("role", n.target_role);

    if (!users?.length) {
      console.log(`[CRON] Sem usuários para role=${n.target_role}`);
      await supabase.from("scheduled_notifications").update({ sent: true }).eq("id", n.id);
      continue;
    }

    // Gera mensagem dinâmica
    const generate = generators[n.type as keyof typeof generators];
    const message = generate ? await generate() : n.message;

    for (const user of users) {
      try {
        await sendMessage(user.phone, message);
        sent++;
      } catch (e) {
        console.error(`[CRON] Erro ao enviar para ${user.phone}:`, e);
        errors++;
      }
    }

    await supabase.from("scheduled_notifications").update({ sent: true }).eq("id", n.id);
  }

  return { sent, errors };
}

// ─── Handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    // Agenda notificações recorrentes se necessário
    await scheduleRecurring();

    // Envia notificações pendentes
    const result = await sendScheduledNotifications();
    console.log(`[CRON] Enviadas: ${result.sent}, Erros: ${result.errors}`);

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200, headers: corsHeaders,
    });
  } catch (error: any) {
    console.error("[CRON] Erro:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders,
    });
  }
});
