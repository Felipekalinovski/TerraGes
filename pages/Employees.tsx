import React from 'react';
import { Layout } from '../components/Layout';
import { Search, Plus, Filter, Phone, Briefcase, ChevronRight, UserCheck, UserX, UserMinus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const employees = [
  { id: '1', name: 'Carlos Silva', role: 'Operador de Máquinas', status: 'active', contact: '(11) 99999-1111', image: 'https://i.pravatar.cc/150?u=1' },
  { id: '2', name: 'Ana Pereira', role: 'Engenheira Civil', status: 'active', contact: '(11) 98888-2222', image: 'https://i.pravatar.cc/150?u=5' },
  { id: '3', name: 'João Costa', role: 'Mecânico Chefe', status: 'vacation', contact: '(11) 97777-3333', image: 'https://i.pravatar.cc/150?u=3' },
];

export const Employees: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Layout title="Gestão de Equipe" hideNav={false}>
      <div className="px-4 py-4 grid grid-cols-3 gap-3">
        <div className="bg-surface-dark p-3 rounded-xl border border-white/5 flex flex-col items-center">
          <UserCheck size={20} className="text-positive mb-1" />
          <p className="text-2xl font-bold text-white">24</p>
        </div>
        <div className="bg-surface-dark p-3 rounded-xl border border-white/5 flex flex-col items-center">
          <UserMinus size={20} className="text-warning mb-1" />
          <p className="text-2xl font-bold text-white">2</p>
        </div>
        <div className="bg-surface-dark p-3 rounded-xl border border-white/5 flex flex-col items-center">
          <UserX size={20} className="text-red-400 mb-1" />
          <p className="text-2xl font-bold text-white">1</p>
        </div>
      </div>
      <div className="px-4 mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input type="text" placeholder="Buscar colaborador..." className="w-full bg-surface-dark border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white" />
        </div>
        <button onClick={() => navigate('/employees/new')} className="bg-primary w-10 h-10 rounded-lg flex items-center justify-center text-white"><Plus size={20} /></button>
      </div>
      <div className="px-4 pb-6 space-y-3">
        {employees.map((emp) => (
          <div key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)} className="bg-surface-dark p-4 rounded-xl border border-white/5 flex items-center gap-4 cursor-pointer">
            <div className="size-12 rounded-full bg-cover bg-center" style={{ backgroundImage: `url('${emp.image}')` }}></div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white truncate">{emp.name}</h3>
              <p className="text-xs text-text-gold">{emp.role}</p>
            </div>
            <ChevronRight size={18} className="text-gray-600" />
          </div>
        ))}
      </div>
    </Layout>
  );
};
