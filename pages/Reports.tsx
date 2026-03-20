
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
    <Layout>
      <Layout.Header 
        title="Inteligência & Relatórios" 
        subTitle="Análise preditiva e performance operacional"
      />

      <Layout.Content>
        <div className="px-4 space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Advanced Filters Section */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Parametrização de Dados</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Visão Analítica</label>
                <div className="relative">
                  <select 
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full h-14 pl-12 pr-10 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                  >
                    <option value="financeiro" className="bg-surface-dark">Demonstrativo Financeiro</option>
                    <option value="frota" className="bg-surface-dark">Performance de Maquinário</option>
                    <option value="obra" className="bg-surface-dark">Cronograma vs. Realizado</option>
                  </select>
                  <BarChart2 className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                    <Filter size={18} />
                  </div>
                </div>
              </div>
              
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Intervalo Temporal</label>
                <div className="relative">
                  <select 
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full h-14 pl-12 pr-10 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                  >
                    <option value="7days" className="bg-surface-dark">Ciclo Semanal (7 dias)</option>
                    <option value="30days" className="bg-surface-dark">Ciclo Mensal (30 dias)</option>
                    <option value="90days" className="bg-surface-dark">Trimestre Operacional</option>
                    <option value="year" className="bg-surface-dark">Ciclo Anual</option>
                  </select>
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                    <TrendingUp size={18} />
                  </div>
                </div>
              </div>
            </div>

            <button className="w-full h-14 bg-primary text-black font-black uppercase tracking-[0.2em] italic text-xs rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-neon-sm flex items-center justify-center gap-3 mt-2">
              <Sparkles size={20} />
              Processar Inteligência
            </button>
          </div>

          {/* AI Strategy Insights Card */}
          <div className="bg-primary/10 backdrop-blur-xl p-6 rounded-[32px] border border-primary/20 relative overflow-hidden group shadow-neon-sm">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Sparkles size={120} className="text-primary" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-primary/20 text-primary">
                <Sparkles size={22} />
              </div>
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] italic font-heading">Sintese Preditiva da IA</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed font-medium">
              Detectamos um incremento de <span className="text-primary font-black">15%</span> na margem líquida. A performance do <span className="text-white font-bold">Caminhão X</span> está 12% acima da média do setor. Recomendamos realocação preventiva de recursos para a obra Norte.
            </p>
          </div>

          {/* Visualization & Metrics */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] italic">Visualização Gráfica</h2>
              <div className="flex gap-2">
                <button className="size-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-primary transition-colors border border-white/5">
                  <Download size={18} />
                </button>
                <button className="size-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-primary transition-colors border border-white/5">
                  <Share2 size={18} />
                </button>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic px-1">Faturamento vs. Alocação</h3>
                 <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                       <span className="size-2 rounded-full bg-primary shadow-neon-sm"></span>
                       <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">Receita</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="size-2 rounded-full bg-white/20"></span>
                       <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">Custos</span>
                    </div>
                 </div>
              </div>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="rgba(255,255,255,0.2)" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={10}
                      className="font-bold uppercase"
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.2)" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `R$${value/1000}k`} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(5, 5, 5, 0.9)', 
                        border: '1px solid rgba(0, 229, 153, 0.2)', 
                        borderRadius: '20px',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
                      }}
                      itemStyle={{ color: '#00E599', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    />
                    <Bar dataKey="Faturamento" fill="#00E599" radius={[6, 6, 0, 0]} barSize={18}>
                       {financialData.map((entry, index) => (
                         <rect key={`cell-${index}`} fillOpacity={0.8 + (index * 0.05)} />
                       ))}
                    </Bar>
                    <Bar dataKey="Custos" fill="rgba(255,255,255,0.1)" radius={[6, 6, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance Fleet Table */}
            <div className="bg-surface-dark/40 backdrop-blur-md rounded-[32px] border border-white/5 overflow-hidden shadow-glass">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading">Rank de Eficiência</h3>
                <TrendingUp size={16} className="text-primary" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white/[0.02] text-gray-500">
                    <tr>
                      <th className="px-6 py-4 font-black uppercase tracking-widest text-[9px]">Equipamento</th>
                      <th className="px-6 py-4 font-black uppercase tracking-widest text-[9px]">Uso</th>
                      <th className="px-6 py-4 font-black uppercase tracking-widest text-[9px] text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {fleetPerformance.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-5">
                           <div className="flex flex-col">
                              <span className="font-bold text-white group-hover:text-primary transition-colors">{item.vehicle}</span>
                              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">Frota Ativa</span>
                           </div>
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex items-center gap-2">
                             <Clock size={12} className="text-gray-600" />
                             <span className="font-medium text-gray-400">{item.hours}</span>
                           </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            item.status === 'Ótimo' ? 'bg-primary/10 text-primary border-primary/20' : 
                            item.status === 'Atenção' ? 'bg-warning/10 text-warning border-warning/20' : 
                            'bg-gray-500/10 text-gray-400 border-white/10'
                          }`}>
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
      </Layout.Content>
    </Layout>
  );
};
