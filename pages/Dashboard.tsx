import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import {
  TrendingUp,
  AlertTriangle,
  Droplet,
  Calendar,
  Sparkles,
  Loader2,
  ArrowUpRight,
  ChevronRight,
  Fuel,
  Home,
  Bell
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { machineService } from '../services/machineService';
import { transactionService } from '../services/transactionService';
import { maintenanceService } from '../services/maintenanceService';
import { generateReport } from '../services/geminiService';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    machines: { active: 32, total: 40 }, // Using mockup-like data if real is missing
    finance: { totalIncome: 1250000, totalExpense: 850000, balance: 400000 },
    alerts: [] as any[],
    chartData: [
      { name: 'JAN', lucro: 4000, custo: 2400 },
      { name: 'FEV', lucro: 5500, custo: 3000 },
      { name: 'MAR', lucro: 4800, custo: 2000 },
      { name: 'ABR', lucro: 4200, custo: 4200 },
      { name: 'MAI', lucro: 6000, custo: 2800 },
      { name: 'JUN', lucro: 5200, custo: 3200 },
    ]
  });
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [mStats, tStats, recentMaintenance] = await Promise.all([
        machineService.getStats(),
        transactionService.getStats(),
        maintenanceService.getThisMonth(),
      ]);

      setStats(prev => ({
        ...prev,
        machines: { active: mStats.active, total: mStats.total },
        finance: tStats,
        alerts: recentMaintenance.slice(0, 3),
      }));

      generateAIInsight({
        machines: mStats,
        finance: tStats,
        recentMaintenance
      });

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAIInsight = async (data: any) => {
    setLoadingAi(true);
    try {
      const insight = await generateReport(data, 'general');
      setAiInsight(insight);
    } catch (error) {
      console.error('Erro ao gerar insight da IA:', error);
    } finally {
      setLoadingAi(false);
    }
  };

  if (loading) {
    return (
      <Layout title="TerraGes" subTitle="Premium Dashboard">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="TerraGes"
      subTitle="Premium Dashboard"
      hideNav={false}
      actions={
        <div className="relative mr-2">
          <Bell size={20} className="text-gray-400 cursor-pointer hover:text-white transition-colors" />
          <div className="absolute -top-1 -right-1 size-3 bg-primary border-2 border-brand-dark rounded-full"></div>
        </div>
      }
    >
      <div className="px-4 pb-10 pt-4 space-y-8">

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Faturamento */}
          <div className="bg-[#141414] p-4 rounded-2xl border border-white/5 relative overflow-hidden">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Faturamento Mês</p>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-black text-positive">R$</span>
              <span className="text-2xl font-black text-positive">1.25M</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight size={12} className="text-positive" />
              <span className="text-[10px] text-positive font-bold">+14.2%</span>
            </div>
            <div className="absolute bottom-4 right-4 w-12 h-8 opacity-50">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[{ v: 10 }, { v: 15 }, { v: 12 }, { v: 18 }, { v: 20 }]}>
                  <Line type="monotone" dataKey="v" stroke="#39FF14" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Frota Ativa */}
          <div className="bg-[#141414] p-4 rounded-2xl border border-white/5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Frota Ativa</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">{stats.machines.active}/{stats.machines.total}</span>
            </div>
            <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${(stats.machines.active / stats.machines.total) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Obras Ativas */}
          <div className="bg-[#141414] p-4 rounded-2xl border border-white/5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Obras Ativas</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-white">08</span>
              <Home size={20} className="text-primary opacity-50" />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">2 finalizando esta semana</p>
          </div>

          {/* Consumo Diesel */}
          <div className="bg-[#141414] p-4 rounded-2xl border border-white/5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Consumo Diesel</p>
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">1.2k</span>
                <span className="text-sm font-bold text-gray-400 text-white">L</span>
              </div>
              <Fuel size={20} className="text-primary opacity-50" />
            </div>
            <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-positive w-3/4"></div>
            </div>
          </div>
        </div>

        {/* Main Chart - Lucro vs Custo */}
        <div className="bg-[#141414] p-6 rounded-3xl border border-white/5 shadow-2xl">
          <div className="flex flex-col mb-8">
            <h3 className="text-sm font-black text-white uppercase tracking-tighter mb-4">Lucro vs Custo</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-positive shadow-[0_0_8px_#39FF14]"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lucro</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-primary shadow-[0_0_8px_#9E3D07]"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Custo Operacional</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} barGap={8}>
                <XAxis
                  dataKey="name"
                  stroke="#333"
                  fontSize={10}
                  fontWeight="bold"
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: '#0D0D0D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                />
                <Bar dataKey="lucro" fill="#39FF14" radius={[4, 4, 0, 0]} barSize={12}>
                  {stats.chartData.map((entry, index) => (
                    <Cell key={`cell-lucro-${index}`} fill="#39FF14" className="filter drop-shadow-[0_0_8px_rgba(57,255,20,0.4)]" />
                  ))}
                </Bar>
                <Bar dataKey="custo" fill="#9E3D07" radius={[4, 4, 0, 0]} barSize={12}>
                  {stats.chartData.map((entry, index) => (
                    <Cell key={`cell-custo-${index}`} fill="#9E3D07" className="filter drop-shadow-[0_0_146px_rgba(158,61,7,0.4)]" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cronograma de Obras */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-white uppercase tracking-tighter">Cronograma de Obras</h3>
            <button className="text-[10px] font-black text-primary uppercase tracking-tighter flex items-center gap-1">
              Ver Tudo <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Project Card 1 */}
            <div className="bg-[#141414] p-5 rounded-2xl border border-white/5 flex items-center gap-5">
              <div className="relative size-16 shrink-0">
                <svg className="size-full -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="#39FF14" strokeWidth="6" strokeDasharray="175.9" strokeDashoffset={175.9 * (1 - 0.65)} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black text-white">65%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-white truncate">Condomínio Terra Alta</h4>
                  <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[8px] font-black uppercase">Fase 2</span>
                </div>
                <p className="text-[10px] text-gray-500">Prazo: 12 Ago</p>
              </div>
            </div>

            {/* Project Card 2 */}
            <div className="bg-[#141414] p-5 rounded-2xl border border-white/5 flex items-center gap-5 opacity-60">
              <div className="relative size-16 shrink-0">
                <svg className="size-full -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="#9E3D07" strokeWidth="6" strokeDasharray="175.9" strokeDashoffset={175.9 * (1 - 0.25)} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black text-white">25%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-white truncate">Acesso Rodovia SP-1</h4>
                </div>
                <p className="text-[10px] text-gray-500">Prazo: 05 Set</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alertas de Manutenção */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-white uppercase tracking-tighter px-1">Alertas de Manutenção</h3>
          <div className="relative p-0.5 rounded-2xl bg-gradient-to-r from-primary to-transparent">
            <div className="bg-[#141414] rounded-[14px] p-4 flex items-center gap-4">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate">Escavadeira CAT-320 #04</h4>
                <p className="text-xs text-gray-500">Pressão hidráulica crítica detectada</p>
              </div>
              <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white shrink-0 shadow-lg shadow-primary/30">
                <ChevronRight size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* AI Insight Card (Moved to bottom or kept as is) */}
        <div className="bg-brand-gradient/10 p-5 rounded-3xl border border-white/5 relative overflow-hidden backdrop-blur-3xl">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="text-primary" size={18} />
            <h3 className="font-black text-white text-[10px] uppercase tracking-widest">Análise Estratégica IA</h3>
          </div>
          {loadingAi ? (
            <div className="flex items-center gap-2 text-gray-400 text-[10px] animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              Processando inteligência de obra...
            </div>
          ) : (
            <p className="text-gray-400 text-[11px] leading-relaxed font-medium">
              {aiInsight || "Sua frota está operando com 85% de eficiência. Recomendamos antecipar a troca de óleo da Escavadeira #04 para evitar paradas não planejadas."}
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
};