import { supabase } from './supabaseClient';

export type FieldMachineOption = {
  id: string;
  name: string;
  type: string;
};

export type FieldServiceEntry = {
  id: string;
  company_id: string;
  submitted_by: string;
  source: 'app' | 'whatsapp' | 'import';
  service_date: string;
  client_name: string;
  location?: string | null;
  machine_id: string;
  start_meter: number;
  end_meter: number;
  total_hours: number;
  description: string;
  occurrences?: string | null;
  status: 'submitted' | 'converted' | 'rejected';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  service_order_id?: string | null;
  created_at: string;
  machine?: { name: string; type: string } | null;
  operator_name?: string | null;
};

export type FieldServiceEntryInput = {
  serviceDate: string;
  clientName: string;
  location?: string;
  machineId: string;
  startMeter: number;
  endMeter: number;
  description: string;
  occurrences?: string;
};

const relationOne = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export const fieldEntryService = {
  async getMachineOptions(): Promise<FieldMachineOption[]> {
    const { data, error } = await supabase.rpc('get_operator_machine_options');
    if (error) throw error;
    return (data || []) as FieldMachineOption[];
  },

  async submit(input: FieldServiceEntryInput): Promise<void> {
    const { error } = await supabase.rpc('submit_field_service_entry', {
      p_service_date: input.serviceDate,
      p_client_name: input.clientName,
      p_location: input.location || null,
      p_machine_id: input.machineId,
      p_start_meter: input.startMeter,
      p_end_meter: input.endMeter,
      p_description: input.description,
      p_occurrences: input.occurrences || null,
      p_source: 'app',
    });
    if (error) throw error;
  },

  async getPending(): Promise<FieldServiceEntry[]> {
    const { data, error } = await supabase
      .from('field_service_entries')
      .select(`
        id, company_id, submitted_by, source, service_date, client_name, location,
        machine_id, start_meter, end_meter, total_hours, description, occurrences,
        status, reviewed_by, reviewed_at, service_order_id, created_at,
        machine:machines(name,type)
      `)
      .eq('status', 'submitted')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (data || []).map((row: any) => ({
      ...row,
      start_meter: Number(row.start_meter || 0),
      end_meter: Number(row.end_meter || 0),
      total_hours: Number(row.total_hours || 0),
      machine: relationOne(row.machine),
    })) as FieldServiceEntry[];

    const userIds = Array.from(new Set(rows.map(row => row.submitted_by).filter(Boolean)));
    if (!userIds.length) return rows;

    const { data: employees } = await supabase
      .from('employees')
      .select('user_id,name')
      .in('user_id', userIds);

    const names = new Map((employees || []).map((item: any) => [item.user_id, item.name]));
    return rows.map(row => ({ ...row, operator_name: names.get(row.submitted_by) || 'Operador' }));
  },

  async convert(
    entryId: string,
    hourlyRate: number,
    billingDocumentType: 'accountant' | 'receipt' | 'deferred',
    paymentMethod: 'Pix' | 'Cartão' | 'Boleto' | 'Faturado' | 'Dinheiro',
  ): Promise<string> {
    const { data, error } = await supabase.rpc('convert_field_entry_to_service_order', {
      p_entry_id: entryId,
      p_hourly_rate: hourlyRate,
      p_billing_document_type: billingDocumentType,
      p_payment_method: paymentMethod,
    });
    if (error) throw error;
    return data as string;
  },

  async reject(entryId: string, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('reject_field_service_entry', {
      p_entry_id: entryId,
      p_reason: reason || null,
    });
    if (error) throw error;
  },
};

export function fieldEntryErrorMessage(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as any).message)
    : String(error || '');

  if (message.includes('machine_not_assigned') || message.includes('field_entry_not_allowed')) {
    return 'Seu usuário não está autorizado a registrar esta máquina.';
  }
  if (message.includes('invalid_meter_range')) {
    return 'Confira o horímetro inicial e final. O final deve ser maior e a diferença máxima por registro é 24 horas.';
  }
  if (message.includes('field_entry_not_available')) {
    return 'Este registro já foi processado por outro gestor.';
  }
  if (message.includes('manager_required')) {
    return 'Esta ação é exclusiva de administrador ou gestor.';
  }
  return 'Não foi possível concluir a operação. Confira os dados e tente novamente.';
}
