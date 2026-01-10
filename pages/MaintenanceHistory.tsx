import React from 'react';
import { Layout } from '../components/Layout';
import { Wrench, Plus, AlertCircle, TrendingUp, Calendar, ChevronDown, Filter } from 'lucide-react';
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
      <div className="px-4 py-3">
        <button onClick={() => navigate('/maintenance/new')} className="w-full bg-primary text-white h-12 rounded-xl font-bold flex items-center justify-center gap-2">
          <Plus size={20} /> Adicionar Manutenção
        </button>
      </div>
      <div className="px-4 py-4">
        <div className="bg-surface-dark p-4 rounded-2xl border border-white/5 shadow-md">
          <p className="text-sm font-medium text-white mb-1">Custo de Manutenção</p>
          <p className="text-3xl font-bold text-white">R$ 8.450,00</p>
          <div className="h-32 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="name" stroke="#cea88d" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#2C2C2E', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                <Area type="monotone" dataKey="custo" stroke="#ff6a00" fill="#ff6a00" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="px-4 pb-24 space-y-4">
        {history.map((item) => (
          <div key={item.id} className="bg-surface-dark p-4 rounded-xl border border-white/5 flex flex-col gap-3">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-[#4b3220] flex items-center justify-center shrink-0">
                {item.type === 'Preventiva' ? <Wrench className="text-white" size={24} /> : <AlertCircle className="text-white" size={24} />}
              </div>
              <div className="flex-1">
                <h4 className="text-white font-medium text-base">{item.title}</h4>
                <p className="text-xs text-gray-400">{item.date} • {item.type}</p>
                <p className="text-xs text-text-gold mt-1">Técnico: {item.technician}</p>
              </div>
            </div>
            <p className="text-lg font-bold text-white">R$ {item.cost.toLocaleString('pt-BR')}</p>
          </div>
        ))}
      </div>
    </Layout>
  );
};
