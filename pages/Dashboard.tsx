import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { generateReport } from '../services/aiService';

// Custom Hook for Dashboard Data
const useDashboardData = () => {
  const [loading, setLoading] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [stats, setStats] = useState({
    machines: { active: 32, total: 40 },
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

  const fetchData = async () => {
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

      generateAIInsight({ machines: mStats, finance: tStats, recentMaintenance });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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
      console.error('Erro ao gerar insight:', error);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { loading, stats, aiInsight, loadingAi, refetch: fetchData };
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { loading, stats, aiInsight, loadingAi } = useDashboardData();

  if (loading) {
    return (
      <Layout>
        <Layout.Header title="TerraGes" subTitle="Dashboard Principal" />
        <Layout.Content>
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="animate-spin text-primary" size={40} />
          </div>
        </Layout.Content>
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Header 
        title="TerraGes" 
        subTitle="Status em Tempo Real"
        actions={
          <div className="relative mr-2">
            <Bell size={20} className="text-gray-400 cursor-pointer hover:text-white transition-colors" />
            <div className="absolute -top-1 -right-1 size-2.5 bg-primary shadow-neon rounded-full border border-brand-dark" />
          </div>
        }
      />
      
      <Layout.Content>
        <div className="px-4 pb-12 pt-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Dashboard Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Card Faturamento */}
            <div onClick={() => navigate('/finance')} className="bg-surface-dark/50 backdrop-blur-md p-5 rounded-2xl border border-white/5 relative overflow-hidden cursor-pointer hover:border-primary/20 transition-all group shadow-glass">
              <div className="absolute top-0 right-0 w-16 h-16 bg-positive/5 blur-2xl rounded-full" />
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Faturamento /mês</p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-positive">R$</span>
                <span className="text-2xl font-black text-white">1.25M</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <ArrowUpRight size={12} className="text-positive" />
                <span className="text-[10px] text-positive font-black">+14.2%</span>
              </div>
            </div>

            {/* Card Frota */}
            <div onClick={() => navigate('/fleet')} className="bg-surface-dark/50 backdrop-blur-md p-5 rounded-2xl border border-white/5 cursor-pointer hover:border-primary/20 transition-all shadow-glass">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Frota Ativa</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">{stats.machines.active}</span>
                <span className="text-xs font-bold text-gray-500">/ {stats.machines.total}</span>
              </div>
              <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary shadow-neon" 
                  style={{ width: `${(stats.machines.active / stats.machines.total) * 100}%` }} 
                />
              </div>
            </div>

            {/* Obras */}
            <div onClick={() => navigate('/rdo')} className="bg-surface-dark/50 backdrop-blur-md p-5 rounded-2xl border border-white/5 cursor-pointer hover:border-primary/20 transition-all shadow-glass">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Obras em Andamento</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-white">08</span>
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Home size={18} />
                </div>
              </div>
              <p className="text-[10px] text-primary/70 font-bold mt-2">2 entregas esta semana</p>
            </div>

            {/* Diesel */}
            <div onClick={() => navigate('/fleet')} className="bg-surface-dark/50 backdrop-blur-md p-5 rounded-2xl border border-white/5 cursor-pointer hover:border-primary/20 transition-all shadow-glass">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Consumo Diesel</p>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">12.5</span>
                  <span className="text-xs font-bold text-gray-500 uppercase">kL</span>
                </div>
                <Fuel size={20} className="text-gray-600" />
              </div>
              <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-positive w-3/4 shadow-neonShadow" />
              </div>
            </div>
          </div>

          {/* AI Intelligence Card */}
          <div className="bg-brand-gradient/20 p-6 rounded-[32px] border border-primary/20 relative overflow-hidden backdrop-blur-3xl shadow-neon">
            <div className="absolute top-0 right-0 p-4">
              <Sparkles className="text-primary animate-pulse" size={24} />
            </div>
            <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-3">Inteligência Estratégica AI</h3>
            {loadingAi ? (
              <div className="flex items-center gap-3 text-gray-400 text-xs italic">
                <Loader2 size={16} className="animate-spin text-primary" />
                Sincronizando dados dos canteiros...
              </div>
            ) : (
              <p className="text-white/80 text-sm font-medium leading-relaxed">
                {aiInsight || "Eficiência operacional em 92%. A Escavadeira #04 apresenta desgaste prematuro nas juntas hidráulicas. Recomendo realocar custos do Fundo de Reserva para manutenção preventiva imediata."}
              </p>
            )}
          </div>

          {/* Chart Section */}
          <div className="bg-surface-dark/40 p-6 rounded-[32px] border border-white/5 shadow-glass">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-heading font-black text-white uppercase italic">Financeiro</h3>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Lucro vs Custo (Últimos 6 meses)</p>
              </div>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} barGap={6}>
                  <XAxis dataKey="name" stroke="#333" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }} 
                    contentStyle={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
                  />
                  <Bar dataKey="lucro" radius={[6, 6, 0, 0]} barSize={10}>
                    {stats.chartData.map((_, i) => <Cell key={i} fill="#00E599" className="drop-shadow-neon" />)}
                  </Bar>
                  <Bar dataKey="custo" radius={[6, 6, 0, 0]} barSize={10}>
                    {stats.chartData.map((_, i) => <Cell key={i} fill="#333" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Maintenance / Alerts */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Alertas Críticos</h3>
              <ArrowUpRight size={16} className="text-primary" />
            </div>
            
            <div className="space-y-3">
              <div className="group bg-surface-dark/60 p-4 rounded-2xl border-l-4 border-l-negative border-r border-t border-b border-white/5 flex items-center gap-4 transition-all hover:bg-surface-dark">
                <div className="size-12 rounded-xl bg-negative/10 flex items-center justify-center text-negative">
                  <AlertTriangle size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">Escavadeira CAT-320 #04</h4>
                  <p className="text-[10px] text-gray-500 font-medium italic">Falha crítica no sistema hidráulico</p>
                </div>
                <ChevronRight size={18} className="text-gray-700 group-hover:text-primary transition-colors" />
              </div>
            </div>
          </section>

        </div>
      </Layout.Content>
    </Layout>
  );
};