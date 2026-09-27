import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Copy,
  CreditCard,
  FileCheck2,
  FileText,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { generateReport } from '../services/aiService';
import { serviceOrderErrorMessage } from '../services/serviceOrderRules';
import { transactionService, type Transaction as SupabaseTransaction } from '../services/transactionService';
import {
  formatAccountantPackage,
  workToCashService,
  workToCashErrorMessage,
  type BillingCharge,
  type BillingClient,
  type BillingClientInput,
  type BillingDocument,
  type ChargeMethod,
  type ServiceMeasurement,
} from '../services/workToCashService';

type FinanceTab = 'overview' | 'billing' | 'receivables' | 'transactions';
type ClientForm = BillingClientInput & { document_type?: 'cpf' | 'cnpj' | 'other' | '' };

const localDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const datePlusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
};

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const shortMoney = (value: number) => {
  if (Math.abs(value) < 1000) return money(value);
  return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem data';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString('pt-BR');
};

const emptyClient = (name = ''): ClientForm => ({
  name,
  legal_name: '',
  document_type: 'cnpj',
  document_number: '',
  email: '',
  phone: '',
  billing_email: '',
  billing_contact: '',
  address_line: '',
  address_number: '',
  address_complement: '',
  neighborhood: '',
  city: '',
  state: '',
  postal_code: '',
  notes: '',
});

const fromClient = (client: BillingClient): ClientForm => ({
  name: client.name || '',
  legal_name: client.legal_name || '',
  document_type: client.document_type || 'cnpj',
  document_number: client.document_number || '',
  email: client.email || '',
  phone: client.phone || '',
  billing_email: client.billing_email || '',
  billing_contact: client.billing_contact || '',
  address_line: client.address_line || '',
  address_number: client.address_number || '',
  address_complement: client.address_complement || '',
  neighborhood: client.neighborhood || '',
  city: client.city || '',
  state: client.state || '',
  postal_code: client.postal_code || '',
  notes: client.notes || '',
});

const documentLabel = (document: BillingDocument) => {
  if (document.document_type === 'accountant') return 'Dados para contador';
  if (document.document_type === 'deferred') return 'Faturar depois';
  if (document.document_type === 'nfse') return 'Fluxo fiscal antigo';
  return 'OS / recibo';
};

const statusLabel = (document: BillingDocument) => {
  const labels: Record<string, string> = {
    awaiting_approval: 'Fluxo antigo',
    issued: 'Nota registrada (legado)',
    awaiting_client_data: 'Faltam dados do cliente',
    ready: document.document_type === 'accountant' ? 'Pacote pronto' : 'Pronto para cobrança',
    sent_to_accountant: 'Enviado ao contador',
    external_invoice_recorded: 'Nota externa registrada',
    deferred: 'Adiado',
    cancelled: 'Consolidado/cancelado',
    error: 'Erro',
  };
  return labels[document.status] || document.status;
};

