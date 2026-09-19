import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import {
  Save, Trash2, Plus, Loader2, CheckCircle2,
  User, MapPin, Wrench, Clock, DollarSign, FileText,
  ChevronDown, Send, XCircle, Calculator, Layers3, Truck,
} from 'lucide-react';
import { orcamentoService, OrcamentoFormData, OrcamentoMachine, calcTotalValue, STATUS_CONFIG, OrcamentoStatus, formatOrcamentoNumber } from '../services/orcamentoService';
import { machineService, Machine } from '../services/machineService';
import { EARTHWORK_QUOTE_DRAFT_KEY } from './OrcamentoCalculator';
import {
  buildEarthworkQuoteDescription,
  calculateEarthworkEstimate,
  EarthworkEstimate,
} from '../supabase/functions/_shared/earthwork-calculator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const SERVICE_TYPES = [
  'Terraplanagem', 'Escavação', 'Demolição', 'Nivelamento',
  'Compactação', 'Drenagem', 'Aterro', 'Corte e Aterro',
  'Limpeza de Terreno', 'Outro',
];

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-surface-dark/50 rounded-[24px] border border-white/5 p-5 space-y-4">
    <div className="flex items-center gap-2 mb-1">
      <div className="size-7 rounded-lg bg-primary/15 flex items-center justify-center text-primary">{icon}</div>
      <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{title}</h3>
    </div>
    {children}
  </div>
);

