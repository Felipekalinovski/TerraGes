
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Search, Filter, Plus, Clock, Wrench, Calendar, ChevronRight, PenTool, History, AlertTriangle, Edit2, Loader2 } from 'lucide-react';
import { useNavigate, Routes, Route, useParams } from 'react-router-dom';
import { FleetForm } from './FleetForm';
import { machineService, type Machine as SupabaseMachine } from '../services/machineService';

const FleetList: React.FC = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<SupabaseMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ active: 0, maintenance: 0, inactive: 0, total: 0 });

  useEffect(() => {
    loadMachines();
    loadStats();
  }, []);

  const loadMachines = async () => {
    try {
      setLoading(true);
      const data = await machineService.getAll();
      setMachines(data);
    } catch (error) {
      console.error('Error loading machines:', error);
      alert('Erro ao carregar máquinas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await machineService.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filteredMachines = machines.filter(machine =>
    machine.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getNextMaintenanceText = (machine: SupabaseMachine) => {
    if (!machine.next_maintenance) return 'Não agendada';

    const nextDate = new Date(machine.next_maintenance);
    const today = new Date();
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Atrasada';
    if (diffDays === 0) return 'Hoje';
    if (diffDays <= 7) return `${diffDays}d`;
    return nextDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <Layout>
      <Layout.Header title="Minha Frota" subTitle="Gestão de Ativos" />
      <Layout.Content>
        {/* Overview Overview */}
        <div className="px-4 py-6 grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-surface-dark/50 backdrop-blur-md p-4 rounded-2xl border border-white/5 text-center shadow-md">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Ativas</p>
            <p className="text-2xl font-black text-positive">{stats.active}</p>
          </div>
          <div className="bg-surface-dark/50 backdrop-blur-md p-4 rounded-2xl border border-white/5 text-center shadow-md">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Manut.</p>
            <p className="text-2xl font-black text-warning">{stats.maintenance}</p>
          </div>
          <div className="bg-surface-dark/50 backdrop-blur-md p-4 rounded-2xl border border-white/5 text-center shadow-md">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Total</p>
            <p className="text-2xl font-black text-white">{stats.total}</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="px-4 mb-6 flex gap-3 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              placeholder="Buscar equipamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-dark/40 backdrop-blur-md border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
            />
          </div>
          <button className="bg-surface-dark/40 backdrop-blur-md border border-white/5 w-12 h-12 rounded-2xl flex items-center justify-center text-gray-400 hover:text-white hover:border-white/10 transition-all">
            <Filter size={20} />
          </button>
        </div>

        {/* List */}
        <div className="px-4 space-y-4 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={40} className="animate-spin text-primary" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sincronizando frota...</p>
            </div>
          ) : filteredMachines.length === 0 ? (
            <div className="text-center py-20 bg-surface-dark/20 rounded-[32px] border border-dashed border-white/5">
              <p className="text-gray-500 text-sm font-medium">
                {searchTerm ? 'Nenhum equipamento encontrado.' : 'Sua frota está vazia.'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => navigate('/fleet/add')}
                  className="mt-4 text-primary font-black uppercase tracking-tighter text-xs hover:brightness-125 transition-all"
                >
                  Cadastrar Primeira Máquina +
                </button>
              )}
            </div>
          ) : (
            filteredMachines.map(machine => (
              <div
                key={machine.id}
                onClick={() => navigate(`/fleet/${machine.id}`)}
                className="bg-surface-dark/40 backdrop-blur-md p-5 rounded-3xl border border-white/5 active:scale-[0.98] transition-all cursor-pointer relative group hover:border-primary/20 shadow-lg"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/fleet/edit/${machine.id}`); }}
                  className="absolute top-4 right-4 p-2 text-gray-600 hover:text-primary hover:bg-primary/10 rounded-xl transition-all z-10"
                >
                  <Edit2 size={16} />
                </button>

                <div className="flex gap-4 items-center mb-4">
                  <div 
                    className="size-20 rounded-2xl bg-cover bg-center shrink-0 border-2 border-white/5 shadow-inner"
                    style={{ backgroundImage: `url(${machine.image_url || 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=20&w=200'})` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-heading font-black text-white text-lg truncate uppercase italic tracking-tight">{machine.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className={`size-2 rounded-full ${machine.status === 'active' ? 'bg-positive' : machine.status === 'maintenance' ? 'bg-warning' : 'bg-gray-600'}`} />
                       <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                         {machine.status === 'active' ? 'Operacional' : machine.status === 'maintenance' ? 'Em Reparo' : 'Indisponível'}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Saúde Operacional</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${(machine.health_score || 0) > 75 ? 'bg-positive' : (machine.health_score || 0) > 40 ? 'bg-warning' : 'bg-negative'}`}
                          style={{ width: `${machine.health_score || 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-white">{machine.health_score || 100}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-1.5 text-gray-400 group-hover:text-primary transition-colors">
                      <Clock size={14} />
                      <span className="text-xs font-bold">{machine.hours}h</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Wrench size={14} />
                      <span className="text-[10px] font-black uppercase">{getNextMaintenanceText(machine)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FAB */}
        <div className="fixed bottom-26 right-6 z-20">
          <button
            onClick={() => navigate('/fleet/add')}
            className="flex items-center gap-3 bg-primary text-black h-16 pl-6 pr-8 rounded-[24px] shadow-lg font-heading font-black uppercase italic tracking-tighter hover:scale-105 active:scale-95 transition-all group"
          >
            <Plus size={24} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Novo Ativo</span>
          </button>
        </div>
      </Layout.Content>
    </Layout>
  );
};

const FleetDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [machine, setMachine] = useState<SupabaseMachine | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadMachine(id);
  }, [id]);

  const loadMachine = async (machineId: string) => {
    try {
      setLoading(true);
      const data = await machineService.getById(machineId);
      setMachine(data);
    } catch (error) {
      console.error('Error loading machine:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <Layout>
      <Layout.Header title="Carregando..." showBack />
      <Layout.Content>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary" />
        </div>
      </Layout.Content>
    </Layout>
  );

  if (!machine) return (
    <Layout>
      <Layout.Header title="Não encontrada" showBack />
      <Layout.Content>
        <div className="text-center py-20 text-gray-500 font-bold uppercase tracking-widest text-xs">Ativo não localizado no banco.</div>
      </Layout.Content>
    </Layout>
  );

  return (
    <Layout>
      <Layout.Header 
        title="Detalhes" 
        subTitle={machine.name} 
        showBack 
        actions={
          <button onClick={() => navigate(`/fleet/edit/${machine.id}`)} className="p-2 text-gray-400 hover:text-white transition-colors">
            <Edit2 size={20} />
          </button>
        }
      />
      <Layout.Content>
        <div className="relative w-full h-80 overflow-hidden">
          <img
            src={machine.image_url || "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=800"}
            alt={machine.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${machine.status === 'active' ? 'bg-positive text-black' : 'bg-warning text-black'}`}>
                {machine.status === 'active' ? 'Em Operação' : 'Manutenção'}
              </span>
              <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">{machine.type}</span>
            </div>
            <h2 className="text-4xl font-heading font-black text-white uppercase italic tracking-tighter">{machine.name}</h2>
          </div>
        </div>

        <div className="px-6 space-y-8 -mt-4 relative z-10 pb-32">
          {/* Health Score Premium Card */}
          <div className="bg-surface-dark/60 backdrop-blur-2xl rounded-[32px] p-8 border border-white/5 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Saúde do Equipamento</h3>
                <p className="text-xs text-white/80 font-medium italic">{machine.health_reason || 'Análise estrutural pendente.'}</p>
              </div>
              <div className="text-right">
                <p className={`text-5xl font-heading font-black ${(machine.health_score || 0) > 75 ? 'text-positive' : 'text-warning'}`}>
                  {machine.health_score || 100}<span className="text-2xl font-bold opacity-50">%</span>
                </p>
              </div>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${(machine.health_score || 0) > 75 ? 'bg-positive' : 'bg-warning'}`}
                style={{ width: `${machine.health_score || 100}%` }}
              />
            </div>
          </div>

          {/* Quick Specs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-dark/40 p-5 rounded-3xl border border-white/5 space-y-1">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Horímetro Atual</p>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  <span className="text-xl font-black text-white">{machine.hours}</span>
                  <span className="text-xs font-bold text-gray-500">h</span>
                </div>
            </div>
            <div className="bg-surface-dark/40 p-5 rounded-3xl border border-white/5 space-y-1 text-right">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Ano / Modelo</p>
                <p className="text-xl font-black text-white">{machine.model_year || '2022'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => navigate('/maintenance/new')} className="bg-primary text-black py-4 rounded-2xl font-black uppercase italic tracking-tighter flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
              <PenTool size={20} strokeWidth={2.5} /> Reparar
            </button>
            <button onClick={() => navigate(`/fleet/${machine.id}/history`)} className="bg-surface-dark/40 text-white py-4 rounded-2xl font-black uppercase italic tracking-tighter flex items-center justify-center gap-2 border border-white/5 active:scale-95 transition-all">
              <History size={20} /> Histórico
            </button>
          </div>

          {/* Next Maintenance */}
          <div className="space-y-4 pt-4">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] px-1">Próxima Revisão</h3>
            <div className="bg-surface-dark/40 p-5 rounded-3xl border border-white/5 flex items-center justify-between group cursor-pointer hover:border-primary/20 transition-all">
              <div className="flex items-center gap-5">
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Calendar size={28} />
                </div>
                <div>
                  <p className="text-lg font-black text-white uppercase italic tracking-tight">
                    {machine.next_maintenance ? new Date(machine.next_maintenance).toLocaleDateString('pt-BR') : 'Livre'}
                  </p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">Preventiva 1000h</p>
                </div>
              </div>
              <ChevronRight size={24} className="text-gray-700 group-hover:text-primary transition-colors" />
            </div>
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};

export const Fleet: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<FleetList />} />
      <Route path="/add" element={<FleetForm />} />
      <Route path="/edit/:id" element={<FleetForm />} />
      <Route path="/:id" element={<FleetDetails />} />
    </Routes>
  );
};