export const Finance: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [transactions, setTransactions] = useState<SupabaseTransaction[]>([]);
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [charges, setCharges] = useState<BillingCharge[]>([]);
  const [measurements, setMeasurements] = useState<ServiceMeasurement[]>([]);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    byCategory: {} as Record<string, number>,
  });

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [packageTarget, setPackageTarget] = useState<BillingDocument | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClient());

  const [invoiceTarget, setInvoiceTarget] = useState<BillingDocument | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ number: '', date: localDate() });

  const [chargeTarget, setChargeTarget] = useState<BillingDocument | null>(null);
  const [chargeForm, setChargeForm] = useState<{ dueDate: string; method: ChargeMethod }>({
    dueDate: datePlusDays(7),
    method: 'pix',
  });

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const linkedOrderId = transactions.find(t => t.id === editingId)?.service_order_id;
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    title: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    status: 'paid' as 'paid' | 'pending',
    category: '',
    date: localDate(),
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [transactionData, statsData, documentData, chargeData, measurementData, clientData] = await Promise.all([
        transactionService.getAll(),
        transactionService.getStats(),
        workToCashService.getDocuments(),
        workToCashService.getCharges(),
        workToCashService.getMeasurements(),
        workToCashService.getClients(),
      ]);
      setTransactions(transactionData);
      setStats(statsData);
      setDocuments(documentData);
      setCharges(chargeData);
      setMeasurements(measurementData);
      setClients(clientData);
    } catch (error) {
      console.error('Error loading finance pipeline:', error);
      alert('Não foi possível carregar o Financeiro. Atualize a página e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const measuredOrderIds = useMemo(
    () => new Set(measurements.flatMap(measurement => (measurement.items || []).map(item => item.service_order_id))),
    [measurements],
  );

  const activeChargeByDocument = useMemo(() => {
    const map = new Map<string, BillingCharge>();
    charges
      .filter(charge => charge.status !== 'cancelled' && charge.billing_document_id)
      .forEach(charge => map.set(charge.billing_document_id!, charge));
    return map;
  }, [charges]);

  const chargeByTransaction = useMemo(() => {
    const map = new Map<string, BillingCharge>();
    charges
      .filter(charge => charge.status !== 'cancelled' && charge.transaction_id)
      .forEach(charge => map.set(charge.transaction_id!, charge));
    return map;
  }, [charges]);

  const pendingIncome = useMemo(
    () => transactions.filter(transaction => transaction.type === 'income' && transaction.status === 'pending'),
    [transactions],
  );

  const paidIncome = useMemo(
    () => transactions.filter(transaction => transaction.type === 'income' && transaction.status === 'paid'),
    [transactions],
  );

  const toBillDocuments = useMemo(
    () =>
      documents.filter(
        document =>
          document.status !== 'cancelled' &&
          !activeChargeByDocument.has(document.id),
      ),
    [documents, activeChargeByDocument],
  );

  const openCharges = useMemo(
    () => charges.filter(charge => ['pending', 'sent', 'overdue'].includes(charge.status)),
    [charges],
  );

  const selectedDocuments = useMemo(
    () =>
      documents.filter(
        document => document.service_order?.id && selectedOrderIds.includes(document.service_order.id),
      ),
    [documents, selectedOrderIds],
  );

  const toBillAmount = toBillDocuments.reduce((sum, document) => sum + Number(document.amount || 0), 0);
  const receivableAmount = pendingIncome.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const receivedAmount = paidIncome.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const selectedAmount = selectedDocuments.reduce((sum, document) => sum + Number(document.amount || 0), 0);

  const handleGenerateAIReport = async () => {
    setIsGenerating(true);
    try {
      const result = await generateReport(
        {
          resumo: {
            saldoEmCaixa: money(stats.balance),
            recebido: money(receivedAmount),
            aReceber: money(receivableAmount),
            aFaturar: money(toBillAmount),
            despesasPagas: money(stats.totalExpense),
          },
          pipeline: {
            aguardandoDadosCliente: documents.filter(d => d.status === 'awaiting_client_data').length,
            pacotesProntos: documents.filter(d => d.document_type === 'accountant' && d.status === 'ready').length,
            enviadosAoContador: documents.filter(d => d.status === 'sent_to_accountant').length,
            notasExternasRegistradas: documents.filter(d => d.status === 'external_invoice_recorded').length,
            cobrancasAbertas: openCharges.length,
            medicoes: measurements.length,
          },
          transacoesRecentes: transactions.slice(0, 10),
        },
        'financial',
      );
      setReport(result || 'Não foi possível gerar o relatório no momento.');
      setShowReportModal(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleOrderSelection = (document: BillingDocument) => {
    const order = document.service_order;
    if (
      !order ||
      document.document_type !== 'accountant' ||
      ['sent_to_accountant', 'external_invoice_recorded'].includes(document.status) ||
      measuredOrderIds.has(order.id)
    ) return;

    if (selectedOrderIds.includes(order.id)) {
      setSelectedOrderIds(current => current.filter(id => id !== order.id));
      return;
    }

    const selectedClient = selectedDocuments[0]?.service_order?.client;
    if (selectedClient && selectedClient !== order.client) {
      alert(`Uma medição reúne serviços do mesmo cliente. Finalize a medição de ${selectedClient} antes de selecionar ${order.client}.`);
      return;
    }

    setSelectedOrderIds(current => [...current, order.id]);
  };

  const handleCreateMeasurement = async () => {
    if (!selectedOrderIds.length) return;
    try {
      setActionLoading('measurement');
      const id = await workToCashService.createMeasurement(selectedOrderIds);
      setSelectedOrderIds([]);
      await loadAll();
      alert(`Medição criada com sucesso. Protocolo ${id.slice(0, 8).toUpperCase()}.`);
    } catch (error) {
      alert(workToCashErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const sourceClientName = (document: BillingDocument) =>
    document.service_order?.client || document.measurement?.client || 'Cliente';

  const openPackageModal = (document: BillingDocument) => {
    const current = document.client_profile || clients.find(
      client => client.name.trim().toLowerCase() === sourceClientName(document).trim().toLowerCase(),
    );
    setPackageTarget(document);
    setSelectedClientId(current?.id || '');
    setClientForm(current ? fromClient(current) : emptyClient(sourceClientName(document)));
  };

  const selectExistingClient = (id: string) => {
    setSelectedClientId(id);
    const client = clients.find(item => item.id === id);
    if (client) setClientForm(fromClient(client));
    else if (packageTarget) setClientForm(emptyClient(sourceClientName(packageTarget)));
  };

  const handlePreparePackage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!packageTarget) return;
    try {
      setActionLoading(`package-${packageTarget.id}`);
      const input: BillingClientInput = {
        ...clientForm,
        document_type: clientForm.document_type || undefined,
      };
      const clientId = await workToCashService.saveClient(input, selectedClientId || null);
      await workToCashService.prepareAccountantPackage(packageTarget.id, clientId);
      setPackageTarget(null);
      await loadAll();
    } catch (error) {
      alert(workToCashErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const copyPackage = async (document: BillingDocument) => {
    if (!document.package_data) return;
    await navigator.clipboard.writeText(formatAccountantPackage(document.package_data));
    alert('Dados de faturamento copiados. Agora você pode colar no WhatsApp, e-mail ou sistema do contador.');
  };

  const markPackageSent = async (document: BillingDocument) => {
    if (!confirm('Marcar este pacote como enviado ao contador/sistema fiscal?')) return;
    try {
      setActionLoading(document.id);
      await workToCashService.markPackageSent(document.id, 'manual');
      await loadAll();
    } catch (error) {
      alert(workToCashErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const openInvoiceModal = (document: BillingDocument) => {
    setInvoiceTarget(document);
    setInvoiceForm({
      number: document.document_number || '',
      date: document.external_invoice_date || localDate(),
    });
  };

  const handleRecordExternalInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invoiceTarget) return;
    try {
      setActionLoading(`invoice-${invoiceTarget.id}`);
      await workToCashService.recordExternalInvoice(invoiceTarget.id, invoiceForm.number, invoiceForm.date);
      setInvoiceTarget(null);
      await loadAll();
    } catch (error) {
      alert(workToCashErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeDeferred = async (document: BillingDocument) => {
    if (!confirm('Retomar este faturamento e preparar os dados para o contador/sistema fiscal?')) return;
    try {
      setActionLoading(document.id);
      await workToCashService.resumeDeferred(document.id);
      await loadAll();
    } catch (error) {
      alert(workToCashErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const openChargeModal = (document: BillingDocument) => {
    setChargeTarget(document);
    setChargeForm({ dueDate: datePlusDays(7), method: 'pix' });
  };

  const handleCreateCharge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chargeTarget || !chargeForm.dueDate) return;
    try {
      setActionLoading(`charge-${chargeTarget.id}`);
      await workToCashService.createCharge(chargeTarget.id, chargeForm.dueDate, chargeForm.method);
      setChargeTarget(null);
      await loadAll();
      setActiveTab('receivables');
    } catch (error) {
      alert(workToCashErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmCharge = async (charge: BillingCharge) => {
    if (!confirm(`Confirmar recebimento de ${money(charge.amount)} de ${charge.client}?`)) return;
    try {
      setActionLoading(charge.id);
      await workToCashService.confirmPayment(charge.id);
      await loadAll();
    } catch (error) {
      alert(workToCashErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const handleLegacyReceive = async (transaction: SupabaseTransaction) => {
    if (!confirm(`Confirmar recebimento de ${money(transaction.amount)}?`)) return;
    try {
      setActionLoading(transaction.id);
      await transactionService.update(transaction.id, { status: 'paid' });
      await loadAll();
    } catch (error) {
      alert(serviceOrderErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const openAddTransaction = () => {
    setEditingId(null);
    setTransactionForm({
      title: '',
      amount: '',
      type: 'expense',
      status: 'paid',
      category: '',
      date: localDate(),
    });
    setShowTransactionModal(true);
  };

  const openEditTransaction = (transaction: SupabaseTransaction) => {
    setEditingId(transaction.id);
    setTransactionForm({
      title: transaction.title,
      amount: transaction.amount.toString(),
      type: transaction.type,
      status: transaction.status,
      category: transaction.category,
      date: transaction.date.slice(0, 10),
    });
    setShowTransactionModal(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
    try {
      await transactionService.delete(id);
      await loadAll();
    } catch (error) {
      alert(serviceOrderErrorMessage(error));
    }
  };

  const handleSaveTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!transactionForm.title || !transactionForm.amount) return;
    try {
      setSavingTransaction(true);
      const data = {
        title: transactionForm.title,
        amount: Number(transactionForm.amount),
        type: transactionForm.type,
        status: transactionForm.status,
        category: transactionForm.category || 'Outros',
        date: transactionForm.date,
      };
      if (editingId) {
        await transactionService.update(editingId, linkedOrderId ? { status: transactionForm.status } : data);
      } else {
        await transactionService.create(data);
      }
      setShowTransactionModal(false);
      await loadAll();
    } catch (error) {
      alert(serviceOrderErrorMessage(error));
    } finally {
      setSavingTransaction(false);
    }
  };

  const tabs: Array<{ id: FinanceTab; label: string; badge?: number }> = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'billing', label: 'A faturar', badge: toBillDocuments.length },
    { id: 'receivables', label: 'A receber', badge: pendingIncome.length },
    { id: 'transactions', label: 'Movimentações' },
  ];

  const summaryCards = [
    {
      label: 'A faturar',
      value: toBillAmount,
      note: `${toBillDocuments.length} item(ns) no fluxo`,
      icon: <FileText size={22} />,
      className: 'text-primary',
    },
    {
      label: 'A receber',
      value: receivableAmount,
      note: `${pendingIncome.length} receita(s) pendente(s)`,
      icon: <Clock3 size={22} />,
      className: 'text-warning',
    },
    {
      label: 'Recebido',
      value: receivedAmount,
      note: 'Receitas liquidadas',
      icon: <ArrowUpRight size={22} />,
      className: 'text-positive',
    },
    {
      label: 'Saldo em caixa',
      value: stats.balance,
      note: `Despesas pagas: ${money(stats.totalExpense)}`,
      icon: <CircleDollarSign size={22} />,
      className: stats.balance >= 0 ? 'text-positive' : 'text-negative',
    },
  ];

  return (
    <Layout>
      <Layout.Header
        title="Financeiro"
        subTitle="Medições, contador, recebíveis & caixa"
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleGenerateAIReport}
              disabled={isGenerating}
              className="bg-brand-gradient text-white p-2 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              title="Analisar financeiro com IA"
            >
              {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            </button>
            <button
              onClick={openAddTransaction}
              className="bg-primary text-black p-2 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all"
              title="Nova transação manual"
            >
              <Plus size={20} strokeWidth={3} />
            </button>
          </div>
        }
      />

      <Layout.Content>
        <div className="px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-surface-dark/40 text-gray-500 border-white/5 hover:text-white'
                }`}
              >
                {tab.label}
                {!!tab.badge && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-white/10 text-[9px] flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <Loader2 size={34} className="animate-spin text-primary" />
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Sincronizando financeiro...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="px-4 pb-32 animate-in fade-in duration-500">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
                  {summaryCards.map(card => (
                    <button
                      key={card.label}
                      onClick={() => card.label === 'A faturar' ? setActiveTab('billing') : card.label === 'A receber' ? setActiveTab('receivables') : undefined}
                      className="text-left bg-surface-dark/50 p-5 rounded-[28px] border border-white/5 shadow-lg relative overflow-hidden hover:border-white/10 transition-all"
                    >
                      <div className={`mb-4 ${card.className}`}>{card.icon}</div>
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{card.label}</p>
                      <p className={`text-xl font-black mt-1 tracking-tight ${card.className}`}>{shortMoney(card.value)}</p>
                      <p className="text-[9px] text-gray-600 mt-2">{card.note}</p>
                    </button>
                  ))}
                </div>

                <div className="mt-6 bg-surface-dark/40 rounded-[32px] border border-white/5 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-[9px] font-black text-primary uppercase tracking-[0.25em]">Serviço → Caixa</p>
                      <h2 className="text-lg font-black text-white uppercase italic">Fluxo de faturamento</h2>
                    </div>
                    <ClipboardCheck className="text-primary" size={24} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: 'Faltam dados cliente', value: documents.filter(d => d.status === 'awaiting_client_data').length },
                      { label: 'Pacotes prontos', value: documents.filter(d => d.document_type === 'accountant' && d.status === 'ready').length },
                      { label: 'Enviados contador', value: documents.filter(d => d.status === 'sent_to_accountant').length },
                      { label: 'Cobranças abertas', value: openCharges.length },
                      { label: 'Clientes cadastrados', value: clients.length },
                    ].map(item => (
                      <div key={item.label} className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <p className="text-2xl font-black text-white">{item.value}</p>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 bg-primary/5 border border-primary/15 rounded-[28px] p-5">
                  <div className="flex gap-4">
                    <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <p className="font-black text-white">O TerraGes não emite NFS-e.</p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Ele organiza os dados registrados no campo, completa o cadastro do cliente e entrega o pacote pronto para o contador ou sistema fiscal da empresa.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="px-4 pb-32 mt-4 animate-in fade-in duration-500">
                <div className="bg-surface-dark/40 rounded-[30px] border border-white/5 p-5 mb-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest">Medição consolidada</p>
                      <p className="text-sm font-black text-white mt-1">
                        {selectedOrderIds.length
                          ? `${selectedOrderIds.length} OS selecionada(s) · ${money(selectedAmount)}`
                          : 'Selecione OS do mesmo cliente marcadas para contador.'}
                      </p>
                    </div>
                    <button
                      onClick={handleCreateMeasurement}
                      disabled={!selectedOrderIds.length || actionLoading === 'measurement'}
                      className="h-11 px-5 rounded-xl bg-primary text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      {actionLoading === 'measurement' ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />}
                      Criar medição
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between mb-4 px-1">
                  <div>
                    <h2 className="text-lg font-black text-white uppercase italic">A faturar</h2>
                    <p className="text-xs text-gray-500 mt-1">{money(toBillAmount)} aguardando preparo, contador ou cobrança.</p>
                  </div>
                </div>

                {toBillDocuments.length === 0 ? (
                  <div className="py-16 text-center bg-surface-dark/20 rounded-[32px] border border-dashed border-white/5">
                    <CheckCircle2 size={32} className="mx-auto text-positive mb-3" />
                    <p className="text-sm font-black text-white">Nada pendente para faturar.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {toBillDocuments.map(document => {
                      const order = document.service_order;
                      const measured = !!order && measuredOrderIds.has(order.id);
                      const selectable = !!order && document.document_type === 'accountant' &&
                        !['sent_to_accountant', 'external_invoice_recorded'].includes(document.status) && !measured;
                      const selected = !!order && selectedOrderIds.includes(order.id);

                      return (
                        <div key={document.id} className="bg-surface-dark/40 border border-white/5 rounded-[28px] p-5">
                          <div className="flex gap-4">
                            {order && (
                              <button
                                onClick={() => toggleOrderSelection(document)}
                                disabled={!selectable}
                                className={`size-6 rounded-lg border shrink-0 mt-1 flex items-center justify-center transition-all ${
                                  selected ? 'bg-primary border-primary text-black' : !selectable ? 'bg-white/5 border-white/5 text-gray-700' : 'border-white/15 text-transparent hover:border-primary/50'
                                }`}
                                title={selectable ? 'Selecionar para medição' : 'Este item não pode ser agrupado em medição'}
                              >
                                <Check size={14} strokeWidth={4} />
                              </button>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-primary/10 text-primary">
                                  {documentLabel(document)}
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-white/5 text-gray-400">
                                  {statusLabel(document)}
                                </span>
                                {measured && (
                                  <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-positive/10 text-positive">
                                    Em medição
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-black text-white truncate">{sourceClientName(document)}</p>
                                  <p className="text-[10px] text-gray-500 mt-1">
                                    {order
                                      ? `OS #${order.id.slice(0, 8).toUpperCase()} · ${formatDate(order.date)}`
                                      : document.measurement
                                        ? `Medição #${document.measurement.id.slice(0, 8).toUpperCase()} · ${formatDate(document.measurement.period_start)} a ${formatDate(document.measurement.period_end)}`
                                        : 'Documento de faturamento'}
                                  </p>
                                  {order?.description && <p className="text-xs text-gray-600 mt-2 line-clamp-1">{order.description}</p>}
                                  {document.status === 'external_invoice_recorded' && (
                                    <p className="text-[10px] text-positive mt-2">
                                      Nota externa #{document.document_number} · {formatDate(document.external_invoice_date)}
                                    </p>
                                  )}
                                </div>
                                <p className="text-xl font-black text-white shrink-0">{money(document.amount)}</p>
                              </div>

                              <div className="flex flex-wrap gap-2 mt-4">
                                {document.document_type === 'accountant' && document.status === 'awaiting_client_data' && (
                                  <button
                                    onClick={() => openPackageModal(document)}
                                    className="h-9 px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                                  >
                                    <UserRound size={13} />
                                    Completar cliente e preparar
                                  </button>
                                )}

                                {document.document_type === 'accountant' && document.status === 'ready' && (
                                  <>
                                    <button
                                      onClick={() => copyPackage(document)}
                                      className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                                    >
                                      <Copy size={13} /> Copiar dados
                                    </button>
                                    <button
                                      onClick={() => markPackageSent(document)}
                                      disabled={actionLoading === document.id}
                                      className="h-9 px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                                    >
                                      {actionLoading === document.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                      Marcar enviado
                                    </button>
                                    <button
                                      onClick={() => openPackageModal(document)}
                                      className="h-9 px-4 rounded-xl bg-white/5 text-gray-400 text-[9px] font-black uppercase tracking-widest"
                                    >
                                      Editar dados
                                    </button>
                                  </>
                                )}

                                {document.document_type === 'accountant' && document.status === 'sent_to_accountant' && (
                                  <>
                                    <button
                                      onClick={() => copyPackage(document)}
                                      className="h-9 px-4 rounded-xl bg-white/5 text-gray-300 text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                                    >
                                      <Copy size={13} /> Copiar novamente
                                    </button>
                                    <button
                                      onClick={() => openInvoiceModal(document)}
                                      className="h-9 px-4 rounded-xl bg-positive/10 border border-positive/20 text-positive text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                                    >
                                      <FileCheck2 size={13} /> Registrar nota emitida
                                    </button>
                                  </>
                                )}

                                {document.document_type === 'accountant' && document.status === 'external_invoice_recorded' && (
                                  <button
                                    onClick={() => openChargeModal(document)}
                                    className="h-9 px-4 rounded-xl bg-positive/10 border border-positive/20 text-positive text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                                  >
                                    <CreditCard size={13} /> Gerar cobrança
                                  </button>
                                )}

                                {document.document_type === 'receipt' && document.status === 'ready' && (
                                  <>
                                    <span className="h-9 px-4 rounded-xl bg-white/5 text-gray-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                      <ReceiptText size={13} /> OS/recibo pronto
                                    </span>
                                    <button
                                      onClick={() => openChargeModal(document)}
                                      className="h-9 px-4 rounded-xl bg-positive/10 border border-positive/20 text-positive text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                                    >
                                      <CreditCard size={13} /> Gerar cobrança
                                    </button>
                                  </>
                                )}

                                {document.document_type === 'deferred' && document.status === 'deferred' && (
                                  <button
                                    onClick={() => handleResumeDeferred(document)}
                                    disabled={actionLoading === document.id}
                                    className="h-9 px-4 rounded-xl bg-warning/10 border border-warning/20 text-warning text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                                  >
                                    {actionLoading === document.id ? <Loader2 size={13} className="animate-spin" /> : <Clock3 size={13} />}
                                    Retomar para contador
                                  </button>
                                )}

                                {document.document_type === 'nfse' && (
                                  <span className="text-[9px] text-warning bg-warning/10 px-3 py-2 rounded-xl">
                                    Registro legado. Novas OS não usam emissão NFS-e pelo TerraGes.
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-8">
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.25em] mb-4 px-1">Medições</h3>
                  {measurements.length === 0 ? (
                    <p className="text-xs text-gray-600 py-8 text-center">Crie a primeira medição selecionando OS do mesmo cliente.</p>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-3">
                      {measurements.map(measurement => (
                        <div key={measurement.id} className="bg-surface-dark/30 border border-white/5 rounded-[24px] p-5">
                          <div className="flex justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[8px] font-black text-primary uppercase tracking-widest">Medição #{measurement.id.slice(0, 8).toUpperCase()}</p>
                              <p className="text-sm font-black text-white mt-1 truncate">{measurement.client}</p>
                              <p className="text-[9px] text-gray-500 mt-1">
                                {formatDate(measurement.period_start)} → {formatDate(measurement.period_end)} · {measurement.items?.length || 0} OS
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-white">{money(measurement.total_value)}</p>
                              <p className="text-[8px] uppercase text-gray-600 mt-1">{measurement.status}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'receivables' && (
              <div className="px-4 pb-32 mt-4 animate-in fade-in duration-500">
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-surface-dark/40 rounded-[26px] border border-white/5 p-5">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">A receber</p>
                    <p className="text-xl font-black text-warning mt-2">{money(receivableAmount)}</p>
                    <p className="text-[9px] text-gray-600 mt-1">{pendingIncome.length} lançamento(s)</p>
                  </div>
                  <div className="bg-surface-dark/40 rounded-[26px] border border-white/5 p-5">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Cobranças abertas</p>
                    <p className="text-xl font-black text-white mt-2">{money(openCharges.reduce((sum, charge) => sum + charge.amount, 0))}</p>
                    <p className="text-[9px] text-gray-600 mt-1">{openCharges.length} cobrança(s)</p>
                  </div>
                </div>

                <h2 className="text-lg font-black text-white uppercase italic mb-4">Cobranças</h2>
                {openCharges.length === 0 ? (
                  <div className="py-12 text-center bg-surface-dark/20 rounded-[32px] border border-dashed border-white/5">
                    <CreditCard size={28} className="mx-auto text-gray-700 mb-3" />
                    <p className="text-xs text-gray-600">Nenhuma cobrança aberta.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openCharges.map(charge => (
                      <div key={charge.id} className="bg-surface-dark/40 border border-white/5 rounded-[26px] p-5 flex flex-col md:flex-row md:items-center gap-4">
                        <div className="size-11 rounded-2xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
                          <Clock3 size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white truncate">{charge.client}</p>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">
                            Vencimento {formatDate(charge.due_date)} · {charge.method || 'método não informado'} · {charge.status}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 md:justify-end">
                          <p className="text-lg font-black text-warning">{money(charge.amount)}</p>
                          <button
                            onClick={() => handleConfirmCharge(charge)}
                            disabled={actionLoading === charge.id}
                            className="h-10 px-4 rounded-xl bg-positive text-black text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
                          >
                            {actionLoading === charge.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                            Recebido
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="text-xs font-black text-white uppercase tracking-[0.25em] mt-8 mb-4">Receitas pendentes</h3>
                <div className="space-y-3">
                  {pendingIncome.map(transaction => {
                    const charge = chargeByTransaction.get(transaction.id);
                    return (
                      <div key={transaction.id} className="bg-surface-dark/30 border border-white/5 rounded-[24px] p-4 flex items-center gap-4">
                        <div className="size-10 rounded-xl bg-positive/10 text-positive flex items-center justify-center">
                          <ArrowUpRight size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white truncate">{transaction.title}</p>
                          <p className="text-[9px] text-gray-600 mt-1">{formatDate(transaction.date)} · {transaction.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-warning">{money(transaction.amount)}</p>
                          {charge ? (
                            <p className="text-[8px] text-gray-600 uppercase mt-1">Cobrança vinculada</p>
                          ) : (
                            <button
                              onClick={() => handleLegacyReceive(transaction)}
                              disabled={actionLoading === transaction.id}
                              className="text-[8px] text-positive uppercase font-black mt-1 hover:underline disabled:opacity-50"
                            >
                              Confirmar recebido
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="px-4 pb-32 mt-4 animate-in fade-in duration-500">
                <div className="flex items-end justify-between mb-5 px-1">
                  <div>
                    <h2 className="text-lg font-black text-white uppercase italic">Receitas & despesas</h2>
                    <p className="text-xs text-gray-500 mt-1">Histórico financeiro consolidado.</p>
                  </div>
                  <button
                    onClick={openAddTransaction}
                    className="h-10 px-4 rounded-xl bg-primary text-black text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                  >
                    <Plus size={14} /> Lançar
                  </button>
                </div>

                {transactions.length === 0 ? (
                  <div className="text-center py-20 bg-surface-dark/10 rounded-[40px] border border-dashed border-white/5">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest">Nenhuma movimentação.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map(transaction => (
                      <div key={transaction.id} className="bg-surface-dark/40 p-5 rounded-[26px] border border-white/5 flex items-center gap-4 group">
                        <div className={`size-11 rounded-2xl flex items-center justify-center shrink-0 ${
                          transaction.type === 'income' ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
                        }`}>
                          {transaction.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm text-white truncate">{transaction.title}</p>
                          <p className="text-[9px] text-gray-600 uppercase tracking-widest mt-1">
                            {formatDate(transaction.date)} · {transaction.category} · {transaction.status === 'paid' ? 'Liquidado' : 'Pendente'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-black ${transaction.type === 'income' ? 'text-positive' : 'text-negative'}`}>
                            {transaction.type === 'income' ? '+' : '-'} {money(transaction.amount)}
                          </p>
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => openEditTransaction(transaction)} className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-white">
                              <Pencil size={12} />
                            </button>
                            {!transaction.service_order_id && (
                              <button onClick={() => handleDeleteTransaction(transaction.id)} className="p-1.5 rounded-lg bg-negative/5 text-negative/60 hover:text-negative">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Layout.Content>

      {packageTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handlePreparePackage} className="w-full max-w-3xl bg-surface-dark rounded-[32px] border border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface-dark/95 backdrop-blur-xl p-6 border-b border-white/5 flex items-center justify-between z-10">
              <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-widest">Dados para o contador</p>
                <h2 className="text-xl font-black text-white mt-1">{sourceClientName(packageTarget)}</h2>
              </div>
              <button type="button" onClick={() => setPackageTarget(null)} className="p-2 text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                <p className="text-xs text-gray-300">
                  Cadastre os dados reais do cliente. O TerraGes vai juntar este cadastro com OS, máquina, horas e valores. Nenhum dado fiscal será inventado e nenhuma NFS-e será emitida.
                </p>
              </div>

              {clients.length > 0 && (
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Usar cliente já cadastrado</label>
                  <select
                    value={selectedClientId}
                    onChange={event => selectExistingClient(event.target.value)}
                    className="mt-2 w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                  >
                    <option value="" className="bg-brand-dark">Novo cadastro / preencher abaixo</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id} className="bg-brand-dark">
                        {client.name}{client.document_number ? ` — ${client.document_number}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Nome do cliente *" value={clientForm.name || ''} onChange={value => setClientForm(v => ({ ...v, name: value }))} />
                <Field label="Razão social" value={clientForm.legal_name || ''} onChange={value => setClientForm(v => ({ ...v, legal_name: value }))} />
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Tipo documento</label>
                  <select
                    value={clientForm.document_type || 'cnpj'}
                    onChange={event => setClientForm(v => ({ ...v, document_type: event.target.value as ClientForm['document_type'] }))}
                    className="mt-2 w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                  >
                    <option value="cnpj" className="bg-brand-dark">CNPJ</option>
                    <option value="cpf" className="bg-brand-dark">CPF</option>
                    <option value="other" className="bg-brand-dark">Outro</option>
                  </select>
                </div>
                <Field label="CPF / CNPJ *" value={clientForm.document_number || ''} onChange={value => setClientForm(v => ({ ...v, document_number: value }))} />
                <Field label="Contato do faturamento" value={clientForm.billing_contact || ''} onChange={value => setClientForm(v => ({ ...v, billing_contact: value }))} />
                <Field label="E-mail do faturamento" type="email" value={clientForm.billing_email || ''} onChange={value => setClientForm(v => ({ ...v, billing_email: value }))} />
                <Field label="Telefone / WhatsApp" value={clientForm.phone || ''} onChange={value => setClientForm(v => ({ ...v, phone: value }))} />
                <Field label="E-mail geral" type="email" value={clientForm.email || ''} onChange={value => setClientForm(v => ({ ...v, email: value }))} />
                <div className="md:col-span-2 grid md:grid-cols-[1fr_140px] gap-4">
                  <Field label="Endereço" value={clientForm.address_line || ''} onChange={value => setClientForm(v => ({ ...v, address_line: value }))} />
                  <Field label="Número" value={clientForm.address_number || ''} onChange={value => setClientForm(v => ({ ...v, address_number: value }))} />
                </div>
                <Field label="Bairro" value={clientForm.neighborhood || ''} onChange={value => setClientForm(v => ({ ...v, neighborhood: value }))} />
                <Field label="Complemento" value={clientForm.address_complement || ''} onChange={value => setClientForm(v => ({ ...v, address_complement: value }))} />
                <Field label="Cidade" value={clientForm.city || ''} onChange={value => setClientForm(v => ({ ...v, city: value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="UF" maxLength={2} value={clientForm.state || ''} onChange={value => setClientForm(v => ({ ...v, state: value.toUpperCase() }))} />
                  <Field label="CEP" value={clientForm.postal_code || ''} onChange={value => setClientForm(v => ({ ...v, postal_code: value }))} />
                </div>
              </div>

              <button
                type="submit"
                disabled={!clientForm.name || !clientForm.document_number || actionLoading === `package-${packageTarget.id}`}
                className="w-full h-12 rounded-2xl bg-primary text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {actionLoading === `package-${packageTarget.id}` ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />}
                Salvar cliente e preparar pacote
              </button>
            </div>
          </form>
        </div>
      )}

      {invoiceTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-5">
          <form onSubmit={handleRecordExternalInvoice} className="w-full max-w-md bg-surface-dark rounded-[32px] border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[9px] font-black text-positive uppercase tracking-widest">Nota emitida fora do TerraGes</p>
                <h2 className="text-lg font-black text-white mt-1">Registrar retorno do contador</h2>
              </div>
              <button type="button" onClick={() => setInvoiceTarget(null)} className="p-2 text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <Field label="Número da nota *" value={invoiceForm.number} onChange={value => setInvoiceForm(v => ({ ...v, number: value }))} />
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Data de emissão *</label>
                <input
                  type="date"
                  required
                  value={invoiceForm.date}
                  onChange={event => setInvoiceForm(v => ({ ...v, date: event.target.value }))}
                  className="mt-2 w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-4">
              Este registro apenas informa ao TerraGes que a nota foi emitida pelo contador ou sistema fiscal externo.
            </p>
            <button
              type="submit"
              disabled={!invoiceForm.number || actionLoading === `invoice-${invoiceTarget.id}`}
              className="mt-6 w-full h-12 rounded-2xl bg-positive text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {actionLoading === `invoice-${invoiceTarget.id}` ? <Loader2 size={15} className="animate-spin" /> : <FileCheck2 size={15} />}
              Registrar nota externa
            </button>
          </form>
        </div>
      )}

      {chargeTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-5">
          <form onSubmit={handleCreateCharge} className="w-full max-w-md bg-surface-dark rounded-[32px] border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-widest">Cobrança</p>
                <h2 className="text-xl font-black text-white mt-1">{money(chargeTarget.amount)}</h2>
              </div>
              <button type="button" onClick={() => setChargeTarget(null)} className="p-2 text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-5">{sourceClientName(chargeTarget)} · {documentLabel(chargeTarget)}</p>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Vencimento</label>
                <input
                  type="date"
                  required
                  value={chargeForm.dueDate}
                  onChange={event => setChargeForm(current => ({ ...current, dueDate: event.target.value }))}
                  className="mt-2 w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Forma prevista</label>
                <select
                  value={chargeForm.method}
                  onChange={event => setChargeForm(current => ({ ...current, method: event.target.value as ChargeMethod }))}
                  className="mt-2 w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                >
                  <option value="pix" className="bg-brand-dark">Pix</option>
                  <option value="boleto" className="bg-brand-dark">Boleto</option>
                  <option value="transferencia" className="bg-brand-dark">Transferência</option>
                  <option value="dinheiro" className="bg-brand-dark">Dinheiro</option>
                  <option value="cartao" className="bg-brand-dark">Cartão</option>
                  <option value="outro" className="bg-brand-dark">Outro</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={!!actionLoading}
              className="mt-6 w-full h-12 rounded-2xl bg-primary text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionLoading?.startsWith('charge-') ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
              Criar cobrança
            </button>
          </form>
        </div>
      )}

      {showTransactionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-5">
          <form onSubmit={handleSaveTransaction} className="w-full max-w-lg bg-surface-dark rounded-[32px] border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-widest">Movimentação manual</p>
                <h2 className="text-xl font-black text-white mt-1">{editingId ? 'Editar lançamento' : 'Novo lançamento'}</h2>
              </div>
              <button type="button" onClick={() => setShowTransactionModal(false)} className="p-2 text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            {linkedOrderId && (
              <p className="mb-5 text-xs text-gray-400 bg-white/5 rounded-2xl p-4">
                Receita vinculada à OS #{linkedOrderId.slice(0, 8).toUpperCase()}. Para preservar a auditoria, apenas a situação do recebimento pode ser alterada aqui.
              </p>
            )}

            <fieldset disabled={!!linkedOrderId || savingTransaction} className="space-y-4 disabled:opacity-60">
              <input
                value={transactionForm.title}
                onChange={event => setTransactionForm(current => ({ ...current, title: event.target.value }))}
                placeholder="Descrição"
                required
                className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={transactionForm.amount}
                  onChange={event => setTransactionForm(current => ({ ...current, amount: event.target.value }))}
                  placeholder="Valor"
                  required
                  className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                />
                <select
                  value={transactionForm.type}
                  onChange={event => setTransactionForm(current => ({ ...current, type: event.target.value as 'income' | 'expense' }))}
                  className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                >
                  <option value="expense" className="bg-brand-dark">Despesa</option>
                  <option value="income" className="bg-brand-dark">Receita</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={transactionForm.date}
                  onChange={event => setTransactionForm(current => ({ ...current, date: event.target.value }))}
                  className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                />
                <input
                  value={transactionForm.category}
                  onChange={event => setTransactionForm(current => ({ ...current, category: event.target.value }))}
                  placeholder="Categoria"
                  className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                />
              </div>
            </fieldset>

            <div className="mt-4">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Situação</label>
              <select
                value={transactionForm.status}
                onChange={event => setTransactionForm(current => ({ ...current, status: event.target.value as 'paid' | 'pending' }))}
                className="mt-2 w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
              >
                <option value="pending" className="bg-brand-dark">Pendente</option>
                <option value="paid" className="bg-brand-dark">Liquidado</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={savingTransaction}
              className="mt-6 w-full h-12 rounded-2xl bg-primary text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingTransaction ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Salvar
            </button>
          </form>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-5">
          <div className="w-full max-w-xl bg-surface-dark rounded-[34px] border border-white/10 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Sparkles size={19} /></div>
                <div>
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest">Análise IA</p>
                  <h2 className="font-black text-white">Financeiro & faturamento</h2>
                </div>
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-2 text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{report}</div>
            <div className="p-5 border-t border-white/5">
              <button onClick={copyReport} className="w-full h-11 rounded-xl bg-white/5 text-gray-300 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                {copied ? <Check size={14} className="text-positive" /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar análise'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
}> = ({ label, value, onChange, type = 'text', maxLength }) => (
  <div>
    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</label>
    <input
      type={type}
      value={value}
      maxLength={maxLength}
      onChange={event => onChange(event.target.value)}
      className="mt-2 w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white outline-none focus:border-primary/50"
    />
  </div>
);
