
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { FileText, Calendar, Download, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const financialData = [
  { name: 'Sem 1', Faturamento: 45000, Custos: 32000 },
  { name: 'Sem 2', Faturamento: 52000, Custos: 28000 },
  { name: 'Sem 3', Faturamento: 48000, Custos: 42000 },
  { name: 'Sem 4', Faturamento: 61000, Custos: 35000 },
];

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState('financeiro');
  const [period, setPeriod] = useState('30days');

  return (
    <Layout title="Relatórios e Análises" hideNav={false}>
      <div className="p-4 space-y-6 pb-24">
        <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Tipo de Relatório</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full h-12 px-4 rounded-xl bg-[#4b3220] text-white">
                <option value="financeiro">Financeiro</option>
                <option value="frota">Performance da Frota</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Período</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full h-12 px-4 rounded-xl bg-[#4b3220] text-white">
                <option value="7days">Últimos 7 dias</option>
                <option value="30days">Últimos 30 dias</option>
              </select>
            </div>
          </div>
          <button className="w-full h-12 bg-primary text-black font-bold rounded-xl">Gerar Relatório</button>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-dark p-4 rounded-xl border border-white/5 shadow-md">
            <h3 className="text-sm font-bold text-gray-300 mb-6">Faturamento vs. Custos</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} tickFormatter={(value) => `R$${value/1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#2C2C2E', border: 'none' }} />
                  <Legend />
                  <Bar dataKey="Faturamento" fill="#ff6a00" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="Custos" fill="#ffffff" radius={[4, 4, 0, 0]} barSize={20} opacity={0.3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface-dark p-5 rounded-xl border border-positive/30 relative">
            <div className="flex items-center gap-2 mb-3"><Sparkles size={18} className="text-positive" /><h3 className="font-bold text-white">Insights IA</h3></div>
            <p className="text-sm text-gray-300">O faturamento aumentou 15%. Considere otimizar rotas.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};
