import { supabase } from './supabaseClient';

export type BillingDocumentType = 'nfse' | 'accountant' | 'receipt' | 'deferred';
export type BillingDocumentStatus =
  | 'awaiting_approval'
  | 'issued'
  | 'awaiting_client_data'
  | 'ready'
  | 'sent_to_accountant'
  | 'external_invoice_recorded'
  | 'deferred'
  | 'cancelled'
  | 'error';
export type ChargeMethod = 'pix' | 'boleto' | 'transferencia' | 'dinheiro' | 'cartao' | 'outro';
export type ChargeStatus = 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface BillingClient {
  id: string;
  name: string;
  legal_name?: string | null;
  document_type?: 'cpf' | 'cnpj' | 'other' | null;
  document_number?: string | null;
  email?: string | null;
  phone?: string | null;
  billing_email?: string | null;
  billing_contact?: string | null;
  address_line?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  notes?: string | null;
}

export type BillingClientInput = Omit<BillingClient, 'id'>;

export interface BillingServiceOrderSummary {
  id: string;
  date: string;
  client: string;
  client_id?: string | null;
  total_value: number;
  description?: string | null;
  billing_document_type: BillingDocumentType;
  billing_document_status: string;
}

export interface BillingPackageService {
  service_order_id?: string;
  date?: string;
  description?: string;
  location?: string;
  machine?: string;
  operator?: string;
  start_hour?: number;
  end_hour?: number;
  total_hours?: number;
  hourly_rate?: number;
  total_value?: number;
}

export interface AccountantBillingPackage {
  version?: number;
  prepared_at?: string;
  company?: { name?: string };
  client?: Partial<BillingClient>;
  source?: 'service_order' | 'measurement';
  service_order_id?: string;
  measurement_id?: string;
  services?: BillingPackageService[];
  total_value?: number;
  instructions?: string;
}

