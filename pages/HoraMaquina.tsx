import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import {
  Plus, Clock, ChevronRight, Loader2, Calendar,
  Wrench, DollarSign, CheckCircle2, Save, XCircle, ChevronDown, Timer,
} from 'lucide-react';
import {
  horaMaquinaService, HoraMaquina, HoraMaquinaFormData,
  calcTotalHours, formatHours,
} from '../services/horaMaquinaService';
import { machineService, Machine } from '../services/machineService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

const inputCls = "w-full bg-black/40 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors";
const selectCls = `${inputCls} appearance-none cursor-pointer`;

// ─── Quick Log Modal ──────────────────────────────────────────────────────────

const QuickLogModal: React.FC<{
  machines: Machine[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ machines, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<HoraMaquinaFormData>({
    machine_id:     '',
    machine_name:   '',
    operator_name:  '',
    project_name:   '',
    client_name:    '',
    date:           today(),
    start_time:     '07:00',
    end_time:       '17:00',
    total_hours:    8,
    break_minutes:  60,
    hourly_rate:    0,
    total_value:    0,
    service_type:   '',
    observations:   '',
  });

  // Recalculate hours and value when times change
  useEffect(() => {
    const hours = calcTotalHours(form.start_time, form.end_time, form.break_minutes);
    const value = Math.max(0, hours * form.hourly_rate);
    setForm(prev => ({ ...prev, total_hours: hours, total_value: value }));
  }, [form.start_time, form.end_time, form.break_minutes, form.hourly_rate]);

  const set = <K extends keyof HoraMaquinaFormData>(key: K, val: HoraMaquinaFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleMachineSelect = (machineId: string) => {
    const m = machines.find(mx => mx.id === machineId);
    set('machine_id', machineId);
    if (m) set('machine_name', m.name);
  };

  const handleSave = async () => {
    if (!form.machine_name || !form.project_name || form.total_hours <= 0) return;
    setSaving(true);
    try {
      await horaMaquinaService.create(form);
      setSuccess(true);
      setTimeout(() => { onSaved(); onClose(); }, 1000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-brand-dark border-t border-white/10 rounded-t-[32px] px-5 pb-10 pt-5 space-y-4 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2" />

        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white uppercase">Registrar Horas</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        {/* Máquina */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Máquina *</label>
          <div className="relative">
            <select
              value={form.machine_id}
              onChange={e => handleMachineSelect(e.target.value)}
              className={selectCls}
            >
              <option value="">Selecionar máquina...</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value="__manual__">Digitar manualmente</option>
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
          {form.machine_id === '__manual__' && (
            <input
              value={form.machine_name}
              onChange={e => set('machine_name', e.target.value)}
              placeholder="Nome da máquina"
              className={inputCls}
            />
          )}
        </div>

        {/* Obra/Cliente */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Obra / Projeto *</label>
            <input
              value={form.project_name}
              onChange={e => set('project_name', e.target.value)}
              placeholder="Ex: Loteamento São Paulo"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cliente</label>
            <input
              value={form.client_name}
              onChange={e => set('client_name', e.target.value)}
              placeholder="Nome do cliente"
              className={inputCls}
            />
          </div>
        </div>

        {/* Data */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Data</label>
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Horários */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Entrada</label>
            <input
              type="time"
              value={form.start_time}
              onChange={e => set('start_time', e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Saída</label>
            <input
              type="time"
              value={form.end_time}
              onChange={e => set('end_time', e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pausa (min)</label>
            <input
              type="number"
              value={form.break_minutes || ''}
              onChange={e => set('break_minutes', Number(e.target.value))}
              placeholder="60"
              className={inputCls}
              min={0}
              step={15}
            />
          </div>
        </div>

        {/* Horas calculadas */}
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3">
          <Timer size={18} className="text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[9px] font-black text-primary uppercase tracking-widest">Horas calculadas</p>
            <p className="text-xl font-black text-white">{formatHours(form.total_hours)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-gray-500 font-bold">R$/h</p>
            <input
              type="number"
              value={form.hourly_rate || ''}
              onChange={e => set('hourly_rate', Number(e.target.value))}
              placeholder="0"
              className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-primary/50"
              min={0}
            />
          </div>
        </div>

        {/* Total */}
        {form.total_value > 0 && (
          <div className="flex items-center justify-between bg-surface-dark/60 rounded-2xl px-4 py-3 border border-white/5">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total a cobrar</p>
            <p className="text-lg font-black text-positive">{formatCurrency(form.total_value)}</p>
          </div>
        )}

        {/* Operador e Observações */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Operador</label>
            <input
              value={form.operator_name}
              onChange={e => set('operator_name', e.target.value)}
              placeholder="Nome do operador"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tipo serviço</label>
            <input
              value={form.service_type}
              onChange={e => set('service_type', e.target.value)}
              placeholder="Ex: Escavação"
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Observações</label>
          <textarea
            value={form.observations}
            onChange={e => set('observations', e.target.value)}
            placeholder="Atividades realizadas, ocorrências..."
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !form.machine_name || !form.project_name || form.total_hours <= 0}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-black text-sm font-black uppercase tracking-widest hover:bg-primary/90 disabled:opacity-40 active:scale-[0.98] transition-all mt-2"
        >
          {success ? (
            <><CheckCircle2 size={18} /> Registrado!</>
          ) : saving ? (
            <><Loader2 size={18} className="animate-spin" /> Salvando...</>
          ) : (
            <><Save size={16} /> Salvar Registro</>
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const HoraMaquinaPage: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords]       = useState<HoraMaquina[]>([]);
  const [machines, setMachines]     = useState<Machine[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [monthStats, setMonthStats] = useState({ totalHours: 0, totalValue: 0, recordCount: 0 });
  const [filterProject, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, mx, stats] = await Promise.all([
        horaMaquinaService.getAll(),
        machineService.getAll(),
        horaMaquinaService.getMonthStats(),
      ]);
      setRecords(data);
      setMachines(mx.filter(m => m.status === 'active'));
      setMonthStats(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Unique projects for filter
  const projects = Array.from(new Set(records.map(r => r.project_name))).sort();

  const filtered = filterProject
    ? records.filter(r => r.project_name === filterProject)
    : records;

  // Group by date for display
  const grouped = filtered.reduce((acc, r) => {
    if (!acc[r.date]) acc[r.date] = [];
    acc[r.date].push(r);
    return acc;
  }, {} as Record<string, HoraMaquina[]>);

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <Layout>
        <Layout.Header
          title="Hora-Máquina"
          subTitle="Controle de horas"
          actions={
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-wider hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Plus size={14} /> Registrar
            </button>
          }
        />

        <Layout.Content>
          <div className="px-4 pb-24 pt-4 space-y-5 animate-in fade-in duration-500">

            {/* ── Mês Stats ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 text-center">
                <p className="text-xl font-black text-white">{formatHours(monthStats.totalHours)}</p>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Horas/mês</p>
              </div>
              <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 text-center">
                <p className="text-xl font-black text-positive">
                  {monthStats.totalValue > 0 ? `${(monthStats.totalValue / 1000).toFixed(0)}K` : '—'}
                </p>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">R$ mês</p>
              </div>
              <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 text-center">
                <p className="text-xl font-black text-white">{monthStats.recordCount}</p>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Registros</p>
              </div>
            </div>

            {/* ── Project filter ── */}
            {projects.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setFilter('')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    !filterProject ? 'bg-primary text-black' : 'bg-surface-dark/60 text-gray-500 border border-white/5'
                  }`}
                >
                  Todos
                </button>
                {projects.map(p => (
                  <button
                    key={p}
                    onClick={() => setFilter(p)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      filterProject === p ? 'bg-primary text-black' : 'bg-surface-dark/60 text-gray-500 border border-white/5'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* ── Records ── */}
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="animate-spin text-primary" />
              </div>
            ) : sortedDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="size-16 rounded-2xl bg-surface-dark/60 flex items-center justify-center text-gray-600 border border-white/5">
                  <Clock size={28} />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold">Nenhum registro ainda</p>
                  <p className="text-gray-500 text-sm mt-1">Registre o primeiro apontamento de hora-máquina.</p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-wider"
                >
                  <Plus size={14} /> Registrar agora
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {sortedDates.map(date => (
                  <div key={date}>
                    {/* Date header */}
                    <div className="flex items-center gap-3 mb-3 px-1">
                      <Calendar size={12} className="text-gray-600" />
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        {formatDateBR(date)}
                      </p>
                      <div className="flex-1 h-px bg-white/5" />
                      <p className="text-[10px] font-black text-gray-600">
                        {formatHours(grouped[date].reduce((s, r) => s + r.total_hours, 0))}
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      {grouped[date].map(record => (
                        <div
                          key={record.id}
                          className="bg-surface-dark/50 border border-white/5 rounded-2xl p-4 flex items-center gap-4"
                        >
                          {/* Icon */}
                          <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                            <Wrench size={18} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{record.machine_name}</p>
                            <p className="text-[10px] text-gray-500 font-medium truncate">{record.project_name}</p>
                            <p className="text-[9px] text-gray-600 font-bold mt-0.5">
                              {record.start_time} → {record.end_time}
                              {record.operator_name && ` · ${record.operator_name}`}
                            </p>
                          </div>

                          {/* Hours + Value */}
                          <div className="text-right flex-shrink-0 space-y-0.5">
                            <div className="flex items-center gap-1 justify-end">
                              <Clock size={11} className="text-primary" />
                              <p className="text-sm font-black text-white">{formatHours(record.total_hours)}</p>
                            </div>
                            {record.total_value > 0 && (
                              <p className="text-[10px] font-bold text-positive">{formatCurrency(record.total_value)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Ver relatório CTA */}
            {records.length >= 3 && (
              <button
                onClick={() => navigate('/relatorio-cliente')}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-primary/30 bg-primary/5 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/10 transition-all"
              >
                <ChevronRight size={14} /> Gerar Relatório para Cliente
              </button>
            )}

          </div>
        </Layout.Content>
      </Layout>

      {/* Quick Log Modal */}
      {showModal && (
        <QuickLogModal
          machines={machines}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </>
  );
};
