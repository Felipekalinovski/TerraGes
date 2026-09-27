import { supabase } from './supabaseClient';

export type BillingDocumentType = 'nfse' | 'receipt' | 'deferred';
export type BillingDocumentStatus = 'awaiting_approval' | 'ready' | 'issued' | 'deferred' | 'cancelled' | 'error';
export type ChargeMethod = 'pix' | 'boleto' | 'transferencia' | 'dinheiro' | 'cartao' | 'outro';
export type ChargeStatus = 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface BillingServiceOrderSummary {
  id: string;
  date: string;
  client: string;
  total_value: number;
  description?: string | null;
  billing_document_type: BillingDocumentType;
  billing_document_status: string;
}

export interface BillingDocument {
  id: string;
  company_id: string;
  service_order_id?: string | null;
  measurement_id?: string | null;
  document_type: BillingDocumentType;
  status: BillingDocumentStatus;
  amount: number;
  document_number?: string | null;
  issued_at?: string | null;
  approved_at?: string | null;
  created_at: string;
  service_order?: BillingServiceOrderSummary | null;
  measurement?: {
    id: string;
    client: string;
    period_start: string;
    period_end: string;
    status: string;
    total_value: number;
  } | null;
}

export interface BillingCharge {
  id: string;
  company_id: string;
  billing_document_id?: string | null;
  transaction_id?: string | null;
  client: string;
  amount: number;
  due_date?: string | null;
  method?: ChargeMethod | null;
  status: ChargeStatus;
  paid_at?: string | null;
  created_at: string;
}

export interface ServiceMeasurement {
  id: string;
  client: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'approved' | 'billed' | 'cancelled';
  total_value: number;
  created_at: string;
  items?: Array<{
    id: string;
    service_order_id: string;
    amount: number;
  }>;
}

const singleRelation = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

export const workToCashService = {
  async getDocuments(): Promise<BillingDocument[]> {
    const { data, error } = await supabase
      .from('billing_documents')
      .select(`
        id, company_id, service_order_id, measurement_id, document_type, status, amount,
        document_number, issued_at, approved_at, created_at,
        service_order:service_orders(
          id, date, client, total_value, description,
          billing_document_type, billing_document_status
        ),
        measurement:service_measurements(
          id, client, period_start, period_end, status, total_value
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      amount: Number(row.amount || 0),
      service_order: singleRelation(row.service_order),
      measurement: singleRelation(row.measurement),
    }));
  },

  async getCharges(): Promise<BillingCharge[]> {
    const { data, error } = await supabase
      .from('billing_charges')
      .select('id, company_id, billing_document_id, transaction_id, client, amount, due_date, method, status, paid_at, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({ ...row, amount: Number(row.amount || 0) }));
  },

  async getMeasurements(): Promise<ServiceMeasurement[]> {
    const { data, error } = await supabase
      .from('service_measurements')
      .select(`
        id, client, period_start, period_end, status, total_value, created_at,
        items:service_measurement_items(id, service_order_id, amount)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      total_value: Number(row.total_value || 0),
      items: (row.items || []).map((item: any) => ({ ...item, amount: Number(item.amount || 0) })),
    }));
  },

  async createMeasurement(serviceOrderIds: string[]): Promise<string> {
    const { data, error } = await supabase.rpc('create_service_measurement_from_orders', {
      p_service_order_ids: serviceOrderIds,
    });
    if (error) throw error;
    return data as string;
  },

  async approveNfse(documentId: string): Promise<string> {
    const { data, error } = await supabase.rpc('approve_nfse_document', {
      p_document_id: documentId,
    });
    if (error) throw error;
    return data as string;
  },

  async createCharge(documentId: string, dueDate: string, method: ChargeMethod): Promise<string> {
    const { data, error } = await supabase.rpc('create_billing_charge', {
      p_document_id: documentId,
      p_due_date: dueDate,
      p_method: method,
    });
    if (error) throw error;
    return data as string;
  },

  async confirmPayment(chargeId: string): Promise<string> {
    const { data, error } = await supabase.rpc('confirm_billing_charge_payment', {
      p_charge_id: chargeId,
    });
    if (error) throw error;
    return data as string;
  },
};

export function workToCashErrorMessage(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String((error as any).message) : String(error || '');
  if (message.includes('measurement_requires_single_client')) return 'Uma medição deve reunir serviços do mesmo cliente.';
  if (message.includes('service_order_already_measured')) return 'Uma das OS selecionadas já pertence a outra medição.';
  if (message.includes('service_order_not_billable')) return 'Só é possível medir OS concluídas e disponíveis para faturamento.';
  if (message.includes('duplicate_service_order')) return 'Há uma OS duplicada na seleção.';
  if (message.includes('nfse_document_not_approvable')) return 'Esta NFS-e não está aguardando aprovação.';
  if (message.includes('charge_already_exists')) return 'Este documento já possui uma cobrança ativa.';
  if (message.includes('document_not_chargeable')) return 'O documento ainda não está pronto para cobrança.';
  if (message.includes('manager_required')) return 'Esta ação exige um administrador ou gestor.';
  return 'Não foi possível concluir a operação de faturamento. Atualize a tela e tente novamente.';
}
