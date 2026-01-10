import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { TrendingUp, AlertTriangle, Droplet, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { machineService } from '../services/machineService';
import { transactionService } from '../services/transactionService';
import { maintenanceService } from '../services/maintenanceService';
import { generateReport } from '../services/geminiService';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    machines: { active: 0, total: 0 },
    finance: { totalIncome: 0, totalExpense: 0, balance: 0 },
    alerts: [] as any[],
    chartData: [] as any[]
  });
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [mStats, tStats, recentMaintenance, monthTransactions] = await Promise.all([
        machineService.getStats(),
        transactionService.getStats(),
        maintenanceService.getThisMonth(),
        transactionService.getThisMonth()
      ]);

      const chartData = [
        { name: 'Entradas', valor: tStats.totalIncome },
        { name: 'Saídas', valor: tStats.totalExpense },
      ];

      setStats({
        machines: { active: mStats.active, total: mStats.total },
        finance: tStats,
        alerts: recentMaintenance.slice(0, 3),
        chartData
      });

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
      <Layout title="TerraGes">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="TerraGes"
      hideNav={false}
      actions={
        <div
          className="h-9 w-9 rounded-full bg-cover bg-center border border-white/10 cursor-pointer"
          style={{ backgroundImage: "url('https://picsum.photos/100')" }}
        ></div>
      }
    >
      <div className="px-4 pb-6 pt-4 space-y-6">
        <div className="bg-gradient-to-br from-primary/20 to-surface-dark p-5 rounded-2xl border border-primary/20 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles size={80} className="text-primary" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-primary/20 rounded-lg text-primary">
              <Sparkles size={18} />
            </div>
            <h3 className="font-bold text-white text-sm">Insight da IA TerraGes</h3>
          </div>
          {loadingAi ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm animate-pulse">
              <Loader2 size={14} className="animate-spin" />
              Analisando dados da sua obra...
            </div>
          ) : (
            <p className="text-gray-300 text-xs leading-relaxed">
              {aiInsight || "Nenhum insight disponível no momento."}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-dark p-4 rounded-2xl border border-white/5 shadow-lg shadow-black/20">
            <p className="text-xs font-medium text-gray-400 mb-1">Saldo Total</p>
            <p className="text-xl font-bold text-white">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.finance.balance)}
            </p>
          </div>
          <div className="bg-surface-dark p-4 rounded-2xl border border-white/5 shadow-lg shadow-black/20">
            <p className="text-xs font-medium text-gray-400 mb-1">Frota Ativa</p>
            <p className="text-xl font-bold text-white">
              {stats.machines.active} <span className="text-gray-500 text-sm">/ {stats.machines.total}</span>
            </p>
          </div>
          <div className="bg-surface-dark p-4 rounded-2xl border border-white/5 shadow-lg shadow-black/20">
            <p className="text-xs font-medium text-gray-400 mb-1">Receitas</p>
            <p className="text-xl font-bold text-positive">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.finance.totalIncome)}
            </p>
          </div>
          <div className="bg-surface-dark p-4 rounded-2xl border border-white/5 shadow-lg shadow-black/20">
            <p className="text-xs font-medium text-gray-400 mb-1">Despesas</p>
            <p className="text-xl font-bold text-negative">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.finance.totalExpense)}
            </p>
          </div>
        </div>

        <div className="bg-surface-dark p-4 rounded-2xl border border-white/5 shadow-lg shadow-black/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white">Fluxo de Caixa</h3>
            <div className="flex items-center gap-1 text-positive text-sm font-medium">
              <TrendingUp size={16} />
              Geral
            </div>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#2C2C2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="valor" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-3 px-1">Manutenções Recentes</h3>
          <div className="space-y-3">
            {stats.alerts.length > 0 ? stats.alerts.map((alert, index) => (
              <div key={index} className="flex items-center gap-4 bg-surface-dark p-3 rounded-xl border border-white/5 shadow-sm">
                <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${alert.type === 'corrective' ? 'bg-negative/20 text-negative' : 'bg-primary/20 text-primary'
                  }`}>
                  {alert.type === 'corrective' ? <AlertTriangle size={20} /> : <Calendar size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-white">{alert.description}</p>
                  <p className="text-xs text-gray-400">{new Date(alert.date).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(alert.cost)}
                </span>
              </div>
            )) : (
              <p className="text-center text-gray-500 text-sm py-4">Nenhuma manutenção registrada este mês.</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
