import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import {
  Plus, Search, FileText, ChevronRight, TrendingUp,
  CheckCircle2, Clock, XCircle, Loader2, Send,
} from 'lucide-react';
import {
  orcamentoService, Orcamento as OrcamentoType, OrcamentoStatus,
  STATUS_CONFIG, formatOrcamentoNumber,
} from '../services/orcamentoService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const STATUS_ICON: Record<OrcamentoStatus, React.ReactNode> = {
  rascunho: <FileText   size={14} />,
  enviado:  <Send       size={14} />,
  aprovado: <CheckCircle2 size={14} />,
  recusado: <XCircle    size={14} />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Orcamento: React.FC = () => {
  const navigate = useNavigate();
  const [orcamentos, setOrcamentos] = useState<OrcamentoType[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilter]   = useState<OrcamentoStatus | 'todos'>('todos');
  const [stats, setStats]           = useState({ total: 0, aprovados: 0, pendentes: 0, valorAprovado: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        orcamentoService.getAll(),
        orcamentoService.getStats(),
      ]);
      setOrcamentos(data);
      setStats(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orcamentos.filter(o => {
    const matchSearch =
      o.client_name.toLowerCase().includes(search.toLowerCase()) ||
      o.service_type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'todos' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <Layout>
      <Layout.Header
        title="Orçamentos"
        subTitle="Propostas comerciais"
        actions={
          <button
            onClick={() => navigate('/orcamentos/novo')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-wider hover:bg-primary/90 active:scale-95 transition-all"
          >
            <Plus size={14} /> Novo
          </button>
        }
      />

      <Layout.Content>
        <div className="px-4 pb-24 pt-4 space-y-5 animate-in fade-in duration-500">

          {/* ── KPI Strip ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 text-center">
              <p className="text-xl font-black text-white">{stats.total}</p>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Total</p>
            </div>
            <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 text-center">
              <p className="text-xl font-black text-positive">{stats.aprovados}</p>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Aprovados</p>
            </div>
            <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 text-center">
              <p className="text-xl font-black text-white">{stats.pendentes}</p>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Pendentes</p>
            </div>
          </div>

          {/* Valor aprovado banner */}
          {stats.valorAprovado > 0 && (
            <div className="flex items-center gap-3 bg-positive/10 border border-positive/20 rounded-2xl px-4 py-3">
              <TrendingUp size={18} className="text-positive flex-shrink-0" />
              <div>
                <p className="text-[9px] font-black text-positive uppercase tracking-widest">Valor aprovado</p>
                <p className="text-base font-black text-white">{formatCurrency(stats.valorAprovado)}</p>
              </div>
            </div>
          )}

          {/* ── Search ── */}
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente ou serviço..."
              className="w-full bg-surface-dark/60 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          {/* ── Filter pills ── */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(['todos', 'rascunho', 'enviado', 'aprovado', 'recusado'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterStatus === s
                    ? 'bg-primary text-black'
                    : 'bg-surface-dark/60 text-gray-500 border border-white/5 hover:text-white'
                }`}
              >
                {s === 'todos' ? 'Todos' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {/* ── List ── */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="size-16 rounded-2xl bg-surface-dark/60 flex items-center justify-center text-gray-600 border border-white/5">
                <FileText size={28} />
              </div>
              <div className="text-center">
                <p className="text-white font-bold">Nenhum orçamento</p>
                <p className="text-gray-500 text-sm mt-1">
                  {search ? 'Tente outro termo de busca.' : 'Crie seu primeiro orçamento.'}
                </p>
              </div>
              {!search && (
                <button
                  onClick={() => navigate('/orcamentos/novo')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-wider"
                >
                  <Plus size={14} /> Criar orçamento
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(o => {
                const cfg = STATUS_CONFIG[o.status];
                return (
                  <button
                    key={o.id}
                    onClick={() => navigate(`/orcamentos/${o.id}`)}
                    className="w-full group bg-surface-dark/50 border border-white/5 rounded-2xl p-4 flex items-center gap-4 text-left hover:border-primary/20 active:scale-[0.98] transition-all"
                  >
                    {/* Icon */}
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <FileText size={22} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-black text-gray-600 uppercase">
                          {formatOrcamentoNumber(o.number)}
                        </span>
                        <span className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
                          {STATUS_ICON[o.status]} {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white truncate">{o.client_name}</p>
                      <p className="text-[10px] text-gray-500 font-medium truncate">{o.service_type}</p>
                    </div>

                    {/* Value + Date */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-white">{formatCurrency(o.total_value)}</p>
                      <p className="text-[9px] text-gray-600 font-bold mt-0.5">{formatDate(o.created_at)}</p>
                    </div>

                    <ChevronRight size={16} className="text-gray-700 group-hover:text-primary transition-colors flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Layout.Content>
    </Layout>
  );
};
