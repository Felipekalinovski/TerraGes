import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import {
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Loader2,
  ArrowUpRight,
  ChevronRight,
  Fuel,
  Home,
  Bell,
  RefreshCw,
  Zap,
  WifiOff,
  FileText,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { machineService } from '../services/machineService';
import { transactionService, Transaction } from '../services/transactionService';
import { maintenanceService } from '../services/maintenanceService';
import { generateReport } from '../services/aiService';

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/**
 * Agrupa transações dos últimos N meses em { name, lucro, custo }[]
 * Substitui o chartData hardcoded por dados reais do Supabase.
 */
function buildChartData(transactions: Transaction[], months = 6) {
  const now = new Date();
  const result: { name: string; lucro: number; custo: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const label = MONTH_LABELS[month];

    const monthTx = transactions.filter(tx => {
      const d = new Date(tx.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const lucro = monthTx
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const custo = monthTx
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    result.push({ name: label, lucro, custo });
  }

  return result;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

// ─── Retry util (exponential backoff) ───────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise(res => setTimeout(res, baseDelayMs * attempt));
      }
    }
  }
  throw lastError;
}

// ─── AI Insight State ────────────────────────────────────────────────────────

type AiState =
  | { status: 'idle' }
  | { status: 'loading'; attempt: number }
  | { status: 'success'; text: string }
  | { status: 'error'; message: string };

// ─── Custom Hook ─────────────────────────────────────────────────────────────

const useDashboardData = () => {
  const [loading, setLoading] = useState(true);
  const [aiState, setAiState] = useState<AiState>({ status: 'idle' });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<{
    machines: { active: number; total: number };
    finance: { totalIncome: number; totalExpense: number; balance: number };
    alerts: any[];
    chartData: { name: string; lucro: number; custo: number }[];
    works: number;
    dieselKl: number;
    incomeGrowth: number;
    horasCount: number;
  }>({
    machines: { active: 0, total: 0 },
    finance: { totalIncome: 0, totalExpense: 0, balance: 0 },
    alerts: [],
    chartData: [],
    works: 0,
    dieselKl: 0,
    incomeGrowth: 0,
    horasCount: 0,
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Verificar onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();
      
      if (profile && profile.onboarding_completed === false) {
        navigate('/onboarding');
        return;
      }

      const [mStats, tStats, recentMaintenance, allTransactions] = await Promise.all([
        machineService.getStats(),
        transactionService.getStats(),
        maintenanceService.getThisMonth(),
        transactionService.getAll(),          // ← dados reais para o gráfico
      ]);

      const chartData = buildChartData(allTransactions, 6);

      // Crescimento: compara mês atual vs mês anterior
      const lastTwo = chartData.slice(-2);
      const incomeGrowth =
        lastTwo.length === 2 && lastTwo[0].lucro > 0
          ? ((lastTwo[1].lucro - lastTwo[0].lucro) / lastTwo[0].lucro) * 100
          : 0;

      // Consultas Reais para RDOS, Consumo de Diesel e Hora-Máquina
      const { count: worksCount } = await supabase
        .from('rdos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'em_andamento');

      const { data: machinesData } = await supabase
        .from('machines')
        .select('fuel_consumption')
        .eq('status', 'active');
      const totalDiesel = machinesData?.reduce((s, m) => s + (m.fuel_consumption || 0), 0) ?? 0;

      const { count: horasCount } = await supabase
        .from('hora_maquina')
        .select('*', { count: 'exact', head: true });

      setDashboardData({
        machines: { active: mStats.active, total: mStats.total },
        finance: tStats,
        alerts: recentMaintenance.slice(0, 3),
        chartData,
        works: worksCount || 0,
        dieselKl: totalDiesel || 0,
        horasCount: horasCount || 0,
        incomeGrowth,
      });
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  const requestAiInsight = useCallback(async (data: any) => {
    setAiState({ status: 'loading', attempt: 1 });
    try {
      let attempt = 1;
      const text = await withRetry(
        async () => {
          setAiState({ status: 'loading', attempt });
          attempt++;
          return generateReport(data, 'general');
        },
        3,
        2000,
      );
      setAiState({ status: 'success', text });
    } catch (err: any) {
      const isRateLimit =
        err?.message?.includes('429') ||
        err?.message?.toLowerCase().includes('rate') ||
        err?.message?.toLowerCase().includes('limite');

      setAiState({
        status: 'error',
        message: isRateLimit
          ? 'Limite de requisições atingido. Aguarde 30s e tente novamente.'
          : 'Não foi possível gerar o insight agora.',
      });
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { loading, dashboardData, aiState, refetch: fetchData, requestAiInsight };
};

// ─── Tooltip customizado ─────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl text-xs">
      <p className="font-black text-white uppercase tracking-widest mb-2">{label}</p>
      <p className="text-positive font-bold">
        Receita: R$ {formatCurrency(payload[0]?.value ?? 0)}
      </p>
      <p className="text-gray-400 font-bold">
        Custo: R$ {formatCurrency(payload[1]?.value ?? 0)}
      </p>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const AiInsightCard: React.FC<{
  aiState: AiState;
  onRequest: () => void;
}> = ({ aiState, onRequest }) => {
  return (
    <div className="relative p-6 rounded-[28px] border border-white/5 overflow-hidden shadow-xl"
      style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,5,5,0.95) 60%)' }}>
      
      {/* Glow decorativo */}
      <div className="absolute -top-8 -right-8 size-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles size={14} className="text-primary" />
          </div>
          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
            Inteligência Estratégica AI
          </h3>
        </div>

        {/* Botão de ação */}
        {aiState.status !== 'loading' && (
          <button
            onClick={onRequest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/25 active:scale-95 transition-all"
          >
            {aiState.status === 'idle' ? (
              <>
                <Zap size={11} />
                Analisar
              </>
            ) : (
              <>
                <RefreshCw size={11} />
                Atualizar
              </>
            )}
          </button>
        )}
      </div>

      {/* Conteúdo por estado */}
      {aiState.status === 'idle' && (
        <p className="text-gray-500 text-sm italic leading-relaxed">
          Toque em{' '}
          <span className="text-primary font-bold not-italic">Analisar</span>{' '}
          para gerar um insight estratégico com base nos seus dados atuais.
        </p>
      )}

      {aiState.status === 'loading' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-gray-400 text-xs">
            <Loader2 size={14} className="animate-spin text-primary flex-shrink-0" />
            <span className="italic">
              {aiState.attempt === 1
                ? 'Sincronizando dados dos canteiros...'
                : `Tentativa ${aiState.attempt}/3 — aguardando IA...`}
            </span>
          </div>
          {/* Skeleton animado */}
          <div className="space-y-2 mt-3">
            <div className="h-2.5 bg-white/5 rounded-full w-full animate-pulse" />
            <div className="h-2.5 bg-white/5 rounded-full w-4/5 animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="h-2.5 bg-white/5 rounded-full w-2/3 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {aiState.status === 'success' && (
        <p className="text-white/85 text-sm font-medium leading-relaxed">
          {aiState.text}
        </p>
      )}

      {aiState.status === 'error' && (
        <div className="flex items-start gap-3">
          <WifiOff size={16} className="text-negative flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-negative/90 text-xs font-bold">{aiState.message}</p>
            <button
              onClick={onRequest}
              className="mt-2 text-[10px] text-primary font-black underline underline-offset-2"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { loading, dashboardData, aiState, refetch, requestAiInsight } = useDashboardData();

  const handleAiRequest = useCallback(() => {
    requestAiInsight({
      machines: dashboardData.machines,
      finance: dashboardData.finance,
      alerts: dashboardData.alerts,
    });
  }, [requestAiInsight, dashboardData]);

  if (loading) {
    return (
      <Layout>
        <Layout.Header title="TerraGes" subTitle="Dashboard Principal" />
        <Layout.Content>
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <Loader2 className="animate-spin text-primary" size={36} />
            <p className="text-gray-500 text-xs uppercase tracking-widest font-black animate-pulse">
              Carregando canteiros...
            </p>
          </div>
        </Layout.Content>
      </Layout>
    );
  }

  const { machines, finance, alerts, chartData, incomeGrowth } = dashboardData;
  const incomeGrowthPositive = incomeGrowth >= 0;

  return (
    <Layout>
      <Layout.Header
        title="TerraGes"
        subTitle="Status em Tempo Real"
        actions={
          <div className="flex items-center gap-3 mr-2">
            <button
              onClick={refetch}
              className="size-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              title="Atualizar dados"
            >
              <RefreshCw size={15} />
            </button>
            <div className="relative">
              <Bell size={20} className="text-gray-400 cursor-pointer hover:text-white transition-colors" />
              {alerts.length > 0 && (
                <div className="absolute -top-1 -right-1 size-2.5 bg-primary rounded-full border border-brand-dark animate-pulse" />
              )}
            </div>
          </div>
        }
      />

      <Layout.Content>
        <div className="px-4 pb-24 pt-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* ── KPI Grid ── */}
          <div className="grid grid-cols-2 gap-3">

            {/* Faturamento */}
            <button
              onClick={() => navigate('/finance')}
              className="bg-surface-dark/50 p-5 rounded-2xl border border-white/5 text-left relative overflow-hidden cursor-pointer hover:border-primary/25 active:scale-[0.97] transition-all shadow-lg group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-positive/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                Faturamento /mês
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-positive">R$</span>
                <span className="text-2xl font-black text-white">
                  {formatCurrency(finance.totalIncome)}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <ArrowUpRight
                  size={12}
                  className={incomeGrowthPositive ? 'text-positive' : 'text-negative rotate-90'}
                />
                <span className={`text-[10px] font-black ${incomeGrowthPositive ? 'text-positive' : 'text-negative'}`}>
                  {incomeGrowthPositive ? '+' : ''}{incomeGrowth.toFixed(1)}%
                </span>
              </div>
            </button>

            {/* Frota */}
            <button
              onClick={() => navigate('/fleet')}
              className="bg-surface-dark/50 p-5 rounded-2xl border border-white/5 text-left cursor-pointer hover:border-primary/25 active:scale-[0.97] transition-all shadow-md"
            >
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                Frota Ativa
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">{machines.active}</span>
                <span className="text-xs font-bold text-gray-500">/ {machines.total}</span>
              </div>
              <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-700 ease-out rounded-full"
                  style={{ width: machines.total > 0 ? `${(machines.active / machines.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-[9px] text-gray-600 font-bold mt-1.5 uppercase tracking-wider">
                {machines.total > 0
                  ? `${Math.round((machines.active / machines.total) * 100)}% operacional`
                  : 'Sem máquinas'}
              </p>
            </button>

            {/* Obras */}
            <button
              onClick={() => navigate('/rdo')}
              className="bg-surface-dark/50 p-5 rounded-2xl border border-white/5 text-left cursor-pointer hover:border-primary/25 active:scale-[0.97] transition-all shadow-lg"
            >
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                Obras em Andamento
              </p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-white">
                  {dashboardData.works > 0 ? String(dashboardData.works).padStart(2, '0') : '—'}
                </span>
                <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Home size={18} />
                </div>
              </div>
              <p className="text-[10px] text-primary/70 font-bold mt-2">Ver diário de obra →</p>
            </button>

            {/* Saldo */}
            <button
              onClick={() => navigate('/finance')}
              className="bg-surface-dark/50 p-5 rounded-2xl border border-white/5 text-left cursor-pointer hover:border-primary/25 active:scale-[0.97] transition-all shadow-lg"
            >
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                Saldo Líquido
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-bold text-gray-400">R$</span>
                    <span className={`text-xl font-black ${finance.balance >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {formatCurrency(Math.abs(finance.balance))}
                    </span>
                  </div>
                </div>
                <Fuel size={20} className="text-gray-600" />
              </div>
              <div className="mt-3 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${finance.balance >= 0 ? 'bg-positive' : 'bg-negative'}`}
                  style={{
                    width: finance.totalIncome > 0
                      ? `${Math.min((finance.totalIncome / (finance.totalIncome + finance.totalExpense)) * 100, 100)}%`
                      : '0%'
                  }}
                />
              </div>
            </button>
          </div>

          {/* ── AI Insight ── */}
          <AiInsightCard aiState={aiState} onRequest={handleAiRequest} />

          {/* ── Gráfico Financeiro (dados reais) ── */}
          <div className="bg-surface-dark/40 p-6 rounded-[28px] border border-white/5 shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-base font-heading font-black text-white uppercase italic tracking-tight">
                  Financeiro
                </h3>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                  Receita vs Custo — últimos 6 meses
                </p>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-wider pt-1">
                <span className="flex items-center gap-1 text-positive">
                  <span className="size-1.5 rounded-full bg-positive" /> Receita
                </span>
                <span className="flex items-center gap-1 text-gray-500">
                  <span className="size-1.5 rounded-full bg-gray-600" /> Custo
                </span>
              </div>
            </div>

            {chartData.every(d => d.lucro === 0 && d.custo === 0) ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <TrendingUp size={28} className="text-gray-700" />
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider text-center">
                  Nenhuma transação registrada ainda.
                  <br />
                  <span className="text-primary cursor-pointer" onClick={() => navigate('/finance')}>
                    Adicionar primeira transação →
                  </span>
                </p>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={4} barCategoryGap="30%">
                    <XAxis
                      dataKey="name"
                      stroke="#333"
                      fontSize={9}
                      fontWeight="900"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    <Bar dataKey="lucro" radius={[5, 5, 0, 0]} barSize={9}>
                      {chartData.map((_, i) => (
                        <Cell key={`l-${i}`} fill="#10B981" opacity={i === chartData.length - 1 ? 1 : 0.65} />
                      ))}
                    </Bar>
                    <Bar dataKey="custo" radius={[5, 5, 0, 0]} barSize={9}>
                      {chartData.map((_, i) => (
                        <Cell key={`c-${i}`} fill="#374151" opacity={i === chartData.length - 1 ? 1 : 0.65} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Relatório Rápido ── */}
          {dashboardData.horasCount > 0 && (
            <button
              onClick={() => navigate('/relatorio-cliente')}
              className="w-full flex items-center justify-between bg-surface-dark/40 border border-primary/20 rounded-2xl p-5 mb-6 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                  <FileText size={18} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-white uppercase tracking-wide">Relatório para Cliente</p>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">{dashboardData.horasCount} apontamentos disponíveis</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-600 group-hover:text-primary transition-colors" />
            </button>
          )}

          {/* ── Alertas Críticos ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                Alertas de Manutenção
              </h3>
              <button
                onClick={() => navigate('/maintenance')}
                className="text-[10px] text-primary font-black uppercase tracking-wider flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                Ver todos <ArrowUpRight size={12} />
              </button>
            </div>

            {alerts.length === 0 ? (
              <div className="bg-surface-dark/40 p-5 rounded-2xl border border-white/5 flex items-center gap-3">
                <div className="size-10 rounded-xl bg-positive/10 flex items-center justify-center text-positive">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Tudo em ordem</p>
                  <p className="text-[11px] text-gray-500 font-medium">Nenhum alerta crítico este mês.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {alerts.map((alert, idx) => (
                  <button
                    key={alert.id ?? idx}
                    onClick={() => navigate('/maintenance')}
                    className="w-full group bg-surface-dark/60 p-4 rounded-2xl border-l-4 border-l-negative border-r border-t border-b border-white/5 flex items-center gap-4 transition-all hover:bg-surface-dark active:scale-[0.98]"
                  >
                    <div className="size-11 rounded-xl bg-negative/10 flex items-center justify-center text-negative flex-shrink-0">
                      <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <h4 className="text-sm font-bold text-white truncate">
                        {alert.machine_name ?? alert.title ?? 'Alerta de manutenção'}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-medium italic truncate">
                        {alert.description ?? alert.type ?? 'Verificar equipamento'}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-700 group-hover:text-primary transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>

        </div>
      </Layout.Content>
    </Layout>
  );
};