export interface BillingDocument {
  id: string;
  company_id: string;
  service_order_id?: string | null;
  measurement_id?: string | null;
  client_id?: string | null;
  document_type: BillingDocumentType;
  status: BillingDocumentStatus;
  amount: number;
  document_number?: string | null;
  external_invoice_date?: string | null;
  issued_at?: string | null;
  prepared_at?: string | null;
  sent_to_accountant_at?: string | null;
  sent_channel?: string | null;
  package_data?: AccountantBillingPackage | null;
  created_at: string;
  client_profile?: BillingClient | null;
  service_order?: BillingServiceOrderSummary | null;
  measurement?: {
    id: string;
    client: string;
    client_id?: string | null;
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
  client_id?: string | null;
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

const compact = (value?: string | null) => value?.trim() || '';

export const workToCashService = {
  async getDocuments(): Promise<BillingDocument[]> {
    const { data, error } = await supabase
      .from('billing_documents')
      .select(`
        id, company_id, service_order_id, measurement_id, client_id, document_type, status, amount,
        document_number, external_invoice_date, issued_at, prepared_at, sent_to_accountant_at,
        sent_channel, package_data, created_at,
        client_profile:clients(
          id, name, legal_name, document_type, document_number, email, phone,
          billing_email, billing_contact, address_line, address_number,
          address_complement, neighborhood, city, state, postal_code, notes
        ),
        service_order:service_orders(
          id, date, client, client_id, total_value, description,
          billing_document_type, billing_document_status
        ),
        measurement:service_measurements(
          id, client, client_id, period_start, period_end, status, total_value
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      amount: Number(row.amount || 0),
      client_profile: singleRelation(row.client_profile),
      service_order: singleRelation(row.service_order),
      measurement: singleRelation(row.measurement),
    }));
  },

  async getClients(): Promise<BillingClient[]> {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        id, name, legal_name, document_type, document_number, email, phone,
        billing_email, billing_contact, address_line, address_number,
        address_complement, neighborhood, city, state, postal_code, notes
      `)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as BillingClient[];
  },

  async saveClient(input: BillingClientInput, id?: string | null): Promise<string> {
    const { data, error } = await supabase.rpc('save_client_billing_profile', {
      p_client_id: id || null,
      p_data: input,
    });
    if (error) throw error;
    return data as string;
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
        id, client, client_id, period_start, period_end, status, total_value, created_at,
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

  async prepareAccountantPackage(documentId: string, clientId: string): Promise<AccountantBillingPackage> {
    const { data, error } = await supabase.rpc('prepare_accountant_billing_package', {
      p_document_id: documentId,
      p_client_id: clientId,
    });
    if (error) throw error;
    return data as AccountantBillingPackage;
  },

  async markPackageSent(documentId: string, channel: 'manual' | 'whatsapp' | 'email' | 'copy' | 'other' = 'manual'): Promise<string> {
    const { data, error } = await supabase.rpc('mark_billing_package_sent', {
      p_document_id: documentId,
      p_channel: channel,
    });
    if (error) throw error;
    return data as string;
  },

  async recordExternalInvoice(documentId: string, invoiceNumber: string, invoiceDate: string): Promise<string> {
    const { data, error } = await supabase.rpc('record_external_invoice', {
      p_document_id: documentId,
      p_invoice_number: invoiceNumber,
      p_invoice_date: invoiceDate,
    });
    if (error) throw error;
    return data as string;
  },

  async resumeDeferred(documentId: string): Promise<string> {
    const { data, error } = await supabase.rpc('resume_deferred_billing_document', {
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

export function formatAccountantPackage(pkg: AccountantBillingPackage): string {
  const client = pkg.client || {};
  const services = pkg.services || [];
  const money = (value: number | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  const address = [
    compact(client.address_line),
    compact(client.address_number),
    compact(client.address_complement),
    compact(client.neighborhood),
    [compact(client.city), compact(client.state)].filter(Boolean).join('/'),
    compact(client.postal_code),
  ].filter(Boolean).join(' · ');

  const lines = [
    'DADOS PARA FATURAMENTO — TERRAGES',
    '',
    `Empresa prestadora: ${pkg.company?.name || 'Não informada'}`,
    '',
    'CLIENTE',
    `Nome: ${client.name || 'Não informado'}`,
    client.legal_name ? `Razão social: ${client.legal_name}` : '',
    `${String(client.document_type || 'documento').toUpperCase()}: ${client.document_number || 'Não informado'}`,
    client.billing_contact ? `Contato faturamento: ${client.billing_contact}` : '',
    client.billing_email ? `E-mail faturamento: ${client.billing_email}` : client.email ? `E-mail: ${client.email}` : '',
    client.phone ? `Telefone: ${client.phone}` : '',
    address ? `Endereço: ${address}` : '',
    '',
    'SERVIÇOS',
    ...services.flatMap((service, index) => [
      `${index + 1}. ${service.description || 'Serviço executado'}`,
      service.date ? `   Data: ${service.date}` : '',
      service.location ? `   Local: ${service.location}` : '',
      service.machine ? `   Máquina: ${service.machine}` : '',
      service.operator ? `   Operador: ${service.operator}` : '',
      service.total_hours !== undefined ? `   Horas: ${service.total_hours}` : '',
      service.hourly_rate !== undefined ? `   Valor/hora: ${money(service.hourly_rate)}` : '',
      service.total_value !== undefined ? `   Total: ${money(service.total_value)}` : '',
    ].filter(Boolean)),
    '',
    `VALOR TOTAL A FATURAR: ${money(pkg.total_value)}`,
    '',
    'Observação: dados organizados pelo TerraGes para conferência e emissão fiscal externa pelo contador ou sistema fiscal da empresa.',
  ];

  return lines.filter((line, index) => line !== '' || lines[index - 1] !== '').join('\n').trim();
}

export function workToCashErrorMessage(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String((error as any).message) : String(error || '');
  if (message.includes('measurement_requires_single_client')) return 'Uma medição deve reunir serviços do mesmo cliente.';
  if (message.includes('service_order_already_measured')) return 'Uma das OS selecionadas já pertence a outra medição.';
  if (message.includes('service_order_billing_already_progressed')) return 'Uma das OS já foi enviada ao contador ou possui cobrança.';
  if (message.includes('service_order_not_billable')) return 'Só é possível medir OS concluídas marcadas para envio ao contador.';
  if (message.includes('duplicate_service_order')) return 'Há uma OS duplicada na seleção.';
  if (message.includes('client_billing_data_incomplete')) return 'Informe ao menos o nome e CPF/CNPJ do cliente antes de preparar o pacote.';
  if (message.includes('client_not_available')) return 'O cadastro do cliente não está disponível para esta empresa.';
  if (message.includes('billing_package_not_preparable')) return 'Este pacote não está disponível para preparação.';
  if (message.includes('billing_package_not_sendable')) return 'Este pacote ainda não está pronto para ser marcado como enviado.';
  if (message.includes('external_invoice_not_recordable')) return 'A nota externa não pode ser registrada neste estágio.';
  if (message.includes('invalid_external_invoice')) return 'Informe o número e a data da nota emitida externamente.';
  if (message.includes('deferred_document_not_resumable')) return 'Este faturamento adiado já foi retomado ou não está disponível.';
  if (message.includes('charge_already_exists')) return 'Este documento já possui uma cobrança ativa.';
  if (message.includes('document_not_chargeable')) return 'O documento ainda não está pronto para cobrança.';
  if (message.includes('clients_company_document_unique')) return 'Já existe um cliente com este CPF/CNPJ.';
  if (message.includes('manager_required')) return 'Esta ação exige um administrador ou gestor.';
  return 'Não foi possível concluir a operação de faturamento. Atualize a tela e tente novamente.';
}
