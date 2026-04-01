import { supabase } from './supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HoraMaquina {
  id: string;
  user_id: string;

  machine_id?: string;
  machine_name: string;
  operator_name?: string;
  project_name: string;
  client_name?: string;

  date: string;          // YYYY-MM-DD
  start_time: string;    // HH:MM
  end_time: string;      // HH:MM
  total_hours: number;
  break_minutes: number;

  hourly_rate: number;
  total_value: number;

  service_type?: string;
  observations?: string;
  photo_url?: string;

  created_at: string;
}

export type HoraMaquinaFormData = Omit<HoraMaquina, 'id' | 'user_id' | 'created_at'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calcula horas totais dado início, fim e pausa em minutos */
export function calcTotalHours(
  startTime: string,
  endTime: string,
  breakMinutes = 0,
): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm) - breakMinutes;
  return Math.max(0, Math.round((totalMinutes / 60) * 100) / 100);
}

export function formatHours(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${String(minutes).padStart(2, '0')}min`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const horaMaquinaService = {
  async getAll(): Promise<HoraMaquina[]> {
    const { data, error } = await supabase
      .from('hora_maquina')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByProject(projectName: string): Promise<HoraMaquina[]> {
    const { data, error } = await supabase
      .from('hora_maquina')
      .select('*')
      .ilike('project_name', `%${projectName}%`)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByDateRange(from: string, to: string): Promise<HoraMaquina[]> {
    const { data, error } = await supabase
      .from('hora_maquina')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(formData: HoraMaquinaFormData): Promise<HoraMaquina> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('hora_maquina')
      .insert([{ ...formData, user_id: user?.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, formData: Partial<HoraMaquinaFormData>): Promise<HoraMaquina> {
    const { data, error } = await supabase
      .from('hora_maquina')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('hora_maquina')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /** Sumário agrupado por projeto — para o Relatório do Cliente */
  async getSummaryByProject(): Promise<
    Array<{
      project_name: string;
      client_name: string;
      total_hours: number;
      total_value: number;
      machine_count: number;
      last_date: string;
      records: HoraMaquina[];
    }>
  > {
    const { data, error } = await supabase
      .from('hora_maquina')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;

    const map = new Map<string, typeof result[0]>();
    const result: Array<{
      project_name: string;
      client_name: string;
      total_hours: number;
      total_value: number;
      machine_count: number;
      last_date: string;
      records: HoraMaquina[];
    }> = [];

    (data || []).forEach(row => {
      const key = row.project_name;
      if (!map.has(key)) {
        const entry = {
          project_name: row.project_name,
          client_name: row.client_name ?? '',
          total_hours: 0,
          total_value: 0,
          machine_count: 0,
          last_date: row.date,
          records: [] as HoraMaquina[],
        };
        map.set(key, entry);
        result.push(entry);
      }
      const entry = map.get(key)!;
      entry.total_hours  += row.total_hours  ?? 0;
      entry.total_value  += row.total_value  ?? 0;
      entry.machine_count = new Set([...entry.records.map(r => r.machine_name), row.machine_name]).size;
      if (row.date > entry.last_date) entry.last_date = row.date;
      entry.records.push(row);
    });

    return result;
  },

  async getMonthStats(): Promise<{
    totalHours: number;
    totalValue: number;
    recordCount: number;
  }> {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('hora_maquina')
      .select('total_hours, total_value')
      .gte('date', from)
      .lte('date', to);

    if (error) throw error;

    return {
      totalHours:  data?.reduce((s, r) => s + (r.total_hours ?? 0), 0) ?? 0,
      totalValue:  data?.reduce((s, r) => s + (r.total_value ?? 0), 0) ?? 0,
      recordCount: data?.length ?? 0,
    };
  },
};