// ─── Field ────────────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  required?: boolean;
}> = ({ label, children, required }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
      {label}{required && <span className="text-primary ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full bg-black/40 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors";
const selectCls = `${inputCls} appearance-none cursor-pointer`;

// ─── Main ─────────────────────────────────────────────────────────────────────

export const OrcamentoForm: React.FC = () => {
  const navigate  = useNavigate();
  const { id }    = useParams<{ id?: string }>();
  const isEdit    = Boolean(id);

  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(isEdit);
  const [success, setSuccess]   = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [orcNum, setOrcNum]     = useState<number>(0);

  const [form, setForm] = useState<OrcamentoFormData>({
    client_name:     '',
    client_phone:    '',
    client_email:    '',
    client_address:  '',
    service_type:    '',
    location:        '',
    description:     '',
    machines:        [],
    hourly_rate:     0,
    estimated_hours: 0,
    total_value:     0,
    discount:        0,
    notes:           '',
    calculation_details: null,
    status:          'rascunho',
    valid_until:     '',
  });

  // Load machines for picker
  useEffect(() => {
    machineService.getAll().then(m => setMachines(m.filter(mx => mx.status === 'active')));
  }, []);

  // Load existing quote if editing
  useEffect(() => {
    if (!isEdit || !id) return;
    setLoading(true);
    orcamentoService.getById(id).then(orc => {
      if (!orc) return navigate('/orcamentos');
      setOrcNum(orc.number);
      setForm({
        client_name:     orc.client_name,
        client_phone:    orc.client_phone    ?? '',
        client_email:    orc.client_email    ?? '',
        client_address:  orc.client_address  ?? '',
        service_type:    orc.service_type,
        location:        orc.location        ?? '',
        description:     orc.description     ?? '',
        machines:        orc.machines,
        hourly_rate:     orc.hourly_rate,
        estimated_hours: orc.estimated_hours,
        total_value:     orc.total_value,
        discount:        orc.discount,
        notes:           orc.notes           ?? '',
        calculation_details: orc.calculation_details ?? null,
        status:          orc.status,
        valid_until:     orc.valid_until     ?? '',
      });
    }).finally(() => setLoading(false));
  }, [id, isEdit, navigate]);

  // Recalculate total from the deterministic estimate or from the simple hourly model.
  useEffect(() => {
    const total = form.calculation_details?.result.total
      ?? calcTotalValue(form.hourly_rate, form.estimated_hours, form.discount);
    setForm(prev => ({ ...prev, total_value: total }));
  }, [form.hourly_rate, form.estimated_hours, form.discount, form.calculation_details]);

  // Receive a validated result from the quick calculator once.
  useEffect(() => {
    if (isEdit) return;
    const raw = sessionStorage.getItem(EARTHWORK_QUOTE_DRAFT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(EARTHWORK_QUOTE_DRAFT_KEY);
    try {
      const saved = JSON.parse(raw) as EarthworkEstimate;
      const estimate = calculateEarthworkEstimate(saved.input);
      const description = buildEarthworkQuoteDescription(estimate);
      const details = estimate.result;
      const notes = [
        `Memória de cálculo TerraGes: ${details.bankVolumeM3} m³ no corte; ${details.looseVolumeM3} m³ soltos; ${details.truckloads} carga(s); ${details.estimatedHours} h estimadas.`,
        `Composição: máquina ${formatCurrency(details.machineCost)}, transporte ${formatCurrency(details.haulCost)}, material ${formatCurrency(details.materialCost)}, mobilização ${formatCurrency(details.mobilizationCost)} e margem ${formatCurrency(details.contingencyValue)}.`,
        'Estimativa preliminar sujeita à vistoria e confirmação das condições reais da obra.',
      ].join('\n');
      setForm(current => ({
        ...current,
        service_type: current.service_type || 'Escavação',
        description: current.description || description,
        machines: [{
          machine_id: '__manual__',
          machine_name: estimate.input.equipmentName,
          hourly_rate: estimate.input.hourlyRate,
          estimated_hours: details.estimatedHours,
        }],
        hourly_rate: estimate.input.hourlyRate,
        estimated_hours: details.estimatedHours,
        discount: estimate.input.discount,
        total_value: details.total,
        notes: current.notes || notes,
        calculation_details: estimate,
      }));
    } catch {
      // Invalid browser state is ignored instead of being persisted.
    }
  }, [isEdit]);

  const set = useCallback(<K extends keyof OrcamentoFormData>(key: K, value: OrcamentoFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const setPricing = useCallback((key: 'hourly_rate' | 'estimated_hours' | 'discount', value: number) => {
    setForm(prev => ({ ...prev, [key]: value, calculation_details: null }));
  }, []);

  // Machine line items
  const addMachineItem = () => {
    const newItem: OrcamentoMachine = {
      machine_id: '',
      machine_name: '',
      hourly_rate: form.hourly_rate || 0,
      estimated_hours: form.estimated_hours || 0,
    };
    setForm(prev => ({ ...prev, machines: [...prev.machines, newItem], calculation_details: null }));
  };

  const updateMachineItem = (idx: number, key: keyof OrcamentoMachine, val: any) => {
    const updated = form.machines.map((m, i) => {
      if (i !== idx) return m;
      const newM = { ...m, [key]: val };
      // Auto-fill name when machine is selected
      if (key === 'machine_id') {
        const found = machines.find(mx => mx.id === val);
        if (found) newM.machine_name = found.name;
      }
      return newM;
    });
    setForm(prev => ({ ...prev, machines: updated, calculation_details: null }));
  };

  const removeMachineItem = (idx: number) => {
    setForm(prev => ({
      ...prev,
      machines: prev.machines.filter((_, i) => i !== idx),
      calculation_details: null,
    }));
  };

  const handleSave = async (status?: OrcamentoStatus) => {
    if (!form.client_name || !form.service_type) return;
    setSaving(true);
    try {
      const payload = { ...form, status: status ?? form.status };
      if (isEdit && id) {
        await orcamentoService.update(id, payload);
      } else {
        await orcamentoService.create(payload);
      }
      setSuccess(true);
      setTimeout(() => navigate('/orcamentos'), 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Excluir este orçamento?')) return;
    await orcamentoService.delete(id);
    navigate('/orcamentos');
  };

  if (loading) {
    return (
      <Layout>
        <Layout.Header title="Orçamento" showBack />
        <Layout.Content>
          <div className="flex justify-center py-24">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        </Layout.Content>
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Header
        title={isEdit ? formatOrcamentoNumber(orcNum) : 'Novo Orçamento'}
        subTitle={isEdit ? 'Editar proposta' : 'Criar proposta comercial'}
        showBack
        actions={
          isEdit ? (
            <button onClick={handleDelete} className="p-2 rounded-xl text-negative hover:bg-negative/10 transition-all">
              <Trash2 size={18} />
            </button>
          ) : undefined
        }
      />

      <Layout.Content>
        <div className="px-4 pb-36 pt-4 space-y-4 animate-in fade-in duration-500">

          {/* ── Calculadora rápida ── */}
          {form.calculation_details ? (
            <div className="rounded-[24px] border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-black">
                  <Calculator size={20} strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">Estimativa aplicada ao orçamento</p>
                  <p className="mt-1 text-xs leading-5 text-gray-400">As premissas e a composição do preço ficam registradas junto da proposta.</p>
                </div>
                <button onClick={() => navigate('/orcamentos/calculadora')} className="rounded-xl border border-primary/25 px-3 py-2 text-xs font-black text-primary">
                  Recalcular
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-black/25 p-3">
                  <Layers3 size={15} className="mb-1.5 text-primary" />
                  <p className="text-base font-black text-white">{form.calculation_details.result.bankVolumeM3} m³</p>
                  <p className="text-[10px] font-bold text-gray-500">NO CORTE</p>
                </div>
                <div className="rounded-xl bg-black/25 p-3">
                  <Truck size={15} className="mb-1.5 text-primary" />
                  <p className="text-base font-black text-white">{form.calculation_details.result.truckloads}</p>
                  <p className="text-[10px] font-bold text-gray-500">CARGAS</p>
                </div>
                <div className="rounded-xl bg-black/25 p-3">
                  <Clock size={15} className="mb-1.5 text-primary" />
                  <p className="text-base font-black text-white">{form.calculation_details.result.estimatedHours} h</p>
                  <p className="text-[10px] font-bold text-gray-500">ESTIMADAS</p>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => navigate('/orcamentos/calculadora')} className="flex w-full items-center gap-3 rounded-[24px] border border-dashed border-primary/30 bg-primary/5 p-4 text-left transition-all hover:bg-primary/10">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Calculator size={19} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-white">Calcular volume, cargas e horas</span>
                <span className="mt-0.5 block text-xs text-gray-500">Use as medidas da obra para sugerir o preço.</span>
              </span>
            </button>
          )}

          {/* ── Cliente ── */}
          <Section title="Cliente" icon={<User size={14} />}>
            <Field label="Nome do cliente" required>
              <input
                value={form.client_name}
                onChange={e => set('client_name', e.target.value)}
                placeholder="Ex: João Construções Ltda"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone">
                <input
                  value={form.client_phone}
                  onChange={e => set('client_phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  className={inputCls}
                  type="tel"
                />
              </Field>
              <Field label="E-mail">
                <input
                  value={form.client_email}
                  onChange={e => set('client_email', e.target.value)}
                  placeholder="email@cliente.com"
                  className={inputCls}
                  type="email"
                />
              </Field>
            </div>
          </Section>

          {/* ── Serviço ── */}
          <Section title="Serviço" icon={<Wrench size={14} />}>
            <Field label="Tipo de serviço" required>
              <div className="relative">
                <select
                  value={form.service_type}
                  onChange={e => set('service_type', e.target.value)}
                  className={selectCls}
                >
                  <option value="">Selecione...</option>
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </Field>
            <Field label="Local da obra">
              <div className="relative">
                <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="Endereço ou referência da obra"
                  className={`${inputCls} pl-10`}
                />
              </div>
            </Field>
            <Field label="Descrição do serviço">
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Descreva o escopo do serviço..."
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </Field>
          </Section>

          {/* ── Máquinas ── */}
          <Section title="Máquinas" icon={<Wrench size={14} />}>
            {form.machines.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-3">
                Nenhuma máquina adicionada. Clique em "+ Adicionar" para incluir.
              </p>
            ) : (
              <div className="space-y-3">
                {form.machines.map((m, idx) => (
                  <div key={idx} className="bg-black/30 rounded-2xl p-4 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-gray-500 uppercase">Máquina {idx + 1}</p>
                      <button onClick={() => removeMachineItem(idx)} className="text-negative hover:text-red-400 transition-colors">
                        <XCircle size={16} />
                      </button>
                    </div>
                    <div className="relative">
                      <select
                        value={m.machine_id}
                        onChange={e => updateMachineItem(idx, 'machine_id', e.target.value)}
                        className={selectCls}
                      >
                        <option value="">Selecionar máquina...</option>
                        {machines.map(mx => <option key={mx.id} value={mx.id}>{mx.name}</option>)}
                        <option value="__manual__">Digitar manualmente</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                    {m.machine_id === '__manual__' && (
                      <input
                        value={m.machine_name}
                        onChange={e => updateMachineItem(idx, 'machine_name', e.target.value)}
                        placeholder="Nome da máquina"
                        className={inputCls}
                      />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase mb-1.5">R$/hora</p>
                        <input
                          type="number"
                          value={m.hourly_rate || ''}
                          onChange={e => updateMachineItem(idx, 'hourly_rate', Number(e.target.value))}
                          placeholder="0,00"
                          className={inputCls}
                          min={0}
                        />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase mb-1.5">Horas est.</p>
                        <input
                          type="number"
                          value={m.estimated_hours || ''}
                          onChange={e => updateMachineItem(idx, 'estimated_hours', Number(e.target.value))}
                          placeholder="0"
                          className={inputCls}
                          min={0}
                          step={0.5}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-white/5">
                      <p className="text-[9px] text-gray-600 font-bold uppercase">Subtotal</p>
                      <p className="text-sm font-black text-positive">
                        {formatCurrency(m.hourly_rate * m.estimated_hours)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={addMachineItem}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/10 text-gray-500 hover:text-primary hover:border-primary/30 text-xs font-black uppercase tracking-wider transition-all"
            >
              <Plus size={14} /> Adicionar máquina
            </button>
          </Section>

          {/* ── Financeiro ── */}
          <Section title="Financeiro" icon={<DollarSign size={14} />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor hora (R$)" required>
                <input
                  type="number"
                  value={form.hourly_rate || ''}
                  onChange={e => setPricing('hourly_rate', Number(e.target.value))}
                  placeholder="0,00"
                  className={inputCls}
                  min={0}
                />
              </Field>
              <Field label="Horas estimadas">
                <input
                  type="number"
                  value={form.estimated_hours || ''}
                  onChange={e => setPricing('estimated_hours', Number(e.target.value))}
                  placeholder="0"
                  className={inputCls}
                  min={0}
                  step={0.5}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Desconto (R$)">
                <input
                  type="number"
                  value={form.discount || ''}
                  onChange={e => setPricing('discount', Number(e.target.value))}
                  placeholder="0,00"
                  className={inputCls}
                  min={0}
                />
              </Field>
              <Field label="Validade">
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={e => set('valid_until', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Total */}
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-widest">Total do Orçamento</p>
                <p className="text-2xl font-black text-white mt-0.5">{formatCurrency(form.total_value)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-gray-500 font-bold">
                  {form.calculation_details
                    ? 'Inclui a composição da calculadora'
                    : `${form.estimated_hours}h × ${formatCurrency(form.hourly_rate)}`}
                </p>
                {!form.calculation_details && form.discount > 0 && (
                  <p className="text-[9px] text-negative font-bold">- {formatCurrency(form.discount)} desconto</p>
                )}
              </div>
            </div>
          </Section>

          {/* ── Observações ── */}
          <Section title="Observações" icon={<FileText size={14} />}>
            <Field label="Condições e notas">
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Ex: Pagamento em 30 dias. Serviço inclui operador..."
                rows={4}
                className={`${inputCls} resize-none`}
              />
            </Field>
          </Section>

        </div>

        {/* ── Fixed Action Bar ── */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-brand-dark/95 backdrop-blur-lg border-t border-white/5 px-4 py-4 space-y-2">
          {success ? (
            <div className="flex items-center justify-center gap-2 py-3 text-positive">
              <CheckCircle2 size={20} />
              <span className="font-black text-sm uppercase tracking-widest">Salvo com sucesso!</span>
            </div>
          ) : (
            <>
              {/* Enviar ao cliente */}
              <button
                onClick={() => handleSave('enviado')}
                disabled={saving || !form.client_name || !form.service_type}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-black text-sm font-black uppercase tracking-widest hover:bg-primary/90 disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
                Salvar e Enviar ao Cliente
              </button>

              {/* Salvar rascunho */}
              <button
                onClick={() => handleSave('rascunho')}
                disabled={saving || !form.client_name || !form.service_type}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-surface-dark/80 border border-white/10 text-gray-300 text-xs font-black uppercase tracking-widest hover:text-white disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                <Save size={14} /> Salvar Rascunho
              </button>
            </>
          )}
        </div>
      </Layout.Content>
    </Layout>
  );
};
