import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { isOperator, isAdminUser } from '../services/roleService';
import { supabase } from '../services/supabaseClient';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Clock,
  ChevronRight,
  FileText,
  ClipboardList,
  Hammer,
  Loader2,
  BarChart2,
  Users,
  Truck,
  Wrench,
  CalendarDays,
  DollarSign,
  FileBarChart,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Activity,
  RefreshCw,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBRLShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$${(value / 1_000).toFixed(0)}k`;
  return formatBRL(value);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  saldoLiquido: number;
  totalReceita: number;
  totalDespesa: number;
  osPendentes: number;
  osCompletadas: number;
  orcamentosPendentes: number;
  horasMes: number;
  receitaMensal: { mes: string; receita: number; despesa: number }[];
  osStatusData: { name: string; value: number; color: string }[];
  ultimasTransacoes: { title: string; amount: number; type: string; date: string }[];
}

async function loadDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [txResult, osResult, orcResult, horasResult] = await Promise.all([
    supabase.from('transactions').select('type, amount, date, title').order('date', { ascending: true }),
    supabase.from('service_orders').select('status'),
    supabase.from('orcamentos').select('status'),
    supabase
      .from('hora_maquina')
      .select('total_hours')
      .gte('date', firstDayOfMonth)
      .lte('date', lastDayOfMonth),
  ]);

  const transactions = txResult.data || [];
  const orders = osResult.data || [];
  const orcamentos = orcResult.data || [];
  const horas = horasResult.data || [];

  // KPIs Financeiros
  let totalReceita = 0;
  let totalDespesa = 0;
  transactions.forEach(t => {
    if (t.type === 'income') totalReceita += t.amount ?? 0;
    else totalDespesa += t.amount ?? 0;
  });
  const saldoLiquido = totalReceita - totalDespesa;

  // KPIs OS
  const osPendentes = orders.filter(o => o.status === 'pending').length;
  const osCompletadas = orders.filter(o => o.status === 'completed').length;

  // Orçamentos Pendentes
  const orcamentosPendentes = orcamentos.filter(
    o => o.status === 'enviado' || o.status === 'rascunho'
  ).length;

  // Horas do mês
  const horasMes = horas.reduce((s, r) => s + (r.total_hours ?? 0), 0);

  // Gráfico de receita mensal (últimos 6 meses)
  const monthMap = new Map<string, { receita: number; despesa: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString('pt-BR', { month: 'short' });
    monthMap.set(key, { receita: 0, despesa: 0 });
  }
  transactions.forEach(t => {
    const d = new Date(t.date);
    // Only last 6 months
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo < 0 || monthsAgo > 5) return;
    const key = d.toLocaleDateString('pt-BR', { month: 'short' });
    if (monthMap.has(key)) {
      const entry = monthMap.get(key)!;
      if (t.type === 'income') entry.receita += t.amount ?? 0;
      else entry.despesa += t.amount ?? 0;
    }
  });
  const receitaMensal = Array.from(monthMap.entries()).map(([mes, vals]) => ({
    mes,
    receita: Math.round(vals.receita),
    despesa: Math.round(vals.despesa),
  }));

  // Dados para gráfico de pizza - Status OS
  const osCancelled = orders.filter(o => o.status === 'cancelled').length;
  const osStatusData = [
    { name: 'Concluídas', value: osCompletadas, color: '#10B981' },
    { name: 'Pendentes', value: osPendentes, color: '#F59E0B' },
    { name: 'Canceladas', value: osCancelled, color: '#EF4444' },
  ].filter(d => d.value > 0);

  // Últimas 5 transações
  const ultimasTransacoes = transactions
    .slice()
    .reverse()
    .slice(0, 5)
    .map(t => ({
      title: t.title || 'Sem título',
      amount: t.amount ?? 0,
      type: t.type,
      date: t.date,
    }));

  return {
    saldoLiquido,
    totalReceita,
    totalDespesa,
    osPendentes,
    osCompletadas,
    orcamentosPendentes,
    horasMes,
    receitaMensal,
    osStatusData,
    ultimasTransacoes,
  };
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-dark/95 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {formatBRL(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Dashboard Principal ───────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark text-white">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  const userRole = profile?.role;
  const isOp = isOperator(userRole);
  const isAdmin = isAdminUser(userRole);

  if (!isAdmin && isOp) {
    return <OperadorDashboard />;
  }

  return <AdminDashboard />;
};

// ─── Dashboard do Operador ─────────────────────────────────────────────────────

function OperadorDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <Layout>
      <Layout.Header title="TerraGes" subTitle="Registro do Dia" />
      <Layout.Content>
        <div className="px-4 pb-24 pt-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Saudação */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-accent/5 p-6 rounded-2xl border border-primary/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-black mb-3 shadow-lg shadow-primary/20">
                <Truck size={22} strokeWidth={2.5} />
              </div>
              <p className="text-sm text-gray-400 font-medium">
                Olá, <span className="text-white font-bold">{profile?.name || 'Operador'}</span>!
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Use os botões abaixo para registrar suas atividades.
              </p>
            </div>
          </div>

          {/* Botões de registro rápido */}
          <div className="space-y-3">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">
              Registro Rápido
            </p>

            {[
              { label: 'Hora-Máquina', sub: 'Registrar horas trabalhadas', icon: Clock, path: '/hora-maquina' },
              { label: 'Ordem de Serviço', sub: 'Nova OS para cliente', icon: ClipboardList, path: '/service-orders/new' },
              { label: 'Diário de Obra', sub: 'Registrar atividades do dia', icon: Hammer, path: '/rdo/new' },
            ].map(({ label, sub, icon: Icon, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="w-full flex items-center justify-between bg-surface-dark/50 border border-white/5 rounded-2xl p-5 hover:border-primary/30 active:scale-[0.98] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Icon size={24} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{label}</p>
                    <p className="text-[10px] text-gray-500">{sub}</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-600 group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate('/service-orders')}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-surface-dark/30 border border-white/5 text-gray-400 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
          >
            <FileText size={16} />
            Ver Minhas Ordens de Serviço
          </button>
        </div>
      </Layout.Content>
    </Layout>
  );
}

// ─── Dashboard do Admin ───────────────────────────────────────────────────────

const MODULES = [
  { label: 'Agenda', icon: CalendarDays, path: '/schedule', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { label: 'Frota', icon: Truck, path: '/fleet', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { label: 'Manutenção', icon: Wrench, path: '/maintenance', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { label: 'Equipe', icon: Users, path: '/employees', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  { label: 'Financeiro', icon: DollarSign, path: '/finance', color: 'text-green-400', bg: 'bg-green-400/10' },
  { label: 'Relatórios', icon: FileBarChart, path: '/reports', color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  { label: 'Ordens de Serviço', icon: ClipboardList, path: '/service-orders', color: 'text-primary', bg: 'bg-primary/10' },
  { label: 'Hora-Máquina', icon: Clock, path: '/hora-maquina', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  { label: 'RDO', icon: Hammer, path: '/rdo', color: 'text-red-400', bg: 'bg-red-400/10' },
  { label: 'Orçamentos', icon: BarChart2, path: '/orcamentos', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  { label: 'IA / Chat', icon: MessageSquare, path: '/chat', color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { label: 'Rel. Cliente', icon: FileText, path: '/relatorio-cliente', color: 'text-pink-400', bg: 'bg-pink-400/10' },
];

function AdminDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState(false);

  const fetchStats = async () => {
    setLoadingStats(true);
    setErrorStats(false);
    try {
      const data = await loadDashboardStats();
      setStats(data);
    } catch {
      setErrorStats(true);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const saldoPositivo = (stats?.saldoLiquido ?? 0) >= 0;

  return (
    <Layout>
      <Layout.Header title="TerraGes" subTitle="Painel Gerencial" />
      <Layout.Content>
        <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* ── Hero - Saldo Líquido ─────────────────────────────────────────── */}
          <div className="relative overflow-hidden mx-4 mt-4 rounded-3xl border border-white/5 bg-surface-dark/50 p-6">
            {/* Glow decorativo */}
            <div
              className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{ background: saldoPositivo ? '#10B981' : '#EF4444' }}
            />

            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                  Saldo Líquido
                </p>
                <p className="text-xs text-gray-500">Receitas deduzidas as despesas</p>
              </div>
              <button
                onClick={fetchStats}
                disabled={loadingStats}
                className="size-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              >
                <RefreshCw size={14} className={loadingStats ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingStats ? (
              <div className="flex items-center gap-3 h-12">
                <Loader2 size={28} className="animate-spin text-primary" />
                <p className="text-gray-500 text-sm">Carregando dados...</p>
              </div>
            ) : errorStats ? (
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertCircle size={20} />
                <p className="text-sm">Erro ao carregar dados. <button onClick={fetchStats} className="underline">Tentar novamente</button></p>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3 mb-4">
                  <p
                    className="text-4xl font-black font-heading tracking-tight"
                    style={{ color: saldoPositivo ? '#10B981' : '#EF4444' }}
                  >
                    {formatBRL(stats?.saldoLiquido ?? 0)}
                  </p>
                  {saldoPositivo ? (
                    <TrendingUp size={22} className="text-primary mb-1" />
                  ) : (
                    <TrendingDown size={22} className="text-negative mb-1" />
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-primary" />
                    <p className="text-[11px] text-gray-400">Receita <span className="text-white font-semibold">{formatBRLShort(stats?.totalReceita ?? 0)}</span></p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-negative" />
                    <p className="text-[11px] text-gray-400">Despesa <span className="text-white font-semibold">{formatBRLShort(stats?.totalDespesa ?? 0)}</span></p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── KPI Cards ────────────────────────────────────────────────────── */}
          {!loadingStats && !errorStats && stats && (
            <div className="grid grid-cols-2 gap-3 px-4 mt-4 lg:grid-cols-4">
              <KpiCard
                label="OS em Aberto"
                value={String(stats.osPendentes)}
                sub={`${stats.osCompletadas} concluídas`}
                icon={<ClipboardList size={18} />}
                color="text-yellow-400"
                bg="bg-yellow-400/10"
              />
              <KpiCard
                label="Orçamentos"
                value={String(stats.orcamentosPendentes)}
                sub="pendentes de resposta"
                icon={<BarChart2 size={18} />}
                color="text-blue-400"
                bg="bg-blue-400/10"
              />
              <KpiCard
                label="Horas/Mês"
                value={`${stats.horasMes.toFixed(1)}h`}
                sub="hora-máquina no mês"
                icon={<Clock size={18} />}
                color="text-cyan-400"
                bg="bg-cyan-400/10"
              />
              <KpiCard
                label="Atividade"
                value={String(stats.osCompletadas + stats.osPendentes)}
                sub="ordens no total"
                icon={<Activity size={18} />}
                color="text-primary"
                bg="bg-primary/10"
              />
            </div>
          )}

          {/* ── Gráfico Receita x Despesa ─────────────────────────────────── */}
          {!loadingStats && !errorStats && stats && (
            <div className="mx-4 mt-4 rounded-3xl border border-white/5 bg-surface-dark/50 p-5">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">
                Receita × Despesa — Últimos 6 meses
              </p>
              {stats.receitaMensal.every(d => d.receita === 0 && d.despesa === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-600">
                  <BarChart2 size={32} />
                  <p className="text-xs">Nenhuma transação registrada ainda.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={stats.receitaMensal} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 10, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#4B5563' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => formatBRLShort(v).replace('R$', '')}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="receita"
                      name="Receita"
                      stroke="#10B981"
                      strokeWidth={2}
                      fill="url(#gradReceita)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="despesa"
                      name="Despesa"
                      stroke="#EF4444"
                      strokeWidth={2}
                      fill="url(#gradDespesa)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* ── Gráfico Status OS + Últimas Transações ───────────────────────── */}
          {!loadingStats && !errorStats && stats && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-4 mt-4">

              {/* PieChart Status OS */}
              <div className="rounded-3xl border border-white/5 bg-surface-dark/50 p-5">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">
                  Status das Ordens de Serviço
                </p>
                {stats.osStatusData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-600">
                    <ClipboardList size={32} />
                    <p className="text-xs">Nenhuma OS registrada ainda.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={100} height={100}>
                      <PieChart>
                        <Pie
                          data={stats.osStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={28}
                          outerRadius={45}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {stats.osStatusData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 flex-1">
                      {stats.osStatusData.map(d => (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full" style={{ background: d.color }} />
                            <p className="text-[11px] text-gray-400">{d.name}</p>
                          </div>
                          <p className="text-[11px] font-bold text-white">{d.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Últimas transações */}
              <div className="rounded-3xl border border-white/5 bg-surface-dark/50 p-5">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">
                  Últimas Movimentações
                </p>
                {stats.ultimasTransacoes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-600">
                    <DollarSign size={32} />
                    <p className="text-xs">Nenhuma transação ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats.ultimasTransacoes.map((t, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-[11px] font-semibold text-white truncate">{t.title}</p>
                          <p className="text-[10px] text-gray-600">
                            {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <p
                          className="text-[11px] font-bold tabular-nums"
                          style={{ color: t.type === 'income' ? '#10B981' : '#EF4444' }}
                        >
                          {t.type === 'income' ? '+' : '-'}{formatBRLShort(t.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Atalhos Rápidos ───────────────────────────────────────────── */}
          <div className="px-4 mt-6">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1 mb-3">
              Acesso Rápido
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {MODULES.map(({ label, icon: Icon, path, color, bg }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center gap-2 bg-surface-dark/50 border border-white/5 rounded-2xl p-4 hover:border-white/15 active:scale-[0.96] transition-all text-center"
                >
                  <div className={`size-10 rounded-xl ${bg} flex items-center justify-center ${color}`}>
                    <Icon size={20} />
                  </div>
                  <p className="text-[10px] font-semibold text-gray-400 leading-tight">{label}</p>
                </button>
              ))}
            </div>
          </div>

        </div>
      </Layout.Content>
    </Layout>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex flex-col gap-3 bg-surface-dark/50 border border-white/5 rounded-2xl p-4">
      <div className={`size-9 rounded-xl ${bg} flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-black font-heading text-white leading-none">{value}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
        <p className="text-[9px] text-gray-600 mt-0.5 leading-tight">{sub}</p>
      </div>
    </div>
  );
}

export default Dashboard;
