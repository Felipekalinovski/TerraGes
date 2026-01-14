
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
    <Layout title="Minha Frota" hideNav={false}>
      {/* Overview */}
      <div className="px-4 py-4 grid grid-cols-3 gap-3">
        <div className="bg-surface-dark p-3 rounded-xl text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Ativas</p>
          <p className="text-2xl font-bold text-positive">{stats.active}</p>
        </div>
        <div className="bg-surface-dark p-3 rounded-xl text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Manutenção</p>
          <p className="text-2xl font-bold text-warning">{stats.maintenance}</p>
        </div>
        <div className="bg-surface-dark p-3 rounded-xl text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Inativas</p>
          <p className="text-2xl font-bold text-white">{stats.inactive}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Buscar máquina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-dark border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button className="bg-surface-dark border border-white/5 w-10 h-10 rounded-lg flex items-center justify-center text-gray-300">
          <Filter size={20} />
        </button>
      </div>

      {/* List */}
      <div className="px-4 space-y-3 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-primary" />
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400">
              {searchTerm ? 'Nenhuma máquina encontrada.' : 'Nenhuma máquina cadastrada.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/fleet/add')}
                className="mt-4 text-primary font-bold hover:underline"
              >
                Adicionar primeira máquina
              </button>
            )}
          </div>
        ) : (
          filteredMachines.map(machine => (
            <div
              key={machine.id}
              onClick={() => navigate(`/fleet/${machine.id}`)}
              className="bg-surface-dark p-4 rounded-xl border border-white/5 active:scale-[0.98] transition-transform cursor-pointer relative group"
            >
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/fleet/edit/${machine.id}`); }}
                className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-10"
              >
                <Edit2 size={16} />
              </button>

              <div className="flex gap-3 items-start mb-2 pr-10">
                {machine.image_url && (
                  <div
                    className="size-16 rounded-lg bg-cover bg-center shrink-0 border border-white/10"
                    style={{ backgroundImage: `url(${machine.image_url})` }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate">{machine.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{machine.type}</p>
                </div>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
                  ${machine.status === 'active' ? 'bg-positive/20 text-positive' :
                    machine.status === 'maintenance' ? 'bg-warning/20 text-warning' : 'bg-gray-700 text-gray-400'}`}>
                  {machine.status === 'active' ? 'Ativa' : machine.status === 'maintenance' ? 'Em Manutenção' : 'Inativa'}
                </span>

                {/* Health Score Indicator */}
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(machine.health_score || 0) > 75 ? 'bg-positive' :
                        (machine.health_score || 0) > 40 ? 'bg-warning' : 'bg-negative'
                        }`}
                      style={{ width: `${machine.health_score || 100}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold ${(machine.health_score || 0) > 75 ? 'text-positive' :
                    (machine.health_score || 0) > 40 ? 'text-warning' : 'text-negative'
                    }`}>
                    {machine.health_score || 100}%
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock size={12} /> {machine.hours} h</span>
                <span className="flex items-center gap-1"><Wrench size={12} /> {getNextMaintenanceText(machine)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB - Add Machine */}
      <div className="fixed bottom-24 right-4 z-20">
        <button
          onClick={() => navigate('/fleet/add')}
          className="flex items-center gap-2 bg-primary text-white h-14 pl-5 pr-6 rounded-full shadow-lg shadow-primary/30 font-bold hover:bg-primary-hover transition-transform active:scale-95"
        >
          <Plus size={24} />
          <span className="text-base">Adicionar</span>
        </button>
      </div>
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
    <Layout title="Carregando..." showBack hideNav>
      <div className="flex items-center justify-center py-20">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    </Layout>
  );

  if (!machine) return (
    <Layout title="Não encontrada" showBack hideNav>
      <div className="text-center py-20 text-gray-400">Máquina não encontrada.</div>
    </Layout>
  );

  return (
    <Layout
      title="Detalhes da Máquina"
      showBack
      hideNav
      actions={
        <button
          onClick={() => navigate(`/fleet/edit/${machine.id}`)}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <Edit2 size={20} />
        </button>
      }
    >
      <div className="w-full h-64 bg-gray-800 relative">
        <img
          src={machine.image_url || "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=800&auto=format&fit=crop"}
          alt={machine.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-dark to-transparent"></div>
        <div className="absolute bottom-4 left-4">
          <h2 className="text-2xl font-bold text-white">{machine.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`size-2 rounded-full ${machine.status === 'active' ? 'bg-positive' : machine.status === 'maintenance' ? 'bg-warning' : 'bg-gray-500'}`}></span>
            <span className={`${machine.status === 'active' ? 'text-positive' : machine.status === 'maintenance' ? 'text-warning' : 'text-gray-400'} text-sm font-medium`}>
              {machine.status === 'active' ? 'Em Operação' : machine.status === 'maintenance' ? 'Em Manutenção' : 'Inativa'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        {/* Health Score Card */}
        <div className="bg-surface-dark rounded-xl p-5 border border-white/5 shadow-lg">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="text-sm text-gray-400 uppercase tracking-wider font-bold">Saúde da Máquina</h3>
              <p className="text-xs text-gray-500 mt-1">{machine.health_reason || 'Nenhuma análise recente.'}</p>
            </div>
            <div className="text-right">
              <span className={`text-3xl font-black ${(machine.health_score || 0) > 75 ? 'text-positive' :
                  (machine.health_score || 0) > 40 ? 'text-warning' : 'text-negative'
                }`}>
                {machine.health_score || 100}%
              </span>
            </div>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${(machine.health_score || 0) > 75 ? 'bg-positive' :
                  (machine.health_score || 0) > 40 ? 'bg-warning' : 'bg-negative'
                }`}
              style={{ width: `${machine.health_score || 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-gray-600 font-bold uppercase">Crítico</span>
            <span className="text-[10px] text-gray-600 font-bold uppercase">Excelente</span>
          </div>
        </div>

        <div className="bg-surface-dark rounded-xl p-4 border border-white/5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Tipo</p><p className="font-medium text-white">{machine.type}</p></div>
            <div><p className="text-gray-500">Fabricante</p><p className="font-medium text-white">{machine.manufacturer || '-'}</p></div>
            <div><p className="text-gray-500">Ano</p><p className="font-medium text-white">{machine.model_year || '-'}</p></div>
            <div><p className="text-gray-500">Horímetro</p><p className="font-medium text-white">{machine.hours} h</p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/maintenance/new')}
            className="bg-primary text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <PenTool size={18} /> Manutenção
          </button>
          <button
            onClick={() => navigate(`/fleet/${machine.id}/history`)}
            className="bg-surface-dark text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 border border-white/10 active:scale-95 transition-transform"
          >
            <History size={18} /> Histórico
          </button>
        </div>

        <div>
          <h3 className="font-bold text-lg mb-3 text-white">Próxima Manutenção</h3>
          <div className="bg-surface-dark p-4 rounded-xl border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-warning/20 flex items-center justify-center text-warning">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{machine.next_maintenance ? new Date(machine.next_maintenance).toLocaleDateString('pt-BR') : 'Não agendada'}</p>
                <p className="text-xs text-gray-400">Preventiva agendada</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-600" />
          </div>
        </div>
      </div>
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
