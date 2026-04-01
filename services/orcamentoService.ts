import { supabase } from './supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrcamentoStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado';

export interface OrcamentoMachine {
  machine_id: string;
  machine_name: string;
  hourly_rate: number;
  estimated_hours: number;
}

export interface Orcamento {
  id: string;
  user_id: string;
  number: number;

  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_address?: string;

  service_type: string;
  location?: string;
  description?: string;
  machines: OrcamentoMachine[];

  hourly_rate: number;
  estimated_hours: number;
  total_value: number;
  discount: number;
  notes?: string;

  status: OrcamentoStatus;
  valid_until?: string;

  created_at: string;
  updated_at: string;
}

export type OrcamentoFormData = Omit<Orcamento, 'id' | 'user_id' | 'number' | 'created_at' | 'updated_at'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calcTotalValue(
  hourlyRate: number,
  estimatedHours: number,
  discount = 0,
): number {
  return Math.max(0, hourlyRate * estimatedHours - discount);
}

export function formatOrcamentoNumber(n: number): string {
  return `ORC-${String(n).padStart(4, '0')}`;
}

export const STATUS_CONFIG: Record<OrcamentoStatus, { label: string; color: string; bg: string }> = {
  rascunho: { label: 'Rascunho',  color: 'text-gray-400',    bg: 'bg-gray-400/15' },
  enviado:  { label: 'Enviado',   color: 'text-blue-400',    bg: 'bg-blue-400/15' },
  aprovado: { label: 'Aprovado',  color: 'text-positive',    bg: 'bg-positive/15' },
  recusado: { label: 'Recusado',  color: 'text-negative',    bg: 'bg-negative/15' },
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const orcamentoService = {
  async getAll(): Promise<Orcamento[]> {
    const { data, error } = await supabase
      .from('orcamentos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => ({ ...row, machines: row.machines ?? [] }));
  },

  async getById(id: string): Promise<Orcamento | null> {
    const { data, error } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data ? { ...data, machines: data.machines ?? [] } : null;
  },

  async create(formData: OrcamentoFormData): Promise<Orcamento> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('orcamentos')
      .insert([{ ...formData, user_id: user?.id }])
      .select()
      .single();

    if (error) throw error;
    return { ...data, machines: data.machines ?? [] };
  },

  async update(id: string, formData: Partial<OrcamentoFormData>): Promise<Orcamento> {
    const { data, error } = await supabase
      .from('orcamentos')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { ...data, machines: data.machines ?? [] };
  },

  async updateStatus(id: string, status: OrcamentoStatus): Promise<void> {
    const { error } = await supabase
      .from('orcamentos')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('orcamentos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getStats(): Promise<{
    total: number;
    aprovados: number;
    pendentes: number;
    valorTotal: number;
    valorAprovado: number;
  }> {
    const { data, error } = await supabase
      .from('orcamentos')
      .select('status, total_value');

    if (error) throw error;

    const stats = {
      total: data?.length ?? 0,
      aprovados: 0,
      pendentes: 0,
      valorTotal: 0,
      valorAprovado: 0,
    };

    data?.forEach(row => {
      stats.valorTotal += row.total_value ?? 0;
      if (row.status === 'aprovado') {
        stats.aprovados++;
        stats.valorAprovado += row.total_value ?? 0;
      }
      if (row.status === 'enviado' || row.status === 'rascunho') {
        stats.pendentes++;
      }
    });

    return stats;
  },
};
