
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { 
  FileText, 
  Calendar, 
  Download, 
  Share2, 
  Sparkles, 
  TrendingUp, 
  Filter,
  BarChart2,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

const financialData = [
  { name: 'Sem 1', Faturamento: 45000, Custos: 32000 },
  { name: 'Sem 2', Faturamento: 52000, Custos: 28000 },
  { name: 'Sem 3', Faturamento: 48000, Custos: 42000 },
  { name: 'Sem 4', Faturamento: 61000, Custos: 35000 },
];

const fleetPerformance = [
  { vehicle: 'Caminhão X', hours: '120h', fuel: '550L', status: 'Ótimo', statusColor: 'text-positive' },
  { vehicle: 'Escavadeira Y', hours: '98h', fuel: '780L', status: 'Atenção', statusColor: 'text-warning' },
  { vehicle: 'Pá Carregadeira Z', hours: '110h', fuel: '620L', status: 'Manutenção', statusColor: 'text-gray-400' },
];

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState('financeiro');
  const [period, setPeriod] = useState('30days');

  return (
    <Layout title="Relatórios e Análises" hideNav={false}>
      <div className="p-4 space-y-6 pb-24">
        
        {/* Filters Section */}
        <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Tipo de Relatório</label>
              <div className="relative">
                <select 
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full h-12 pl-4 pr-10 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
                >
                  <option value="financeiro">Financeiro</option>
                  <option value="frota">Performance da Frota</option>
                  <option value="obra">Progresso da Obra</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-gold">
                  <FileText size={18} />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Período</label>
              <div className="relative">
                <select 
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full h-12 pl-4 pr-10 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
                >
                  <option value="7days">Últimos 7 dias</option>
                  <option value="30days">Últimos 30 dias</option>
                  <option value="90days">Últimos 3 meses</option>
                  <option value="year">Este ano</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-gold">
                  <Calendar size={18} />
                </div>
              </div>
            </div>
          </div>

          <button className="w-full h-12 bg-primary text-black font-bold rounded-xl hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20">
            Gerar Relatório
          </button>
        </div>

        {/* Report Content */}
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Header & Actions */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">Relatório Financeiro: Últimos 30 dias</h2>
            <div className="flex gap-3">
              <button className="flex-1 h-10 bg-surface-dark border border-white/10 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors">
                <Download size={16} /> Exportar
              </button>
              <button className="flex-1 h-10 bg-surface-dark border border-white/10 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors">
                <Clock size={16} /> Agendar
              </button>
            </div>
          </div>

          {/* Chart Card */}
          <div className="bg-surface-dark p-4 rounded-xl border border-white/5 shadow-md">
            <h3 className="text-sm font-bold text-gray-300 mb-6">Faturamento vs. Custos</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#2C2C2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Faturamento" fill="#ff6a00" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="Custos" fill="#ffffff" radius={[4, 4, 0, 0]} barSize={20} opacity={0.3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Insights Card */}
          <div className="bg-surface-dark p-5 rounded-xl border border-positive/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Sparkles size={80} className="text-positive" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-positive" />
              <h3 className="font-bold text-white">Insights Rápidos da IA</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              O faturamento aumentou <span className="text-positive font-bold">15%</span> em relação ao período anterior, impulsionado pela otimização da rota do caminhão X. Considere aplicar a mesma lógica à frota B para reduzir custos operacionais em até 8%.
            </p>
          </div>

          {/* Table Card */}
          <div className="bg-surface-dark rounded-xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="font-bold text-white">Performance da Frota</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Veículo</th>
                    <th className="px-4 py-3 font-medium">Horas Op.</th>
                    <th className="px-4 py-3 font-medium">Consumo (L)</th>
                    <th className="px-4 py-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {fleetPerformance.map((item, idx) => (
                    <tr key={idx} className="text-gray-200">
                      <td className="px-4 py-3 font-medium">{item.vehicle}</td>
                      <td className="px-4 py-3 text-gray-400">{item.hours}</td>
                      <td className="px-4 py-3 text-gray-400">{item.fuel}</td>
                      <td className={`px-4 py-3 text-right font-bold ${item.statusColor}`}>
                        <span className={`px-2 py-1 rounded-full bg-opacity-10 ${item.status === 'Ótimo' ? 'bg-positive' : item.status === 'Atenção' ? 'bg-warning' : 'bg-gray-500'}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
};
