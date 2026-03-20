
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Search, Plus, Filter, Phone, Briefcase, ChevronRight, UserCheck, UserX, UserMinus, Loader2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { employeeService, Employee } from '../services/employeeService';

export const Employees: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await employeeService.getAll();
      setEmployees(data);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // KPIs
  const activeCount = employees.filter(e => e.status === 'active').length;
  const vacationCount = employees.filter(e => e.status === 'vacation').length;
  const leaveCount = employees.filter(e => e.status === 'leave' || e.status === 'inactive').length;

  return (
    <Layout>
      <Layout.Header 
        title="Gestão de Equipe" 
        subTitle="Recursos Humanos & Operação"
        actions={
          <button
            onClick={() => navigate('/employees/new')}
            className="bg-primary text-black p-2 rounded-xl shadow-neon-sm hover:brightness-110 active:scale-95 transition-all"
            title="Novo Colaborador"
          >
            <Plus size={20} strokeWidth={3} />
          </button>
        }
      />

      <Layout.Content>
        {/* Search & Filter Bar */}
        <div className="px-4 py-4 flex gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-dark/40 backdrop-blur-md border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-gray-600 italic font-medium"
            />
          </div>
          <button className="bg-surface-dark/40 backdrop-blur-md border border-white/5 w-14 rounded-2xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
            <Filter size={20} />
          </button>
        </div>

        {/* KPI Cards */}
        <div className="px-4 grid grid-cols-3 gap-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="bg-surface-dark/50 backdrop-blur-xl p-4 rounded-[24px] border border-white/5 shadow-glass flex flex-col items-center group overflow-hidden relative">
            <div className="absolute -right-2 -top-2 size-12 bg-positive/5 rounded-full blur-xl group-hover:bg-positive/10 transition-all"></div>
            <UserCheck size={18} className="text-positive mb-2 drop-shadow-neon-sm" />
            <p className="text-xl font-black text-white">{activeCount}</p>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Ativos</p>
          </div>
          
          <div className="bg-surface-dark/50 backdrop-blur-xl p-4 rounded-[24px] border border-white/5 shadow-glass flex flex-col items-center group overflow-hidden relative">
            <div className="absolute -right-2 -top-2 size-12 bg-warning/5 rounded-full blur-xl group-hover:bg-warning/10 transition-all"></div>
            <UserMinus size={18} className="text-warning mb-2 drop-shadow-neon-sm" />
            <p className="text-xl font-black text-white">{vacationCount}</p>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Férias</p>
          </div>

          <div className="bg-surface-dark/50 backdrop-blur-xl p-4 rounded-[24px] border border-white/5 shadow-glass flex flex-col items-center group overflow-hidden relative">
            <div className="absolute -right-2 -top-2 size-12 bg-negative/5 rounded-full blur-xl group-hover:bg-negative/10 transition-all"></div>
            <UserX size={18} className="text-negative mb-2 drop-shadow-neon-sm" />
            <p className="text-xl font-black text-white">{leaveCount}</p>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Off</p>
          </div>
        </div>

        {/* Employee List */}
        <div className="px-4 pb-32 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="px-1 flex items-end justify-between mb-4">
             <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading">Quadro de Colaboradores</h3>
             <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">{filteredEmployees.length} registros</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-primary" size={40} />
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sincronizando equipe...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-20 bg-surface-dark/10 rounded-[48px] border border-dashed border-white/5">
              <p className="text-gray-500 text-xs font-black uppercase tracking-widest italic">Nenhum registro.</p>
            </div>
          ) : (
            filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                onClick={() => navigate(`/employees/${emp.id}`)}
                className="bg-surface-dark/40 backdrop-blur-md p-5 rounded-[32px] border border-white/5 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-5 shadow-glass group hover:border-primary/20"
              >
                {/* Avatar with Glow */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div 
                    className="size-16 rounded-[24px] bg-surface-dark border border-white/10 relative z-10 shadow-glass-sm flex items-center justify-center overflow-hidden"
                  >
                    {emp.image_url ? (
                      <img src={emp.image_url} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} className="text-gray-600" />
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-surface-dark z-20 flex items-center justify-center ${
                    emp.status === 'active' ? 'bg-positive shadow-neon-sm' : 
                    emp.status === 'vacation' ? 'bg-warning shadow-neon-sm' : 'bg-negative'
                  }`}>
                    {emp.status === 'active' ? <UserCheck size={10} className="text-black" strokeWidth={3} /> : 
                     emp.status === 'vacation' ? <UserMinus size={10} className="text-black" strokeWidth={3} /> : 
                     <UserX size={10} className="text-black" strokeWidth={3} />}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col mb-1.5">
                    <h3 className="font-heading font-black text-lg text-white uppercase italic tracking-tighter truncate group-hover:text-primary transition-colors leading-tight">
                      {emp.name}
                    </h3>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] font-black text-primary/80 uppercase tracking-tighter italic">
                      <Briefcase size={12} strokeWidth={3} />
                      <span className="truncate">{emp.role}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <Phone size={12} strokeWidth={2.5} className="text-gray-600" />
                      <span>{emp.contact}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white/5 group-hover:bg-primary/10 transition-colors">
                  <ChevronRight size={20} className="text-gray-600 group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </Layout.Content>
    </Layout>
  );
};