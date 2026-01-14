import React from 'react';
import { Layout } from '../components/Layout';
import { Search, Plus, Filter, Phone, Briefcase, ChevronRight, UserCheck, UserX, UserMinus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const employees = [
  { id: '1', name: 'Carlos Silva', role: 'Operador de Máquinas', status: 'active', contact: '(11) 99999-1111', image: 'https://i.pravatar.cc/150?u=1' },
  { id: '2', name: 'Ana Pereira', role: 'Engenheira Civil', status: 'active', contact: '(11) 98888-2222', image: 'https://i.pravatar.cc/150?u=5' },
  { id: '3', name: 'João Costa', role: 'Mecânico Chefe', status: 'vacation', contact: '(11) 97777-3333', image: 'https://i.pravatar.cc/150?u=3' },
  { id: '4', name: 'Mariana Souza', role: 'Assistente Adm.', status: 'active', contact: '(11) 96666-4444', image: 'https://i.pravatar.cc/150?u=9' },
  { id: '5', name: 'Roberto Lima', role: 'Motorista', status: 'leave', contact: '(11) 95555-5555', image: 'https://i.pravatar.cc/150?u=8' },
];

export const Employees: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout title="Gestão de Equipe" hideNav={false}>
      
      {/* KPI Cards */}
      <div className="px-4 py-4 grid grid-cols-3 gap-3">
        <div className="bg-surface-dark p-3 rounded-xl border border-white/5 flex flex-col items-center">
          <UserCheck size={20} className="text-positive mb-1" />
          <p className="text-2xl font-bold text-white">24</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Ativos</p>
        </div>
        <div className="bg-surface-dark p-3 rounded-xl border border-white/5 flex flex-col items-center">
          <UserMinus size={20} className="text-warning mb-1" />
          <p className="text-2xl font-bold text-white">2</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Férias</p>
        </div>
        <div className="bg-surface-dark p-3 rounded-xl border border-white/5 flex flex-col items-center">
          <UserX size={20} className="text-red-400 mb-1" />
          <p className="text-2xl font-bold text-white">1</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Afastado</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-4 mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar colaborador..." 
            className="w-full bg-surface-dark border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button className="bg-surface-dark border border-white/5 w-10 h-10 rounded-lg flex items-center justify-center text-gray-300">
          <Filter size={20} />
        </button>
        <button 
          onClick={() => navigate('/employees/new')}
          className="bg-primary w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Employee List */}
      <div className="px-4 pb-6 space-y-3">
        {employees.map((emp) => (
          <div 
            key={emp.id}
            onClick={() => navigate(`/employees/${emp.id}`)}
            className="bg-surface-dark p-4 rounded-xl border border-white/5 active:scale-[0.98] transition-transform cursor-pointer flex items-center gap-4"
          >
            {/* Avatar */}
            <div className="size-12 rounded-full bg-gray-700 bg-cover bg-center border border-white/10 shrink-0" 
                 style={{ backgroundImage: `url('${emp.image}')` }}>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-white truncate pr-2">{emp.name}</h3>
                {emp.status === 'active' && <span className="bg-positive/20 text-positive text-[10px] px-2 py-0.5 rounded-full font-bold">Ativo</span>}
                {emp.status === 'vacation' && <span className="bg-warning/20 text-warning text-[10px] px-2 py-0.5 rounded-full font-bold">Férias</span>}
                {emp.status === 'leave' && <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Afastado</span>}
              </div>
              
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-1.5 text-xs text-text-gold">
                  <Briefcase size={12} />
                  <span className="truncate">{emp.role}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Phone size={12} />
                  <span>{emp.contact}</span>
                </div>
              </div>
            </div>

            <ChevronRight size={18} className="text-gray-600" />
          </div>
        ))}
      </div>
    </Layout>
  );
};