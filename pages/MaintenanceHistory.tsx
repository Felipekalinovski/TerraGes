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
    <Layout title="Histórico - TR-540" showBack hideNav={false}>
      
      {/* Header Actions */}
      <div className="px-4 py-3">
        <button 
          onClick={() => navigate('/maintenance/new')}
          className="w-full bg-primary text-white h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          <Plus size={20} /> Adicionar Manutenção
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 pb-2 flex gap-3 overflow-x-auto no-scrollbar">
        <button className="flex items-center gap-2 px-4 py-2 bg-[#4b3220] rounded-xl text-xs font-medium text-white border border-white/5 whitespace-nowrap">
          Período: Últimos 6 meses <ChevronDown size={14} />
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#4b3220] rounded-xl text-xs font-medium text-white border border-white/5 whitespace-nowrap">
          Tipo: Todas <ChevronDown size={14} />
        </button>
      </div>

      {/* Stats & Chart */}
      <div className="px-4 py-4">
        <div className="bg-card-brown p-4 rounded-2xl border border-white/5 shadow-md">
          <p className="text-sm font-medium text-white mb-1">Custo de Manutenção</p>
          <div className="flex items-end gap-2 mb-4">
            <p className="text-3xl font-bold text-white">R$ 8.450,00</p>
          </div>
          
          <div className="flex items-center gap-2 mb-4">
             <span className="text-xs text-text-gold">Últimos 6 meses</span>
             <span className="text-xs text-positive font-bold flex items-center gap-1">
                <TrendingUp size={12} /> +15.2%
             </span>
          </div>

          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff6a00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ff6a00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#cea88d" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#2C2C2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="custo" stroke="#ff6a00" strokeWidth={3} fillOpacity={1} fill="url(#colorCusto)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="px-4 pb-24 space-y-4">
        {history.map((item) => (
          <div key={item.id} className="bg-card-brown p-4 rounded-xl border border-white/5 flex flex-col gap-3">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-[#4b3220] flex items-center justify-center shrink-0">
                {item.type === 'Preventiva' ? 
                  <Wrench className="text-white" size={24} /> : 
                  <AlertCircle className="text-white" size={24} />
                }
              </div>
              <div className="flex-1">
                <h4 className="text-white font-medium text-base">{item.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-bold ${item.type === 'Corretiva' ? 'text-negative' : 'text-primary'}`}>
                    {item.type}
                  </span>
                  <span className="text-gray-500 text-[10px]">•</span>
                  <span className="text-xs text-gray-400">{item.date}</span>
                </div>
                <p className="text-xs text-text-gold mt-1">Técnico: {item.technician}</p>
              </div>
            </div>
            
            <div className="border-t border-white/10 pt-3 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-text-gold uppercase font-bold tracking-wide">Custo Total</p>
                <p className="text-lg font-bold text-white">R$ {item.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="flex gap-2">
                <button className="size-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/70">
                  <Filter size={16} /> {/* Placeholder for details icon */}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
};