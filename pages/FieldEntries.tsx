import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, ReceiptText, UserRound, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  fieldEntryErrorMessage,
  fieldEntryService,
  type FieldServiceEntry,
} from '../services/fieldEntryService';

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');

export const FieldEntries: React.FC = () => {
  const [entries, setEntries] = useState<FieldServiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<FieldServiceEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [form, setForm] = useState({
    hourlyRate: '',
    billingDocumentType: 'accountant' as 'accountant' | 'receipt' | 'deferred',
    paymentMethod: 'Faturado' as 'Pix' | 'Cartão' | 'Boleto' | 'Faturado' | 'Dinheiro',
  });

  const load = async () => {
    try {
      setLoading(true);
      setEntries(await fieldEntryService.getPending());
    } catch (error) {
      alert(fieldEntryErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = (entry: FieldServiceEntry) => {
    setTarget(entry);
    setForm({ hourlyRate: '', billingDocumentType: 'accountant', paymentMethod: 'Faturado' });
  };

  const convert = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target) return;
    try {
      setActionLoading(true);
      const orderId = await fieldEntryService.convert(
        target.id,
        Number(form.hourlyRate),
        form.billingDocumentType,
        form.paymentMethod,
      );
      setTarget(null);
      await load();
      alert(`Registro confirmado. OS ${orderId.slice(0, 8).toUpperCase()} criada e enviada para o fluxo de faturamento.`);
    } catch (error) {
      alert(fieldEntryErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async (entry: FieldServiceEntry) => {
    const reason = window.prompt('Motivo da rejeição/correção necessária:') || '';
    if (!window.confirm('Rejeitar este registro de campo?')) return;
    try {
      await fieldEntryService.reject(entry.id, reason);
      await load();
    } catch (error) {
      alert(fieldEntryErrorMessage(error));
    }
  };

  return (
    <Layout>
      <Layout.Header title="Registros de campo" subTitle="Revisão do gestor antes do faturamento" />
      <Layout.Content>
        <div className="p-4 pb-32">
          <div className="rounded-[28px] border border-primary/15 bg-primary/5 p-5 mb-5">
            <p className="text-sm font-black text-white">Caixa de confirmação operacional</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              O operador só envia fatos do serviço. Aqui o gestor valida horas, cliente e máquina,
              define o valor/hora e decide como o serviço seguirá para faturamento.
            </p>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center rounded-[30px] border border-dashed border-white/5 bg-surface-dark/20">
              <CheckCircle2 size={30} className="mx-auto text-positive mb-3" />
              <p className="font-black text-white">Nenhum registro aguardando revisão.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map(entry => (
                <div key={entry.id} className="bg-surface-dark/40 border border-white/5 rounded-[28px] p-5">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Clock3 size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-warning/10 text-warning">Aguardando gestor</span>
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-white/5 text-gray-400">{entry.source}</span>
                      </div>
                      <h3 className="text-base font-black text-white">{entry.client_name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(entry.service_date)} · {entry.machine?.name || 'Máquina'} · {entry.total_hours.toFixed(1)} h
                      </p>
                      <p className="text-xs text-gray-400 mt-3">{entry.description}</p>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                        <Info label="Operador" value={entry.operator_name || 'Operador'} />
                        <Info label="Horímetro" value={`${entry.start_meter} → ${entry.end_meter}`} />
                        <Info label="Local" value={entry.location || 'Não informado'} />
                        <Info label="Enviado" value={new Date(entry.created_at).toLocaleString('pt-BR')} />
                      </div>
                      {entry.occurrences && (
                        <p className="mt-3 text-[10px] text-warning bg-warning/5 rounded-xl p-3">Ocorrências: {entry.occurrences}</p>
                      )}
                    </div>
                    <div className="flex md:flex-col gap-2 shrink-0">
                      <button onClick={() => open(entry)} className="h-10 px-4 rounded-xl bg-primary text-black text-[9px] font-black uppercase tracking-widest">
                        Revisar e faturar
                      </button>
                      <button onClick={() => reject(entry)} className="h-10 px-4 rounded-xl bg-white/5 text-gray-400 text-[9px] font-black uppercase tracking-widest">
                        Rejeitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout.Content>

      {target && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={convert} className="w-full max-w-lg bg-surface-dark rounded-[32px] border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-widest">Confirmação do gestor</p>
                <h2 className="text-xl font-black text-white mt-1">{target.client_name}</h2>
              </div>
              <button type="button" onClick={() => setTarget(null)} className="p-2 text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Horas" value={`${target.total_hours.toFixed(1)} h`} />
                <Info label="Máquina" value={target.machine?.name || 'Não informada'} />
              </div>

              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Valor por hora</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.hourlyRate}
                  onChange={event => setForm(current => ({ ...current, hourlyRate: event.target.value }))}
                  className="mt-2 w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                  placeholder="0,00"
                />
                {!!Number(form.hourlyRate) && (
                  <p className="mt-2 text-xs text-primary font-black">
                    Total calculado: {money(target.total_hours * Number(form.hourlyRate))}
                  </p>
                )}
              </div>

              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Destino do faturamento</label>
                <select
                  value={form.billingDocumentType}
                  onChange={event => setForm(current => ({ ...current, billingDocumentType: event.target.value as typeof current.billingDocumentType }))}
                  className="mt-2 w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                >
                  <option value="accountant" className="bg-brand-dark">Preparar dados para contador / sistema fiscal</option>
                  <option value="receipt" className="bg-brand-dark">OS / recibo</option>
                  <option value="deferred" className="bg-brand-dark">Faturar depois</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Forma de pagamento prevista</label>
                <select
                  value={form.paymentMethod}
                  onChange={event => setForm(current => ({ ...current, paymentMethod: event.target.value as typeof current.paymentMethod }))}
                  className="mt-2 w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-4 text-sm text-white"
                >
                  <option value="Faturado" className="bg-brand-dark">Faturado</option>
                  <option value="Pix" className="bg-brand-dark">Pix</option>
                  <option value="Boleto" className="bg-brand-dark">Boleto</option>
                  <option value="Cartão" className="bg-brand-dark">Cartão</option>
                  <option value="Dinheiro" className="bg-brand-dark">Dinheiro</option>
                </select>
              </div>

              <div className="rounded-2xl bg-positive/5 border border-positive/10 p-4 flex gap-3">
                <ReceiptText size={18} className="text-positive shrink-0" />
                <p className="text-[10px] text-gray-400">
                  Confirmar cria a OS concluída e a receita pendente. Se escolher contador, o TerraGes prepara os dados para emissão fiscal externa; ele não emite NFS-e.
                </p>
              </div>

              <button
                type="submit"
                disabled={actionLoading || !form.hourlyRate}
                className="w-full h-12 rounded-2xl bg-primary text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <UserRound size={15} />}
                Confirmar e criar OS
              </button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-black/20 rounded-xl p-3 border border-white/5 min-w-0">
    <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{label}</p>
    <p className="text-[10px] text-gray-300 mt-1 truncate">{value}</p>
  </div>
);
