import React from 'react';
import { Layout } from '../components/Layout';
import { Wrench, Plus, AlertCircle, CheckCircle, TrendingUp, Calendar, DollarSign, Filter, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const chartData = [
  { name: 'Jan', custo: 800 },
  { name: 'Fev', custo: 2400 },
  { name: 'Mar', custo: 1398 },
  { name: 'Abr', custo: 2000 },
  { name: 'Mai', custo: 3908 },
  { name: 'Jun', custo: 1500 },
];

const history = [
  { id: 1, title: 'Troca de óleo e filtros', date: '15/06/2024', cost: 850, type: 'Preventiva', technician: 'Carlos Silva' },
  { id: 2, title: 'Reparo no sistema hidráulico', date: '02/05/2024', cost: 2300, type: 'Corretiva', technician: 'Ana Pereira' },
  { id: 3, title: 'Troca de Pneus', date: '20/04/2024', cost: 1500, type: 'Preventiva', technician: 'Carlos Silva' },
];

export const MaintenanceHistory: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <Layout.Header 
        title="Histórico de Manutenção" 
        subTitle="Análise de custos e intervenções: TR-540"
        showBack
        actions={
          <button
            onClick={() => navigate('/maintenance/new')}
            className="bg-primary text-black p-2.5 rounded-xl flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-md"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Nova Manutenção</span>
          </button>
        }
      />

      <Layout.Content>
        <div className="px-4 space-y-6 pb-32">
          {/* Filters - Modern Selects */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 animate-in fade-in slide-in-from-top-4 duration-500">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-surface-dark/40 backdrop-blur-md rounded-2xl text-[10px] font-black uppercase tracking-widest text-white border border-white/5 whitespace-nowrap shadow-glass hover:border-primary/20 transition-all">
              Últimos 6 meses <ChevronDown size={14} className="text-primary" />
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-surface-dark/40 backdrop-blur-md rounded-2xl text-[10px] font-black uppercase tracking-widest text-white border border-white/5 whitespace-nowrap shadow-glass hover:border-primary/20 transition-all">
              Tipo: Todas <ChevronDown size={14} className="text-primary" />
            </button>
          </div>

          {/* Stats & Chart - Glassmorphism */}
          <div className="animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="bg-surface-dark/40 backdrop-blur-xl p-8 rounded-[40px] border border-white/5 shadow-glass relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp size={120} strokeWidth={1} />
              </div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Acumulado do Período</p>
                  <div className="flex items-baseline gap-3">
                    <p className="text-4xl font-black text-white italic font-heading tracking-tight">R$ 8.450,00</p>
                    <span className="text-[10px] text-positive font-black flex items-center gap-1 bg-positive/10 px-2 py-0.5 rounded-full border border-positive/20">
                      <TrendingUp size={12} /> +15.2%
                    </span>
                  </div>
                </div>
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">Jan - Jun 2024</p>
              </div>

              <div className="h-44 w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="name" 
                      stroke="#4B5563" 
                      fontSize={10} 
                      fontWeight="bold"
                      tickLine={false} 
                      axisLine={false} 
                      dy={10}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(5, 5, 5, 0.8)', 
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(0, 229, 153, 0.2)', 
                        borderRadius: '20px',
                        padding: '12px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                      }}
                      itemStyle={{ color: '#00E599', fontWeight: '900', fontSize: '12px' }}
                      labelStyle={{ color: '#9CA3AF', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="custo" 
                      stroke="#10B981" 
                      strokeWidth={4} 
                      fillOpacity={1} 
                      fill="url(#colorCusto)" 
                      animationDuration={2000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* History List */}
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1 flex items-center gap-2">
              <Calendar size={14} className="text-primary" />
              Detalhamento de Intervenções
            </h3>
            
            {history.map((item) => (
              <div key={item.id} className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 flex flex-col gap-5 hover:border-primary/20 transition-all group shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex items-start gap-5">
                  <div className={`size-14 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 shadow-sm transition-transform group-hover:scale-110 ${
                    item.type === 'Corretiva' ? 'bg-negative/10 text-negative' : 'bg-primary/10 text-primary'
                  }`}>
                    {item.type === 'Preventiva' ? 
                      <Wrench size={26} strokeWidth={2.5} /> : 
                      <AlertCircle size={26} strokeWidth={2.5} />
                    }
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-black text-base italic font-heading tracking-tight leading-tight group-hover:text-primary transition-colors">{item.title}</h4>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                        item.type === 'Corretiva' ? 'bg-negative/10 border-negative/30 text-negative' : 'bg-primary/10 border-primary/30 text-primary'
                      }`}>
                        {item.type}
                      </span>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                        <Calendar size={12} /> {item.date}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors border border-white/10">
                      <DollarSign size={16} />
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-gray-600 uppercase tracking-[0.2em] mb-0.5">Custo Total</p>
                      <p className="text-base font-black text-white italic tracking-tighter">R$ {item.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-[7px] font-black text-gray-600 uppercase tracking-[0.2em] mb-0.5">Responsável</p>
                    <p className="text-[10px] font-bold text-gray-300 group-hover:text-white transition-colors uppercase tracking-widest">{item.technician}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};