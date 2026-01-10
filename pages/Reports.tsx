
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { FileText, Calendar, Download, Sparkles, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { transactionService } from '../services/transactionService';
import { machineService } from '../services/machineService';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState('financeiro');
  const [period, setPeriod] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [financeData, setFinanceData] = useState<any[]>([]);
  const [machineStats, setMachineStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fData, mStats] = await Promise.all([
        transactionService.getMonthlyData(),
        machineService.getStats()
      ]);
      setFinanceData(fData);
      setMachineStats(mStats);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Layout title="Relatórios" hideNav={false}><div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={40} /></div></Layout>;

  return (
    <Layout title="Relatórios e Análises" hideNav={false}>
      <div className="p-4 space-y-6 pb-24">
        <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4 shadow-lg">
          <div className="grid grid-cols-2 gap-4">
             <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Faturamento Mensal</p>
                <p className="text-xl font-bold text-white">R$ {financeData.reduce((acc, d) => acc + d.Faturamento, 0).toLocaleString()}</p>
             </div>
             <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Máquinas Ativas</p>
                <p className="text-xl font-bold text-white">{machineStats?.total || 0}</p>
             </div>
          </div>
        </div>

        <div className="bg-surface-dark p-4 rounded-xl border border-white/5 h-80">
          <h3 className="text-sm font-bold text-gray-300 mb-6 uppercase tracking-wider">Desempenho Financeiro (Mensal)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={financeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip contentStyle={{ background: '#1c1c1e', border: 'none' }} />
              <Legend />
              <Bar dataKey="Faturamento" fill="#ff6a00" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Custos" fill="#ffffff" opacity={0.3} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gradient-to-br from-primary/20 to-surface-dark p-6 rounded-2xl border border-primary/30 relative">
          <Sparkles className="absolute top-4 right-4 text-primary opacity-50" size={24} />
          <h3 className="font-bold text-white mb-2">Insight da IA</h3>
          <p className="text-sm text-gray-300">
            {financeData.length > 0 && financeData[financeData.length-1].Faturamento > financeData[financeData.length-1].Custos 
              ? "Seu faturamento está superando os custos este mês. Ótimo desempenho clínico!" 
              : "Atenção aos custos operacionais elevados. Recomendamos revisar despesas variáveis."}
          </p>
        </div>
      </div>
    </Layout>
  );
};
