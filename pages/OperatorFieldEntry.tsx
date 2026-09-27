import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Send, ShieldCheck, Truck } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  fieldEntryErrorMessage,
  fieldEntryService,
  type FieldMachineOption,
} from '../services/fieldEntryService';

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export const OperatorFieldEntry: React.FC = () => {
  const [machines, setMachines] = useState<FieldMachineOption[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    serviceDate: today(),
    clientName: '',
    location: '',
    machineId: '',
    startMeter: '',
    endMeter: '',
    description: '',
    occurrences: '',
  });

  useEffect(() => {
    fieldEntryService
      .getMachineOptions()
      .then(setMachines)
      .catch(() => setMachines([]))
      .finally(() => setLoadingMachines(false));
  }, []);

  const hours = useMemo(() => {
    const start = Number(form.startMeter);
    const end = Number(form.endMeter);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 0;
  }, [form.startMeter, form.endMeter]);

  const update = (key: keyof typeof form, value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.machineId || !form.clientName || !form.description) return;

    try {
      setSaving(true);
      await fieldEntryService.submit({
        serviceDate: form.serviceDate,
        clientName: form.clientName,
        location: form.location,
        machineId: form.machineId,
        startMeter: Number(form.startMeter),
        endMeter: Number(form.endMeter),
        description: form.description,
        occurrences: form.occurrences,
      });
      setSent(true);
      setForm(current => ({
        ...current,
        clientName: '',
        location: '',
        startMeter: '',
        endMeter: '',
        description: '',
        occurrences: '',
      }));
      setTimeout(() => setSent(false), 5000);
    } catch (error) {
      alert(fieldEntryErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Layout.Header
        title="Registrar serviço"
        subTitle="Envio operacional para o gestor"
      />
      <Layout.Content>
        <div className="max-w-2xl mx-auto p-4 pb-32">
          <div className="mb-5 rounded-[28px] border border-primary/15 bg-primary/5 p-5 flex gap-4">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="font-black text-white">Perfil de operação: somente envio.</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Você registra o que aconteceu no serviço. Dados financeiros, histórico da empresa,
                faturamento, cobranças e relatórios ficam disponíveis apenas para o gestor ou administrador.
              </p>
            </div>
          </div>

          {sent && (
            <div className="mb-5 rounded-[24px] border border-positive/20 bg-positive/10 p-4 flex items-center gap-3 text-positive">
              <CheckCircle2 size={20} />
              <div>
                <p className="text-sm font-black">Dados enviados ao gestor.</p>
                <p className="text-[10px] text-gray-400 mt-0.5">O gestor recebeu uma notificação para revisar e seguir com o faturamento.</p>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <section className="bg-surface-dark/40 border border-white/5 rounded-[30px] p-6 space-y-5">
              <div className="flex items-center gap-3">
                <Truck size={20} className="text-primary" />
                <h2 className="text-sm font-black uppercase tracking-widest">Dados do serviço</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Data" type="date" value={form.serviceDate} onChange={value => update('serviceDate', value)} required />
                <Field label="Cliente / obra" value={form.clientName} onChange={value => update('clientName', value)} required placeholder="Ex.: Obra loteamento Primavera" />
              </div>

              <Field label="Local do serviço" value={form.location} onChange={value => update('location', value)} placeholder="Local, frente de trabalho ou referência" />

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Máquina</label>
                <select
                  required
                  disabled={loadingMachines}
                  value={form.machineId}
                  onChange={event => update('machineId', event.target.value)}
                  className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white outline-none focus:border-primary/50 disabled:opacity-50"
                >
                  <option value="" className="bg-brand-dark">
                    {loadingMachines ? 'Carregando máquinas permitidas...' : 'Selecione a máquina'}
                  </option>
                  {machines.map(machine => (
                    <option key={machine.id} value={machine.id} className="bg-brand-dark">
                      {machine.name} · {machine.type}
                    </option>
                  ))}
                </select>
                {!loadingMachines && machines.length === 0 && (
                  <p className="mt-2 text-[10px] text-warning">Nenhuma máquina está atribuída ao seu usuário. Fale com o gestor.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Horímetro inicial" type="number" step="0.1" value={form.startMeter} onChange={value => update('startMeter', value)} required />
                <Field label="Horímetro final" type="number" step="0.1" value={form.endMeter} onChange={value => update('endMeter', value)} required />
              </div>

              <div className="rounded-2xl bg-black/20 border border-white/5 p-4">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Horas registradas</p>
                <p className="text-xl font-black text-white mt-1">{hours > 0 ? `${hours.toFixed(1)} h` : '—'}</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Serviço executado</label>
                <textarea
                  required
                  rows={4}
                  value={form.description}
                  onChange={event => update('description', event.target.value)}
                  placeholder="Descreva objetivamente o serviço realizado..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-primary/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Ocorrências / observações</label>
                <textarea
                  rows={3}
                  value={form.occurrences}
                  onChange={event => update('occurrences', event.target.value)}
                  placeholder="Paradas, dificuldade de acesso, chuva, avaria, observações..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-primary/50 resize-none"
                />
              </div>
            </section>

            <button
              type="submit"
              disabled={saving || !machines.length}
              className="w-full h-14 rounded-2xl bg-primary text-black font-black uppercase tracking-[0.18em] text-xs flex items-center justify-center gap-3 disabled:opacity-40"
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Send size={19} />}
              Enviar dados ao gestor
            </button>
          </form>
        </div>
      </Layout.Content>
    </Layout>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  placeholder?: string;
  required?: boolean;
}> = ({ label, value, onChange, type = 'text', step, placeholder, required }) => (
  <div>
    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">{label}</label>
    <input
      type={type}
      step={step}
      required={required}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white outline-none focus:border-primary/50"
    />
  </div>
);
